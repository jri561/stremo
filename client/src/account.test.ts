import test from 'node:test';
import assert from 'node:assert';
import { api } from './api.ts';

// Polyfill minimal localStorage pour l'environnement Node.js test
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  } as Storage;
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    dispatchEvent: () => true,
  };
}

test('api.account token lifecycle and storage management', () => {
  localStorage.clear();

  // 1. Initialement sans jeton
  assert.strictEqual(api.account.getToken(), null);

  // 2. Définition d'un jeton de session (64 caractères)
  const fakeToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  api.account.setToken(fakeToken);

  assert.strictEqual(api.account.getToken(), fakeToken);
  assert.strictEqual(localStorage.getItem('stremo_account_token'), fakeToken);

  // 3. Déconnexion / suppression du jeton
  api.account.setToken(null);
  assert.strictEqual(api.account.getToken(), null);
  assert.strictEqual(localStorage.getItem('stremo_account_token'), null);
});
