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

4. **Gestion Complète des Profils & Personnalisation Stylisée** :
   - **Catalogue de 20 Avatars Répartis en 5 Catégories** :
     - *Cinéma & Médias* : Cinéphile, Séries & TV, Soirée Popcorn, Réalisateur.
     - *Aventure & Héros* : Astronaute, Action & Feu, Explorateur, Électrique.
     - *Famille & Enfants* : Magie & Étoiles, Sourire Joyeux, Cœur Romantique, Compagnon Chat.
     - *Gaming & Tech* : Gamer, Audiophile, Cyber Robot, Geek Passion.
     - *Classique & VIP* : Standard, VIP Royal, Frisson & Horreur, Pause Café.
   - **8 Thèmes de Couleurs & Halos Lumineux** : Indigo Électrique, Violet Mystique, Rose Bubblegum, Émeraude Zen, Cyan Néon, Ambre Solaire, Rubis Écarlate et Ardoise Furtif.
   - **Écran « Qui regarde ? » Cinématique** : cartes stylisées aux coins arrondis épousant le dégradé du thème et l'avatar sélectionné, animations douces et halos fluorescents.
   - **Modale Unifiée de Personnalisation (`ProfileModal`)** : interface interactive pour créer ou modifier un profil, bascule en 1 clic vers le mode Enfant, sélecteur visuel d'avatars et pastilles chromatiques.
   - **Mode Enfants Sécurisé** : filtrage automatique et strict des catalogues, suggestions et résultats de recherche (animation et famille conservés ; horreur, gore et violence masqués).
   - **Protection Parentale par Code PIN** : verrouillage 4 chiffres empêchant tout basculement non autorisé d'un profil enfant vers un profil adulte.
   - **Isolation Totale SQLite** : historique de lecture, reprises au millième de seconde, favoris et préférences linguistiques (VF/VOSTFR) 100% étanches par profil.

5. **« Lecture Rapide 1-Clic » (Smart Instant Autoplay)** :
   - **Lecture Immédiate Netflix-Style** : bouton « Lecture rapide » sur la HeroBanner, au survol des affiches et dans les fiches médias. L'algorithme résout les flux en arrière-plan et sélectionne automatiquement le meilleur flux (priorité VF/VOSTFR selon le profil, cache Debrid instantané et compatibilité navigateur).
   - **Overlay de chargement réactif** : notification avec indicateur d'analyse et bouton d'annulation fluide.

6. **Gestionnaire de Téléchargements Hors-Ligne Dédié** :
   - **Interface dédiée (`Alt+D` ou icône en-tête)** : vue d'ensemble des films et épisodes sauvegardés pour le visionnage sans connexion internet (voyages, train, avion).
   - **Proxy de téléchargement forcé avec nom propre** : injection automatique de l'en-tête `Content-Disposition: attachment; filename="Titre.mp4"` via le proxy Express (`/api/proxy/stream?download=1`).
   - **Lecture directe hors-ligne** : rejoue le flux téléchargé directement dans le lecteur Stremo sans configuration.

7. **Rail Dynamique « ⚡ À Suivre / Prochains Épisodes » (Next Up Queue)** :
   - **Algorithme d'enchaînement de séries** : détection immédiate des séries actives. Dès qu'un épisode est complété (>85%), Stremo suggère l'épisode suivant (`S{s}E{e+1}`) en tête de l'écran d'accueil avec badge émeraude « À suivre ».
   - **Lecture rapide 1-clic** : lancement direct du streaming de l'épisode suivant sans passer par la modale.

8. **Glisser-Déposer & Import de Sous-Titres Locaux (.srt / .vtt)** :
   - **Dépôt direct sur la vidéo** : glissez n'importe quel fichier de sous-titres `.srt` ou `.vtt` sur le lecteur avec zone de dépôt visuelle animée.
   - **Conversion automatique SubRip -> WebVTT** : parsing et standardisation immédiate côté client sans dépendance.
   - **Bouton d'importation permanent** : disponible dans le panneau sous-titres même en l'absence de sous-titres distants, avec ajustement du décalage temporel (`+/-0.5s`) et sélection de taille.

9. **Packaging Desktop Natif & Mode Fenêtre Dédié (`npm run desktop`)** :
   - **Lanceur sans barre d'adresse** : exécute Stremo dans une fenêtre d'application native dédiée avec accélération matérielle GPU activée (`VaapiVideoDecoder`).
   - Configuration Electron prête à l'emploi (`electron/main.cjs`, `electron/preload.cjs`) et raccourci système `stremo.desktop`.

