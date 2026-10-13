import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  isKids: number;
  pin?: string;
  preferredAudioLanguage?: string;
  preferredSubtitleLanguage?: string;
  subtitleMode?: string;
  createdAt: string;
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

export interface WatchProgress {
  profileId: string;
  mediaId: string; // e.g. tt1234567 or tt1234567:1:1
  mediaType: string; // movie, series
  title: string;
  poster?: string;
  season?: number;
  episode?: number;
  currentTime: number; // in seconds
  duration: number; // in seconds
  completed: number; // 0 or 1
  updatedAt: string;
}

export interface NextUpItem {
  id: string; // Target mediaId (e.g. tt0944947:1:2)
  seriesId: string; // Parent series ID (e.g. tt0944947)
  seriesTitle: string; // Nom propre de la série
  title: string; // Titre affiché, ex: "Arcane • S1 E2"
  type: 'series';
  poster?: string;
  season: number;
  episode: number;
  isNextEpisode: boolean; // true si c'est l'épisode suivant, false si reprise en cours
  currentTime: number;
  duration: number;
  progressPercent: number;
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
  genres?: string; // JSON string array
  createdAt: string;
}

export interface AddonConfig {
  id: string;
  name: string;
  url: string;
  enabled: number;
  orderIndex: number;
}

export interface TraktAuth {
  profileId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  username?: string;
  updatedAt: string;
}

export interface PairSession {
  code: string;
  status: 'pending' | 'paired' | 'expired';
  data?: any;
  channelId?: string;
  expiresAt: number;
  createdAt: string;
}

export interface SyncChannel {
  channelId: string;
  name?: string;
  data: any;
  updatedAt: string;
}

export class DatabaseManager {
  private db: DatabaseSync;

  constructor(dbPath: string = path.join(process.cwd(), 'data', 'stremo.db')) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT NOT NULL,
        isKids INTEGER DEFAULT 0,
        pin TEXT,
        preferredAudioLanguage TEXT DEFAULT 'fra',
        preferredSubtitleLanguage TEXT DEFAULT 'fra',
        subtitleMode TEXT DEFAULT 'foreign_only',
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS watch_progress (
        profileId TEXT NOT NULL,
        mediaId TEXT NOT NULL,
        mediaType TEXT NOT NULL,
        title TEXT NOT NULL,
        poster TEXT,
        season INTEGER,
        episode INTEGER,
        currentTime REAL NOT NULL DEFAULT 0,
        duration REAL NOT NULL DEFAULT 0,
        completed INTEGER DEFAULT 0,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (profileId, mediaId)
      );

      CREATE TABLE IF NOT EXISTS library (
        id TEXT PRIMARY KEY,
        profileId TEXT NOT NULL,
        mediaId TEXT NOT NULL,
        mediaType TEXT NOT NULL,
        title TEXT NOT NULL,
        poster TEXT,
        year TEXT,
        genres TEXT,
        createdAt TEXT NOT NULL,
        UNIQUE (profileId, mediaId)
      );

