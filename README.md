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

6. **« Lecture Rapide 1-Clic » (Smart Instant Autoplay)** :
   - **Lecture Immédiate Netflix-Style** : bouton « Lecture rapide » sur la HeroBanner, au survol des affiches et dans les fiches médias. L'algorithme résout les flux en arrière-plan et sélectionne automatiquement le meilleur flux (priorité VF/VOSTFR selon le profil, cache Debrid instantané et compatibilité navigateur).
   - **Overlay de chargement réactif** : notification avec indicateur d'analyse et bouton d'annulation fluide.

7. **Gestionnaire de Téléchargements Hors-Ligne Dédié** :
   - **Interface dédiée (`Alt+D` ou icône en-tête)** : vue d'ensemble des films et épisodes sauvegardés pour le visionnage sans connexion internet (voyages, train, avion).
   - **Proxy de téléchargement forcé avec nom propre** : injection automatique de l'en-tête `Content-Disposition: attachment; filename="Titre.mp4"` via le proxy Express (`/api/proxy/stream?download=1`).
   - **Lecture directe hors-ligne** : rejoue le flux téléchargé directement dans le lecteur Stremo sans configuration.

8. **Rail Dynamique « ⚡ À Suivre / Prochains Épisodes » (Next Up Queue)** :
   - **Algorithme d'enchaînement de séries** : détection immédiate des séries actives. Dès qu'un épisode est complété (>85%), Stremo suggère l'épisode suivant (`S{s}E{e+1}`) en tête de l'écran d'accueil avec badge émeraude « À suivre ».
   - **Lecture rapide 1-clic** : lancement direct du streaming de l'épisode suivant sans passer par la modale.

9. **Glisser-Déposer & Import de Sous-Titres Locaux (.srt / .vtt)** :
   - **Dépôt direct sur la vidéo** : glissez n'importe quel fichier de sous-titres `.srt` ou `.vtt` sur le lecteur avec zone de dépôt visuelle animée.
   - **Conversion automatique SubRip -> WebVTT** : parsing et standardisation immédiate côté client sans dépendance.
   - **Bouton d'importation permanent** : disponible dans le panneau sous-titres même en l'absence de sous-titres distants, avec ajustement du décalage temporel (`+/-0.5s`) et sélection de taille.

10. **Packaging Desktop Natif & Mode Fenêtre Dédié (`npm run desktop`)** :
   - **Lanceur sans barre d'adresse** : exécute Stremo dans une fenêtre d'application native dédiée avec accélération matérielle GPU activée (`VaapiVideoDecoder`).
   - Configuration Electron prête à l'emploi (`electron/main.cjs`, `electron/preload.cjs`) et raccourci système `stremo.desktop`.

11. **Tableau de Bord de Statistiques de Visionnage (« Mes Statistiques »)** :
   - **Analyse complète par profil** : calcul en temps réel du temps total passé à regarder des films et séries (heures/minutes), nombre de médias complétés, série la plus dévorée (Top Binge).
   - **Répartition des genres & Trophées** : jauges de progression par genre et badges cinéphiles débloqués (« Grand Spectateur », « Binge Watcher », « Cinéphile Assidu »).

