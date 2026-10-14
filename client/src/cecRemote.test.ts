import test from 'node:test';
import assert from 'node:assert/strict';
import { cecRemote, CEC_PROFILES } from './services/cecRemote.ts';

test('cecRemote: profils matériels HDMI-CEC disponibles', () => {
  const profiles = cecRemote.getAvailableProfiles();
  assert.ok(profiles.length >= 6);

  const ids = profiles.map((p) => p.id);
  assert.ok(ids.includes('universal_cec'));
  assert.ok(ids.includes('samsung_anynet'));
  assert.ok(ids.includes('lg_simplink'));
  assert.ok(ids.includes('sony_bravia'));
  assert.ok(ids.includes('android_tv'));
  assert.ok(ids.includes('linux_htpc'));
});

test('cecRemote: bascule de profil matériel', () => {
  cecRemote.setActiveProfile('lg_simplink');
  assert.equal(cecRemote.getActiveProfile().id, 'lg_simplink');

  cecRemote.setActiveProfile('universal_cec');
  assert.equal(cecRemote.getActiveProfile().id, 'universal_cec');
});

test('cecRemote: normalisation des touches Smart TV (Samsung, LG, Sony, Android TV)', () => {
  // 1. Touches de couleur CEC (Samsung, LG, Philips, Sony)
  const redEvent = { key: 'ColorF0Red', keyCode: 403 } as KeyboardEvent;
  const redCmd = cecRemote.mapKeyboardEvent(redEvent);
  assert.ok(redCmd);
  assert.equal(redCmd.action, 'color_red');

  const greenEvent = { key: 'ColorF1Green', keyCode: 404 } as KeyboardEvent;
  const greenCmd = cecRemote.mapKeyboardEvent(greenEvent);
  assert.ok(greenCmd);
  assert.equal(greenCmd.action, 'color_green');

  const yellowEvent = { key: 'ColorF2Yellow', keyCode: 405 } as KeyboardEvent;
  const yellowCmd = cecRemote.mapKeyboardEvent(yellowEvent);
  assert.ok(yellowCmd);
  assert.equal(yellowCmd.action, 'color_yellow');

  const blueEvent = { key: 'ColorF3Blue', keyCode: 406 } as KeyboardEvent;
  const blueCmd = cecRemote.mapKeyboardEvent(blueEvent);
  assert.ok(blueCmd);
  assert.equal(blueCmd.action, 'color_blue');

  // 2. Touches de retour Smart TV
  // Samsung Tizen Retour (10009)
  const tizenBack = { key: 'Return', keyCode: 10009 } as KeyboardEvent;
  const tizenCmd = cecRemote.mapKeyboardEvent(tizenBack);
  assert.ok(tizenCmd);
  assert.equal(tizenCmd.action, 'back');

  // LG webOS Retour (461)
  const lgBack = { key: 'Back', keyCode: 461 } as KeyboardEvent;
  const lgCmd = cecRemote.mapKeyboardEvent(lgBack);
  assert.ok(lgCmd);
  assert.equal(lgCmd.action, 'back');

  // 3. Touches Multimédia & Transport
  const playEvent = { key: 'MediaPlay', keyCode: 415 } as KeyboardEvent;
  const playCmd = cecRemote.mapKeyboardEvent(playEvent);
  assert.ok(playCmd);
  assert.equal(playCmd.action, 'play');

  const fastForwardEvent = { key: 'MediaFastForward', keyCode: 228 } as KeyboardEvent;
  const ffCmd = cecRemote.mapKeyboardEvent(fastForwardEvent);
  assert.ok(ffCmd);
  assert.equal(ffCmd.action, 'fast_forward');

  // 4. Sous-titres & Info
  const subEvent = { key: 'Subtitle', keyCode: 460 } as KeyboardEvent;
  const subCmd = cecRemote.mapKeyboardEvent(subEvent);
  assert.ok(subCmd);
  assert.equal(subCmd.action, 'subtitles');

  const infoEvent = { key: 'Info', keyCode: 457 } as KeyboardEvent;
  const infoCmd = cecRemote.mapKeyboardEvent(infoEvent);
  assert.ok(infoCmd);
  assert.equal(infoCmd.action, 'info');
});

test('cecRemote: abonnement et diffusion des événements', () => {
  let receivedAction = '';
  const unsubscribe = cecRemote.subscribe((cmd) => {
    receivedAction = cmd.action;
  });

  cecRemote.simulateAction('play_pause');
  assert.equal(receivedAction, 'play_pause');

  unsubscribe();
  cecRemote.simulateAction('stop');
  // Après désinscription, la variable n'a pas été écrasée par 'stop'
  assert.equal(receivedAction, 'play_pause');
});
