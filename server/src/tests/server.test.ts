import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseManager } from '../db.js';
import { AddonClient } from '../addonClient.js';

test('DatabaseManager profiles and progress isolation', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);

  // 1. Check default profiles
  const profiles = db.getProfiles();
  assert.strictEqual(profiles.length, 3);
  assert.strictEqual(profiles[0].name, 'Principal');

  // 2. Multi-profile isolation test
  const p1 = profiles[0].id;
  const p2 = profiles[1].id;

  db.saveWatchProgress({
    profileId: p1,
    mediaId: 'tt0111161',
    mediaType: 'movie',
    title: 'The Shawshank Redemption',
    currentTime: 1200,
    duration: 8520,
    completed: 0,
  });

  const p1Progress = db.getWatchProgressList(p1);
  const p2Progress = db.getWatchProgressList(p2);

  assert.strictEqual(p1Progress.length, 1);
  assert.strictEqual(p1Progress[0].currentTime, 1200);
  // Profile 2 must have NO history of what Profile 1 watched!
  assert.strictEqual(p2Progress.length, 0);

  // 2b. Progress deletion test
  db.deleteWatchProgress(p1, 'tt0111161');
  assert.strictEqual(db.getWatchProgressList(p1).length, 0);

  // 3. Library isolation test
  db.addToLibrary(p1, 'tt0111161', 'movie', 'The Shawshank Redemption');
  assert.strictEqual(db.isInLibrary(p1, 'tt0111161'), true);
  assert.strictEqual(db.isInLibrary(p2, 'tt0111161'), false);

  // 4. Profile update test
  const updatedP2 = db.updateProfile(p2, { name: 'Salon VIP', avatar: 'sparkles', isKids: 1, pin: '1234' });
  assert.strictEqual(updatedP2?.name, 'Salon VIP');
  assert.strictEqual(updatedP2?.avatar, 'sparkles');
  assert.strictEqual(updatedP2?.isKids, 1);
  assert.strictEqual(updatedP2?.pin, '1234');

  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test('AddonClient Cinemeta catalog retrieval', async () => {
  const client = new AddonClient('https://v3-cinemeta.strem.io/manifest.json');
  const manifest = await client.getManifest();
  assert.strictEqual(manifest.id, 'com.linvo.cinemeta');
  assert.ok(manifest.catalogs.length > 0);

  const movies = await client.getCatalog('movie', 'top');
  assert.ok(movies.length > 0);
  assert.ok(movies[0].name.length > 0);
});

test('DatabaseManager Trakt.tv token storage and lifecycle', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test-trakt.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);
  const profiles = db.getProfiles();
  const profileId = profiles[0].id;

  // Initially, no Trakt auth
  assert.strictEqual(db.getTraktAuth(profileId), null);

  // Save Trakt token
  const auth = db.saveTraktAuth(profileId, 'secret_trakt_token_123', 'refresh_token_abc', 1791800000, 'cinephile');
  assert.strictEqual(auth.profileId, profileId);
  assert.strictEqual(auth.accessToken, 'secret_trakt_token_123');
  assert.strictEqual(auth.username, 'cinephile');

  // Retrieve Trakt auth
  const fetched = db.getTraktAuth(profileId);
  assert.notStrictEqual(fetched, null);
  assert.strictEqual(fetched?.accessToken, 'secret_trakt_token_123');
  assert.strictEqual(fetched?.username, 'cinephile');

  // Disconnect Trakt
  db.removeTraktAuth(profileId);
  assert.strictEqual(db.getTraktAuth(profileId), null);

  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test('DatabaseManager Backup export and import (merge and overwrite)', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test-backup.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);
  const profiles = db.getProfiles();
  const p1 = profiles[0].id;

  // Add some data
  db.addToLibrary(p1, 'tt0068646', 'movie', 'The Godfather');
  db.saveWatchProgress({
    profileId: p1,
    mediaId: 'tt0068646',
    mediaType: 'movie',
    title: 'The Godfather',
    currentTime: 3600,
    duration: 10500,
    completed: 0,
  });

  // Export data
  const backup = db.exportData();
  assert.strictEqual(backup.version, 1);
  assert.ok(backup.profiles.length >= 3);
  assert.strictEqual(backup.library.length, 1);
  assert.strictEqual(backup.library[0].title, 'The Godfather');
  assert.strictEqual(backup.progress.length, 1);
  assert.strictEqual(backup.progress[0].currentTime, 3600);

  // Test import in another database
  const targetDbPath = path.join(process.cwd(), 'data', 'test-target.db');
  if (fs.existsSync(targetDbPath)) fs.unlinkSync(targetDbPath);

  const targetDb = new DatabaseManager(targetDbPath);
  // Import with overwrite = false (merge)
  const result = targetDb.importData(backup, false);
  assert.strictEqual(result.success, true);
  assert.ok(targetDb.isInLibrary(p1, 'tt0068646'));
  assert.strictEqual(targetDb.getWatchProgressList(p1).length, 1);

  // Clean up
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(targetDbPath)) fs.unlinkSync(targetDbPath);
});

