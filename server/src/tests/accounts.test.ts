import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseManager } from '../db.js';

test('DatabaseManager Multi-Accounts: registration, authentication and session tokens', async () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_accounts.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);

  // 1. Validation des paramètres invalides
  await assert.rejects(async () => {
    await db.createAccount('ab', 'secret123'); // Trop court
  }, /au moins 3 caractères/);

  await assert.rejects(async () => {
    await db.createAccount('jean_dupont', '123'); // Trop court
  }, /au moins 6 caractères/);

  // 2. Création réussie d'un compte
  const registered = await db.createAccount('alice', 'superpassword123', 'alice@stremo.app', 'Firefox Linux');
  assert.ok(registered.account.id.startsWith('acc_'));
  assert.strictEqual(registered.account.username, 'alice');
  assert.strictEqual(registered.account.email, 'alice@stremo.app');
  assert.strictEqual(typeof registered.token, 'string');
  assert.strictEqual(registered.token.length, 64);
  assert.ok(registered.expiresAt > Date.now() + 80 * 24 * 3600 * 1000); // Au moins 80 jours restants

  // 3. Unicité du nom d'utilisateur (insensible à la casse)
  await assert.rejects(async () => {
    await db.createAccount('Alice', 'different_password');
  }, /existe déjà/);

  // 4. Vérification d'authentification
  const validByUsername = await db.verifyAccount('alice', 'superpassword123');
  assert.ok(validByUsername);
  assert.strictEqual(validByUsername?.username, 'alice');

  const validByEmail = await db.verifyAccount('alice@stremo.app', 'superpassword123');
  assert.ok(validByEmail);
  assert.strictEqual(validByEmail?.id, registered.account.id);

  const invalidPass = await db.verifyAccount('alice', 'wrong_password');
  assert.strictEqual(invalidPass, null);

  const unknownUser = await db.verifyAccount('bob_inexistant', 'superpassword123');
  assert.strictEqual(unknownUser, null);

  // 5. Validation de la session
  const sessionCheck = db.getAccountSession(registered.token);
  assert.ok(sessionCheck);
  assert.strictEqual(sessionCheck?.account.id, registered.account.id);
  assert.strictEqual(sessionCheck?.session.deviceName, 'Firefox Linux');

  // 6. Création d'une seconde session (ex: Android TV)
  const tvSession = db.createAccountSession(registered.account.id, 'Android TV Salon');
  assert.strictEqual(tvSession.accountId, registered.account.id);
  const activeSessions = db.getAccountSessions(registered.account.id);
  assert.strictEqual(activeSessions.length, 2);

  // 7. Déconnexion (suppression de session)
  const deleted = db.deleteAccountSession(tvSession.token);
  assert.strictEqual(deleted, true);
  assert.strictEqual(db.getAccountSession(tvSession.token), null);
  assert.strictEqual(db.getAccountSessions(registered.account.id).length, 1);
});