12. **Lecteur Vidéo Next-Gen, Proxy Anti-CORS & Saut des Génériques** :
   - **Proxy de Streaming Anti-CORS & HTTP 206 Range** : contournement instantané des restrictions cross-origin des serveurs distants (Torbox, Real-Debrid) avec support des requêtes partielles HTTP 206 Range pour une lecture web ultra-fluide.
   - **Proxy de Sous-titres & Conversion WebVTT à la volée** : standardisation automatique de tous les sous-titres OpenSubtitles (.srt) en format WebVTT (.vtt) avec en-têtes CORS permissifs.
   - **Préférences Linguistiques Intelligentes** : détection de la langue audio du flux (VF, MULTI, VO) et activation automatique de la bonne piste de sous-titres (ex: VOSTFR automatique si film étranger, sous-titres masqués si VF).
   - **Chapitrage Exact AniSkip & Communautaire** : saut d'intro et d'outro calé sur les timecodes réels vérifiés par la communauté pour les animes et séries.
   - **Auto-Fallback Transparent en Cas d'Erreur** : si un flux vidéo direct ou Debrid échoue (format non supporté, codec indisponible, lien 403), Stremo bascule automatiquement vers le prochain flux alternatif après un compte à rebours de 3 secondes avec option d'annulation ou basculement immédiat.
   - **Sélecteur de Flux en Cours de Lecture** : bouton `Flux (N)` directement accessible dans la barre de contrôle pour permuter entre 4K, 1080p, ou différents providers Debrid sans jamais quitter ni relancer le lecteur vidéo !
   - **Mode Nuit & Boost Dialogues (Dynamic Audio Compressor)** : compression audio intégrée via Web Audio API (`DynamicsCompressorNode`) activable en 1 clic (ou touche `D`) pour apaiser les effets sonores assourdissants et magnifier la clarté des dialogues lors des séances nocturnes.
   - **Saut Automatique & Manuel du Générique d'Intro** : saut automatique configurable (ex: +85s) dès le début de l'épisode pour les séries, avec bouton flottant manuel (`Touche S`) et possibilité d'annuler.
   - **Saut du Générique de Fin & Binge-Watching** : détection dès le début de l'outro (seuil configurable : 90s, 75s, 45s, 20s) pour lancer instantanément l'épisode suivant via compte à rebours 10s ou raccourci (`Touche N`).
   - **Google Cast & Apple AirPlay** : diffusion directe sur vos Smart TV, Chromecast et récepteurs AirPlay via les API standard Web et Remote Playback.
   - **Téléchargement hors-ligne direct** : bouton 1-clic pour les flux Debrid et liens HTTP directs afin de visionner sans connexion.
   - **Synchronisation fine des sous-titres** : réglage en direct du décalage (`+/-0.5s`, `+/-1.0s`, `0s Reset`) pour synchroniser n'importe quel fichier SRT/VTT OpenSubtitles.
   - **Taille des sous-titres personnalisable** : `Normal`, `Grand`, `Maxi` avec surbrillance noire contrastée pour grand écran ou salon.
   - **Vitesse de lecture adaptable** : `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x` (raccourcis `[` et `]`) et mode **Picture-in-Picture (PiP)** natif.
   - Lancement direct dans les lecteurs externes desktop (**VLC**, **MPV**, lecteur système) et Android (**Just Player**, **Nova Video Player**, **MX Player**).

