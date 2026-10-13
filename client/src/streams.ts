import type { StreamSource } from './api.ts';

/** Source analysée : informations lisibles extraites d'un flux Stremio. */
export interface ParsedStream {
  stream: StreamSource;
  /** Résolution verticale (2160, 1080, 720, 480, 0 si inconnue). */
  height: number;
  resolutionLabel: string;
  /** Service debrid (ex. « AllDebrid ») et état du cache (⚡). */
  debrid?: string;
  cached: boolean;
  /** Nom du fournisseur (Torrentio, Lumio…). */
  provider: string;
  source?: string;
  codec?: string;
  hdr: string[];
  audio: string[];
  languages: string[];
  sizeBytes: number;
  sizeLabel: string;
  group?: string;
  indexer?: string;
  fileName?: string;
  /** Lisible nativement par un navigateur (pas de mkv/HEVC signalé « notWebReady »). */
  webReady: boolean;
}

const DEBRID_CODES: Record<string, string> = {
  RD: 'Real-Debrid', AD: 'AllDebrid', TB: 'TorBox', PM: 'Premiumize',
  DL: 'Debrid-Link', ED: 'EasyDebrid', OC: 'Offcloud', PP: 'PikPak', SB: 'StremThru',
};

const MARKERS = '🎥🎞🏷📺🎧🔊📦💾⏱🔍🌐📝📡📁👤';
const SECTION_RE = new RegExp(`([${MARKERS}])\\s*([^${MARKERS}\\n]*)`, 'gu');

function parseSizeLabel(text: string): { bytes: number; label: string } | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(TB|GB|MB|Go|Mo|To)\b/i);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  const unit = m[2].toUpperCase();
  const factor = unit === 'TB' || unit === 'TO' ? 1e12 : unit === 'GB' || unit === 'GO' ? 1e9 : 1e6;
  return { bytes: value * factor, label: formatBytes(value * factor) };
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} To`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 1 : 2)} Go`;
  return `${Math.round(bytes / 1e6)} Mo`;
}

function splitList(text: string, separator: RegExp): string[] {
  return text.split(separator).map(s => s.trim()).filter(Boolean);
}

/** Extrait les drapeaux emoji (paires d'indicateurs régionaux) d'un texte. */
function extractFlags(text: string): string[] {
  return text.match(/\p{Regional_Indicator}{2}/gu) ?? [];
}

function detectHeight(text: string): number {
  if (/2160p|\b4k\b|\buhd\b/i.test(text)) return 2160;
  if (/1440p/i.test(text)) return 1440;
  if (/1080p|\bfhd\b/i.test(text)) return 1080;
  if (/720p/i.test(text)) return 720;
  if (/480p|\bsd\b/i.test(text)) return 480;
  return 0;
}

export function resolutionLabel(height: number): string {
  if (height >= 2160) return '4K';
  if (height > 0) return `${height}p`;
  return 'SD';
}

export function parseStream(stream: StreamSource): ParsedStream {
  const rawName = stream.name ?? '';
  const rawDesc = (stream.description ?? stream.title ?? '').replace(/\uFE0F/g, '');
  const hints = stream.behaviorHints ?? {};
  const fileName: string | undefined = hints.filename;

  // Nom type « [AD⚡] Torrentio 2160p »
  const badge = rawName.match(/^\[([A-Z]{2})(⚡|\+|⏳)?\]\s*/);
  const debrid = badge ? DEBRID_CODES[badge[1]] ?? badge[1] : undefined;
  const cached = badge ? badge[2] === '⚡' : false;
  const providerRaw = rawName.replace(/^\[[^\]]*\]\s*/, '').replace(/\b(2160p|1440p|1080p|720p|480p|4k)\b/gi, '').replace(/\s+/g, ' ').trim();

  const sections: Record<string, string> = {};
  for (const m of rawDesc.matchAll(SECTION_RE)) {
    sections[m[1]] = sections[m[1]] ? `${sections[m[1]]} ${m[2].trim()}` : m[2].trim();
  }

  const haystack = `${rawName} ${rawDesc} ${fileName ?? ''}`;
  const height = detectHeight(`${rawName} ${fileName ?? ''}`) || detectHeight(haystack);

  const hdr = splitList(sections['📺'] ?? '', /\s*[•|,]\s*/)
    .filter(v => /hdr|dv|dolby|vision|hlg/i.test(v))
    .map(v => (/^dv$/i.test(v) ? 'Dolby Vision' : v));
  if (hdr.length === 0) {
    if (/\bDV\b|dolby.?vision/i.test(haystack)) hdr.push('Dolby Vision');
    if (/hdr10\+/i.test(haystack)) hdr.push('HDR10+');
    else if (/hdr/i.test(haystack)) hdr.push('HDR');
  }

  const audio = splitList(sections['🎧'] ?? '', /\s*[•|,]\s*/);
  const channels = (sections['🔊'] ?? '').trim();
  if (channels && audio.length) audio.push(channels);

  const langSource = sections['🌐'] ?? '';
  const languages = extractFlags(langSource);

  let size = hints.videoSize ? { bytes: Number(hints.videoSize), label: formatBytes(Number(hints.videoSize)) } : null;
  if (!size) size = parseSizeLabel(sections['📦'] ?? sections['💾'] ?? rawDesc);

  return {
    stream,
    height,
    resolutionLabel: resolutionLabel(height),
    debrid,
    cached,
    provider: providerRaw || stream.addonName || 'Source',
    source: sections['🎥'] || undefined,
    codec: sections['🎞'] || undefined,
    hdr,
    audio,
    languages: Array.from(new Set(languages)),
    sizeBytes: size?.bytes ?? 0,
    sizeLabel: size?.label ?? '',
    group: sections['🏷'] || undefined,
    indexer: sections['🔍'] || undefined,
    fileName,
    webReady: hints.notWebReady !== true && !/truehd|dts-hd|\bdts\b|\bremux\b/i.test(`${rawName} ${rawDesc} ${fileName ?? ''}`),
  };
}

