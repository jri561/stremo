import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, generateSessionToken } from '../accountAuth.js';

test('accountAuth: hashPassword et verifyPassword valident les mots de passe légitimes', () => {
  const password = 'MonMotDePasseSecret123!';
  const { hash, salt } = hashPassword(password);

  assert.ok(hash.length > 32);
  assert.strictEqual(salt.length, 32); // 16 bytes en hex = 32 chars

  // Vérification réussie
  assert.strictEqual(verifyPassword(password, hash, salt), true);

  // Vérification échouée sur mot de passe incorrect
  assert.strictEqual(verifyPassword('MauvaisMotDePasse', hash, salt), false);
  assert.strictEqual(verifyPassword('', hash, salt), false);
  assert.strictEqual(verifyPassword(password, hash, 'mauvais_sel'), false);
});

test('accountAuth: generateSessionToken génère des jetons aléatoires uniques et sécurisés', () => {
  const token1 = generateSessionToken();
  const token2 = generateSessionToken();

  assert.strictEqual(token1.length, 64);
  assert.strictEqual(token2.length, 64);
  assert.notStrictEqual(token1, token2);
});
