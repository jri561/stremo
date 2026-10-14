import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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

test('Packaging final: scripts npm build:apk et build:desktop configurés et livrables valides', () => {
  const rootPkgPath = path.resolve(rootDir, 'package.json');
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));

  assert.ok(rootPkg.scripts['build:apk'], 'Script build:apk requis');
  assert.ok(rootPkg.scripts['build:desktop'], 'Script build:desktop requis');

  // Livrable Linux
  const linuxDistArchive = path.resolve(rootDir, 'dist-linux/stremo-linux-x64-v1.0.0.tar.gz');
  const linuxChecksum = path.resolve(rootDir, 'dist-linux/stremo-linux-x64-v1.0.0.tar.gz.sha256');
  if (!fs.existsSync(linuxDistArchive)) {
    execSync('npm run build:desktop', { cwd: rootDir, stdio: 'pipe' });
  }
  assert.ok(fs.existsSync(linuxDistArchive), 'stremo-linux-x64-v1.0.0.tar.gz doit exister');
  assert.ok(fs.existsSync(linuxChecksum), 'Checksum SHA-256 Linux doit exister');
  assert.ok(fs.statSync(linuxDistArchive).size > 100000, 'L\'archive Linux doit contenir les binaires');

  // Livrable Android / Android TV APK
  const apkUniversal = path.resolve(rootDir, 'dist-android/stremo-v1.0.0-universal.apk');
  const apkTv = path.resolve(rootDir, 'dist-android/stremo-android-tv-v1.0.0.apk');
  const apkRelease = path.resolve(rootDir, 'android/app/build/outputs/apk/release/app-release.apk');
  const apkChecksum = path.resolve(rootDir, 'dist-android/stremo-v1.0.0-universal.apk.sha256');
  if (!fs.existsSync(apkUniversal)) {
    execSync('npm run build:apk', { cwd: rootDir, stdio: 'pipe' });
  }

  assert.ok(fs.existsSync(apkUniversal), 'stremo-v1.0.0-universal.apk doit exister');
  assert.ok(fs.existsSync(apkTv), 'stremo-android-tv-v1.0.0.apk doit exister');
  assert.ok(fs.existsSync(apkRelease), 'app-release.apk doit exister');
  assert.ok(fs.existsSync(apkChecksum), 'Checksum SHA-256 APK doit exister');
  assert.ok(fs.statSync(apkUniversal).size > 100000, 'L\'APK doit contenir les assets et manifestes');
});

test('GitHub Actions CI/CD: workflows de validation et de release automatisée configurés', () => {
  const ciPath = path.resolve(rootDir, '.github/workflows/ci.yml');
  const releasePath = path.resolve(rootDir, '.github/workflows/release.yml');

  assert.ok(fs.existsSync(ciPath), 'Workflow ci.yml doit exister');
  assert.ok(fs.existsSync(releasePath), 'Workflow release.yml doit exister');

  const ciContent = fs.readFileSync(ciPath, 'utf-8');
  assert.ok(ciContent.includes('push:'), 'Déclencheur push requis dans ci.yml');
  assert.ok(ciContent.includes('pull_request:'), 'Déclencheur pull_request requis dans ci.yml');
  assert.ok(ciContent.includes('npm test'), 'Vérification npm test requise dans CI');
  assert.ok(ciContent.includes('npm run build:apk'), 'Vérification build:apk requise dans CI');
  assert.ok(ciContent.includes('npm run build:desktop'), 'Vérification build:desktop requise dans CI');

  const releaseContent = fs.readFileSync(releasePath, 'utf-8');
  assert.ok(releaseContent.includes("tags:"), 'Déclencheur par tag requis dans release.yml');
  assert.ok(releaseContent.includes("v*"), 'Filtre de tag v* requis');
  assert.ok(releaseContent.includes('workflow_dispatch:'), 'Déclencheur manuel workflow_dispatch requis');
  assert.ok(releaseContent.includes('contents: write'), 'Permission contents: write requise pour publier la release');
  assert.ok(releaseContent.includes('package-apk.py'), 'Appel au packager APK requis');
  assert.ok(releaseContent.includes('package-linux.sh'), 'Appel au packager Linux requis');
  assert.ok(releaseContent.includes('sha256sum -c'), 'Vérification intégrité SHA-256 requise');
  assert.ok(releaseContent.includes('gh release create'), 'Publication gh release requise');
});

test('Android TV & HDMI-CEC: support matériel déclaré dans AndroidManifest.xml', () => {
  const androidManifestPath = path.resolve(rootDir, 'android/app/src/main/AndroidManifest.xml');
  const content = fs.readFileSync(androidManifestPath, 'utf-8');

  assert.ok(content.includes('android.hardware.hdmi.cec'), 'Fonctionnalité android.hardware.hdmi.cec requise');
  assert.ok(content.includes('android.intent.action.MEDIA_BUTTON'), 'Filtre d\'intention MEDIA_BUTTON requis');
});


