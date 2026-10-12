# Stremo 🎬

Plateforme de streaming moderne et immersive inspirée de **Nuvio** et **Stremio**, conçue pour un usage multi-écrans (Desktop Linux, Web, Android, Android TV) avec isolation stricte des profils et compatibilité complète avec l'écosystème d'add-ons Stremio (v3).

> 📌 **Plan de développement futur & Présentation** : Consultez notre [Feuille de Route & Plan de Présentation détaillé](file:///home/toto/Documents/stremo/ROADMAP.md).

---

## 🌟 Fonctionnalités Clés

1. **Expérience Cinématographique Haute Fidélité** :
   - **Hero Banner dynamique & carrousel rotatif** : mise en avant des nouveautés avec affiches de fond, notes IMDb réelles, métadonnées épurées et lecture immédiate en 1 clic.
   - **Fiche média enrichie (MediaModal)** :
     - Bouton **« Lecture rapide »** sélectionnant automatiquement la meilleure source disponible (4K HDR/DV, mise en cache Debrid, débit optimal).
     - Analyse avancée des flux AIOStreams / Torrentio : badges de résolution (4K, 1080p, 720p), services Debrid (AllDebrid ⚡, Real-Debrid ⚡, TorBox ⚡), formats HDR / Dolby Vision, pistes audio (Dolby Atmos, 5.1), taille du fichier et drapeaux linguistiques (VF/VOST).
     - Filtres par résolution instantanés (`Toutes`, `4K`, `1080p`, `720p`) et **filtre Debrid** (`⚡ Debrid ({count})`).
     - Navigation par saisons et épisodes avec miniatures, **badges d'épisodes vus (`Vu ✓`)** et bouton 1-clic pour marquer/démarquer les épisodes.
     - Distribution complète avec photos et **recherche filmographique au clic** sur n'importe quel acteur ou réalisateur.
     - Bande-annonce YouTube officielle intégrée.
     - Verrouillage automatique du défilement et fermeture par touche Échap ou clic extérieur.
   - **Rails et Affiches Nuvio-style (CatalogRow)** :
     - Bouton de lecture centré animé au survol avec flou d'arrière-plan.
     - Indicateur lisible du temps restant (« Reste 24m » ou « S1E3 • Reste 18m ») sur les médias en cours de visionnage.

2. **Recherche Intelligente & Instantanée (Onglet Dédié)** :
   - Onglet complet avec barre de recherche principale auto-focus et raccourci global `/` ou `Ctrl+K`.
   - **Historique récent interactif** : mémorisation locale des recherches avec relance en 1 clic et suppression individuelle ou globale.
   - **Suggestions thématiques tendances en 1 clic** : Tendances 2026, Batman, Marvel, Science-Fiction, Action, Animation, Comédies, Netflix.
   - Requête simultanée en parallèle sur films et séries avec debounce optimisé à 180 ms.
   - Filtres dynamiques avec compteurs en temps réel : `Tous`, `Films`, `Séries`.
   - **Double mode d'affichage** :
     - **Grille aérée** : 5-6 colonnes espacées avec affiches HD, notes IMDb dorées, types et genres.
     - **Liste détaillée** : format carte horizontale avec synopsis complet, année, genres, note et bouton d'action direct.
   - Déduplication automatique et assainissement des notes invalides.

3. **Exploration Multi-Catalogues Harmonieuse (DiscoverView)** :
   - Interface alignée sur la même charte graphique épurée (thème sombre `#07090e`, fond cartes `#0d1017`).
   - **Sélecteur de type fluide** : permutation instantanée entre Films et Séries avec icônes et compteurs.
   - **Navigation multi-sources** : carrousel horizontal des catalogues disponibles (`TMDB Popular`, `Netflix`, `Disney+`, etc.) avec bouton d'isolation en un clic.
   - **Filtres de genres cinématographiques** : barre de pilules interactives avec sélection directe.
   - **Tri avancé** : Recommandé, Mieux notés (IMDb décroissant), Plus récents (Année décroissante) et Alphabétique (A-Z).
   - **Filtre local instantané** : barre de recherche intégrée pour filtrer les résultats en mémoire sans latence réseau.
   - **Double mode Grille aérée (5-6 colonnes) & Liste détaillée** avec affichage des barres de reprise de lecture profil.

5. **Gestion Complète des Profils & Sécurité Parentale Personnalisée** :
   - Mode « Gérer les profils » inspiré des grandes plateformes (Netflix, Disney+).
   - Modification en direct du nom, de l'avatar, du statut Enfant et du code PIN 4 chiffres pour chaque profil.
   - Suppression de profil avec confirmation et nettoyage complet en base de données SQLite.
   - **Mode Enfants sécurisé** : filtrage automatique et strict des catalogues, suggestions et résultats de recherche (animation et famille conservés ; horreur, gore et violence masqués).
   - **Protection parentale par code PIN** : impossible de basculer d'un profil enfant vers un profil adulte sans entrer le code PIN parental.
   - **Isolation totale** de l'historique de lecture, pourcentages d'avancement et bibliothèque de favoris.

6. **Lecteur Vidéo Next-Gen & Saut des Génériques (Intro & Outro)** :
   - **Saut du générique de fin & Binge-Watching** : détection intelligente dès le début du générique de fin (seuil configurable : 90s, 75s, 45s, 20s) pour lancer instantanément l'épisode suivant via compte à rebours automatique ou clic immédiat (`Touche N`).
   - **Saut du générique d'ouverture (Passer l'intro)** : bouton flottant élégant dans les premières minutes de l'épisode pour avancer de 85 secondes en un clic (`Touche S`).
   - **Menu Dédié « Génériques »** : réglage en direct du seuil de détection du générique de fin et activation/désactivation de l'enchaînement automatique mémorisé dans le profil.
   - **Synchronisation fine des sous-titres** : réglage en direct du décalage (`+/-0.5s`, `+/-1.0s`, `0s Reset`) pour synchroniser n'importe quel fichier SRT/VTT OpenSubtitles.
   - **Taille des sous-titres personnalisable** : `Normal`, `Grand`, `Maxi` avec surbrillance noire contrastée pour grand écran ou salon.
   - **Vitesse de lecture adaptable** : `0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`.
   - **Picture-in-Picture (PiP) natif** : regardez votre film ou série en travaillant ou en naviguant sur une autre fenêtre.
   - Lecteur HTML5 / HLS intégré optimisé.
   - Lancement direct dans les lecteurs externes desktop : **VLC**, **MPV**, lecteur système (`xdg-open`).
   - Protocoles Intents Android : **Just Player**, **Nova Video Player**, **MX Player**, sélecteur universel Android.

