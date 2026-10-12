import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Compass,
  Film,
  Tv,
  Star,
  LayoutGrid,
  List,
  Search,
  Filter,
  ArrowUpDown,
  X,
  Play,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Check,
} from 'lucide-react';
import type { CatalogSection, CatalogItem, WatchProgress } from '../api';

interface Props {
  catalogs: CatalogSection[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  mediaType: 'movie' | 'series';
  onMediaTypeChange: (type: 'movie' | 'series') => void;
  selectedGenre: string;
  onGenreChange: (genre: string) => void;
  selectedCatalogId: string;
  onSelectCatalogId: (catId: string) => void;
  onSelectMedia: (item: CatalogItem) => void;
  progressList?: WatchProgress[];
  isKids?: boolean;
}

type SortOption = 'popular' | 'rating' | 'year' | 'alpha';
type ViewMode = 'grid' | 'list';

const STORAGE_VIEW_KEY = 'stremo_discover_view_mode';

const POPULAR_GENRES = [
  'Action',
  'Animation',
  'Aventure',
  'Comédie',
  'Crime',
  'Drame',
  'Fantastique',
  'Horreur',
  'Mystère',
  'Romance',
  'Science-Fiction',
  'Thriller',
];

export const DiscoverView: React.FC<Props> = ({
  catalogs,
  isLoading,
  error,
  onRetry,
  mediaType,
  onMediaTypeChange,
  selectedGenre,
  onGenreChange,
  selectedCatalogId,
  onSelectCatalogId,
  onSelectMedia,
  progressList = [],
  isKids = false,
}) => {
  // Mode d'affichage Grille ou Liste
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_VIEW_KEY);
      if (saved === 'grid' || saved === 'list') return saved;
    } catch {
      // Ignorer
    }
    return 'grid';
  });

  // Tri actif
  const [sortBy, setSortBy] = useState<SortOption>('popular');

  // Filtre textuel local instantané
  const [localQuery, setLocalQuery] = useState('');

  // Sauvegarde de la préférence de vue
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_VIEW_KEY, viewMode);
    } catch {
      // Ignorer
    }
  }, [viewMode]);

  // Menus déroulants pour Catalogues et Genres
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const catalogDropdownRef = useRef<HTMLDivElement | null>(null);

  const [isGenreOpen, setIsGenreOpen] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');
  const genreDropdownRef = useRef<HTMLDivElement | null>(null);

  // Fermeture des menus déroulants au clic extérieur ou Échap
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        catalogDropdownRef.current &&
        !catalogDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCatalogOpen(false);
      }
      if (
        genreDropdownRef.current &&
        !genreDropdownRef.current.contains(e.target as Node)
      ) {
        setIsGenreOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCatalogOpen(false);
        setIsGenreOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Carte de progression de reprise de lecture par mediaId
  const progressMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of progressList) {
      if (p.duration > 0 && p.currentTime > 0) {
        const percent = (p.currentTime / p.duration) * 100;
        if (percent >= 2 && percent < 95) {
          map.set(p.mediaId, percent);
        }
      }
    }
    return map;
  }, [progressList]);

  // Liste de tous les genres disponibles combinés (genres des catalogues + genres populaires)
  const availableGenres = useMemo(() => {
    if (isKids) {
      return ['Animation', 'Aventure', 'Comédie', 'Famille', 'Fantastique'];
    }
    const fromCats = catalogs.flatMap((c) => c.genres || []);
    const merged = Array.from(new Set([...POPULAR_GENRES, ...fromCats])).filter(Boolean);
    return merged.sort((a, b) => a.localeCompare(b, 'fr'));
  }, [catalogs, isKids]);

  // Onglets de catalogues disponibles
  const catalogTabs = useMemo(() => {
    return catalogs.map((c) => ({
      id: c.catalogId,
      name: c.catalogName.replace(/^\[[^\]]+\]\s*/, ''),
      addonName: c.addonName,
      count: c.metas.length,
    }));
  }, [catalogs]);

  // Total des médias disponibles avant filtrage textuel local
  const totalRawItems = useMemo(() => {
    const seen = new Set<string>();
    catalogs.forEach((c) => c.metas.forEach((m) => seen.add(m.id)));
    return seen.size;
  }, [catalogs]);

  // Catalogue actif
  const activeCatalog = useMemo(() => {
    return catalogTabs.find((c) => c.id === selectedCatalogId);
  }, [catalogTabs, selectedCatalogId]);

  // Catalogues filtrés pour le menu déroulant
  const filteredCatalogTabsForDropdown = useMemo(() => {
    if (!catalogSearch.trim()) return catalogTabs;
    const q = catalogSearch.toLowerCase();
    return catalogTabs.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.addonName && c.addonName.toLowerCase().includes(q))
    );
  }, [catalogTabs, catalogSearch]);

  // Genres filtrés pour le menu déroulant
  const filteredGenresForDropdown = useMemo(() => {
    if (!genreSearch.trim()) return availableGenres;
    const q = genreSearch.toLowerCase();
    return availableGenres.filter((g) => g.toLowerCase().includes(q));
  }, [availableGenres, genreSearch]);

  // Fonction de tri
  const sortItems = (items: CatalogItem[]): CatalogItem[] => {
    if (sortBy === 'popular') return items;

    const copy = [...items];
    if (sortBy === 'rating') {
      return copy.sort((a, b) => {
        const rA = Number(a.imdbRating) || 0;
        const rB = Number(b.imdbRating) || 0;
        return rB - rA;
      });
    }
    if (sortBy === 'year') {
      return copy.sort((a, b) => {
        const yA = Number(a.year) || 0;
        const yB = Number(b.year) || 0;
        return yB - yA;
      });
    }
    if (sortBy === 'alpha') {
      return copy.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
    }
    return copy;
  };

  // Fonction de filtre local instantané
  const filterByLocalQuery = (items: CatalogItem[]): CatalogItem[] => {
    if (!localQuery.trim()) return items;
    const q = localQuery.trim().toLowerCase();
    return items.filter((m) => {
      const nameMatch = m.name?.toLowerCase().includes(q);
      const genreMatch = m.genres?.some((g) => g.toLowerCase().includes(q));
      const descMatch = m.description?.toLowerCase().includes(q);
      return nameMatch || genreMatch || descMatch;
    });
  };

  // Est-ce qu'un filtre non-par défaut est actif ?
  const hasActiveFilters =
    selectedGenre !== '' ||
    selectedCatalogId !== 'all' ||
    sortBy !== 'popular' ||
    localQuery.trim() !== '';

  const handleResetFilters = () => {
    onGenreChange('');
    onSelectCatalogId('all');
    setSortBy('popular');
    setLocalQuery('');
  };

  // Préparation des catalogues affichés
  const processedCatalogs = useMemo(() => {
    const targetCats =
      selectedCatalogId === 'all'
        ? catalogs
        : catalogs.filter((c) => c.catalogId === selectedCatalogId);

    return targetCats.map((cat) => {
      const filtered = filterByLocalQuery(cat.metas);
      const sorted = sortItems(filtered);
      return {
        ...cat,
        metas: sorted,
      };
    });
  }, [catalogs, selectedCatalogId, sortBy, localQuery]);

  // Nombre total de résultats filtrés affichés
  const totalFilteredCount = useMemo(() => {
    const seen = new Set<string>();
    processedCatalogs.forEach((c) => c.metas.forEach((m) => seen.add(m.id)));
    return seen.size;
  }, [processedCatalogs]);

  // Si on est en mode tri global (non popular) ou avec recherche locale, on fusionne les catalogues en une grille dédupliquée
  const shouldMergeCatalogs =
    sortBy !== 'popular' || localQuery.trim() !== '' || selectedCatalogId !== 'all';

  const mergedItems = useMemo(() => {
    if (!shouldMergeCatalogs) return [];
    const map = new Map<string, CatalogItem>();
    processedCatalogs.forEach((c) => {
      c.metas.forEach((m) => {
        if (!map.has(m.id)) {
          map.set(m.id, m);
        }
      });
    });
    return sortItems(Array.from(map.values()));
  }, [processedCatalogs, shouldMergeCatalogs, sortBy]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-16">
      {/* 1. EN-TÊTE ÉLÉGANT AVEC STATISTIQUES ET RÉINITIALISATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/5">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Explorer le Catalogue
              </h1>
              {!isLoading && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
                  {totalFilteredCount} {totalFilteredCount > 1 ? 'titres' : 'titre'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Filtrez et découvrez l'ensemble des contenus de vos extensions Stremio.
            </p>
          </div>
        </div>

        {/* Bouton de réinitialisation si des filtres sont actifs */}
        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* 2. BARRE D'OUTILS ET CONTRÔLES PRINCIPAUX AVEC MENUS DÉROULANTS */}
      <div className="bg-[#0d1017] p-3.5 sm:p-4 rounded-2xl border border-white/8 space-y-3.5 shadow-xl shadow-black/30">
        {/* LIGNE 1 : CONTRÔLES COMPACTS & DÉROULANTS */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Groupe gauche : Films/Séries + Sélecteur Déroulant de Catalogue + Sélecteur Déroulant de Genre */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Commutateur Films / Séries */}
            <div className="flex items-center p-1 bg-black/40 rounded-xl border border-white/8 shrink-0">
              <button
                onClick={() => onMediaTypeChange('movie')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  mediaType === 'movie'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                Films
              </button>
              <button
                onClick={() => onMediaTypeChange('series')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  mediaType === 'series'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                Séries
              </button>
            </div>

            {/* SÉLECTEUR DÉROULANT DE CATALOGUE (Accessible à 100%, aucun dépassement d'écran) */}
            <div className="relative" ref={catalogDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsCatalogOpen((prev) => !prev);
                  setIsGenreOpen(false);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  selectedCatalogId !== 'all'
                    ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500/40 shadow-sm'
                    : 'bg-black/40 text-slate-200 border-white/8 hover:bg-white/5 hover:border-white/15'
                }`}
                title="Choisir un catalogue dans le menu déroulant"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-slate-400 hidden sm:inline">Catalogue :</span>
                <span className="font-bold truncate max-w-[130px] sm:max-w-[190px]">
                  {selectedCatalogId === 'all'
                    ? 'Tous les catalogues'
                    : activeCatalog?.name || 'Catalogue'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold shrink-0">
                  {selectedCatalogId === 'all' ? totalRawItems : activeCatalog?.count || 0}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                    isCatalogOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* POPUP DÉROULANT COMPLET DES CATALOGUES */}
              {isCatalogOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 sm:w-84 max-h-96 overflow-hidden flex flex-col rounded-2xl bg-[#0e121a] border border-white/15 shadow-2xl shadow-black/95 z-50 animate-fade-in backdrop-blur-xl">
                  {/* Champ de recherche rapide interne au menu si beaucoup de catalogues */}
                  <div className="p-2 border-b border-white/8 bg-[#0a0d14]">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Rechercher un catalogue..."
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-black/50 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="p-1.5 overflow-y-auto max-h-72 space-y-1">
                    {/* Option Tous les catalogues */}
                    <button
                      onClick={() => {
                        onSelectCatalogId('all');
                        setIsCatalogOpen(false);
                        setCatalogSearch('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        selectedCatalogId === 'all'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                        <span>Tous les catalogues</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/30">
                        {totalRawItems} titres
                      </span>
                    </button>

                    <div className="my-1 border-t border-white/5" />

                    {/* Liste des catalogues individuels */}
                    {filteredCatalogTabsForDropdown.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-500">
                        Aucun catalogue trouvé
                      </div>
                    ) : (
                      filteredCatalogTabsForDropdown.map((cat, idx) => {
                        const isSelected = selectedCatalogId === cat.id;
                        return (
                          <button
                            key={`${cat.id}-${idx}`}
                            onClick={() => {
                              onSelectCatalogId(cat.id);
                              setIsCatalogOpen(false);
                              setCatalogSearch('');
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-300 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 text-white shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full bg-white/10 shrink-0" />
                              )}
                              <span className="truncate">{cat.name}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {cat.addonName && (
                                <span className="text-[10px] text-slate-400 px-1.5 py-0.2 rounded bg-black/40 border border-white/5">
                                  {cat.addonName}
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-black/30">
                                {cat.count}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SÉLECTEUR DÉROULANT DE GENRE */}
            <div className="relative" ref={genreDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsGenreOpen((prev) => !prev);
                  setIsCatalogOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  selectedGenre !== ''
                    ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500/40 shadow-sm'
                    : 'bg-black/40 text-slate-200 border-white/8 hover:bg-white/5 hover:border-white/15'
                }`}
                title="Filtrer par genre dans le menu déroulant"
              >
                <Filter className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-slate-400 hidden sm:inline">Genre :</span>
                <span className="font-bold truncate max-w-[110px]">
                  {selectedGenre || 'Tous'}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                    isGenreOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* POPUP DÉROULANT DES GENRES */}
              {isGenreOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 max-h-80 overflow-hidden flex flex-col rounded-2xl bg-[#0e121a] border border-white/15 shadow-2xl shadow-black/95 z-50 animate-fade-in backdrop-blur-xl">
                  <div className="p-2 border-b border-white/8 bg-[#0a0d14]">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Rechercher un genre..."
                        value={genreSearch}
                        onChange={(e) => setGenreSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-black/50 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="p-1.5 overflow-y-auto max-h-60 space-y-1">
                    <button
                      onClick={() => {
                        onGenreChange('');
                        setIsGenreOpen(false);
                        setGenreSearch('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        selectedGenre === ''
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>Tous les genres</span>
                      {selectedGenre === '' && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>

                    <div className="my-1 border-t border-white/5" />

                    {filteredGenresForDropdown.map((g) => {
                      const isSelected = selectedGenre === g;
                      return (
                        <button
                          key={g}
                          onClick={() => {
                            onGenreChange(isSelected ? '' : g);
                            setIsGenreOpen(false);
                            setGenreSearch('');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'text-slate-300 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span>{g}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Groupe droite : Tri + Filtre instantané + Grille/Liste */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Tri sélecteur */}
            <div className="relative flex items-center">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/40 border border-white/8 text-xs font-semibold text-slate-300">
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-slate-400 hidden sm:inline">Tri :</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-1"
                >
                  <option value="popular" className="bg-[#0e121a] text-white">
                    Recommandé (Défaut)
                  </option>
                  <option value="rating" className="bg-[#0e121a] text-white">
                    ⭐ Mieux notés (IMDb)
                  </option>
                  <option value="year" className="bg-[#0e121a] text-white">
                    📅 Plus récents
                  </option>
                  <option value="alpha" className="bg-[#0e121a] text-white">
                    🔤 Alphabétique (A-Z)
                  </option>
                </select>
              </div>
            </div>

            {/* Filtre local rapide */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrer la liste..."
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                className="pl-8.5 pr-7 py-2 rounded-xl bg-black/40 border border-white/8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-32 sm:w-44 transition"
              />
              {localQuery && (
                <button
                  onClick={() => setLocalQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  title="Effacer le filtre"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Commutateur de vue Grille / Liste */}
            <div className="hidden sm:flex items-center p-0.5 bg-black/40 rounded-xl border border-white/8">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vue Grille aérée"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vue Liste Détaillée"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>



        {/* LIGNE 3 : BADGES DES FILTRES ACTIFS */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-white/5 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
              Filtres actifs :
            </span>

            {selectedCatalogId !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                Catalogue : {activeCatalog?.name || selectedCatalogId}
                <button
                  onClick={() => onSelectCatalogId('all')}
                  className="hover:text-white cursor-pointer ml-0.5"
                  title="Retirer ce filtre"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedGenre !== '' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                Genre : {selectedGenre}
                <button
                  onClick={() => onGenreChange('')}
                  className="hover:text-white cursor-pointer ml-0.5"
                  title="Retirer ce filtre"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {sortBy !== 'popular' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 border border-white/10 font-semibold">
                Tri : {sortBy === 'rating' ? 'Mieux notés' : sortBy === 'year' ? 'Plus récents' : 'A-Z'}
                <button
                  onClick={() => setSortBy('popular')}
                  className="hover:text-white cursor-pointer ml-0.5"
                  title="Remettre le tri par défaut"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {localQuery.trim() !== '' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 border border-white/10 font-semibold">
                Recherche : « {localQuery} »
                <button
                  onClick={() => setLocalQuery('')}
                  className="hover:text-white cursor-pointer ml-0.5"
                  title="Effacer le filtre texte"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              onClick={handleResetFilters}
              className="text-[11px] font-semibold text-slate-400 hover:text-white underline ml-auto cursor-pointer"
            >
              Tout effacer
            </button>
          </div>
        )}
      </div>

      {/* 3. ÉTATS DE CHARGEMENT / ERREURS / CONTENU */}
      {isLoading ? (
        /* Squelettes Shimmer en grille harmonisée */
        <div className="space-y-4">
          <div className="h-5 w-48 rounded-lg skeleton-shimmer" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-2xl p-2 bg-[#0d1017] border border-white/5">
                <div className="aspect-[2/3] w-full rounded-xl skeleton-shimmer" />
                <div className="h-3.5 w-3/4 rounded skeleton-shimmer" />
                <div className="h-3 w-1/2 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        /* Erreur de chargement */
        <div className="py-20 text-center text-slate-400 space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center">
            <X className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-red-300">{error}</p>
            <p className="text-xs text-slate-400">
              Vérifiez la connexion réseau ou la configuration de vos add-ons Stremio.
            </p>
          </div>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white inline-flex items-center gap-2 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Réessayer
          </button>
        </div>
      ) : totalFilteredCount === 0 ? (
        /* Aucun résultat */
        <div className="py-20 text-center text-slate-400 space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-slate-400 mx-auto flex items-center justify-center">
            <Compass className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-slate-200">Aucun titre correspondant</p>
            <p className="text-xs text-slate-400">
              Aucun contenu ne correspond à vos filtres actuels. Essayez de réinitialiser le genre ou la recherche.
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white inline-flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : shouldMergeCatalogs ? (
        /* VUE GLOBALE DÉDUPLIQUÉE (Quand un tri, un filtre ou un catalogue spécifique est actif) */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Résultats</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                {mergedItems.length}
              </span>
            </h2>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
              {mergedItems.map((media) => (
                <MediaGridCard
                  key={media.id}
                  media={media}
                  progressPercent={progressMap.get(media.id)}
                  onClick={() => onSelectMedia(media)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {mergedItems.map((media) => (
                <MediaListCard
                  key={media.id}
                  media={media}
                  progressPercent={progressMap.get(media.id)}
                  onClick={() => onSelectMedia(media)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VUE PAR SECTIONS DE CATALOGUES (Par défaut quand tout est affiché en ordre recommandé) */
        <div className="space-y-10">
          {processedCatalogs.map((cat, catIdx) => {
            if (cat.metas.length === 0) return null;

            return (
              <section key={`${cat.addonId}-${cat.catalogId}-${catIdx}`} className="space-y-4">
                {/* En-tête de section avec bouton d'isolation */}
                <div className="flex items-center justify-between px-1 border-b border-white/6 pb-2.5">
                  <div className="flex items-baseline gap-2.5">
                    <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                      {cat.catalogName.replace(/^\[[^\]]+\]\s*/, '')}
                    </h2>
                    <span className="text-xs font-semibold text-slate-400">
                      ({cat.metas.length})
                    </span>
                    {cat.addonName && (
                      <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 hidden sm:inline">
                        {cat.addonName}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onSelectCatalogId(cat.catalogId)}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline transition cursor-pointer"
                  >
                    Voir uniquement ce catalogue →
                  </button>
                </div>

                {/* Grille ou Liste pour cette section */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                    {cat.metas.map((media) => (
                      <MediaGridCard
                        key={media.id}
                        media={media}
                        progressPercent={progressMap.get(media.id)}
                        onClick={() => onSelectMedia(media)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cat.metas.map((media) => (
                      <MediaListCard
                        key={media.id}
                        media={media}
                        progressPercent={progressMap.get(media.id)}
                        onClick={() => onSelectMedia(media)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* COMPOSANT CARTE DE GRILLE AÉRÉE */
const MediaGridCard: React.FC<{
  media: CatalogItem;
  progressPercent?: number;
  onClick: () => void;
}> = ({ media, progressPercent, onClick }) => {
  const ratingValid =
    media.imdbRating &&
    String(media.imdbRating) !== 'N/A' &&
    Number(media.imdbRating) > 0;
  const isSeries = media.type === 'series';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group relative cursor-pointer flex flex-col rounded-2xl overflow-hidden bg-[#0d1017] border border-white/8 hover:border-white/25 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-200 focus:outline-none"
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
            Pas d'affiche
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

        {/* Barre de reprise de lecture si active */}
        {typeof progressPercent === 'number' && progressPercent >= 2 && (
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/70 overflow-hidden">
            <div
              className="h-full bg-indigo-500 shadow-sm"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        )}
      </div>

      {/* Métadonnées lisibles */}
      <div className="p-3 space-y-1">
        <h4 className="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-indigo-300 line-clamp-1 transition leading-snug">
          {media.name}
        </h4>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>{media.year || 'Année inconnue'}</span>
          {media.genres && media.genres.length > 0 && (
            <span className="truncate max-w-[110px] text-[10px] text-slate-400">
              {media.genres[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* COMPOSANT CARTE DE LISTE DÉTAILLÉE */
const MediaListCard: React.FC<{
  media: CatalogItem;
  progressPercent?: number;
  onClick: () => void;
}> = ({ media, progressPercent, onClick }) => {
  const ratingValid =
    media.imdbRating &&
    String(media.imdbRating) !== 'N/A' &&
    Number(media.imdbRating) > 0;
  const isSeries = media.type === 'series';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group p-3.5 rounded-2xl bg-[#0e121a] hover:bg-[#131724] border border-white/8 hover:border-white/20 transition flex items-center justify-between gap-4 cursor-pointer shadow-sm focus:outline-none"
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

          {/* Barre de reprise miniature */}
          {typeof progressPercent === 'number' && progressPercent >= 2 && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-black/70 overflow-hidden">
              <div
                className="h-full bg-indigo-500"
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
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

            {typeof progressPercent === 'number' && progressPercent >= 2 && (
              <span className="text-[10px] text-indigo-400 font-bold px-1.5 py-0.2 rounded bg-indigo-950/40 border border-indigo-500/20">
                Reprise {Math.round(progressPercent)}%
              </span>
            )}
          </div>

          <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-indigo-300 transition truncate">
            {media.name}
          </h3>

          {media.description && (
            <p className="text-xs text-slate-400 line-clamp-1 max-w-3xl hidden md:block">
              {media.description}
            </p>
          )}
        </div>
      </div>

      {/* Bouton d'action direct */}
      <div className="shrink-0 pl-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-200 text-black text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md group-hover:scale-102"
        >
          <Play className="w-3.5 h-3.5 fill-black" />
          <span className="hidden sm:inline">Voir</span>
        </button>
      </div>
    </div>
  );
};

export default DiscoverView;
