export type PlayerChoice = 'web' | 'vlc' | 'mpv' | 'justplayer' | 'mxplayer' | 'novaplayer' | 'intent' | 'system';

export interface PlayerOption {
  id: PlayerChoice;
  name: string;
  desc: string;
  badge: string;
  isMobileOnly?: boolean;
  isDesktopOnly?: boolean;
}

export const AVAILABLE_PLAYERS: PlayerOption[] = [
  {
    id: 'web',
    name: 'Lecteur Intégré (Exo/HTML5)',
    desc: 'Lecture directe dans l\'application avec sous-titres et suivi de position automatique',
    badge: 'Recommandé',
  },
  {
    id: 'intent',
    name: 'Sélecteur Android / TV',
    desc: 'Ouvre le menu système "Ouvrir avec..." (Just Player, Nova, VLC, MX Player, Kodi)',
    badge: 'Mobile / TV',
    isMobileOnly: true,
  },
  {
    id: 'justplayer',
    name: 'Just Player (ExoPlayer Natif)',
    desc: 'Le lecteur Android TV & Mobile ultra-léger et rapide',
    badge: 'Android',
    isMobileOnly: true,
  },
  {
    id: 'novaplayer',
    name: 'Nova Video Player',
    desc: 'Idéal pour Android TV avec interface cinéma et décodage complet',
    badge: 'Android TV',
    isMobileOnly: true,
  },
  {
    id: 'mxplayer',
    name: 'MX Player',
    desc: 'Lecteur Android haute compatibilité avec accélération matérielle HW+',
    badge: 'Android',
    isMobileOnly: true,
  },
  {
    id: 'vlc',
    name: 'VLC Media Player',
    desc: 'Lance VLC directement sur le PC hôte Linux ou ouvre VLC Android',
    badge: 'Linux / Android',
  },
  {
    id: 'mpv',
    name: 'MPV Player',
    desc: 'Moteur de lecture haute fidélité pour Linux avec shaders',
    badge: 'Linux',
    isDesktopOnly: true,
  },
  {
    id: 'system',
    name: 'Lecteur Système par défaut',
    desc: 'Ouvre le gestionnaire média par défaut de l\'appareil',
    badge: 'Système',
  },
];

export function getAndroidIntentUrl(streamUrl: string, packageName?: string): string {
  // Extract scheme and path
  const urlWithoutScheme = streamUrl.replace(/^https?:\/\//, '');
  const scheme = streamUrl.startsWith('https') ? 'https' : 'http';

  let intentStr = `intent://${urlWithoutScheme}#Intent;action=android.intent.action.VIEW;scheme=${scheme};type=video/*;`;
  if (packageName) {
    intentStr += `package=${packageName};`;
  }
  intentStr += 'end';
  return intentStr;
}
