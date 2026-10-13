import test, { after, before } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import express from 'express';
import WebTorrent from 'webtorrent';
import { buildMagnet, isPublicHttpUrl, DEFAULT_TRACKERS } from '../addonClient.js';
import { isAuthorized, isMediaPath, keysMatch, isTunnelRequest, isLocalSocket } from '../auth.js';
import { proxySubtitle, proxyStream } from '../streamProxy.js';
import {
  TorrentEngine,
  extractFileSelection,
  extractInfoHash,
  parseRange,
  toMagnetUri,
  getMimeType,
} from '../torrentEngine.js';
import { TranscodeEngine, buildFfmpegArgs, resolveTranscodeInput } from '../transcodeEngine.js';

const HASH = '0123456789abcdef0123456789abcdef01234567';

// ---------------------------------------------------------------- Unitaires

test('parseRange gère plages, suffixes, bornage et plages invalides', () => {
  assert.strictEqual(parseRange(undefined, 1000), null);
  assert.strictEqual(parseRange('items=0-5', 1000), null);
  assert.deepStrictEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepStrictEqual(parseRange('bytes=900-', 1000), { start: 900, end: 999 });
  assert.deepStrictEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
  assert.deepStrictEqual(parseRange('bytes=-5000', 1000), { start: 0, end: 999 });
  // fin au-delà du fichier : bornée (et non rejetée), comportement attendu par les navigateurs
  assert.deepStrictEqual(parseRange('bytes=500-99999', 1000), { start: 500, end: 999 });
  assert.strictEqual(parseRange('bytes=1000-', 1000), 'unsatisfiable');
  assert.strictEqual(parseRange('bytes=50-10', 1000), 'unsatisfiable');
  assert.strictEqual(parseRange('bytes=-0', 1000), 'unsatisfiable');
  assert.strictEqual(parseRange('bytes=0-10', 0), 'unsatisfiable');
});

test('extractInfoHash / extractFileSelection / toMagnetUri', () => {
  assert.strictEqual(extractInfoHash(HASH.toUpperCase()), HASH);
  assert.strictEqual(extractInfoHash(`magnet:?xt=urn:btih:${HASH}&dn=x`), HASH);
  assert.strictEqual(extractInfoHash(`magnet:?dn=x&xt=urn:btih:${HASH}`), HASH);
  assert.strictEqual(extractInfoHash(`magnet:?xt=urn:btih:${HASH}ff`), null, 'hash trop long refusé');
  assert.strictEqual(extractInfoHash('https://exemple.com/a.mp4'), null);
  assert.strictEqual(extractInfoHash(''), null);

  assert.strictEqual(extractFileSelection(`magnet:?xt=urn:btih:${HASH}&so=7`), 7);
  assert.strictEqual(extractFileSelection(`magnet:?xt=urn:btih:${HASH}`), undefined);

  const bare = toMagnetUri(HASH)!;
  assert.ok(bare.startsWith(`magnet:?xt=urn:btih:${HASH}`));
  for (const t of DEFAULT_TRACKERS) assert.ok(bare.includes(encodeURIComponent(t)));
  const full = `magnet:?xt=urn:btih:${HASH}&tr=udp%3A%2F%2Fa`;
  assert.strictEqual(toMagnetUri(full), full, 'un magnet complet reste inchangé');
  assert.strictEqual(toMagnetUri('nimporte-quoi'), null);
});

test('getMimeType associe les extensions vidéo', () => {
  assert.strictEqual(getMimeType('a.mkv'), 'video/x-matroska');
  assert.strictEqual(getMimeType('a.WEBM'), 'video/webm');
  assert.strictEqual(getMimeType('a.mp4'), 'video/mp4');
});

