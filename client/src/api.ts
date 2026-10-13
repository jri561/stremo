const API_BASE = '/api';
const KEY_STORAGE = 'stremo_access_key';
const ACCOUNT_TOKEN_STORAGE = 'stremo_account_token';

/** fetch qui ajoute la clé d'accès (si configurée) et le jeton de compte et signale un refus 401 à l'interface. */
const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch.bind(globalThis);
async function fetch(input: string, init: RequestInit = {}): Promise<Response> {
  const key = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY_STORAGE) : null;
  const accountToken = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCOUNT_TOKEN_STORAGE) : null;
  const headers = new Headers(init.headers);
  if (key) headers.set('x-stremo-key', key);
  if (accountToken) headers.set('x-account-token', accountToken);
  const res = await nativeFetch(input, { ...init, headers });
  if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('stremo-auth-required'));
  return res;
}

/**
 * Ajoute la clé d'accès (?k=) aux URL consommées directement par <video>/<track>,
 * qui ne peuvent pas envoyer d'en-tête personnalisé. Sans clé configurée, l'URL est inchangée.
 */
function withAccessKey(url: string): string {
  const key = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY_STORAGE) : null;
  return key ? `${url}${url.includes('?') ? '&' : '?'}k=${encodeURIComponent(key)}` : url;
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
  accountId?: string | null;
  name: string;
  avatar: string;
  color?: string;
  isKids: number;
  pin?: string | null;
  preferredAudioLanguage?: string;
  preferredSubtitleLanguage?: string;
  subtitleMode?: string;
}

export interface Account {
  id: string;
  username: string;
  email?: string;
  createdAt: string;
}