10. **Tableau de Bord de Statistiques de Visionnage (« Mes Statistiques »)** :
    - **Analyse complète par profil** : calcul en temps réel du temps total passé à regarder des films et séries (heures/minutes), nombre de médias complétés, série la plus dévorée (Top Binge).
    - **Répartition des genres & Trophées** : jauges de progression par genre et badges cinéphiles débloqués (« Grand Spectateur », « Binge Watcher », « Cinéphile Assidu »).

11. **Lecteur Vidéo Next-Gen, Proxy Anti-CORS & Sous-Titres Cinématiques** :
    - **Proxy de Streaming Anti-CORS & HTTP 206 Range** : contournement instantané des restrictions cross-origin des serveurs distants (Torbox, Real-Debrid) avec support des requêtes partielles HTTP 206 Range pour une lecture web ultra-fluide.
    - **Proxy de Sous-titres & Conversion WebVTT à la volée** : standardisation automatique de tous les sous-titres OpenSubtitles (.srt) en format WebVTT (.vtt) avec en-têtes CORS permissifs.
    - **Sous-Titres Cinématiques Haute Fidélité (`video::cue`)** :
      - Typographie moderne anti-crénelée avec ombres portées nettes pour une lisibilité parfaite sur fond clair comme sombre.
      - 3 couleurs cinématographiques : Blanc classique, **Jaune Cinéma 🎬** (`#facc15`), Cyan moderne (`#67e8f9`).
      - 3 styles d'arrière-plan : Ombre seule cinéma, Translucide doux flouté, Boîte opaque.
      - 4 tailles progressives : Fin, Standard, Grand, Maxi.
      - Normalisation multilingue ISO 639 (drapeaux 🇫🇷 🇬🇧 🇪🇸 🇯🇵, libellés en français, détection automatique des tags `Forcé` et `SDH`).
      - Menus par onglets dans le lecteur avec filtrage par langue et recherche textuelle rapide.
    - **Saut d'Intro Intelligent & Adaptatif** :
      - Durée calculée selon la nature de l'œuvre : **Animes** (durée standard TV Tokyo = 90s, libellé « Passer l'opening (+90s) »), **Sitcoms et formats courts <30 min** (25s), **Séries drama** (80s ou personnalisée), **Films** (pas de saut aveugle arbitraire), **AniSkip / Chapitres communautaires** (saut exact au millième de seconde près).
      - Option de saut automatique transparent avec notification toast.
    - **Préférences Linguistiques Intelligentes** : détection de la langue audio du flux (VF, MULTI, VO) et activation automatique selon le mode choisi (Intelligent VOSTFR, Toujours, Jamais).
    - **Auto-Fallback Transparent en Cas d'Erreur** : si un flux vidéo direct ou Debrid échoue, Stremo bascule automatiquement vers le prochain flux alternatif après 3 secondes avec compte à rebours.
    - **Sélecteur de Flux en Cours de Lecture** : bouton `Flux (N)` directement accessible pour permuter entre 4K, 1080p, ou différents providers Debrid sans interruption.
    - **Mode Nuit & Boost Dialogues (Dynamic Audio Compressor)** : compression audio Web Audio API activable en 1 clic (ou touche `D`) pour adoucir les déflagrations et magnifier les voix.
    - **Saut du Générique de Fin & Binge-Watching** : détection de l'outro (seuil configurable : 90s, 75s, 45s, 20s) pour lancer instantanément l'épisode suivant via compte à rebours 10s ou raccourci (`Touche N`).
    - **Google Cast & Apple AirPlay** : diffusion directe sur vos Smart TV, Chromecast et récepteurs AirPlay via les API standard Web et Remote Playback.
    - **Téléchargement hors-ligne direct** : bouton 1-clic pour les flux Debrid et liens HTTP directs.
    - **Synchronisation fine des sous-titres** : réglage en direct du décalage (`+/-0.5s`, `0s Reset`).
    - **Vitesse de lecture adaptable** : `0.5x` à `2.0x` (raccourcis `[` et `]`) et mode **Picture-in-Picture (PiP)** natif.
    - Lancement direct dans les lecteurs externes desktop (**VLC**, **MPV**) et Android (**Just Player**, **Nova Video Player**).

