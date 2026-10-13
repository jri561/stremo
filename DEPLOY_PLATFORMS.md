# Guide de Déploiement et d'Installation Multi-Plateformes — Stremo

Stremo est conçu selon une architecture universelle réactive offrant une expérience native dédiée sur l'ensemble de vos écrans.

---

## 1. 🌐 Web Application & PWA (Tous navigateurs, Android, iOS, Windows, macOS)

Stremo intègre un manifeste PWA complet ([manifest.webmanifest](file:///home/toto/Documents/stremo/client/public/manifest.webmanifest)) et un Service Worker ([sw.js](file:///home/toto/Documents/stremo/client/public/sw.js)) pour une installation instantanée sans passer par un magasin d'applications.

### Installation :
1. Ouvrez l'application dans votre navigateur (ex: Chrome, Edge, Safari, Brave).
2. Cliquez sur le bouton **« Installer Stremo »** apparaissant dans la barre latérale ou l'en-tête, ou choisissez **« Installer l'application »** dans le menu du navigateur.
3. L'application s'ouvre dans sa fenêtre dédiée autonome, avec accélération matérielle, raccourcis et icône sur votre écran d'accueil.

---

## 2. 📱 Android (Smartphones & Tablettes)

### Options de déploiement :
- **Option 1 : Installation PWA directe (Recommandée)** :
  - Rendez-vous sur votre instance Stremo depuis Google Chrome sur Android.
  - Touchez le bandeau « Ajouter Stremo à l'écran d'accueil ».
  - L'application s'intègre en plein écran comme une application Android native.
- **Option 2 : Génération d'APK natif via Capacitor** :
  ```bash
  # Dans le dossier racine du projet :
  npm run build
  npx cap add android
  npx cap copy
  npx cap open android
  ```
- **Option 3 : Génération TWA (Trusted Web Activity) pour le Google Play Store** :
  - Utilise la configuration prête à l'emploi dans [android/twa-manifest.json](file:///home/toto/Documents/stremo/android/twa-manifest.json).
  ```bash
  npx @bubblewrap/cli build
  ```

---

## 3. 📺 Android TV & Box TV Salon (Expérience 10-pieds)

Stremo intègre nativement l'expérience Leanback pour téléviseurs connectés :
- Navigation D-Pad spatiale (flèches directionnelles ▲▼◄► de la télécommande).
- Focus visuel amplifié (halo indigo `#818cf8` et agrandissement `scale(1.06)`).
- Bannière Android TV 320x180 px ([tv_banner.png](file:///home/toto/Documents/stremo/client/public/tv-banner-320x180.png)).
- Détection automatique via User-Agent TV et touche de raccourci `T`.

### Compilation et Installation de l'APK Android TV :
Le fichier [android/app/src/main/AndroidManifest.xml](file:///home/toto/Documents/stremo/android/app/src/main/AndroidManifest.xml) contient les balises nécessaires :
```xml
<uses-feature android:name="android.software.leanback" android:required="false" />
<uses-feature android:name="android.hardware.touchscreen" android:required="false" />
<intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
</intent-filter>
```

Pour installer directement l'APK sur votre téléviseur ou Box Android TV via ADB :
```bash
# Compiler l'APK
cd android && ./gradlew assembleRelease

# Installer sur la TV via réseau local
adb connect IP_DE_VOTRE_TV:5555
adb install -r app/build/outputs/apk/release/app-release.apk
```

---

## 4. 🐧 Linux (Application Bureau Native)

Stremo s'intègre nativement à l'environnement de bureau Linux (GNOME, KDE Plasma, XFCE, Cinnamon, etc.) sans dépendances lourdes.

### Installation en 1 commande :
```bash
./scripts/install-linux.sh
```
Ce script :
1. Crée le binaire exécutable dans `~/.local/bin/stremo`.
2. Installe l'icône haute résolution dans le thème d'icônes XDG (`~/.local/share/icons/hicolor/512x512/apps/stremo.png`).
3. Installe le raccourci applicatif `~/.local/share/applications/stremo.desktop`.
4. Met à jour la base de données MIME du système.

### Lancement :
- Depuis le menu des applications de votre environnement de bureau (icône **Stremo**).
- En ligne de commande : `stremo`.

### Génération de l'archive portable de distribution :
```bash
./scripts/package-linux.sh
```
Génère l'archive `dist-linux/stremo-linux-x64-v1.0.0.tar.gz` prête à être distribuée sur toute distribution Linux x86_64.
