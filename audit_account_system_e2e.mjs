import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS_DIR = '/home/toto/.gemini/antigravity/brain/d6f4f3c1-3cf2-4c9d-a1ab-7ef16510f338/audit_screenshots';
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const CHROMIUM_PATH = '/home/toto/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

async function run() {
  console.log('🚀 Démarrage de l\'audit E2E du système Multi-Comptes...');
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'fr-FR'
  });

  const page = await context.newPage();

  try {
    // 1. Accès à la page d'accueil (écran "Qui regarde ?")
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // 2. Vérification du bouton "Mon Compte"
    const accountBtn = page.locator('button:has-text("Mon Compte")');
    await accountBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Bouton "Mon Compte" présent sur l\'écran "Qui regarde ?"');

    // 3. Clic sur "Mon Compte" pour ouvrir la modale
    await accountBtn.click();
    await page.waitForTimeout(600);

    // Capture de la modale en mode Connexion
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '21_account_modal_login.png') });
    console.log('📸 Capture 21_account_modal_login.png enregistrée');

    // 4. Bascule vers l'onglet "Créer un compte"
    const registerTab = page.locator('button:has-text("Créer un compte")');
    await registerTab.click();
    await page.waitForTimeout(400);

    // Capture de l'onglet Inscription
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '22_account_modal_register.png') });
    console.log('📸 Capture 22_account_modal_register.png enregistrée');

    // 5. Inscription d'un nouvel utilisateur
    const uniqueUser = 'e2e_user_' + Date.now();
    await page.fill('input[placeholder="ex: alex_stream"]', uniqueUser);
    await page.fill('input[placeholder="alex@example.com"]', `${uniqueUser}@example.com`);
    await page.fill('input[placeholder="Min 6 car."]', 'password123');
    await page.fill('input[placeholder="Confirmer"]', 'password123');
    await page.fill('input[placeholder="ex: Salon TV, PC Bureau..."]', 'E2E Chrome Linux');

    const submitBtn = page.locator('button:has-text("Créer mon compte")');
    await submitBtn.click();

    // Attendre le feedback de succès ou la vue connectée
    await page.waitForTimeout(1500);

    // Capture de l'écran connecté avec la carte utilisateur
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '23_account_modal_logged_in.png') });
    console.log('📸 Capture 23_account_modal_logged_in.png enregistrée');

    // 6. Fermeture de la modale
    const closeBtn = page.locator('button:has(svg.lucide-x)');
    await closeBtn.click();
    await page.waitForTimeout(800);

    // Capture de l'écran "Qui regarde ?" mis à jour avec le profil du compte
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '24_startup_account_profiles.png') });
    console.log('📸 Capture 24_startup_account_profiles.png enregistrée');

    console.log('🎉 Audit E2E multi-comptes achevé avec succès !');
  } catch (err) {
    console.error('❌ Erreur durant l\'audit E2E:', err);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'error_account_e2e.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
