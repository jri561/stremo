import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = fs.existsSync(path.resolve(process.cwd(), 'stremo.desktop'))
  ? process.cwd()
  : path.resolve(process.cwd(), '..');
const clientDir = path.resolve(rootDir, 'client');

test('PWA Manifest: conforme aux exigences d\'installation PWA (Android / Desktop)', () => {
  const manifestPath = path.resolve(clientDir, 'public/manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest doit exister');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.equal(manifest.name, 'Stremo - Votre Cinéma Privé');
  assert.equal(manifest.short_name, 'Stremo');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');

  // Vérification de la présence des icônes obligatoires PWA
  const icons = manifest.icons || [];
  const sizes = icons.map((i: any) => i.sizes);
  assert.ok(sizes.includes('192x192'), 'Icône 192x192 requise');
  assert.ok(sizes.includes('512x512'), 'Icône 512x512 requise');

  const maskable = icons.find((i: any) => i.purpose?.includes('maskable'));
  assert.ok(maskable, 'Icône maskable requise pour Android');

  // Raccourcis PWA
  assert.ok(Array.isArray(manifest.shortcuts), 'Shortcuts PWA définis');
  assert.ok(manifest.shortcuts.length >= 2, 'Au moins 2 raccourcis rapides');
});

test('Android & Android TV: Manifeste Android natif configuré pour Leanback et Mobile', () => {
  const androidManifestPath = path.resolve(rootDir, 'android/app/src/main/AndroidManifest.xml');
  assert.ok(fs.existsSync(androidManifestPath), 'AndroidManifest.xml doit exister');

  const content = fs.readFileSync(androidManifestPath, 'utf-8');

  // Vérifications Android TV
  assert.ok(content.includes('android.software.leanback'), 'Support Leanback déclaré');
  assert.ok(content.includes('android.hardware.touchscreen') && content.includes('android:required="false"'), 'Écran tactile non requis pour TV');
  assert.ok(content.includes('android.intent.category.LEANBACK_LAUNCHER'), 'Launcher Android TV déclaré');
  assert.ok(content.includes('android:banner="@drawable/banner"'), 'Bannière Android TV 320x180 déclarée');

  // Vérifications Smartphone Android
  assert.ok(content.includes('android.intent.category.LAUNCHER'), 'Launcher standard smartphone déclaré');
  assert.ok(content.includes('android.permission.INTERNET'), 'Permission INTERNET déclarée');
});

test('Linux Desktop: Entrée .desktop et scripts de packaging fonctionnels', () => {
  const desktopFilePath = path.resolve(rootDir, 'stremo.desktop');
  assert.ok(fs.existsSync(desktopFilePath), 'stremo.desktop doit exister');

  const content = fs.readFileSync(desktopFilePath, 'utf-8');
  assert.ok(content.includes('[Desktop Entry]'));
  assert.ok(content.includes('Name=Stremo'));
  assert.ok(content.includes('Categories=AudioVideo;'));

  // Scripts de packaging et installation
  const installScript = path.resolve(rootDir, 'scripts/install-linux.sh');
  const packageScript = path.resolve(rootDir, 'scripts/package-linux.sh');
  const launcherBin = path.resolve(rootDir, 'bin/stremo');

  assert.ok(fs.existsSync(installScript), 'scripts/install-linux.sh doit exister');
  assert.ok(fs.existsSync(packageScript), 'scripts/package-linux.sh doit exister');
  assert.ok(fs.existsSync(launcherBin), 'bin/stremo doit exister');
});
