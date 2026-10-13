import WebTorrent, { type Torrent, type TorrentFile } from 'webtorrent';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { Request, Response } from 'express';

export interface TorrentStats {
  infoHash: string;
  name: string;
  ready: boolean;
  numPeers: number;
  downloadSpeed: number; // bytes/sec
  uploadSpeed: number; // bytes/sec
  progress: number; // 0 to 1
  downloaded: number; // bytes
  total: number; // bytes
  files: Array<{
    index: number;
    name: string;
    length: number;
    isVideo: boolean;
  }>;
}

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mkv',
  '.webm',
  '.avi',
  '.mov',
  '.m4v',
  '.ts',
  '.flv',
]);

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
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

export function extractInfoHash(magnetOrHash: string): string | null {
  if (!magnetOrHash) return null;
  const trimmed = magnetOrHash.trim();
  if (/^[a-fA-F0-9]{40}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const match = trimmed.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  return match ? match[1].toLowerCase() : null;
}

export class TorrentEngine {
  private client: any = null;
  private cacheDir: string;
  private lastActivity: Map<string, number> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.cacheDir = path.join(os.tmpdir(), 'stremo_torrents');
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch (err) {
        console.warn('Erreur création dossier cache torrent:', err);
      }
    }
  }

  private getClient(): any {
    if (!this.client) {
      this.client = new WebTorrent({
        maxConns: 65,
        tracker: true,
        dht: true,
      });

      this.cleanupTimer = setInterval(() => {
        this.cleanupInactiveTorrents();
      }, 15 * 60 * 1000);
      this.cleanupTimer.unref();
    }
    return this.client;
  }

  /**
   * Récupère ou ajoute un torrent de manière asynchrone
   */
  public async getOrAddTorrent(magnetOrHash: string, timeoutMs = 25000): Promise<Torrent> {
    const client = this.getClient();
    const infoHash = extractInfoHash(magnetOrHash);
    if (infoHash) {
      const existing = (client.torrents as Torrent[]).find(
        (t: Torrent) => t.infoHash.toLowerCase() === infoHash
      );
      if (existing) {
        this.lastActivity.set(infoHash, Date.now());
        if (existing.ready || (existing.files && existing.files.length > 0)) {
          return existing;
        }
      }
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error("Délai d'attente des métadonnées du torrent dépassé (aucun pair trouvé)"));
        }
      }, timeoutMs);

      try {
        const torrent = client.add(
          magnetOrHash,
          {
            path: this.cacheDir,
            destroyStoreOnDestroy: true,
          },
          (t: Torrent) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.lastActivity.set(t.infoHash.toLowerCase(), Date.now());
              resolve(t);
            }
          }
        );

        torrent.on('metadata', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.lastActivity.set(torrent.infoHash.toLowerCase(), Date.now());
            resolve(torrent);
          }
        });

        torrent.on('error', (err: any) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            reject(err);
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * Trouve le fichier vidéo optimal dans le torrent
   */
  public selectBestVideoFile(torrent: Torrent, fileIndex?: number): TorrentFile | null {
    if (!torrent.files || torrent.files.length === 0) return null;

    if (fileIndex !== undefined && fileIndex >= 0 && fileIndex < torrent.files.length) {
      return torrent.files[fileIndex];
    }

    // Filtrer par extensions vidéo
    const videoFiles = torrent.files.filter((f: TorrentFile) => {
      const ext = path.extname(f.name).toLowerCase();
      return VIDEO_EXTENSIONS.has(ext);
    });

    if (videoFiles.length > 0) {
      // Choisir le plus volumineux
      return videoFiles.reduce((prev: TorrentFile, current: TorrentFile) =>
        prev.length > current.length ? prev : current
      );
    }

    // Fallback : fichier le plus gros de tout le torrent
    return torrent.files.reduce((prev: TorrentFile, current: TorrentFile) =>
      prev.length > current.length ? prev : current
    );
  }

  /**
   * Retourne les statistiques en temps réel d'un torrent
   */
  public getStats(magnetOrHash: string): TorrentStats | null {
    if (!this.client) return null;
    const infoHash = extractInfoHash(magnetOrHash);
    if (!infoHash) return null;

    const torrent = (this.client.torrents as Torrent[]).find(
      (t: Torrent) => t.infoHash.toLowerCase() === infoHash
    );
    if (!torrent) return null;

    this.lastActivity.set(infoHash, Date.now());

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
      files: (torrent.files || []).map((f: TorrentFile, idx: number) => ({
        index: idx,
        name: f.name,
        length: f.length,
        isVideo: VIDEO_EXTENSIONS.has(path.extname(f.name).toLowerCase()),
      })),
    };
  }

  /**
   * Diffuse le flux vidéo d'un torrent en streaming HTTP avec support HTTP 206 Range
   */
  public async handleStream(req: Request, res: Response): Promise<void> {
    const magnet = (req.query.magnet as string) || (req.query.infoHash as string);
    if (!magnet) {
      res.status(400).json({ error: 'Paramètre magnet ou infoHash requis' });
      return;
    }

    const fileIndexQuery = req.query.fileIndex as string | undefined;
    const fileIndex = fileIndexQuery !== undefined ? parseInt(fileIndexQuery, 10) : undefined;

    try {
      const torrent = await this.getOrAddTorrent(magnet);
      const file = this.selectBestVideoFile(torrent, fileIndex);

      if (!file) {
        res.status(404).json({ error: 'Aucun fichier vidéo trouvé dans ce torrent' });
        return;
      }

      // Prioriser le fichier vidéo sélectionné pour le téléchargement séquentiel
      torrent.files.forEach((f: TorrentFile) => {
        if (f !== file) {
          f.deselect();
        }
      });
      file.select();

      const infoHash = torrent.infoHash.toLowerCase();
      this.lastActivity.set(infoHash, Date.now());

      const mimeType = getMimeType(file.name);
      const totalSize = file.length;
      const range = req.headers.range;

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

        if (start >= totalSize || end >= totalSize) {
          res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
          return;
        }

        const chunkSize = end - start + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', chunkSize);

        const stream = file.createReadStream({ start, end });
        stream.pipe(res);

        req.on('close', () => {
          stream.destroy();
        });
      } else {
        res.status(200);
        res.setHeader('Content-Length', totalSize);

        const stream = file.createReadStream();
        stream.pipe(res);

        req.on('close', () => {
          stream.destroy();
        });
      }
    } catch (err: any) {
      console.error('Erreur lecture torrent:', err);
      if (!res.headersSent) {
        res.status(504).json({
          error: err.message || 'Impossible de démarrer la lecture du torrent',
        });
      }
    }
  }

  /**
   * Nettoie les torrents inactifs depuis plus de 30 minutes
   */
  private cleanupInactiveTorrents(): void {
    if (!this.client) return;
    const now = Date.now();
    const maxIdleMs = 30 * 60 * 1000;

    for (const torrent of (this.client.torrents as Torrent[])) {
      const hash = torrent.infoHash.toLowerCase();
      const last = this.lastActivity.get(hash) || 0;
      if (now - last > maxIdleMs) {
        try {
          torrent.destroy({ destroyStore: true });
          this.lastActivity.delete(hash);
        } catch (e) {
          console.warn('Erreur suppression torrent inactif:', e);
        }
      }
    }
  }

  /**
   * Arrêt propre de l'instance
   */
  public destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    return new Promise((resolve) => {
      try {
        if (this.client) {
          this.client.destroy(() => resolve());
        } else {
          resolve();
        }
      } catch (e) {
        resolve();
      }
    });
  }
}

export const torrentEngine = new TorrentEngine();
