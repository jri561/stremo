import { chromium } from 'playwright-core';
import fs from 'node:fs';

const SCREENSHOTS_DIR = '/home/toto/.gemini/antigravity/brain/d6f4f3c1-3cf2-4c9d-a1ab-7ef16510f338/audit_screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const CHROMIUM_PATH = '/home/toto/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

async function runProfilesCustomizationAudit() {
  console.log('🚀 Démarrage de l\'audit E2E Chromium pour la personnalisation des profils...');

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
    // 1. Navigation vers l'application
    console.log('1. Navigation vers http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });

    // Si on est déjà sur le dashboard avec un profil actif, basculer sur l'écran de sélection de profils
    const profileHeaderBtn = page.locator('button[title*="Profil actif"]').first();
    if (await profileHeaderBtn.isVisible()) {
      console.log('Profil actif présent, ouverture du menu profil pour revenir sur l\'écran de sélection...');
      await profileHeaderBtn.click();
      await page.waitForTimeout(400);

      const selectorOption = page.locator('button:has-text("Écran de sélection")').first();
      await selectorOption.click();
      await page.waitForTimeout(800);
    }

    // 2. Vérification de l'écran "Qui regarde ?" avec les profils personnalisés
    console.log('2. Vérification de l\'écran de sélection des profils...');
    const heading = page.locator('text=Qui regarde ?').first();
    await heading.waitFor({ state: 'visible', timeout: 5000 });

    // Capture 16 : Écran de sélection des profils
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/16_profiles_selector_customized.png` });
    console.log('📸 Capture 16 enregistrée : 16_profiles_selector_customized.png');

    // 3. Clic sur "Ajouter un profil"
    console.log('3. Ouverture du ProfileModal en mode création...');
    const addProfileBtn = page.locator('button:has-text("Ajouter un profil")').first();
    await addProfileBtn.click();
    await page.waitForTimeout(600);

    const modalTitle = page.locator('text=Créer un nouveau profil').first();
    await modalTitle.waitFor({ state: 'visible', timeout: 5000 });

    // Remplir le nom
    await page.fill('input[placeholder*="Alexandre"]', 'Alex Aventure');

    // Cliquer sur le thème Cyan Néon
    const cyanThemeBtn = page.locator('button[title*="Cyan"]').first();
    if (await cyanThemeBtn.isVisible()) {
      await cyanThemeBtn.click();
    }

    // Naviguer vers l'onglet "Aventure & Héros"
    const adventureTab = page.locator('button:has-text("Aventure & Héros")').first();
    if (await adventureTab.isVisible()) {
      await adventureTab.click();
      await page.waitForTimeout(300);
    }

    // Choisir l'avatar "Astronaute"
    const rocketAvatarBtn = page.locator('button:has-text("Astronaute")').first();
    if (await rocketAvatarBtn.isVisible()) {
      await rocketAvatarBtn.click();
    }

    // Capture 17 : ProfileModal avec choix d'avatars et de thèmes
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/17_profile_create_modal_avatars_and_themes.png` });
    console.log('📸 Capture 17 enregistrée : 17_profile_create_modal_avatars_and_themes.png');

    // Sauvegarder le nouveau profil
    const submitBtn = page.locator('button:has-text("Créer le profil")').first();
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // 4. Vérification que l'utilisateur est connecté et dans le dashboard
    console.log('4. Vérification du profil actif dans l\'en-tête...');
    const activeHeaderBtn = page.locator('button[title*="Profil actif"]').first();
    await activeHeaderBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Clic pour ouvrir le menu profil
    await activeHeaderBtn.click();
    await page.waitForTimeout(500);

    // Capture 18 : Menu profil du header avec avatar et couleurs
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/18_profile_header_menu_customized.png` });
    console.log('📸 Capture 18 enregistrée : 18_profile_header_menu_customized.png');

    console.log('🎉 Audit E2E Profils & Personnalisation validé avec succès !');
  } catch (err) {
    console.error('❌ Erreur durant l\'audit E2E :', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runProfilesCustomizationAudit();