/** Conseils d'utilisation conviviaux pour la famille */
export function getPlayerRecommendation(p: ParsedStream): {
  isWebOk: boolean;
  label: string;
  badgeClass: string;
} {
  if (p.webReady && p.height <= 1080) {
    return {
      isWebOk: true,
      label: 'Lecture instantanée (Navigateur & Mobile)',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    };
  }
  return {
    isWebOk: false,
    label: p.height >= 2160 ? '4K Ultra HD (VLC / Just Player conseillé)' : 'Piste audio haute qualité (VLC conseillé)',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  };
}

/** Score de qualité : plus haut = meilleur. La lecture intégrée favorise les flux web-ready. */
export function scoreStream(p: ParsedStream, preferWebReady: boolean): number {
  let score = p.height * 10;
  if (p.cached) score += 4000;
  if (preferWebReady && p.webReady) score += 30000;
  if (p.sizeBytes > 0) score += Math.min(p.sizeBytes / 1e9, 60); // à qualité égale, plus gros = meilleur débit
  return score;
}

export function rankStreams(streams: StreamSource[], preferWebReady: boolean): ParsedStream[] {
  return streams
    .filter(s => !!s.url)
    .map(parseStream)
    .sort((a, b) => scoreStream(b, preferWebReady) - scoreStream(a, preferWebReady));
}

export type ResolutionFilter = 'all' | '2160' | '1080' | '720' | 'sd';

export function matchesResolution(p: ParsedStream, filter: ResolutionFilter): boolean {
  switch (filter) {
    case 'all': return true;
    case '2160': return p.height >= 2160;
    case '1080': return p.height >= 1080 && p.height < 2160;
    case '720': return p.height >= 720 && p.height < 1080;
    case 'sd': return p.height < 720;
  }
}

/**
 * Détecte si le générique de fin a commencé pour permettre le saut d'épisode
 */
export function isOutroCreditsDetected(currentTime: number, duration: number, skipOutroSec: number = 75): boolean {
  if (duration <= 60) return false;
  const remaining = duration - currentTime;
  const effectiveThreshold = Math.max(20, Math.min(skipOutroSec, duration * 0.12));
  return remaining <= effectiveThreshold && remaining > 0;
}

/**
 * Détecte si la lecture se situe dans la plage d'introduction automatique pour une série
 */
export function shouldAutoSkipIntro(
  currentTime: number,
  duration: number,
  autoSkipEnabled: boolean,
  introStartSec: number = 3,
  introWindowMaxSec: number = 20
): boolean {
  if (!autoSkipEnabled || duration <= 120) return false;
  // Déclenchement au tout début de l'épisode (entre introStartSec et introWindowMaxSec)
  return currentTime >= introStartSec && currentTime <= introWindowMaxSec;
}

/**
 * Calcule le timecode cible après le saut d'intro (ex: +85 secondes)
 */
export function getIntroTargetTime(currentTime: number, duration: number, introDurationSec: number = 85): number {
  return Math.min(Math.max(0, duration - 15), currentTime + introDurationSec);
}

/**
 * Trouve le prochain flux alternatif en cas d'erreur de lecture (Auto-Fallback)
 */
export function getNextFallbackStream(
  currentStreamUrl: string,
  availableStreams: StreamSource[]
): StreamSource | null {
  if (!availableStreams || availableStreams.length <= 1) return null;
  const validStreams = availableStreams.filter(s => !!s.url);
  const currentIndex = validStreams.findIndex(s => s.url === currentStreamUrl);
  if (currentIndex === -1) {
    return validStreams[0] || null;
  }
  if (currentIndex + 1 < validStreams.length) {
    return validStreams[currentIndex + 1];
  }
  return null;
}

/**
 * Détecte si l'appareil est une Smart TV, Box Android TV ou récepteur salon
 */
export function detectTvDevice(userAgent: string): boolean {
  if (!userAgent) return false;
  return /Android.*TV|SmartTV|Tizen|Web0S|BRAVIA|AFTT|AFTM|AFTB|CrKey|AppleTV|HbbTV|Xbox|PlayStation|Nexus Player|SHIELD/i.test(
    userAgent
  );
}

