import test from 'node:test';
import assert from 'node:assert';
import { parseStream, rankStreams, matchesResolution } from './streams.ts';

const aio = {
  addonName: 'V2',
  name: '[AD⚡] Torrentio 2160p',
  description: '📁 Animals (2026)\n🎥 WEB-DL 🎞️ HEVC 🏷️ BTM\n📺 DV • HDR10 • 10bit 🎧 DD+ • Atmos 🔊 5.1\n📦 16.4 GB ⏱️ 1h:48m:11s 🔍 ThePirateBay\n🌐 🇫🇷 / 🇬🇧 / 🇪🇸',
  url: 'https://x/1',
  behaviorHints: { videoSize: 16385300234, filename: 'Animals.2026.2160p.mkv' },
};

test('parseStream extrait les infos AIOStreams', () => {
  const p = parseStream(aio);
  assert.equal(p.height, 2160);
  assert.equal(p.resolutionLabel, '4K');
  assert.equal(p.debrid, 'AllDebrid');
  assert.equal(p.cached, true);
  assert.equal(p.provider, 'Torrentio');
  assert.equal(p.codec, 'HEVC');
  assert.deepEqual(p.hdr, ['Dolby Vision', 'HDR10', '10bit'].filter(h => h !== '10bit'));
  assert.ok(p.audio.includes('Atmos'));
  assert.deepEqual(p.languages, ['🇫🇷', '🇬🇧', '🇪🇸']);
  assert.equal(p.sizeLabel, '16.4 Go');
});

test('rankStreams favorise web-ready pour le lecteur intégré', () => {
  const web = { ...aio, name: '[AD⚡] Lumio 1080p', url: 'https://x/2', behaviorHints: { videoSize: 5e9 } };
  const mkv = { ...aio, behaviorHints: { notWebReady: true, videoSize: 16e9 } };
  assert.equal(rankStreams([mkv, web], true)[0].stream.url, 'https://x/2');
  assert.equal(rankStreams([mkv, web], false)[0].stream.url, 'https://x/1');
});

test('rankStreams ignore les flux sans URL et le filtre de résolution fonctionne', () => {
  assert.equal(rankStreams([{ addonName: 'a', name: 'x' }], false).length, 0);
  const p = parseStream({ addonName: 'a', name: 'Torrentio 720p', url: 'u' });
  assert.equal(matchesResolution(p, '720'), true);
  assert.equal(matchesResolution(p, '2160'), false);
});

test('getPlayerRecommendation conseille le lecteur adapté', async () => {
  const { getPlayerRecommendation } = await import('./streams.ts');
  const webP = parseStream({ addonName: 'a', name: 'Lumio 1080p', url: 'https://x/3', behaviorHints: { filename: 'film.mp4' } });
  const recWeb = getPlayerRecommendation(webP);
  assert.equal(recWeb.isWebOk, true);

  const mkvP = parseStream(aio);
  const recMkv = getPlayerRecommendation(mkvP);
  assert.equal(recMkv.isWebOk, false);
});

test('isKidsSafeItem filtre strictement les contenus adultes et préserve les contenus familiaux', async () => {
  const { isKidsSafeItem } = await import('./api.ts');
  
  // Contenu familial : accepté
  assert.equal(isKidsSafeItem({ id: '1', type: 'movie', name: 'Le Roi Lion', genres: ['Animation', 'Famille'] }), true);
  assert.equal(isKidsSafeItem({ id: '2', type: 'movie', name: 'Toy Story', genres: ['Aventure', 'Comédie', 'Animation'] }), true);

  // Contenu adulte ou horreur : rejeté
  assert.equal(isKidsSafeItem({ id: '3', type: 'movie', name: 'Saw X', genres: ['Horror', 'Mystery'] }), false);
  assert.equal(isKidsSafeItem({ id: '4', type: 'movie', name: 'Massacre à la tronçonneuse', genres: ['Animation'] }), false);
  assert.equal(isKidsSafeItem({ id: '5', type: 'movie', name: 'The Godfather', genres: ['Crime', 'Drama'] }), false);
});

test('isOutroCreditsDetected détecte le générique de fin et déclenche le saut d’épisode', async () => {
  const { isOutroCreditsDetected } = await import('./streams.ts');

  // Épisode de 50 minutes (3000s) avec seuil par défaut de 75s
  // 1. En plein milieu (1500s) : pas de générique de fin
  assert.equal(isOutroCreditsDetected(1500, 3000, 75), false);

  // 2. À 70 secondes de la fin (2930s) : générique de fin détecté !
  assert.equal(isOutroCreditsDetected(2930, 3000, 75), true);

  // 3. À 10 secondes de la fin (2990s) : toujours dans le générique de fin
  assert.equal(isOutroCreditsDetected(2990, 3000, 75), true);

  // 4. Vidéo courte de moins de 60s : ignorée pour éviter les faux positifs
  assert.equal(isOutroCreditsDetected(30, 45, 75), false);
});

