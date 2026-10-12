import express from 'express';
import cors from 'cors';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { DatabaseManager } from './db.js';
import { AddonClient, maskAddonUrl, isSafePlayableUrl, normalizePoster } from './addonClient.js';

const app = express();
const port = process.env.PORT || 3001;
const db = new DatabaseManager();

app.use(cors());
app.use(express.json());

// Clé d'accès optionnelle (recommandée si l'application est exposée via un tunnel public)
const accessKey = process.env.STREMO_ACCESS_KEY;
if (!accessKey) console.warn('⚠️  STREMO_ACCESS_KEY non défini : API ouverte à quiconque connaît l\'URL.');
app.use('/api', (req, res, next) => {
  if (!accessKey || req.path === '/auth-check') return next();
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
    const { name, avatar, isKids, pin } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    const profile = db.createProfile(name, avatar || 'user', isKids ? 1 : 0, pin);
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/profiles/:id', (req, res) => {
  try {
    const { name, avatar, isKids, pin } = req.body;
    const updated = db.updateProfile(req.params.id, {
      name,
      avatar,
      isKids: isKids !== undefined ? (isKids ? 1 : 0) : undefined,
      pin: pin !== undefined ? (pin ? String(pin) : null) : undefined,
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
    const { backup } = req.body;
    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ success: false, error: 'Données de sauvegarde invalides' });
    }
    const result = db.importData(backup);
    res.json({ success: true, result });
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