12. **Écosystème Multi-Écrans, Découverte Réseau Local & Télécommande Mobile Temps Réel** :
    - **Découverte Réseau Local Zéro-Configuration (Zero-Conf LAN Discovery)** : détection automatique en direct des écrans Stremo connectés sur le même réseau Wi-Fi local avec association en 1 clic.
    - **Appairage Express TV <50ms par Server-Sent Events (SSE)** : code PIN 6 caractères et QR code interactif.
    - **Télécommande Mobile Tactile en Direct** : pavé tactile smartphone pour piloter la TV à distance en temps réel.
    - **Canal de Synchronisation Continue du Foyer (Family Sync Hub)** : synchronisation bidirectionnelle automatique en tâche de fond.

13. **Mode Salon TV 10-pieds Dédié** :
    - Détection automatique sur Smart TV et boîtiers Android TV, Fire TV, Chromecast, WebOS, Tizen.
    - Raccourci clavier / télécommande `T` ou bouton « Mode TV » dans l'en-tête pour basculer à volonté.
    - Typographie agrandie haute lisibilité, anneaux de focus lumineux amplifiés, barre d'assistance télécommande.

14. **Scrobble Trakt.tv Bidirectionnel & Suivi Automatique** :
    - Association de compte Trakt.tv personnalisée par profil.
    - Envoi automatique du scrobble en temps réel (`start` à la lecture, `pause`, `stop` avec marquage « Vu » dès 80%).

15. **Sauvegarde, Ma Liste (Favoris) & Migration Multi-Écrans (1-Clic)** :
    - **Rail « Ma Liste » en Page d'Accueil** : accès instantané aux favoris du profil avec synchronisation multi-écrans en temps réel.
    - Sauvegarde complète de la configuration : profils, add-ons installés, bibliothèque de favoris et historique d'avancement.
    - Exportation instantanée au format JSON ou copie dans le presse-papier.
    - Restauration multi-écrans avec modes **Fusion intelligente** ou **Remplacement intégral**.

16. **Cache Intelligent Multi-Niveaux & Mode Dégradé Hors-Ligne** :
    - **Persistance SQLite intégrée (`cache_store`)** : mise en cache automatique des requêtes add-ons Stremio (Métadonnées 24h, Catalogues 15m, Flux 4m, Sous-titres 1h).
    - **Endpoint de maintenance (`POST /api/cache/purge`)** : purge automatique des entrées expirées sans blocage I/O.

17. **Store d'Add-ons Communautaires Intégré (1-Clic)** :
    - **Catalogue vérifié de 13 add-ons de référence** : Torrentio, CyberFlix, OpenSubtitles v3, SubDL, Anime Kisa, Kitsu, TMDB, WatchHub, Twitch TV, YouTube Channels, Stremio Podcasts, Public Domain Movies, Anime Catalogs.
    - **Filtres par catégories thématiques** : `Tous`, `⚡ Flux & Debrid`, `📚 Catalogues SVOD`, `💬 Sous-titres`, `🎌 Animés`, `📺 Médias & Live`.
    - **Recherche en temps réel** : filtrage instantané par mots-clés, langues (VOSTFR, VF), debrid, genres.

18. **Moteur de Streaming P2P Torrent & Transcodage FFmpeg Universel** :
    - **Streaming P2P WebTorrent Séquentiel** : lecture web directe sans compte Debrid (`/api/torrent/stream?magnet=...`), priorisation séquentielle des pièces vidéo, sélecteur d'épisodes multi-fichiers et télémétrie en direct.
    - **Remuxing & Transcodage Audio/Vidéo FFmpeg** : remuxing audio AAC stéréo en direct pour les pistes AC3/EAC3/DTS avec horloge absolue et reprise fluide (`/api/transcode/stream?url=...`), et sonde FFprobe (`/api/transcode/probe`).

19. **Panneau des Paramètres de l'Application (`SettingsModal`)** :
    - Bouton d'accès direct dans la barre de navigation et dans le menu de profil.
    - Configuration de la langue audio principale et de la langue des sous-titres par défaut.
    - Mode d'activation automatique : Intelligent (VOSTFR), Toujours, Jamais.
    - Personnalisation visuelle en direct avec cadre de prévisualisation cinématique.
    - Paramètres du saut d'intro intelligent et du seuil de binge-watching.
    - Choix du lecteur par défaut (Stremo Web, VLC, Just Player) et proxy de streaming.
    - Enregistrement immédiat dans le profil SQLite et le stockage local de l'appareil.
    - **Minuteur de Sommeil (Sleep Timer)** : mise en veille paramétrable avec fondu audio progressif sur 5 secondes.
    - **Égaliseur d'Image Vidéo & Ratios d'Aspect** : formats (16:9, 21:9 Cinemascope, 4:3, zoom) et égaliseur dynamique GPU (luminosité, contraste, saturation).
    - **Signets Personnels & Fiche Filmographie Artiste (`PersonModal`)** : marqueurs de timeline interactifs et exploration de carrière en un clic.

