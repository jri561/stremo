/**
 * Stremo - Gestion avancée, détection de langue et conversion des sous-titres
 * Supporte le format WebVTT natif, la conversion automatique SubRip (.srt),
 * la normalisation multilingue ISO 639 et les styles de rendu cinématiques.
 */

export interface SubtitleTrack {
  id: string;
  lang: string;
  url: string;
  addonName?: string;
  isLocal?: boolean;
}

export interface LanguageInfo {
  code: string;
  label: string;
  flag: string;
  isForced: boolean;
  isSdh: boolean;
  cleanName: string;
}

export interface SubtitleGroup {
  code: string;
  label: string;
  flag: string;
  tracks: SubtitleTrack[];
}

export interface SubtitleStyleSettings {
  size: 'sm' | 'normal' | 'lg' | 'xl';
  color: 'white' | 'yellow' | 'cyan';
  background: 'none' | 'translucent' | 'solid';
}

const LANGUAGE_MAP: Record<string, { code: string; label: string; flag: string }> = {
  // Français
  fr: { code: 'fra', label: 'Français', flag: '🇫🇷' },
  fra: { code: 'fra', label: 'Français', flag: '🇫🇷' },
  fre: { code: 'fra', label: 'Français', flag: '🇫🇷' },
  french: { code: 'fra', label: 'Français', flag: '🇫🇷' },
  francais: { code: 'fra', label: 'Français', flag: '🇫🇷' },
  français: { code: 'fra', label: 'Français', flag: '🇫🇷' },

  // Anglais
  en: { code: 'eng', label: 'Anglais', flag: '🇬🇧' },
  eng: { code: 'eng', label: 'Anglais', flag: '🇬🇧' },
  english: { code: 'eng', label: 'Anglais', flag: '🇬🇧' },

  // Espagnol
  es: { code: 'spa', label: 'Espagnol', flag: '🇪🇸' },
  spa: { code: 'spa', label: 'Espagnol', flag: '🇪🇸' },
  spanish: { code: 'spa', label: 'Espagnol', flag: '🇪🇸' },
  espanol: { code: 'spa', label: 'Espagnol', flag: '🇪🇸' },
  español: { code: 'spa', label: 'Espagnol', flag: '🇪🇸' },

  // Japonais
  ja: { code: 'jpn', label: 'Japonais', flag: '🇯🇵' },
  jpn: { code: 'jpn', label: 'Japonais', flag: '🇯🇵' },
  japanese: { code: 'jpn', label: 'Japonais', flag: '🇯🇵' },
  japonais: { code: 'jpn', label: 'Japonais', flag: '🇯🇵' },

  // Allemand
  de: { code: 'deu', label: 'Allemand', flag: '🇩🇪' },
  deu: { code: 'deu', label: 'Allemand', flag: '🇩🇪' },
  ger: { code: 'deu', label: 'Allemand', flag: '🇩🇪' },
  german: { code: 'deu', label: 'Allemand', flag: '🇩🇪' },
  allemand: { code: 'deu', label: 'Allemand', flag: '🇩🇪' },
  deutsch: { code: 'deu', label: 'Allemand', flag: '🇩🇪' },

  // Italien
  it: { code: 'ita', label: 'Italien', flag: '🇮🇹' },
  ita: { code: 'ita', label: 'Italien', flag: '🇮🇹' },
  italian: { code: 'ita', label: 'Italien', flag: '🇮🇹' },
  italien: { code: 'ita', label: 'Italien', flag: '🇮🇹' },

  // Portugais / Brésil
  pt: { code: 'por', label: 'Portugais', flag: '🇵🇹' },
  por: { code: 'por', label: 'Portugais', flag: '🇵🇹' },
  portuguese: { code: 'por', label: 'Portugais', flag: '🇵🇹' },
  portugais: { code: 'por', label: 'Portugais', flag: '🇵🇹' },
  pb: { code: 'por-br', label: 'Portugais (BR)', flag: '🇧🇷' },
  pob: { code: 'por-br', label: 'Portugais (BR)', flag: '🇧🇷' },
  pbr: { code: 'por-br', label: 'Portugais (BR)', flag: '🇧🇷' },

  // Russe
  ru: { code: 'rus', label: 'Russe', flag: '🇷🇺' },
  rus: { code: 'rus', label: 'Russe', flag: '🇷🇺' },
  russian: { code: 'rus', label: 'Russe', flag: '🇷🇺' },
  russe: { code: 'rus', label: 'Russe', flag: '🇷🇺' },

  // Arabe
  ar: { code: 'ara', label: 'Arabe', flag: '🇸🇦' },
  ara: { code: 'ara', label: 'Arabe', flag: '🇸🇦' },
  arabic: { code: 'ara', label: 'Arabe', flag: '🇸🇦' },
  arabe: { code: 'ara', label: 'Arabe', flag: '🇸🇦' },

  // Chinois
  zh: { code: 'zho', label: 'Chinois', flag: '🇨🇳' },
  chi: { code: 'zho', label: 'Chinois', flag: '🇨🇳' },
  zho: { code: 'zho', label: 'Chinois', flag: '🇨🇳' },
  chinese: { code: 'zho', label: 'Chinois', flag: '🇨🇳' },
  chinois: { code: 'zho', label: 'Chinois', flag: '🇨🇳' },

  // Coréen
  ko: { code: 'kor', label: 'Coréen', flag: '🇰🇷' },
  kor: { code: 'kor', label: 'Coréen', flag: '🇰🇷' },
  korean: { code: 'kor', label: 'Coréen', flag: '🇰🇷' },
  coréen: { code: 'kor', label: 'Coréen', flag: '🇰🇷' },

  // Néerlandais
  nl: { code: 'nld', label: 'Néerlandais', flag: '🇳🇱' },
  nld: { code: 'nld', label: 'Néerlandais', flag: '🇳🇱' },
  dut: { code: 'nld', label: 'Néerlandais', flag: '🇳🇱' },
  dutch: { code: 'nld', label: 'Néerlandais', flag: '🇳🇱' },

  // Polonais
  pl: { code: 'pol', label: 'Polonais', flag: '🇵🇱' },
  pol: { code: 'pol', label: 'Polonais', flag: '🇵🇱' },
  polish: { code: 'pol', label: 'Polonais', flag: '🇵🇱' },

  // Turc
  tr: { code: 'tur', label: 'Turc', flag: '🇹🇷' },
  tur: { code: 'tur', label: 'Turc', flag: '🇹🇷' },
  turkish: { code: 'tur', label: 'Turc', flag: '🇹🇷' },

  // Suédois
  sv: { code: 'swe', label: 'Suédois', flag: '🇸🇪' },
  swe: { code: 'swe', label: 'Suédois', flag: '🇸🇪' },
  swedish: { code: 'swe', label: 'Suédois', flag: '🇸🇪' },

  // Danois
  da: { code: 'dan', label: 'Danois', flag: '🇩🇰' },
  dan: { code: 'dan', label: 'Danois', flag: '🇩🇰' },
  danish: { code: 'dan', label: 'Danois', flag: '🇩🇰' },

  // Finnois
  fi: { code: 'fin', label: 'Finnois', flag: '🇫🇮' },
  fin: { code: 'fin', label: 'Finnois', flag: '🇫🇮' },
  finnish: { code: 'fin', label: 'Finnois', flag: '🇫🇮' },

  // Norvégien
  no: { code: 'nor', label: 'Norvégien', flag: '🇳🇴' },
  nor: { code: 'nor', label: 'Norvégien', flag: '🇳🇴' },
  norwegian: { code: 'nor', label: 'Norvégien', flag: '🇳🇴' },

  // Grec
  el: { code: 'ell', label: 'Grec', flag: '🇬🇷' },
  ell: { code: 'ell', label: 'Grec', flag: '🇬🇷' },
  gre: { code: 'ell', label: 'Grec', flag: '🇬🇷' },
  greek: { code: 'ell', label: 'Grec', flag: '🇬🇷' },

  // Hébreu
  he: { code: 'heb', label: 'Hébreu', flag: '🇮🇱' },
  heb: { code: 'heb', label: 'Hébreu', flag: '🇮🇱' },
  hebrew: { code: 'heb', label: 'Hébreu', flag: '🇮🇱' },

  // Hindi
  hi: { code: 'hin', label: 'Hindi', flag: '🇮🇳' },
  hin: { code: 'hin', label: 'Hindi', flag: '🇮🇳' },
  hindi: { code: 'hin', label: 'Hindi', flag: '🇮🇳' },

  // Ukrainien
  uk: { code: 'ukr', label: 'Ukrainien', flag: '🇺🇦' },
  ukr: { code: 'ukr', label: 'Ukrainien', flag: '🇺🇦' },
  ukrainian: { code: 'ukr', label: 'Ukrainien', flag: '🇺🇦' },
};

