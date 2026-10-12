const API_BASE = '/api';
const KEY_STORAGE = 'stremo_access_key';

/** fetch qui ajoute la clé d'accès (si configurée) et signale un refus 401 à l'interface. */
const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch.bind(globalThis);
async function fetch(input: string, init: RequestInit = {}): Promise<Response> {
  const key = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY_STORAGE) : null;
  const headers = new Headers(init.headers);
  if (key) headers.set('x-stremo-key', key);
  const res = await nativeFetch(input, { ...init, headers });
  if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('stremo-auth-required'));
  return res;
}

export const accessKey = {
  set: (key: string) => localStorage.setItem(KEY_STORAGE, key),
  check: async (): Promise<{ required: boolean; ok: boolean }> => {
    const res = await fetch(`${API_BASE}/auth-check`);
    const data = await res.json();
    return { required: !!data.required, ok: !!data.ok };
  },
};

export interface AddonInfo {
  id: string;
  name: string;
  enabled: number;
  host: string;
  hasConfig: boolean;
  manifest: null | {
    version: string;
    description?: string;
    logo?: string;
    types: string[];
    catalogs: number;
    resources: string[];
  };
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  isKids: number;
  pin?: string | null;
}

export interface WatchProgress {
  profileId: string;
  mediaId: string;
  mediaType: string;
  title: string;
  poster?: string;
  season?: number;
  episode?: number;
  currentTime: number;
  duration: number;
  completed: number;
  updatedAt: string;
}

export interface LibraryItem {
  id: string;
  profileId: string;
  mediaId: string;
  mediaType: string;
  title: string;
  poster?: string;
  year?: string;
  genres?: string;
}

export interface CastMember {
  name: string;
  character?: string;
  photo?: string | null;
}

export interface TrailerItem {
  source?: string;
  type?: string;
  name?: string;
  ytId?: string;
  title?: string;
}

export interface CatalogItem {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  landscapePoster?: string;
  description?: string;
  year?: string | number;
  runtime?: string;
  imdbRating?: string | number;
  genres?: string[];
  progressPercent?: number;
  currentTime?: number;
  duration?: number;
  season?: number;
  episode?: number;
}

const ADULT_GENRES_RE = /\b(horror|horreur|thriller|crime|erotic|érotique|war|guerre|gore|zombie|adult|mystery|policier)\b/i;
const FAMILY_GENRES_RE = /\b(animation|famille|family|jeunesse|enfants|children|aventure|adventure|comédie|comedy|kids|disney|pixar|fantasy|fantastique)\b/i;
const FORBIDDEN_WORDS_RE = /\b(horror|horreur|erotic|érotique|porn|sex|gore|slasher|zombie|murder|terror|massacre|bloody|torture)\b/i;

/** Détermine si un média est adapté à un profil Enfant */
export function isKidsSafeItem(item: CatalogItem): boolean {
  const genres = item.genres || [];
  const fullText = `${item.name || ''} ${item.description || ''} ${genres.join(' ')}`;

  // 1. Exclure immédiatement tout titre contenant des termes violents ou d'horreur
  if (FORBIDDEN_WORDS_RE.test(fullText)) return false;

  // 2. Si le média spécifie des genres
  if (genres.length > 0) {
    const hasAdultGenre = genres.some((g) => ADULT_GENRES_RE.test(g));
    const hasFamilyGenre = genres.some((g) => FAMILY_GENRES_RE.test(g));
    if (hasAdultGenre && !hasFamilyGenre) return false;
    return hasFamilyGenre;
  }

  // 3. Sans genre, vérifier si le titre est notoirement familial
  return FAMILY_GENRES_RE.test(fullText);
}

export interface CatalogSection {
  addonId: string;
  addonName: string;
  catalogId: string;
  catalogName: string;
  type: string;
  genres: string[];
  metas: CatalogItem[];
}

export interface MetaDetail extends CatalogItem {
  director?: string[];
  writer?: string[];
  cast?: (string | CastMember)[];
  app_extras?: {
    cast?: CastMember[];
    directors?: CastMember[];
    writers?: CastMember[];
    certification?: string;
  };
  trailers?: TrailerItem[];
  trailerStreams?: TrailerItem[];
  videos?: {
    id: string;
    title: string;
    season: number;
    episode: number;
    thumbnail?: string;
    overview?: string;
  }[];
}

