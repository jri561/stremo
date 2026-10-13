import { chromium } from 'playwright-core';
import fs from 'node:fs';

const SCREENSHOTS_DIR = '/home/toto/.gemini/antigravity/brain/d6f4f3c1-3cf2-4c9d-a1ab-7ef16510f338/audit_screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const CHROMIUM_PATH = '/home/toto/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

async function runStartupProfilesAudit() {
  console.log('🚀 Test de l\'écran de démarrage "Qui regarde ?" et de la sélection de profil...');

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
    // 1. Navigation directe vers l'application (comme si l'utilisateur l'allumait)
    console.log('1. Lancement de l\'application sur http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });

    // 2. Vérifier que l'écran "Qui regarde ?" est affiché avec la liste des profils
    console.log('2. Vérification que "Qui regarde ?" est le premier écran avec les profils...');
    const heading = page.locator('text=Qui regarde ?').first();
    await heading.waitFor({ state: 'visible', timeout: 5000 });

    // Vérifier la présence des profils (Principal, Secondaire, Enfants...)
    const principalCard = page.locator('button:has-text("Principal")').first();
    await principalCard.waitFor({ state: 'visible', timeout: 5000 });

    const enfantsCard = page.locator('button:has-text("Enfants")').first();
    await enfantsCard.waitFor({ state: 'visible', timeout: 5000 });

    // Capture d'écran du premier écran de démarrage
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/19_startup_profiles_selection_screen.png` });
    console.log('📸 Capture 19 enregistrée : 19_startup_profiles_selection_screen.png');

    // 3. Cliquer sur un profil (ex: Principal)
    console.log('3. Sélection du profil "Principal"...');
    await principalCard.click();
    await page.waitForTimeout(1000);

    // 4. Vérifier qu'on entre bien dans l'application avec ce profil
    const heroTitle = page.locator('button[title*="Profil actif"]').first();
    await heroTitle.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Entrée réussie dans l\'application avec le profil sélectionné !');

    // Capture d'écran de l'application après sélection du profil
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/20_after_profile_selected_dashboard.png` });
    console.log('📸 Capture 20 enregistrée : 20_after_profile_selected_dashboard.png');

    // 5. Test du verrouillage PIN : Retourner sur "Qui regarde ?"
    console.log('5. Test du code PIN sur l\'écran "Qui regarde ?"...');
    await heroTitle.click();
    await page.waitForTimeout(400);
    const selectorOption = page.locator('button:has-text("Écran de sélection")').first();
    await selectorOption.click();
    await page.waitForTimeout(800);

    // Mettre un code PIN sur le profil Alex Aventure via "Gérer les profils"
    const manageBtn = page.locator('button:has-text("Gérer les profils")').first();
    await manageBtn.click();
    await page.waitForTimeout(400);

    const alexCard = page.locator('button:has-text("Alex Aventure")').first();
    await alexCard.click();
    await page.waitForTimeout(500);

    // Renseigner un PIN 1234
    const pinInput = page.locator('input[placeholder*="Laisser vide pour ne pas verrouiller"]').first();
    await pinInput.waitFor({ state: 'visible', timeout: 5000 });
    await pinInput.fill('1234');
    const saveBtn = page.locator('button:has-text("Enregistrer les modifications")').first();
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // Quitter le mode gestion
    const finishBtn = page.locator('button:has-text("Terminé")').first();
    await finishBtn.click();
    await page.waitForTimeout(400);

    // Cliquer sur "Alex Aventure" -> La modale PIN DOIT apparaître
    await alexCard.click();
    await page.waitForTimeout(400);

    const pinModalTitle = page.locator('text=Profil Protégé').first();
    await pinModalTitle.waitFor({ state: 'visible', timeout: 4000 });
    console.log('✅ Modale PIN affichée avec succès sur l\'écran "Qui regarde ?" !');

    // Saisir le PIN 1234
    await page.fill('input[placeholder="Code PIN..."]', '1234');
    await page.click('button:has-text("Déverrouiller")');
    await page.waitForTimeout(800);

    // Vérifier l'entrée réussie dans le profil Alex Aventure
    const activeAlex = page.locator('button[title*="Alex Aventure"]').first();
    await activeAlex.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Profil protégé par PIN déverrouillé et actif !');

    console.log('🎉 Test de démarrage "Qui regarde ?" et contrôle PIN validés avec succès à 100% !');
  } catch (err) {
    console.error('❌ Erreur durant le test :', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runStartupProfilesAudit();
