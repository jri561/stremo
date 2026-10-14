import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../db.js';
import { isPublicHttpUrl } from '../addonClient.js';
import path from 'node:path';
import fs from 'node:fs';

test('Security Audit: protection IDOR stricte sur updateProfile et deleteProfile', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_security_idor.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);

  // 1. Créer un profil appartenant au compte A
  const accountAId = 'acc_user_alpha';
  const profileA = db.createProfile('Profil Secret A', 'avatar1', 0, undefined, 'fra', 'fra', 'foreign_only', 'indigo', accountAId);
  assert.ok(profileA.id);

  // 2. Un appel anonyme (sans compte) NE DOIT PAS pouvoir modifier le profil du compte A
  const hackAnonymous = db.updateProfile(profileA.id, { name: 'Pwned Anonymously' }, undefined);
  assert.strictEqual(hackAnonymous, undefined, 'Un utilisateur anonyme ne doit pas modifier un profil de compte');

  const check1 = db.getProfile(profileA.id);
  assert.strictEqual(check1?.name, 'Profil Secret A');

  // 3. Un utilisateur d'un compte B NE DOIT PAS pouvoir modifier le profil du compte A
  const hackAccountB = db.updateProfile(profileA.id, { name: 'Pwned by B' }, 'acc_user_beta');
  assert.strictEqual(hackAccountB, undefined, 'Un compte tiers ne doit pas modifier le profil');

  // 4. Seul le propriétaire légitime (compte A) peut modifier son profil
  const legitUpdate = db.updateProfile(profileA.id, { name: 'Profil A Renommé' }, accountAId);
  assert.ok(legitUpdate);
  assert.strictEqual(legitUpdate.name, 'Profil A Renommé');

  // 5. Un appel anonyme ou d'un compte B NE DOIT PAS pouvoir supprimer le profil du compte A
  db.deleteProfile(profileA.id, undefined);
  assert.ok(db.getProfile(profileA.id), 'La suppression anonyme doit être bloquée');

  db.deleteProfile(profileA.id, 'acc_user_beta');
  assert.ok(db.getProfile(profileA.id), 'La suppression par un compte tiers doit être bloquée');

  // 6. Suppression légitime par le propriétaire
  db.deleteProfile(profileA.id, accountAId);
  assert.strictEqual(db.getProfile(profileA.id), undefined, 'Suppression réussie par le propriétaire');

  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test('Security Audit: isPublicHttpUrl bloque le SSRF, DNS Rebinding et métadonnées Cloud', () => {
  // Cibles dangereuses locales & cloud metadata
  assert.strictEqual(isPublicHttpUrl('http://127.0.0.1/video.mp4'), false);
  assert.strictEqual(isPublicHttpUrl('http://localhost:8080/manifest.json'), false);
  assert.strictEqual(isPublicHttpUrl('http://0.0.0.0:3000/stream'), false);
  assert.strictEqual(isPublicHttpUrl('http://169.254.169.254/latest/meta-data/'), false); // AWS/GCP/Azure metadata
  assert.strictEqual(isPublicHttpUrl('http://127.0.0.1.nip.io/stream'), false);
  assert.strictEqual(isPublicHttpUrl('http://127-0-0-1.nip.io/stream'), false);
  assert.strictEqual(isPublicHttpUrl('http://0x7f000001/stream'), false);
  assert.strictEqual(isPublicHttpUrl('http://2130706433/stream'), false);
  assert.strictEqual(isPublicHttpUrl('file:///etc/passwd'), false);
  assert.strictEqual(isPublicHttpUrl('javascript:alert(1)'), false);

  // Cibles distantes valides
  assert.strictEqual(isPublicHttpUrl('https://example.com/movie.mp4'), true);
  assert.strictEqual(isPublicHttpUrl('http://8.8.8.8/stream.m3u8'), true);

  // Plages privées RFC1918 avec blockPrivateRanges = true
  assert.strictEqual(isPublicHttpUrl('http://192.168.1.50/stream', true), false);
  assert.strictEqual(isPublicHttpUrl('http://10.0.0.1/stream', true), false);
  assert.strictEqual(isPublicHttpUrl('http://172.16.0.1/stream', true), false);
});

