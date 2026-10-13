import { api } from './api';

export interface DownloadItem {
  id: string;
  mediaId: string;
  title: string;
  mediaType: 'movie' | 'series';
  season?: number;
  episode?: number;
  poster?: string;
  streamUrl: string;
  proxiedDownloadUrl: string;
  resolutionLabel?: string;
  fileSizeLabel?: string;
  addedAt: number;
}

const STORAGE_KEY = 'stremo_downloads_v1';

export function getStoredDownloads(): DownloadItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStoredDownloads(items: DownloadItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('stremo-downloads-changed'));
  } catch {}
}

export function addDownloadItem(
  item: Omit<DownloadItem, 'id' | 'addedAt' | 'proxiedDownloadUrl'>
): DownloadItem {
  const current = getStoredDownloads();
  const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Génération d'un nom de fichier propre pour le téléchargement
  let cleanName = item.title;
  if (item.season && item.episode) {
    cleanName += ` S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`;
  }
  cleanName += '.mp4';

  const proxiedDownloadUrl = api.getProxiedStreamUrl(item.streamUrl, {
    download: true,
    filename: cleanName,
  });

  const newItem: DownloadItem = {
    ...item,
    id,
    addedAt: Date.now(),
    proxiedDownloadUrl,
  };

  // Ajoute en tête de file
  const updated = [newItem, ...current.filter((c) => c.streamUrl !== item.streamUrl)];
  saveStoredDownloads(updated);
  return newItem;
}

export function removeDownloadItem(id: string): void {
  const current = getStoredDownloads();
  const updated = current.filter((c) => c.id !== id);
  saveStoredDownloads(updated);
}

export function clearAllDownloads(): void {
  saveStoredDownloads([]);
}

export function triggerBrowserDownload(url: string, filename?: string): void {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