test('buildMagnet reconstruit un magnet complet (trackers, so=) ou refuse un hash invalide', () => {
  const magnet = buildMagnet({
    infoHash: HASH.toUpperCase(),
    fileIdx: 3,
    title: 'Série S01E04\n👤 12',
    sources: ['tracker:udp://tracker.exemple.org:80/announce', 'dht:' + HASH, 'tracker:javascript:alert(1)'],
  })!;
  assert.ok(magnet.startsWith(`magnet:?xt=urn:btih:${HASH}`));
  assert.ok(magnet.includes(encodeURIComponent('udp://tracker.exemple.org:80/announce')));
  assert.ok(!magnet.includes('javascript'), 'schéma de tracker non autorisé ignoré');
  assert.ok(magnet.endsWith('&so=3'));
  assert.strictEqual(extractInfoHash(magnet), HASH);
  assert.strictEqual(extractFileSelection(magnet), 3);
  assert.strictEqual(buildMagnet({ infoHash: 'zzz' }), undefined);
  assert.strictEqual(buildMagnet({}), undefined);
  assert.ok(!buildMagnet({ infoHash: HASH })!.includes('so='));
});

test('isPublicHttpUrl refuse les cibles locales et schémas dangereux', () => {
  assert.strictEqual(isPublicHttpUrl('https://cdn.exemple.com/v.mp4'), true);
  assert.strictEqual(isPublicHttpUrl('http://192.168.1.20:8080/v.mp4'), true, 'le LAN reste autorisé sans tunnel');
  assert.strictEqual(isPublicHttpUrl('http://192.168.1.20:8080/v.mp4', true), false, 'le LAN est bloqué en mode tunnel');
  assert.strictEqual(isPublicHttpUrl('http://10.0.0.1:8080/v.mp4', true), false);
  assert.strictEqual(isPublicHttpUrl('http://172.16.0.1:8080/v.mp4', true), false);
  for (const bad of [
    'http://localhost:3001/api/profiles',
    'http://127.0.0.1/x',
    'http://127.1.2.3/x',
    'http://0.0.0.0/x',
    'http://[::1]/x',
    'http://169.254.169.254/latest/meta-data',
    'http://[fd00::1]/x',
    'file:///etc/passwd',
    'ftp://exemple.com/a',
    'magnet:?xt=urn:btih:' + HASH,
    '-i http://exemple.com',
    42,
    undefined,
  ]) {
    assert.strictEqual(isPublicHttpUrl(bad as any), false, String(bad));
  }
});

test('contrôle d’accès : clé en en-tête, ?k= réservé aux routes média', () => {
  assert.strictEqual(isAuthorized(undefined, '/profiles', undefined, undefined), true, 'sans clé configurée');
  assert.strictEqual(isAuthorized('secret', '/profiles', undefined, undefined), false);
  assert.strictEqual(isAuthorized('secret', '/profiles', 'secret', undefined), true);
  assert.strictEqual(isAuthorized('secret', '/profiles', undefined, 'secret'), false, '?k= refusé hors média');
  for (const p of ['/proxy/stream', '/torrent/stream', '/transcode/stream', '/torrent/stats']) {
    assert.strictEqual(isMediaPath(p), true);
    assert.strictEqual(isAuthorized('secret', p, undefined, undefined), false, p + ' sans clé');
    assert.strictEqual(isAuthorized('secret', p, undefined, 'mauvaise'), false, p + ' mauvaise clé');
    assert.strictEqual(isAuthorized('secret', p, undefined, 'secret'), true, p + ' bonne clé');
  }
  assert.strictEqual(isAuthorized('secret', '/auth-check', undefined, undefined), true);
  assert.strictEqual(isAuthorized('secret', '/sync/pair/events/ABC123', undefined, undefined), true);
  assert.strictEqual(isAuthorized('secret', '/sync/lan/devices', undefined, undefined), false, 'découverte LAN protégée par clé');
  assert.strictEqual(keysMatch('abc', 'abcd'), false);
  assert.strictEqual(keysMatch('abc', ['abc']), false);
  assert.strictEqual(keysMatch('secret_key', 'secret_key'), true);
  assert.strictEqual(isTunnelRequest({ 'cf-connecting-ip': '1.2.3.4' }), true);
  assert.strictEqual(isTunnelRequest({ host: 'localhost:3001' }), false);
  assert.strictEqual(isLocalSocket('127.0.0.1'), true);
  assert.strictEqual(isLocalSocket('::1'), true);
  assert.strictEqual(isLocalSocket('::ffff:127.0.0.1'), true);
  assert.strictEqual(isLocalSocket('192.168.1.10'), false);
  assert.strictEqual(isLocalSocket('203.0.113.5'), false);
});

