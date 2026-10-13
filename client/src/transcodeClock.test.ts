import { test } from 'node:test';
import assert from 'node:assert';
import { isTimeBuffered } from './transcodeClock.ts';
import { api } from './api.ts';

test('transcodeClock: isTimeBuffered vérifie précisément si la position est dans le tampon', () => {
  const fakeRanges = {
    length: 2,
    start: (i: number) => (i === 0 ? 0 : 50),
    end: (i: number) => (i === 0 ? 30 : 120),
  };

  assert.strictEqual(isTimeBuffered(fakeRanges, 10), true, 'temps au milieu du premier tampon');
  assert.strictEqual(isTimeBuffered(fakeRanges, 0), true, 'début exact du tampon');
  assert.strictEqual(isTimeBuffered(fakeRanges, 29.4), true, 'dans la marge');
  assert.strictEqual(isTimeBuffered(fakeRanges, 29.8), false, 'trop proche de la fin du tampon (< 0.5s)');
  assert.strictEqual(isTimeBuffered(fakeRanges, 40), false, 'trou dans le tampon');
  assert.strictEqual(isTimeBuffered(fakeRanges, 60), true, 'deuxième tampon');
  assert.strictEqual(isTimeBuffered({ length: 0, start: () => 0, end: () => 0 }, 10), false, 'aucun tampon');
});

test('api: URLs torrent et transcodage correctement formées', () => {
  const magnet = 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Test';
  const torrentUrl = api.getTorrentStreamUrl(magnet, 2);
  assert.ok(torrentUrl.startsWith('/api/torrent/stream?magnet='));
  assert.ok(torrentUrl.includes('&fileIndex=2'));

  const transcodeUrl = api.getTranscodedStreamUrl('https://example.com/video.mkv', { startTime: 45, mode: 'audio' });
  assert.ok(transcodeUrl.startsWith('/api/transcode/stream?url='));
  assert.ok(transcodeUrl.includes('&startTime=45'));
  assert.ok(transcodeUrl.includes('&mode=audio'));

  // resolvePlayableUrl
  assert.strictEqual(
    api.resolvePlayableUrl(magnet),
    api.getTorrentStreamUrl(magnet),
    'magnet résolu via le moteur torrent'
  );
  assert.strictEqual(
    api.resolvePlayableUrl('0123456789abcdef0123456789abcdef01234567'),
    api.getTorrentStreamUrl('0123456789abcdef0123456789abcdef01234567'),
    'hash 40-hex résolu via le moteur torrent'
  );
  assert.ok(
    api.resolvePlayableUrl('https://example.com/video.mkv', false, true, 10).includes('/api/transcode/stream'),
    'useTranscode résolu via transcodage'
  );
});
