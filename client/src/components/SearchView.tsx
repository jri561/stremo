import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Star,
  Film,
  Tv,
  Clock,
  TrendingUp,
  LayoutGrid,
  List,
  Play,
  ArrowRight,
} from 'lucide-react';
import type { CatalogItem } from '../api';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  results: { movies: CatalogItem[]; series: CatalogItem[] };
  isSearching: boolean;
  onSelectMedia: (item: CatalogItem) => void;
  isKids?: boolean;
}

const STORAGE_KEY_RECENT = 'stremo_recent_searches';

// Suggestions rapides et populaires pour découverte instantanée
const GENERAL_SUGGESTIONS = [
  { label: 'Tendances 2026', query: '2026', icon: '🔥' },
  { label: 'Batman', query: 'Batman', icon: '🦇' },
  { label: 'Marvel', query: 'Marvel', icon: '✨' },
  { label: 'Science-Fiction', query: 'Sci-Fi', icon: '🛸' },
  { label: 'Action & Aventure', query: 'Action', icon: '💥' },
  { label: 'Animation & Anime', query: 'Animation', icon: '🎌' },
  { label: 'Comédies', query: 'Comedy', icon: '😂' },
  { label: 'Films Populaires', query: 'Popular', icon: '🍿' },
];

const KIDS_SUGGESTIONS = [
  { label: 'Dessins animés', query: 'Animation', icon: '🎨' },
  { label: 'Disney & Pixar', query: 'Disney', icon: '🏰' },
  { label: 'Aventure', query: 'Aventure', icon: '🦁' },
  { label: 'Comédies Famille', query: 'Comédie', icon: '🎉' },
  { label: 'Super-héros', query: 'Spider', icon: '🕷️' },
  { label: 'Magie & Contes', query: 'Magic', icon: '🪄' },
];