test('resolveTranscodeInput et buildFfmpegArgs sont sûrs', () => {
  assert.strictEqual(resolveTranscodeInput('file:///etc/passwd', 3001), null);
  assert.strictEqual(resolveTranscodeInput('http://localhost:3001/x', 3001), null);
  assert.strictEqual(resolveTranscodeInput('http://localhost:3001/x', 3001, undefined, true), 'http://localhost:3001/x');
  assert.strictEqual(resolveTranscodeInput('file:///etc/passwd', 3001, undefined, true), null, 'file: jamais, même en local');
  assert.strictEqual(resolveTranscodeInput(['a'], 3001), null);
  assert.strictEqual(resolveTranscodeInput('https://cdn.exemple.com/v.mkv', 3001), 'https://cdn.exemple.com/v.mkv');
  const internal = resolveTranscodeInput(`magnet:?xt=urn:btih:${HASH}`, 3001, 'clé&secrète')!;
  assert.ok(internal.startsWith('http://127.0.0.1:3001/api/torrent/stream?magnet='));
  assert.ok(internal.endsWith('&k=cl%C3%A9%26secr%C3%A8te'), 'clé interne encodée');

  const args = buildFfmpegArgs({ input: 'https://cdn.exemple.com/v.mkv', startTime: 90, mode: 'audio' });
  assert.deepStrictEqual(args.slice(args.indexOf('-protocol_whitelist'), args.indexOf('-protocol_whitelist') + 2), ['-protocol_whitelist', 'http,https,tcp,tls,crypto']);
  assert.ok(args.indexOf('-ss') < args.indexOf('-i'), '-ss avant -i (seek rapide)');
  assert.strictEqual(args[args.indexOf('-ss') + 1], '90');
  assert.ok(args.includes('-sn') && args.includes('0:v:0') && args.includes('0:a:0?'));
  assert.strictEqual(args[args.indexOf('-c:v') + 1], 'copy');
  assert.strictEqual(buildFfmpegArgs({ input: 'x', mode: 'full' })[buildFfmpegArgs({ input: 'x', mode: 'full' }).indexOf('-c:v') + 1], 'libx264');
  assert.ok(!buildFfmpegArgs({ input: 'x', startTime: -5 }).includes('-ss'), 'startTime négatif ignoré');
  assert.ok(!buildFfmpegArgs({ input: 'x', startTime: NaN }).includes('-ss'));
  assert.strictEqual(buildFfmpegArgs({ input: 'x', startTime: 1e12 })[buildFfmpegArgs({ input: 'x', startTime: 1e12 }).indexOf('-ss') + 1], '86400');
});

// ------------------------------------------- Intégration : transcodage réel

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stremo-media-test-'));
const transcode = new TranscodeEngine();
let ffmpegOk = false;
let fileServer: http.Server;
let transcodeServer: http.Server;
let seeder: InstanceType<typeof WebTorrent> | null = null;
let torrentServer: http.Server;
let leecher: TorrentEngine | null = null;

const listen = (app: express.Express) =>
  new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