20. **Système Multi-Comptes Sécurisé & Synchronisation Cloud Multi-Écrans** :
    - **Authentification Cryptographique Forte** : mots de passe hachés avec `scrypt` natif (`crypto.scryptSync`, sel aléatoire 16 octets, $N=16384, r=8, p=1$) et vérification en temps constant via `crypto.timingSafeEqual` pour parer les attaques par canal auxiliaire.
    - **Jetons de Session Cryptographiques (64 hex)** : générés par `crypto.randomBytes(32)` avec persistance sécurisée sur 90 jours et expiration automatique.
    - **Isolation Étanche par Compte** : chaque compte dispose de ses propres profils, historique de lecture, reprises au millième de seconde, favoris et add-ons personnalisés.
    - **Gestionnaire de Sessions Actives** : visualisez tous les appareils connectés (Navigateur Desktop, Android Mobile, Android TV Salon), leur date de connexion et révoquez un accès suspect à distance en 1 clic.
    - **Mode Invité Local Transparent** : aucun compte obligatoire pour démarrer l'application ; le mode invité local fonctionne immédiatement sans friction.
    - **Réclamation des Données Locales en 1 Clic (« Claim Local Data »)** : lors de l'inscription ou de la connexion, vos profils locaux et historiques peuvent être transférés instantanément sur votre compte cloud.
    - **Interface Moderne Dédiée (`AccountModal`)** : accessible depuis l'écran « Qui regarde ? », la barre de navigation et le menu profil.

---

## 🔒 Sécurité & Durcissement

- **Clé d'accès optionnelle (`STREMO_ACCESS_KEY`)** : en cas d'exposition via un tunnel public (ex. Cloudflare Tunnel), activez une clé secrète dans les variables d'environnement. Les clients non autorisés reçoivent un code `401` et une invite de saisie s'affiche.
- **Clé d'accès optionnelle (`STREMO_ACCESS_KEY`)** : en cas d'exposition via un tunnel public (ex. Cloudflare Tunnel), activez une clé secrète dans les variables d'environnement. Les clients non autorisés reçoivent un code `401` et une invite de saisie s'affiche. La clé est transmise via l'en-tête `x-stremo-key` pour l'API, ou via le paramètre sécurisé `?k=` pour les balises HTML `<video>` et `<track>` (`/api/proxy/`, `/api/torrent/`, `/api/transcode/`).
- **Protection SSRF & Réseau Local** : refus strict de toute adresse locale (localhost, 127.0.0.1, sous-réseaux privés RFC1918 10.x, 192.168.x, 172.16.x et adresses de liaison 169.254.x / ::1) lorsqu'une requête provient d'un tunnel ou d'un proxy externe (`X-Forwarded-For`, `CF-Connecting-IP`).
- **Protection des lecteurs externes** : l'exécution de processus locaux (`vlc`, `mpv`) est strictement restreinte aux requêtes locales et rejetée si la requête provient d'un proxy public distant.
- **Validation des flux & chemins** : seules les URLs `http://`, `https://` et les schémas `magnet:` valides sont acceptés ; injection d'arguments, accès `file://` et chemins système interdits.

---

## 🏗️ Structure du Projet

