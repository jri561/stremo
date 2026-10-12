import { useState, useEffect, useMemo } from 'react';
import {
  Home,
  Compass,
  Bookmark,
  Puzzle,
  Search,
  Play,
  X,
  KeyRound,
  RefreshCw,
  Lock,
  Download,
  Database,
} from 'lucide-react';
import { api, accessKey, isKidsSafeItem } from './api';
import type {
  Profile,
  CatalogSection,
  CatalogItem,
  WatchProgress,
  LibraryItem,
  MetaDetail,
  StreamSource,
  AddonInfo,
} from './api';
import { ProfileSelector } from './components/ProfileSelector';
import { ProfileMenu } from './components/ProfileMenu';
import { CatalogRow } from './components/CatalogRow';
import { HeroBanner } from './components/HeroBanner';
import { MediaModal } from './components/MediaModal';
import { AddonManager } from './components/AddonManager';
import { VideoPlayer } from './components/VideoPlayer';
import { SkeletonRow } from './components/SkeletonRow';
import { SearchView } from './components/SearchView';
import { DiscoverView } from './components/DiscoverView';
import { BackupModal } from './components/BackupModal';
import { TraktModal } from './components/TraktModal';
import type { PlayerChoice } from './players';
import { rankStreams } from './streams';

export function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);

  // Navigation principale : 'home' | 'discover' | 'search' | 'library'
  const [activeNav, setActiveNav] = useState<'home' | 'discover' | 'search' | 'library'>('home');

  // Filtres Explorer
  const [mediaType, setMediaType] = useState<'movie' | 'series'>('movie');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('');

  // Recherche intelligente et rapide
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ movies: CatalogItem[]; series: CatalogItem[] }>({
    movies: [],
    series: [],
  });
  const [isSearching, setIsSearching] = useState(false);

  // Données
  const [catalogs, setCatalogs] = useState<CatalogSection[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);
  const [catalogsError, setCatalogsError] = useState<string | null>(null);
  const [progressList, setProgressList] = useState<WatchProgress[]>([]);
  const [libraryList, setLibraryList] = useState<LibraryItem[]>([]);
  const [addonsList, setAddonsList] = useState<AddonInfo[]>([]);

  // Modales et Lecteur
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [metaDetail, setMetaDetail] = useState<MetaDetail | null>(null);
  const [streams, setStreams] = useState<StreamSource[]>([]);
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showTraktModal, setShowTraktModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authKeyInput, setAuthKeyInput] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState<string | undefined>(undefined);
  const [activePlayerStream, setActivePlayerStream] = useState<StreamSource | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerChoice>(
    (localStorage.getItem('stremo_default_player') as PlayerChoice) || 'web'
  );
  // Contrôle parental PIN
  const [pinPromptTarget, setPinPromptTarget] = useState<Profile | null>(null);
  const [pinCodeInput, setPinCodeInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    loadProfiles();
    loadAddons();

    const handleAuthReq = () => setShowAuthModal(true);
    window.addEventListener('stremo-auth-required', handleAuthReq);

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('stremo-auth-required', handleAuthReq);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice?.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Raccourci clavier global pour recherche rapide (/ ou Ctrl+K)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setActiveNav('search');
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  useEffect(() => {
    if (activeProfile) {
      loadProfileData(activeProfile.id);
    }
  }, [activeProfile]);

  useEffect(() => {
    if (activeProfile && activeNav !== 'search' && !searchQuery) {
      loadCatalogs();
    }
  }, [mediaType, selectedGenre, activeProfile, activeNav, searchQuery]);

  // Recherche rapide instantanée avec debounce optimisé (180ms) sur films ET séries
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ movies: [], series: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [movieCats, seriesCats] = await Promise.all([
          api.getCatalogs('movie', undefined, searchQuery.trim()),
          api.getCatalogs('series', undefined, searchQuery.trim()),
        ]);

        const mDedupe = new Map<string, CatalogItem>();
        movieCats.flatMap((c) => c.metas).forEach((m) => mDedupe.set(m.id, m));

        const sDedupe = new Map<string, CatalogItem>();
        seriesCats.flatMap((c) => c.metas).forEach((m) => sDedupe.set(m.id, m));

        let movies = Array.from(mDedupe.values());
        let series = Array.from(sDedupe.values());
        if (activeProfile?.isKids === 1) {
          movies = movies.filter(isKidsSafeItem);
          series = series.filter(isKidsSafeItem);
        }

        setSearchResults({
          movies,
          series,
        });
      } catch (err) {
        console.error('Erreur recherche:', err);
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchQuery, activeProfile]);

  const loadProfiles = async () => {
    try {
      const list = await api.getProfiles();
      setProfiles(list);
      if (!activeProfile && list.length > 0) {
        const saved = localStorage.getItem('stremo_active_profile');
        const found = list.find((p) => p.id === saved) || list[0];
        setActiveProfile(found);
      }
    } catch (e) {
      console.error('Erreur chargement profils:', e);
    }
  };

  const loadAddons = async () => {
    try {
      const list = await api.getAddons();
      setAddonsList(list);
    } catch (e) {
      console.error('Erreur chargement addons:', e);
    }
  };

  const loadProfileData = async (profileId: string) => {
    try {
      const [prog, lib] = await Promise.all([
        api.getProgress(profileId),
        api.getLibrary(profileId),
      ]);
      setProgressList(prog);
      setLibraryList(lib);
    } catch (e) {
      console.error('Erreur données profil:', e);
    }
  };

  const loadCatalogs = async () => {
    setIsLoadingCatalogs(true);
    setCatalogsError(null);
    try {
      const raw = await api.getCatalogs(mediaType, selectedGenre || undefined);

      // Tri intelligent : populaires et plateformes d'abord, catalogues communautaires Dramayo à la fin
      const sorted = [...raw].sort((a, b) => {
        const aIsDramayo = a.catalogName.toLowerCase().includes('dramayo') ? 1 : 0;
        const bIsDramayo = b.catalogName.toLowerCase().includes('dramayo') ? 1 : 0;
        if (aIsDramayo !== bIsDramayo) return aIsDramayo - bIsDramayo;

        const aPopular = /popular|trending|top rated/i.test(a.catalogName) ? -1 : 0;
        const bPopular = /popular|trending|top rated/i.test(b.catalogName) ? -1 : 0;
        return aPopular - bPopular;
      });

      let finalCatalogs = sorted;
      if (activeProfile?.isKids === 1) {
        finalCatalogs = sorted
          .map((cat) => ({
            ...cat,
            metas: cat.metas.filter(isKidsSafeItem),
          }))
          .filter((cat) => cat.metas.length > 0);
      }

      setCatalogs(finalCatalogs);
    } catch (e: any) {
      console.error(e);
      setCatalogsError(e.message || 'Impossible de joindre les catalogues.');
    } finally {
      setIsLoadingCatalogs(false);
    }
  };

  const handleSelectProfile = (p: Profile) => {
    setActiveProfile(p);
    localStorage.setItem('stremo_active_profile', p.id);
  };

  const handleProfileSwitch = (target: Profile) => {
    // Protection parentale : quitter un profil Enfant pour un profil Adulte exige un code PIN
    if (activeProfile?.isKids === 1 && target.isKids === 0) {
      setPinPromptTarget(target);
      setPinCodeInput('');
      setPinError(null);
      return;
    }
    handleSelectProfile(target);
  };

  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinPromptTarget) return;
    const expectedPin = pinPromptTarget.pin || '0000';
    if (pinCodeInput === expectedPin) {
      handleSelectProfile(pinPromptTarget);
      setPinPromptTarget(null);
      setPinCodeInput('');
      setPinError(null);
    } else {
      setPinError('Code PIN incorrect (PIN par défaut : 0000)');
    }
  };

  const handleCreateProfile = async (name: string, avatar: string, isKids: boolean, pin?: string) => {
    const created = await api.createProfile(name, avatar, isKids, pin);
    setProfiles((prev) => [...prev, created]);
    handleSelectProfile(created);
  };

  const handleUpdateProfile = async (
    id: string,
    updates: { name: string; avatar: string; isKids: boolean; pin?: string | null }
  ) => {
    const updated = await api.updateProfile(id, updates);
    setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
    if (activeProfile?.id === id) {
      setActiveProfile(updated);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    await api.deleteProfile(id);
    const remaining = profiles.filter((p) => p.id !== id);
    setProfiles(remaining);
    if (activeProfile?.id === id) {
      setActiveProfile(remaining[0] || null);
    }
  };

  const handleSelectPlayer = (p: PlayerChoice) => {
    setSelectedPlayer(p);
    localStorage.setItem('stremo_default_player', p);
  };

  const handleOpenMedia = async (item: CatalogItem, specificVideoId?: string) => {
    let targetId = item.id;
    let targetVideoId = specificVideoId;
    if (item.type === 'series' && item.id.includes(':')) {
      const parts = item.id.split(':');
      if (parts.length >= 3) {
        targetId = parts[0];
        targetVideoId = item.id;
      }
    }

    const cleanItem = { ...item, id: targetId };
    setSelectedItem(cleanItem);
    setMetaDetail(null);
    setStreams([]);
    setSubtitles([]);
    setIsLoadingStreams(true);
    setSelectedVideoId(targetVideoId);

    try {
      const meta = await api.getMeta(cleanItem.type, targetId);
      setMetaDetail(meta || cleanItem);

      let streamId = targetId;
      if (cleanItem.type === 'series') {
        const vid = targetVideoId || meta?.videos?.find((v) => v.id === targetVideoId)?.id || meta?.videos?.[0]?.id;
        if (vid) {
          streamId = vid;
          setSelectedVideoId(vid);
        }
      }

      const [st, subs] = await Promise.all([
        api.getStreams(cleanItem.type, streamId),
        api.getSubtitles(cleanItem.type, streamId),
      ]);
      setStreams(st);
      setSubtitles(subs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingStreams(false);
    }
  };

  const handleSelectEpisode = async (videoId: string) => {
    if (!selectedItem) return;
    setSelectedVideoId(videoId);
    setIsLoadingStreams(true);
    setStreams([]);
    setSubtitles([]);
    try {
      const [st, subs] = await Promise.all([
        api.getStreams(selectedItem.type, videoId),
        api.getSubtitles(selectedItem.type, videoId),
      ]);
      setStreams(st);
      setSubtitles(subs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingStreams(false);
    }
  };

  const handlePlayStream = async (stream: StreamSource, player: PlayerChoice = selectedPlayer) => {
    if (!stream.url) {
      alert("Lien de flux non disponible pour ce média.");
      return;
    }

    if (player === 'vlc' || player === 'mpv' || player === 'system') {
      try {
        await api.playExternal(stream.url, selectedItem?.name, undefined, player);
      } catch (err: any) {
        alert(err.message || 'Erreur lors du lancement du lecteur externe');
      }
      return;
    }

    setActivePlayerStream(stream);
  };

  // Calcul intelligent de l'épisode suivant pour le mode binge-watching
  const nextEpisode = useMemo(() => {
    if (selectedItem?.type !== 'series' || !selectedVideoId || !metaDetail?.videos) {
      return null;
    }
    const current = metaDetail.videos.find((v) => v.id === selectedVideoId);
    if (!current) return null;

    // 1. Chercher le prochain épisode de la même saison
    const nextInSeason = metaDetail.videos.find(
      (v) => v.season === current.season && v.episode === current.episode + 1
    );
    if (nextInSeason) return nextInSeason;

    // 2. Sinon, premier épisode de la saison suivante
    const nextSeasonFirst = metaDetail.videos.find(
      (v) => v.season === current.season + 1 && v.episode === 1
    );
    return nextSeasonFirst || null;
  }, [selectedItem, selectedVideoId, metaDetail]);

  const handlePlayNextEpisode = async () => {
    if (!nextEpisode || !selectedItem) return;
    try {
      setSelectedVideoId(nextEpisode.id);
      setIsLoadingStreams(true);
      const [st, subs] = await Promise.all([
        api.getStreams(selectedItem.type, nextEpisode.id),
        api.getSubtitles(selectedItem.type, nextEpisode.id),
      ]);
      setStreams(st);
      setSubtitles(subs);
      const ranked = rankStreams(st, selectedPlayer === 'web');
      const best = ranked[0]?.stream;
      if (best && best.url) {
        setActivePlayerStream(best);
      } else {
        alert("Aucun flux web direct disponible pour cet épisode.");
      }
    } catch (err) {
      console.error('Erreur lecture épisode suivant:', err);
    } finally {
      setIsLoadingStreams(false);
    }
  };

  const handleToggleLibrary = async (targetItem: CatalogItem = selectedItem!) => {
    if (!activeProfile || !targetItem) return;
    const isCurrentlyIn = libraryList.some((l) => l.mediaId === targetItem.id);

    if (isCurrentlyIn) {
      await api.removeFromLibrary(activeProfile.id, targetItem.id);
      setLibraryList((prev) => prev.filter((l) => l.mediaId !== targetItem.id));
    } else {
      await api.addToLibrary({
        profileId: activeProfile.id,
        mediaId: targetItem.id,
        mediaType: targetItem.type,
        title: targetItem.name,
        poster: targetItem.poster,
        year: targetItem.year ? String(targetItem.year) : undefined,
        genres: targetItem.genres,
      });
      loadProfileData(activeProfile.id);
    }
  };

  const handleToggleEpisodeWatched = async (season: number, episode: number, currentlyWatched: boolean) => {
    if (!activeProfile || !selectedItem) return;
    const epKey = `${selectedItem.id}:${season}:${episode}`;
    try {
      if (currentlyWatched) {
        await api.deleteProgress(activeProfile.id, epKey);
      } else {
        await api.saveProgress({
          profileId: activeProfile.id,
          mediaId: epKey,
          mediaType: selectedItem.type,
          title: `${selectedItem.name} S${season}E${episode}`,
          poster: selectedItem.poster,
          season,
          episode,
          currentTime: 1800,
          duration: 1800,
          completed: 1,
        });
      }
      await loadProfileData(activeProfile.id);
    } catch (err) {
      console.error('Erreur bascule statut épisode:', err);
    }
  };

  // Sélection des 5 meilleurs titres pour le carrousel d'accueil
  const heroFeaturedItems = useMemo(() => {
    if (!catalogs || catalogs.length === 0) return [];
    const all = catalogs.flatMap((c) => c.metas);
    const seen = new Set<string>();
    const list: CatalogItem[] = [];

    for (const m of all) {
      if ((m.background || m.landscapePoster) && !seen.has(m.id)) {
        seen.add(m.id);
        list.push(m);
        if (list.length >= 5) break;
      }
    }
    return list.length > 0 ? list : all.slice(0, 3);
  }, [catalogs]);



  if (!activeProfile) {
    return (
      <main className="min-h-screen bg-[#07090e] flex items-center justify-center p-4">
        <ProfileSelector
          profiles={profiles}
          activeProfile={activeProfile}
          onSelectProfile={handleProfileSwitch}
          onCreateProfile={handleCreateProfile}
          onUpdateProfile={handleUpdateProfile}
          onDeleteProfile={handleDeleteProfile}
        />
      </main>
    );
  }

  const isSearchActive = activeNav === 'search' || searchQuery.trim().length > 0;

  return (
    <div className="flex h-screen bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* 1. SIDEBAR DESKTOP PROFESSIONNELLE */}
      <aside className="hidden md:flex w-16 lg:w-18 bg-[#05060a] border-r border-white/8 flex-col items-center py-5 justify-between shrink-0 z-40">
        <div className="flex flex-col items-center gap-7 w-full">
          {/* Logo Marque */}
          <button
            onClick={() => {
              setActiveNav('home');
              setSearchQuery('');
            }}
            className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 transition cursor-pointer"
            title="Stremo Accueil"
          >
            <Play className="w-5 h-5 fill-black text-black ml-0.5" />
          </button>

          {/* Navigation principale avec Recherche dédiée */}
          <nav className="flex flex-col items-center gap-2.5 w-full px-2">
            <button
              onClick={() => {
                setActiveNav('home');
                setSearchQuery('');
              }}
              className={`p-2.5 rounded-xl transition w-full flex items-center justify-center cursor-pointer ${
                activeNav === 'home' && !searchQuery
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Accueil"
            >
              <Home className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setActiveNav('discover');
                setSearchQuery('');
              }}
              className={`p-2.5 rounded-xl transition w-full flex items-center justify-center cursor-pointer ${
                activeNav === 'discover' && !searchQuery
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Explorer"
            >
              <Compass className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveNav('search')}
              className={`p-2.5 rounded-xl transition w-full flex items-center justify-center cursor-pointer ${
                isSearchActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Rechercher (raccourci : /)"
            >
              <Search className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setActiveNav('library');
                setSearchQuery('');
              }}
              className={`p-2.5 rounded-xl transition w-full flex items-center justify-center relative cursor-pointer ${
                activeNav === 'library' && !searchQuery
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Ma Liste"
            >
              <Bookmark className="w-5 h-5" />
              {libraryList.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-400 ring-2 ring-[#05060a]" />
              )}
            </button>
          </nav>
        </div>

        {/* Boutons bas de barre latérale */}
        <div className="flex flex-col items-center gap-2 w-full px-2">
          {installPrompt && (
            <button
              onClick={handleInstallApp}
              className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition cursor-pointer"
              title="Installer l'application Stremo"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setShowBackupModal(true)}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            title="Sauvegarde & Multi-écrans"
          >
            <Database className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowAddonsModal(true)}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            title="Add-ons Stremio"
          >
            <Puzzle className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* 2. ZONE PRINCIPALE DE L'APPLICATION */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* En-tête supérieur épuré */}
        <header className="h-16 border-b border-white/8 px-4 sm:px-6 md:px-10 flex items-center justify-between gap-3 sm:gap-6 shrink-0 bg-[#05060a]/90 backdrop-blur-md z-30">
          {/* Logo mobile */}
          <div
            onClick={() => {
              setActiveNav('home');
              setSearchQuery('');
            }}
            className="md:hidden flex items-center gap-2 cursor-pointer shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center shadow">
              <Play className="w-4 h-4 fill-black text-black ml-0.5" />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-white hidden xs:inline">
              Stremo
            </span>
          </div>

          {/* Fil d'Ariane Desktop */}
          <div className="hidden lg:flex items-center gap-2 w-36">
            <span className="text-xs font-semibold text-slate-400">
              {isSearchActive
                ? 'Recherche'
                : activeNav === 'home'
                ? 'Accueil'
                : activeNav === 'discover'
                ? 'Explorer'
                : 'Ma Liste'}
            </span>
          </div>

          {/* Barre de recherche centrale */}
          <div className="flex-1 max-w-xl mx-auto">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition" />
              <input
                type="text"
                placeholder="Rechercher des films, séries, sagas... (raccourci : /)"
                value={searchQuery}
                onFocus={() => {
                  if (activeNav !== 'search') setActiveNav('search');
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeNav !== 'search') setActiveNav('search');
                }}
                className="w-full pl-10 pr-9 py-2 bg-white/5 hover:bg-white/8 focus:bg-white/10 border border-white/10 focus:border-indigo-400/50 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none transition shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition p-1 cursor-pointer"
                  title="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Menu Profil & PWA */}
          <div className="flex items-center gap-2 shrink-0">
            {installPrompt && (
              <button
                onClick={handleInstallApp}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition cursor-pointer"
                title="Installer Stremo sur cet appareil"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Installer l'app</span>
              </button>
            )}
            <ProfileMenu
              profiles={profiles}
              activeProfile={activeProfile}
              onSelectProfile={handleProfileSwitch}
              onCreateProfile={handleCreateProfile}
              onUpdateProfile={handleUpdateProfile}
              onOpenSelector={() => setActiveProfile(null)}
              onOpenTrakt={() => setShowTraktModal(true)}
              onOpenBackup={() => setShowBackupModal(true)}
            />
          </div>
        </header>

        {/* Contenu Défilable */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 py-5 pb-24 md:pb-8 space-y-8 no-scrollbar">
          {/* VUE DE RECHERCHE DÉDIÉE HAUTE LISIBILITÉ */}
          {isSearchActive ? (
            <SearchView
              query={searchQuery}
              onQueryChange={setSearchQuery}
              results={searchResults}
              isSearching={isSearching}
              onSelectMedia={handleOpenMedia}
              isKids={activeProfile.isKids === 1}
            />
          ) : (
            <>
              {/* ONGLET 1 : ACCUEIL */}
              {activeNav === 'home' && (
                <div className="space-y-8 animate-fade-in">
                  {/* Carrousel Billboard Hero */}
                  {heroFeaturedItems.length > 0 && (
                    <HeroBanner
                      items={heroFeaturedItems}
                      isInLib={(it) => libraryList.some((l) => l.mediaId === it.id)}
                      onPlay={(it) => handleOpenMedia(it)}
                      onOpenDetails={(it) => handleOpenMedia(it)}
                      onToggleLibrary={(it) => handleToggleLibrary(it)}
                    />
                  )}

                  {/* Ligne "Reprendre la lecture" */}
                  {progressList.length > 0 && (
                    <CatalogRow
                      title="Reprendre la lecture"
                      subtitle={`Profil ${activeProfile.name}`}
                      items={progressList.map((p) => ({
                        id: p.mediaId,
                        type: p.mediaType,
                        name: p.title,
                        poster: p.poster,
                        currentTime: p.currentTime,
                        duration: p.duration,
                        season: p.season,
                        episode: p.episode,
                        progressPercent:
                          p.duration > 0 ? (p.currentTime / p.duration) * 100 : 0,
                      }))}
                      onSelectItem={(item) => handleOpenMedia(item)}
                    />
                  )}

                  {/* Lignes de Catalogues */}
                  {isLoadingCatalogs ? (
                    <div className="space-y-8">
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </div>
                  ) : catalogsError ? (
                    <div className="py-16 text-center text-slate-400 space-y-3">
                      <p className="text-sm font-semibold text-red-400">{catalogsError}</p>
                      <button
                        onClick={loadCatalogs}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Réessayer
                      </button>
                    </div>
                  ) : catalogs.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 space-y-2">
                      <p className="text-sm font-semibold text-slate-300">
                        Aucun catalogue disponible.
                      </p>
                      <p className="text-xs">
                        Configurez vos add-ons dans l'icône puzzle en bas à gauche.
                      </p>
                    </div>
                  ) : (
                    catalogs.map((cat, idx) => (
                      <CatalogRow
                        key={`${cat.addonId}-${cat.catalogId}-${idx}`}
                        title={cat.catalogName.replace(/^\[[^\]]+\]\s*/, '')}
                        items={cat.metas}
                        onSelectItem={(item) => handleOpenMedia(item)}
                        onSeeAll={() => {
                          setActiveNav('discover');
                          setSelectedCatalogId(cat.catalogId);
                        }}
                      />
                    ))
                  )}
                </div>
              )}

              {/* ONGLET 2 : EXPLORER */}
              {activeNav === 'discover' && (
                <DiscoverView
                  catalogs={catalogs}
                  isLoading={isLoadingCatalogs}
                  error={catalogsError}
                  onRetry={loadCatalogs}
                  mediaType={mediaType}
                  onMediaTypeChange={setMediaType}
                  selectedGenre={selectedGenre}
                  onGenreChange={setSelectedGenre}
                  selectedCatalogId={selectedCatalogId}
                  onSelectCatalogId={setSelectedCatalogId}
                  onSelectMedia={(item) => handleOpenMedia(item)}
                  progressList={progressList}
                  isKids={activeProfile.isKids === 1}
                />
              )}

              {/* ONGLET 3 : MA BIBLIOTHÈQUE */}
              {activeNav === 'library' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">
                      Ma Bibliothèque ({activeProfile.name})
                    </h2>
                  </div>

                  {libraryList.length === 0 ? (
                    <div className="py-24 text-center text-slate-400 space-y-2">
                      <Bookmark className="w-10 h-10 mx-auto text-slate-600" />
                      <p className="text-sm font-semibold text-slate-200">
                        Votre liste est vide
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Ajoutez vos films et séries favoris en cliquant sur « + Ma liste » pour les retrouver ici en toute indépendance des autres profils.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
                      {libraryList.map((item) => (
                        <div
                          key={item.id}
                          onClick={() =>
                            handleOpenMedia({
                              id: item.mediaId,
                              name: item.title,
                              type: item.mediaType,
                              poster: item.poster,
                              year: item.year,
                            })
                          }
                          className="group relative cursor-pointer flex flex-col rounded-xl overflow-hidden bg-[#0d1017] border border-white/8 hover:border-white/25 transition-all duration-200 shadow-md"
                        >
                          <div className="aspect-[2/3] w-full overflow-hidden bg-[#07090e]">
                            {item.poster ? (
                              <img
                                src={item.poster}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-102 transition"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                                Pas d'affiche
                              </div>
                            )}
                          </div>
                          <div className="p-2 space-y-0.5">
                            <h4 className="font-semibold text-xs sm:text-sm text-slate-200 group-hover:text-white line-clamp-1">
                              {item.title}
                            </h4>
                            <span className="text-[11px] text-slate-400 capitalize block">
                              {item.mediaType === 'series' ? 'Série' : 'Film'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* 3. BARRE DE NAVIGATION INFÉRIEURE SUR MOBILE */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#07090e]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-around py-2 px-3 safe-bottom">
        <button
          onClick={() => {
            setActiveNav('home');
            setSearchQuery('');
          }}
          className={`flex flex-col items-center gap-1 p-1.5 transition cursor-pointer ${
            activeNav === 'home' && !searchQuery ? 'text-white' : 'text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Accueil</span>
        </button>

        <button
          onClick={() => {
            setActiveNav('discover');
            setSearchQuery('');
          }}
          className={`flex flex-col items-center gap-1 p-1.5 transition cursor-pointer ${
            activeNav === 'discover' && !searchQuery ? 'text-white' : 'text-slate-400'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Explorer</span>
        </button>

        <button
          onClick={() => setActiveNav('search')}
          className={`flex flex-col items-center gap-1 p-1.5 transition cursor-pointer ${
            isSearchActive ? 'text-indigo-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Recherche</span>
        </button>

        <button
          onClick={() => {
            setActiveNav('library');
            setSearchQuery('');
          }}
          className={`flex flex-col items-center gap-1 p-1.5 transition relative cursor-pointer ${
            activeNav === 'library' && !searchQuery ? 'text-white' : 'text-slate-400'
          }`}
        >
          <Bookmark className="w-5 h-5" />
          {libraryList.length > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-indigo-400" />
          )}
          <span className="text-[10px] font-semibold">Ma Liste</span>
        </button>

        <button
          onClick={() => setShowAddonsModal(true)}
          className="flex flex-col items-center gap-1 p-1.5 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <Puzzle className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Add-ons</span>
        </button>
      </nav>

      {/* Modale Fiche Média */}
      {selectedItem && (
        <MediaModal
          detail={metaDetail || (selectedItem as MetaDetail)}
          streams={streams}
          isLoadingStreams={isLoadingStreams}
          isInLib={libraryList.some((l) => l.mediaId === selectedItem.id)}
          selectedPlayer={selectedPlayer}
          selectedVideoId={selectedVideoId}
          progressList={progressList}
          onSearchQuery={(q) => {
            setSearchQuery(q);
            setActiveNav('search');
            setSelectedItem(null);
            setMetaDetail(null);
          }}
          onToggleEpisodeWatched={handleToggleEpisodeWatched}
          onSelectVideo={handleSelectEpisode}
          onSelectPlayer={handleSelectPlayer}
          onToggleLibrary={() => handleToggleLibrary(selectedItem)}
          onPlayStream={handlePlayStream}
          onClose={() => {
            setSelectedItem(null);
            setMetaDetail(null);
            setStreams([]);
          }}
        />
      )}

      {/* Modale Gestionnaire d'Add-ons */}
      {showAddonsModal && (
        <AddonManager
          addons={addonsList}
          onAddAddon={async (url) => {
            await api.installAddon(url);
            await loadAddons();
            await loadCatalogs();
          }}
          onRemoveAddon={async (id) => {
            await api.removeAddon(id);
            await loadAddons();
            await loadCatalogs();
          }}
          onClose={() => setShowAddonsModal(false)}
        />
      )}

      {/* Modale Sécurité / Clé d'accès requise */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e121a] border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-600/20 text-indigo-400 mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Clé d'accès requise</h3>
              <p className="text-xs text-slate-400 mt-1">
                Ce serveur Stremo est sécurisé par un code d'accès STREMO_ACCESS_KEY.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                accessKey.set(authKeyInput.trim());
                setShowAuthModal(false);
                window.location.reload();
              }}
              className="space-y-3"
            >
              <input
                type="password"
                required
                placeholder="Entrez votre clé d'accès..."
                value={authKeyInput}
                onChange={(e) => setAuthKeyInput(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white shadow-lg transition cursor-pointer"
              >
                Déverrouiller Stremo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modale Contrôle Parental PIN */}
      {pinPromptTarget && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0e121a] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/30">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">Contrôle Parental</h3>
              <p className="text-xs text-slate-300 mt-1">
                Le profil « <span className="text-white font-semibold">{pinPromptTarget.name}</span> » est réservé aux adultes.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Saisissez le code PIN parental (PIN par défaut : 0000).
              </p>
            </div>
            <form onSubmit={handleConfirmPin} className="space-y-3">
              <input
                type="password"
                maxLength={8}
                autoFocus
                required
                placeholder="Code PIN..."
                value={pinCodeInput}
                onChange={(e) => {
                  setPinCodeInput(e.target.value);
                  setPinError(null);
                }}
                className="w-full text-center tracking-widest text-lg font-bold px-4 py-2.5 bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {pinError && (
                <p className="text-xs text-red-400 font-semibold">{pinError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPinPromptTarget(null);
                    setPinCodeInput('');
                    setPinError(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-xs text-slate-300 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white shadow-lg transition cursor-pointer"
                >
                  Déverrouiller
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Lecteur Vidéo Intégré */}
      {activePlayerStream && activePlayerStream.url && (
        <VideoPlayer
          streamUrl={activePlayerStream.url}
          title={
            selectedItem?.type === 'series' && selectedVideoId
              ? `${selectedItem.name} • S${metaDetail?.videos?.find((v) => v.id === selectedVideoId)?.season ?? 1}E${metaDetail?.videos?.find((v) => v.id === selectedVideoId)?.episode ?? 1}`
              : selectedItem?.name || 'Lecture'
          }
          subtitles={subtitles}
          nextEpisode={nextEpisode}
          profileId={activeProfile?.id}
          mediaInfo={
            selectedItem
              ? {
                  title: selectedItem.name,
                  year: selectedItem.year,
                  type: selectedItem.type === 'series' ? 'episode' : 'movie',
                  season: metaDetail?.videos?.find((v) => v.id === selectedVideoId)?.season,
                  episode: metaDetail?.videos?.find((v) => v.id === selectedVideoId)?.episode,
                  imdbId: selectedItem.id?.startsWith('tt') ? selectedItem.id : undefined,
                  tmdbId: selectedItem.id?.startsWith('tmdb:') ? selectedItem.id.replace('tmdb:', '') : undefined,
                }
              : undefined
          }
          onPlayNextEpisode={handlePlayNextEpisode}
          onProgress={(curr, dur) => {
            if (activeProfile && selectedItem) {
              api.saveProgress({
                profileId: activeProfile.id,
                mediaId: selectedItem.id,
                mediaType: selectedItem.type,
                title: selectedItem.name,
                poster: selectedItem.poster,
                season: metaDetail?.videos?.find((v) => v.id === selectedVideoId)?.season,
                episode: metaDetail?.videos?.find((v) => v.id === selectedVideoId)?.episode,
                currentTime: curr,
                duration: dur,
              });
            }
          }}
          onClose={() => setActivePlayerStream(null)}
          onLaunchVLC={() => {
            if (selectedItem && activePlayerStream.url) {
              api.playExternal(activePlayerStream.url, selectedItem.name, undefined, 'vlc');
            }
          }}
        />
      )}

      {/* Modale Sauvegarde & Synchronisation */}
      {showBackupModal && (
        <BackupModal
          onClose={() => setShowBackupModal(false)}
          onDataRestored={() => {
            loadProfiles();
            loadAddons();
            if (activeProfile) {
              loadProfileData(activeProfile.id);
            }
          }}
        />
      )}

      {/* Modale Scrobble Trakt.tv */}
      {showTraktModal && activeProfile && (
        <TraktModal
          profileId={activeProfile.id}
          profileName={activeProfile.name}
          onClose={() => setShowTraktModal(false)}
        />
      )}
    </div>
  );
}

export default App;
