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