export interface AccountSession {
  token: string;
  accountId: string;
  deviceName?: string;
  expiresAt: number;
  createdAt: string;
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
export interface NextUpItem {
  id: string;
  seriesId: string;
  seriesTitle: string;
  title: string;
  type: 'series';
  poster?: string;
  season: number;
  episode: number;
  isNextEpisode: boolean;
  currentTime: number;
  duration: number;
  progressPercent: number;
  updatedAt: string;
}

export interface ProfileStats {
  totalWatchTimeSeconds: number;
  totalWatchTimeFormatted: string;
  moviesWatchedCount: number;
  episodesWatchedCount: number;
  totalItemsCount: number;
  libraryItemsCount: number;
  completionRatePercent: number;
  topGenres: Array<{ genre: string; count: number }>;
  favoriteSeries?: { title: string; episodesWatched: number };
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
  isNextEpisode?: boolean;
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
  fileIdx?: number;
  sources?: string[];
  behaviorHints?: any;
}

export const api = {
  getProfiles: async (): Promise<Profile[]> => {
    const res = await fetch(`${API_BASE}/profiles`);
    const data = await res.json();
    return data.profiles || [];
  },
  createProfile: async (
    name: string,
    avatar: string,
    isKids = false,
    pin?: string,
    preferredAudioLanguage?: string,
    preferredSubtitleLanguage?: string,
    subtitleMode?: string,
    color = 'indigo'
  ): Promise<Profile> => {
    const res = await fetch(`${API_BASE}/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, avatar, isKids, pin, preferredAudioLanguage, preferredSubtitleLanguage, subtitleMode, color }),
    });
    const data = await res.json();
    return data.profile;
  },
  updateProfile: async (
    id: string,
    updates: {
      name?: string;
      avatar?: string;
      color?: string;
      isKids?: boolean;
      pin?: string | null;
      preferredAudioLanguage?: string;
      preferredSubtitleLanguage?: string;
      subtitleMode?: string;
    }
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
  getNextUp: async (profileId: string): Promise<NextUpItem[]> => {
    try {
      const res = await fetch(`${API_BASE}/profiles/${profileId}/next-up`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.nextUp || [];
    } catch {
      return [];
    }
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
  getTraktAuth: async (profileId: string): Promise<TraktAuthInfo | null> => {
    const res = await fetch(`${API_BASE}/trakt/auth/${profileId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.auth || null;
  },
  saveTraktAuth: async (profileId: string, authData: { accessToken: string; username?: string; refreshToken?: string; expiresAt?: number }): Promise<TraktAuthInfo> => {
    const res = await fetch(`${API_BASE}/trakt/auth/${profileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authData),
    });
    const data = await res.json();
    return data.auth;
  },
  disconnectTrakt: async (profileId: string): Promise<void> => {
    await fetch(`${API_BASE}/trakt/auth/${profileId}`, { method: 'DELETE' });
  },
  scrobbleTrakt: async (payload: {
    profileId: string;
    action: 'start' | 'pause' | 'stop';
    progress: number;
    media: {
      title: string;
      year?: string | number;
      type: 'movie' | 'episode';
      tmdbId?: string | number;
      imdbId?: string;
      season?: number;
      episode?: number;
    };
  }): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/trakt/scrobble`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return !!data.success;
    } catch {
      return false;
    }
  },
  exportBackup: async (): Promise<BackupData> => {
    const res = await fetch(`${API_BASE}/backup/export`);
    if (!res.ok) throw new Error("Échec de l'exportation de la sauvegarde");
    const data = await res.json();
    return data.backup || data;
  },
  importBackup: async (backupData: any): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/backup/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Échec de l'importation de la sauvegarde");
    }
    return data;
  },
  createPairSession: async (channelId?: string): Promise<{ code: string; expiresAt: number }> => {
    const res = await fetch(`${API_BASE}/sync/pair/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    });
    if (!res.ok) throw new Error("Impossible de générer le code d'association");
    return res.json();
  },
  checkPairSession: async (code: string): Promise<{ status: 'pending' | 'paired' | 'expired'; data?: any; channelId?: string }> => {
    const res = await fetch(`${API_BASE}/sync/pair/check/${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error("Code d'association expiré ou introuvable");
    const json = await res.json();
    return json.session;
  },
  authorizePairSession: async (code: string, data: any, channelId?: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/sync/pair/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, data, channelId }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Échec de l'association de l'appareil");
    }
    return json;
  },
  pushSyncChannel: async (channelId: string, data: any, name?: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/sync/channel/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, data, name }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
  pullSyncChannel: async (channelId: string): Promise<{ data: any; updatedAt: string } | null> => {
    try {
      const res = await fetch(`${API_BASE}/sync/channel/pull/${encodeURIComponent(channelId)}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.channel || null;
    } catch {
      return null;
    }
  },
  checkDebridStatus: async (service: 'realdebrid' | 'torbox', token: string) => {
    const res = await fetch(`${API_BASE}/debrid/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, token }),
    });
    return res.json();
  },
  getProfileStats: async (profileId: string): Promise<ProfileStats | null> => {
    try {
      const res = await fetch(`${API_BASE}/profiles/${encodeURIComponent(profileId)}/stats`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.stats || null;
    } catch {
      return null;
    }
  },
  getProxiedStreamUrl: (originalUrl: string, options?: { download?: boolean; filename?: string }): string => {
    if (!originalUrl || originalUrl.startsWith('magnet:')) return originalUrl;
    let url = `${API_BASE}/proxy/stream?url=${encodeURIComponent(originalUrl)}`;
    if (options?.download) {
      url += '&download=1';
      if (options.filename) {
        url += `&filename=${encodeURIComponent(options.filename)}`;
      }
    }
    return withAccessKey(url);
  },
  getTorrentStreamUrl: (magnetOrHash: string, fileIndex?: number): string => {
    let url = `${API_BASE}/torrent/stream?magnet=${encodeURIComponent(magnetOrHash)}`;
    if (fileIndex !== undefined) {
      url += `&fileIndex=${fileIndex}`;
    }
    return withAccessKey(url);
  },
  getTorrentStats: async (magnetOrHash: string): Promise<any> => {
    try {
      let target = magnetOrHash;
      if (target.includes('/api/torrent/stream')) {
        try {
          const u = new URL(target, 'http://localhost');
          target = u.searchParams.get('magnet') || target;
        } catch {
          // ignore
        }
      }
      const res = await fetch(`${API_BASE}/torrent/stats?magnet=${encodeURIComponent(target)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data : null;
    } catch {
      return null;
    }
  },
  resolvePlayableUrl: (rawUrl: string, useProxy = false, useTranscode = false, startTime = 0): string => {
    if (!rawUrl) return '';
    if (useTranscode) {
      return api.getTranscodedStreamUrl(rawUrl, { startTime, mode: 'audio' });
    }
    if (rawUrl.startsWith('magnet:') || /^[a-fA-F0-9]{40}$/.test(rawUrl.trim())) {
      return api.getTorrentStreamUrl(rawUrl);
    }
    if (useProxy) {
      return api.getProxiedStreamUrl(rawUrl);
    }
    return rawUrl;
  },
  getTranscodeCapabilities: async (): Promise<{ available: boolean }> => {
    try {
      const res = await fetch(`${API_BASE}/transcode/capabilities`);
      if (!res.ok) return { available: false };
      return res.json();
    } catch {
      return { available: false };
    }
  },
  /** Durée (secondes) du média via ffprobe côté serveur ; null si inconnue. */
  probeDuration: async (rawUrl: string): Promise<number | null> => {
    try {
      const res = await fetch(`${API_BASE}/transcode/probe?url=${encodeURIComponent(rawUrl)}`);
      if (!res.ok) return null;
      const data = await res.json();
      const d = Number(data?.probe?.duration);
      return Number.isFinite(d) && d > 0 ? d : null;
    } catch {
      return null;
    }
  },
  getTranscodedStreamUrl: (rawUrl: string, options?: { startTime?: number; mode?: 'audio' | 'full' }): string => {
    let url = `${API_BASE}/transcode/stream?url=${encodeURIComponent(rawUrl)}`;
    if (options?.startTime && options.startTime > 0) {
      url += `&startTime=${options.startTime}`;
    }
    if (options?.mode) {
      url += `&mode=${options.mode}`;
    }
    return withAccessKey(url);
  },
  getProxiedSubtitleUrl: (originalUrl: string): string => {
    if (!originalUrl) return originalUrl;
    if (originalUrl.startsWith('blob:') || originalUrl.startsWith('data:')) return originalUrl;
    return withAccessKey(`${API_BASE}/proxy/subtitle?url=${encodeURIComponent(originalUrl)}`);
  },
  getSkipTimes: async (
    id: string,
    season?: number,
    episode?: number
  ): Promise<{ found: boolean; intro?: { start: number; end: number }; outro?: { start: number; end: number } }> => {
    try {
      const q = new URLSearchParams();
      if (season) q.set('season', String(season));
      if (episode) q.set('episode', String(episode));
      const res = await fetch(`${API_BASE}/skip-times/series/${encodeURIComponent(id)}?${q.toString()}`);
      if (!res.ok) return { found: false };
      return res.json();
    } catch {
      return { found: false };
    }
  },
  sendRemoteCommand: async (code: string, action: string, payload?: any): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/sync/remote/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
  subscribePairEvents: (
    code: string,
    onPaired: (data: any) => void,
    onRemote?: (cmd: any) => void
  ): (() => void) => {
    if (typeof EventSource === 'undefined') return () => {};
    const es = new EventSource(`${API_BASE}/sync/pair/events/${encodeURIComponent(code)}`);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'paired' && payload.data) {
          onPaired(payload.data);
        } else if (payload.type === 'remote' && onRemote) {
          onRemote(payload.command || payload);
        }
      } catch {
        // Ignorer message ping ou non-JSON
      }
    };

    return () => {
      es.close();
    };
  },
  announceLanDevice: async (device: {
    deviceId: string;
    name: string;
    deviceType: 'tv' | 'mobile' | 'desktop';
    activeProfileName?: string;
    pairCode?: string;
  }): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/sync/lan/announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(device),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
  getLanDevices: async (excludeDeviceId?: string): Promise<LanDevice[]> => {
    try {
      const query = excludeDeviceId ? `?exclude=${encodeURIComponent(excludeDeviceId)}` : '';
      const res = await fetch(`${API_BASE}/sync/lan/devices${query}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.devices || [];
    } catch {
      return [];
    }
  },
  getBookmarks: async (profileId: string, mediaId: string): Promise<BookmarkItem[]> => {
    try {
      const res = await fetch(`${API_BASE}/bookmarks/${encodeURIComponent(profileId)}/${encodeURIComponent(mediaId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch {
      return [];
    }
  },
  addBookmark: async (profileId: string, mediaId: string, time: number, title?: string): Promise<BookmarkItem | null> => {
    try {
      const res = await fetch(`${API_BASE}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, mediaId, time, title }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.bookmark || null;
    } catch {
      return null;
    }
  },
  deleteBookmark: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/bookmarks/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  },

  // --- Gestion de Compte & Synchronisation ---
  account: {
    getToken(): string | null {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(ACCOUNT_TOKEN_STORAGE);
    },
    setToken(token: string | null) {
      if (typeof localStorage === 'undefined') return;
      if (token) {
        localStorage.setItem(ACCOUNT_TOKEN_STORAGE, token);
      } else {
        localStorage.removeItem(ACCOUNT_TOKEN_STORAGE);
      }
      window.dispatchEvent(new CustomEvent('stremo-account-changed'));
    },
    async register(username: string, password: string, email?: string, deviceName?: string) {
      const res = await fetch(`${API_BASE}/accounts/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, deviceName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur lors de l\'inscription');
      if (typeof localStorage !== 'undefined') localStorage.setItem(ACCOUNT_TOKEN_STORAGE, data.token);
      window.dispatchEvent(new CustomEvent('stremo-account-changed'));
      return data;
    },
    async login(username: string, password: string, deviceName?: string) {
      const res = await fetch(`${API_BASE}/accounts/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Nom d\'utilisateur ou mot de passe incorrect');
      if (typeof localStorage !== 'undefined') localStorage.setItem(ACCOUNT_TOKEN_STORAGE, data.token);
      window.dispatchEvent(new CustomEvent('stremo-account-changed'));
      return data;
    },
    async getMe(): Promise<{ account: Account; sessions: AccountSession[]; profiles: Profile[] } | null> {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCOUNT_TOKEN_STORAGE) : null;
      if (!token) return null;
      try {
        const res = await fetch(`${API_BASE}/accounts/me`);
        if (!res.ok) {
          if (res.status === 401 && typeof localStorage !== 'undefined') {
            localStorage.removeItem(ACCOUNT_TOKEN_STORAGE);
            window.dispatchEvent(new CustomEvent('stremo-account-changed'));
          }
          return null;
        }
        const data = await res.json();
        return data.success ? data : null;
      } catch {
        return null;
      }
    },
    async logout() {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCOUNT_TOKEN_STORAGE) : null;
      if (token) {
        try {
          await fetch(`${API_BASE}/accounts/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
        } catch (_) {}
      }
      if (typeof localStorage !== 'undefined') localStorage.removeItem(ACCOUNT_TOKEN_STORAGE);
      window.dispatchEvent(new CustomEvent('stremo-account-changed'));
    },
    async claimLocalData() {
      const res = await fetch(`${API_BASE}/accounts/claim`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur lors de la réclamation');
      return data;
    },
    async sync(payload: any) {
      const res = await fetch(`${API_BASE}/accounts/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
  },
};

export interface BookmarkItem {
  id: string;
  profileId: string;
  mediaId: string;
  time: number;
  title?: string;
  createdAt: string;
}

export interface LanDevice {
  deviceId: string;
  name: string;
  deviceType: 'tv' | 'mobile' | 'desktop';
  ipAddress?: string;
  userAgent?: string;
  activeProfileName?: string;
  pairCode?: string;
  lastSeen: number;
}

export interface TraktAuthInfo {
  profileId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  username?: string;
  updatedAt?: string;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  profiles: Profile[];
  addons: AddonInfo[];
  library: LibraryItem[];
  progress: WatchProgress[];
  traktAuth?: TraktAuthInfo[];
}
