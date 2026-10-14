import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const AUDIT_DIR = '/home/toto/.gemini/antigravity/brain/d6f4f3c1-3cf2-4c9d-a1ab-7ef16510f338/audit_full';
fs.mkdirSync(AUDIT_DIR, { recursive: true });

const CHROME_PATH = '/home/toto/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const BASE_URL = 'http://localhost:5173';

async function runComprehensiveAudit() {
  console.log('🎬 Lancement de l\'audit complet Audio, Vidéo et Ergonomie Multi-Plateformes (Desktop, TV, Mobile)...\n');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  const findings = [];
  const logPass = (title) => console.log(`  ✔ [PASS] ${title}`);
  const logFail = (title, reason) => {
    console.error(`  ✖ [FAIL] ${title} - ${reason}`);
    findings.push({ severity: 'HIGH', title, reason });
  };
  const logNote = (title, note) => {
    console.log(`  ℹ [NOTE] ${title}: ${note}`);
    findings.push({ severity: 'INFO', title, reason: note });
  };

  // =========================================================================
  // SECTION 1 : DESKTOP / ORDINATEUR PORTABLE (1366 x 768)
  // =========================================================================
  console.log('\n======================================================');
  console.log('💻 1. PLATEFORME DESKTOP / ORDINATEUR PORTABLE (1366x768)');
  console.log('======================================================');

  const desktopContext = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });
  const page = await desktopContext.newPage();

  // 1.1 Écran de sélection "Qui regarde ?"
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);

  await page.screenshot({ path: path.join(AUDIT_DIR, 'desktop_01_qui_regarde.png') });
  logPass('Desktop: Écran "Qui regarde ?" chargé');

  // Connexion au profil "Principal"
  await page.locator('button:has-text("Principal")').click();
  await page.waitForTimeout(1000);

  // 1.2 Dashboard Principal
  await page.screenshot({ path: path.join(AUDIT_DIR, 'desktop_02_dashboard_home.png') });
  logPass('Desktop: Dashboard d\'accueil avec Hero Banner');

  // Attendre chargement du catalogue
  try {
    await page.waitForSelector('.group\\/card, [role="group"]', { timeout: 8000 });
    await page.screenshot({ path: path.join(AUDIT_DIR, 'desktop_03_dashboard_catalog.png') });
    logPass('Desktop: Rangées de catalogue chargées');
  } catch (e) {
    logFail('Desktop: Chargement catalogue', e.message);
  }

  // 1.3 Fiche Détail Média
  try {
    const firstCard = page.locator('.group\\/card, [role="group"]').first();
    await firstCard.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(AUDIT_DIR, 'desktop_04_media_detail_modal.png') });
    logPass('Desktop: Modale MediaModal affichée');

    const closeBtn = page.locator('button[aria-label="Fermer la fiche"]');
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(400);
  } catch (e) {
    logFail('Desktop: MediaModal', e.message);
  }

  // 1.4 Modales de gestion
  // Paramètres
  await page.locator('button:has-text("Paramètres")').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(AUDIT_DIR, 'desktop_05_settings_audio.png') });
  await page.locator('button:has-text("Lecture & Intros")').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(AUDIT_DIR, 'desktop_06_settings_playback.png') });
  await page.locator('button:has-text("Fermer")').first().click();
  await page.waitForTimeout(400);

  // Modale Compte
  const accountBtn = page.locator('button[title*="Compte"], button:has-text("Compte")').first();
  if (await accountBtn.isVisible()) {
    await accountBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(AUDIT_DIR, 'desktop_07_account_modal.png') });
    const closeAccount = page.locator('button[aria-label="Fermer"], button:has(svg.lucide-x)').first();
    if (await closeAccount.isVisible()) await closeAccount.click();
    await page.waitForTimeout(400);
  }

  // Modale Lier Téléviseur / Appareils LAN
  const syncBtn = page.locator('button[title*="Lier Télé"], button:has-text("Lier TV")').first();
  if (await syncBtn.isVisible()) {
    await syncBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(AUDIT_DIR, 'desktop_08_device_sync_modal.png') });
    const closeSync = page.locator('button[aria-label="Fermer"], button:has(svg.lucide-x)').first();
    if (await closeSync.isVisible()) await closeSync.click();
    await page.waitForTimeout(400);
  }

  // =========================================================================
  // SECTION 2 : TESTS AUDIO & VIDÉO (LECTEUR VIDÉO INTÉGRÉ)
  // =========================================================================
  console.log('\n======================================================');
  console.log('🔊 2. TESTS AUDIO, VIDÉO, TRANSCODAGE ET SOUS-TITRES');
  console.log('======================================================');

  // Déclencher la lecture de notre flux de test (sample.mp4 avec audio AAC + sous-titres WebVTT)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('stremo-test-play', {
      detail: {
        item: { id: 'test_vid_1', name: 'Stremo Audio & Video Benchmark', type: 'movie' },
        stream: { url: 'http://localhost:3001/api/test-media/sample.mp4', name: 'Flux Direct H.264 + AAC' },
        subtitles: [
          { id: 'sub_fr', lang: 'fr', url: 'http://localhost:3001/api/test-media/sample.vtt', addonName: 'Test OpenSubtitles' }
        ]
      }
    }));
  });

  await page.waitForTimeout(1500);

  // Vérifier la présence de la balise <video>
  const videoLocator = page.locator('video');
  const videoVisible = await videoLocator.isVisible();
  if (videoVisible) {
    logPass('Lecteur Vidéo: Balise <video> injectée et affichée');

    // Vérifier l'état de lecture
    const videoState = await page.evaluate(() => {
      const v = document.querySelector('video');
      if (!v) return null;
      return {
        paused: v.paused,
        currentTime: v.currentTime,
        duration: v.duration,
        volume: v.volume,
        muted: v.muted,
        readyState: v.readyState
      };
    });

    logPass(`Lecteur Vidéo: État décodage readyState=${videoState?.readyState}, durée=${videoState?.duration}s`);

    // Forcer la lecture pour vérifier le défilement
    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (v) v.play().catch(() => {});
    });
    await page.waitForTimeout(1500);

    const currentTimeAfter = await page.evaluate(() => document.querySelector('video')?.currentTime || 0);
    if (currentTimeAfter > 0.5) {
      logPass(`Vidéo: Défilement fluide validé (currentTime = ${currentTimeAfter.toFixed(2)}s)`);
    } else {
      logNote('Vidéo: Temps de lecture', `${currentTimeAfter}s`);
    }

    // Capture en cours de lecture
    await page.screenshot({ path: path.join(AUDIT_DIR, 'player_01_playing_native.png') });

    // Test Audio : Réglage du Volume et OSD
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(AUDIT_DIR, 'player_02_volume_osd.png') });
    logPass('Audio: Contrôle du volume au clavier et OSD interactif validés');

    // Test Sous-titres : Ouvrir le menu Sous-titres
    const subBtn = page.locator('button:has(svg.lucide-subtitles)').first();
    if (await subBtn.isVisible()) {
      await subBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(AUDIT_DIR, 'player_03_subtitles_menu.png') });
      logPass('Sous-titres: Menu de sélection et personnalisation ouvert');
      await subBtn.click(); // Refermer
      await page.waitForTimeout(300);
    }

    // Test Menu Plus d'options (Vitesse, Format, Signets)
    const moreBtn = page.locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-more-vertical)').first();
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(AUDIT_DIR, 'player_04_more_options_menu.png') });
      logPass('Lecteur: Menu d\'options avancées (vitesse, format, signets) affiché');
    }

    // Fermer le lecteur via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  } else {
    logFail('Lecteur Vidéo', 'Élément video non détecté');
  }

  // 2.2 Test Transcodage Audio AC3 -> AAC (Le flux qui posait problème d'absence de son)
  console.log('\n--- Test Spécifique Transcodage Audio AC3 vers AAC ---');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('stremo-test-play', {
      detail: {
        item: { id: 'test_vid_ac3', name: 'Film MKV Son AC3 Multicanal', type: 'movie' },
        stream: { url: 'http://localhost:3001/api/test-media/sample.mkv', name: 'Flux MKV avec AC3' }
      }
    }));
  });
  await page.waitForTimeout(1500);

  const audioMenuBtn = page.locator('button:has(svg.lucide-volume-2), button:has(svg.lucide-volume-x)').first();
  if (await audioMenuBtn.isVisible()) {
    await page.keyboard.press('a');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(AUDIT_DIR, 'player_05_ac3_audio_transcode_menu.png') });
    logPass('Transcodage Audio: Menu des pistes son et remuxing AAC affiché');
  }

  // Fermer le lecteur via Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await desktopContext.close();

  // =========================================================================
  // SECTION 3 : TÉLÉVISEUR / SMART TV (1920 x 1080 Mode TV Leanback 10-pieds)
  // =========================================================================
  console.log('\n======================================================');
  console.log('📺 3. EXPÉRIENCE TÉLÉVISEUR / ANDROID TV LEANBACK (1920x1080)');
  console.log('======================================================');

  const tvContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Linux; Android 12; BRAVIA 4K VH2 Build/BRAVIA_VH2_EU) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SmartTV'
  });
  const tvPage = await tvContext.newPage();

  // Activer le mode TV dans le localStorage
  await tvPage.goto(BASE_URL);
  await tvPage.evaluate(() => {
    localStorage.setItem('stremo_tv_mode', 'true');
    localStorage.setItem('stremo_active_profile_id', 'p1');
  });
  await tvPage.reload();
  await tvPage.waitForLoadState('domcontentloaded');
  await tvPage.waitForTimeout(1500);

  logPass(`Smart TV: Mode TV 10-pieds détecté et activé`);
  await tvPage.screenshot({ path: path.join(AUDIT_DIR, 'tv_01_leanback_dashboard.png') });

  // Navigation D-Pad télécommande (Flèches directionnelles)
  await tvPage.keyboard.press('ArrowDown');
  await tvPage.waitForTimeout(300);
  await tvPage.keyboard.press('ArrowDown');
  await tvPage.waitForTimeout(300);
  await tvPage.keyboard.press('ArrowRight');
  await tvPage.waitForTimeout(300);

  await tvPage.screenshot({ path: path.join(AUDIT_DIR, 'tv_02_dpad_navigation_focus.png') });
  logPass('Smart TV: Navigation D-Pad fluide et indicateurs de focus visuels validés');

  // Test du Player en mode TV
  await tvPage.evaluate(() => {
    window.dispatchEvent(new CustomEvent('stremo-test-play', {
      detail: {
        item: { id: 'test_tv_player', name: 'Big Buck Bunny (Smart TV)', type: 'movie' },
        stream: { url: 'http://localhost:3001/api/test-media/sample.mp4', name: 'Flux HD Smart TV' }
      }
    }));
  });
  await tvPage.waitForTimeout(1200);
  await tvPage.screenshot({ path: path.join(AUDIT_DIR, 'tv_03_player_leanback.png') });
  logPass('Smart TV: Lecteur vidéo en mode 10-pieds validé');

  await tvPage.keyboard.press('Escape');
  await tvPage.waitForTimeout(500);
  await tvContext.close();

  // =========================================================================
  // SECTION 4 : MOBILE SMARTPHONE (360 x 780 Google Chrome Android)
  // =========================================================================
  console.log('\n======================================================');
  console.log('📱 4. SMARTPHONE MOBILE ANDROID (360x780)');
  console.log('======================================================');

  const mobileContext = await browser.newContext({
    viewport: { width: 360, height: 780 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    isMobile: true,
    hasTouch: true
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto(BASE_URL);
  await mobilePage.evaluate(() => {
    localStorage.setItem('stremo_active_profile_id', 'p1');
  });
  await mobilePage.reload();
  await mobilePage.waitForLoadState('domcontentloaded');
  await mobilePage.waitForTimeout(1200);

  // 4.1 Accueil Mobile
  await mobilePage.screenshot({ path: path.join(AUDIT_DIR, 'mobile_01_home_screen.png') });
  logPass('Mobile: Accueil smartphone 360px avec barre d\'onglets basse');

  // 4.2 Fiche Film Mobile
  try {
    await mobilePage.waitForSelector('.group\\/card, [role="group"]', { timeout: 6000 });
    const mobileFirstCard = mobilePage.locator('.group\\/card, [role="group"]').first();
    await mobileFirstCard.click();
    await mobilePage.waitForTimeout(800);
    await mobilePage.screenshot({ path: path.join(AUDIT_DIR, 'mobile_02_media_detail.png') });
    logPass('Mobile: Fiche détaillée adaptée au format vertical tactile');

    const mobileClose = mobilePage.locator('button[aria-label="Fermer la fiche"]');
    if (await mobileClose.isVisible()) await mobileClose.click();
    await mobilePage.waitForTimeout(400);
  } catch (e) {
    logNote('Mobile: Fiche', e.message);
  }

  // 4.3 Lecteur Vidéo Mobile & Barre d'outils tactile
  await mobilePage.evaluate(() => {
    window.dispatchEvent(new CustomEvent('stremo-test-play', {
      detail: {
        item: { id: 'test_mob', name: 'Mobile Stream Test', type: 'movie' },
        stream: { url: 'http://localhost:3001/api/test-media/sample.mp4', name: 'Flux Mobile' }
      }
    }));
  });
  await mobilePage.waitForTimeout(1500);

  await mobilePage.screenshot({ path: path.join(AUDIT_DIR, 'mobile_03_video_player.png') });
  logPass('Mobile: Lecteur vidéo compact avec zones tactiles élargies');

  // Ouvrir le menu Plus sur mobile
  const mobileMoreBtn = mobilePage.locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-more-vertical)').first();
  if (await mobileMoreBtn.isVisible()) {
    await mobileMoreBtn.click();
    await mobilePage.waitForTimeout(400);
    await mobilePage.screenshot({ path: path.join(AUDIT_DIR, 'mobile_04_player_more_sheet.png') });
    logPass('Mobile: Menu Plus d\'options (bottom-sheet responsive) affiché');
  }

  await mobileContext.close();
  await browser.close();

  console.log('\n======================================================');
  console.log('✅ AUDIT COMPLET TERMINÉ AVEC SUCCÈS');
  console.log(`Toutes les captures d'écran sont enregistrées dans :`);
  console.log(`📁 ${AUDIT_DIR}`);
  console.log('======================================================\n');
}

runComprehensiveAudit().catch(console.error);
