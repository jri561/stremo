# Stremo — Présentation, Bilan & Plan de Développement Futur 🚀

Stremo est une plateforme de streaming moderne, ultra-rapide et conviviale, conçue pour réunir le meilleur de **Nuvio** et **Stremio** dans une expérience tout-en-un fluide, sécurisée et adaptée à tous les membres de la famille (du plus jeune enfant aux grands-parents).

---

## 📖 1. Présentation Générale du Projet

### 🎯 La Vision
La plupart des applications de streaming communautaires existantes souffrent de défauts majeurs :
- **Stremio** est puissant grâce à son écosystème d'add-ons, mais son interface reste austère, complexe à paramétrer pour des non-initiés, dépourvue de profils étanches avec contrôle parental sérieux, et n'intègre pas les fonctions ergonomiques modernes (saut d'intro/outro, filtrage instantané debrid, casting interactif).
- **Nuvio** propose une esthétique soignée mais peut manquer de modularité et d'une prise en charge native des protocoles multi-lecteurs et multi-formats.

**Stremo combine les deux forces :**
1. **La puissance technique de Stremio** : compatible avec 100% des add-ons Stremio (v3), proxification parallèle rapide (`Promise.allSettled`), masquage des jetons privés Debrid/AIOStreams, support des flux 4K HDR, Dolby Vision et Dolby Atmos.
2. **L'élégance et le confort de Nuvio** : design immersif sombre (palette `#07090e`), bannières cinéma en haute définition, fiches détaillées interactives, carrousels réactifs, lecteur tout équipé avec saut de générique.
3. **Une orientation familiale sans compromis** : isolation complète multi-profils (historique, reprise, favoris), mode Enfant étanche filtrant automatiquement les genres violents, et protection des profils adultes par code PIN.

---

## ✅ 2. Ce qui a été fait (Bilan des Réalisations)

### 🎨 A. Interface & Expérience Utilisateur (UI/UX)
- **Accueil Immersif (HeroBanner)** : carrousel rotatif d'arrière-plans haute fidélité avec synopsis, genres, notes IMDb authentiques et bouton « Lecture rapide » en un clic.
- **Rails de Contenu & Affiches Nuvio-style (CatalogRow)** :
  - Défilement fluide horizontal avec boutons de navigation et support complet clavier / télécommande (D-Pad).
  - Bouton de lecture centré animé au survol avec effet de flou arrière-plan.
  - Badges de notes IMDb dorés et indicateur clair du temps restant (« Reste 24m » ou « S1E3 • Reste 18m »).
  - Barre de reprise de lecture profilée sous les affiches.
- **Vue d'Exploration Multi-Catalogues (DiscoverView)** :
  - Sélecteur de type Films / Séries avec compteurs réactifs.
  - Carrousel horizontal des catalogues configurés (TMDB Popular, Netflix, Disney+, etc.).
  - Filtres de genres cinématographiques en pilules interactives.
  - Filtre local instantané en temps réel sans latence réseau.
  - Tri multi-critères : Recommandé, Note IMDb décroissante, Année décroissante, Alphabétique (A-Z).
  - Double mode d'affichage : Grille aérée (5 colonnes) et Liste détaillée.
- **Vue de Recherche Intelligente Dédiée (SearchView)** :
  - Barre de recherche principale avec auto-focus et raccourci global `/` ou `Ctrl+K`.
  - Recherche simultanée en parallèle sur films et séries avec debounce optimisé à 180 ms.
  - Historique des recherches mémorisé localement avec relance en un clic et nettoyage individuel/global.
  - Suggestions de recherche en un clic (Tendances 2026, Batman, Marvel, Science-Fiction, Action, Animation, Netflix).
  - Filtres dynamiques avec compteurs en direct (`Tous`, `Films`, `Séries`).

### 🎬 B. Fiche Média Détaillée & Gestion des Flux (MediaModal)
- **Analyse Avancée des Flux (AIOStreams / Torrentio)** :
  - Détection automatique et badges visuels : Résolution (4K, 1080p, 720p), Fournisseur Debrid (⚡ Real-Debrid, ⚡ Torbox, ⚡ AllDebrid), Codecs (HEVC, AVC), HDR / Dolby Vision, Audio (Atmos, 5.1), taille du fichier et drapeaux de langues (VF, VOST).
  - **Filtre instantané Debrid (`⚡ Debrid`)** : isolation en 1 clic des flux hébergés prêts pour la lecture immédiate sans mise en mémoire tampon.
  - Filtres par résolution (`Toutes`, `4K`, `1080p`, `720p`).
  - Classement intelligent priorisant le confort de lecture selon le lecteur choisi.
- **Navigation Épisodes & Suivi des Épisodes Vus** :
  - Sélecteur de saison et grille d'épisodes avec miniatures, résumés et numérotation.
  - **Badges d'épisodes vus (`Vu ✓`)** directement affichés sur les vignettes.
  - Bouton d'action 1-clic pour marquer ou démarquer un épisode comme vu.
- **Distribution & Filmographie Interactive** :
  - Galerie complète des acteurs et du réalisateur avec photos et noms de rôles.
  - **Recherche filmographique au clic** : cliquer sur un acteur ou un réalisateur ouvre directement sa filmographie dans l'onglet de recherche.
- **Bande-annonce Officielle** : lecteur YouTube intégré sans quitter l'application.

### ⚡ C. Lecteur Vidéo Next-Gen, Diffusion & Binge-Watching (VideoPlayer)
- **Google Cast & Apple AirPlay Intégrés** :
  - Diffusion en un clic sur TV de salon, Chromecast et récepteurs AirPlay via les API standard W3C Remote Playback et Apple WebKit.
- **Téléchargement Hors-Ligne Direct** :
  - Bouton de téléchargement 1-clic sur chaque flux direct HTTP / Debrid pour emporter ses films et séries hors connexion.
- **Saut d'Intro Intelligent & Adaptatif** :
  - **Priorité 1 (AniSkip / Chapitres communautaires)** : saut exact à la seconde près avec timecode affiché (`01:05 → 02:35`).
  - **Priorité 2 (Standard Animes Japonais)** : détection automatique du format anime avec durée standard absolue des télévisions japonaises (TV Tokyo / MBS) fixée à **90 secondes** (1 min 30 s), libellé dynamique « Passer l'opening (+90s) ».
  - **Priorité 3 (Formats Courts / Sitcoms)** : durée de **25 secondes** pour les épisodes de 20-25 minutes.
  - **Priorité 4 (Séries dramatiques standard)** : durée de **80 secondes** par défaut (ajustable dans les paramètres).
  - **Priorité 5 (Films)** : aucun saut d'intro aveugle arbitraire proposé afin de préserver l'intégrité de la scène d'ouverture.
  - Option de saut automatique transparent avec notification toast.
- **Saut du Générique de Fin (Outro / Credits Skip & Binge-Watching)** :
  - Détection automatique dès l'entrée dans le générique de fin (seuil configurable : 90s, 75s, 45s, 20s avant la fin).
  - Bandeau élégant « Générique de fin détecté • Épisode suivant » avec compte à rebours 10s et bouton de saut immédiat (`Touche N`).
  - Bouton pour rester sur le générique si l'utilisateur souhaite regarder une scène post-crédits.
- **Gestion des Sous-titres & Esthétique Cinématique** :
  - **Normalisation multilingue ISO 639-1 / 639-2** : drapeaux emoji lisibles (🇫🇷, 🇬🇧, 🇪🇸, 🇯🇵, etc.), libellés complets en français, détection automatique des variantes `Forcé`, `SDH / CC` et import local.
  - **Regroupement et filtrage par langue** : onglets par langue (« Tous », « 🇫🇷 Français (12) », etc.) et barre de recherche textuelle rapide.
  - **Rendu cinématique haute fidélité** : typographie moderne anti-crénelée, ombres portées nettes et anti-reflet garantissant une lisibilité parfaite sur fond clair comme sombre.
  - **Palette de couleurs** : Blanc classique, Jaune Cinéma 🎬 (`#facc15`), Cyan moderne (`#67e8f9`).
  - **Arrière-plans modulables** : Ombre seule pure cinéma, Translucide doux (`rgba(10, 14, 23, 0.65)`), Boîte opaque (`rgba(0, 0, 0, 0.9)`).
  - **Tailles de texte progressives** : Fin (0.95rem), Standard (1.2rem), Grand (1.5rem), Maxi (1.9rem).
  - **Synchronisation temporelle à la volée** : réglage fin (`-0.5s`, `0s (Reset)`, `+0.5s`) avec persistance des préférences.
- **Panneau de Réglages Global de l'Application (`SettingsModal`)** :
  - Choix de la langue audio principale préférée et de la langue des sous-titres par défaut.
  - Règle intelligente d'activation automatique : `Intelligent (VOSTFR)` (activé si l'audio diffère de la langue préférée, masqué en VF), `Toujours`, `Désactivé`.
  - Cadre de prévisualisation en direct de l'apparence des sous-titres.
  - Configuration du saut d'intro, du seuil de binge-watching et du lecteur par défaut.
  - Persistance double transparente dans le profil SQLite distant et le stockage local immédiat.
