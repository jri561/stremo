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

test('api.getProxiedStreamUrl et getProxiedSubtitleUrl génèrent des URLs valides avec encodage', async () => {
  const { api } = await import('./api.ts');

  // Flux HTTP classique
  const streamUrl = 'https://debrid.example.com/dl/video.mkv?token=secret123';
  const proxiedStream = api.getProxiedStreamUrl(streamUrl);
  assert.equal(proxiedStream, `/api/proxy/stream?url=${encodeURIComponent(streamUrl)}`);

  // Flux HTTP avec option de téléchargement forcé
  const downloadStream = api.getProxiedStreamUrl(streamUrl, { download: true, filename: 'Film Test.mp4' });
  assert.equal(downloadStream, `/api/proxy/stream?url=${encodeURIComponent(streamUrl)}&download=1&filename=${encodeURIComponent('Film Test.mp4')}`);

  // Magnet link (ne doit pas être proxifié)
  const magnet = 'magnet:?xt=urn:btih:abcdef';
  assert.equal(api.getProxiedStreamUrl(magnet), magnet);

  // Sous-titre SRT
  const subUrl = 'https://opensubtitles.org/sub/123.srt';
  const proxiedSub = api.getProxiedSubtitleUrl(subUrl);
  assert.equal(proxiedSub, `/api/proxy/subtitle?url=${encodeURIComponent(subUrl)}`);
});

test('isStreamFrenchAudio, detectStreamAudioLanguage et matchSmartSubtitle gèrent les préférences de langues', async () => {
  const { isStreamFrenchAudio, detectStreamAudioLanguage, matchSmartSubtitle } = await import('./streams.ts');

  const frenchStream = { name: 'Animals.2026.TRUEFRENCH.1080p.mkv', url: 'https://x' };
  const englishStream = { name: 'Animals.2026.1080p.WEB-DL.DDP5.1', url: 'https://y' };
  const japaneseStream = { name: '[Judas] One Piece - 1100 [1080p][Jap Audio]', url: 'https://z' };

  // Détection audio
  assert.equal(isStreamFrenchAudio(frenchStream), true);
  assert.equal(isStreamFrenchAudio(englishStream), false);
  assert.equal(detectStreamAudioLanguage(frenchStream), 'fra');
  assert.equal(detectStreamAudioLanguage(englishStream), 'eng');
  assert.equal(detectStreamAudioLanguage(japaneseStream), 'jpn');

  // Matching intelligent de sous-titres
  const sampleSubs = [
    { id: 'sub_en', lang: 'eng', addonName: 'OpenSubtitles' },
    { id: 'sub_fr', lang: 'fre', addonName: 'OpenSubtitles' },
    { id: 'sub_es', lang: 'spa', addonName: 'OpenSubtitles' },
  ];

  // 1. Film anglais + profil français (mode foreign_only) -> doit activer les sous-titres français !
  const matchForEnglish = matchSmartSubtitle(sampleSubs, 'fra', 'eng', 'foreign_only');
  assert.equal(matchForEnglish?.id, 'sub_fr');

  // 2. Film français + profil français (mode foreign_only) -> ne doit PAS activer de sous-titres (audio déjà FR)
  const matchForFrench = matchSmartSubtitle(sampleSubs, 'fra', 'fra', 'foreign_only');
  assert.equal(matchForFrench, null);

  // 3. Film français + mode always -> doit activer les sous-titres français
  const matchAlways = matchSmartSubtitle(sampleSubs, 'fra', 'fra', 'always');
  assert.equal(matchAlways?.id, 'sub_fr');

  // 4. Mode off -> aucun sous-titre
  assert.equal(matchSmartSubtitle(sampleSubs, 'fra', 'eng', 'off'), null);
});

test('selectBestStreamForQuickPlay choisit le flux optimal selon la langue et la compatibilité web', async () => {
  const { selectBestStreamForQuickPlay } = await import('./streams.ts');

  const stream4kEngMkv = {
    name: '[RD⚡] 2160p 4K Remux HEVC TrueHD 7.1',
    description: '📺 4K • 🎧 TrueHD 7.1 • 💾 45 GB',
    url: 'https://debrid/4k_heavy.mkv',
    behaviorHints: { notWebReady: true },
  };

  const stream1080pFrenchWeb = {
    name: '[RD⚡] French 1080p WEB-DL H264 AAC',
    description: '📺 1080p • 🎧 AAC 2.0 • 🌐 🇫🇷 • 💾 2.8 GB',
    url: 'https://debrid/french_1080p.mp4',
  };

  const stream1080pEnglishWeb = {
    name: '[RD⚡] English 1080p WEB-DL H264 AAC',
    description: '📺 1080p • 🎧 AAC 2.0 • 🌐 🇬🇧 • 💾 2.5 GB',
    url: 'https://debrid/english_1080p.mp4',
  };

  // 1. Profil Francophone (web player) -> doit choisir stream1080pFrenchWeb
  const bestForFrench = selectBestStreamForQuickPlay(
    [stream4kEngMkv, stream1080pEnglishWeb, stream1080pFrenchWeb],
    { preferredAudioLanguage: 'fr', preferWebReady: true }
  );
  assert.equal(bestForFrench?.url, stream1080pFrenchWeb.url);

  // 2. Profil Anglophone (web player) -> doit choisir stream1080pEnglishWeb
  const bestForEnglish = selectBestStreamForQuickPlay(
    [stream4kEngMkv, stream1080pFrenchWeb, stream1080pEnglishWeb],
    { preferredAudioLanguage: 'en', preferWebReady: true }
  );
  assert.equal(bestForEnglish?.url, stream1080pEnglishWeb.url);

  // 3. Lecteur externe / VLC (preferWebReady: false) -> peut privilégier le 4K Remux
  const bestForExternal = selectBestStreamForQuickPlay(
    [stream1080pEnglishWeb, stream4kEngMkv],
    { preferredAudioLanguage: 'en', preferWebReady: false }
  );
  assert.equal(bestForExternal?.url, stream4kEngMkv.url);

  // 4. Liste vide ou sans URL -> renvoie null
  assert.equal(selectBestStreamForQuickPlay([]), null);
  assert.equal(selectBestStreamForQuickPlay([{ name: 'sans url' } as any]), null);
});

test('parseStream détecte les liens Magnet P2P et extrait les seeders', async () => {
  const { parseStream, getPlayerRecommendation } = await import('./streams.ts');

  const magnetStream = {
    addonName: 'Torrentio',
    name: 'Torrentio 1080p',
    description: '👤 87 💾 4.2 GB ⚙️ 1337x\nMovie.2024.1080p.WEBRip.x264',
    url: 'magnet:?xt=urn:btih:d2b3c4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3&dn=Movie.2024',
  };

  const parsed = parseStream(magnetStream);
  assert.strictEqual(parsed.isMagnet, true);
  assert.strictEqual(parsed.infoHash?.toLowerCase(), 'd2b3c4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3');
  assert.strictEqual(parsed.seeders, 87);
  assert.strictEqual(parsed.webReady, false);

  const rec = getPlayerRecommendation(parsed);
  assert.strictEqual(rec.isWebOk, false);
  assert.ok(rec.label.includes('87 seeders'));
  assert.ok(rec.label.includes('VLC'));
});