export const SearchView: React.FC<Props> = ({
  query,
  onQueryChange,
  results,
  isSearching,
  onSelectMedia,
  isKids = false,
}) => {
  const suggestions = isKids ? KIDS_SUGGESTIONS : GENERAL_SUGGESTIONS;
  const [filterType, setFilterType] = useState<'all' | 'movies' | 'series'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Charger les recherches récentes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECENT);
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {
      // Ignorer erreur de parsing
    }
  }, []);

  // Donner le focus à l'entrée dès l'ouverture
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Enregistrer une recherche dans l'historique quand l'utilisateur soumet ou sélectionne
  const saveSearchTerm = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 8);
      try {
        localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated));
      } catch {
        // Ignorer
      }
      return updated;
    });
  };

  const handleSelectRecent = (term: string) => {
    onQueryChange(term);
    saveSearchTerm(term);
  };

  const handleRemoveRecent = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== term);
      try {
        localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated));
      } catch {
        // Ignorer
      }
      return updated;
    });
  };

  const handleClearAllRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY_RECENT);
    } catch {
      // Ignorer
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      saveSearchTerm(query);
    }
  };

  const totalMovies = results.movies.length;
  const totalSeries = results.series.length;
  const totalAll = totalMovies + totalSeries;

  const displayItems =
    filterType === 'movies'
      ? results.movies
      : filterType === 'series'
      ? results.series
      : [...results.movies, ...results.series];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* 1. GRANDE BARRE DE RECHERCHE PRINCIPALE */}
      <div className="space-y-3">
        <div className="relative group max-w-3xl">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher par titre, saga, réalisateur, acteur..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-12 pr-12 py-3.5 bg-[#0e121a] hover:bg-[#121622] focus:bg-[#151a28] border border-white/10 focus:border-indigo-500 rounded-2xl text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none transition shadow-lg shadow-black/40"
          />
          {query ? (
            <button
              onClick={() => onQueryChange('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Effacer la saisie"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-slate-400 border border-white/10 px-1.5 py-0.5 rounded hidden sm:inline">
              Entrée
            </span>
          )}
        </div>

        {/* 2. RECHERCHES RÉCENTES & MOTS-CLÉS RAPIDES (affichés si aucune requête ou peu de saisie) */}
        {!query.trim() && (
          <div className="space-y-5 pt-2">
            {/* Historique récent */}
            {recentSearches.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" /> Recherches récentes
                  </span>
                  <button
                    onClick={handleClearAllRecent}
                    className="text-[11px] text-slate-400 hover:text-red-400 transition cursor-pointer"
                  >
                    Effacer l'historique
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <div
                      key={term}
                      onClick={() => handleSelectRecent(term)}
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-xs font-medium text-slate-200 hover:text-white transition cursor-pointer"
                    >
                      <Search className="w-3 h-3 text-slate-400" />
                      <span>{term}</span>
                      <button
                        onClick={(e) => handleRemoveRecent(term, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition"
                        title="Supprimer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions & Thématiques rapides */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" /> Suggestions de recherche rapide
              </span>

              <div className="flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      onQueryChange(item.query);
                      saveSearchTerm(item.query);
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0f1420] hover:bg-indigo-600/20 border border-white/8 hover:border-indigo-500/40 text-xs font-semibold text-slate-200 hover:text-white transition cursor-pointer group"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. BARRE DE CONTRÔLE DES RÉSULTATS (Onglets Films/Séries & Commutateur Grille/Liste) */}
      {query.trim() && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/8">
          {/* Compteur & Titre */}
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Résultats pour « <span className="text-indigo-300">{query}</span> »
            </h2>
            {!isSearching && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                {totalAll}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Filtres par type */}
            <div className="flex items-center p-0.5 bg-white/5 rounded-xl border border-white/8 text-xs font-semibold">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tous ({totalAll})
              </button>

              <button
                onClick={() => setFilterType('movies')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  filterType === 'movies'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                Films ({totalMovies})
              </button>

              <button
                onClick={() => setFilterType('series')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  filterType === 'series'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                Séries ({totalSeries})
              </button>
            </div>

            {/* Commutateur de vue Grille / Liste */}
            <div className="hidden sm:flex items-center p-0.5 bg-white/5 rounded-xl border border-white/8">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white/15 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vue Grille"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white/15 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vue Liste Détaillée"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONTENU DES RÉSULTATS */}
      {isSearching ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-300">
            Recherche en cours dans vos catalogues...
          </p>
        </div>
      ) : query.trim() && displayItems.length === 0 ? (
        <div className="py-24 text-center text-slate-400 space-y-3 bg-white/[0.01] rounded-2xl border border-white/5 p-8">
          <Search className="w-10 h-10 mx-auto text-slate-600" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-200">
              Aucun résultat pour « {query} »
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Vérifiez l'orthographe du titre ou activez des add-ons supplémentaires dans le gestionnaire.
            </p>
          </div>
          <button
            onClick={() => onQueryChange('')}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition cursor-pointer"
          >
            Effacer la recherche
          </button>
        </div>
      ) : (
        query.trim() && (
          <>
            {/* VUE 1 : GRILLE AÉRÉE & LISIBLE */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                {displayItems.map((media) => {
                  const ratingValid =
                    media.imdbRating &&
                    String(media.imdbRating) !== 'N/A' &&
                    Number(media.imdbRating) > 0;
                  const isSeries = media.type === 'series';

                  return (
                    <div
                      key={media.id}
                      onClick={() => {
                        saveSearchTerm(query);
                        onSelectMedia(media);
                      }}
                      className="group relative cursor-pointer flex flex-col rounded-2xl overflow-hidden bg-[#0d1017] border border-white/8 hover:border-white/25 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-200"
                    >
                      {/* Affiche avec badges */}
                      <div className="aspect-[2/3] w-full overflow-hidden bg-[#07090e] relative">
                        {media.poster ? (
                          <img
                            src={media.poster}
                            alt={media.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-103 transition duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs text-center p-3">
                            Pas d'affiche disponible
                          </div>
                        )}

                        {/* Badge Type (Film / Série) */}
                        <div className="absolute top-2.5 left-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md border ${
                              isSeries
                                ? 'bg-indigo-600/80 text-white border-indigo-400/40'
                                : 'bg-black/80 text-slate-200 border-white/15'
                            }`}
                          >
                            {isSeries ? 'Série' : 'Film'}
                          </span>
                        </div>

                        {/* Note IMDb dorée */}
                        {ratingValid && (
                          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur text-[10px] font-bold text-amber-300 flex items-center gap-1 border border-white/15 shadow-md">
                            <Star className="w-2.5 h-2.5 fill-amber-300" />
                            <span>{media.imdbRating}</span>
                          </div>
                        )}
                      </div>

                      {/* Métadonnées bien lisibles */}
                      <div className="p-3 space-y-1">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-indigo-300 line-clamp-1 transition leading-snug">
                          {media.name}
                        </h4>

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{media.year || 'Année inconnue'}</span>
                          {media.genres && media.genres.length > 0 && (
                            <span className="truncate max-w-[100px] text-[10px]">
                              {media.genres[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VUE 2 : LISTE DÉTAILLÉE HAUTE LISIBILITÉ */}
            {viewMode === 'list' && (
              <div className="space-y-3">
                {displayItems.map((media) => {
                  const ratingValid =
                    media.imdbRating &&
                    String(media.imdbRating) !== 'N/A' &&
                    Number(media.imdbRating) > 0;
                  const isSeries = media.type === 'series';

                  return (
                    <div
                      key={media.id}
                      onClick={() => {
                        saveSearchTerm(query);
                        onSelectMedia(media);
                      }}
                      className="group p-3.5 rounded-2xl bg-[#0e121a] hover:bg-[#131724] border border-white/8 hover:border-white/20 transition flex items-center justify-between gap-4 cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {/* Affiche miniature */}
                        <div className="w-14 sm:w-16 aspect-[2/3] rounded-xl overflow-hidden bg-black shrink-0 relative border border-white/10">
                          {media.poster ? (
                            <img
                              src={media.poster}
                              alt={media.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">
                              N/A
                            </div>
                          )}
                        </div>

                        {/* Informations textuelles */}
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isSeries
                                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                                  : 'bg-white/10 text-slate-300 border border-white/10'
                              }`}
                            >
                              {isSeries ? 'Série TV' : 'Film'}
                            </span>

                            {ratingValid && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400/15 text-amber-300 border border-amber-400/25">
                                <Star className="w-2.5 h-2.5 fill-amber-300" />
                                {media.imdbRating}
                              </span>
                            )}

                            {media.year && (
                              <span className="text-xs text-slate-400 font-semibold">
                                {media.year}
                              </span>
                            )}

                            {media.genres && media.genres.length > 0 && (
                              <span className="text-xs text-slate-400 hidden sm:inline">
                                • {media.genres.slice(0, 3).join(', ')}
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-300 transition truncate">
                            {media.name}
                          </h3>

                          {media.description && (
                            <p className="text-xs text-slate-400 line-clamp-1 hidden md:block">
                              {media.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Bouton d'action */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveSearchTerm(query);
                          onSelectMedia(media);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-black hover:bg-slate-200 flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow"
                      >
                        <Play className="w-3.5 h-3.5 fill-black" />
                        <span className="hidden sm:inline">Voir</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
};
export default SearchView;