- **Contrôles et Fonctionnalités Avancées** :
  - Vitesse de lecture (0.5x à 2.0x).
  - Mode Picture-in-Picture (PiP) natif.
  - Raccourcis clavier universels (Espace/K, F, M, N, S, T, D, Flèches).
  - Lancement direct dans les lecteurs externes desktop : **VLC**, **MPV**, lecteur système (`xdg-open`).
  - Support des Intents Android : **Just Player**, **Nova Video Player**, **MX Player**.

### 🛡️ D. Multi-Profils & Sécurité Parentale
- Mode « Gérer les profils » inspiré de Netflix avec édition du nom, de l'avatar et du PIN.
- **Mode Enfants hermétique** : filtrage algorithmique strict bannissant tout contenu violent, horrifique ou adulte et préservant les animations et contenus familiaux.
- **Contrôle Parental par Code PIN** : verrouillage instantané interdisant le passage d'un profil enfant à un profil adulte sans le PIN correct.
- **Isolation totale** en base SQLite des historiques, temps de visionnage et favoris entre chaque membre du foyer.

### 🌐 E. Trakt.tv & Synchronisation Multi-Écrans
- **Scrobbler Trakt.tv Bidirectionnel** :
  - Association de jeton d'accès personnel Trakt par profil.
  - Scrobble automatique en direct lors de la lecture (`start`), de la pause (`pause`) et de la fin de vidéo (`stop` avec historique marqué « Vu » dès 80%).
  - Proxy backend sécurisé `/api/trakt/scrobble` avec en-têtes officiels Trakt v2.
