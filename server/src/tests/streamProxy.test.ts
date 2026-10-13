import test from 'node:test';
import assert from 'node:assert';
import { convertSrtToVtt } from '../streamProxy.js';
import { syncEmitter, notifyPairSuccess, sendRemoteCommand } from '../syncEvents.js';

test('convertSrtToVtt convertit fidèlement les timestamps SRT en WebVTT', () => {
  const srtSample = `1
00:01:20,123 --> 00:01:24,456
Bonjour tout le monde !

2
00:01:25,789 --> 00:01:29,012
Bienvenue sur Stremo.
`;

  const vtt = convertSrtToVtt(srtSample);
  assert.ok(vtt.startsWith('WEBVTT\n\n'));
  assert.ok(vtt.includes('00:01:20.123 --> 00:01:24.456'));
  assert.ok(vtt.includes('00:01:25.789 --> 00:01:29.012'));
  assert.ok(vtt.includes('Bienvenue sur Stremo.'));
});

test('convertSrtToVtt ne duplique pas l\'en-tête si déjà WebVTT', () => {
  const existingVtt = `WEBVTT

1
00:00:10.000 --> 00:00:15.000
Déjà en format WebVTT.
`;
  const result = convertSrtToVtt(existingVtt);
  assert.equal(result.startsWith('WEBVTT\n\n'), true);
  // Vérifie qu'il n'y a pas deux fois WEBVTT
  const occurrences = (result.match(/WEBVTT/g) || []).length;
  assert.equal(occurrences, 1);
});

test('syncEvents émet les événements d\'appairage et de télécommande en temps réel', () => {
  let pairReceived: any = null;
  let remoteReceived: any = null;

  const code = 'TEST99';

  syncEmitter.once(`pair:${code}`, (data) => {
    pairReceived = data;
  });

  syncEmitter.once(`remote:${code}`, (cmd) => {
    remoteReceived = cmd;
  });

  notifyPairSuccess(code, { profiles: ['p1'] });
  sendRemoteCommand(code, { action: 'pause' });

  assert.deepEqual(pairReceived, { profiles: ['p1'] });
  assert.deepEqual(remoteReceived, { action: 'pause' });
});

test('announceLanDevice et getLanDevices gèrent la présence des appareils sur le réseau', async () => {
  const { announceLanDevice, getLanDevices } = await import('../syncEvents.js');

  const dev1 = announceLanDevice({
    deviceId: 'dev_tv_1',
    name: 'Salon TV',
    deviceType: 'tv',
    ipAddress: '192.168.1.50',
    activeProfileName: 'Principal',
  });

  const dev2 = announceLanDevice({
    deviceId: 'dev_phone_1',
    name: 'iPhone Thomas',
    deviceType: 'mobile',
    ipAddress: '192.168.1.51',
    activeProfileName: 'Principal',
  });

  const all = getLanDevices();
  assert.ok(all.some(d => d.deviceId === 'dev_tv_1' && d.name === 'Salon TV'));
  assert.ok(all.some(d => d.deviceId === 'dev_phone_1' && d.name === 'iPhone Thomas'));

  // Exclusion de son propre appareil
  const others = getLanDevices('dev_tv_1');
  assert.ok(!others.some(d => d.deviceId === 'dev_tv_1'));
  assert.ok(others.some(d => d.deviceId === 'dev_phone_1'));
});

