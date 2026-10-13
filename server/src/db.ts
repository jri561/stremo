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
}