- **Sauvegarde & Migration Multi-Écrans (Export / Import 1-Clic)** :
  - Exportation complète en un clic (profils, add-ons, favoris, historique de lecture).
  - Téléchargement au format JSON et copie directe dans le presse-papier.
  - Restauration multi-écrans avec modes **Fusion intelligente** et **Écrasement complet**.

### 📦 F. Infrastructure, PWA & Add-ons
- **Progressive Web App (PWA)** : Web App Manifest, Service Worker et installation en 1 clic sur Android, iOS, Windows et Mac.
- **Navigation Télécommande / Clavier (D-Pad)** : focus rings indigo haute visibilité pour usage sur Smart TV et box de salon.
- **Suite de tests automatisés** : 51 tests unitaires et d'intégration (31 serveur + 20 client) et 14 scénarios End-to-End dans Chromium réel Playwright (`npm test` & `node audit_chromium_e2e.mjs`, 100% au vert).

---

## 🔮 3. Plan de Développement Futur (Roadmap)

Le développement futur de Stremo s'articule en 3 phases progressives et pragmatiques :

```mermaid
flowchart LR
    A["Phase 1 : Trakt & Sync Multi-Écrans (Terminé ✓)"] --> B["Phase 2 : Écosystème Salon & TV"]
    B --> C["Phase 3 : Haute Performance & P2P"]
```

### 📍 Phase 1 : Synchronisation Externe & Continuité Multi-Écrans (Terminé ✓)
1. **Intégration Trakt.tv Bidirectionnelle** :
   - ✅ Scrobble en temps réel (start/pause/stop) et marquage automatique des épisodes et films vus.
   - ✅ Gestion sécurisée des jetons par profil utilisateur.
2. **Synchronisation Multi-Appareils (Sauvegarde 1-Clic)** :
   - ✅ Export JSON et presse-papier pour transfert instantané PC / Mobile / Android TV.
   - ✅ Restauration en mode fusion intelligente ou écrasement.
3. **Diffusion Google Cast & Apple AirPlay** :
   - ✅ Bouton de diffusion intégré dans le lecteur vidéo.
4. **Téléchargements Locaux Hors-Ligne** :
   - ✅ Téléchargement direct 1-clic pour les flux Debrid et HTTP.
