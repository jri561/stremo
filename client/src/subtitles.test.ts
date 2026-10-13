import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertSrtToVtt,
  getLanguageInfo,
  groupSubtitlesByLanguage,
  generateSubtitleCss,
  type SubtitleTrack,
} from './subtitles.ts';

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

test('getLanguageInfo - normalise les codes et détecte les variantes forcé et SDH', () => {
  const fr = getLanguageInfo('fre');
  assert.equal(fr.code, 'fra');
  assert.equal(fr.label, 'Français');
  assert.equal(fr.flag, '🇫🇷');
  assert.equal(fr.isForced, false);

  const frForced = getLanguageInfo('french forced');
  assert.equal(frForced.code, 'fra');
  assert.equal(frForced.isForced, true);
  assert.ok(frForced.cleanName.includes('(Forcé)'));

  const enSdh = getLanguageInfo('eng_sdh');
  assert.equal(enSdh.code, 'eng');
  assert.equal(enSdh.isSdh, true);
  assert.ok(enSdh.cleanName.includes('(SDH)'));

  const jp = getLanguageInfo('japanese');
  assert.equal(jp.code, 'jpn');
  assert.equal(jp.flag, '🇯🇵');

  const unknown = getLanguageInfo('klingon');
  assert.equal(unknown.flag, '🌐');
});

test('groupSubtitlesByLanguage - regroupe et ordonne les pistes proprement', () => {
  const tracks: SubtitleTrack[] = [
    { id: '1', lang: 'eng', url: 'http://example.com/1.vtt' },
    { id: '2', lang: 'fre', url: 'http://example.com/2.vtt' },
    { id: '3', lang: 'spa', url: 'http://example.com/3.vtt' },
    { id: '4', lang: 'fra (forced)', url: 'http://example.com/4.vtt' },
  ];

  const groups = groupSubtitlesByLanguage(tracks);
  assert.equal(groups.length, 3);
  // Le français doit être en tête
  assert.equal(groups[0].code, 'fra');
  assert.equal(groups[0].tracks.length, 2);
  // L'anglais en 2ème
  assert.equal(groups[1].code, 'eng');
  assert.equal(groups[1].tracks.length, 1);
  // L'espagnol en 3ème
  assert.equal(groups[2].code, 'spa');
  assert.equal(groups[2].tracks.length, 1);
});

test('generateSubtitleCss - applique la typographie et les contrastes sélectionnés', () => {
  const cssDefault = generateSubtitleCss({
    size: 'normal',
    color: 'white',
    background: 'translucent',
  });
  assert.ok(cssDefault.includes('video::cue'));
  assert.ok(cssDefault.includes('#ffffff'));
  assert.ok(cssDefault.includes('1.2rem'));
  assert.ok(cssDefault.includes('rgba(10, 14, 23, 0.65)'));

  const cssYellowCinema = generateSubtitleCss({
    size: 'lg',
    color: 'yellow',
    background: 'none',
  });
  assert.ok(cssYellowCinema.includes('#facc15'));
  assert.ok(cssYellowCinema.includes('1.5rem'));
  assert.ok(cssYellowCinema.includes('background-color: transparent'));
});