const base = (s: http.Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`;

const webmPath = path.join(tmpDir, 'seed', 'clip.webm');
const mkvPath = path.join(tmpDir, 'src', 'multi.mkv');

before(async () => {
  ffmpegOk = await transcode.isAvailable();
  fs.mkdirSync(path.dirname(webmPath), { recursive: true });
  fs.mkdirSync(path.dirname(mkvPath), { recursive: true });
  if (!ffmpegOk) return;

  const ff = (args: string[]) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'pipe' });
  // MKV : H.264 + 2 pistes audio (AC3 puis MP3) + sous-titres SRT — le cas qui casse un remux naïf
  fs.writeFileSync(path.join(tmpDir, 'sub.srt'), '1\n00:00:00,000 --> 00:00:01,000\nBonjour\n');
  ff([
    '-f', 'lavfi', '-i', 'testsrc=duration=3:size=160x120:rate=15',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-f', 'lavfi', '-i', 'sine=frequency=880:duration=3',
    '-i', path.join(tmpDir, 'sub.srt'),
    '-map', '0:v', '-map', '1:a', '-map', '2:a', '-map', '3:s',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a:0', 'ac3', '-c:a:1', 'libmp3lame', '-c:s', 'srt',
    mkvPath,
  ]);
  ff([
    '-f', 'lavfi', '-i', 'testsrc=duration=3:size=160x120:rate=15',
    '-c:v', 'libvpx', '-b:v', '150k', '-an',
    webmPath,
  ]);

  const files = express();
  files.use(express.static(path.dirname(mkvPath)));
  files.get('/redirect-to-local', (_req, res) => res.redirect('http://127.0.0.1:3001/api/backup/export'));
  files.get('/sub.srt', (_req, res) => res.sendFile(path.join(tmpDir, 'sub.srt')));
  fileServer = await listen(files);

  const app = express();
  app.get('/transcode', (req, res) => transcode.handleTranscode(req, res));
  app.head('/transcode', (req, res) => transcode.handleTranscode(req, res));
  app.get('/proxy/subtitle', proxySubtitle);
  app.get('/proxy/stream', proxyStream);
  transcodeServer = await listen(app);
});

after(async () => {
  fileServer?.close();
  transcodeServer?.close();
  torrentServer?.close();
  await leecher?.destroy();
  await new Promise<void>((r) => (seeder ? seeder.destroy(() => r()) : r()));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const probeFile = (file: string) =>
  JSON.parse(
    execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_streams', file], { encoding: 'utf8' })
  ).streams as Array<{ codec_type: string; codec_name: string; channels?: number }>;

test('transcodage réel : MKV AC3 + MP3 + sous-titres → MP4 H.264 + 1 piste AAC stéréo', async (t) => {
  if (!ffmpegOk) return t.skip('ffmpeg indisponible');
  const url = `${base(transcodeServer)}/transcode?url=${encodeURIComponent(base(fileServer) + '/multi.mkv')}`;
  const res = await fetch(url);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-type'), 'video/mp4');
  const out = path.join(tmpDir, 'out.mp4');
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  const streams = probeFile(out);
  assert.deepStrictEqual(streams.map((s) => s.codec_type + ':' + s.codec_name), ['video:h264', 'audio:aac']);
  assert.strictEqual(streams[1].channels, 2);
  for (let i = 0; i < 40 && transcode.activeJobs > 0; i++) await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual(transcode.activeJobs, 0, 'aucun processus ffmpeg résiduel');
});

test('transcodage réel : startTime décale la lecture', async (t) => {
  if (!ffmpegOk) return t.skip('ffmpeg indisponible');
  const src = encodeURIComponent(base(fileServer) + '/multi.mkv');
  const full = (await (await fetch(`${base(transcodeServer)}/transcode?url=${src}`)).arrayBuffer()).byteLength;
  const cut = (await (await fetch(`${base(transcodeServer)}/transcode?url=${src}&startTime=2`)).arrayBuffer()).byteLength;
  assert.ok(cut > 0 && cut < full, `flux coupé (${cut}) plus court que complet (${full})`);
});

test('transcodage : entrées refusées (file:, locale via tunnel, mode inconnu, HEAD)', async (t) => {
  if (!ffmpegOk) return t.skip('ffmpeg indisponible');
  const b = base(transcodeServer);
  assert.strictEqual((await fetch(`${b}/transcode?url=${encodeURIComponent('file:///etc/passwd')}`)).status, 400);
  assert.strictEqual((await fetch(`${b}/transcode`)).status, 400);
  assert.strictEqual((await fetch(`${b}/transcode?url=${encodeURIComponent(base(fileServer) + '/multi.mkv')}&startTime=-3`)).status, 400);
  // Même cible locale, mais vue comme venant d'un tunnel public → refusée (SSRF)
  const viaTunnel = await fetch(`${b}/transcode?url=${encodeURIComponent(base(fileServer) + '/multi.mkv')}`, {
    headers: { 'cf-connecting-ip': '203.0.113.9' },
  });
  assert.strictEqual(viaTunnel.status, 400);
  const head = await fetch(`${b}/transcode?url=${encodeURIComponent(base(fileServer) + '/multi.mkv')}`, { method: 'HEAD' });
  assert.strictEqual(head.status, 200);
  for (let i = 0; i < 40 && transcode.activeJobs > 0; i++) await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual(transcode.activeJobs, 0, 'HEAD ne lance pas ffmpeg');
});

test('sonde ffprobe : codecs et durée ; cible invalide → null', async (t) => {
  if (!ffmpegOk) return t.skip('ffmpeg indisponible');
  const probe = await transcode.probe(base(fileServer) + '/multi.mkv', 8000, true);
  assert.ok(probe);
  assert.strictEqual(probe!.videoCodec, 'h264');
  assert.strictEqual(probe!.audioCodec, 'ac3');
  assert.ok(probe!.duration! > 2 && probe!.duration! < 4);
  assert.strictEqual(await transcode.probe(base(fileServer) + '/multi.mkv'), null, 'localhost refusé sans allowLocal');
  assert.strictEqual(await transcode.probe('file:///etc/passwd', 2000, true), null);
});

test('proxySubtitle et proxyStream protègent contre le SSRF direct et les redirections 302', async (t) => {
  if (!ffmpegOk) return t.skip('ffmpeg indisponible');
  const b = base(transcodeServer);
  const f = base(fileServer);

  // 1. proxySubtitle direct
  const subRes = await fetch(`${b}/proxy/subtitle?url=${encodeURIComponent(f + '/sub.srt')}`);
  assert.strictEqual(subRes.status, 200);
  const text = await subRes.text();
  assert.ok(text.startsWith('WEBVTT'), 'conversion WebVTT active');

  // 2. proxySubtitle refuse localhost via tunnel (SSRF)
  const localSub = await fetch(`${b}/proxy/subtitle?url=${encodeURIComponent('http://127.0.0.1:3001/api/backup')}`, {
    headers: { 'cf-connecting-ip': '203.0.113.1' },
  });
  assert.strictEqual(localSub.status, 400);

  // 3. proxySubtitle refuse une redirection 302 vers localhost (SSRF bypass)
  const redirSub = await fetch(`${b}/proxy/subtitle?url=${encodeURIComponent(f + '/redirect-to-local')}`);
  assert.strictEqual(redirSub.status, 502);

  // 4. proxyStream via tunnel refuse une redirection 302 vers une cible locale
  const redirStream = await fetch(`${b}/proxy/stream?url=${encodeURIComponent(f + '/redirect-to-local')}`, {
    headers: { 'cf-connecting-ip': '203.0.113.1' },
  });
  assert.ok([400, 502].includes(redirStream.status), 'bloqué avec 400 ou 502');

  // 5. proxyStream assainit les sauts de ligne CRLF dans le filename de téléchargement
  const dlRes = await fetch(`${b}/proxy/stream?url=${encodeURIComponent(f + '/multi.mkv')}&download=1&filename=mon%0d%0atitre.mp4`);
  assert.strictEqual(dlRes.status, 200);
  const cd = dlRes.headers.get('content-disposition');
  assert.ok(cd && !cd.includes('\r') && !cd.includes('\n'), 'pas de CRLF dans Content-Disposition');
});

// ------------------------------------------- Intégration : torrent réel (pair local)

test('streaming torrent réel : pair local → 200 / 206 / suffixe / 416 / HEAD / erreurs', async (t) => {
  if (!ffmpegOk) return t.skip('ffmpeg indisponible (fichier de test non généré)');
  const source = fs.readFileSync(webmPath);

  // Pair « seeder » local, sans DHT ni tracker
  seeder = new WebTorrent({ dht: false, tracker: false, lsd: false, utp: false, torrentPort: 0 } as any);
  const torrent: any = await new Promise((resolve) => seeder!.seed(webmPath, { name: 'clip.webm' } as any, resolve));
  const seedPort: number = await new Promise((resolve) => {
    const read = () => {
      const port = (seeder as any).torrentPort;
      port ? resolve(port) : setTimeout(read, 25);
    };
    read();
  });
  const magnet = `magnet:?xt=urn:btih:${torrent.infoHash}&dn=clip&x.pe=127.0.0.1:${seedPort}`;

  leecher = new TorrentEngine({ dht: false, tracker: false, lsd: false, utp: false });
  const app = express();
  app.get('/stream', (req, res) => leecher!.handleStream(req, res));
  app.head('/stream', (req, res) => leecher!.handleStream(req, res));
  app.get('/stats', (req, res) => res.json(leecher!.getStats(String(req.query.magnet))));
  torrentServer = await listen(app);
  const url = `${base(torrentServer)}/stream?magnet=${encodeURIComponent(magnet)}`;

  // Plusieurs requêtes simultanées avant que le torrent soit prêt (comportement réel du navigateur)
  const [first, second, third] = await Promise.all([
    fetch(url, { headers: { Range: 'bytes=0-' } }),
    fetch(url, { headers: { Range: 'bytes=0-99' } }),
    fetch(url, { method: 'HEAD' }),
  ]);
  assert.strictEqual(first.status, 206);
  assert.strictEqual(first.headers.get('content-type'), 'video/webm');
  assert.strictEqual(first.headers.get('accept-ranges'), 'bytes');
  assert.ok(Buffer.from(await first.arrayBuffer()).equals(source), 'contenu complet identique à la source');
  assert.strictEqual(second.status, 206);
  assert.strictEqual(second.headers.get('content-range'), `bytes 0-99/${source.length}`);
  assert.ok(Buffer.from(await second.arrayBuffer()).equals(source.subarray(0, 100)));
  assert.strictEqual(third.status, 200);
  assert.strictEqual(third.headers.get('content-length'), String(source.length));
  assert.strictEqual((await third.arrayBuffer()).byteLength, 0, 'HEAD sans corps');

  const full = await fetch(url);
  assert.strictEqual(full.status, 200);
  assert.ok(Buffer.from(await full.arrayBuffer()).equals(source));

  const tail = await fetch(url, { headers: { Range: 'bytes=-50' } });
  assert.strictEqual(tail.status, 206);
  assert.ok(Buffer.from(await tail.arrayBuffer()).equals(source.subarray(source.length - 50)));

  const beyond = await fetch(url, { headers: { Range: `bytes=${source.length + 10}-` } });
  assert.strictEqual(beyond.status, 416);
  assert.strictEqual(beyond.headers.get('content-range'), `bytes */${source.length}`);

  const clamped = await fetch(url, { headers: { Range: `bytes=${source.length - 10}-999999999` } });
  assert.strictEqual(clamped.status, 206);
  assert.strictEqual((await clamped.arrayBuffer()).byteLength, 10);

  // Entrées invalides
  const b = base(torrentServer);
  assert.strictEqual((await fetch(`${b}/stream`)).status, 400);
  assert.strictEqual((await fetch(`${b}/stream?magnet=n-importe-quoi`)).status, 400);
  assert.strictEqual((await fetch(`${url}&fileIndex=-1`)).status, 400);
  assert.strictEqual((await fetch(`${url}&fileIndex=abc`)).status, 400);
  // Index hors limites : repli sur le meilleur fichier vidéo plutôt qu'une erreur
  assert.strictEqual((await fetch(`${url}&fileIndex=99`, { headers: { Range: 'bytes=0-9' } })).status, 206);

  // Statistiques exposées pour le badge P2P
  const stats: any = await (await fetch(`${b}/stats?magnet=${encodeURIComponent(magnet)}`)).json();
  assert.strictEqual(stats.ready, true);
  assert.strictEqual(stats.total, source.length);
  assert.deepStrictEqual(stats.files, [{ index: 0, name: 'clip.webm', length: source.length, isVideo: true }]);

  // Coupure client pendant un transfert : le serveur doit rester sain
  const controller = new AbortController();
  const aborted = fetch(url, { signal: controller.signal }).then((r) => r.arrayBuffer()).catch(() => 'aborted');
  controller.abort();
  await aborted;
  assert.strictEqual((await fetch(url, { headers: { Range: 'bytes=0-9' } })).status, 206);
});

test('torrent : délai dépassé si aucun pair, sans fuite ni crash', async () => {
  const engine = new TorrentEngine();
  try {
    await assert.rejects(engine.getOrAddTorrent(`magnet:?xt=urn:btih:${'ab'.repeat(20)}`, 600), /Délai d'attente/);
    assert.strictEqual(engine.getStats('ab'.repeat(20)), null, 'torrent abandonné retiré du client');
    await assert.rejects(engine.getOrAddTorrent('pas-un-magnet'), /invalide/);
  } finally {
    await engine.destroy();
  }
});