      CREATE TABLE IF NOT EXISTS addons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 1,
        orderIndex INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS trakt_auth (
        profileId TEXT PRIMARY KEY,
        accessToken TEXT NOT NULL,
        refreshToken TEXT,
        expiresAt INTEGER,
        username TEXT,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pair_sessions (
        code TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        data TEXT,
        channelId TEXT,
        expiresAt INTEGER NOT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_channels (
        channelId TEXT PRIMARY KEY,
        name TEXT,
        data TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cache_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expiresAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_store(expiresAt);
    `);

    // Migrations idempotentes pour bases SQLite existantes
    try { this.db.exec("ALTER TABLE profiles ADD COLUMN preferredAudioLanguage TEXT DEFAULT 'fra'"); } catch (_) {}
    try { this.db.exec("ALTER TABLE profiles ADD COLUMN preferredSubtitleLanguage TEXT DEFAULT 'fra'"); } catch (_) {}
    try { this.db.exec("ALTER TABLE profiles ADD COLUMN subtitleMode TEXT DEFAULT 'foreign_only'"); } catch (_) {}

    // Add default profiles if none exist
    const countProfiles = this.db.prepare('SELECT count(*) as count FROM profiles').get() as { count: number };
    if (countProfiles.count === 0) {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO profiles (id, name, avatar, isKids, preferredAudioLanguage, preferredSubtitleLanguage, subtitleMode, createdAt)
        VALUES 
          ('p1', 'Principal', 'user', 0, 'fra', 'fra', 'foreign_only', ?),
          ('p2', 'Secondaire', 'film', 0, 'fra', 'fra', 'foreign_only', ?),
          ('p3', 'Enfants', 'sparkles', 1, 'fra', 'fra', 'foreign_only', ?)
      `).run(now, now, now);
    }

    // Add default addons if none exist
    const countAddons = this.db.prepare('SELECT count(*) as count FROM addons').get() as { count: number };
    if (countAddons.count === 0) {
      this.db.prepare(`
        INSERT INTO addons (id, name, url, enabled, orderIndex)
        VALUES 
          ('cinemeta', 'Cinemeta Official', 'https://v3-cinemeta.strem.io/manifest.json', 1, 0),
          ('opensubtitlesv3', 'OpenSubtitles v3', 'https://opensubtitles-v3.strem.io/manifest.json', 1, 1)
      `).run();
    }
  }

  // --- Profiles ---
  getProfiles(): Profile[] {
    return this.db.prepare('SELECT * FROM profiles ORDER BY createdAt ASC').all() as unknown as Profile[];
  }

  getProfile(id: string): Profile | undefined {
    return this.db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as unknown as Profile | undefined;
  }

  createProfile(
    name: string,
    avatar: string,
    isKids: number | boolean = 0,
    pin?: string,
    preferredAudioLanguage: string = 'fra',
    preferredSubtitleLanguage: string = 'fra',
    subtitleMode: string = 'foreign_only'
  ): Profile {
    const id = 'p_' + Date.now();
    const createdAt = new Date().toISOString();
    const isKidsNum = isKids ? 1 : 0;
    this.db.prepare(`
      INSERT INTO profiles (id, name, avatar, isKids, pin, preferredAudioLanguage, preferredSubtitleLanguage, subtitleMode, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, avatar, isKidsNum, pin || null, preferredAudioLanguage, preferredSubtitleLanguage, subtitleMode, createdAt);
    return { id, name, avatar, isKids: isKidsNum, pin, preferredAudioLanguage, preferredSubtitleLanguage, subtitleMode, createdAt };
  }

  updateProfile(
    id: string,
    updates: {
      name?: string;
      avatar?: string;
      isKids?: number;
      pin?: string | null;
      preferredAudioLanguage?: string;
      preferredSubtitleLanguage?: string;
      subtitleMode?: string;
    }
  ): Profile | undefined {
    const existing = this.getProfile(id);
    if (!existing) return undefined;

    const name = updates.name !== undefined ? updates.name : existing.name;
    const avatar = updates.avatar !== undefined ? updates.avatar : existing.avatar;
    const isKids = updates.isKids !== undefined ? (updates.isKids ? 1 : 0) : existing.isKids;
    const pin = updates.pin !== undefined ? updates.pin : existing.pin;
    const preferredAudioLanguage = updates.preferredAudioLanguage !== undefined ? updates.preferredAudioLanguage : (existing.preferredAudioLanguage || 'fra');
    const preferredSubtitleLanguage = updates.preferredSubtitleLanguage !== undefined ? updates.preferredSubtitleLanguage : (existing.preferredSubtitleLanguage || 'fra');
    const subtitleMode = updates.subtitleMode !== undefined ? updates.subtitleMode : (existing.subtitleMode || 'foreign_only');

    this.db.prepare(`
      UPDATE profiles
      SET name = ?, avatar = ?, isKids = ?, pin = ?, preferredAudioLanguage = ?, preferredSubtitleLanguage = ?, subtitleMode = ?
      WHERE id = ?
    `).run(name, avatar, isKids, pin || null, preferredAudioLanguage, preferredSubtitleLanguage, subtitleMode, id);

    return this.getProfile(id);
  }

  deleteProfile(id: string) {
    this.db.prepare('DELETE FROM watch_progress WHERE profileId = ?').run(id);
    this.db.prepare('DELETE FROM library WHERE profileId = ?').run(id);
    this.db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
  }

  // --- Watch Progress / History ---
  getWatchProgressList(profileId: string): WatchProgress[] {
    return this.db.prepare(`
      SELECT * FROM watch_progress 
      WHERE profileId = ? 
      ORDER BY updatedAt DESC
    `).all(profileId) as unknown as WatchProgress[];
  }

  getMediaProgress(profileId: string, mediaId: string): WatchProgress | undefined {
    return this.db.prepare(`
      SELECT * FROM watch_progress 
      WHERE profileId = ? AND mediaId = ?
    `).get(profileId, mediaId) as unknown as WatchProgress | undefined;
  }

  saveWatchProgress(item: Omit<WatchProgress, 'updatedAt'>) {
    const updatedAt = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO watch_progress (
        profileId, mediaId, mediaType, title, poster, season, episode, currentTime, duration, completed, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(profileId, mediaId) DO UPDATE SET
        currentTime = excluded.currentTime,
        duration = excluded.duration,
        completed = excluded.completed,
        season = excluded.season,
        episode = excluded.episode,
        updatedAt = excluded.updatedAt
    `).run(
      item.profileId,
      item.mediaId,
      item.mediaType,
      item.title,
      item.poster || null,
      item.season ?? null,
      item.episode ?? null,
      item.currentTime,
      item.duration,
      item.completed,
      updatedAt
    );
  }

