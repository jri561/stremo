import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Play,
  Trash2,
  HardDrive,
  CheckCircle2,
  Film,
} from 'lucide-react';
import {
  getStoredDownloads,
  removeDownloadItem,
  clearAllDownloads,
  triggerBrowserDownload,
  type DownloadItem,
} from '../downloads';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPlayDownloadedItem: (item: DownloadItem) => void;
}

export const DownloadsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onPlayDownloadedItem,
}) => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDownloads(getStoredDownloads());
    }
  }, [isOpen]);

  // Écouter les changements en direct
  useEffect(() => {
    const handleUpdate = () => setDownloads(getStoredDownloads());
    window.addEventListener('stremo-downloads-changed', handleUpdate);
    return () => window.removeEventListener('stremo-downloads-changed', handleUpdate);
  }, []);

  // Fermeture par touche Échap
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRemove = (id: string) => {
    removeDownloadItem(id);
    setDownloads((prev) => prev.filter((d) => d.id !== id));
  };

  const handleClearAll = () => {
    if (confirm('Voulez-vous vraiment effacer tout l’historique des téléchargements ?')) {
      clearAllDownloads();
      setDownloads([]);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-2xl bg-[#0e1118] border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* EN-TÊTE */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-[#121622]/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Téléchargements Hors-Ligne
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {downloads.length}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Vos médias sauvegardés pour une lecture sans connexion internet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {downloads.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition cursor-pointer"
                title="Tout effacer"
              >
                Tout effacer
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* LISTE DES TÉLÉCHARGEMENTS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 no-scrollbar">
          {downloads.length === 0 ? (
            <div className="py-12 sm:py-16 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-500">
                <HardDrive className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h3 className="text-sm font-bold text-white">
                  Aucun média téléchargé
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Dans la fiche d'un film ou d'un épisode, cliquez sur l'icône{' '}
                  <span className="inline-flex items-center gap-0.5 text-indigo-400 font-semibold px-1 py-0.5 rounded bg-indigo-500/10">
                    <Download className="w-3 h-3" /> Télécharger
                  </span>{' '}
                  pour l'emporter hors-ligne en voyage ou en train !
                </p>
              </div>
            </div>
          ) : (
            downloads.map((item) => (
              <div
                key={item.id}
                className="p-3 sm:p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 transition flex items-center justify-between gap-3 group"
              >
                {/* Affiche & Titre */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="relative w-12 h-16 sm:w-14 sm:h-20 rounded-lg overflow-hidden bg-black/50 shrink-0 border border-white/10">
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Film className="w-5 h-5" />
                      </div>
                    )}
                    {item.resolutionLabel && (
                      <div className="absolute top-1 left-1 px-1 py-0.2 rounded bg-black/80 text-[8px] font-extrabold text-amber-300">
                        {item.resolutionLabel}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                      {item.mediaType === 'series' && item.season && item.episode ? (
                        <span className="text-indigo-400 font-semibold">
                          Saison {item.season} • Épisode {item.episode}
                        </span>
                      ) : (
                        <span>Film</span>
                      )}
                      {item.fileSizeLabel && <span>• {item.fileSizeLabel}</span>}
                      <span>
                        • {new Date(item.addedAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Boutons d'action */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      onClose();
                      onPlayDownloadedItem(item);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
                    title="Regarder directement dans Stremo"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden sm:inline">Regarder</span>
                  </button>

                  <button
                    onClick={() => triggerBrowserDownload(item.proxiedDownloadUrl)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer"
                    title="Télécharger à nouveau le fichier"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition cursor-pointer"
                    title="Supprimer de la liste"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* PIED DE MODALE */}
        <div className="p-4 border-t border-white/10 bg-[#121622]/40 text-center text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Fichiers compatibles lecteurs mobiles, TV et PC</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadsModal;