```
stremo/
├── server/                               # Serveur API Express & Moteur Stremio (Node.js + node:sqlite)
│   ├── src/db.ts                         # Gestionnaire SQLite (profils, comptes, sessions, addons)
│   ├── src/accountAuth.ts                # Hachage scrypt, timingSafeEqual & tokens de session
│   ├── src/addonClient.ts                # Client Stremio v3 (cache TTL, fetch minuté, masquage)
│   ├── src/auth.ts                       # Authentification, timingSafeEqual & détection tunnel SSRF
│   ├── src/torrentEngine.ts              # Moteur WebTorrent séquentiel & streaming HTTP 206
│   ├── src/transcodeEngine.ts            # Moteur FFmpeg de remuxing & transcodage audio/vidéo
│   ├── src/index.ts                      # Routes API REST, scoping des requêtes & proxy parallèle
│   ├── src/tests/accounts.test.ts        # Tests d'authentification scrypt, tokens & sessions
│   ├── src/tests/server.test.ts          # Tests d'isolation des profils, Trakt, backup et cache
│   ├── src/tests/media.test.ts           # Tests intégration réels : transcodage FFmpeg, P2P WebTorrent
│   ├── src/tests/security.test.ts        # Tests de validation d'URL et de masquage
│   └── .env.example                      # Modèle de configuration (PORT, STREMO_ACCESS_KEY, FFMPEG_PATH)
│
└── client/                               # Interface Frontend (React 19, TypeScript, Tailwind CSS v4)
    ├── src/components/HeroBanner.tsx     # Carrousel d'accueil rotatif immersif
    ├── src/components/CatalogRow.tsx     # Rails horizontaux avec défilement fluide
    ├── src/components/MediaModal.tsx     # Fiche détaillée avec analyse de flux & multi-lecteurs
    ├── src/components/AccountModal.tsx   # Modale de connexion, inscription & sessions cloud
    ├── src/components/PersonModal.tsx    # Fiche filmographie artiste (acteur / réalisateur)
    ├── src/components/SkeletonRow.tsx    # Squelettes de chargement à effet shimmer
    ├── src/components/AddonManager.tsx   # Gestionnaire d'add-ons avec cartes enrichies
    ├── src/components/ProfileMenu.tsx    # Menu déroulant de changement de profil & compte
    ├── src/components/ProfileSelector.tsx# Sélecteur d'accueil multi-profils & mode compte
    ├── src/components/VideoPlayer.tsx    # Lecteur vidéo intégré HLS, P2P séquentiel & égaliseur
    ├── src/transcodeClock.ts             # Horloge absolue & gestion du buffer pour flux transcodé
    ├── src/transcodeClock.test.ts        # Tests unitaires de synchronisation d'horloge et d'URLs
    ├── src/streams.ts                    # Moteur d'analyse et de classement des flux
    ├── src/streams.test.ts               # Tests unitaires du parseur de flux
    ├── src/account.test.ts               # Tests unitaires du client API de compte
    ├── src/players.ts                    # Configuration des lecteurs & Intents Android
    ├── src/api.ts                        # Client API avec gestion du jeton de compte & clé d'accès
    └── src/App.tsx                       # Shell responsive, recherche unifiée & navigation
```

---

## 🚀 Installation & Lancement Rapide (Production Unifiée)

### Prérequis
- Node.js (v20 ou supérieur, testé sur Node.js v26)
- npm
- **FFmpeg & FFprobe** (optionnels mais vivement recommandés pour le transcodage audio AAC direct et la sonde de codecs)

### 1. Démarrer en une seule commande (Idéal Famille)
Depuis la racine du projet :
```bash
npm run build
npm start
```
*Le serveur Express écoute sur `http://localhost:3001` et sert directement l'interface web optimisée ainsi que l'API sur le même port.*

### 2. Lancer les tests automatisés (91 tests unitaires & intégration)
```bash
# Tests unitaires & intégration complets (client + serveur) - 91 tests 100% verts
npm test

# Tests d'intégration média réels (FFmpeg + WebTorrent P2P)
cd server && node --test dist/tests/media.test.js

# Tests du sous-système HDMI-CEC et télécommandes TV
node --test server/dist/tests/cecHardware.test.js
node --test client/src/cecRemote.test.ts
```

---

## 🎮 Profils Matériels Spécifiques & Télécommandes HDMI-CEC

Stremo supporte nativement le contrôle par les télécommandes de télévision de salon via le bus **HDMI-CEC** :

1. **Détection Matérielle & Pont Système** :
   - Compatible avec les contrôleurs noyau Linux (`/dev/cec0`, `/dev/cec1`, `/sys/class/cec`), adaptateurs USB Pulse-Eight et Android TV.
   - Pont SSE temps réel (`/api/hardware/cec/events`) diffusant les ordres de télécommande vers l'interface sans latence.

