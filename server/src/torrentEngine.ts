import WebTorrent, { type Torrent, type TorrentFile } from 'webtorrent';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { Request, Response } from 'express';
import { DEFAULT_TRACKERS } from './addonClient.js';

export interface TorrentStats {
  infoHash: string;
  name: string;
  ready: boolean;
  numPeers: number;
  downloadSpeed: number; // octets/s
  uploadSpeed: number; // octets/s
  progress: number; // 0 à 1
  downloaded: number; // octets
  total: number; // octets
  files: Array<{
    index: number;
    name: string;
    length: number;
    isVideo: boolean;
  }>;
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.ts', '.flv']);

/** Nombre maximal de torrents actifs : le plus ancien est arrêté au-delà. */
const MAX_ACTIVE_TORRENTS = 4;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const METADATA_TIMEOUT_MS = 25000;

export function isVideoFileName(name: string): boolean {
  return VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase());
}

export function getMimeType(filename: string): string {
  switch (path.extname(filename).toLowerCase()) {
    case '.webm':
      return 'video/webm';
    case '.mkv':
      return 'video/x-matroska';
    case '.avi':
      return 'video/x-msvideo';
    case '.mov':
      return 'video/quicktime';
    case '.ts':
      return 'video/mp2t';
    default:
      return 'video/mp4';
  }
}

/** Extrait l'infoHash (40 hex ou 32 base32) d'un magnet ou d'un hash brut. */
export function extractInfoHash(magnetOrHash: string): string | null {
  if (!magnetOrHash) return null;
  const trimmed = magnetOrHash.trim();
  if (/^[a-fA-F0-9]{40}$/.test(trimmed)) return trimmed.toLowerCase();
  const match = trimmed.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})(?![a-zA-Z0-9])/i);
  return match ? match[1].toLowerCase() : null;
}

/** Sélection de fichier BEP 53 (`so=3`) d'un magnet : premier index valide, sinon undefined. */
export function extractFileSelection(magnet: string): number | undefined {
  const match = magnet.match(/[?&]so=(\d+)/);
  if (!match) return undefined;
  const index = parseInt(match[1], 10);
  return Number.isSafeInteger(index) ? index : undefined;
}

/** Normalise une entrée (hash ou magnet) en magnet complet avec trackers par défaut. */
export function toMagnetUri(magnetOrHash: string): string | null {
  const hash = extractInfoHash(magnetOrHash);
  if (!hash) return null;
  const trimmed = magnetOrHash.trim();
  if (trimmed.startsWith('magnet:')) return trimmed;
  return `magnet:?xt=urn:btih:${hash}` + DEFAULT_TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
}

export type ByteRange = { start: number; end: number };

/**
 * Analyse un en-tête HTTP Range (une seule plage) pour un fichier de `size` octets.
 * - `null` : pas de Range exploitable → réponse complète (200)
 * - `'unsatisfiable'` : plage hors fichier → 416
 * - `{start,end}` : plage valide, `end` borné à la taille du fichier
 */
export function parseRange(header: string | undefined, size: number): ByteRange | 'unsatisfiable' | null {
  if (!header) return null;
  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (match[1] === '' && match[2] === '')) return null;
  if (size <= 0) return 'unsatisfiable';

  let start: number;
  let end: number;
  if (match[1] === '') {
    // Plage « suffixe » : les N derniers octets
    const suffix = parseInt(match[2], 10);
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = parseInt(match[1], 10);
    end = match[2] === '' ? size - 1 : Math.min(parseInt(match[2], 10), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) {
    return 'unsatisfiable';
  }
  return { start, end };
}

export class TorrentEngine {
  private client: any = null;
  private cacheDir: string;
  private lastActivity = new Map<string, number>();
  private pending = new Map<string, Promise<Torrent>>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  private clientOptions: Record<string, unknown>;

