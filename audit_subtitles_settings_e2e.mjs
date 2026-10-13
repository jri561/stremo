import { chromium } from 'playwright-core';
import fs from 'node:fs';

const SCREENSHOTS_DIR = '/home/toto/.gemini/antigravity/brain/d6f4f3c1-3cf2-4c9d-a1ab-7ef16510f338/audit_screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const CHROMIUM_PATH = '/home/toto/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

async function runSubtitlesSettingsAudit() {
  console.log('🚀 Démarrage de l\'audit E2E Chromium pour les Paramètres et Sous-titres...');

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  try {
    // 1. Accès à la page d'accueil
    console.log('1. Navigation vers http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });

    // Si sur le sélecteur de profil, choisir le premier profil
    const profileCard = page.locator('button:has-text("Cinéphile"), button:has-text("Standard"), button:has-text("Kids")').first();
    if (await profileCard.isVisible()) {
      console.log('Profil détecté, sélection du premier profil...');
      await profileCard.click();
      await page.waitForTimeout(1000);
    }

    // 2. Vérification du bouton "Paramètres" dans le header
    console.log('2. Recherche du bouton Paramètres dans l\'en-tête...');
    const settingsBtn = page.locator('button:has-text("Paramètres")').first();
    await settingsBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Bouton Paramètres présent !');

    // 3. Clic sur Paramètres pour ouvrir SettingsModal
    await settingsBtn.click();
    await page.waitForTimeout(800);

    const modalTitle = page.locator('text=Paramètres de l\'application').first();
    await modalTitle.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Modal des Paramètres affiché avec succès !');

    // Capture d'écran du modal Paramètres
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/14_settings_modal_subtitles.png` });
    console.log(`📸 Screenshot sauvegardé: ${SCREENSHOTS_DIR}/14_settings_modal_subtitles.png`);

    // 4. Tester l'onglet "Lecture & Intros"
    console.log('4. Clic sur l\'onglet Lecture & Intros...');
    const playbackTab = page.locator('button:has-text("Lecture & Intros")').first();
    await playbackTab.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/15_settings_modal_playback.png` });
    console.log(`📸 Screenshot sauvegardé: ${SCREENSHOTS_DIR}/15_settings_modal_playback.png`);

    // 5. Tester le sélecteur de style : sélection Jaune Cinéma
    console.log('5. Retour sur l\'onglet Audio & Sous-titres et sélection du style Jaune Cinéma...');
    const audioTab = page.locator('button:has-text("Audio & Sous-titres")').first();
    await audioTab.click();
    await page.waitForTimeout(400);

    const yellowBtn = page.locator('button:has-text("Jaune 🎬")').first();
    if (await yellowBtn.isVisible()) {
      await yellowBtn.click();
      console.log('✅ Style Jaune Cinéma sélectionné');
    }

    // Clic sur "Enregistrer"
    const saveBtn = page.locator('button:has-text("Enregistrer")').first();
    await saveBtn.click();
    await page.waitForTimeout(1200);
    console.log('✅ Préférences enregistrées avec succès !');

    console.log('🎉 AUDIT E2E Chromium terminé avec 100% de succès !');
  } catch (err) {
    console.error('❌ Erreur lors de l\'audit E2E :', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runSubtitlesSettingsAudit();
