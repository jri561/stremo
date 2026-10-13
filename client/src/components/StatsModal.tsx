import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Film,
  Tv,
  Bookmark,
  Award,
  BarChart3,
  TrendingUp,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { api, type Profile, type ProfileStats } from '../api';

interface Props {
  isOpen: boolean;
  profile: Profile;
  onClose: () => void;
}

export const StatsModal: React.FC<Props> = ({ isOpen, profile, onClose }) => {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    api.getProfileStats(profile.id)
      .then((data) => {
        if (isMounted) {
          setStats(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, profile.id]);

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

  // Calcul des badges cinéphiles
  const badges = [];
  if (stats) {
    if (stats.totalWatchTimeSeconds >= 36000) {
      badges.push({ title: 'Grand Spectateur', desc: '+10 heures de visionnage', icon: '⏱️' });
    }
    if (stats.episodesWatchedCount >= 10) {
      badges.push({ title: 'Binge Watcher', desc: '+10 épisodes terminés', icon: '🍿' });
    }
    if (stats.moviesWatchedCount >= 5) {
      badges.push({ title: 'Cinéphile Assidu', desc: '+5 films complétés', icon: '🎬' });
    }
    if (stats.topGenres.length >= 3) {
      badges.push({ title: 'Explorateur Éclectique', desc: 'Plus de 3 genres explorés', icon: '🌟' });
    }
  }

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
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Statistiques de Visionnage
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {profile.name}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Temps passé, films, séries et habitudes cinématographiques du profil
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENU */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <div className="w-8 h-8 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold">Analyse de l'historique en cours...</p>
            </div>
          ) : !stats ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">Aucune donnée de visionnage disponible pour le moment.</p>
            </div>
          ) : (
            <>
              {/* CARTE MAÎTRESSE : TEMPS TOTAL */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-[#121622] border border-indigo-500/30 shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Temps total de visionnage
                    </span>
                    <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {stats.totalWatchTimeFormatted}
                    </h3>
                    <p className="text-xs text-slate-300">
                      Cumul de tous vos films et séries visionnés sur ce profil
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shrink-0 text-center sm:text-right">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-300 block">
                      Médias terminés
                    </span>
                    <span className="text-2xl font-black text-amber-300 block">
                      {stats.totalItemsCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* GRILLE DES 3 COMPTEURS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold">Films vus</span>
                    <Film className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-black text-white">
                    {stats.moviesWatchedCount}
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    Complétés à +80%
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold">Épisodes vus</span>
                    <Tv className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white">
                    {stats.episodesWatchedCount}
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    Séries suivies
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold">Ma Liste</span>
                    <Bookmark className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-white">
                    {stats.libraryItemsCount}
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    Titres favoris enregistrés
                  </span>
                </div>
              </div>

              {/* SÉRIE LA PLUS DÉVORÉE (TOP BINGE) */}
              {stats.favoriteSeries && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-white/[0.02] to-transparent border border-amber-500/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                      <Flame className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 block">
                        Série la plus regardée
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        {stats.favoriteSeries.title}
                      </h4>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-extrabold text-xs shrink-0 border border-amber-500/30">
                    {stats.favoriteSeries.episodesWatched} épisodes
                  </span>
                </div>
              )}

              {/* TOP GENRES */}
              {stats.topGenres.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Genres préférés dans vos favoris
                  </h4>
                  <div className="space-y-2">
                    {stats.topGenres.map((g) => {
                      const maxCount = stats.topGenres[0]?.count || 1;
                      const percent = Math.round((g.count / maxCount) * 100);
                      return (
                        <div key={g.genre} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-white">{g.genre}</span>
                            <span className="text-slate-400 font-medium">{g.count} titres</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BADGES CINÉPHILES */}
              {badges.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5" />
                    Badges & Trophées débloqués
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {badges.map((b) => (
                      <div
                        key={b.title}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3"
                      >
                        <span className="text-2xl">{b.icon}</span>
                        <div>
                          <h5 className="text-xs font-bold text-white">{b.title}</h5>
                          <p className="text-[11px] text-slate-400">{b.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* PIED DE MODALE */}
        <div className="p-4 border-t border-white/10 bg-[#121622]/40 text-center text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Données privées et isolées en local</span>
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

export default StatsModal;
