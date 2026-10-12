import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  isKids: number;
  pin?: string;
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
    `);

    // Add default profiles if none exist
    const countProfiles = this.db.prepare('SELECT count(*) as count FROM profiles').get() as { count: number };
    if (countProfiles.count === 0) {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO profiles (id, name, avatar, isKids, createdAt)
        VALUES 
          ('p1', 'Principal', 'user', 0, ?),
          ('p2', 'Secondaire', 'film', 0, ?),
          ('p3', 'Enfants', 'sparkles', 1, ?)
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

  createProfile(name: string, avatar: string, isKids: number | boolean = 0, pin?: string): Profile {
    const id = 'p_' + Date.now();
    const createdAt = new Date().toISOString();
    const isKidsNum = isKids ? 1 : 0;
    this.db.prepare(`
      INSERT INTO profiles (id, name, avatar, isKids, pin, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, avatar, isKidsNum, pin || null, createdAt);
    return { id, name, avatar, isKids: isKidsNum, pin, createdAt };
  }

  updateProfile(id: string, updates: { name?: string; avatar?: string; isKids?: number; pin?: string | null }): Profile | undefined {
    const existing = this.getProfile(id);
    if (!existing) return undefined;

    const name = updates.name !== undefined ? updates.name : existing.name;
    const avatar = updates.avatar !== undefined ? updates.avatar : existing.avatar;
    const isKids = updates.isKids !== undefined ? (updates.isKids ? 1 : 0) : existing.isKids;
    const pin = updates.pin !== undefined ? updates.pin : existing.pin;

    this.db.prepare(`
      UPDATE profiles
      SET name = ?, avatar = ?, isKids = ?, pin = ?
      WHERE id = ?
    `).run(name, avatar, isKids, pin || null, id);

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
}
