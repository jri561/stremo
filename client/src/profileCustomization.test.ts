import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILE_THEMES,
  AVATAR_OPTIONS,
  AVATAR_CATEGORIES,
  getProfileTheme,
  getAvatarDefinition,
  getAvatarsByCategory,
} from './profileCustomization.ts';

test('PROFILE_THEMES contient au moins 8 palettes riches et distinctes', () => {
  const keys = Object.keys(PROFILE_THEMES);
  assert.ok(keys.length >= 8);
  assert.ok(keys.includes('indigo'));
  assert.ok(keys.includes('purple'));
  assert.ok(keys.includes('pink'));
  assert.ok(keys.includes('emerald'));
  assert.ok(keys.includes('cyan'));
  assert.ok(keys.includes('amber'));
  assert.ok(keys.includes('ruby'));
  assert.ok(keys.includes('slate'));

  for (const key of keys) {
    const theme = PROFILE_THEMES[key];
    assert.strictEqual(theme.id, key);
    assert.ok(theme.name.length > 0);
    assert.ok(theme.gradient.includes('from-'));
    assert.ok(theme.accentColor.startsWith('#'));
    assert.ok(theme.borderColor.startsWith('border-'));
    assert.ok(theme.ringColor.startsWith('ring-'));
    assert.ok(theme.badgeBg.startsWith('bg-'));
  }
});

test('getProfileTheme retourne le thème demandé ou repli sur indigo', () => {
  assert.strictEqual(getProfileTheme('ruby').id, 'ruby');
  assert.strictEqual(getProfileTheme('emerald').id, 'emerald');
  assert.strictEqual(getProfileTheme(undefined).id, 'indigo');
  assert.strictEqual(getProfileTheme('unknown_theme').id, 'indigo');
});

test('AVATAR_OPTIONS et catégories sont bien structurées', () => {
  assert.ok(AVATAR_OPTIONS.length >= 20);
  assert.strictEqual(AVATAR_CATEGORIES.length, 5);

  const cinemaAvatars = getAvatarsByCategory('cinema');
  assert.ok(cinemaAvatars.length >= 3);
  assert.ok(cinemaAvatars.some((a) => a.id === 'film'));

  const kidsAvatars = getAvatarsByCategory('family');
  assert.ok(kidsAvatars.some((a) => a.id === 'sparkles'));

  const geekAvatars = getAvatarsByCategory('geek');
  assert.ok(geekAvatars.some((a) => a.id === 'gamepad'));
});

test('getAvatarDefinition résout les identifiants connus ou fournit un fallback sûr', () => {
  const rocket = getAvatarDefinition('rocket');
  assert.strictEqual(rocket.id, 'rocket');
  assert.strictEqual(rocket.category, 'adventure');

  const sparkles = getAvatarDefinition('sparkles');
  assert.strictEqual(sparkles.id, 'sparkles');
  assert.strictEqual(sparkles.category, 'family');

  const unknown = getAvatarDefinition('non_existent');
  assert.ok(unknown.id.length > 0);
  assert.ok(unknown.label.length > 0);
});