7. **Application PWA (Progressive Web App) & Installation en 1 Clic** :
   - Web App Manifest complet avec icônes adaptatives et affichage `standalone`.
   - Bouton d'installation intégré (« Installer l'app ») sur Android, iOS, Windows, Mac et Chromebook.
   - Service Worker pour une mise en cache résiliente des ressources de base de l'application.

8. **Navigation Télécommande / Clavier (D-Pad & Smart TV)** :
   - Accessibilité complète avec les 4 flèches directionnelles et la touche Entrée.
   - Flèches Gauche/Droite pour naviguer et faire défiler les rails de films.
   - Flèches Haut/Bas pour sauter d'un rail à un autre.
   - Anneaux de focus haute visibilité (anneau indigo lumineux contrasté) pour grand écran.

9. **Gestionnaire d'Add-ons Stremio Sécurisé** :
   - Cartes d'add-ons détaillées avec version, logos, descriptions et types supportés.
   - **Protection des jetons secrets** : les URLs de manifestes contenant des clés API privées (AIOStreams, Debrid) sont masquées dans l'interface et l'API (`host` seul exposé).
   - Installation en un clic des add-ons recommandés (Torrentio, CyberFlix, Anime Kisa, OpenSubtitles v3).
   - Possibilité de retirer n'importe quel add-on (y compris Cinemeta).

---

## 🔒 Sécurité & Durcissement

- **Clé d'accès optionnelle (`STREMO_ACCESS_KEY`)** : en cas d'exposition via un tunnel public (ex. Cloudflare Tunnel), activez une clé secrète dans les variables d'environnement. Les clients non autorisés reçoivent un code `401` et une invite de saisie s'affiche.
- **Protection des lecteurs externes** : l'exécution de processus locaux (`vlc`, `mpv`) est restreinte à la machine locale et rejetée si la requête provient d'un proxy public distant (`X-Forwarded-For`).
- **Validation des URLs** : seules les URLs `http://`, `https://` et `magnet:` sont acceptées ; les schémas non sécurisés et les arguments de commande sont neutralisés.