/**
 * Analyse une chaîne brute (code ISO, nom de langue, libellé de release)
 * et extrait les informations normalisées (code standard, libellé, drapeau, tags forced/sdh).
 */
export function getLanguageInfo(rawLang: string): LanguageInfo {
  if (!rawLang || !rawLang.trim()) {
    return {
      code: 'und',
      label: 'Autre langue',
      flag: '🌐',
      isForced: false,
      isSdh: false,
      cleanName: 'Sous-titre',
    };
  }

  const lower = rawLang.toLowerCase().trim();
  const isForced = /(?:^|[^a-z0-9])(forced|forc[eé]s?|vf-f)(?:[^a-z0-9]|$)/i.test(lower);
  const isSdh = /(?:^|[^a-z0-9])(sdh|cc|sourds|malentendants)(?:[^a-z0-9]|$)/i.test(lower);

  // Recherche directe ou nettoyage de préfixes / suffixes
  // ex: "fre (forced)" ou "fra_sdh" ou "fr-fr"
  const cleanedKey = lower
    .replace(/[\[\(_\-].*$/, '') // coupe à partir du premier séparateur
    .replace(/\s+(forced|sdh|cc|complet).*$/, '')
    .trim();

  const exactMatch = LANGUAGE_MAP[lower] || LANGUAGE_MAP[cleanedKey];
  if (exactMatch) {
    let cleanName = exactMatch.label;
    if (isForced) cleanName += ' (Forcé)';
    if (isSdh) cleanName += ' (SDH)';

    return {
      code: exactMatch.code,
      label: exactMatch.label,
      flag: exactMatch.flag,
      isForced,
      isSdh,
      cleanName,
    };
  }

  // Recherche par mot-clé si non trouvé directement (ex: "french full")
  for (const [key, val] of Object.entries(LANGUAGE_MAP)) {
    if (lower.includes(key)) {
      let cleanName = val.label;
      if (isForced) cleanName += ' (Forcé)';
      if (isSdh) cleanName += ' (SDH)';

      return {
        code: val.code,
        label: val.label,
        flag: val.flag,
        isForced,
        isSdh,
        cleanName,
      };
    }
  }

  // Par défaut si inconnu
  return {
    code: lower.slice(0, 3),
    label: rawLang.length <= 4 ? rawLang.toUpperCase() : rawLang,
    flag: '🌐',
    isForced,
    isSdh,
    cleanName: rawLang,
  };
}

/**
 * Regroupe et trie une liste de pistes de sous-titres par langue pour une navigation claire.
 */
export function groupSubtitlesByLanguage(tracks: SubtitleTrack[]): SubtitleGroup[] {
  const groupsMap = new Map<string, { label: string; flag: string; tracks: SubtitleTrack[] }>();

  for (const track of tracks) {
    const info = getLanguageInfo(track.lang || track.id);
    const key = info.code;

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        label: info.label,
        flag: info.flag,
        tracks: [],
      });
    }

    groupsMap.get(key)!.tracks.push(track);
  }

  // Conversion en tableau trié : Français d'abord, puis Anglais, puis alphabétique
  return Array.from(groupsMap.entries())
    .map(([code, g]) => ({
      code,
      label: g.label,
      flag: g.flag,
      tracks: g.tracks,
    }))
    .sort((a, b) => {
      if (a.code === 'fra') return -1;
      if (b.code === 'fra') return 1;
      if (a.code === 'eng') return -1;
      if (b.code === 'eng') return 1;
      return a.label.localeCompare(b.label, 'fr');
    });
}

