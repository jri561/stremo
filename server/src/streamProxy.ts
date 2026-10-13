import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { isSafePlayableUrl, isPublicHttpUrl } from './addonClient.js';
import { isTunnelRequest } from './auth.js';

/**
 * Convertit un fichier sous-titres au format SubRip (.srt) vers le format WebVTT (.vtt)
 * requis nativement par les balises HTML5 <track>.
 */
export function convertSrtToVtt(srtContent: string): string {
  if (!srtContent || typeof srtContent !== 'string') return 'WEBVTT\n\n';

  // Si c'est déjà du WebVTT, on nettoie simplement les retours à la ligne
  if (srtContent.trim().startsWith('WEBVTT')) {
    return srtContent.replace(/\r\n/g, '\n');
  }

  // 1. Remplacer les retours à la ligne Windows par Unix
  let vtt = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Remplacer les timestamps SRT 00:00:00,000 par le format WebVTT 00:00:00.000
  vtt = vtt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  // 3. Optionnel : format court 00:00,000
  vtt = vtt.replace(/(\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  // 4. Ajouter l'en-tête standard WebVTT
  return `WEBVTT\n\n${vtt.trim()}\n`;
}

/**
 * Effectue une requête HTTP en suivant les redirections manuellement et en validant
 * chaque URL cible avec isPublicHttpUrl pour parer les contournements SSRF par 301/302.
 */
async function fetchWithSafeRedirects(
  initialUrl: string,
  init: RequestInit,
  isTunnel: boolean,
  maxRedirects = 5
): Promise<globalThis.Response> {
  let currentUrl = initialUrl;
  let redirects = 0;

  while (true) {
    const res = await fetch(currentUrl, {
      ...init,
      redirect: 'manual',
    });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      redirects++;
      if (redirects > maxRedirects) {
        throw new Error('Trop de redirections HTTP (boucle détectée)');
      }
      const location = res.headers.get('location');
      if (!location) return res;
      const nextUrl = new URL(location, currentUrl).toString();
      const isOk = isTunnel
        ? isPublicHttpUrl(nextUrl, true)
        : isPublicHttpUrl(nextUrl, false);
      if (!isOk) {
        throw new Error('Redirection interdite vers une cible locale ou non autorisée');
      }
      currentUrl = nextUrl;
      continue;
    }

    return res;
  }
}

/**
 * Proxy de sous-titres avec conversion SRT -> WebVTT et injection de headers CORS.
 * Protégé contre le SSRF et les redirections vers des cibles locales/privées.
 */
export async function proxySubtitle(req: Request, res: Response): Promise<void> {
  const targetUrl = req.query.url as string;
  const isTunnel = isTunnelRequest(req.headers);

  const urlOk = isTunnel
    ? isPublicHttpUrl(targetUrl, true)
    : isSafePlayableUrl(targetUrl) && !targetUrl.startsWith('magnet:') && !targetUrl.includes('169.254.');

  if (!targetUrl || !urlOk) {
    res.status(400).json({ success: false, error: 'URL de sous-titre invalide ou interdite' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const upstream = await fetchWithSafeRedirects(
      targetUrl,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
      isTunnel
    );

    clearTimeout(timeout);

    if (!upstream.ok) {
      res.status(upstream.status).send('Erreur récupération sous-titre');
      return;
    }

    const text = await upstream.text();
    const vtt = convertSrtToVtt(text);

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(vtt);
  } catch (err: any) {
    res.status(502).json({ success: false, error: `Échec du proxy de sous-titre: ${err.message}` });
  }
}

/**
 * Proxy de streaming vidéo haute performance avec support des Range requests (HTTP 206)
 * et contournement des restrictions CORS des serveurs distants.
 */
export async function proxyStream(req: Request, res: Response): Promise<void> {
  const targetUrl = req.query.url as string;
  const isTunnel = isTunnelRequest(req.headers);

  // Depuis un tunnel public, les cibles locales et privées sont refusées (anti-SSRF)
  // En local, autorise les flux internes légitimes (torrent local) tout en bloquant les métadonnées cloud
  const urlOk = isTunnel
    ? isPublicHttpUrl(targetUrl, true)
    : isSafePlayableUrl(targetUrl) && !targetUrl.startsWith('magnet:') && !targetUrl.includes('169.254.');

  if (!targetUrl || !urlOk) {
    res.status(400).json({ success: false, error: 'URL vidéo http(s) requise' });
    return;
  }

  const rangeHeader = req.headers.range;
  const upstreamHeaders: Record<string, string> = {
    'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
    'Accept': '*/*',
  };

  if (rangeHeader) {
    upstreamHeaders['Range'] = rangeHeader;
  }

  const abortController = new AbortController();
  // 'close' de la réponse = déconnexion du client (seek, fermeture du lecteur)
  res.on('close', () => abortController.abort());

  try {
    const upstreamRes = await fetchWithSafeRedirects(
      targetUrl,
      {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: upstreamHeaders,
        signal: abortController.signal,
      },
      isTunnel
    );

    // En-têtes CORS permissifs pour navigateur web
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    // Répercuter le statut 200 ou 206
    res.status(upstreamRes.status);

    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
    ];

    for (const h of headersToForward) {
      const val = upstreamRes.headers.get(h);
      if (val) {
        res.setHeader(h, val);
      }
    }

    if (!res.getHeader('accept-ranges')) {
      res.setHeader('accept-ranges', 'bytes');
    }

    // Gestion du téléchargement forcé avec nom de fichier sain (suppression CRLF comprise)
    if (req.query.download === '1' || req.query.dl === '1') {
      const rawFilename = (req.query.filename as string) || 'video.mp4';
      const safeFilename = rawFilename.replace(/[\r\n/\\?%*:|"<>]/g, '_').trim() || 'video.mp4';
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }

    if (req.method === 'HEAD' || !upstreamRes.body) {
      res.end();
      return;
    }

    // Pipeline du flux ReadableStream vers la réponse Express avec gestion d'annulation propre
    const nodeStream = Readable.fromWeb(upstreamRes.body as any);

    nodeStream.on('error', (err: any) => {
      // AbortError ou déconnexion client : événement tout à fait normal lors d'un seek ou arrêt de vidéo
      if (err?.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.destroy();
      }
    });

    res.on('close', () => {
      abortController.abort();
      nodeStream.destroy();
    });

    nodeStream.pipe(res);
  } catch (err: any) {
    if (abortController.signal.aborted || err?.name === 'AbortError') {
      // Annulation normale par le client (seek ou fermeture du lecteur)
      return;
    }
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: `Erreur proxy de streaming: ${err.message}` });
    }
  }
}

/**
 * Récupère les timings précis de début et de fin d'intro/outro
 * depuis la base communautaire ouverte (AniSkip ou base locale).
 */
export async function getSkipTimes(
  malIdOrImdb: string,
  season?: number,
  episode?: number
): Promise<{
  found: boolean;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}> {
  // Si un numéro MAL ou ID anime numérique est passé
  const isNumeric = /^\d+$/.test(malIdOrImdb);
  const epNum = episode || 1;

  if (isNumeric) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const url = `https://api.aniskip.com/v2/skip-times/${malIdOrImdb}/${epNum}?types[]=op&types[]=ed&episodeLength=0`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.found && Array.isArray(data.results)) {
          const op = data.results.find((r: any) => r.skipType === 'op');
          const ed = data.results.find((r: any) => r.skipType === 'ed');

          return {
            found: !!(op || ed),
            intro: op ? { start: op.interval.startTime, end: op.interval.endTime } : undefined,
            outro: ed ? { start: ed.interval.startTime, end: ed.interval.endTime } : undefined,
          };
        }
      }
    } catch {
      // Erreur réseau ou timeout : fallback silencieux
    }
  }

  return { found: false };
}