test('DatabaseManager Device Pairing (6-digit code) and Sync Channel', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test-pairing.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);

  // 1. Generate 6-digit pair session
  const session = db.createPairSession('FAMILY-KEY-42');
  assert.strictEqual(typeof session.code, 'string');
  assert.strictEqual(session.code.length, 6);
  assert.ok(session.expiresAt > Date.now());

  // 2. Initial state is pending
  const checkInitial = db.getPairSession(session.code);
  assert.notStrictEqual(checkInitial, null);
  assert.strictEqual(checkInitial?.status, 'pending');
  assert.strictEqual(checkInitial?.data, undefined);

  // 3. Authorize pairing from another device
  const dummyPayload = {
    profiles: [{ id: 'p1', name: 'Papa' }],
    addons: [{ id: 'cinemeta', name: 'Cinemeta' }],
  };
  const success = db.authorizePairSession(session.code, dummyPayload, 'FAMILY-KEY-42');
  assert.strictEqual(success, true);

  // 4. Verifying paired state and payload delivery
  const checkPaired = db.getPairSession(session.code);
  assert.strictEqual(checkPaired?.status, 'paired');
  assert.deepStrictEqual(checkPaired?.data, dummyPayload);

  // 5. Verifying persistent sync channel
  const channel = db.getSyncChannel('FAMILY-KEY-42');
  assert.notStrictEqual(channel, null);
  assert.deepStrictEqual(channel?.data, dummyPayload);

  // Clean up
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test('DatabaseManager getProfileStats calculates viewing statistics correctly', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_stats.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);
  const profiles = db.getProfiles();
  const pId = profiles[0].id;

  // Initial stats
  const initialStats = db.getProfileStats(pId);
  assert.strictEqual(initialStats.totalWatchTimeSeconds, 0);
  assert.strictEqual(initialStats.moviesWatchedCount, 0);
  assert.strictEqual(initialStats.episodesWatchedCount, 0);

  // Add 1 completed movie (7200s = 2h)
  db.saveWatchProgress({
    profileId: pId,
    mediaId: 'tt_movie_1',
    mediaType: 'movie',
    title: 'Inception',
    currentTime: 7200,
    duration: 7200,
    completed: 1,
  });

  // Add 2 episodes of Breaking Bad
  db.saveWatchProgress({
    profileId: pId,
    mediaId: 'tt_bb:1:1',
    mediaType: 'series',
    title: 'Breaking Bad - S01E01',
    currentTime: 3000,
    duration: 3000,
    completed: 1,
  });

  db.saveWatchProgress({
    profileId: pId,
    mediaId: 'tt_bb:1:2',
    mediaType: 'series',
    title: 'Breaking Bad - S01E02',
    currentTime: 2800,
    duration: 3000,
    completed: 1,
  });

  // Add genres to library
  db.addToLibrary(pId, 'tt_movie_1', 'movie', 'Inception', undefined, '2010', ['Science-Fiction', 'Action']);

  const stats = db.getProfileStats(pId);
  assert.strictEqual(stats.moviesWatchedCount, 1);
  assert.strictEqual(stats.episodesWatchedCount, 2);
  assert.strictEqual(stats.totalItemsCount, 3);
  assert.strictEqual(stats.totalWatchTimeSeconds, 13200); // 7200 + 3000 + 3000 = 13200s (3h 40m)
  assert.ok(stats.totalWatchTimeFormatted.includes('3h'));
  assert.strictEqual(stats.favoriteSeries?.title, 'Breaking Bad');
  assert.strictEqual(stats.favoriteSeries?.episodesWatched, 2);
  assert.strictEqual(stats.topGenres.length, 2);
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test('DatabaseManager getProfileNextUp computes next up episodes queue correctly', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_nextup.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);
  const profiles = db.getProfiles();
  const pId = profiles[0].id;

  // 1. Initial Next Up is empty
  assert.deepStrictEqual(db.getProfileNextUp(pId), []);

  // 2. Add movie progress - should NOT appear in Next Up
  db.saveWatchProgress({
    profileId: pId,
    mediaId: 'tt_movie_dune',
    mediaType: 'movie',
    title: 'Dune: Deuxième Partie',
    currentTime: 3600,
    duration: 9000,
    completed: 0,
  });
  assert.strictEqual(db.getProfileNextUp(pId).length, 0);

  // 3. Add completed episode of series (Arcane S1E3 completed)
  db.saveWatchProgress({
    profileId: pId,
    mediaId: 'tt_arcane:1:3',
    mediaType: 'series',
    title: 'Arcane - S01E03',
    season: 1,
    episode: 3,
    currentTime: 2400,
    duration: 2400,
    completed: 1,
  });

  // 4. Add in-progress episode of another series (Severance S1E1 at 50%)
  db.saveWatchProgress({
    profileId: pId,
    mediaId: 'tt_severance:1:1',
    mediaType: 'series',
    title: 'Severance • S1 E1',
    season: 1,
    episode: 1,
    currentTime: 1500,
    duration: 3000,
    completed: 0,
  });

  const nextUp = db.getProfileNextUp(pId);
  assert.strictEqual(nextUp.length, 2);

  // Severance should be first because it was updated most recently
  const severance = nextUp.find((n) => n.seriesId === 'tt_severance');
  assert.ok(severance);
  assert.strictEqual(severance?.seriesTitle, 'Severance');
  assert.strictEqual(severance?.isNextEpisode, false);
  assert.strictEqual(severance?.season, 1);
  assert.strictEqual(severance?.episode, 1);
  assert.strictEqual(severance?.progressPercent, 50);

  // Arcane should suggest Season 1 Episode 4!
  const arcane = nextUp.find((n) => n.seriesId === 'tt_arcane');
  assert.ok(arcane);
  assert.strictEqual(arcane?.seriesTitle, 'Arcane');
  assert.strictEqual(arcane?.isNextEpisode, true);
  assert.strictEqual(arcane?.id, 'tt_arcane:1:4');
  assert.strictEqual(arcane?.season, 1);
  assert.strictEqual(arcane?.episode, 4);
  assert.strictEqual(arcane?.progressPercent, 0);

  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test('DatabaseManager cache store and TTL eviction', async () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test-cache.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);

  // 1. Initial get should return null
  assert.strictEqual(db.getCache('missing_key'), null);

  // 2. Set cache with TTL 3600 seconds
  const sampleData = { title: 'Dune: Part Two', score: 8.8, genres: ['Sci-Fi', 'Adventure'] };
  db.setCache('movie:tt15239678', sampleData, 3600);

  const cached = db.getCache<typeof sampleData>('movie:tt15239678');
  assert.deepStrictEqual(cached, sampleData);

  // 3. Delete cache
  db.deleteCache('movie:tt15239678');
  assert.strictEqual(db.getCache('movie:tt15239678'), null);

  // 4. Expiry / TTL test with negative or zero TTL
  db.setCache('short_lived', { temp: true }, -1); // already expired
  assert.strictEqual(db.getCache('short_lived'), null);

  // 5. Purge expired entries
  db.setCache('expired_1', { a: 1 }, -10);
  db.setCache('expired_2', { b: 2 }, -5);
  db.setCache('valid_1', { c: 3 }, 300);

  const purgedCount = db.purgeExpiredCache();
  assert.strictEqual(purgedCount >= 2, true);
  assert.deepStrictEqual(db.getCache('valid_1'), { c: 3 });

  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});