/**
 * Génère le bloc CSS pour le pseudo-élément `video::cue` selon les réglages utilisateur.
 */
export function generateSubtitleCss(settings: SubtitleStyleSettings): string {
  // 1. Taille
  const fontSizeMap: Record<SubtitleStyleSettings['size'], string> = {
    sm: '0.95rem',
    normal: '1.2rem',
    lg: '1.5rem',
    xl: '1.9rem',
  };
  const fontSize = fontSizeMap[settings.size] || fontSizeMap.normal;

  // 2. Couleur de texte
  const colorMap: Record<SubtitleStyleSettings['color'], string> = {
    white: '#ffffff',
    yellow: '#facc15',
    cyan: '#67e8f9',
  };
  const textColor = colorMap[settings.color] || colorMap.white;

  // 3. Fond et ombres
  let backgroundRule = 'background-color: rgba(10, 14, 23, 0.65) !important;';
  let shadowRule = 'text-shadow: 0 2px 4px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.9) !important;';

  if (settings.background === 'none') {
    backgroundRule = 'background-color: transparent !important;';
    shadowRule =
      'text-shadow: 0 2px 4px rgba(0, 0, 0, 1), 0 0 3px rgba(0, 0, 0, 1), 1px 1px 2px #000, -1px -1px 2px #000 !important;';
  } else if (settings.background === 'solid') {
    backgroundRule = 'background-color: rgba(0, 0, 0, 0.9) !important;';
    shadowRule = 'text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8) !important;';
  }

  return `
    video::cue {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      font-size: ${fontSize} !important;
      font-weight: 600 !important;
      letter-spacing: 0.02em !important;
      line-height: 1.35 !important;
      color: ${textColor} !important;
      ${backgroundRule}
      ${shadowRule}
      border-radius: 6px !important;
      padding: 3px 10px !important;
    }
  `.trim();
}