test('DatabaseManager Multi-Accounts: data isolation between accounts and local mode', async () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_accounts_iso.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);

  // Mode local invité initial
  const localProfiles = db.getProfiles();
  assert.strictEqual(localProfiles.length, 3);
  const localAddons = db.getAddons();
  assert.strictEqual(localAddons.length, 2);

  // Compte 1 : Thomas
  const acc1 = await db.createAccount('thomas', 'pwdThomas123');
  const acc1Profiles = db.getProfiles(acc1.account.id);
  // Doit avoir son profil initial créé automatiquement
  assert.strictEqual(acc1Profiles.length, 1);
  assert.strictEqual(acc1Profiles[0].name, 'thomas');

  // Création d'un second profil pour Thomas
  const thomasKids = db.createProfile('Thomas Enfants', 'sparkles', 1, undefined, 'fra', 'fra', 'foreign_only', 'pink', acc1.account.id);
  assert.strictEqual(db.getProfiles(acc1.account.id).length, 2);

  // Compte 2 : Marie
  const acc2 = await db.createAccount('marie', 'pwdMarie123');
  const acc2Profiles = db.getProfiles(acc2.account.id);
  assert.strictEqual(acc2Profiles.length, 1);
  assert.strictEqual(acc2Profiles[0].name, 'marie');

  // Isolation stricte des profils
  assert.strictEqual(db.getProfiles(acc1.account.id).length, 2);
  assert.strictEqual(db.getProfiles(acc2.account.id).length, 1);
  assert.strictEqual(db.getProfiles().length, 3); // Le mode invité n'a pas bougé

  // Progression de lecture pour Thomas
  db.saveWatchProgress({
    profileId: acc1Profiles[0].id,
    mediaId: 'tt0944947:1:1',
    mediaType: 'series',
    title: 'Game of Thrones',
    currentTime: 3200,
    duration: 3600,
    completed: 0,
  });

  assert.strictEqual(db.getWatchProgressList(acc1Profiles[0].id).length, 1);
  assert.strictEqual(db.getWatchProgressList(acc2Profiles[0].id).length, 0);

  // Export isolé
  const exportAcc1 = db.exportData(acc1.account.id);
  assert.strictEqual(exportAcc1.profiles.length, 2);
  assert.strictEqual(exportAcc1.progress.length, 1);

  const exportAcc2 = db.exportData(acc2.account.id);
  assert.strictEqual(exportAcc2.profiles.length, 1);
  assert.strictEqual(exportAcc2.progress.length, 0);
});

test('DatabaseManager Multi-Accounts: claiming local guest data into account', async () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_accounts_claim.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);

  // Profils locaux existants (3 par défaut)
  assert.strictEqual(db.getProfiles().length, 3);

  // L'utilisateur décide de se créer un compte
  const account = await db.createAccount('claire', 'motdepasse123');
  // Claire a maintenant 1 profil propre + 3 profils locaux toujours en suspens
  assert.strictEqual(db.getProfiles(account.account.id).length, 1);
  assert.strictEqual(db.getProfiles().length, 3);

  // Réclamation des données locales vers son compte
  const claimed = db.claimLocalData(account.account.id);
  assert.strictEqual(claimed.claimedProfiles, 3);

  // Maintenant, le compte Claire a 4 profils (1 principal + 3 profils locaux adoptés)
  assert.strictEqual(db.getProfiles(account.account.id).length, 4);
  // Et il ne reste aucun profil orphelin local
  assert.strictEqual(db.getProfiles().length, 0);
});

test('DatabaseManager Multi-Accounts: cross-device sync synchronization payload', async () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_accounts_sync.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);
  const user = await db.createAccount('david', 'motdepassedavid');
  const profileId = db.getProfiles(user.account.id)[0].id;

  // Progression initiale sur le serveur
  db.saveWatchProgress({
    profileId,
    mediaId: 'tt1234567',
    mediaType: 'movie',
    title: 'Film A',
    currentTime: 100,
    duration: 1000,
    completed: 0,
  });

  // Client Android synchronise sa progression plus récente (ex: position 500 à t+10min)
  const syncResult = db.syncAccountData(user.account.id, {
    progress: [
      {
        profileId,
        mediaId: 'tt1234567',
        mediaType: 'movie',
        title: 'Film A',
        currentTime: 500,
        duration: 1000,
        completed: 0,
        updatedAt: new Date(Date.now() + 600000).toISOString(),
      },
    ],
    library: [
      {
        id: 'lib_1',
        profileId,
        mediaId: 'tt7654321',
        mediaType: 'movie',
        title: 'Film B',
        genres: '["Action"]',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.ok(syncResult.syncedAt);
  assert.strictEqual(syncResult.progress.length, 1);
  assert.strictEqual(syncResult.progress[0].currentTime, 500);
  assert.strictEqual(syncResult.library.length, 1);
  assert.strictEqual(syncResult.library[0].title, 'Film B');
});