  deleteWatchProgress(profileId: string, mediaId: string) {
    this.db.prepare('DELETE FROM watch_progress WHERE profileId = ? AND mediaId = ?').run(profileId, mediaId);
  }

  // --- Rail intelligent "À Suivre" (Next Up Queue) ---
  getProfileNextUp(profileId: string): NextUpItem[] {
    const progressItems = this.getWatchProgressList(profileId).filter(
      (p) => p.mediaType === 'series'
    );

    // Regrouper par seriesId pour ne garder que la progression la plus récente par série
    const seriesGroups = new Map<string, WatchProgress>();

    for (const p of progressItems) {
      const seriesId = p.mediaId.includes(':') ? p.mediaId.split(':')[0] : p.mediaId;
      if (!seriesGroups.has(seriesId)) {
        seriesGroups.set(seriesId, p);
      }
    }

    const nextUpList: NextUpItem[] = [];

    for (const [seriesId, p] of seriesGroups.entries()) {
      let season = p.season;
      let episode = p.episode;

      if ((season == null || episode == null) && p.mediaId.includes(':')) {
        const parts = p.mediaId.split(':');
        if (parts.length >= 3) {
          season = parseInt(parts[1], 10) || 1;
          episode = parseInt(parts[2], 10) || 1;
        }
      }

      const currentSeason = season ?? 1;
      const currentEpisode = episode ?? 1;

      // Nettoyer le titre pour obtenir le nom de la série seule
      const cleanSeriesTitle = p.title
        .replace(/\s*[-•]?\s*s\d+\s*e\d+.*$/i, '')
        .replace(/\s*[-•]\s*Épisode\s*\d+.*$/i, '')
        .trim() || p.title;

      const isCompleted = p.completed === 1 || (p.duration > 0 && (p.currentTime / p.duration) >= 0.85);

      if (isCompleted) {
        // L'épisode précédent est terminé : suggérer l'épisode N+1
        const nextSeason = currentSeason;
        const nextEp = currentEpisode + 1;
        const targetId = `${seriesId}:${nextSeason}:${nextEp}`;

        nextUpList.push({
          id: targetId,
          seriesId,
          seriesTitle: cleanSeriesTitle,
          title: `${cleanSeriesTitle} • S${nextSeason}E${nextEp}`,
          type: 'series',
          poster: p.poster,
          season: nextSeason,
          episode: nextEp,
          isNextEpisode: true,
          currentTime: 0,
          duration: 0,
          progressPercent: 0,
          updatedAt: p.updatedAt,
        });
      } else if (p.currentTime > 10) {
        // En cours de visionnage : reprendre l'épisode actuel
        const progressPercent = p.duration > 0 ? (p.currentTime / p.duration) * 100 : 0;
        nextUpList.push({
          id: p.mediaId,
          seriesId,
          seriesTitle: cleanSeriesTitle,
          title: `${cleanSeriesTitle} • S${currentSeason}E${currentEpisode}`,
          type: 'series',
          poster: p.poster,
          season: currentSeason,
          episode: currentEpisode,
          isNextEpisode: false,
          currentTime: p.currentTime,
          duration: p.duration,
          progressPercent,
          updatedAt: p.updatedAt,
        });
      }
    }

    return nextUpList;
  }