/**
 * Convertit une chaîne de caractères au format SubRip (.srt) en WebVTT (.vtt) standard.
 */
export function convertSrtToVtt(srtText: string): string {
  if (!srtText) return 'WEBVTT\n\n';

  // 1. Nettoyer les retours à la ligne et le BOM Unicode
  let cleaned = srtText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Si c'est déjà du WebVTT, le retourner après nettoyage
  if (cleaned.trimStart().startsWith('WEBVTT')) {
    return cleaned;
  }

  // 2. Remplacer les virgules des millisecondes par des points dans les timestamps (00:00:00,000 -> 00:00:00.000)
  // Format SRT : 00:01:20,000 --> 00:01:23,500
  const timestampRegex = /(\d{2}:\d{2}:\d{2}),(\d{3})/g;
  cleaned = cleaned.replace(timestampRegex, '$1.$2');

  // 3. Ajouter l'en-tête WEBVTT
  return `WEBVTT\n\n${cleaned.trim()}\n`;
}

/**
 * Lit un fichier local (.srt ou .vtt) et crée une URL Blob utilisable par les balises <track>.
 */
export async function createLocalSubtitleTrack(file: File): Promise<SubtitleTrack> {
  const content = await file.text();
  const isVtt = file.name.toLowerCase().endsWith('.vtt');
  const vttContent = isVtt ? content : convertSrtToVtt(content);

  const blob = new Blob([vttContent], { type: 'text/vtt' });
  const blobUrl = URL.createObjectURL(blob);

  // Nom lisible du fichier sans extension
  const displayName = file.name.replace(/\.(srt|vtt)$/i, '');

  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    lang: displayName,
    url: blobUrl,
    addonName: 'Fichier local',
    isLocal: true,
  };
}