5. **Proxy de Streaming Anti-CORS & Convertisseur WebVTT** :
   - ✅ Proxy HTTP 206 Range (`/api/proxy/stream`) contournant les restrictions CORS des CDN distants (Torbox, Real-Debrid).
   - ✅ Conversion automatique et normalisation WebVTT (`/api/proxy/subtitle`) pour 100% des sous-titres OpenSubtitles.
6. **Base Communautaire de Chapitrage (AniSkip / TheTVDB Chaptering)** :
   - ✅ Détection des génériques basée sur les timecodes exacts vérifiés par la communauté pour un saut d'intro/outro au millième de seconde près.

### 📍 Phase 2 : Écosystème Salon, Android TV, Sync Foyer, LAN & Télécommande SSE (Terminé ✓)
1. **Appairage Express TV / PC / Mobile & Synchro Continue** :
   - ✅ Code PIN 6 caractères & QR Code pour appairer n'importe quel écran TV en 5 secondes sans saisir de mot de passe.
   - ✅ Appairage instantané sub-50ms via Server-Sent Events (SSE).
   - ✅ Découverte automatique des appareils sur le réseau local Wi-Fi (Zero-Conf LAN Discovery) avec association en 1 clic.
   - ✅ Télécommande mobile tactile temps réel (Play/Pause, saut +/-10s, volume, saut intro, épisode suivant).
   - ✅ Canal de synchronisation continue du foyer (Family Sync Hub) avec auto-push et auto-pull en tâche de fond.
2. **Interface Salon 10-Pieds (10-Foot UI)** :
   - ✅ Détection automatique des appareils Smart TV (Android TV, Tizen, WebOS, Fire TV, Chromecast).
   - ✅ Raccourci clavier / télécommande `T` et bouton dédié pour activer le mode TV.
   - ✅ Affiches et typographie agrandies haute lisibilité, focus rings amplifiés, bandeau d'assistance télécommande.
3. **Préférences Linguistiques Intelligentes & Rail « Ma Liste »** :
   - ✅ Détection automatique de la langue audio du flux (VF, MULTI, VO) et activation intelligente des sous-titres (VOSTFR).
   - ✅ Rail « Ma Liste » intégré sur l'écran d'accueil avec synchronisation multi-écrans.
4. **Auto-Fallback & Sélecteur de Flux en Direct** :
   - ✅ Basculement automatique transparent vers le flux suivant en cas d'erreur de lecture (compte à rebours 3s).
   - ✅ Sélecteur de flux en direct dans le lecteur vidéo sans interruption (`Flux (N)`).
5. **Mode Nuit & Boost Dialogues Audio** :
   - ✅ Compresseur dynamique audio Web Audio API pour adoucir les déflagrations et magnifier les dialogues de nuit.
6. **Saut Automatique d'Intro & Vérification Debrid** :
   - ✅ Saut automatique d'intro configurable par profil (+85s par défaut).
   - ✅ Endpoint de suivi du statut et des jours d'abonnement Real-Debrid et Torbox.
7. **« Lecture Rapide 1-Clic » (Smart Instant Autoplay)** :
   - ✅ Résolution automatique en arrière-plan et sélection instantanée du meilleur flux adapté aux préférences de langue du profil (VF/VOSTFR) et compatibilité web sans étape intermédiaire.
8. **Gestionnaire de Téléchargements Hors-Ligne Dédié** :
   - ✅ Interface complète des vidéos téléchargées, forçage d'en-tête HTTP `Content-Disposition`, re-téléchargement et lecture directe hors-ligne (`Alt+D`).
9. **Tableau de Bord & Statistiques de Visionnage (« Mes Statistiques »)** :
   - ✅ Suivi du temps de visionnage total, compteur de médias terminés, série la plus dévorée (Top Binge), répartition des genres favoris et badges cinéphiles.
