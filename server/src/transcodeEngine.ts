import { spawn, type ChildProcess } from 'node:child_process';
import type { Request, Response } from 'express';
import { isPublicHttpUrl, isSafePlayableUrl } from './addonClient.js';
import { isTunnelRequest } from './auth.js';
import { extractInfoHash, toMagnetUri } from './torrentEngine.js';

export interface StreamProbeResult {
  hasVideo: boolean;
  videoCodec?: string;
  hasAudio: boolean;
  audioCodec?: string;
  channels?: number;
  duration?: number;
}

export type TranscodeMode = 'audio' | 'full';

/** Nombre maximal de transcodages simultanés (protège le CPU de la machine). */
const MAX_CONCURRENT_JOBS = 3;
const MAX_START_TIME_S = 24 * 3600;
const USER_AGENT = 'VLC/3.0.18 LibVLC/3.0.18';
/** Protocoles autorisés en entrée : jamais `file:`, `concat:`, `data:`, etc. */
const PROTOCOL_WHITELIST = 'http,https,tcp,tls,crypto';

/**
 * Résout l'entrée d'ffmpeg :
 * - magnet / infoHash → flux local du moteur torrent (127.0.0.1, interne uniquement)
 * - URL http(s) publique → telle quelle (adresses locales acceptées seulement si `allowLocal`,
 *   c'est-à-dire pour une requête venant de la machine elle-même et non d'un tunnel public)
 * - tout le reste (file:, localhost, etc.) → null
 */
export function resolveTranscodeInput(raw: unknown, port: string | number, accessKey?: string, allowLocal = false): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4000) return null;
  if (extractInfoHash(raw)) {
    const magnet = toMagnetUri(raw);
    if (!magnet) return null;
    let url = `http://127.0.0.1:${port}/api/torrent/stream?magnet=${encodeURIComponent(magnet)}`;
    if (accessKey) url += `&k=${encodeURIComponent(accessKey)}`;
    return url;
  }
  if (allowLocal) return isSafePlayableUrl(raw) && !raw.startsWith('magnet:') ? raw : null;
  return isPublicHttpUrl(raw, true) ? raw : null;
}

/** Arguments ffmpeg : première piste vidéo + première piste audio, sans sous-titres, MP4 fragmenté vers stdout. */
export function buildFfmpegArgs(opts: { input: string; startTime?: number; mode?: TranscodeMode }): string[] {
  const start = Number.isFinite(opts.startTime) ? Math.min(Math.max(opts.startTime as number, 0), MAX_START_TIME_S) : 0;
  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    '-protocol_whitelist', PROTOCOL_WHITELIST,
    '-user_agent', USER_AGENT,
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
  ];
  if (start > 0) args.push('-ss', String(start));
  args.push('-i', opts.input, '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn');
  if (opts.mode === 'full') {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p');
  } else {
    // Copie vidéo pure (aucun coût CPU), seul l'audio est converti
    args.push('-c:v', 'copy');
  }
  args.push(
    '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4',
    'pipe:1'
  );
  return args;
}

export class TranscodeEngine {
  private ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  private ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';
  private available: boolean | null = null;
  private jobs = new Set<ChildProcess>();

  /** Vérifie (une seule fois) que le binaire FFmpeg est exécutable. */
  public isAvailable(): Promise<boolean> {
    if (this.available !== null) return Promise.resolve(this.available);
    return new Promise((resolve) => {
      const done = (ok: boolean) => {
        this.available = ok;
        resolve(ok);
      };
      try {
        const proc = spawn(this.ffmpegPath, ['-version'], { stdio: 'ignore' });
        proc.on('error', () => done(false));
        proc.on('close', (code) => done(code === 0));
      } catch {
        done(false);
      }
    });
  }

  public get activeJobs(): number {
    return this.jobs.size;
  }

  /** Analyse rapide des pistes d'un flux distant (null si indisponible, invalide ou trop lent). */
  public async probe(rawInput: string, timeoutMs = 8000, allowLocal = false): Promise<StreamProbeResult | null> {
    const port = process.env.PORT || '3001';
    const input = resolveTranscodeInput(rawInput, port, process.env.STREMO_ACCESS_KEY, allowLocal);
    if (!input || !(await this.isAvailable())) return null;

    return new Promise((resolve) => {
      let stdout = '';
      let settled = false;
      const proc = spawn(
        this.ffprobePath,
        ['-v', 'quiet', '-protocol_whitelist', PROTOCOL_WHITELIST, '-print_format', 'json', '-show_streams', '-show_format', input],
        { stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const finish = (value: StreamProbeResult | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        proc.kill('SIGKILL');
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);

      proc.stdout!.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      proc.on('error', () => finish(null));
      proc.on('close', (code) => {
        if (code !== 0 || !stdout) return finish(null);
        try {
          const data = JSON.parse(stdout);
          const streams: any[] = data.streams ?? [];
          const video = streams.find((s) => s.codec_type === 'video');
          const audio = streams.find((s) => s.codec_type === 'audio');
          const duration = Number(data.format?.duration);
          finish({
            hasVideo: !!video,
            videoCodec: video?.codec_name,
            hasAudio: !!audio,
            audioCodec: audio?.codec_name,
            channels: audio?.channels,
            duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
          });
        } catch {
          finish(null);
        }
      });
    });
  }

  /** Diffuse le flux remuxé / transcodé en MP4 fragmenté. */
  public async handleTranscode(req: Request, res: Response): Promise<void> {
    const port = process.env.PORT || '3001';
    const input = resolveTranscodeInput(req.query.url, port, process.env.STREMO_ACCESS_KEY, !isTunnelRequest(req.headers));
    if (!input) {
      res.status(400).json({ success: false, error: 'URL http(s) publique ou magnet requise' });
      return;
    }
    if (!(await this.isAvailable())) {
      res.status(503).json({ success: false, error: 'FFmpeg non disponible sur le serveur' });
      return;
    }

    const mode: TranscodeMode = req.query.mode === 'full' ? 'full' : 'audio';
    const startTime = Number(req.query.startTime ?? 0);
    if (!Number.isFinite(startTime) || startTime < 0) {
      res.status(400).json({ success: false, error: 'startTime invalide' });
      return;
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    if (this.jobs.size >= MAX_CONCURRENT_JOBS) {
      res.status(429).setHeader('Retry-After', '10');
      res.json({ success: false, error: 'Trop de transcodages simultanés, réessayez dans quelques secondes' });
      return;
    }

    const proc = spawn(this.ffmpegPath, buildFfmpegArgs({ input, startTime, mode }), {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.jobs.add(proc);
    let stderr = '';
    proc.stderr!.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    proc.on('error', (err) => {
      console.error('Erreur lancement FFmpeg:', err.message);
      this.jobs.delete(proc);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Erreur lors du transcodage vidéo' });
      else res.destroy();
    });
    proc.on('close', (code, signal) => {
      this.jobs.delete(proc);
      if (code && signal !== 'SIGKILL') console.warn('[FFmpeg] arrêt code', code, stderr.trim());
      if (!res.writableEnded) res.end();
    });

    proc.stdout!.pipe(res);
    // Déconnexion client (seek, fermeture du lecteur) : on libère immédiatement le CPU
    res.on('close', () => proc.kill('SIGKILL'));
  }
}

export const transcodeEngine = new TranscodeEngine();