  getProfileStats(profileId: string): ProfileStats {
    const progressItems = this.getWatchProgressList(profileId);
    const libraryItems = this.getLibrary(profileId);

    let totalWatchSeconds = 0;
    let moviesCount = 0;
    let episodesCount = 0;
    const seriesWatchMap: Record<string, { title: string; count: number }> = {};

    for (const p of progressItems) {
      const watched = p.completed === 1 && p.duration > 0 ? p.duration : p.currentTime;
      totalWatchSeconds += Math.max(0, watched);

      const isFinished = p.completed === 1 || (p.duration > 0 && p.currentTime / p.duration >= 0.8);
      if (p.mediaType === 'movie') {
        if (isFinished) moviesCount++;
      } else if (p.mediaType === 'series') {
        if (isFinished) episodesCount++;
        const seriesKey = p.title.replace(/\s*-\s*s\d+e\d+/i, '').replace(/\s*s\d+e\d+/i, '').trim();
        if (!seriesWatchMap[seriesKey]) {
          seriesWatchMap[seriesKey] = { title: seriesKey, count: 0 };
        }
        seriesWatchMap[seriesKey].count++;
      }
    }

    // Top Binge Series
    let topSeries: { title: string; episodesWatched: number } | undefined = undefined;
    for (const s of Object.values(seriesWatchMap)) {
      if (!topSeries || s.count > topSeries.episodesWatched) {
        topSeries = { title: s.title, episodesWatched: s.count };
      }
    }

    // Genres counts
    const genreCounts: Record<string, number> = {};
    for (const item of libraryItems) {
      if (item.genres) {
        try {
          const parsed = JSON.parse(item.genres);
          if (Array.isArray(parsed)) {
            for (const g of parsed) {
              genreCounts[g] = (genreCounts[g] || 0) + 1;
            }
          }
        } catch {}
      }
    }

    const topGenres = Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const hours = Math.floor(totalWatchSeconds / 3600);
    const minutes = Math.floor((totalWatchSeconds % 3600) / 60);
    const totalWatchTimeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const totalItems = moviesCount + episodesCount;
    const completionRatePercent = libraryItems.length > 0
      ? Math.min(100, Math.round((moviesCount / Math.max(1, libraryItems.length)) * 100))
      : (totalItems > 0 ? 100 : 0);

    return {
      totalWatchTimeSeconds: Math.round(totalWatchSeconds),
      totalWatchTimeFormatted,
      moviesWatchedCount: moviesCount,
      episodesWatchedCount: episodesCount,
      totalItemsCount: totalItems,
      libraryItemsCount: libraryItems.length,
      completionRatePercent,
      topGenres,
      favoriteSeries: topSeries,
    };
  }

  // --- Library / Favorites ---
  getLibrary(profileId: string): LibraryItem[] {
    return this.db.prepare(`
      SELECT * FROM library 
      WHERE profileId = ? 
      ORDER BY createdAt DESC
    `).all(profileId) as unknown as LibraryItem[];
  }