/**
 * Détecte si le flux est en version française (VF, VFF, VFQ, TRUEFRENCH, MULTI)
 */
export function isStreamFrenchAudio(stream: StreamSource): boolean {
  const text = `${stream.name ?? ''} ${stream.description ?? ''} ${stream.title ?? ''} ${stream.behaviorHints?.filename ?? ''}`.toLowerCase();
  return /\b(french|truefrench|vff|vfq|vf|multi)\b/i.test(text) || text.includes('🇫🇷');
}

/**
 * Détecte la langue principale d'un flux audio
 */
export function detectStreamAudioLanguage(stream: StreamSource): string {
  const text = `${stream.name ?? ''} ${stream.description ?? ''} ${stream.title ?? ''} ${stream.behaviorHints?.filename ?? ''}`.toLowerCase();
  if (/\b(french|truefrench|vff|vfq|vf|multi)\b/i.test(text) || text.includes('🇫🇷')) return 'fra';
  if (/\b(japanese|jap|jpn)\b/i.test(text) || text.includes('🇯🇵')) return 'jpn';
  if (/\b(spanish|esp|espanol|castellano)\b/i.test(text) || text.includes('🇪🇸')) return 'spa';
  if (/\b(german|deutsch)\b/i.test(text) || text.includes('🇩🇪')) return 'deu';
  if (/\b(italian|italiano)\b/i.test(text) || text.includes('🇮🇹')) return 'ita';
  return 'eng';
}

/**
 * Recherche intelligente de la piste de sous-titres correspondant à la préférence utilisateur
 */
export function matchSmartSubtitle(
  subtitles: any[],
  preferredSubLang: string = 'fra',
  streamAudioLang: string = 'eng',
  subtitleMode: string = 'foreign_only'
): any | null {
  if (!subtitles || subtitles.length === 0) return null;
  if (subtitleMode === 'off' || preferredSubLang === 'off') return null;

  // Si le mode est 'foreign_only' et que l'audio est déjà dans la langue préférée de l'utilisateur
  if (subtitleMode === 'foreign_only') {
    const isAudioSameAsSub =
      (preferredSubLang === 'fra' && streamAudioLang === 'fra') ||
      (preferredSubLang === 'eng' && streamAudioLang === 'eng') ||
      (preferredSubLang === streamAudioLang);

    if (isAudioSameAsSub) {
      return null;
    }
  }

  const targetLangs = preferredSubLang === 'fra' || preferredSubLang === 'fr'
    ? ['fre', 'fra', 'fr', 'french', 'français']
    : preferredSubLang === 'eng' || preferredSubLang === 'en'
    ? ['eng', 'en', 'english']
    : [preferredSubLang];

  const match = subtitles.find(sub => {
    const subLang = (sub.lang || sub.id || '').toLowerCase();
    return targetLangs.some(t => subLang === t || subLang.startsWith(t));
  });

  return match || null;
}

export interface QuickPlayOptions {
  preferredAudioLanguage?: string;
  preferredSubtitleLanguage?: string;
  subtitleMode?: string;
  preferWebReady?: boolean;
}

/**
 * Sélectionne automatiquement le meilleur flux adapté au profil pour une lecture instantanée 1-clic
 */
export function selectBestStreamForQuickPlay(
  streams: StreamSource[],
  options: QuickPlayOptions = {}
): StreamSource | null {
  if (!streams || streams.length === 0) return null;
  const playable = streams.filter(s => !!s.url);
  if (playable.length === 0) return null;

  const preferWebReady = options.preferWebReady !== false;
  const prefAudio = options.preferredAudioLanguage || 'fr';

  const scored = playable.map(s => {
    const p = parseStream(s);
    let score = scoreStream(p, preferWebReady);

    // Audio matching bonus
    const audioLang = detectStreamAudioLanguage(s);
    const isFrench = isStreamFrenchAudio(s);

    if (prefAudio === 'fr' || prefAudio === 'fra') {
      if (isFrench) {
        score += 25000; // Priorité massive aux flux FR pour les francophones
      } else if (p.languages.includes('🇫🇷')) {
        score += 20000;
      }
    } else if (prefAudio === 'en' || prefAudio === 'eng') {
      if (audioLang === 'eng' || p.languages.includes('🇬🇧') || p.languages.includes('🇺🇸')) {
        score += 15000;
      }
    } else if (audioLang === prefAudio) {
      score += 18000;
    }

    // Debrid cached bonus
    if (p.cached) {
      score += 10000;
    }

    // WebReady bonus
    if (preferWebReady && p.webReady) {
      score += 20000;
    }

    // Resolution bonus: 1080p est idéal pour le navigateur
    if (p.height === 1080) {
      score += 5000;
    } else if (p.height >= 2160) {
      score += preferWebReady ? 2000 : 8000;
    } else if (p.height === 720) {
      score += 3000;
    }

    return { stream: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.stream || null;
}


