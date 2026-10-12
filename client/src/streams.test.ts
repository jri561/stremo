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

test('shouldAutoSkipIntro et getIntroTargetTime gèrent le saut automatique d intro', async () => {
  const { shouldAutoSkipIntro, getIntroTargetTime } = await import('./streams.ts');

  // Si l'option est désactivée : ne saute jamais
  assert.equal(shouldAutoSkipIntro(10, 1800, false), false);

  // Si l'option est activée au tout début de l'épisode (10s) : doit sauter
  assert.equal(shouldAutoSkipIntro(10, 1800, true), true);

  // Si on est déjà plus loin (ex: 60s) : la fenêtre d'activation auto est passée
  assert.equal(shouldAutoSkipIntro(60, 1800, true), false);

  // Vidéo très courte (ex: 90s) : pas de saut automatique
  assert.equal(shouldAutoSkipIntro(10, 90, true), false);

  // Calcul du saut d'intro (+85s)
  assert.equal(getIntroTargetTime(5, 1800, 85), 90);
  // Empêche de dépasser la fin de la vidéo
  assert.equal(getIntroTargetTime(95, 100, 85), 85);
});

test('getNextFallbackStream bascule vers le flux suivant en cas d erreur', async () => {
  const { getNextFallbackStream } = await import('./streams.ts');

  const s1 = { name: 'Flux 1 (4K)', url: 'https://cdn/1.mp4' };
  const s2 = { name: 'Flux 2 (1080p)', url: 'https://cdn/2.mp4' };
  const s3 = { name: 'Flux 3 (720p)', url: 'https://cdn/3.mp4' };

  // Flux 1 échoue -> propose Flux 2
  const nextFrom1 = getNextFallbackStream(s1.url, [s1, s2, s3]);
  assert.equal(nextFrom1?.url, s2.url);

  // Flux 2 échoue -> propose Flux 3
  const nextFrom2 = getNextFallbackStream(s2.url, [s1, s2, s3]);
  assert.equal(nextFrom2?.url, s3.url);

  // Flux 3 (dernier) échoue -> null (plus de flux disponible)
  const nextFrom3 = getNextFallbackStream(s3.url, [s1, s2, s3]);
  assert.equal(nextFrom3, null);

  // Liste vide ou flux unique -> null
  assert.equal(getNextFallbackStream(s1.url, [s1]), null);
  assert.equal(getNextFallbackStream(s1.url, []), null);
});

test('detectTvDevice identifie fidèlement les navigateurs Smart TV et salon', async () => {
  const { detectTvDevice } = await import('./streams.ts');

  // Smart TV et TV Box
  assert.equal(detectTvDevice('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79 Safari/537.36 LG Browser/8.00'), true);
  assert.equal(detectTvDevice('Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 SamsungBrowser/4.0 Chrome/76 Safari/537.36'), true);
  assert.equal(detectTvDevice('Mozilla/5.0 (Linux; Android 11; BRAVIA 4K VH2 Build/BRAVIA_VH2_EU) AppleWebKit/537.36 Android TV'), true);
  assert.equal(detectTvDevice('Mozilla/5.0 (Linux; Android 9; AFTT Build/PS7292) AppleWebKit/537.36 FireTV'), true);
  assert.equal(detectTvDevice('Mozilla/5.0 (CrKey armv7l 1.56.500000) AppleWebKit/537.36 Chromecast'), true);

  // Ordinateur classique et smartphone mobile
  assert.equal(detectTvDevice('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'), false);
  assert.equal(detectTvDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'), false);
});