export interface StreamSource {
  addonName: string;
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  infoHash?: string;
  behaviorHints?: any;
}

export const api = {
  getProfiles: async (): Promise<Profile[]> => {
    const res = await fetch(`${API_BASE}/profiles`);
    const data = await res.json();
    return data.profiles || [];
  },
  createProfile: async (name: string, avatar: string, isKids = false, pin?: string): Promise<Profile> => {
    const res = await fetch(`${API_BASE}/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, avatar, isKids, pin }),
    });
    const data = await res.json();
    return data.profile;
  },
  updateProfile: async (
    id: string,
    updates: { name?: string; avatar?: string; isKids?: boolean; pin?: string | null }
  ): Promise<Profile> => {
    const res = await fetch(`${API_BASE}/profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    return data.profile;
  },
  deleteProfile: async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/profiles/${id}`, { method: 'DELETE' });
  },
  getProgress: async (profileId: string): Promise<WatchProgress[]> => {
    const res = await fetch(`${API_BASE}/progress/${profileId}`);
    const data = await res.json();
    return data.progress || [];
  },
  saveProgress: async (item: Partial<WatchProgress>): Promise<void> => {
    await fetch(`${API_BASE}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  },
  deleteProgress: async (profileId: string, mediaId: string): Promise<void> => {
    await fetch(`${API_BASE}/progress/${profileId}/${encodeURIComponent(mediaId)}`, {
      method: 'DELETE',
    });
  },
  getLibrary: async (profileId: string): Promise<LibraryItem[]> => {
    const res = await fetch(`${API_BASE}/library/${profileId}`);
    const data = await res.json();
    return data.items || [];
  },
  addToLibrary: async (item: { profileId: string; mediaId: string; mediaType: string; title: string; poster?: string; year?: string; genres?: string[] }): Promise<void> => {
    await fetch(`${API_BASE}/library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  },
  removeFromLibrary: async (profileId: string, mediaId: string): Promise<void> => {
    await fetch(`${API_BASE}/library/${profileId}/${mediaId}`, { method: 'DELETE' });
  },
  getCatalogs: async (type: string = 'movie', genre?: string, search?: string): Promise<CatalogSection[]> => {
    const params = new URLSearchParams({ type });
    if (genre) params.append('genre', genre);
    if (search) params.append('search', search);
    const res = await fetch(`${API_BASE}/catalogs?${params.toString()}`);
    if (!res.ok) throw new Error('Catalogues indisponibles');
    const data = await res.json();
    return data.catalogs || [];
  },
  getMeta: async (type: string, id: string): Promise<MetaDetail | null> => {
    const res = await fetch(`${API_BASE}/meta/${type}/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.meta || null;
  },
  getStreams: async (type: string, id: string): Promise<StreamSource[]> => {
    const res = await fetch(`${API_BASE}/streams/${type}/${id}`);
    const data = await res.json();
    return data.streams || [];
  },
  getSubtitles: async (type: string, id: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/subtitles/${type}/${id}`);
    const data = await res.json();
    return data.subtitles || [];
  },
  playExternal: async (url: string, title?: string, startTime?: number, player: 'vlc' | 'mpv' | 'system' = 'vlc'): Promise<void> => {
    const res = await fetch(`${API_BASE}/play-external`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title, startTime, player }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Impossible de lancer le lecteur externe');
    }
  },
  getAddons: async (): Promise<AddonInfo[]> => {
    const res = await fetch(`${API_BASE}/addons`);
    const data = await res.json();
    return data.addons || [];
  },
  addAddon: async (url: string) => {
    const res = await fetch(`${API_BASE}/addons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return res.json();
  },
  installAddon: async (url: string) => {
    const res = await fetch(`${API_BASE}/addons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.replace(/^stremio:\/\//, 'https://') }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || "Impossible d'installer cet add-on");
    return data;
  },
  removeAddon: async (id: string) => {
    const res = await fetch(`${API_BASE}/addons/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },
};
