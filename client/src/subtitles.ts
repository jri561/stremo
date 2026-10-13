/**
 * Stremo - Gestion et conversion des sous-titres
 * Supporte le format WebVTT natif et la conversion automatique des fichiers SubRip (.srt).
 */

export interface SubtitleTrack {
  id: string;
  lang: string;
  url: string;
  addonName?: string;
  isLocal?: boolean;
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
