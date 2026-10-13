import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Puzzle,
  CheckCircle2,
  X,
  Sparkles,
  ShieldCheck,
  Globe,
  Search,
  Copy,
  Check,
  Zap,
  BookOpen,
  MessageSquare,
  Tv,
  Film,
} from 'lucide-react';
import type { AddonInfo } from '../api';

interface Props {
  addons: AddonInfo[];
  onAddAddon: (url: string) => Promise<void>;
  onRemoveAddon: (id: string) => Promise<void>;
  onClose: () => void;
}

type CommunityCategory = 'all' | 'debrid' | 'catalogs' | 'subtitles' | 'anime' | 'media';

interface CommunityAddon {
  id: string;
  name: string;
  category: 'debrid' | 'catalogs' | 'subtitles' | 'anime' | 'media';
  desc: string;
  url: string;
  badge: string;
  features: string[];
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
  const [communityCategory, setCommunityCategory] = useState<CommunityCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Gérer Échap pour fermer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Add-ons populaires Stremio vérifiés et recommandés
  const communityRecommendations: CommunityAddon[] = [
    {
      id: 'torrentio',
      name: 'Torrentio',
      category: 'debrid',
      desc: 'Agrégateur universel de flux Torrents P2P et Debrid haute fidélité (Real-Debrid, AllDebrid, Torbox, Premiumize).',
      url: 'https://torrentio.strem.fun/manifest.json',
      badge: '⚡ Flux & Debrid',
      features: ['Torrents P2P', 'Multi-Debrid', '4K / HDR / DV'],
    },
    {
      id: 'cyberflix',
      name: 'CyberFlix Catalog',
      category: 'catalogs',
      desc: 'Catalogues organisés et synchronisés des plateformes mondiales : Netflix, Prime Video, Disney+, Apple TV+, HBO Max.',
      url: 'https://cyberflix.kamyroll.net/manifest.json',
      badge: '📚 Catalogues SVOD',
      features: ['Netflix', 'Disney+', 'Apple TV+', 'Prime Video'],
    },
    {
      id: 'opensubtitles',
      name: 'OpenSubtitles v3',
      category: 'subtitles',
      desc: 'Sous-titres officiels automatiques multi-langues synchronisés à la milliseconde pour films et séries.',
      url: 'https://opensubtitles-v3.strem.io/manifest.json',
      badge: '💬 Sous-titres Officiels',
      features: ['Français', 'Multi-langues', 'Auto-Sync'],
    },
    {
      id: 'subdl',
      name: 'SubDL Subtitles',
      category: 'subtitles',
      desc: 'Sous-titres synchronisés de référence pour releases Director’s Cut, VOSTFR et séries récentes.',
      url: 'https://subdl.strem.fun/manifest.json',
      badge: '💬 Sous-titres Alternatifs',
      features: ['VOSTFR', 'Releases HD', 'Traductions Rapides'],
    },
    {
      id: 'animekisa',
      name: 'Anime Kisa / Kitsune',
      category: 'anime',
      desc: 'Spécialisé dans l’animation japonaise et les films d’animation avec épisodes, saisons complètes, VOSTFR et VF.',
      url: 'https://anime-kisa.strem.fun/manifest.json',
      badge: '🎌 Animation Japonaise',
      features: ['VOSTFR', 'VF', 'Saisons Complètes'],
    },
    {
      id: 'kitsu',
      name: 'Kitsu Anime Catalog',
      category: 'anime',
      desc: 'Base de données mondiale d’animés et mangas avec fiches descriptives, classements et diffusions saisonnières.',
      url: 'https://anime-kitsu.strem.fun/manifest.json',
      badge: '🎌 Base Kitsu',
      features: ['Simulcasts', 'Classements Tendances', 'Détails Épisodes'],
    },
    {
      id: 'themoviedb',
      name: 'The Movie Database (TMDB)',
      category: 'catalogs',
      desc: 'Métadonnées complètes, affiches haute définition, notes critiques et catalogues alternatifs TMDB.',
      url: 'https://94c8cb9f702d-tmdb-addon.baby-beamup.club/manifest.json',
      badge: '📚 Métadonnées TMDB',
      features: ['Posters HD', 'Casting Complet', 'Notes TMDB'],
    },
    {
      id: 'watchhub',
      name: 'WatchHub',
      category: 'catalogs',
      desc: 'Liens de diffusion légale et disponibilités officielles sur les plateformes SVOD et VOD (Canal+, Netflix, Apple).',
      url: 'https://watchhub.strem.io/manifest.json',
      badge: '📺 VOD Légale',
      features: ['Disponibilités Officielles', 'Magasins VOD', 'Plateformes FR'],
    },
    {
      id: 'twitch',
      name: 'Twitch TV',
      category: 'media',
      desc: 'Lives gaming, streams esport en continu et replays des créateurs Twitch intégrés dans le lecteur.',
      url: 'https://stremio-twitch.peario.workers.dev/manifest.json',
      badge: '📺 Live & Replay',
      features: ['Lives Twitch', 'Jeux Vidéo', 'Esport'],
    },
    {
      id: 'youtube',
      name: 'YouTube Channels',
      category: 'media',
      desc: 'Accès direct aux chaînes, créateurs de contenu, documentaires indépendants et bandes-annonces.',
      url: 'https://stremio-youtube.herokuapp.com/manifest.json',
      badge: '📺 Chaînes Vidéo',
      features: ['Vidéastes', 'Documentaires', 'Bandes-annonces'],
    },
    {
      id: 'podcasts',
      name: 'Stremio Podcasts',
      category: 'media',
      desc: 'Émissions audio, radios, talk-shows et podcasts mondiaux écoutables directement dans Stremo.',
      url: 'https://podcasts.strem.io/manifest.json',
      badge: '📻 Podcasts & Audio',
      features: ['Podcasts FR & EN', 'Émissions', 'Audio pur'],
    },
    {
      id: 'publicdomain',
      name: 'Public Domain Movies',
      category: 'catalogs',
      desc: 'Chefs-d’œuvre du cinéma classique libres de droits et du domaine public en version remastérisée.',
      url: 'https://stremio-public-domain-movies.surge.sh/manifest.json',
      badge: '🏛️ Cinéma Libre',
      features: ['Films Cultes', 'Domaine Public', 'Patrimoine'],
    },
    {
      id: 'animecatalogs',
      name: 'Anime Catalogs',
      category: 'anime',
      desc: 'Filtres par thématiques Shônen, Seinen, Isekai, Romance et top classements des meilleures séries animées.',
      url: 'https://127.0.0.1:11470/anime-catalogs/manifest.json',
      badge: '🎌 Genres Manga',
      features: ['Shônen', 'Seinen', 'Isekai'],
    },
  ];

