export interface ProfileTheme {
  id: string;
  name: string;
  gradient: string;
  accentColor: string;
  borderColor: string;
  ringColor: string;
  badgeBg: string;
  glowColor: string;
  textAccent: string;
}

export interface AvatarOption {
  id: string;
  label: string;
  category: 'cinema' | 'adventure' | 'family' | 'geek' | 'classic';
  description: string;
}

export const PROFILE_THEMES: Record<string, ProfileTheme> = {
  indigo: {
    id: 'indigo',
    name: 'Indigo Électrique',
    gradient: 'from-indigo-600 via-indigo-700 to-blue-700',
    accentColor: '#6366f1',
    borderColor: 'border-indigo-500',
    ringColor: 'ring-indigo-500',
    badgeBg: 'bg-indigo-600',
    glowColor: 'rgba(99, 102, 241, 0.35)',
    textAccent: 'text-indigo-400',
  },
  purple: {
    id: 'purple',
    name: 'Violet Mystique',
    gradient: 'from-purple-600 via-purple-700 to-indigo-800',
    accentColor: '#a855f7',
    borderColor: 'border-purple-500',
    ringColor: 'ring-purple-500',
    badgeBg: 'bg-purple-600',
    glowColor: 'rgba(168, 85, 247, 0.35)',
    textAccent: 'text-purple-400',
  },
  pink: {
    id: 'pink',
    name: 'Rose Bubblegum',
    gradient: 'from-pink-500 via-rose-600 to-purple-600',
    accentColor: '#ec4899',
    borderColor: 'border-pink-500',
    ringColor: 'ring-pink-500',
    badgeBg: 'bg-pink-600',
    glowColor: 'rgba(236, 72, 153, 0.35)',
    textAccent: 'text-pink-400',
  },
  emerald: {
    id: 'emerald',
    name: 'Émeraude Zen',
    gradient: 'from-emerald-500 via-teal-600 to-emerald-700',
    accentColor: '#10b981',
    borderColor: 'border-emerald-500',
    ringColor: 'ring-emerald-500',
    badgeBg: 'bg-emerald-600',
    glowColor: 'rgba(16, 185, 129, 0.35)',
    textAccent: 'text-emerald-400',
  },
  cyan: {
    id: 'cyan',
    name: 'Cyan Néon',
    gradient: 'from-cyan-500 via-teal-600 to-blue-600',
    accentColor: '#06b6d4',
    borderColor: 'border-cyan-400',
    ringColor: 'ring-cyan-400',
    badgeBg: 'bg-cyan-600',
    glowColor: 'rgba(6, 182, 212, 0.35)',
    textAccent: 'text-cyan-400',
  },
  amber: {
    id: 'amber',
    name: 'Ambre Solaire',
    gradient: 'from-amber-500 via-orange-600 to-amber-700',
    accentColor: '#f59e0b',
    borderColor: 'border-amber-500',
    ringColor: 'ring-amber-500',
    badgeBg: 'bg-amber-600',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    textAccent: 'text-amber-400',
  },
  ruby: {
    id: 'ruby',
    name: 'Rubis Écarlate',
    gradient: 'from-rose-600 via-red-600 to-rose-800',
    accentColor: '#f43f5e',
    borderColor: 'border-rose-500',
    ringColor: 'ring-rose-500',
    badgeBg: 'bg-rose-600',
    glowColor: 'rgba(244, 63, 94, 0.35)',
    textAccent: 'text-rose-400',
  },
  slate: {
    id: 'slate',
    name: 'Ardoise Furtif',
    gradient: 'from-slate-600 via-zinc-700 to-slate-900',
    accentColor: '#64748b',
    borderColor: 'border-slate-400',
    ringColor: 'ring-slate-400',
    badgeBg: 'bg-slate-700',
    glowColor: 'rgba(100, 116, 139, 0.35)',
    textAccent: 'text-slate-300',
  },
};

