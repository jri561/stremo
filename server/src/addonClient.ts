export interface StremioManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  resources: (string | { name: string; types?: string[]; idPrefixes?: string[] })[];
  types: string[];
  catalogs: StremioCatalogDef[];
  idPrefixes?: string[];
  background?: string;
  logo?: string;
}

export interface StremioCatalogDef {
  type: string;
  id: string;
  name: string;
  genres?: string[];
  extra?: { name: string; isRequired?: boolean; options?: string[] }[];
  extraSupported?: string[];
  extraRequired?: string[];
}

export interface StremioMetaPreview {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  year?: string | number;
  imdbRating?: string | number;
  genres?: string[];
}

export interface StremioVideoEpisode {
  id: string;
  title: string;
  released?: string;
  thumbnail?: string;
  episode: number;
  season: number;
  overview?: string;
}

export interface StremioMetaDetail extends StremioMetaPreview {
  videos?: StremioVideoEpisode[];
  runtime?: string;
  cast?: string[];
  director?: string[];
  trailerStreams?: { title: string; ytId: string }[];
}

export interface StremioStream {
  name?: string;
  title?: string;
  infoHash?: string;
  fileIdx?: number;
  sources?: string[];
  url?: string;
  ytId?: string;
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    proxyHeaders?: Record<string, string>;
  };
}

const FETCH_TIMEOUT_MS = 8000;
const MANIFEST_TTL_MS = 10 * 60 * 1000;
// Cache de manifests partagé entre toutes les requêtes
const manifestCache = new Map<string, { at: number; manifest: StremioManifest }>();

/** fetch avec délai maximal pour qu'un add-on lent ne bloque jamais l'application. */
function timedFetch(url: string, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(ms) });
}

export interface AddonCache {
  getCache<T = any>(key: string): T | null;
  setCache(key: string, value: any, ttlSeconds: number): void;
}

export class AddonClient {
  private manifestUrl: string;
  private cache?: AddonCache;

  constructor(manifestUrl: string, cache?: AddonCache) {
    this.manifestUrl = manifestUrl.replace(/\/+$/, '');
    this.cache = cache;
  }

  get baseUrl(): string {
    return this.manifestUrl.replace(/\/manifest\.json$/, '');
  }

  async getManifest(): Promise<StremioManifest> {
    const cacheKey = `manifest:${this.manifestUrl}`;
    if (this.cache) {
      const cached = this.cache.getCache<StremioManifest>(cacheKey);
      if (cached) return cached;
    }

    const memoryCached = manifestCache.get(this.manifestUrl);
    if (memoryCached && Date.now() - memoryCached.at < MANIFEST_TTL_MS) return memoryCached.manifest;

    const res = await timedFetch(this.manifestUrl);
    if (!res.ok) throw new Error(`Impossible de charger le manifest: ${res.statusText}`);
    const manifest = await res.json() as StremioManifest;
    manifestCache.set(this.manifestUrl, { at: Date.now(), manifest });

    if (this.cache) {
      this.cache.setCache(cacheKey, manifest, 3600); // 1h
    }

    return manifest;
  }

  async getCatalog(type: string, id: string, extraArgs: Record<string, string> = {}): Promise<StremioMetaPreview[]> {
    const isSearch = !!extraArgs.search;
    const cacheKey = `cat:${this.manifestUrl}:${type}:${id}:${JSON.stringify(extraArgs)}`;

    if (this.cache && !isSearch) {
      const cached = this.cache.getCache<StremioMetaPreview[]>(cacheKey);
      if (cached && cached.length > 0) return cached;
    }

    let extraStr = '';
    const entries = Object.entries(extraArgs);
    if (entries.length > 0) {
      extraStr = '/' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    }
    const url = `${this.baseUrl}/catalog/${type}/${id}${extraStr}.json`;

    try {
      const res = await timedFetch(url);
      if (!res.ok) {
        console.warn(`Catalog error on ${url}: ${res.status}`);
        return [];
      }
      const data = await res.json() as { metas?: StremioMetaPreview[] };
      const metas = data.metas || [];

      if (this.cache && metas.length > 0) {
        // TTL 15 min pour catalogues classiques, 3 min pour recherches
        this.cache.setCache(cacheKey, metas, isSearch ? 180 : 900);
      }

      return metas;
    } catch (err) {
      console.warn(`Catalog fetch failure on ${url}:`, err);
      // Fallback gracieux sur le cache même expiré en cas d'erreur réseau
      return [];
    }
  }

  async getMeta(type: string, id: string): Promise<StremioMetaDetail | null> {
    const cacheKey = `meta:${this.manifestUrl}:${type}:${id}`;

    if (this.cache) {
      const cached = this.cache.getCache<StremioMetaDetail>(cacheKey);
      if (cached) return cached;
    }

    const url = `${this.baseUrl}/meta/${type}/${id}.json`;
    try {
      const res = await timedFetch(url);
      if (!res.ok) return null;
      const data = await res.json() as { meta?: StremioMetaDetail };
      const meta = data.meta || null;

      if (this.cache && meta) {
        // Métadonnées statiques d'un film ou d'une série : mise en cache 24h
        this.cache.setCache(cacheKey, meta, 86400);
      }

      return meta;
    } catch (err) {
      console.warn(`Meta fetch failure on ${url}:`, err);
      return null;
    }
  }

