import React, { useState, useMemo, useEffect } from 'react';
import {
  Play,
  Plus,
  Check,
  Star,
  X,
  Layers,
  HardDrive,
  Users,
  Film,
  Monitor,
  Sparkles,
  Volume2,
  Clock,
  CheckCircle2,
  Search,
  Zap,
  Download,
} from 'lucide-react';
import type { MetaDetail, StreamSource, CastMember, TrailerItem, WatchProgress } from '../api';
import { AVAILABLE_PLAYERS, getAndroidIntentUrl, type PlayerChoice } from '../players';
import { rankStreams, matchesResolution, getPlayerRecommendation, selectBestStreamForQuickPlay, parseStream, type ResolutionFilter, type ParsedStream } from '../streams';
import { addDownloadItem, triggerBrowserDownload } from '../downloads';

interface Props {
  detail: MetaDetail;
  streams: StreamSource[];
  isLoadingStreams: boolean;
  isInLib: boolean;
  selectedPlayer: PlayerChoice;
  selectedVideoId?: string;
  preferredAudioLanguage?: string;
  progressList?: WatchProgress[];
  onSelectVideo?: (videoId: string) => void;
  onSelectPlayer: (p: PlayerChoice) => void;
  onToggleLibrary: () => void;
  onPlayStream: (stream: StreamSource, player?: PlayerChoice) => void;
  onSearchQuery?: (query: string) => void;
  onToggleEpisodeWatched?: (season: number, episode: number, currentlyWatched: boolean) => void;
  onClose: () => void;
}

