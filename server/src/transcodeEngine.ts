import { spawn } from 'node:child_process';
import type { Request, Response } from 'express';
import { isSafePlayableUrl } from './addonClient.js';

export interface StreamProbeResult {
  hasVideo: boolean;
  videoCodec?: string;
  hasAudio: boolean;
  audioCodec?: string;
  channels?: number;
  duration?: number;
}

export class TranscodeEngine {
  private ffmpegPath: string;
  private ffprobePath: string;
  private available: boolean | null = null;

  constructor() {
    this.ffmpegPath = process.env.FFMPEG_PATH || '/home/toto/.local/bin/ffmpeg';
    this.ffprobePath = process.env.FFPROBE_PATH || '/home/toto/.local/bin/ffprobe';
  }

  /**
   * Vérifie la disponibilité du binaire FFmpeg sur la machine hôte
   */
  public async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;

    return new Promise((resolve) => {
      try {
        const proc = spawn(this.ffmpegPath, ['-version']);
        proc.on('error', () => {
          this.available = false;
          resolve(false);
        });
        proc.on('close', (code) => {
          this.available = code === 0;
          resolve(this.available);
        });
      } catch {
        this.available = false;
        resolve(false);
      }
    });
  }

  /**
   * Analyse rapide (probe) des pistes audio et vidéo d'un flux distant
   */
  public async probe(inputUrl: string, timeoutMs = 8000): Promise<StreamProbeResult | null> {
    const isAvail = await this.isAvailable();
    if (!isAvail) return null;

    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, timeoutMs);

      try {
        const args = [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_streams',
          '-show_format',
          inputUrl,
        ];
        const proc = spawn(this.ffprobePath, args);
        let stdout = '';

        proc.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });

        proc.on('error', () => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        });

        proc.on('close', (code) => {
          clearTimeout(timeout);
          if (resolved) return;
          resolved = true;
          if (code !== 0 || !stdout) {
            resolve(null);
            return;
          }

          try {
            const data = JSON.parse(stdout);
            const streams = data.streams || [];
            const vStream = streams.find((s: any) => s.codec_type === 'video');
            const aStream = streams.find((s: any) => s.codec_type === 'audio');
            const duration = Number(data.format?.duration) || undefined;

            resolve({
              hasVideo: !!vStream,
              videoCodec: vStream?.codec_name,
              hasAudio: !!aStream,
              audioCodec: aStream?.codec_name,
              channels: aStream?.channels,
              duration,
            });
          } catch {
            resolve(null);
          }
        });
      } catch {
        clearTimeout(timeout);
        resolve(null);
      }
    });
  }

  /**
   * Diffuse le flux transcodé / remuxé en fragmented MP4
   */
  public async handleTranscode(req: Request, res: Response): Promise<void> {
    const isAvail = await this.isAvailable();
    if (!isAvail) {
      res.status(503).json({ error: 'Moteur FFmpeg non disponible sur le serveur' });
      return;
    }

    const rawUrl = (req.query.url as string) || '';
    if (!rawUrl) {
      res.status(400).json({ error: 'Paramètre url requis' });
      return;
    }

    // Résolution de l'URL cible
    let targetInputUrl = rawUrl;
    if (rawUrl.startsWith('magnet:') || /^[a-fA-F0-9]{40}$/.test(rawUrl.trim())) {
      // Pour un torrent, on pointe vers notre endpoint de streaming local
      const serverPort = process.env.PORT || '3001';
      targetInputUrl = `http://127.0.0.1:${serverPort}/api/torrent/stream?magnet=${encodeURIComponent(rawUrl)}`;
    } else if (!isSafePlayableUrl(rawUrl)) {
      res.status(400).json({ error: 'URL invalide ou non sécurisée' });
      return;
    }

    const startTime = Math.max(0, parseFloat(req.query.startTime as string) || 0);
    const mode = (req.query.mode as string) || 'audio'; // 'audio' (copy video, aac audio) ou 'full' (x264, aac)

    const args: string[] = [
      '-hide_banner',
      '-loglevel', 'error',
    ];

    if (startTime > 0) {
      args.push('-ss', String(startTime));
    }

    args.push('-i', targetInputUrl);

    if (mode === 'full') {
      args.push(
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p'
      );
    } else {
      // Copie vidéo pure (0% charge CPU), conversion audio universelle AAC stéréo
      args.push('-c:v', 'copy');
    }

    args.push(
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ac', '2',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1'
    );

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');

    const ffmpegProc = spawn(this.ffmpegPath, args);

    ffmpegProc.stdout.pipe(res);

    ffmpegProc.stderr.on('data', (err) => {
      console.warn('[FFmpeg Transcode]', err.toString().trim());
    });

    ffmpegProc.on('error', (err) => {
      console.error('Erreur lancement FFmpeg:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erreur lors du transcodage vidéo' });
      }
    });

    // Nettoyage immédiat du processus FFmpeg dès déconnexion du client
    req.on('close', () => {
      try {
        ffmpegProc.kill('SIGKILL');
      } catch {
        // Ignorer si déjà arrêté
      }
    });
  }
}

export const transcodeEngine = new TranscodeEngine();
