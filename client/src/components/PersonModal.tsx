import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Film,
  Tv,
  Star,
  User,
  Clapperboard,
  Sparkles,
} from 'lucide-react';
import { api, type CatalogItem } from '../api';

export interface PersonInfo {
  name: string;
  photo?: string;
  role?: string;
}

interface Props {
  person: PersonInfo;
  onClose: () => void;
  onSelectMedia: (item: CatalogItem) => void;
  onSearchGlobal?: (query: string) => void;
}

export const PersonModal: React.FC<Props> = ({
  person,
  onClose,
  onSelectMedia,
  onSearchGlobal,
}) => {
  const [works, setWorks] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'series'>('all');

  // Fermeture par touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Récupération automatique de la filmographie via recherche catalog
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const fetchFilmography = async () => {
      try {
        const query = person.name.trim();
        const [movieCats, seriesCats] = await Promise.all([
          api.getCatalogs('movie', undefined, query),
          api.getCatalogs('series', undefined, query),
        ]);

        const dedupe = new Map<string, CatalogItem>();
        movieCats.flatMap((c) => c.metas).forEach((m) => dedupe.set(m.id, m));
        seriesCats.flatMap((c) => c.metas).forEach((m) => dedupe.set(m.id, m));

        if (isMounted) {
          setWorks(Array.from(dedupe.values()));
        }
      } catch (err) {
        console.warn('Erreur chargement filmographie:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchFilmography();
    return () => {
      isMounted = false;
    };
  }, [person.name]);

  const filteredWorks = works.filter((w) => {
    if (filterType === 'all') return true;
    return w.type === filterType;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Filmographie de ${person.name}`}
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl bg-[#0f131d] border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* En-tête profil */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-b from-indigo-950/40 via-[#0f131d] to-[#0f131d] border-b border-white/5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition cursor-pointer"
            title="Fermer (Échap)"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Portrait haute qualité */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-black/50 border-2 border-indigo-500/30 shadow-xl shrink-0 flex items-center justify-center">
            {person.photo ? (
              <img
                src={person.photo}
                alt={person.name}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <User className="w-12 h-12 text-slate-500" />
            )}
          </div>

          {/* Informations & Bio */}
          <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>{person.role || 'Casting & Équipe'}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {person.name}
            </h2>

            <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
              Consultez les films et séries associés dans les catalogues installés de votre Stremo.
            </p>

            {onSearchGlobal && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    onClose();
                    onSearchGlobal(person.name);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white border border-white/10 transition cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Recherche globale pour « {person.name} »</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Barre d'outils et filtres */}
        <div className="px-6 py-3 bg-white/[0.02] border-b border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              Tous ({works.length})
            </button>
            <button
              onClick={() => setFilterType('movie')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterType === 'movie'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Films</span>
            </button>
            <button
              onClick={() => setFilterType('series')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterType === 'series'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Séries</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-medium">
            {filteredWorks.length} titre(s) trouvé(s)
          </span>
        </div>

        {/* Grille de filmographie */}
        <div className="p-6 overflow-y-auto flex-1 no-scrollbar">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="space-y-2 animate-pulse">
                  <div className="aspect-[2/3] rounded-xl bg-white/5" />
                  <div className="h-3 w-3/4 bg-white/5 rounded" />
                  <div className="h-2 w-1/2 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : filteredWorks.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 mx-auto">
                <Clapperboard className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">
                Aucune autre œuvre trouvée directement dans le cache
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Vous pouvez lancer une recherche globale pour explorer l'ensemble des catalogues et modules installés.
              </p>
              {onSearchGlobal && (
                <button
                  onClick={() => {
                    onClose();
                    onSearchGlobal(person.name);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg transition cursor-pointer inline-flex items-center gap-2"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Rechercher « {person.name} » partout</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredWorks.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onClose();
                    onSelectMedia(item);
                  }}
                  className="group flex flex-col text-left transition transform hover:-translate-y-1 cursor-pointer focus:outline-none"
                >
                  <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-white/5 relative border border-white/5 group-hover:border-indigo-500/50 shadow group-hover:shadow-indigo-500/20 transition">
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Film className="w-8 h-8" />
                      </div>
                    )}

                    {/* Badge type */}
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-extrabold uppercase text-white">
                      {item.type === 'series' ? 'Série' : 'Film'}
                    </span>

                    {/* Note IMDb si dispo */}
                    {item.imdbRating && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-amber-500/90 text-black text-[9px] font-black flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-black" />
                        <span>{item.imdbRating}</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-0.5">
                    <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 line-clamp-1 transition">
                      {item.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {item.year || (item.type === 'series' ? 'Série TV' : 'Film')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
