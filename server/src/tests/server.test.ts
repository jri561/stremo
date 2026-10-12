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
