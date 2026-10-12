import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Puzzle,
  CheckCircle2,
  X,
  Sparkles,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import type { AddonInfo } from '../api';

interface Props {
  addons: AddonInfo[];
  onAddAddon: (url: string) => Promise<void>;
  onRemoveAddon: (id: string) => Promise<void>;
  onClose: () => void;
}

export const AddonManager: React.FC<Props> = ({
  addons,
  onAddAddon,
  onRemoveAddon,
  onClose,
}) => {
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'installed' | 'community'>('installed');

  // Gérer Échap pour fermer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Add-ons populaires Stremio recommandés
  const communityRecommendations = [
    {
      id: 'torrentio',
      name: 'Torrentio',
      desc: 'Fournit des flux Torrents et Debrid (RealDebrid, AllDebrid, Torbox) haute fidélité.',
      url: 'https://torrentio.strem.fun/manifest.json',
      badge: 'Indispensable',
    },
    {
      id: 'cyberflix',
      name: 'CyberFlix Catalog',
      desc: 'Catalogues organisés des grandes plateformes : Netflix, Prime Video, Disney+, Apple TV+, etc.',
      url: 'https://cyberflix.kamyroll.net/manifest.json',
      badge: 'Catalogues',
    },
    {
      id: 'animekisa',
      name: 'Anime Kisa / Kitsune',
      desc: 'Spécialisé dans l’animation japonaise avec épisodes, saisons, VOSTFR et VF.',
      url: 'https://anime-kisa.strem.fun/manifest.json',
      badge: 'Anime',
    },
    {
      id: 'opensubtitles',
      name: 'OpenSubtitles v3',
      desc: 'Sous-titres officiels automatiques multi-langues synchronisés pour films et séries.',
      url: 'https://opensubtitles-v3.strem.io/manifest.json',
      badge: 'Sous-titres',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onAddAddon(newUrl.trim());
      setNewUrl('');
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'ajout de l'add-on");
    } finally {
      setLoading(false);
    }
  };

  const handleInstallOneClick = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      await onAddAddon(url);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'installation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gestionnaire d'Add-ons"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 md:p-10 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0c1017] border border-white/10 rounded-2xl md:rounded-3xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* En-tête */}
        <div className="px-6 sm:px-8 py-5 border-b border-white/8 flex items-center justify-between shrink-0 bg-[#080a0f]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight">
                Gestionnaire d'Add-ons Stremio
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Catalogues, métadonnées, sous-titres et flux compatibles avec le protocole Stremio.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer le gestionnaire"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition border border-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barre d'outils et formulaire d'ajout */}
        <div className="px-6 sm:px-8 py-4 border-b border-white/8 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 bg-[#0e121a]">
          {/* Onglets */}
          <div className="flex items-center p-1 bg-white/5 rounded-xl border border-white/5 w-full md:w-auto">
            <button
              onClick={() => setFilterType('installed')}
              className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                filterType === 'installed'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Installés ({addons.length})
            </button>
            <button
              onClick={() => setFilterType('community')}
              className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                filterType === 'community'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Recommandés
            </button>
          </div>

          {/* Formulaire d'URL */}
          <form onSubmit={handleSubmit} className="flex gap-2 w-full md:max-w-lg">
            <input
              type="text"
              required
              placeholder="Coller l'URL du manifest (https://... ou stremio://...)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{loading ? 'Installation...' : 'Installer'}</span>
            </button>
          </form>
        </div>

        {error && (
          <div className="mx-6 sm:mx-8 mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Zone de contenu défilable */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4 no-scrollbar bg-[#0c1017]">
          {filterType === 'installed' && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Add-ons actifs ({addons.length})
              </div>

              {addons.map((addon) => {
                const isCinemeta = addon.id === 'cinemeta';
                const manifest = addon.manifest;

                return (
                  <div
                    key={addon.id}
                    className="p-4 sm:p-5 rounded-2xl bg-[#111622] border border-white/8 hover:border-white/15 transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Ligne de titre et badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {manifest?.logo ? (
                          <img
                            src={manifest.logo}
                            alt={addon.name}
                            className="w-7 h-7 rounded-lg object-contain bg-black/40 border border-white/10"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                            {addon.name.charAt(0)}
                          </div>
                        )}

                        <h3 className="font-bold text-sm sm:text-base text-white">
                          {addon.name}
                        </h3>

                        {manifest?.version && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-slate-300">
                            v{manifest.version}
                          </span>
                        )}

                        {isCinemeta && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Officiel Stremio
                          </span>
                        )}

                        {addon.hasConfig && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            Configuré
                          </span>
                        )}
                      </div>

                      {/* Description du manifest si disponible */}
                      {manifest?.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {manifest.description}
                        </p>
                      )}

                      {/* Badges de fonctionnalités */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                          <Globe className="w-3 h-3 text-slate-500" />
                          {addon.host}
                        </span>

                        {manifest?.catalogs && manifest.catalogs > 0 && (
                          <span className="bg-white/5 px-2 py-0.5 rounded text-indigo-300 font-medium">
                            {manifest.catalogs} catalogue{manifest.catalogs > 1 ? 's' : ''}
                          </span>
                        )}

                        {manifest?.types?.map((t) => (
                          <span key={t} className="bg-white/5 px-2 py-0.5 rounded capitalize">
                            {t === 'movie' ? 'Films' : t === 'series' ? 'Séries' : t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action de désinstallation */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                      <button
                        onClick={() => onRemoveAddon(addon.id)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/25 flex items-center gap-1.5 transition cursor-pointer"
                        title="Désinstaller cet add-on"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Désinstaller</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filterType === 'community' && (
            <div className="space-y-4">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Sélection d'add-ons populaires à installer en 1 clic
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {communityRecommendations.map((rec) => {
                  const isInstalled = addons.some(
                    (a) => a.id.toLowerCase().includes(rec.id) || a.name.toLowerCase().includes(rec.id)
                  );

                  return (
                    <div
                      key={rec.id}
                      className="p-5 rounded-2xl bg-[#111622] border border-white/8 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm sm:text-base text-white">
                            {rec.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {rec.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-normal">
                          {rec.desc}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/8 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {new URL(rec.url).host}
                        </span>

                        {isInstalled ? (
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Installé
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInstallOneClick(rec.url)}
                            disabled={loading}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition shadow cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Installer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default AddonManager;