  addToLibrary(profileId: string, mediaId: string, mediaType: string, title: string, poster?: string, year?: string, genres?: string[]) {
    const id = 'lib_' + Date.now();
    const createdAt = new Date().toISOString();
    const genresJson = genres ? JSON.stringify(genres) : null;
    this.db.prepare(`
      INSERT OR IGNORE INTO library (id, profileId, mediaId, mediaType, title, poster, year, genres, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, profileId, mediaId, mediaType, title, poster || null, year || null, genresJson, createdAt);
  }

  removeFromLibrary(profileId: string, mediaId: string) {
    this.db.prepare('DELETE FROM library WHERE profileId = ? AND mediaId = ?').run(profileId, mediaId);
  }

  isInLibrary(profileId: string, mediaId: string): boolean {
    const res = this.db.prepare('SELECT 1 FROM library WHERE profileId = ? AND mediaId = ?').get(profileId, mediaId);
    return !!res;
  }

  // --- Addons ---
  getAddons(): AddonConfig[] {
    return this.db.prepare('SELECT * FROM addons ORDER BY orderIndex ASC').all() as unknown as AddonConfig[];
  }

  addAddon(id: string, name: string, url: string) {
    this.db.prepare(`
      INSERT OR REPLACE INTO addons (id, name, url, enabled, orderIndex)
      VALUES (?, ?, ?, 1, (SELECT coalesce(max(orderIndex) + 1, 0) FROM addons))
    `).run(id, name, url);
  }

  removeAddon(id: string) {
    this.db.prepare('DELETE FROM addons WHERE id = ?').run(id);
  }

  // --- Trakt Authentication ---
  getTraktAuth(profileId: string): TraktAuth | null {
    const row = this.db.prepare('SELECT * FROM trakt_auth WHERE profileId = ?').get(profileId);
    return (row as unknown as TraktAuth) || null;
  }

  saveTraktAuth(profileId: string, accessToken: string, refreshToken?: string, expiresAt?: number, username?: string): TraktAuth {
    const updatedAt = new Date().toISOString();
    this.db.prepare(`
      INSERT OR REPLACE INTO trakt_auth (profileId, accessToken, refreshToken, expiresAt, username, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(profileId, accessToken, refreshToken || null, expiresAt || null, username || null, updatedAt);
    return this.getTraktAuth(profileId)!;
  }

  removeTraktAuth(profileId: string) {
    this.db.prepare('DELETE FROM trakt_auth WHERE profileId = ?').run(profileId);
  }

  // --- Backup & Multi-Device Sync ---
  exportData(): { version: number; exportedAt: string; profiles: Profile[]; addons: AddonConfig[]; library: LibraryItem[]; progress: WatchProgress[] } {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      profiles: this.getProfiles(),
      addons: this.getAddons(),
      library: this.db.prepare('SELECT * FROM library').all() as unknown as LibraryItem[],
      progress: this.db.prepare('SELECT * FROM watch_progress').all() as unknown as WatchProgress[],
    };
  }

  importData(
    data: { profiles?: Profile[]; addons?: AddonConfig[]; library?: LibraryItem[]; progress?: WatchProgress[] },
    overwrite = false
  ): { success: boolean; importedProfiles: number; importedAddons: number; importedLibrary: number; importedProgress: number } {
    if (overwrite) {
      this.db.prepare('DELETE FROM library').run();
      this.db.prepare('DELETE FROM watch_progress').run();
    }

    let importedProfiles = 0;
    let importedAddons = 0;
    let importedLibrary = 0;
    let importedProgress = 0;

    if (Array.isArray(data.profiles)) {
      for (const p of data.profiles) {
        if (!p.id || !p.name) continue;
        const exists = this.getProfile(p.id);
        if (!exists) {
          this.createProfile(p.name, p.avatar || 'user', p.isKids === 1, p.pin);
        } else {
          this.updateProfile(p.id, { name: p.name, avatar: p.avatar, isKids: p.isKids, pin: p.pin });
        }
        importedProfiles++;
      }
    }

    if (Array.isArray(data.addons)) {
      for (const a of data.addons) {
        if (!a.id || !a.url) continue;
        this.addAddon(a.id, a.name, a.url);
        importedAddons++;
      }
    }

    if (Array.isArray(data.library)) {
      for (const l of data.library) {
        if (!l.profileId || !l.mediaId) continue;
        const genres = typeof l.genres === 'string' ? JSON.parse(l.genres || '[]') : l.genres;
        this.addToLibrary(l.profileId, l.mediaId, l.mediaType, l.title, l.poster, l.year, genres);
        importedLibrary++;
      }
    }

    if (Array.isArray(data.progress)) {
      for (const pr of data.progress) {
        if (!pr.profileId || !pr.mediaId) continue;
        this.saveWatchProgress({
          profileId: pr.profileId,
          mediaId: pr.mediaId,
          mediaType: pr.mediaType || 'movie',
          title: pr.title || 'Inconnu',
          poster: pr.poster,
          season: pr.season,
          episode: pr.episode,
          currentTime: pr.currentTime || 0,
          duration: pr.duration || 0,
          completed: pr.completed || 0,
        });
        importedProgress++;
      }
    }

    return { success: true, importedProfiles, importedAddons, importedLibrary, importedProgress };
  }

  // --- Device Pairing & Multi-Device Sync ---
  createPairSession(channelId?: string): { code: string; expiresAt: number } {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes
    const createdAt = new Date().toISOString();

    // Clean up expired sessions
    this.db.prepare('DELETE FROM pair_sessions WHERE expiresAt < ?').run(now);

    this.db.prepare(`
      INSERT OR REPLACE INTO pair_sessions (code, status, data, channelId, expiresAt, createdAt)
      VALUES (?, 'pending', NULL, ?, ?, ?)
    `).run(code, channelId || null, expiresAt, createdAt);

    return { code, expiresAt };
  }

  getPairSession(code: string): PairSession | null {
    const row = this.db.prepare('SELECT * FROM pair_sessions WHERE code = ?').get(code) as any;
    if (!row) return null;

    if (Date.now() > row.expiresAt) {
      return {
        code: row.code,
        status: 'expired',
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      };
    }

    let parsedData: any = undefined;
    if (row.data) {
      try {
        parsedData = JSON.parse(row.data);
      } catch {
        parsedData = undefined;
      }
    }

    return {
      code: row.code,
      status: row.status as any,
      data: parsedData,
      channelId: row.channelId || undefined,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }

  authorizePairSession(code: string, data: any, channelId?: string): boolean {
    const session = this.getPairSession(code);
    if (!session || session.status === 'expired') return false;

    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    this.db.prepare(`
      UPDATE pair_sessions
      SET status = 'paired', data = ?, channelId = ?
      WHERE code = ?
    `).run(dataStr, channelId || null, code);

    // If channelId is present, also update sync channel
    if (channelId) {
      this.saveSyncChannel(channelId, data);
    }

    return true;
  }

  saveSyncChannel(channelId: string, data: any, name?: string): SyncChannel {
    const updatedAt = new Date().toISOString();
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

    this.db.prepare(`
      INSERT OR REPLACE INTO sync_channels (channelId, name, data, updatedAt)
      VALUES (?, ?, ?, ?)
    `).run(channelId, name || null, dataStr, updatedAt);

    return {
      channelId,
      name,
      data,
      updatedAt,
    };
  }

  getSyncChannel(channelId: string): SyncChannel | null {
    const row = this.db.prepare('SELECT * FROM sync_channels WHERE channelId = ?').get(channelId) as any;
    if (!row) return null;

    let parsedData: any = undefined;
    try {
      parsedData = JSON.parse(row.data);
    } catch {
      parsedData = row.data;
    }

    return {
      channelId: row.channelId,
      name: row.name || undefined,
      data: parsedData,
      updatedAt: row.updatedAt,
    };
  }

  // --- Cache Store Haute Performance ---
  getCache<T = any>(key: string): T | null {
    const row = this.db.prepare(`
      SELECT value, expiresAt FROM cache_store WHERE key = ?
    `).get(key) as unknown as { value: string; expiresAt: number } | undefined;

    if (!row) return null;
    if (Date.now() > row.expiresAt) {
      this.deleteCache(key);
      return null;
    }

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  setCache(key: string, value: any, ttlSeconds: number): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    const jsonStr = JSON.stringify(value);
    this.db.prepare(`
      INSERT INTO cache_store (key, value, expiresAt)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        expiresAt = excluded.expiresAt
    `).run(key, jsonStr, expiresAt);
  }

  deleteCache(key: string): void {
    this.db.prepare('DELETE FROM cache_store WHERE key = ?').run(key);
  }

  purgeExpiredCache(): number {
    const now = Date.now();
    const result = this.db.prepare('DELETE FROM cache_store WHERE expiresAt < ?').run(now);
    return Number((result as any)?.changes || 0);
  }
}
