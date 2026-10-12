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

export class AddonClient {
  private manifestUrl: string;

  constructor(manifestUrl: string) {
    this.manifestUrl = manifestUrl.replace(/\/+$/, '');
  }

  get baseUrl(): string {
    return this.manifestUrl.replace(/\/manifest\.json$/, '');
  }

  async getManifest(): Promise<StremioManifest> {
    const cached = manifestCache.get(this.manifestUrl);
    if (cached && Date.now() - cached.at < MANIFEST_TTL_MS) return cached.manifest;
    const res = await timedFetch(this.manifestUrl);
    if (!res.ok) throw new Error(`Impossible de charger le manifest: ${res.statusText}`);
    const manifest = await res.json() as StremioManifest;
    manifestCache.set(this.manifestUrl, { at: Date.now(), manifest });
    return manifest;
  }

  async getCatalog(type: string, id: string, extraArgs: Record<string, string> = {}): Promise<StremioMetaPreview[]> {
    let extraStr = '';
    const entries = Object.entries(extraArgs);
    if (entries.length > 0) {
      extraStr = '/' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    }
    const url = `${this.baseUrl}/catalog/${type}/${id}${extraStr}.json`;
    const res = await timedFetch(url);
    if (!res.ok) {
      console.warn(`Catalog error on ${url}: ${res.status}`);
      return [];
    }
    const data = await res.json() as { metas?: StremioMetaPreview[] };
    return data.metas || [];
  }

  async getMeta(type: string, id: string): Promise<StremioMetaDetail | null> {
    const url = `${this.baseUrl}/meta/${type}/${id}.json`;
    const res = await timedFetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { meta?: StremioMetaDetail };
    return data.meta || null;
  }

  async getStreams(type: string, id: string): Promise<StremioStream[]> {
    const url = `${this.baseUrl}/stream/${type}/${id}.json`;
    const res = await timedFetch(url);
    if (!res.ok) return [];
    const data = await res.json() as { streams?: StremioStream[] };
    return data.streams || [];
  }

  async getSubtitles(type: string, id: string): Promise<any[]> {
    const url = `${this.baseUrl}/subtitles/${type}/${id}.json`;
    const res = await timedFetch(url);
    if (!res.ok) return [];
    const data = await res.json() as { subtitles?: any[] };
    return data.subtitles || [];
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
