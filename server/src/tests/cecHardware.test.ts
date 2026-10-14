import test from 'node:test';
import assert from 'node:assert/strict';
import { cecBridge, CEC_PROFILES, CEC_OPCODE_MAP } from '../cecBridge.js';

test('CecHardwareBridge: statut matériel et profils disponibles', () => {
  const status = cecBridge.getStatus();
  assert.ok(typeof status.available === 'boolean');
  assert.ok(status.profiles.length >= 6);
  assert.equal(status.activeProfile, 'universal_cec');

  // Vérification de la présence des profils TV constructeurs
  const profileIds = status.profiles.map((p) => p.id);
  assert.ok(profileIds.includes('universal_cec'), 'Profil Universel requis');
  assert.ok(profileIds.includes('samsung_anynet'), 'Profil Samsung requis');
  assert.ok(profileIds.includes('lg_simplink'), 'Profil LG requis');
  assert.ok(profileIds.includes('sony_bravia'), 'Profil Sony requis');
  assert.ok(profileIds.includes('android_tv'), 'Profil Android TV requis');
  assert.ok(profileIds.includes('linux_htpc'), 'Profil Linux HTPC requis');
});

test('CecHardwareBridge: sélection et validation de profil', () => {
  const success = cecBridge.setProfile('samsung_anynet');
  assert.equal(success, true);
  assert.equal(cecBridge.getActiveProfile().id, 'samsung_anynet');

  // Profil inconnu refusé
  const invalid = cecBridge.setProfile('invalid_vendor_profile');
  assert.equal(invalid, false);
  assert.equal(cecBridge.getActiveProfile().id, 'samsung_anynet');

  // Retour au profil universel
  cecBridge.setProfile('universal_cec');
  assert.equal(cecBridge.getActiveProfile().id, 'universal_cec');
});

test('CecHardwareBridge: décodage des opcodes HDMI-CEC standard et touches couleur', () => {
  // Test 0x44 (Play)
  const playCmd = cecBridge.decodeCecOpcode(0x44, 'hardware');
  assert.ok(playCmd);
  assert.equal(playCmd.action, 'play');
  assert.equal(playCmd.code, 0x44);
  assert.equal(playCmd.hexCode, '0x44');
  assert.equal(playCmd.source, 'hardware');

  // Test 0x46 (Pause)
  const pauseCmd = cecBridge.decodeCecOpcode(0x46);
  assert.ok(pauseCmd);
  assert.equal(pauseCmd.action, 'pause');

  // Test 0x71 (Red / Sous-titres)
  const redCmd = cecBridge.decodeCecOpcode(0x71);
  assert.ok(redCmd);
  assert.equal(redCmd.action, 'color_red');

  // Test 0x72 (Green / Audio)
  const greenCmd = cecBridge.decodeCecOpcode(0x72);
  assert.ok(greenCmd);
  assert.equal(greenCmd.action, 'color_green');

  // Test 0x73 (Yellow / Signets)
  const yellowCmd = cecBridge.decodeCecOpcode(0x73);
  assert.ok(yellowCmd);
  assert.equal(yellowCmd.action, 'color_yellow');

  // Test 0x74 (Blue / Ratio)
  const blueCmd = cecBridge.decodeCecOpcode(0x74);
  assert.ok(blueCmd);
  assert.equal(blueCmd.action, 'color_blue');

  // Opcode non mappé
  const unknownCmd = cecBridge.decodeCecOpcode(0xfe);
  assert.equal(unknownCmd, null);
});

test('CecHardwareBridge: simulation et émission d\'événements', (t, done) => {
  const simulated = cecBridge.simulateCommand('fast_forward');
  assert.equal(simulated.action, 'fast_forward');
  assert.equal(simulated.source, 'simulated');
  assert.equal(simulated.hexCode, '0x49');
  done();
});