  const filteredCommunity = useMemo(() => {
    return communityRecommendations.filter((item) => {
      const matchCategory =
        communityCategory === 'all' || item.category === communityCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.features.some((f) => f.toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });
  }, [communityCategory, searchQuery]);

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

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
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
      <div className="bg-[#0c1017] border border-white/10 rounded-2xl md:rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* En-tête */}
        <div className="px-6 sm:px-8 py-4 sm:py-5 border-b border-white/8 flex items-center justify-between shrink-0 bg-[#080a0f]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight">
                Catalogue & Gestionnaire d'Add-ons
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Catalogues, flux de streaming, sous-titres et protocoles Stremio officiels & communautaires.
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
        <div className="px-6 sm:px-8 py-3.5 border-b border-white/8 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 bg-[#0e121a]">
          {/* Onglets principaux */}
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
              Store Communautaire ({communityRecommendations.length})
            </button>
          </div>

          {/* Formulaire d'URL manuel */}
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
              <span>{loading ? 'Ajout...' : 'Installer'}</span>
            </button>
          </form>
        </div>

        {error && (
          <div className="mx-6 sm:mx-8 mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Zone de contenu défilable */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4 no-scrollbar bg-[#0c1017]">
          {filterType === 'installed' && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Add-ons actifs sur votre instance Stremo ({addons.length})
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
              {/* Barre de recherche et filtres de catégories */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#111622] p-3 rounded-2xl border border-white/8">
                {/* Champ de recherche */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer par nom, mot-clé, debrid, vo, animé..."
                    className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtres par catégorie */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    onClick={() => setCommunityCategory('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                      communityCategory === 'all'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setCommunityCategory('debrid')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      communityCategory === 'debrid'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    Flux & Debrid
                  </button>
                  <button
                    onClick={() => setCommunityCategory('catalogs')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      communityCategory === 'catalogs'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-3 h-3 text-blue-400" />
                    Catalogues
                  </button>
                  <button
                    onClick={() => setCommunityCategory('subtitles')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      communityCategory === 'subtitles'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3 text-emerald-400" />
                    Sous-titres
                  </button>
                  <button
                    onClick={() => setCommunityCategory('anime')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      communityCategory === 'anime'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Film className="w-3 h-3 text-pink-400" />
                    Animés
                  </button>
                  <button
                    onClick={() => setCommunityCategory('media')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      communityCategory === 'media'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Tv className="w-3 h-3 text-purple-400" />
                    Médias & Live
                  </button>
                </div>
              </div>

              {/* Grille des add-ons communautaires */}
              {filteredCommunity.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <p className="font-semibold text-sm">Aucun add-on ne correspond à votre recherche.</p>
                  <p className="text-xs text-slate-500">Essayez un autre mot-clé ou réinitialisez la catégorie.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCommunity.map((rec) => {
                    const isInstalled = addons.some(
                      (a) =>
                        a.id.toLowerCase().includes(rec.id) ||
                        a.name.toLowerCase().includes(rec.name.toLowerCase())
                    );

                    return (
                      <div
                        key={rec.id}
                        className="p-5 rounded-2xl bg-[#111622] border border-white/8 hover:border-white/15 transition flex flex-col justify-between gap-4 shadow-sm"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-sm sm:text-base text-white">
                              {rec.name}
                            </h4>
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                              {rec.badge}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed font-normal">
                            {rec.desc}
                          </p>

                          {/* Tags de fonctionnalités */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {rec.features.map((feat) => (
                              <span
                                key={feat}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/5 text-slate-400 border border-white/5"
                              >
                                {feat}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-white/8 flex items-center justify-between gap-2">
                          {/* Bouton copier le lien du manifest */}
                          <button
                            onClick={() => handleCopy(rec.url)}
                            className="text-[11px] text-slate-400 hover:text-slate-200 transition flex items-center gap-1 cursor-pointer truncate max-w-[200px]"
                            title="Copier l'URL du manifest"
                          >
                            {copiedUrl === rec.url ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="text-emerald-400 font-semibold">Copié !</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="truncate">{new URL(rec.url).host}</span>
                              </>
                            )}
                          </button>

                          {isInstalled ? (
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Déjà installé
                            </span>
                          ) : (
                            <button
                              onClick={() => handleInstallOneClick(rec.url)}
                              disabled={loading}
                              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition shadow cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                              <Plus className="w-3.5 h-3.5" /> Installer en 1 clic
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddonManager;