  async getStreams(type: string, id: string): Promise<StremioStream[]> {
    const cacheKey = `streams:${this.manifestUrl}:${type}:${id}`;

    if (this.cache) {
      const cached = this.cache.getCache<StremioStream[]>(cacheKey);
      if (cached && cached.length > 0) return cached;
    }

    const url = `${this.baseUrl}/stream/${type}/${id}.json`;
    try {
      const res = await timedFetch(url);
      if (!res.ok) return [];
      const data = await res.json() as { streams?: StremioStream[] };
      const streams = data.streams || [];

      if (this.cache && streams.length > 0) {
        // Flux en cache pendant 4 minutes (permet le rechargement immédiat)
        this.cache.setCache(cacheKey, streams, 240);
      }

      return streams;
    } catch (err) {
      console.warn(`Streams fetch failure on ${url}:`, err);
      return [];
    }
  }

  async getSubtitles(type: string, id: string): Promise<any[]> {
    const cacheKey = `subs:${this.manifestUrl}:${type}:${id}`;
    if (this.cache) {
      const cached = this.cache.getCache<any[]>(cacheKey);
      if (cached && cached.length > 0) return cached;
    }

    const url = `${this.baseUrl}/subtitles/${type}/${id}.json`;
    try {
      const res = await timedFetch(url);
      if (!res.ok) return [];
      const data = await res.json() as { subtitles?: any[] };
      const subtitles = data.subtitles || [];
      if (this.cache && subtitles.length > 0) {
        this.cache.setCache(cacheKey, subtitles, 3600); // 1h pour les sous-titres
      }
      return subtitles;
    } catch (err) {
      console.warn(`Subtitles fetch failure on ${url}:`, err);
      return [];
    }
  }
}

/** Masque l'URL d'un add-on : le chemin peut contenir un jeton secret. */
export function maskAddonUrl(url: string): { host: string; hasConfig: boolean } {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/manifest\.json$/, '').replace(/^\/+|\/+$/g, '');
    return { host: u.host, hasConfig: path.length > 0 || u.search.length > 0 };
  } catch {
    return { host: 'inconnu', hasConfig: false };
  }
}

/** Valide une URL à ouvrir dans un lecteur externe (http, https, magnet uniquement). */
export function isSafePlayableUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 4000 || url.startsWith('-')) return false;
  try {
    return ['http:', 'https:', 'magnet:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function isPrivateIp(host: string): boolean {
  if (/^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  return false;
}

/**
 * URL http(s) distante utilisable par le proxy / le transcodeur :
 * refuse les cibles locales (boucle locale, lien-local, adresse nulle) pour éviter le SSRF.
 * Si blockPrivateRanges est activé (ex: requêtes provenant d'un tunnel public),
 * les sous-réseaux privés RFC 1918 sont également rejetés pour empêcher le scan du LAN.
 */
export function isPublicHttpUrl(url: unknown, blockPrivateRanges = false): url is string {
  if (!isSafePlayableUrl(url) || url.startsWith('magnet:')) return false;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0' || host === '::' || host === '::1') return false;
    if (/^127\./.test(host) || /^169\.254\./.test(host) || /^0\./.test(host)) return false;
    if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe80:/.test(host)) return false;
    // Rejet des entiers bruts ou représentations hexadécimales (ex: 0x7f000001 ou 2130706433)
    if (/^0x[0-9a-f]+/i.test(host) || /^\d+$/.test(host)) return false;
    // Rejet des noms de domaines de rebinding public pointant vers localhost ou link-local
    if (/(^|\.)(nip|sslip)\.io$/.test(host) || host.includes('127.0.0.1') || host.includes('169.254.')) return false;
    if (blockPrivateRanges && isPrivateIp(host)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Trackers publics ajoutés aux magnets reconstruits (le DHT seul est trop lent au démarrage). */
export const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://open.stealth.si:80/announce',
  'udp://exodus.desync.com:6969/announce',
];

/**
 * Reconstruit un lien magnet complet depuis un flux Stremio « infoHash » :
 * trackers de l'add-on (`sources: ["tracker:udp://…"]`) + trackers par défaut,
 * et sélection de fichier BEP 53 (`so=`) pour les packs de saisons.
 */
export function buildMagnet(stream: { infoHash?: string; fileIdx?: number; sources?: string[]; name?: string; title?: string }): string | undefined {
  const hash = stream.infoHash?.trim();
  if (!hash || !/^([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})$/.test(hash)) return undefined;
  const trackers = new Set<string>();
  for (const src of stream.sources ?? []) {
    const m = typeof src === 'string' ? src.match(/^tracker:(.+)$/) : null;
    if (m && /^(udp|http|https|wss?):\/\//.test(m[1])) trackers.add(m[1]);
  }
  for (const t of DEFAULT_TRACKERS) trackers.add(t);
  let magnet = `magnet:?xt=urn:btih:${hash.toLowerCase()}`;
  const label = (stream.title ?? stream.name ?? '').split('\n')[0].slice(0, 120);
  if (label) magnet += `&dn=${encodeURIComponent(label)}`;
  for (const t of trackers) magnet += `&tr=${encodeURIComponent(t)}`;
  if (Number.isInteger(stream.fileIdx) && (stream.fileIdx as number) >= 0) magnet += `&so=${stream.fileIdx}`;
  return magnet;
}

/** Remplace le poster par l'image brute TMDB quand l'add-on l'expose (sans notes incrustées). */
export function normalizePoster<T extends { poster?: string }>(meta: T): T {
  const raw = (meta as any)._rawPosterUrl;
  if (typeof raw === 'string' && raw.startsWith('http')) meta.poster = raw;
  return meta;
}