  /** `clientOptions` permet d'isoler le réseau (ex. tests locaux sans DHT). */
  constructor(clientOptions: Record<string, unknown> = {}) {
    this.clientOptions = { maxConns: 65, tracker: true, dht: true, ...clientOptions };
    this.cacheDir = process.env.STREMO_TORRENT_DIR || path.join(process.cwd(), 'data', 'torrents');
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    } catch (err) {
      console.warn('Erreur création dossier cache torrent:', err);
    }
  }

  /** Client WebTorrent créé à la première utilisation (aucun socket tant qu'on ne lit pas de torrent). */
  private getClient(): any {
    if (!this.client) {
      this.client = new WebTorrent(this.clientOptions);
      this.client.on('error', (err: Error) => console.warn('[WebTorrent]', err.message));
      this.cleanupTimer = setInterval(() => this.cleanupInactiveTorrents(), 15 * 60 * 1000);
      this.cleanupTimer.unref();
    }
    return this.client;
  }

  private findTorrent(infoHash: string): Torrent | undefined {
    if (!this.client) return undefined;
    return (this.client.torrents as Torrent[]).find((t) => t.infoHash.toLowerCase() === infoHash);
  }

  private touch(infoHash: string): void {
    this.lastActivity.set(infoHash, Date.now());
  }

  /** Arrête les torrents les plus anciens pour rester sous MAX_ACTIVE_TORRENTS. */
  private makeRoom(): void {
    const torrents = [...(this.client.torrents as Torrent[])];
    if (torrents.length < MAX_ACTIVE_TORRENTS) return;
    torrents.sort((a, b) => (this.lastActivity.get(a.infoHash) ?? 0) - (this.lastActivity.get(b.infoHash) ?? 0));
    for (const old of torrents.slice(0, torrents.length - MAX_ACTIVE_TORRENTS + 1)) {
      this.lastActivity.delete(old.infoHash);
      old.destroy({ destroyStore: true });
    }
  }

  /**
   * Récupère (ou ajoute) un torrent et attend ses métadonnées.
   * Les appels simultanés pour un même hash (le navigateur envoie plusieurs Range) partagent la même promesse.
   */
  public getOrAddTorrent(magnetOrHash: string, timeoutMs = METADATA_TIMEOUT_MS): Promise<Torrent> {
    const infoHash = extractInfoHash(magnetOrHash);
    const magnetUri = toMagnetUri(magnetOrHash);
    if (!infoHash || !magnetUri) return Promise.reject(new Error('Lien magnet ou infoHash invalide'));

    const client = this.getClient();
    this.touch(infoHash);

    const existing = this.findTorrent(infoHash);
    if (existing && existing.ready) return Promise.resolve(existing);
    const inFlight = this.pending.get(infoHash);
    if (inFlight) return inFlight;

    const promise = new Promise<Torrent>((resolve, reject) => {
      let settled = false;
      const torrent: Torrent = existing ?? (() => {
        this.makeRoom();
        return client.add(magnetUri, { path: this.cacheDir, destroyStoreOnDestroy: true });
      })();

      const finish = (err: Error | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.pending.delete(infoHash);
        if (err) {
          try {
            torrent.destroy({ destroyStore: true });
          } catch {
            // déjà détruit
          }
          reject(err);
        } else {
          resolve(torrent);
        }
      };

      const timer = setTimeout(
        () => finish(new Error("Délai d'attente des métadonnées du torrent dépassé (aucun pair trouvé)")),
        timeoutMs
      );
      torrent.once('ready', () => finish(null));
      torrent.once('error', (err: any) => finish(err instanceof Error ? err : new Error(String(err))));
      torrent.once('close', () => finish(new Error('Torrent fermé avant la fin du chargement')));
      if (torrent.ready) finish(null);
    });

    this.pending.set(infoHash, promise);
    // Évite un « unhandled rejection » si plus personne n'attend la promesse partagée
    promise.catch(() => undefined);
    return promise;
  }

  /** Fichier vidéo à lire : index demandé s'il est valide, sinon le plus gros fichier vidéo. */
  public selectBestVideoFile(torrent: Torrent, fileIndex?: number): TorrentFile | null {
    const files = torrent.files ?? [];
    if (files.length === 0) return null;
    if (fileIndex !== undefined && Number.isInteger(fileIndex) && fileIndex >= 0 && fileIndex < files.length) {
      return files[fileIndex];
    }
    const biggest = (list: TorrentFile[]) => list.reduce((a, b) => (a.length >= b.length ? a : b));
    const videos = files.filter((f) => isVideoFileName(f.name));
    return biggest(videos.length > 0 ? videos : files);
  }

  /** Statistiques en temps réel (null si le torrent n'est pas (encore) chargé). */
  public getStats(magnetOrHash: string): TorrentStats | null {
    const infoHash = extractInfoHash(magnetOrHash);
    if (!infoHash) return null;
    const torrent = this.findTorrent(infoHash);
    if (!torrent) return null;
    this.touch(infoHash);

    return {
      infoHash: torrent.infoHash,
      name: torrent.name || 'Torrent',
      ready: torrent.ready,
      numPeers: torrent.numPeers,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      progress: torrent.progress,
      downloaded: torrent.downloaded,
      total: torrent.length,
      files: (torrent.files ?? []).map((f: TorrentFile, index: number) => ({
        index,
        name: f.name,
        length: f.length,
        isVideo: isVideoFileName(f.name),
      })),
    };
  }

  /** Diffuse un fichier du torrent en HTTP (200 / 206 / 416, HEAD inclus). */
  public async handleStream(req: Request, res: Response): Promise<void> {
    const magnet = String(req.query.magnet ?? req.query.infoHash ?? '');
    if (!extractInfoHash(magnet)) {
      res.status(400).json({ success: false, error: 'Paramètre magnet ou infoHash valide requis' });
      return;
    }

    let fileIndex = extractFileSelection(magnet);
    if (req.query.fileIndex !== undefined) {
      const parsed = Number(req.query.fileIndex);
      if (!Number.isInteger(parsed) || parsed < 0) {
        res.status(400).json({ success: false, error: 'fileIndex invalide' });
        return;
      }
      fileIndex = parsed;
    }

    try {
      const torrent = await this.getOrAddTorrent(magnet);
      const file = this.selectBestVideoFile(torrent, fileIndex);
      if (!file) {
        res.status(404).json({ success: false, error: 'Aucun fichier vidéo trouvé dans ce torrent' });
        return;
      }
      if (res.destroyed) return;

      // Téléchargement prioritaire du fichier lu uniquement
      torrent.files.forEach((f: TorrentFile) => (f === file ? f.select() : f.deselect()));
      this.touch(torrent.infoHash.toLowerCase());

      const size = file.length;
      const range = parseRange(req.headers.range, size);

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', getMimeType(file.name));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
      res.setHeader('Cache-Control', 'no-cache');

      if (range === 'unsatisfiable') {
        res.status(416).setHeader('Content-Range', `bytes */${size}`);
        res.end();
        return;
      }

      const start = range ? range.start : 0;
      const end = range ? range.end : size - 1;
      res.status(range ? 206 : 200);
      if (range) res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', end - start + 1);

      if (req.method === 'HEAD' || size === 0) {
        res.end();
        return;
      }

      const stream = file.createReadStream({ start, end });
      stream.on('error', () => res.destroy());
      // 'close' sur la réponse : déclenché par une déconnexion client (seek, fermeture du lecteur)
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (err: any) {
      console.error('Erreur lecture torrent:', err?.message ?? err);
      if (!res.headersSent) {
        res.status(504).json({ success: false, error: err?.message || 'Impossible de démarrer la lecture du torrent' });
      } else {
        res.destroy();
      }
    }
  }

  /** Arrête les torrents inactifs depuis plus de 30 minutes. */
  private cleanupInactiveTorrents(): void {
    if (!this.client) return;
    const now = Date.now();
    for (const torrent of [...(this.client.torrents as Torrent[])]) {
      const hash = torrent.infoHash.toLowerCase();
      if (now - (this.lastActivity.get(hash) ?? 0) > IDLE_TIMEOUT_MS) {
        try {
          torrent.destroy({ destroyStore: true });
        } catch (e) {
          console.warn('Erreur suppression torrent inactif:', e);
        }
        this.lastActivity.delete(hash);
      }
    }
  }

  /** Arrêt propre de l'instance. */
  public destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    const client = this.client;
    this.client = null;
    this.pending.clear();
    return new Promise((resolve) => {
      if (!client) return resolve();
      try {
        client.destroy(() => resolve());
      } catch {
        resolve();
      }
    });
  }
}

export const torrentEngine = new TorrentEngine();