10. **Écosystème Multi-Écrans, Découverte Réseau Local & Télécommande Mobile Temps Réel** :
   - **Découverte Réseau Local Zéro-Configuration (Zero-Conf LAN Discovery)** : détection automatique en direct des écrans Stremo connectés sur le même réseau Wi-Fi local (Salon TV, Mobile, Desktop) avec association en 1 clic sans devoir saisir de code PIN.
   - **Appairage Express TV <50ms par Server-Sent Events (SSE)** : grand code PIN 6 caractères et QR code interactif avec basculement sub-50ms dès validation mobile.
   - **Télécommande Mobile Tactile en Direct** : pavé tactile sur smartphone pour piloter la TV à distance en temps réel (Play/Pause, saut +/-10s, passer l'intro, épisode suivant, contrôle du volume et mute).
   - **Canal de Synchronisation Continue du Foyer (Family Sync Hub)** : synchronisation bidirectionnelle automatique en arrière-plan pour synchroniser profils, favoris et progression sur tous les écrans du foyer sans manipulation manuelle.

8. **Mode Salon TV 10-pieds Dédié** :
   - Détection automatique sur Smart TV et boîtiers Android TV, Fire TV, Chromecast, WebOS, Tizen.
   - Raccourci clavier / télécommande `T` ou bouton « Mode TV » dans l'en-tête pour basculer à volonté.
   - Typographie agrandie haute lisibilité, anneaux de focus lumineux amplifiés (`scale-105`), barre d'assistance télécommande au bas de l'écran.

9. **Scrobble Trakt.tv Bidirectionnel & Suivi Automatique** :
   - Association de compte Trakt.tv personnalisée par profil.
   - Envoi automatique du scrobble en temps réel (`start` à la lecture, `pause` lors des arrêts, `stop` avec marquage comme « Vu » dès 80%).
   - Proxy sécurisé côté serveur (`/api/trakt/scrobble`) pour respecter les en-têtes officiels de l'API Trakt v2.

10. **Sauvegarde, Ma Liste (Favoris) & Migration Multi-Écrans (1-Clic)** :
   - **Rail « Ma Liste » en Page d'Accueil** : accès instantané aux favoris du profil avec synchronisation multi-écrans en temps réel.
   - Sauvegarde complète de la configuration : profils, add-ons installés, bibliothèque de favoris et historique d'avancement.
   - Exportation instantanée au format JSON ou copie dans le presse-papier.
   - Restauration multi-écrans avec modes **Fusion intelligente** (ajoute sans écraser) ou **Remplacement intégral**.

11. **Cache Intelligent Multi-Niveaux & Mode Dégradé Hors-Ligne** :
   - **Persistance SQLite intégrée (`cache_store`)** : mise en cache automatique des requêtes add-ons Stremio pour une réactivité instantanée et une résilience réseau maximale (Métadonnées 24h, Catalogues 15m, Flux 4m, Sous-titres 1h).
   - **Endpoint de maintenance (`POST /api/cache/purge`)** : purge automatique des entrées expirées sans blocage I/O.

12. **Store d'Add-ons Communautaires Intégré (1-Clic)** :
   - **Catalogue vérifié de 13 add-ons de référence** : Torrentio, CyberFlix, OpenSubtitles v3, SubDL, Anime Kisa, Kitsu, TMDB, WatchHub, Twitch TV, YouTube Channels, Stremio Podcasts, Public Domain Movies, Anime Catalogs.
   - **Filtres par catégories thématiques** : `Tous`, `⚡ Flux & Debrid`, `📚 Catalogues SVOD`, `💬 Sous-titres`, `🎌 Animés`, `📺 Médias & Live`.
   - **Recherche en temps réel** : filtrage instantané par mots-clés, langues (VOSTFR, VF), debrid, genres.
   - **Copie d'URL de manifest & installation 1-clic** avec indicateur d'état immédiat (« Déjà installé »).

13. **Moteur de Streaming P2P Torrent Intégré (WebTorrent Séquentiel en Direct)** :
   - **Lecture web directe sans compte Debrid** : streaming instantané des torrents et liens magnet directement dans le lecteur web grâce au moteur séquentiel intégré côté serveur (`/api/torrent/stream?magnet=...`).
   - **Téléchargement séquentiel optimisé** : priorisation automatique des pièces vidéo du début à la fin pour démarrer la lecture en quelques secondes sans attendre le téléchargement complet du fichier.
   - **Sélecteur de Fichiers & Épisodes Torrent (Packs de Séries)** : détection automatique des torrents multi-fichiers avec tiroir dédié `Épisodes Torrent (N)` dans le lecteur pour choisir et regarder n'importe quel épisode du pack sans chercher de nouveaux liens.
   - **Support complet HTTP 206 Range** : saut de lecture fluide (seek), mise en mémoire tampon adaptative et sélection automatique du fichier vidéo optimal (`.mp4`, `.mkv`, `.webm`).
   - **Badges et Télémétrie P2P en direct** : affichage en temps réel dans le header du lecteur vidéo du débit de téléchargement (Mo/s), du nombre de pairs connectés et de la progression séquentielle.
   - **Bouton d'action dédié « ⚡ Lire P2P »** : lancement immédiat dans le navigateur ou ouverture en 1 clic dans VLC externe (`vlc`) sur Linux/Desktop.

14. **Moteur de Remuxing & Transcodage Audio/Vidéo à la Volée (FFmpeg Universel)** :
   - **Remuxing Audio AAC Stéréo ultra-rapide (0% CPU vidéo)** : conversion instantanée des pistes audio incompatibles avec les navigateurs (Dolby Digital AC3, EAC3, DTS, TrueHD) vers AAC 192k stéréo dans un conteneur MP4 fragmenté (`/api/transcode/stream?url=...`).
   - **Bascule automatique en cascade** : si le navigateur rencontre une erreur de décodage codec, Stremo bascule automatiquement vers le remuxer audio AAC en direct avec notification OSD.
   - **Bouton de réparation 1-clic** : bouton « ⚡ Réparer & Lire directement (Transcodage AAC) » dans le panneau de secours du lecteur pour forcer la conversion instantanée.
   - **Sonde d'analyse FFprobe (`/api/transcode/probe`)** : extraction détaillée des flux audio/vidéo et durée.

14. **Minuteur de Sommeil (Sleep Timer) & OSD HUD Centré** :
   - **Minuteur de mise en veille paramétrable** : 15 min, 30 min, 45 min, 60 min, ou « Fin de l'épisode / du film » (raccourci clavier `T`).
   - **Fondu audio progressif (Audio Fade-out)** sur les 5 dernières secondes avant l'arrêt pour un endormissement sans coupure brutale.
   - **OSD HUD (On-Screen Display)** : badge éphémère haute élégance au centre de l'écran affichant en temps réel les changements de volume, vitesse, décalage temporel (`+10s`/`-10s`), mode nuit et état du minuteur.

15. **Égaliseur d'Image Vidéo & Ratios d'Aspect Dynamiques** :
   - **5 formats d'image au choix** : Original ajusté (`contain`), Zoom plein écran sans bandes noires (`cover`), 16:9 Panoramique, 21:9 Cinéma Anamorphique (Cinemascope 2.39:1) et 4:3 Rétro. Raccourci clavier direct `A` avec retour OSD HUD.
   - **Égaliseur d'image GPU à accélération matérielle** : réglage en temps réel de la Luminosité (50%-150%), du Contraste (50%-150%) et de la Saturation des couleurs (0% N&B à 200% éclatant).
   - **4 Préréglages cinéma instantanés** : `Standard`, `🎬 Cinéma Sombre`, `✨ Éclatant (Vivid)`, `📽️ Noir & Blanc Rétro`.

16. **Signets Personnels & Marqueurs Interactifs de Timeline** :
   - **Mémorisation instantanée par raccourci clavier `B`** ou clic sur le bouton Signets avec titre personnalisé.
   - **Marqueurs visuels ambrés sur la barre de progression** : saut direct d'un clic au moment culte avec tooltip du titre et du timecode précis.
   - **Tiroir de gestion des signets** : consultation de tous les signets de l'œuvre par profil, horodatage, saut rapide et suppression en 1-clic.
   - **Persistance en base de données SQLite** (`bookmarks`) par profil et identifiant média.

17. **Fiche Artiste & Filmographie Complète (`PersonModal`)** :
   - **Navigation fluide par acteur ou réalisateur** : clic direct sur n'importe quel membre du casting ou sur le réalisateur dans l'en-tête de la fiche média.
   - **Exploration automatique de la filmographie** : interrogation des catalogues pour regrouper tous les films et séries associés.
   - **Lancement direct des œuvres** : un clic sur une affiche de la filmographie ouvre immédiatement la fiche et ses flux sans rechargement.

18. **Application PWA & Sécurité Renforcée** :
   - Web App Manifest complet avec icônes adaptatives, affichage `standalone` et installation en 1 clic.
   - **Protection des jetons secrets** : masquage systématique des tokens Debrid et AIOStreams dans l'interface et l'API.
   - **Statut de Compte Debrid** : vérification et affichage en temps réel des jours restants d'abonnement Real-Debrid / Torbox (`/api/debrid/status`).

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
│   ├── src/torrentEngine.ts              # Moteur WebTorrent séquentiel & streaming HTTP 206
│   ├── src/transcodeEngine.ts            # Moteur FFmpeg de remuxing & transcodage audio/vidéo
│   ├── src/index.ts                      # Routes API REST & proxy parallèle (Promise.allSettled)
│   ├── src/tests/server.test.ts          # Tests d'isolation des profils et catalogues
│   ├── src/tests/security.test.ts        # Tests de validation d'URL et de masquage
│   └── .env.example                      # Modèle de configuration
│
└── client/                               # Interface Frontend (React 19, TypeScript, Tailwind CSS v4)
    ├── src/components/HeroBanner.tsx     # Carrousel d'accueil rotatif immersif
    ├── src/components/CatalogRow.tsx     # Rails horizontaux avec défilement fluide
    ├── src/components/MediaModal.tsx     # Fiche détaillée avec analyse de flux & multi-lecteurs
    ├── src/components/PersonModal.tsx    # Fiche filmographie artiste (acteur / réalisateur)
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
