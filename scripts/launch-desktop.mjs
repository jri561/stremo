#!/usr/bin/env node
/**
 * Stremo Desktop Launcher
 * Démarre Stremo dans une fenêtre d'application native dédiée avec accélération matérielle,
 * sans barre d'adresse ni onglets de navigateur, compatible Linux / macOS / Windows.
 */

import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_DIR = path.resolve(__dirname, '..');

const CLIENT_PORT = 5173;
const SERVER_PORT = 3001;

const hasBuiltDist = fs.existsSync(path.join(PROJECT_DIR, 'client', 'dist', 'index.html'));
const TARGET_PORT = hasBuiltDist ? SERVER_PORT : CLIENT_PORT;
const APP_URL = `http://localhost:${TARGET_PORT}`;

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      resolve(true);
      req.destroy();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function findBrowserBinary() {
  const platform = os.platform();
  const candidates = [];

  if (platform === 'linux') {
    candidates.push(
      'google-chrome-stable',
      'google-chrome',
      'chromium',
      'chromium-browser',
      'brave-browser',
      'microsoft-edge-stable',
      'microsoft-edge',
      'vivaldi'
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    candidates.push(
      `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
      `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
      `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${programFiles}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`
    );
  }

  for (const bin of candidates) {
    try {
      if (platform === 'linux') {
        const which = execSync(`which ${bin} 2>/dev/null`).toString().trim();
        if (which) return which;
      } else {
        return bin;
      }
    } catch {
      // Continuer la recherche
    }
  }

  return null;
}

async function main() {
  console.log(`🎬 Démarrage de Stremo en mode Application Desktop (${hasBuiltDist ? 'Production intégrée' : 'Développement'})...`);

  const serverReady = await checkPort(SERVER_PORT);

  if (!serverReady) {
    console.log('⚡ Démarrage du serveur backend (Express)...');
    spawn('npm', ['run', 'start', '--prefix', 'server'], { stdio: 'inherit', shell: true });
  }

  if (!hasBuiltDist) {
    const clientReady = await checkPort(CLIENT_PORT);
    if (!clientReady) {
      console.log('⚡ Démarrage du client web (Vite)...');
      spawn('npm', ['run', 'dev', '--prefix', 'client'], { stdio: 'inherit', shell: true });
    }
  }

  // Attendre que le port cible soit prêt
  let attempts = 0;
  while (attempts < 20) {
    const ready = await checkPort(TARGET_PORT);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 400));
    attempts++;
  }

  const browserBin = findBrowserBinary();

  if (browserBin) {
    console.log(`🚀 Lancement de la fenêtre native Stremo via : ${browserBin}`);
    const args = [
      `--app=${APP_URL}`,
      '--window-size=1366,860',
      '--window-position=center',
      '--class=stremo',
      '--name=Stremo',
      '--enable-features=VaapiVideoDecoder,CanvasOopRasterization',
      '--autoplay-policy=no-user-gesture-required',
    ];

    const child = spawn(browserBin, args, { detached: true, stdio: 'ignore' });
    child.unref();
    console.log('✨ Stremo est ouvert dans votre fenêtre d\'application native !');
  } else {
    console.log(`🌐 Navigateur Chromium non trouvé pour le mode fenêtre, ouverture de l'URL : ${APP_URL}`);
    const openCmd = os.platform() === 'darwin' ? 'open' : os.platform() === 'win32' ? 'start' : 'xdg-open';
    spawn(openCmd, [APP_URL], { detached: true, stdio: 'ignore' }).unref();
  }
}

main().catch((err) => {
  console.error('Erreur au lancement desktop:', err);
  process.exit(1);
});