export const AVATAR_CATEGORIES = [
  { id: 'cinema', label: 'Cinéma & Médias' },
  { id: 'adventure', label: 'Aventure & Héros' },
  { id: 'family', label: 'Famille & Enfants' },
  { id: 'geek', label: 'Gaming & Tech' },
  { id: 'classic', label: 'Classique & VIP' },
] as const;

export const AVATAR_OPTIONS: AvatarOption[] = [
  // Cinema
  { id: 'film', label: 'Cinéphile', category: 'cinema', description: 'Pour les passionnés de pellicules et de blockbusters' },
  { id: 'tv', label: 'Séries & TV', category: 'cinema', description: 'Toujours prêt pour une session binge-watching' },
  { id: 'popcorn', label: 'Soirée Popcorn', category: 'cinema', description: 'Ambiance salle obscure et gourmandises' },
  { id: 'camera', label: 'Réalisateur', category: 'cinema', description: 'Derrière l objectif pour les chefs-d œuvre' },

  // Adventure
  { id: 'rocket', label: 'Astronaute', category: 'adventure', description: 'Cap vers les étoiles et la science-fiction' },
  { id: 'flame', label: 'Action & Feu', category: 'adventure', description: 'Explosions, adrénaline et cascades' },
  { id: 'compass', label: 'Explorateur', category: 'adventure', description: 'À la découverte de mondes inconnus' },
  { id: 'zap', label: 'Électrique', category: 'adventure', description: 'Énergie pure et super-pouvoirs' },

  // Family & Kids
  { id: 'sparkles', label: 'Magie & Étoiles', category: 'family', description: 'Idéal pour le profil enfant féerique' },
  { id: 'smile', label: 'Sourire Joyeux', category: 'family', description: 'Pour les comédies familiales et l animation' },
  { id: 'heart', label: 'Cœur Romantique', category: 'family', description: 'Drames touchants et comédies d amour' },
  { id: 'cat', label: 'Compagnon Chat', category: 'family', description: 'Pour les amoureux des animaux' },

  // Geek & Tech
  { id: 'gamepad', label: 'Gamer', category: 'geek', description: 'Jeux vidéo, animes et adaptations' },
  { id: 'headphones', label: 'Audiophile', category: 'geek', description: 'Immersion acoustique Dolby Atmos' },
  { id: 'bot', label: 'Cyber Robot', category: 'geek', description: 'Futur cyberpunk et intelligence artificielle' },
  { id: 'glasses', label: 'Geek Passion', category: 'geek', description: 'Connaissances encyclopédiques du cinéma' },

  // Classic & VIP
  { id: 'user', label: 'Standard', category: 'classic', description: 'Profil épuré et sobre' },
  { id: 'crown', label: 'VIP Royal', category: 'classic', description: 'Sélection d or et éditions prestige' },
  { id: 'ghost', label: 'Frisson & Horreur', category: 'classic', description: 'Pour les amateurs de mystère et d épouvante' },
  { id: 'coffee', label: 'Pause Café', category: 'classic', description: 'Détente cosy du dimanche après-midi' },
];

export function getProfileTheme(colorId?: string): ProfileTheme {
  if (!colorId || !PROFILE_THEMES[colorId]) {
    return PROFILE_THEMES.indigo;
  }
  return PROFILE_THEMES[colorId];
}

export function getAvatarDefinition(avatarId?: string): AvatarOption {
  const found = AVATAR_OPTIONS.find((a) => a.id === avatarId);
  if (found) return found;
  // Fallbacks courants
  if (avatarId === 'sparkles') return AVATAR_OPTIONS.find((a) => a.id === 'sparkles')!;
  if (avatarId === 'film') return AVATAR_OPTIONS.find((a) => a.id === 'film')!;
  return AVATAR_OPTIONS.find((a) => a.id === 'user') || AVATAR_OPTIONS[0];
}

export function getAvatarsByCategory(category: string): AvatarOption[] {
  return AVATAR_OPTIONS.filter((a) => a.category === category);
}
