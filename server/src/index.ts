import express from 'express';
import cors from 'cors';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { DatabaseManager } from './db.js';
import { AddonClient, maskAddonUrl, isSafePlayableUrl, normalizePoster } from './addonClient.js';
import { proxyStream, proxySubtitle, getSkipTimes } from './streamProxy.js';
import { notifyPairSuccess, handlePairSse, handleRemoteCommand, handleLanAnnounce, handleGetLanDevices } from './syncEvents.js';

const app = express();
const port = process.env.PORT || 3001;
const db = new DatabaseManager();

app.use(cors());
app.use(express.json());

// Clé d'accès optionnelle (recommandée si l'application est exposée via un tunnel public)
const accessKey = process.env.STREMO_ACCESS_KEY;
if (!accessKey) console.warn('⚠️  STREMO_ACCESS_KEY non défini : API ouverte à quiconque connaît l\'URL.');
app.use('/api', (req, res, next) => {
  if (
    !accessKey ||
    req.path === '/auth-check' ||
    req.path.startsWith('/proxy/') ||
    req.path.startsWith('/sync/pair/events/') ||
    req.path.startsWith('/sync/lan/')
  ) {
    return next();
  }
  if (req.header('x-stremo-key') === accessKey) return next();
  res.status(401).json({ success: false, error: 'Clé d\'accès requise' });
});
app.get('/api/auth-check', (req, res) => {
  res.json({ success: true, required: !!accessKey, ok: !accessKey || req.header('x-stremo-key') === accessKey });
});