test('Security Audit: génération sécurisée et entropie des codes d\'appairage', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_security_pair.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);
  const session1 = db.createPairSession();
  const session2 = db.createPairSession();

  assert.equal(session1.code.length, 6);
  assert.equal(session2.code.length, 6);
  assert.notEqual(session1.code, session2.code, 'Les codes consécutifs doivent être distincts');
  assert.match(session1.code, /^[2-9A-Z]{6}$/, 'Format alphanumérique sans ambiguïté visuelle');

  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test('Security Audit & Preferences: persistance et restitution fine des réglages de lecture par profil', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_security_prefs.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);
  const p = db.createProfile('Test Prefs', 'avatar2');

  // 1. Sauvegarde avec préférences initiales complètes
  db.saveWatchProgress({
    profileId: p.id,
    mediaId: 'tt1234567',
    mediaType: 'movie',
    title: 'Test Movie',
    currentTime: 120,
    duration: 7200,
    completed: 0,
    audioTrack: '2',
    subtitleTrack: 'https://sub.test/fre.vtt',
    subtitleDelay: -0.5,
    playbackSpeed: 1.25,
  });

  const saved1 = db.getMediaProgress(p.id, 'tt1234567');
  assert.ok(saved1);
  assert.strictEqual(saved1.currentTime, 120);
  assert.strictEqual(saved1.audioTrack, '2');
  assert.strictEqual(saved1.subtitleTrack, 'https://sub.test/fre.vtt');
  assert.strictEqual(saved1.subtitleDelay, -0.5);
  assert.strictEqual(saved1.playbackSpeed, 1.25);

  // 2. Mise à jour de la position sans redonner les pistes : COALESCE doit préserver les préférences
  db.saveWatchProgress({
    profileId: p.id,
    mediaId: 'tt1234567',
    mediaType: 'movie',
    title: 'Test Movie',
    currentTime: 240,
    duration: 7200,
    completed: 0,
  });

  const saved2 = db.getMediaProgress(p.id, 'tt1234567');
  assert.ok(saved2);
  assert.strictEqual(saved2.currentTime, 240);
  assert.strictEqual(saved2.audioTrack, '2', 'COALESCE doit préserver la piste audio');
  assert.strictEqual(saved2.subtitleTrack, 'https://sub.test/fre.vtt', 'COALESCE doit préserver le sous-titre');
  assert.strictEqual(saved2.subtitleDelay, -0.5, 'COALESCE doit préserver le décalage');
  assert.strictEqual(saved2.playbackSpeed, 1.25, 'COALESCE doit préserver la vitesse');

  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test('Security Audit: contrôle d\'accès multi-comptes et séparation des profils', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_security_access.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new DatabaseManager(testDbPath);

  // Compte Alpha
  const profAlpha = db.createProfile('Alpha User', 'av1', 0, undefined, 'fra', 'fra', 'foreign_only', 'indigo', 'acc_alpha');
  // Compte Beta
  const profBeta = db.createProfile('Beta User', 'av2', 0, undefined, 'fra', 'fra', 'foreign_only', 'violet', 'acc_beta');
  // Invité Local (sans compte)
  const profGuest = db.createProfile('Guest User', 'av3', 0, undefined, 'fra', 'fra', 'foreign_only', 'amber', null);

  // Vérifier la fonction d'isolation
  function verifyAccess(profileId: string, accountId?: string | null): boolean {
    const prof = db.getProfile(profileId);
    if (!prof) return false;
    if (prof.accountId === null) return true; // Profil invité local
    return prof.accountId === accountId;
  }

  // Alpha accède à son profil -> OK
  assert.strictEqual(verifyAccess(profAlpha.id, 'acc_alpha'), true);
  // Beta accède au profil de Alpha -> REFUSÉ
  assert.strictEqual(verifyAccess(profAlpha.id, 'acc_beta'), false);
  // Anonyme accède au profil de Alpha -> REFUSÉ
  assert.strictEqual(verifyAccess(profAlpha.id, undefined), false);

  // Anonyme ou n'importe qui accède au profil invité local -> OK
  assert.strictEqual(verifyAccess(profGuest.id, undefined), true);
  assert.strictEqual(verifyAccess(profGuest.id, 'acc_alpha'), true);

  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

