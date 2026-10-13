import test from 'node:test';
import assert from 'node:assert/strict';
import { convertSrtToVtt } from './subtitles.ts';

test('convertSrtToVtt - converts standard SRT to WebVTT format', () => {
  const srtInput = `1
00:01:20,000 --> 00:01:23,500
Bonjour à tous !

2
00:01:24,100 --> 00:01:28,950
Bienvenue dans Stremo.
`;

  const vttOutput = convertSrtToVtt(srtInput);

  assert.ok(vttOutput.startsWith('WEBVTT'), 'Doit commencer par WEBVTT');
  assert.ok(vttOutput.includes('00:01:20.000 --> 00:01:23.500'), 'Les virgules doivent être remplacées par des points');
  assert.ok(vttOutput.includes('00:01:24.100 --> 00:01:28.950'), 'Le deuxième timestamp doit être converti');
  assert.ok(vttOutput.includes('Bonjour à tous !'), 'Le texte du sous-titre doit être préservé');
});

test('convertSrtToVtt - preserves existing WebVTT content', () => {
  const existingVtt = `WEBVTT

1
00:00:10.000 --> 00:00:15.000
Déjà en VTT.`;

  const output = convertSrtToVtt(existingVtt);
  assert.ok(output.startsWith('WEBVTT'));
  assert.ok(output.includes('00:00:10.000 --> 00:00:15.000'));
});

test('convertSrtToVtt - handles empty or null input gracefully', () => {
  assert.equal(convertSrtToVtt(''), 'WEBVTT\n\n');
});
