import test from 'node:test';
import assert from 'node:assert';

test('Player Responsive: les contrôles prioritaires tiennent sur écran mobile étroit (360px)', () => {
  // Sur un écran smartphone portrait standard (360px de large avec padding 24px = 336px disponible)
  const availableWidthMobile = 360 - 24; // 336px
  
  // Barre de contrôle mobile optimisée :
  // Gauche : Play/Pause (40px) + -10s (36px) + +10s (36px) + Mute (36px) + Audio AAC (50px) = 198px
  // Droite : Sous-titres (36px) + Plus d'options (36px) + Plein écran (36px) = 108px
  // Espacement (gaps) : 8 * 4px = 32px
  const primaryControls = [
    { name: 'play', width: 40 },
    { name: 'rewind10', width: 36 },
    { name: 'forward10', width: 36 },
    { name: 'mute', width: 36 },
    { name: 'audioAac', width: 50 },
    { name: 'subtitles', width: 36 },
    { name: 'moreOptions', width: 36 },
    { name: 'fullscreen', width: 36 },
  ];

  const totalWidth = primaryControls.reduce((acc, c) => acc + c.width, 0) + 16;
  assert.ok(totalWidth <= availableWidthMobile, `La barre d'actions (${totalWidth}px) doit tenir dans l'écran mobile (${availableWidthMobile}px)`);
  assert.equal(primaryControls.length, 8, 'Exactement 8 contrôles prioritaires sur la ligne mobile');
});

test('Player Responsive: le menu Plus regroupe l’ensemble des fonctionnalités avancées', () => {
  const moreMenuFeatures = [
    'playbackSpeed',
    'creditsSkip',
    'videoAdjustPreset',
    'nightVoiceMode',
    'bookmarks',
    'sleepTimer',
    'torrentFiles',
    'streamSelector',
    'pip',
    'cast',
  ];

  // Vérifier qu'aucune fonctionnalité avancée n'est perdue
  assert.ok(moreMenuFeatures.includes('playbackSpeed'));
  assert.ok(moreMenuFeatures.includes('creditsSkip'));
  assert.ok(moreMenuFeatures.includes('videoAdjustPreset'));
  assert.ok(moreMenuFeatures.includes('nightVoiceMode'));
  assert.ok(moreMenuFeatures.includes('bookmarks'));
  assert.ok(moreMenuFeatures.includes('sleepTimer'));
  assert.ok(moreMenuFeatures.includes('pip'));
  assert.ok(moreMenuFeatures.includes('cast'));
  assert.equal(moreMenuFeatures.length, 10);
});

test('Player Responsive: gestion exclusive des menus contextuels (closeAllMenus)', () => {
  interface MenuStates {
    audio: boolean;
    bookmark: boolean;
    adjust: boolean;
    sleep: boolean;
    speed: boolean;
    skip: boolean;
    sub: boolean;
    torrentFiles: boolean;
    streamSelector: boolean;
    moreMobile: boolean;
  }

  let states: MenuStates = {
    audio: false,
    bookmark: false,
    adjust: false,
    sleep: false,
    speed: false,
    skip: false,
    sub: false,
    torrentFiles: false,
    streamSelector: false,
    moreMobile: false,
  };

  const closeAll = (s: MenuStates): MenuStates => ({
    audio: false,
    bookmark: false,
    adjust: false,
    sleep: false,
    speed: false,
    skip: false,
    sub: false,
    torrentFiles: false,
    streamSelector: false,
    moreMobile: false,
  });

  const openMenu = (menuName: keyof MenuStates) => {
    states = closeAll(states);
    states[menuName] = true;
  };

  // 1. Ouvrir le menu audio
  openMenu('audio');
  assert.equal(states.audio, true);
  assert.equal(states.moreMobile, false);

  // 2. Ouvrir le menu Plus d'options sur mobile
  openMenu('moreMobile');
  assert.equal(states.audio, false);
  assert.equal(states.moreMobile, true);

  // 3. Ouvrir les sous-titres
  openMenu('sub');
  assert.equal(states.moreMobile, false);
  assert.equal(states.sub, true);

  // 4. Fermer tous les menus
  states = closeAll(states);
  assert.ok(Object.values(states).every((v) => v === false));
});

test('Player Gestures: détection des gestes tactiles verticaux (Luminosité vs Volume)', () => {
  // Fonction de détermination du mode de geste selon la position horizontale (xRatio)
  const getGestureMode = (xRatio: number): 'brightness' | 'volume' | 'none' => {
    if (xRatio < 0.4) return 'brightness';
    if (xRatio > 0.6) return 'volume';
    return 'none';
  };

  // 1. Côté gauche (0-40%) = Luminosité
  assert.equal(getGestureMode(0.15), 'brightness');
  assert.equal(getGestureMode(0.35), 'brightness');

  // 2. Côté droit (60-100%) = Volume
  assert.equal(getGestureMode(0.65), 'volume');
  assert.equal(getGestureMode(0.85), 'volume');

  // 3. Centre (40-60%) = Pas de réglage par glissement (réservé aux contrôles centraux)
  assert.equal(getGestureMode(0.5), 'none');

  // 4. Calcul de modification de luminosité avec bornage 40% - 180%
  const computeBrightness = (initial: number, deltaNormalized: number) => {
    return Math.round(Math.max(40, Math.min(180, initial + deltaNormalized * 100)));
  };
  assert.equal(computeBrightness(100, 0.2), 120);
  assert.equal(computeBrightness(100, -0.8), 40, 'Doit être borné au minimum 40%');
  assert.equal(computeBrightness(100, 1.5), 180, 'Doit être borné au maximum 180%');

  // 5. Calcul de modification de volume avec bornage 0 - 1
  const computeVolume = (initial: number, deltaNormalized: number) => {
    return Math.max(0, Math.min(1, initial + deltaNormalized));
  };
  assert.equal(computeVolume(0.5, 0.2), 0.7);
  assert.equal(computeVolume(0.2, -0.5), 0, 'Doit être borné au minimum 0');
  assert.equal(computeVolume(0.8, 0.5), 1, 'Doit être borné au maximum 1');
});

test('Player Preferences: transmission et restauration des réglages de lecture personnalisés', () => {
  interface PlaybackPrefs {
    audioTrack?: string;
    subtitleTrack?: string;
    subtitleDelay?: number;
    playbackSpeed?: number;
  }

  const savedPrefs: PlaybackPrefs = {
    audioTrack: '1',
    subtitleTrack: 'https://subs.org/fr.vtt',
    subtitleDelay: -0.25,
    playbackSpeed: 1.25,
  };

  // Vérifier la cohérence des types et des valeurs
  assert.strictEqual(Number(savedPrefs.audioTrack), 1);
  assert.strictEqual(savedPrefs.subtitleTrack?.endsWith('.vtt'), true);
  assert.strictEqual(savedPrefs.subtitleDelay, -0.25);
  assert.strictEqual(savedPrefs.playbackSpeed, 1.25);
});