export const MediaModal: React.FC<Props> = ({
  detail,
  streams,
  isLoadingStreams,
  isInLib,
  selectedPlayer,
  selectedVideoId,
  preferredAudioLanguage,
  progressList = [],
  onSelectVideo,
  onSelectPlayer,
  onToggleLibrary,
  onPlayStream,
  onSearchQuery,
  onToggleEpisodeWatched,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'episodes' | 'cast' | 'trailer'>('sources');
  const [resolutionFilter, setResolutionFilter] = useState<ResolutionFilter>('all');
  const [onlyDebridCached, setOnlyDebridCached] = useState(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  const handleDownloadStream = (e: React.MouseEvent, p: ParsedStream) => {
    e.stopPropagation();
    if (!p.stream.url) return;

    const currentEp = isSeries && selectedVideoId ? detail.videos?.find((v) => v.id === selectedVideoId) : undefined;
    const dl = addDownloadItem({
      mediaId: selectedVideoId || detail.id,
      title: detail.name,
      mediaType: detail.type === 'series' ? 'series' : 'movie',
      season: currentEp?.season,
      episode: currentEp?.episode,
      poster: detail.poster,
      streamUrl: p.stream.url,
      resolutionLabel: p.resolutionLabel,
      fileSizeLabel: p.sizeLabel,
    });

    triggerBrowserDownload(dl.proxiedDownloadUrl);
    setDownloadToast(`Téléchargement lancé : ${detail.name} (${p.resolutionLabel}) 📥`);
    setTimeout(() => setDownloadToast(null), 3500);
  };

  // Empêcher le défilement de l'arrière-plan et gérer la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  const currentPlayer = AVAILABLE_PLAYERS.find((p) => p.id === selectedPlayer) || AVAILABLE_PLAYERS[0];

  // Analyse et classement des flux
  const isWebPlayer = selectedPlayer === 'web';
  const rankedParsedStreams = useMemo(() => {
    return rankStreams(streams, isWebPlayer);
  }, [streams, isWebPlayer]);

  const bestStream: ParsedStream | null = useMemo(() => {
    const quick = selectBestStreamForQuickPlay(streams, {
      preferredAudioLanguage,
      preferWebReady: isWebPlayer,
    });
    if (quick) return parseStream(quick);
    return rankedParsedStreams[0] || null;
  }, [streams, preferredAudioLanguage, isWebPlayer, rankedParsedStreams]);

  const filteredStreams = useMemo(() => {
    return rankedParsedStreams
      .filter((p) => matchesResolution(p, resolutionFilter))
      .filter((p) => !onlyDebridCached || p.cached || p.webReady);
  }, [rankedParsedStreams, resolutionFilter, onlyDebridCached]);

  const isEpisodeWatched = (season: number, episode: number): boolean => {
    if (!progressList || progressList.length === 0) return false;
    const found = progressList.find(
      (p) =>
        p.mediaId === detail.id &&
        p.season === season &&
        p.episode === episode
    );
    if (!found) return false;
    return found.completed === 1 || (found.duration > 0 && found.currentTime / found.duration >= 0.85);
  };

  // Statistiques de résolutions pour les filtres
  const resCounts = useMemo(() => {
    return {
      all: rankedParsedStreams.length,
      cached: rankedParsedStreams.filter((p) => p.cached || p.webReady).length,
      '2160': rankedParsedStreams.filter((p) => p.height >= 2160).length,
      '1080': rankedParsedStreams.filter((p) => p.height >= 1080 && p.height < 2160).length,
      '720': rankedParsedStreams.filter((p) => p.height >= 720 && p.height < 1080).length,
    };
  }, [rankedParsedStreams]);

  // Saisons et épisodes pour les séries
  const isSeries = detail.type === 'series' && Array.isArray(detail.videos) && detail.videos.length > 0;
  const seasons = useMemo(() => {
    if (!detail.videos || detail.videos.length === 0) return [];
    return Array.from(new Set(detail.videos.map((v) => v.season))).sort((a, b) => a - b);
  }, [detail.videos]);

  const [activeSeason, setActiveSeason] = useState<number>(() => {
    if (seasons.length > 0) return seasons.includes(1) ? 1 : seasons[0];
    return 1;
  });

  const seasonEpisodes = useMemo(() => {
    if (!detail.videos) return [];
    return detail.videos.filter((v) => v.season === activeSeason);
  }, [detail.videos, activeSeason]);

  const activeEpisode = useMemo(() => {
    if (!detail.videos || !selectedVideoId) return null;
    return detail.videos.find((v) => v.id === selectedVideoId) || null;
  }, [detail.videos, selectedVideoId]);

  // Distribution / Casting
  const castList: CastMember[] = useMemo(() => {
    if (detail.app_extras?.cast && detail.app_extras.cast.length > 0) {
      return detail.app_extras.cast;
    }
    if (detail.cast && detail.cast.length > 0) {
      return detail.cast.map((c) => (typeof c === 'string' ? { name: c } : c));
    }
    return [];
  }, [detail]);

  // Bande-annonce
  const trailer: TrailerItem | null = useMemo(() => {
    if (detail.trailers && detail.trailers.length > 0) return detail.trailers[0];
    if (detail.trailerStreams && detail.trailerStreams.length > 0) return detail.trailerStreams[0];
    return null;
  }, [detail]);

  const trailerYtId = trailer?.ytId || trailer?.source;

  const handleLaunch = (stream: StreamSource) => {
    if (!stream.url) {
      alert("Ce flux n'a pas d'adresse URL valide.");
      return;
    }

    if (selectedPlayer === 'intent') {
      window.location.href = getAndroidIntentUrl(stream.url);
      return;
    }
    if (selectedPlayer === 'justplayer') {
      window.location.href = getAndroidIntentUrl(stream.url, 'com.brouken.player');
      return;
    }
    if (selectedPlayer === 'novaplayer') {
      window.location.href = getAndroidIntentUrl(stream.url, 'org.courville.nova');
      return;
    }
    if (selectedPlayer === 'mxplayer') {
      window.location.href = getAndroidIntentUrl(stream.url, 'com.mxtech.videoplayer.ad');
      return;
    }

    onPlayStream(stream, selectedPlayer);
  };

  const backdrop = detail.background || detail.landscapePoster || detail.poster;
  const ratingValid = detail.imdbRating && String(detail.imdbRating) !== 'N/A' && Number(detail.imdbRating) > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={detail.name}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-[#0e1118] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[94vh]">
        {/* EN-TÊTE CINÉMA AVEC FOND & VIGNETTE */}
        <div className="relative h-64 sm:h-76 md:h-84 w-full overflow-hidden bg-black shrink-0">
          {backdrop && (
            <img
              src={backdrop}
              alt={detail.name}
              className="w-full h-full object-cover object-center filter brightness-[0.68]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1118] via-[#0e1118]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e1118]/90 via-[#0e1118]/30 to-transparent" />

          {/* Bouton de fermeture */}
          <button
            onClick={onClose}
            aria-label="Fermer la fiche"
            className="absolute top-3.5 right-3.5 md:top-4 md:right-4 p-2 rounded-full bg-black/60 hover:bg-white/15 text-white/90 hover:text-white transition border border-white/10 cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Informations principales et bouton d'action */}
          <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 flex flex-col md:flex-row items-start md:items-end gap-3.5 justify-between">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2.5 py-0.5 font-bold uppercase tracking-wider rounded-md bg-white/15 text-white text-[10px] border border-white/10">
                  {detail.type === 'series' ? 'Série TV' : 'Film'}
                </span>
                {detail.year && (
                  <span className="font-semibold text-slate-300">{detail.year}</span>
                )}
                {ratingValid && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold text-[11px]">
                    <Star className="w-3 h-3 fill-amber-300" />
                    <span>{detail.imdbRating}</span>
                  </div>
                )}
                {detail.runtime && (
                  <span className="text-slate-300 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {detail.runtime}
                  </span>
                )}
                {detail.director && detail.director.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onSearchQuery && detail.director?.[0]) {
                        onSearchQuery(detail.director[0]);
                      }
                    }}
                    className="text-slate-400 hover:text-indigo-300 hover:underline hidden sm:inline transition cursor-pointer text-left"
                    title={`Rechercher les réalisations de ${detail.director[0]}`}
                  >
                    • De {detail.director.slice(0, 2).join(', ')}
                  </button>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {detail.name}
              </h1>

              {isSeries && activeEpisode && (
                <p className="text-xs sm:text-sm font-semibold text-indigo-300">
                  Saison {activeEpisode.season} • Épisode {activeEpisode.episode} : {activeEpisode.title}
                </p>
              )}

              {detail.genres && detail.genres.length > 0 && (
                <p className="text-xs text-slate-300 font-normal">
                  {detail.genres.join(' • ')}
                </p>
              )}
            </div>

            {/* Actions rapides d'en-tête */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              {bestStream && (
                <button
                  onClick={() => handleLaunch(bestStream.stream)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black hover:bg-slate-200 font-bold text-xs md:text-sm shadow-xl transition active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400"
                  title={bestStream.webReady ? 'Lancer directement dans le lecteur web' : 'Lancer le flux'}
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Regarder maintenant</span>
                  <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    bestStream.webReady ? 'bg-emerald-500/20 text-emerald-900' : 'bg-indigo-500/20 text-indigo-900'
                  }`}>
                    {bestStream.webReady ? 'Direct' : 'VLC'} • {bestStream.resolutionLabel}
                  </span>
                </button>
              )}

              <button
                onClick={onToggleLibrary}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-medium text-xs tracking-wide transition shrink-0 cursor-pointer ${
                  isInLib
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                }`}
                title={isInLib ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
              >
                {isInLib ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Dans ma liste</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Ma liste</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* CORPS DE LA MODALE */}
        <div className="p-4 sm:p-6 md:p-8 space-y-6 overflow-y-auto no-scrollbar bg-[#0e1118]">
          {/* Synopsis */}
          {detail.description && (
            <div className="space-y-1">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Synopsis
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-4xl font-normal">
                {detail.description}
              </p>
            </div>
          )}

          {/* Onglets de navigation */}
          <div className="flex items-center gap-2 border-b border-white/8 pb-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'sources'
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Sources ({streams.length})
            </button>

            {isSeries && (
              <button
                onClick={() => setActiveTab('episodes')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'episodes'
                    ? 'bg-white/15 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Épisodes ({detail.videos?.length || 0})
              </button>
            )}

            {castList.length > 0 && (
              <button
                onClick={() => setActiveTab('cast')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'cast'
                    ? 'bg-white/15 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Distribution ({castList.length})
              </button>
            )}

            {trailerYtId && (
              <button
                onClick={() => setActiveTab('trailer')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'trailer'
                    ? 'bg-white/15 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                Bande-annonce
              </button>
            )}
          </div>

          {/* ONGLET 1 : SOURCES */}
          {activeTab === 'sources' && (
            <div className="space-y-4">
              {/* Sélecteur de lecteur externe / intégré */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Lecteur de destination
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {currentPlayer.desc}
                    </span>
                  </div>
                </div>

                <div className="w-full sm:w-60">
                  <select
                    value={selectedPlayer}
                    onChange={(e) => onSelectPlayer(e.target.value as PlayerChoice)}
                    className="w-full px-3 py-1.5 bg-[#151924] border border-white/15 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    {AVAILABLE_PLAYERS.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#151924] text-white">
                        {p.name} ({p.badge})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Barre de filtres de résolution */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <button
                  onClick={() => setResolutionFilter('all')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    resolutionFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Toutes ({resCounts.all})
                </button>
                {resCounts.cached > 0 && (
                  <button
                    onClick={() => setOnlyDebridCached(!onlyDebridCached)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      onlyDebridCached
                        ? 'bg-amber-500 text-black shadow-sm shadow-amber-500/20'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20'
                    }`}
                    title="Filtrer uniquement les flux hébergés et prêts sur Real-Debrid / Torbox"
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    <span>Debrid ({resCounts.cached})</span>
                  </button>
                )}
                {resCounts['2160'] > 0 && (
                  <button
                    onClick={() => setResolutionFilter('2160')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      resolutionFilter === '2160'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    4K Ultra HD ({resCounts['2160']})
                  </button>
                )}
                {resCounts['1080'] > 0 && (
                  <button
                    onClick={() => setResolutionFilter('1080')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      resolutionFilter === '1080'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    1080p Full HD ({resCounts['1080']})
                  </button>
                )}
                {resCounts['720'] > 0 && (
                  <button
                    onClick={() => setResolutionFilter('720')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      resolutionFilter === '720'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    720p HD ({resCounts['720']})
                  </button>
                )}
              </div>

              {/* Liste des flux analysés */}
              {isLoadingStreams ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium">Recherche et analyse des flux en direct...</p>
                </div>
              ) : filteredStreams.length === 0 ? (
                <div className="p-8 rounded-xl bg-white/[0.02] border border-white/8 text-center space-y-2">
                  <HardDrive className="w-7 h-7 mx-auto text-slate-500" />
                  <p className="text-slate-200 font-semibold text-xs">
                    Aucun flux disponible pour ce filtre.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Vérifiez vos filtres de résolution ou assurez-vous que vos add-ons de streaming sont configurés.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1 no-scrollbar">
                  {filteredStreams.map((parsed, idx) => {
                    const isTopPick = idx === 0 && resolutionFilter === 'all';
                    return (
                      <div
                        key={idx}
                        className={`group p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isTopPick
                            ? 'bg-indigo-950/20 border-indigo-500/30 hover:border-indigo-500/50'
                            : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/8 hover:border-white/15'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          {/* Badges d'information */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Recommandation Conviviale */}
                            {(() => {
                              const rec = getPlayerRecommendation(parsed);
                              return (
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${rec.badgeClass}`}>
                                  {rec.label}
                                </span>
                              );
                            })()}

                            {/* Résolution */}
                            <span
                              className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${
                                parsed.height >= 2160
                                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                  : parsed.height >= 1080
                                  ? 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                                  : 'bg-slate-700/30 text-slate-300 border border-slate-600/30'
                              }`}
                            >
                              {parsed.resolutionLabel}
                            </span>

                            {/* Fournisseur */}
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-white/10 text-white border border-white/10">
                              {parsed.provider}
                            </span>

                            {/* Debrid et cache */}
                            {parsed.debrid && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                                {parsed.cached ? '⚡' : ''} {parsed.debrid}
                              </span>
                            )}

                            {/* HDR / Dolby Vision */}
                            {parsed.hdr.map((h, hIdx) => (
                              <span
                                key={hIdx}
                                className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-400/20 text-purple-300 border border-purple-400/30"
                              >
                                {h}
                              </span>
                            ))}

                            {/* Audio */}
                            {parsed.audio.length > 0 && (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-white/5 text-slate-300 flex items-center gap-1">
                                <Volume2 className="w-3 h-3 text-slate-400" />
                                {parsed.audio.join(' ')}
                              </span>
                            )}

                            {/* Taille de fichier */}
                            {parsed.sizeLabel && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-white/5 text-slate-300">
                                {parsed.sizeLabel}
                              </span>
                            )}

                            {/* Codec */}
                            {parsed.codec && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-white/5 text-slate-400">
                                {parsed.codec}
                              </span>
                            )}

                            {/* Drapeaux de langue */}
                            {parsed.languages.length > 0 && (
                              <span className="text-xs">
                                {parsed.languages.join(' ')}
                              </span>
                            )}
                          </div>

                          {/* Nom de fichier ou titre lisible */}
                          <p className="text-xs font-normal text-slate-300 group-hover:text-white transition truncate">
                            {parsed.fileName || parsed.stream.title || parsed.stream.name || 'Flux vidéo'}
                          </p>
                        </div>

                        {/* Boutons d'action */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {parsed.stream.url && (
                            <button
                              onClick={(e) => handleDownloadStream(e, parsed)}
                              className="p-2 rounded-xl bg-white/5 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-300 border border-white/10 transition cursor-pointer"
                              title="Télécharger la vidéo hors-ligne"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleLaunch(parsed.stream)}
                            className="px-4 py-2 rounded-xl font-bold text-xs bg-white text-black hover:bg-slate-200 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer shadow-md active:scale-95"
                          >
                            <Play className="w-3.5 h-3.5 fill-black" />
                            <span>Lire</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 2 : ÉPISODES (SÉRIES) */}
          {activeTab === 'episodes' && isSeries && (
            <div className="space-y-4">
              {/* Sélecteur de saison */}
              {seasons.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {seasons.map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveSeason(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                        activeSeason === s
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {s === 0 ? 'Spéciaux' : `Saison ${s}`}
                    </button>
                  ))}
                </div>
              )}

              {/* Grille d'épisodes avec miniatures */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-84 overflow-y-auto pr-1 no-scrollbar">
                {seasonEpisodes.map((ep) => {
                  const isSelected = selectedVideoId === ep.id;
                  const watched = isEpisodeWatched(ep.season, ep.episode);
                  return (
                    <div
                      key={ep.id}
                      onClick={() => {
                        if (onSelectVideo) onSelectVideo(ep.id);
                        setActiveTab('sources');
                      }}
                      className={`p-3 rounded-xl border transition flex flex-col justify-between cursor-pointer group ${
                        isSelected
                          ? 'bg-indigo-950/30 border-indigo-500/50 text-white'
                          : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/8 text-slate-300'
                      }`}
                    >
                      <div className="space-y-2">
                        {ep.thumbnail && (
                          <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/40 relative">
                            <img
                              src={ep.thumbnail}
                              alt={ep.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-102 transition"
                            />
                            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-bold text-white">
                              Ép. {ep.episode}
                            </div>
                            {watched && (
                              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-emerald-600/90 backdrop-blur-sm text-[10px] font-bold text-white flex items-center gap-1 shadow">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Vu</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Épisode {ep.episode}
                            </span>
                            {!ep.thumbnail && watched && (
                              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Vu
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-semibold text-white line-clamp-1 group-hover:text-indigo-300 transition">
                            {ep.title}
                          </h4>
                          {ep.overview && (
                            <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 font-normal">
                              {ep.overview}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-white/5 mt-2 gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleEpisodeWatched) {
                              onToggleEpisodeWatched(ep.season, ep.episode, watched);
                            }
                          }}
                          className={`text-[10px] px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer font-medium ${
                            watched
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                          }`}
                          title={watched ? 'Marquer comme non vu' : 'Marquer comme vu'}
                        >
                          <CheckCircle2 className={`w-3 h-3 ${watched ? 'text-emerald-400' : 'text-slate-400'}`} />
                          <span>{watched ? 'Vu' : 'Marquer vu'}</span>
                        </button>
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-300 group-hover:bg-white/20'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ONGLET 3 : CASTING */}
          {activeTab === 'cast' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-80 overflow-y-auto pr-1 no-scrollbar">
              {castList.map((actor, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (onSearchQuery) {
                      onSearchQuery(actor.name);
                    }
                  }}
                  className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/8 hover:border-indigo-500/40 flex items-center gap-2.5 text-left transition group cursor-pointer"
                  title={`Rechercher les œuvres avec ${actor.name}`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-black/40 shrink-0 border border-white/10 group-hover:border-indigo-400/50 transition">
                    {actor.photo ? (
                      <img
                        src={actor.photo}
                        alt={actor.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 group-hover:text-white text-xs font-bold">
                        {actor.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 overflow-hidden flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h4 className="text-xs font-semibold text-white group-hover:text-indigo-300 truncate transition">
                        {actor.name}
                      </h4>
                      <Search className="w-2.5 h-2.5 text-slate-500 group-hover:text-indigo-400 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                    {actor.character && (
                      <p className="text-[10px] text-slate-400 truncate">{actor.character}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ONGLET 4 : BANDE-ANNONCE YOUTUBE */}
          {activeTab === 'trailer' && trailerYtId && (
            <div className="space-y-2">
              <div className="relative aspect-video w-full max-w-2xl mx-auto rounded-xl overflow-hidden bg-black border border-white/10 shadow-lg">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${trailerYtId}?autoplay=0&rel=0`}
                  title={trailer.name || detail.name}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="text-center text-[11px] text-slate-400">
                {trailer.name || `Bande-annonce officielle de ${detail.name}`}
              </p>
            </div>
          )}
        </div>

        {/* Toast de confirmation de téléchargement */}
        {downloadToast && (
          <div className="absolute bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-indigo-600/95 text-white text-xs font-bold shadow-2xl backdrop-blur-md border border-indigo-400/40 animate-fade-in flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{downloadToast}</span>
          </div>
        )}
      </div>
    </div>
  );
};
export default MediaModal;
