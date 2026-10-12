import test from 'node:test';
import assert from 'node:assert';
import { maskAddonUrl, isSafePlayableUrl, normalizePoster } from '../addonClient.js';

test('maskAddonUrl cache le jeton du chemin', () => {
  const r = maskAddonUrl('https://x.example.com/stremio/SECRET-UUID/eyJabc/manifest.json');
  assert.equal(r.host, 'x.example.com');
  assert.equal(r.hasConfig, true);
  assert.equal(JSON.stringify(r).includes('SECRET'), false);
  assert.equal(maskAddonUrl('https://v3-cinemeta.strem.io/manifest.json').hasConfig, false);
});

test('isSafePlayableUrl refuse les schémas et options dangereux', () => {
  assert.equal(isSafePlayableUrl('https://a.b/video.mkv'), true);
  assert.equal(isSafePlayableUrl('magnet:?xt=urn:btih:abc'), true);
  assert.equal(isSafePlayableUrl('file:///etc/passwd'), false);
  assert.equal(isSafePlayableUrl('--script=evil.lua'), false);
  assert.equal(isSafePlayableUrl(42), false);
});

test('normalizePoster préfère l\'image brute', () => {
  assert.equal(normalizePoster({ poster: 'a', _rawPosterUrl: 'https://raw/x.jpg' } as any).poster, 'https://raw/x.jpg');
  assert.equal(normalizePoster({ poster: 'a' }).poster, 'a');
});