2. **6 Profils Matériels Constructeurs Dédiés** :
   - **HDMI-CEC Universel** : standard HDMI 1.4/2.0/2.1 (Philips EasyLink, Panasonic Viera Link).
   - **Samsung Anynet+** : optimisé pour Samsung Smart Remote / One Remote (Tizen Return 10009).
   - **LG SimpLink** : optimisé pour LG Magic Remote (webOS Back 461, molette et raccourcis).
   - **Sony BRAVIA Sync** : boutons Sync Menu, Info et Action.
   - **Android TV / Shield** : télécommandes Bluetooth AOSP, boîtiers G10/G20 et Nvidia Shield.
   - **Linux HTPC & Raspberry Pi** : adaptateurs Pulse-Eight et bus CEC direct.

3. **Raccourcis des 4 Touches de Couleur (Télécommande TV)** :
   - 🔴 **Touche Rouge** : Basculer les Sous-Titres (Lecteur) / Ouvrir la Recherche (Accueil).
   - 🟢 **Touche Verte** : Piste Audio & Transcodage (Lecteur) / Basculer le Mode TV (Accueil).
   - 🟡 **Touche Jaune** : Marquer un Signet instantané (Lecteur) / Téléchargements (Accueil).
   - 🔵 **Touche Bleue** : Ratio d'aspect & Zoom (Lecteur) / Paramètres (Accueil).

4. **Banc de Test Interactif Intégré** :
   - Accessible dans l'onglet *Paramètres > Télécommande & CEC* : affiche en direct la touche pressée, son code hexadécimal CEC et l'action déclenchée.

---

## 🤖 Pipeline CI/CD GitHub Actions & Releases Automatisées

Deux workflows automatisés assurent la qualité et la distribution continue :

1. **Intégration Continue (`.github/workflows/ci.yml`)** :
   - Déclenché à chaque `push` sur `main` et sur toutes les Pull Requests.
   - Vérification des types TypeScript (`tsc`), compilation Vite, exécution des 91 tests unitaires et intégration.
   - Vérification systématique de la compilabilité des livrables APK et Linux.

2. **Livraison & Signature Automatisée (`.github/workflows/release.yml`)** :
   - Déclenché à chaque tag Git `v*` (ex: `git tag v1.0.1 && git push origin v1.0.1`) ou manuellement via `workflow_dispatch`.
   - Compile le bundle web de production.
   - Génère et signe les paquets natifs finaux :
     - `stremo-v1.0.0-universal.apk` (Android universel)
     - `stremo-android-tv-v1.0.0.apk` (Android TV Leanback 10-pieds)
     - `stremo-linux-x64-v1.0.0.tar.gz` (Archive portable Linux x64)
   - Calcule et vérifie les empreintes cryptographiques SHA-256 (`*.sha256`).
   - Publie automatiquement la release sur GitHub (`gh release create`) avec notes de version détaillées et tous les actifs binaires rattachés.

---

### Support Multi-Plateformes Dédié (Android, Android TV, Linux, Web)

Stremo dispose d'une configuration clé en main pour chaque écran. Consultez le guide complet : [DEPLOY_PLATFORMS.md](file:///home/toto/Documents/stremo/DEPLOY_PLATFORMS.md).

- **📺 Android TV & Box Salon (Expérience 10-pieds)** :
  - Support Leanback et touches CEC dans [android/app/src/main/AndroidManifest.xml](file:///home/toto/Documents/stremo/android/app/src/main/AndroidManifest.xml).
  - Navigation spatiale D-Pad (télécommande ▲▼◄►, OK, Retour).
  - Détection automatique et bascule via touche `T`.
- **📱 Android (Smartphones & Tablettes)** :
  - PWA installable avec icônes maskables et raccourcis.
  - Double-tap rapide tactile (±10s) dans le lecteur vidéo.
  - Configuration Capacitor native dans [capacitor.config.json](file:///home/toto/Documents/stremo/capacitor.config.json) et TWA dans [android/twa-manifest.json](file:///home/toto/Documents/stremo/android/twa-manifest.json).
- **📦 Commandes de Packaging Natif Clé en Main** :
  ```bash
  # Génère l'APK universel signé pour Smartphone Android & Android TV (avec somme SHA-256)
  npm run build:apk

  # Génère l'archive portable autonome pour environnement Linux x86_64
  npm run build:desktop
  ```
- **🐧 Linux (Bureau & Salon)** :
  - Installation en une commande : `./scripts/install-linux.sh`.
  - Exécutable binaire : `stremo` ou `./bin/stremo`.
  - Intégration de bureau XDG : [stremo.desktop](file:///home/toto/Documents/stremo/stremo.desktop).