10. **Contrôles Vidéo Étendus & Sleep Timer** :
   - ✅ Sélecteur de vitesse de lecture de 0.5x à 2.0x avec raccourcis clavier `[` et `]`, bascule directe Mode Nuit `D`.
   - ✅ Minuteur de mise en veille (Sleep Timer) configurable (15m, 30m, 45m, 60m, Fin d'épisode / touche `T`) avec fondu sonore sur les 5 dernières secondes.
   - ✅ OSD HUD éphémère centré sur les raccourcis de volume, vitesse, seek et mode nuit.
11. **Glisser-Déposer & Import de Sous-Titres Locaux (.srt / .vtt)** :
   - ✅ Détection de drag-and-drop sur la vidéo et bouton d'importation dans le menu sous-titres avec conversion WebVTT instantanée.
12. **Rail Dynamique « ⚡ À Suivre / Prochains Épisodes » (Next Up Queue)** :
   - ✅ File de lecture intelligente prédisant automatiquement l'épisode suivant (`S{s}E{e+1}`) dès qu'un épisode est vu à plus de 85%, avec badge émeraude et lancement 1-clic.
13. **Cache Intelligent Multi-Niveaux SQLite (`cache_store`)** :
   - ✅ Persistance en base SQLite des métadonnées (TTL 24h), catalogues (TTL 15m), flux de streaming (TTL 4m) et sous-titres (TTL 1h) pour une réactivité instantanée et une résilience réseau totale.
14. **Store d'Add-ons Communautaires Intégré (`AddonManager`)** :
   - ✅ Catalogue de 13 add-ons vérifiés, navigation par catégories (`Flux & Debrid`, `Catalogues SVOD`, `Sous-titres`, `Animés`, `Médias & Live`), filtrage en temps réel et installation 1-clic.
15. **Support Avancé Magnet & P2P Torrent (Free Streaming sans Debrid)** :
   - ✅ Détection des flux `magnet:`, comptage des seeders (`👤 87 seeders`), badge `🧲 P2P Torrent`, bouton « Copier le lien magnet » et routage externe vers VLC / MPV.
16. **Packaging Desktop Natif & Mode Fenêtre Dédié** :
   - ✅ Script `npm run desktop` avec accélération GPU Vaapi, raccourci système `stremo.desktop`, et structure Electron (`electron/main.cjs`).
17. **Égaliseur d'Image Vidéo & Ratios d'Aspect Dynamiques** :
   - ✅ 5 ratios d'aspect commutables (`contain`, `cover`, `16/9`, `21/9`, `4/3`), raccourci clavier `A` et affichage OSD HUD centré.
   - ✅ Égaliseur d'image GPU : réglage temps réel de la Luminosité, Contraste et Saturation (0% à 200%).
   - ✅ 4 profils cinéma instantanés : Standard, Cinéma Sombre, Éclatant (Vivid), Noir & Blanc Rétro.
18. **Signets Personnels & Marqueurs Interactifs de Timeline** :
   - ✅ Mémorisation instantanée par touche `B` ou via l'interface avec titre personnalisé.
   - ✅ Marqueurs ambrés interactifs positionnés fidèlement sur la barre de progression avec saut instantané.
   - ✅ Tiroir de consultation et suppression des signets avec persistance SQLite étanche par profil.
19. **Fiche Artiste & Filmographie Complète (`PersonModal`)** :
   - ✅ Navigation fluide par acteur ou réalisateur depuis la fiche média.
   - ✅ Exploration et regroupement automatique des œuvres associées dans les catalogues.
   - ✅ Lancement et ouverture directe des films et séries de la filmographie sans quitter le contexte.

### 📍 Phase 3 : Streaming Torrent WebTorrent In-Browser (Terminé ✓) & Transcodage Audio Universel (Terminé ✓)
1. **Streaming Torrent WebTorrent Embarqué (Séquentiel en Direct)** :
   - ✅ Moteur WebTorrent optimisé côté serveur Express (`server/src/torrentEngine.ts`) avec initialisation paresseuse et téléchargement séquentiel des pièces vidéo.
   - ✅ Support complet HTTP 206 `Partial Content` et `Range Requests` permettant le saut direct (seek) dans la timeline sans attendre le fichier complet.
   - ✅ Sélection automatique du fichier vidéo principal (`.mp4`, `.mkv`, `.webm`) et désélection des fichiers superflus pour économiser la bande passante.
   - ✅ **Sélecteur de fichiers & épisodes internes du torrent** : navigation multi-fichiers directe dans le lecteur vidéo (`Épisodes Torrent (N)`) pour regarder n'importe quel épisode d'un pack de saison en 1 clic.
   - ✅ Télémétrie P2P en temps réel dans le header du lecteur vidéo : affichage du débit (Mo/s), du nombre de pairs connectés et du pourcentage téléchargé.
   - ✅ Bouton 1-clic « ⚡ Lire P2P » directement dans le lecteur web avec conservation du lancement externe VLC (`vlc`).
2. **Transcodage & Remuxing Audio Universel à la Volée (FFmpeg)** :
   - ✅ Moteur de remuxing temps réel (`server/src/transcodeEngine.ts`) convertissant toute piste audio incompatible (Dolby AC3, EAC3, DTS, TrueHD) vers AAC 192k stéréo universel dans un conteneur MP4 fragmenté.
   - ✅ Copie de flux vidéo sans réencodage (`-c:v copy`) pour une charge processeur quasi-nulle (0% CPU vidéo).
   - ✅ Bascule automatique progressive en cascade en cas d'erreur de décodage navigateur.
   - ✅ Bouton de réparation manuelle 1-clic « ⚡ Réparer & Lire directement (Transcodage AAC) » dans le panneau de secours.
   - ✅ Sonde d'analyse technique FFprobe (`/api/transcode/probe`).

---

## 🎤 4. Plan de Présentation & Guide de Démonstration

Ce plan est conçu pour présenter le projet à des proches, des utilisateurs finaux ou des contributeurs techniques.

### ⏱️ Pitch en 30 Secondes (L'Elevator Pitch)
> « Stremo est une plateforme de streaming open source moderne qui réunit toute votre médiathèque en un seul endroit. Compatible avec tous les add-ons Stremio, elle offre une interface soignée inspirée de Nuvio, une lecture 4K instantanée sans attente via Debrid, le saut intelligent des génériques d'intro et de fin, et un vrai contrôle parental multi-profils avec code PIN. C'est l'application familiale par excellence : aussi simple pour un enfant de 6 ans que pour ses grands-parents. »

### 🎬 Déroulé de Démonstration Pas à Pas (10 Minutes)

| Étape | Action démontrée | Effet recherché |
| :--- | :--- | :--- |
| **1. Accueil & Profils (1 min)** | Démarrer l'application, montrer le sélecteur de profils avec avatars colorés. Sélectionner le profil « Principal ». | Montrer l'immédiateté et la clarté visuelle type Netflix. |
| **2. Le Billboard & Accueil (2 min)** | Faire défiler le carrousel cinéma en haut, puis les rails horizontaux. Pointer le bouton de lecture centré au survol et le temps restant (« Reste 24m »). | Souligner la fluidité et le design épuré sans publicité ni surcharge. |
| **3. Recherche Instantanée (1 min)** | Taper `/`, entrer « Batman ». Montrer la recherche simultanée films/séries en 180 ms et les filtres de catégories. | Prouver la rapidité foudroyante face aux lenteurs de Stremio officiel. |
| **4. Fiche Média & Filtres Debrid (2 min)** | Ouvrir un film. Montrer l'analyse des flux, le filtre `⚡ Debrid`, et cliquer sur un acteur pour ouvrir sa filmographie. | Démontrer la valeur ajoutée pour les cinéphiles et utilisateurs de Real-Debrid. |
| **5. Le Lecteur & Saut de Générique (2 min)** | Lancer une série. Cliquer sur « Passer l'intro (+85s) ». Avancer vers la fin pour voir le bandeau d'épisode suivant apparaître dès le début du générique de fin. | **Moment fort ("Whaou")** : confort de binge-watching identique aux plateformes payantes. |
| **6. Sécurité & Mode Enfant (2 min)** | Basculer sur le profil « Enfants » : constater la disparition de tout contenu violent. Tenter de revenir sur « Principal » : le code PIN bloque l'accès. | Rassurer les parents sur la protection familiale totale. |

---

## 📱 4. Architecture Multi-Plateformes & Système Multi-Comptes Distants

En réponse à la vision long terme de Stremo, cette section détaille la stratégie technique pour le déploiement sur tous les écosystèmes et la synchronisation inter-comptes.

### 🌐 A. Déclinaisons Multi-Plateformes

```
┌────────────────────────────────────────────────────────────────────────┐
│                          STREMO CORE APP                               │
│       React 19 + TypeScript + Vite + Tailwind CSS + Web Audio/Video    │
└──────────────┬──────────────────┬──────────────────┬───────────────────┘
               │                  │                  │
               ▼                  ▼                  ▼
    ┌──────────────────────┐ ┌─────────┐ ┌──────────────────────┐
    │  Android / Fire TV   │ │ Web App │ │    Linux Desktop     │
    │  Capacitor / Leanback│ │   PWA   │ │   Tauri / Flatpak    │
    │  ExoPlayer / Intents │ │ Offline │ │   Hardware Vaapi     │
    └──────────────────────┘ └─────────┘ └──────────────────────┘
```

1. **Android Mobile & Tablette (APK / Capacitor)** :
   - Conteneur WebView haute performance via **Capacitor** ou TWA (Trusted Web Activity).
   - Prise en charge native des Intents vidéo Android pour diffuser vers **Just Player**, **VLC** ou le lecteur interne ExoPlayer.
   - Gestion des gestes tactiles (glissement vertical pour luminosité et volume, double tap seek).

2. **Android TV & Smart Box (Google TV / Fire TV)** :
   - Détection automatique Leanback et activation automatique du `tv-mode-active` (tuiles agrandies, focus rings contrastés, bandeau télécommande).
   - Support total du D-Pad télécommande (haut, bas, gauche, droite, Enter/Select, Back).
   - Intégration du canal de recommandation de l'écran d'accueil Android TV (Next Up rows).

3. **Web App (PWA Universelle)** :
   - Installable en 1 clic sans passer par un magasin d'applications (`beforeinstallprompt`).
   - Service Worker pour la mise en cache des assets statiques et fonctionnement fluide hors-ligne.
   - Compatibilité totale navigateurs desktop et mobiles (Chrome, Firefox, Safari, Edge).

4. **Linux Desktop (Tauri / AppImage / Flatpak)** :
   - Application native ultra légère basée sur **Tauri** (backend Rust + WebView Linux `webkit2gtk`), produisant un binaire de moins de 15 Mo avec une consommation mémoire inférieure à 60 Mo de RAM.
   - Décodage matériel GPU natif (VA-API / NVDEC).
   - Fichier `.desktop` avec association de protocole URL `stremo://` et lancement direct dans MPV ou VLC sans latence.

---

### 👥 B. Système de Comptes Multi-Utilisateurs & Synchronisation Distante

Pour permettre à plusieurs utilisateurs ou foyers de disposer de leurs propres environnements totalement indépendants et synchronisés en temps réel :

1. **Structure de Données Distante (SQLite / PostgreSQL)** :
   - **Table `users`** :
     - `id`: UUID unique
     - `email`: adresse email vérifiée
     - `password_hash`: hachage fort moderne (Argon2id ou Scrypt avec salt)
     - `sync_token`: clé cryptographique de synchronisation multi-appareils
     - `role`: 'admin' | 'user'
     - `created_at`: date de création
   - **Table `profiles`** (liée à `user_id`) :
     - Chaque compte utilisateur possède ses propres profils (ex: Papa, Maman, Enfant).
     - Isolation stricte des favoris, historiques, signets et configurations d'add-ons par `user_id`.

2. **Flux d'Authentification & Sécurité** :
   - Authentification par jeton de session sécurisé (JWT en cookie HTTP-Only avec `SameSite=Lax` et flag `Secure`).
   - Protection contre le brute-force : limitation de débit (rate limiting) sur les routes `/api/auth/login`.
   - Changement et réinitialisation de mot de passe sécurisés.

3. **Moteur de Synchronisation Temps Réel (Cloud Sync Hub)** :
   - Synchronisation bidirectionnelle automatique (WebSocket ou SSE) : toute action effectuée sur un appareil (ex: film mis en pause à 42:15 sur smartphone) se reflète instantanément sur la TV du salon connectée au même compte.
   - Résolution automatique des conflits basée sur l'horodatage le plus récent (CRDT / Last-Write-Wins avec timecode le plus avancé).

---

## 💻 5. Commandes Utiles pour le Déploiement

### Installation des Dépendances
```bash
npm install
npm run install:all
```

### Lancement en Mode Développement
```bash
# Terminal 1 : Backend Express
npm run dev --prefix server

# Terminal 2 : Frontend Vite
npm run dev --prefix client
```

### Lancement de la Suite de Tests
```bash
npm test
```

### Compilation & Déploiement Production
```bash
npm run build
npm run start --prefix server
```

---

*Stremo est développé avec passion pour offrir l'expérience de streaming la plus libre, rapide et élégante du web.*