// --- PROFILES ---
app.get('/api/profiles', (req, res) => {
  try {
    const profiles = db.getProfiles();
    res.json({ success: true, profiles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/profiles', (req, res) => {
  try {
    const { name, avatar, isKids, pin, preferredAudioLanguage, preferredSubtitleLanguage, subtitleMode } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    const profile = db.createProfile(name, avatar || 'user', isKids ? 1 : 0, pin, preferredAudioLanguage, preferredSubtitleLanguage, subtitleMode);
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/profiles/:id', (req, res) => {
  try {
    const { name, avatar, isKids, pin, preferredAudioLanguage, preferredSubtitleLanguage, subtitleMode } = req.body;
    const updated = db.updateProfile(req.params.id, {
      name,
      avatar,
      isKids: isKids !== undefined ? (isKids ? 1 : 0) : undefined,
      pin: pin !== undefined ? (pin ? String(pin) : null) : undefined,
      preferredAudioLanguage,
      preferredSubtitleLanguage,
      subtitleMode,
    });
    if (!updated) return res.status(404).json({ error: 'Profil non trouvé' });
    res.json({ success: true, profile: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/profiles/:id', (req, res) => {
  try {
    db.deleteProfile(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- WATCH PROGRESS / REPRISE DE LECTURE ---
app.get('/api/progress/:profileId', (req, res) => {
  try {
    const list = db.getWatchProgressList(req.params.profileId);
    res.json({ success: true, progress: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/progress/:profileId/:mediaId', (req, res) => {
  try {
    const item = db.getMediaProgress(req.params.profileId, req.params.mediaId);
    res.json({ success: true, progress: item || null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/progress', (req, res) => {
  try {
    const { profileId, mediaId, mediaType, title, poster, season, episode, currentTime, duration, completed } = req.body;
    if (!profileId || !mediaId) return res.status(400).json({ error: 'Champs manquants' });
    db.saveWatchProgress({
      profileId,
      mediaId,
      mediaType: mediaType || 'movie',
      title: title || 'Inconnu',
      poster,
      season,
      episode,
      currentTime: Number(currentTime) || 0,
      duration: Number(duration) || 0,
      completed: completed ? 1 : 0,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/progress/:profileId/:mediaId', (req, res) => {
  try {
    db.deleteWatchProgress(req.params.profileId, req.params.mediaId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- LIBRARY / FAVORIS ---
app.get('/api/library/:profileId', (req, res) => {
  try {
    const items = db.getLibrary(req.params.profileId);
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/library', (req, res) => {
  try {
    const { profileId, mediaId, mediaType, title, poster, year, genres } = req.body;
    if (!profileId || !mediaId) return res.status(400).json({ error: 'Champs manquants' });
    db.addToLibrary(profileId, mediaId, mediaType, title, poster, year, genres);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/library/:profileId/:mediaId', (req, res) => {
  try {
    db.removeFromLibrary(req.params.profileId, req.params.mediaId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ADDONS ---
app.get('/api/addons', async (req, res) => {
  try {
    const addons = await Promise.all(db.getAddons().map(async (a: any) => {
      let manifest: any = null;
      try {
        const m = await new AddonClient(a.url).getManifest();
        manifest = {
          version: m.version, description: m.description, logo: m.logo, types: m.types,
          catalogs: m.catalogs?.length ?? 0,
          resources: (m.resources || []).map(r => typeof r === 'string' ? r : r.name),
        };
      } catch { /* add-on injoignable */ }
      return { id: a.id, name: a.name, enabled: a.enabled, ...maskAddonUrl(a.url), manifest };
    }));
    res.json({ success: true, addons });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/addons', async (req, res) => {
  try {
    const { url } = req.body;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'URL http(s) requise' });
    const client = new AddonClient(url);
    const manifest = await client.getManifest();
    db.addAddon(manifest.id, manifest.name, url);
    res.json({ success: true, manifest: { id: manifest.id, name: manifest.name } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/addons/:id', (req, res) => {
  try {
    db.removeAddon(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- TRAKT.TV SCROBBLER & SYNC ---
app.get('/api/trakt/auth/:profileId', (req, res) => {
  try {
    const auth = db.getTraktAuth(req.params.profileId);
    res.json({ success: true, connected: !!auth, username: auth?.username || null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/trakt/auth/:profileId', (req, res) => {
  try {
    const { accessToken, refreshToken, expiresAt, username } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Token manquant' });
    db.saveTraktAuth(req.params.profileId, accessToken, refreshToken, expiresAt, username);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/trakt/auth/:profileId', (req, res) => {
  try {
    db.removeTraktAuth(req.params.profileId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/trakt/scrobble', async (req, res) => {
  try {
    const { profileId, action, mediaType, title, year, imdbId, season, episode, progress } = req.body;
    const auth = profileId ? db.getTraktAuth(profileId) : undefined;
    if (!auth || !auth.accessToken) {
      return res.json({ success: true, scrobbled: false, reason: 'Non connecté à Trakt' });
    }

    const traktEndpoint = action === 'start' ? 'start' : action === 'pause' ? 'pause' : 'stop';
    const payload: any = {
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
    };

    if (mediaType === 'series') {
      payload.show = { title, ids: imdbId ? { imdb: imdbId } : undefined };
      payload.episode = { season: Number(season) || 1, number: Number(episode) || 1 };
    } else {
      payload.movie = { title, year: Number(year) || undefined, ids: imdbId ? { imdb: imdbId } : undefined };
    }

    const traktRes = await fetch(`https://api.trakt.tv/scrobble/${traktEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': process.env.TRAKT_CLIENT_ID || 'd65e7514a04d3c32bb3f9df089aef411cb3a893cb9988b43343bb92b512e0f49',
        'Authorization': `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const traktData = await traktRes.json().catch(() => ({}));
    res.json({ success: traktRes.ok, scrobbled: traktRes.ok, traktResponse: traktData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- BACKUP & EXPORT/IMPORT ---
app.get('/api/backup/export', (req, res) => {
  try {
    const backup = db.exportData();
    res.json({ success: true, backup });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/backup/import', (req, res) => {
  try {
    const backup = req.body.backup || req.body;
    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ success: false, error: 'Données de sauvegarde invalides' });
    }
    const overwrite = req.body.overwrite === true;
    const result = db.importData(backup, overwrite);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- APPAIRAGE D'APPAREIL EXPRESS & SYNCHRONISATION MULTI-ÉCRANS ---
app.post('/api/sync/pair/create', (req, res) => {
  try {
    const { channelId } = req.body || {};
    const session = db.createPairSession(channelId);
    res.json({ success: true, code: session.code, expiresAt: session.expiresAt });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sync/pair/check/:code', (req, res) => {
  try {
    const code = req.params.code?.toUpperCase().trim();
    const session = db.getPairSession(code);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Code de session introuvable' });
    }
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sync/pair/authorize', (req, res) => {
  try {
    const { code, data, channelId } = req.body;
    if (!code || !data) {
      return res.status(400).json({ success: false, error: 'Code et données requis' });
    }
    const cleanCode = String(code).toUpperCase().trim();
    const success = db.authorizePairSession(cleanCode, data, channelId);
    if (!success) {
      return res.status(400).json({ success: false, error: 'Code expiré ou invalide' });
    }
    // Notification en temps réel vers l'écran TV récepteur via Server-Sent Events
    notifyPairSuccess(cleanCode, data);

    res.json({ success: true, message: 'Appareil appairé avec succès !' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Écoute en temps réel de l'appairage TV & télécommande mobile via Server-Sent Events (SSE)
app.get('/api/sync/pair/events/:code', handlePairSse);

// Envoi d'une commande télécommande mobile vers l'écran TV appairé
app.post('/api/sync/remote/:code', handleRemoteCommand);

// Découverte des appareils connectés sur le même réseau local (LAN discovery)
app.post('/api/sync/lan/announce', handleLanAnnounce);
app.get('/api/sync/lan/devices', handleGetLanDevices);

// --- PROXY DE STREAMING VIDÉO & SOUS-TITRES (CONTOURNEMENT CORS & RANGE REQUESTS) ---
app.get('/api/proxy/stream', proxyStream);
app.head('/api/proxy/stream', proxyStream);
app.get('/api/proxy/subtitle', proxySubtitle);

// --- TIMINGS EXACTS DE GÉNÉRIQUES (ANISKIP / COMMUNITY TIMINGS) ---
app.get('/api/skip-times/:type/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const season = req.query.season ? Number(req.query.season) : undefined;
    const episode = req.query.episode ? Number(req.query.episode) : undefined;
    const timings = await getSkipTimes(id, season, episode);
    res.json({ success: true, ...timings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sync/channel/push', (req, res) => {
  try {
    const { channelId, data, name } = req.body;
    if (!channelId || !data) {
      return res.status(400).json({ success: false, error: 'Identifiant de canal et données requis' });
    }
    const channel = db.saveSyncChannel(channelId, data, name);
    res.json({ success: true, channel });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sync/channel/pull/:channelId', (req, res) => {
  try {
    const channel = db.getSyncChannel(req.params.channelId);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Canal de synchronisation introuvable' });
    }
    res.json({ success: true, channel });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- VÉRIFICATION DU STATUT DEBRID (REAL-DEBRID & TORBOX) ---
app.post('/api/debrid/status', async (req, res) => {
  try {
    const { service = 'realdebrid', token } = req.body || {};
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token API Debrid requis' });
    }

    if (service === 'realdebrid') {
      const resp = await fetch('https://api.real-debrid.com/rest/10/user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: 'Jeton Real-Debrid invalide ou expiré' });
      }
      const data: any = await resp.json();
      const expirationDate = data.expiration ? new Date(data.expiration) : null;
      const daysLeft = expirationDate ? Math.max(0, Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
      return res.json({
        success: true,
        service: 'Real-Debrid',
        username: data.username,
        type: data.type,
        premium: data.type === 'premium',
        expiration: data.expiration,
        daysLeft,
        points: data.points,
      });
    }

    if (service === 'torbox') {
      const resp = await fetch('https://api.torbox.app/v1/api/user/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: 'Jeton Torbox invalide ou expiré' });
      }
      const data: any = await resp.json();
      return res.json({
        success: true,
        service: 'Torbox',
        data: data.data || data,
      });
    }

    return res.status(400).json({ success: false, error: 'Service debrid non supporté' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- STREMIO PROXY & AGGREGATION ---
// 1. Catalogs (tous les add-ons et catalogues en parallèle)
app.get('/api/catalogs', async (req, res) => {
  try {
    const { type = 'movie', genre, search, skip } = req.query as Record<string, string>;
    const addons = db.getAddons().filter(a => a.enabled);
    const extra: Record<string, string> = {};
    if (genre) extra.genre = genre;
    if (search) extra.search = search;
    if (skip) extra.skip = skip;

    const perAddon = await Promise.all(addons.map(async addon => {
      const client = new AddonClient(addon.url);
      try {
        const manifest = await client.getManifest();
        const defs = (manifest.catalogs || []).filter(c => {
          if (c.type !== type) return false;
          const supportsSearch = c.extraSupported?.includes('search') || c.extra?.some(e => e.name === 'search');
          if (search) return !!supportsSearch;
          // Catalogues exigeant un paramètre (ex. recherche obligatoire) : ignorés en accueil
          const requiredExtra = c.extraRequired?.length || c.extra?.some(e => e.isRequired);
          return !requiredExtra;
        });
        const settled = await Promise.allSettled(defs.map(async cat => {
          const metas = (await client.getCatalog(cat.type, cat.id, extra)).map(normalizePoster);
          return metas.length ? {
            addonId: manifest.id, addonName: manifest.name, catalogId: cat.id,
            catalogName: cat.name, type: cat.type, genres: cat.genres || [], metas,
          } : null;
        }));
        return settled.flatMap(r => (r.status === 'fulfilled' && r.value ? [r.value] : []));
      } catch (err: any) {
        console.warn(`Erreur add-on ${addon.name}:`, err.message);
        return [];
      }
    }));

    res.json({ success: true, catalogs: perAddon.flat() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Meta detail (premier add-on qui répond)
app.get('/api/meta/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const addons = db.getAddons().filter(a => a.enabled);
  for (const addon of addons) {
    try {
      const meta = await new AddonClient(addon.url).getMeta(type, id);
      if (meta) return res.json({ success: true, meta: normalizePoster(meta) });
    } catch { /* add-on suivant */ }
  }
  res.status(404).json({ success: false, error: 'Contenu non trouvé' });
});

// 3. Streams (en parallèle)
app.get('/api/streams/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const addons = db.getAddons().filter(a => a.enabled);
  const results = await Promise.allSettled(addons.map(async addon => {
    const streams = await new AddonClient(addon.url).getStreams(type, id);
    return streams.map(s => ({
      ...s,
      url: s.url || (s.infoHash ? `magnet:?xt=urn:btih:${s.infoHash}` : undefined),
      addonName: addon.name,
    }));
  }));
  res.json({ success: true, streams: results.flatMap(r => (r.status === 'fulfilled' ? r.value : [])) });
});

// 3b. Sous-titres (OpenSubtitles v3 etc.)
app.get('/api/subtitles/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const addons = db.getAddons().filter(a => a.enabled);
  const results = await Promise.allSettled(addons.map(async addon => {
    const subs = await new AddonClient(addon.url).getSubtitles(type, id);
    return subs.map(s => ({ ...s, addonName: addon.name }));
  }));
  res.json({ success: true, subtitles: results.flatMap(r => (r.status === 'fulfilled' ? r.value : [])) });
});

// 4. Lancement direct dans le lecteur local (VLC / MPV / Système par défaut sur Linux Desktop)
app.post('/api/play-external', (req, res) => {
  const { url, title, startTime, player = 'vlc' } = req.body;
  // Lancer un processus local n'est autorisé que depuis la machine elle-même (pas via le tunnel public)
  if (req.header('x-forwarded-for') || req.header('cf-connecting-ip') || req.header('x-forwarded-host')) {
    return res.status(403).json({ error: 'Lecteur externe réservé à l\'appareil local' });
  }
  if (!isSafePlayableUrl(url)) return res.status(400).json({ error: 'URL invalide (http, https ou magnet)' });
  if (!['vlc', 'mpv', 'system'].includes(player)) return res.status(400).json({ error: 'Lecteur inconnu' });

  let cmd = 'vlc';
  let args: string[] = [];

  if (player === 'mpv') {
    cmd = 'mpv';
    args.push(url);
    if (startTime && startTime > 0) {
      args.push(`--start=${Math.floor(startTime)}`);
    }
    if (title) {
      args.push(`--title=${String(title).slice(0, 200)}`);
    }
  } else if (player === 'system') {
    cmd = 'xdg-open';
    args = [url];
  } else {
    // VLC
    cmd = 'vlc';
    args.push(url);
    if (startTime && startTime > 0) {
      args.push(`--start-time=${Math.floor(startTime)}`);
    }
    if (title) {
      args.push(`--meta-title=${String(title).slice(0, 200)}`);
    }
  }

  try {
    const child = spawn(cmd, args, {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    res.json({ success: true, message: `Lecture lancée dans ${cmd}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Erreur lancement ${cmd}: ${err.message}` });
  }
});

// 5. Servir le frontend compilé (production unifiée)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
  console.log(`📦 Frontend servi depuis ${clientDistPath}`);
}

const host = '0.0.0.0';

app.listen(Number(port), host, () => {
  console.log(`🚀 Stremo Server actif sur http://${host}:${port}`);
});
