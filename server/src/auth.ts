import { createHash, timingSafeEqual } from 'node:crypto';

/** Routes lues directement par la balise <video> / <track> : impossible d'y joindre un en-tête. */
const MEDIA_PREFIXES = ['/proxy/', '/torrent/', '/transcode/'];

/** Routes d'appairage ouvertes par EventSource (sans en-têtes personnalisés). */
const OPEN_PREFIXES = ['/sync/pair/events/'];

export function isMediaPath(path: string): boolean {
  return MEDIA_PREFIXES.some((p) => path.startsWith(p));
}

export function isOpenPath(path: string): boolean {
  return path === '/auth-check' || OPEN_PREFIXES.some((p) => path.startsWith(p));
}

/** Comparaison en temps constant de deux clés via digest SHA-256 de longueur fixe. */
export function keysMatch(expected: string, provided: unknown): boolean {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const hA = createHash('sha256').update(expected).digest();
  const hB = createHash('sha256').update(provided).digest();
  return timingSafeEqual(hA, hB);
}

/**
 * Décide si une requête /api/* est autorisée.
 * - Aucune clé configurée : tout est autorisé.
 * - Sinon : en-tête `x-stremo-key`, ou paramètre `k` pour les routes média uniquement.
 */
export function isAuthorized(
  accessKey: string | undefined,
  path: string,
  headerKey: unknown,
  queryKey: unknown
): boolean {
  if (!accessKey || isOpenPath(path)) return true;
  if (keysMatch(accessKey, headerKey)) return true;
  return isMediaPath(path) && keysMatch(accessKey, queryKey);
}

/** Requête relayée par un proxy / tunnel public (Cloudflare…) et non issue de la machine elle-même. */
export function isTunnelRequest(headers: { [k: string]: unknown }): boolean {
  return Boolean(headers['x-forwarded-for'] || headers['cf-connecting-ip'] || headers['x-forwarded-host']);
}

/** Vérifie si la socket réseau provient de localhost / boucle locale. */
export function isLocalSocket(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  return remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
}
