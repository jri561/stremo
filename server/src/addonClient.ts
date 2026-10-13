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

/** Remplace le poster par l'image brute TMDB quand l'add-on l'expose (sans notes incrustées). */
export function normalizePoster<T extends { poster?: string }>(meta: T): T {
  const raw = (meta as any)._rawPosterUrl;
  if (typeof raw === 'string' && raw.startsWith('http')) meta.poster = raw;
  return meta;
}