---

## 🏗️ Structure du Projet

```
stremo/
├── server/                               # Serveur API Express & Moteur Stremio (Node.js + node:sqlite)
│   ├── src/db.ts                         # Gestionnaire SQLite (profils, reprise, bibliothèque, addons)
│   ├── src/addonClient.ts                # Client Stremio v3 (cache TTL, fetch minuté, masquage)
│   ├── src/index.ts                      # Routes API REST & proxy parallèle (Promise.allSettled)
│   ├── src/tests/server.test.ts          # Tests d'isolation des profils et catalogues
│   ├── src/tests/security.test.ts        # Tests de validation d'URL et de masquage
│   └── .env.example                      # Modèle de configuration
│
└── client/                               # Interface Frontend (React 19, TypeScript, Tailwind CSS v4)
    ├── src/components/HeroBanner.tsx     # Carrousel d'accueil rotatif immersif
    ├── src/components/CatalogRow.tsx     # Rails horizontaux avec défilement fluide
    ├── src/components/MediaModal.tsx     # Fiche détaillée avec analyse de flux & multi-lecteurs
    ├── src/components/SkeletonRow.tsx    # Squelettes de chargement à effet shimmer
    ├── src/components/AddonManager.tsx   # Gestionnaire d'add-ons avec cartes enrichies
    ├── src/components/ProfileMenu.tsx    # Menu déroulant de changement de profil
    ├── src/components/ProfileSelector.tsx# Sélecteur d'accueil multi-profils
    ├── src/components/VideoPlayer.tsx    # Lecteur vidéo intégré HLS
    ├── src/streams.ts                    # Moteur d'analyse et de classement des flux
    ├── src/streams.test.ts               # Tests unitaires du parseur de flux
    ├── src/players.ts                    # Configuration des lecteurs & Intents Android
    ├── src/api.ts                        # Client API & gestionnaire de clé d'accès
    └── src/App.tsx                       # Shell responsive, recherche unifiée & navigation
```

---

## 🚀 Installation & Lancement Rapide (Production Unifiée)

### Prérequis
- Node.js (v20 ou supérieur)
- npm

### 1. Démarrer en une seule commande (Idéal Famille)
Depuis la racine du projet :
```bash
npm run build
npm start
```
*Le serveur Express écoute sur `http://localhost:3001` et sert directement l'interface web optimisée ainsi que l'API sur le même port.*

### 2. Lancer les tests
```bash
npm test
```

---

## 👨‍👩‍👧‍👦 Guide d'Usage Familial & Recommandations

Pour que l'expérience soit 100% fluide pour des utilisateurs non-techniques :

1. **Choix du Lecteur par Appareil** :
   - **Sur Ordinateur de salon (Desktop)** : activez le lecteur externe **VLC** ou **MPV** dans les paramètres. Cela permet de lire 100% des fichiers (y compris 4K HDR, Dolby Vision et pistes son DTS/EAC3) sans contrainte liée au navigateur.
   - **Sur Tablette / Smartphone / Android TV** : choisissez **Just Player** ou **Nova Player** (lecteurs légers compatibles avec les liens d'intention de l'application).
   - **Sur Navigateur Web standard** : privilégiez le bouton **Lecture rapide** ou les flux H.264 / 1080p MP4.

2. **Démarrage automatique en arrière-plan (PM2 ou Systemd)** :
   Pour que l'application reste active sans ouvrir de terminal :
   ```bash
   # Via PM2
   npm install -g pm2
   pm2 start npm --name "stremo" -- start
   pm2 save
   pm2 startup
   ```

---

## 📱 Déploiement & Accès Distant

### Cloudflare Tunnel (Accès distant sécurisé)
Pour exposer l'application sur smartphone ou tablette en dehors du domicile :
```bash
cloudflared tunnel --url http://localhost:3001
```
*Astuce : Définissez `STREMO_ACCESS_KEY` dans `server/.env` pour protéger l'accès public avec un code secret.*

### Application Mobile / Android TV (Capacitor)
```bash
cd client
npm run build
npx cap init Stremo com.stremo.app --web-dir dist
npx cap add android
npx cap open android
```
Dans Android Studio, compilez l'APK pour Android TV ou mobile.
