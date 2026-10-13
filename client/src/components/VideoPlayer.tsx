import React, { useEffect, useRef, useState, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  Radio,
  ExternalLink,
  Subtitles,
  Check,
  Gauge,
  SkipForward,
  PictureInPicture2,
  Sliders,
  FastForward,
  Cast,
  Moon,
  Layers,
  Upload,
  Trash2,
  Timer,
  Bookmark,
  BookmarkPlus,
  SlidersHorizontal,
  Sun,
  Contrast,
  Sparkles,
  Film,
  Search,
  Palette,
  Headphones,
} from 'lucide-react';
import { api, type StreamSource, type BookmarkItem } from '../api';
import { getAndroidIntentUrl } from '../players';
import {
  createLocalSubtitleTrack,
  type SubtitleTrack,
  generateSubtitleCss,
  groupSubtitlesByLanguage,
  getLanguageInfo,
} from '../subtitles';
import {
  isOutroCreditsDetected,
  shouldAutoSkipIntro,
  getNextFallbackStream,
  parseStream,
  detectStreamAudioLanguage,
  matchSmartSubtitle,
  computeSmartIntroSkip,
} from '../streams';
import { installTranscodeClock, type TranscodeClock } from '../transcodeClock';

export interface NextEpisodeInfo {
  id: string;
  season: number;
  episode: number;
  title: string;
}

export interface TraktMediaInfo {
  title: string;
  year?: string | number;
  type: 'movie' | 'episode';
  season?: number;
  episode?: number;
  tmdbId?: string | number;
  imdbId?: string;
}

interface Props {
  streamUrl: string;
  title: string;
  subtitles?: SubtitleTrack[];
  initialTime?: number;
  nextEpisode?: NextEpisodeInfo | null;
  profileId?: string;
  mediaId?: string;
  mediaInfo?: TraktMediaInfo;
  availableStreams?: StreamSource[];
  isSeries?: boolean;
  onProgress?: (currentTime: number, duration: number) => void;
  onClose: () => void;
  onLaunchVLC?: () => void;
  onPlayNextEpisode?: () => void;
  onSelectStream?: (stream: StreamSource) => void;
}

export const VideoPlayer: React.FC<Props> = ({
  streamUrl,
  title,
  subtitles = [],
  initialTime = 0,
  nextEpisode,
  profileId,
  mediaId,
  mediaInfo,
  availableStreams,
  isSeries,
  onProgress,
  onClose,
  onLaunchVLC,
  onPlayNextEpisode,
  onSelectStream,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(true);

  // Subtitles & Audio/Video options
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [subDelay, setSubDelay] = useState<number>(0);
  const [subSize, setSubSize] = useState<'sm' | 'normal' | 'lg' | 'xl'>(() => {
    return (localStorage.getItem('stremo_sub_size') as any) || 'normal';
  });
  const [subColor, setSubColor] = useState<'white' | 'yellow' | 'cyan'>(() => {
    return (localStorage.getItem('stremo_sub_color') as any) || 'white';
  });
  const [subBg, setSubBg] = useState<'none' | 'translucent' | 'solid'>(() => {
    return (localStorage.getItem('stremo_sub_bg') as any) || 'translucent';
  });
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [subActiveLangFilter, setSubActiveLangFilter] = useState<string>('all');
  const [subTab, setSubTab] = useState<'tracks' | 'style'>('tracks');
  const [localSubtitles, setLocalSubtitles] = useState<SubtitleTrack[]>([]);
  const [isDraggingSub, setIsDraggingSub] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSubtitles = useMemo(() => {
    return [...(subtitles || []), ...localSubtitles];
  }, [subtitles, localSubtitles]);

  const subtitleGroups = useMemo(() => {
    return groupSubtitlesByLanguage(effectiveSubtitles);
  }, [effectiveSubtitles]);

  // Playback speed
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Sélecteur de flux & Auto-Fallback en cas d'erreur
  const [showStreamSelector, setShowStreamSelector] = useState(false);
  const [fallbackStream, setFallbackStream] = useState<StreamSource | null>(null);
  const [fallbackCountdown, setFallbackCountdown] = useState<number | null>(null);

  // Binge watching next episode & Saut de génériques (Intro & Outro)
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [nextDeclined, setNextDeclined] = useState(false);
  const [skipOutroSec, setSkipOutroSec] = useState<number>(() => {
    const saved = localStorage.getItem('stremo_skip_outro_sec');
    return saved ? Number(saved) : 75; // 75s par défaut (début standard du générique de fin)
  });
  const [autoSkipOutro, setAutoSkipOutro] = useState<boolean>(() => {
    return localStorage.getItem('stremo_auto_skip_outro') !== 'false';
  });
  const [autoSkipIntro, setAutoSkipIntro] = useState<boolean>(() => {
    return localStorage.getItem('stremo_auto_skip_intro') !== 'false';
  });
  const [introDurationSec, setIntroDurationSec] = useState<number>(() => {
    const saved = localStorage.getItem('stremo_intro_duration_sec');
    return saved ? Number(saved) : 85;
  });
  const hasAutoSkippedIntroRef = useRef(false);
  const [showSkipMenu, setShowSkipMenu] = useState(false);
  const [skipToast, setSkipToast] = useState<string | null>(null);

  // Timings précis de génériques (AniSkip / Community Timings)
  const [exactSkip, setExactSkip] = useState<{
    intro?: { start: number; end: number };
    outro?: { start: number; end: number };
  } | null>(null);

  // Calcul intelligent et adaptatif du saut d'intro (Anime 90s, Sitcom 25s, Drama 80s, Film désactivé)
  const smartIntro = useMemo(() => {
    return computeSmartIntroSkip({
      currentTime,
      duration,
      mediaType: mediaInfo?.type,
      title: mediaInfo?.title || title,
      isSeries,
      exactSkip,
      customIntroSec: introDurationSec,
    });
  }, [currentTime, duration, mediaInfo, title, isSeries, exactSkip, introDurationSec]);

  // Proxy de streaming vidéo (contournement CORS & compatibilité Web)
  const triedProxyRef = useRef(false);
  const [useStreamProxy, setUseStreamProxy] = useState<boolean>(() => {
    return localStorage.getItem('stremo_use_stream_proxy') === 'true';
  });

  // Mode Nuit & Boost Dialogues (Dynamics Compression)
  const [nightMode, setNightMode] = useState<boolean>(() => {
    return localStorage.getItem('stremo_night_mode') === 'true';
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const toggleNightMode = () => {
    const nextVal = !nightMode;
    setNightMode(nextVal);
    localStorage.setItem('stremo_night_mode', String(nextVal));

    try {
      const video = videoRef.current;
      if (!video) return;

      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const source = ctx.createMediaElementSource(video);
        sourceNodeRef.current = source;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-24, ctx.currentTime);
        compressor.knee.setValueAtTime(30, ctx.currentTime);
        compressor.ratio.setValueAtTime(12, ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        compressor.release.setValueAtTime(0.25, ctx.currentTime);
        compressorRef.current = compressor;
      }

      const ctx = audioContextRef.current;
      const source = sourceNodeRef.current;
      const compressor = compressorRef.current;

      if (ctx && source && compressor) {
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        source.disconnect();
        if (nextVal) {
          source.connect(compressor);
          compressor.connect(ctx.destination);
          setSkipToast("Mode Nuit & Boost Dialogues activé");
        } else {
          source.connect(ctx.destination);
          setSkipToast("Mode Nuit désactivé (son cinéma)");
        }
        setTimeout(() => setSkipToast(null), 2000);
      }
    } catch (err) {
      console.warn('Audio compression fallback:', err);
      setSkipToast(nextVal ? "Mode Nuit activé" : "Mode Nuit désactivé");
      setTimeout(() => setSkipToast(null), 2000);
    }
  };

  const hideControlsTimer = useRef<any>(null);

  // Minuteur de mise en veille (Sleep Timer) & OSD HUD
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const originalVolumeRef = useRef<number>(1);

  // OSD HUD Overlay (Affichage éphémère d'état à l'écran)
  const [osdInfo, setOsdInfo] = useState<{ text: string; icon: string; key: number } | null>(null);
  const osdTimerRef = useRef<any>(null);

  const triggerOSD = (text: string, icon = '✨') => {
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    setOsdInfo({ text, icon, key: Date.now() });
    osdTimerRef.current = setTimeout(() => {
      setOsdInfo(null);
    }, 1300);
  };

  const handleSetSleepTimer = (mins: number | null) => {
    setSleepTimerMinutes(mins);
    setShowSleepMenu(false);
    if (videoRef.current) {
      originalVolumeRef.current = videoRef.current.volume || 1;
    }
    if (mins === null) {
      setSleepRemainingSec(null);
      triggerOSD('Minuteur désactivé', '⏱️');
    } else if (mins === -1) {
      setSleepRemainingSec(null);
      triggerOSD('Veille : Fin d’épisode', '⏱️');
    } else {
      setSleepRemainingSec(mins * 60);
      triggerOSD(`Veille : ${mins} min`, '⏱️');
    }
  };

  const handleCycleSleepTimer = () => {
    const cycle: (number | null)[] = [null, 15, 30, 45, 60, -1];
    const currentIndex = cycle.indexOf(sleepTimerMinutes);
    const nextIndex = (currentIndex + 1) % cycle.length;
    handleSetSleepTimer(cycle[nextIndex]);
  };

  const handleSleepTimerExpire = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.volume = originalVolumeRef.current;
      setIsPlaying(false);
    }
    triggerOSD('Mise en veille effectuée 🌙', '⏱️');
    setSleepTimerMinutes(null);
    setSleepRemainingSec(null);
  };

  // Interval de compte à rebours pour le Sleep Timer
  useEffect(() => {
    if (sleepTimerMinutes === null || sleepTimerMinutes <= 0) {
      setSleepRemainingSec(null);
      return;
    }

    const interval = setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          handleSleepTimerExpire();
          return null;
        }

        // Fondu audio progressif lors des 5 dernières secondes
        if (prev <= 5 && videoRef.current) {
          const fadeStep = Math.max(0, (prev - 1) / 5);
          videoRef.current.volume = originalVolumeRef.current * fadeStep;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerMinutes]);

  // Format d'image & Égaliseur Vidéo (Aspect Ratio & Image Tuning)
  type AspectRatioMode = 'contain' | 'cover' | '16/9' | '21/9' | '4/3';
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>(() => {
    return (localStorage.getItem('stremo_aspect_ratio') as AspectRatioMode) || 'contain';
  });
  const [brightness, setBrightness] = useState<number>(() => {
    const v = localStorage.getItem('stremo_video_brightness');
    return v ? Number(v) : 100;
  });
  const [contrast, setContrast] = useState<number>(() => {
    const v = localStorage.getItem('stremo_video_contrast');
    return v ? Number(v) : 100;
  });
  const [saturation, setSaturation] = useState<number>(() => {
    const v = localStorage.getItem('stremo_video_saturation');
    return v ? Number(v) : 100;
  });
  const [showAdjustMenu, setShowAdjustMenu] = useState(false);

  const aspectRatios: { id: AspectRatioMode; label: string }[] = [
    { id: 'contain', label: 'Original (Ajusté)' },
    { id: 'cover', label: 'Remplir / Zoom (Plein écran)' },
    { id: '16/9', label: '16:9 (Panoramique)' },
    { id: '21/9', label: '21:9 (Cinéma Anamorphique)' },
    { id: '4/3', label: '4:3 (Rétro / Classique)' },
  ];

  const handleCycleAspectRatio = () => {
    const currentIndex = aspectRatios.findIndex((r) => r.id === aspectRatio);
    const next = aspectRatios[(currentIndex + 1) % aspectRatios.length];
    setAspectRatio(next.id);
    localStorage.setItem('stremo_aspect_ratio', next.id);
    triggerOSD(`Format : ${next.label}`, '📐');
  };

  const handleSetAspectRatio = (mode: AspectRatioMode) => {
    setAspectRatio(mode);
    localStorage.setItem('stremo_aspect_ratio', mode);
    const found = aspectRatios.find((r) => r.id === mode);
    triggerOSD(`Format : ${found?.label || mode}`, '📐');
  };

  const handleApplyPreset = (b: number, c: number, s: number, name: string) => {
    setBrightness(b);
    setContrast(c);
    setSaturation(s);
    localStorage.setItem('stremo_video_brightness', String(b));
    localStorage.setItem('stremo_video_contrast', String(c));
    localStorage.setItem('stremo_video_saturation', String(s));
    triggerOSD(`Rendu : ${name}`, '🎨');
  };

  const handleResetAdjustments = () => {
    handleApplyPreset(100, 100, 100, 'Standard');
  };

  // Signets & Marqueurs de Timeline (Personal Bookmarks)
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [showBookmarkMenu, setShowBookmarkMenu] = useState(false);
  const [bookmarkCustomTitle, setBookmarkCustomTitle] = useState('');

  useEffect(() => {
    if (!profileId || !mediaId) return;
    api.getBookmarks(profileId, mediaId)
      .then((items) => setBookmarks(items))
      .catch((err) => console.warn('Erreur chargement signets:', err));
  }, [profileId, mediaId]);

  const handleAddBookmark = async (customLabel?: string) => {
    if (!profileId || !mediaId) {
      triggerOSD('Profil requis pour les signets', '⚠️');
      return;
    }
    const curTime = Math.round(videoRef.current?.currentTime || currentTime);
    const titleToUse = customLabel?.trim() || bookmarkCustomTitle.trim() || `Signet @ ${formatTime(curTime)}`;
    try {
      const created = await api.addBookmark(profileId, mediaId, curTime, titleToUse);
      if (created) {
        setBookmarks((prev) => [...prev.filter((b) => b.id !== created.id), created].sort((a, b) => a.time - b.time));
        setBookmarkCustomTitle('');
        triggerOSD(`Signet : ${titleToUse}`, '🔖');
      }
    } catch (err) {
      console.error('Erreur ajout signet:', err);
      triggerOSD('Erreur ajout signet', '⚠️');
    }
  };

  // Statistiques WebTorrent P2P en direct et sélecteur de fichiers internes (multi-épisodes)
  const [torrentStats, setTorrentStats] = useState<{
    numPeers: number;
    downloadSpeed: number;
    uploadSpeed: number;
    progress: number;
    files?: Array<{
      index: number;
      name: string;
      length: number;
      isVideo: boolean;
    }>;
  } | null>(null);
  const [selectedTorrentFileIndex, setSelectedTorrentFileIndex] = useState<number | null>(null);
  const [showTorrentFilesMenu, setShowTorrentFilesMenu] = useState<boolean>(false);
  const triedTranscodeRef = useRef(false);
  const transcodeClockRef = useRef<TranscodeClock | null>(null);

  // État audio avancé & transcodage AAC universel
  const [isTranscodingAudio, setIsTranscodingAudio] = useState<boolean>(false);
  const [showAudioMenu, setShowAudioMenu] = useState<boolean>(false);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<
    Array<{ index: number; codec: string; language?: string; title?: string; channels?: number }>
  >([]);
  const [selectedAudioTrackIndex, setSelectedAudioTrackIndex] = useState<number>(0);
  const [preferTranscodeAudio, setPreferTranscodeAudio] = useState<boolean>(() => {
    return localStorage.getItem('stremo_prefer_transcode_audio') === 'true';
  });

  const startTranscode = (video: HTMLVideoElement, startTime: number, trackIndex?: number) => {
    triedTranscodeRef.current = true;
    setIsTranscodingAudio(true);
    const targetTrack = trackIndex !== undefined ? trackIndex : selectedAudioTrackIndex;
    if (trackIndex !== undefined) {
      setSelectedAudioTrackIndex(trackIndex);
    }

    if (transcodeClockRef.current) {
      transcodeClockRef.current.setOffset(startTime);
    } else {
      transcodeClockRef.current = installTranscodeClock(
        video,
        { offset: startTime, duration: duration > 0 ? duration : 0 },
        (absTime) => {
          startTranscode(video, absTime, trackIndex ?? selectedAudioTrackIndex);
        }
      );
      api.probeDuration(streamUrl).then((dur) => {
        if (dur && dur > 0) {
          setDuration(dur);
          transcodeClockRef.current?.setDuration(dur);
        }
      }).catch(() => {});
    }
    const transcodeUrl = api.getTranscodedStreamUrl(streamUrl, {
      startTime,
      mode: 'audio',
      audioTrack: targetTrack >= 0 ? targetTrack : undefined,
    });
    video.src = transcodeUrl;
    video.load();
    video.play().catch(() => {});
  };

  const stopTranscode = (video: HTMLVideoElement) => {
    setIsTranscodingAudio(false);
    triedTranscodeRef.current = false;
    const curr = Math.round(video.currentTime || 0);
    if (transcodeClockRef.current) {
      transcodeClockRef.current.dispose();
      transcodeClockRef.current = null;
    }
    const directUrl = useStreamProxy ? api.getProxiedStreamUrl(streamUrl) : streamUrl;
    video.src = directUrl;
    video.load();
    video.currentTime = curr;
    video.play().catch(() => {});
    triggerOSD('Son direct (source originale)', '🔊');
    setSkipToast('Retour au son direct');
    setTimeout(() => setSkipToast(null), 2500);
  };

  const handleToggleAudioTranscode = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isTranscodingAudio) {
      stopTranscode(video);
    } else {
      const curTime = Math.round(video.currentTime || initialTime || 0);
      setSkipToast("⚡ Activation du son universel (Transcodage AAC direct)...");
      triggerOSD('Son AAC universel activé', '⚡');
      startTranscode(video, curTime);
    }
  };

  const handleSelectAudioTrack = (trackIndex: number) => {
    setSelectedAudioTrackIndex(trackIndex);
    const video = videoRef.current;
    if (!video) return;
    const curTime = Math.round(video.currentTime || initialTime || 0);
    setSkipToast(`Piste audio #${trackIndex + 1} sélectionnée ⚡`);
    triggerOSD(`Piste audio #${trackIndex + 1}`, '🎧');
    startTranscode(video, curTime, trackIndex);
  };

  useEffect(() => {
    if (!streamUrl || (!streamUrl.startsWith('magnet:') && !streamUrl.includes('/api/torrent/stream'))) {
      setTorrentStats(null);
      setSelectedTorrentFileIndex(null);
      return;
    }

    let isMounted = true;
    const fetchStats = async () => {
      try {
        const stats = await api.getTorrentStats(streamUrl);
        if (isMounted && stats) {
          setTorrentStats({
            numPeers: stats.numPeers || 0,
            downloadSpeed: stats.downloadSpeed || 0,
            uploadSpeed: stats.uploadSpeed || 0,
            progress: stats.progress || 0,
            files: stats.files || [],
          });
        }
      } catch {
        // Ignorer les erreurs réseau temporaires
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [streamUrl]);

  const handleSelectTorrentFile = (fileIndex: number, fileName: string) => {
    setSelectedTorrentFileIndex(fileIndex);
    setShowTorrentFilesMenu(false);
    const video = videoRef.current;
    if (!video) return;
    const newUrl = api.getTorrentStreamUrl(streamUrl, fileIndex);
    setSkipToast(`Lecture de : ${fileName} 🎬`);
    video.src = newUrl;
    video.load();
    video.play().catch(() => {});
  };

  const handleRetryWithTranscode = () => {
    setPlaybackError(null);
    setFallbackCountdown(null);
    setBuffering(true);
    const video = videoRef.current;
    if (!video) return;
    const curTime = Math.round(video.currentTime || initialTime || 0);
    setSkipToast("Transcodage audio AAC en cours... ⚡");
    startTranscode(video, curTime);
  };

  const handleDeleteBookmark = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const ok = await api.deleteBookmark(id);
      if (ok) {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
        triggerOSD('Signet supprimé', '🗑️');
      }
    } catch (err) {
      console.error('Erreur suppression signet:', err);
    }
  };

  const handleJumpToBookmark = (time: number, label?: string) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
    triggerOSD(`Saut : ${label || formatTime(time)}`, '🔖');
  };

  const triggerPlaybackError = (errorMessage: string) => {
    setBuffering(false);
    setPlaybackError(errorMessage);
    if (availableStreams && onSelectStream) {
      const next = getNextFallbackStream(streamUrl, availableStreams);
      if (next && next.url) {
        setFallbackStream(next);
        setFallbackCountdown(3);
      }
    }
  };

  // Compte à rebours avant basculement automatique sur le flux suivant
  useEffect(() => {
    if (fallbackCountdown === null) return;
    if (fallbackCountdown <= 0) {
      if (fallbackStream && onSelectStream) {
        const target = fallbackStream;
        setFallbackStream(null);
        setFallbackCountdown(null);
        setPlaybackError(null);
        onSelectStream(target);
      }
      return;
    }
    const timer = setTimeout(() => {
      setFallbackCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [fallbackCountdown, fallbackStream, onSelectStream]);

  // Récupération des timecodes précis de génériques (AniSkip ou communautaires)
  useEffect(() => {
    if (!mediaInfo) return;
    const mediaId = mediaInfo.imdbId || (mediaInfo.tmdbId ? String(mediaInfo.tmdbId) : '') || mediaInfo.title;
    if (!mediaId) return;

    api.getSkipTimes(mediaId, mediaInfo.season, mediaInfo.episode)
      .then((res) => {
        if (res && res.found) {
          setExactSkip(res);
        } else {
          setExactSkip(null);
        }
      })
      .catch(() => setExactSkip(null));
  }, [mediaInfo]);

  // Sélection automatique intelligente des sous-titres selon la langue du flux et les préférences
  useEffect(() => {
    if (!subtitles || subtitles.length === 0) return;

    const currentStreamObj: StreamSource = availableStreams?.find((s) => s.url === streamUrl) || {
      name: title,
      url: streamUrl,
      addonName: 'Lecteur',
    };
    const streamAudioLang = detectStreamAudioLanguage(currentStreamObj);
    const preferredSubLang = localStorage.getItem('stremo_pref_sub_lang') || 'fra';
    const subtitleMode = localStorage.getItem('stremo_pref_sub_mode') || 'foreign_only';

    const matched = matchSmartSubtitle(subtitles, preferredSubLang, streamAudioLang, subtitleMode);
    if (matched) {
      setSelectedSub(matched.id);
      setSkipToast(`Sous-titres ${matched.lang?.toUpperCase() || 'FR'} activés 💬`);
      setTimeout(() => setSkipToast(null), 2500);
    }
  }, [subtitles, streamUrl]);

  // Activation réelle des pistes textTracks HTML5
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks) return;

    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i];
      const matchingSub = effectiveSubtitles[i];
      if (matchingSub && matchingSub.id === selectedSub) {
        track.mode = 'showing';
      } else {
        track.mode = 'disabled';
      }
    }
  }, [selectedSub, effectiveSubtitles]);

  // Écoute des commandes de télécommande mobile en direct (SSE)
  useEffect(() => {
    const pairedCode = localStorage.getItem('stremo_paired_remote_code');
    if (!pairedCode) return;

    const unsubscribe = api.subscribePairEvents(
      pairedCode,
      () => {},
      (cmd: any) => {
        if (!cmd || !cmd.action) return;
        const video = videoRef.current;
        if (!video) return;

        if (cmd.action === 'toggle_play') {
          if (video.paused) {
            video.play().catch(() => {});
            setIsPlaying(true);
          } else {
            video.pause();
            setIsPlaying(false);
          }
        } else if (cmd.action === 'seek') {
          const delta = Number(cmd.payload) || 10;
          video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
        } else if (cmd.action === 'skip_intro') {
          handleSkipIntro();
        } else if (cmd.action === 'next_episode') {
          handleSkipToNextEpisode();
        } else if (cmd.action === 'toggle_mute') {
          video.muted = !video.muted;
          setIsMuted(video.muted);
        } else if (cmd.action === 'volume_up') {
          video.volume = Math.min(1, video.volume + 0.1);
        } else if (cmd.action === 'volume_down') {
          video.volume = Math.max(0, video.volume - 0.1);
        }
      }
    );

    return () => unsubscribe();
  }, [duration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    triedTranscodeRef.current = false;
    setSelectedTorrentFileIndex(null);
    transcodeClockRef.current?.dispose();
    transcodeClockRef.current = null;
    setPlaybackError(null);
    setFallbackStream(null);
    setFallbackCountdown(null);
    hasAutoSkippedIntroRef.current = false;
    setBuffering(true);

    const effectiveStreamUrl = api.resolvePlayableUrl(streamUrl, useStreamProxy);
    triedProxyRef.current = useStreamProxy;

    // Sondage du flux pour détecter les codecs audio et pistes disponibles
    api.probeStream(streamUrl).then((probe) => {
      if (probe?.audioTracks && probe.audioTracks.length > 0) {
        setAvailableAudioTracks(probe.audioTracks);
        const codec = String(probe.audioCodec || '').toLowerCase();
        const isUnsupportedCodec = ['truehd', 'dts', 'dca', 'ac3', 'eac3', 'mlp'].some((c) => codec.includes(c));
        if (isUnsupportedCodec && !triedTranscodeRef.current) {
          setSkipToast(`💡 Audio ${probe.audioCodec?.toUpperCase()} détecté : Cliquez sur "⚡ Audio AAC" si vous n'avez pas de son.`);
        }
      }
    }).catch(() => {});

    // Si l'utilisateur préfère systématiquement le son transcodé (ex: environnement Linux)
    if (preferTranscodeAudio && !streamUrl.includes('/api/transcode/stream')) {
      startTranscode(video, initialTime || 0);
      return;
    }

    const isHls = effectiveStreamUrl.includes('.m3u8') || effectiveStreamUrl.includes('hls');

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.loadSource(effectiveStreamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setBuffering(false);
        if (initialTime > 0) video.currentTime = initialTime;
        video.play().catch(() => setIsPlaying(false));
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          console.warn('HLS Fatal error:', data);
          triggerPlaybackError('Flux direct non décodable dans le navigateur web. Format incompatible.');
        }
      });
    } else {
      video.src = effectiveStreamUrl;
      video.onloadedmetadata = () => {
        setBuffering(false);
        if (initialTime > 0) video.currentTime = initialTime;
        video.play().catch(() => setIsPlaying(false));
      };
      video.onerror = () => {
        // 1. Tentative automatique de fallback sur le proxy local (contourne les erreurs CORS des CDN)
        if (
          !triedProxyRef.current &&
          !streamUrl.startsWith('magnet:') &&
          !streamUrl.includes('/api/proxy/stream') &&
          !streamUrl.includes('/api/torrent/stream') &&
          !streamUrl.includes('/api/transcode/stream')
        ) {
          triedProxyRef.current = true;
          const proxied = api.getProxiedStreamUrl(streamUrl);
          setSkipToast("Contournement CORS : bascule sur le proxy local...");
          video.src = proxied;
          video.load();
          video.play().catch(() => {});
          return;
        }

        // 2. Si le format ou le codec audio est incompatible, bascule automatique sur le remuxer AAC universel
        if (!triedTranscodeRef.current && !streamUrl.includes('/api/transcode/stream')) {
          setSkipToast("Bascule automatique : remuxing audio AAC en direct ⚡");
          startTranscode(video, Math.round(video.currentTime || initialTime || 0));
          return;
        }

        triggerPlaybackError('Format vidéo ou codec audio (ex: DTS / AC3 / HEVC) non décodable directement dans ce navigateur.');
      };
    }

    return () => {
      if (hls) hls.destroy();
      transcodeClockRef.current?.dispose();
      transcodeClockRef.current = null;
    };
  }, [streamUrl, initialTime]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const rawDur = videoRef.current.duration;
    const dur = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : (duration > 0 ? duration : 0);
    setCurrentTime(curr);
    if (dur > 0 && dur !== duration) {
      setDuration(dur);
    }
    if (onProgress && Math.floor(curr) % 5 === 0) {
      onProgress(curr, dur);
    }

    // Saut d'intro automatique intelligent (AniSkip ou durée adaptée Anime/Sitcom/Série)
    if (autoSkipIntro && !hasAutoSkippedIntroRef.current && smartIntro.canSkip) {
      if (exactSkip?.intro && curr >= exactSkip.intro.start && curr < exactSkip.intro.end) {
        hasAutoSkippedIntroRef.current = true;
        if (videoRef.current) {
          videoRef.current.currentTime = exactSkip.intro.end;
          setSkipToast("Opening sauté automatiquement (AniSkip) ⏭️");
          setTimeout(() => setSkipToast(null), 2500);
        }
      } else if (shouldAutoSkipIntro(curr, dur, autoSkipIntro)) {
        hasAutoSkippedIntroRef.current = true;
        const targetTime = smartIntro.targetTime;
        if (videoRef.current) {
          videoRef.current.currentTime = targetTime;
          setSkipToast(`${smartIntro.buttonLabel} sautée automatiquement (${smartIntro.badgeText}) ⏭️`);
          setTimeout(() => setSkipToast(null), 2500);
        }
      }
    }

    // Détection Outro précis AniSkip si disponible, sinon heuristique
    if (exactSkip?.outro && nextEpisode && onPlayNextEpisode && !nextDeclined) {
      if (curr >= exactSkip.outro.start && nextCountdown === null && autoSkipOutro) {
        setNextCountdown(10);
      }
    } else if (nextEpisode && onPlayNextEpisode && !nextDeclined && isOutroCreditsDetected(curr, dur, skipOutroSec)) {
      if (nextCountdown === null && autoSkipOutro) {
        setNextCountdown(10);
      }
    }

    // Détection Sleep Timer : Fin de l'épisode / vidéo
    if (sleepTimerMinutes === -1 && dur > 0 && curr >= dur - 4) {
      handleSleepTimerExpire();
    }
  };

  const handleSkipIntro = () => {
    if (!videoRef.current) return;
    const target = smartIntro.canSkip ? smartIntro.targetTime : Math.min(duration, videoRef.current.currentTime + 80);
    const diff = Math.round(target - videoRef.current.currentTime);
    videoRef.current.currentTime = target;
    const label = smartIntro.buttonLabel || "Intro";
    const badge = smartIntro.badgeText ? ` (${smartIntro.badgeText})` : ` (+${diff}s)`;
    setSkipToast(`${label} sautée${badge} ⏭️`);
    setTimeout(() => setSkipToast(null), 2000);
  };

  const handleSkipToNextEpisode = () => {
    setNextCountdown(null);
    setSkipToast("Chargement de l'épisode suivant...");
    setTimeout(() => setSkipToast(null), 1500);
    if (onPlayNextEpisode) onPlayNextEpisode();
  };

  const handleSetSkipOutroSec = (sec: number) => {
    setSkipOutroSec(sec);
    localStorage.setItem('stremo_skip_outro_sec', String(sec));
  };

  const handleToggleAutoSkipOutro = () => {
    const nextVal = !autoSkipOutro;
    setAutoSkipOutro(nextVal);
    localStorage.setItem('stremo_auto_skip_outro', String(nextVal));
  };

  const handleToggleAutoSkipIntro = () => {
    const nextVal = !autoSkipIntro;
    setAutoSkipIntro(nextVal);
    localStorage.setItem('stremo_auto_skip_intro', String(nextVal));
  };

  const handleSetIntroDurationSec = (sec: number) => {
    setIntroDurationSec(sec);
    localStorage.setItem('stremo_intro_duration_sec', String(sec));
  };

  // Compte à rebours avant l'épisode suivant
  useEffect(() => {
    if (nextCountdown === null) return;
    if (nextCountdown <= 0) {
      setNextCountdown(null);
      if (onPlayNextEpisode) onPlayNextEpisode();
      return;
    }
    const timer = setTimeout(() => {
      setNextCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [nextCountdown, onPlayNextEpisode]);

  const handleSetSpeed = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackRate(speed);
      setShowSpeedMenu(false);
    }
  };

  const handleAdjustSubDelay = (delta: number) => {
    const nextVal = Math.round((subDelay + delta) * 10) / 10;
    const diff = nextVal - subDelay;
    setSubDelay(nextVal);
    if (videoRef.current) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        const track = videoRef.current.textTracks[i];
        if (track.cues) {
          for (let j = 0; j < track.cues.length; j++) {
            const cue = track.cues[j];
            cue.startTime += diff;
            cue.endTime += diff;
          }
        }
      }
    }
  };

  const handleResetSubDelay = () => {
    const diff = -subDelay;
    setSubDelay(0);
    if (videoRef.current) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        const track = videoRef.current.textTracks[i];
        if (track.cues) {
          for (let j = 0; j < track.cues.length; j++) {
            const cue = track.cues[j];
            cue.startTime += diff;
            cue.endTime += diff;
          }
        }
      }
    }
  };

  // Drag & drop et importation de sous-titres locaux (.srt / .vtt)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types?.includes('Files')) {
      setIsDraggingSub(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSub(false);
  };

  const handleImportSubtitleFile = async (file: File) => {
    try {
      const track = await createLocalSubtitleTrack(file);
      setLocalSubtitles((prev) => [...prev, track]);
      setSelectedSub(track.id);
      setSkipToast(`Sous-titre local activé : ${file.name} 💬`);
      setTimeout(() => setSkipToast(null), 3500);
    } catch (err) {
      console.error('Erreur chargement sous-titre local:', err);
      setSkipToast('Erreur : impossible de lire ce fichier de sous-titres');
      setTimeout(() => setSkipToast(null), 3000);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSub(false);

    const files = Array.from(e.dataTransfer.files);
    const subFile = files.find((f) => f.name.match(/\.(srt|vtt)$/i));
    if (subFile) {
      await handleImportSubtitleFile(subFile);
    } else if (files.length > 0) {
      setSkipToast('Format non supporté (utilisez un fichier .srt ou .vtt)');
      setTimeout(() => setSkipToast(null), 3000);
    }
  };

  const handleRemoveLocalSub = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalSubtitles((prev) => prev.filter((s) => s.id !== id));
    if (selectedSub === id) {
      setSelectedSub(null);
    }
  };

  // Google Cast / AirPlay
  const handleCast = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      // 1. Remote Playback API standard (Google Cast sur Chrome, Edge & Android)
      if ('remote' in video && (video as any).remote && typeof (video as any).remote.prompt === 'function') {
        await (video as any).remote.prompt();
        return;
      }

      // 2. AirPlay Apple standard (Safari sur macOS, iPhone & iPad)
      if ('webkitShowPlaybackTargetPicker' in video && typeof (video as any).webkitShowPlaybackTargetPicker === 'function') {
        (video as any).webkitShowPlaybackTargetPicker();
        return;
      }

      setSkipToast("Diffuser : utilisez l'option 'Caster' de Chrome ou lancez dans VLC");
      setTimeout(() => setSkipToast(null), 3000);
    } catch (err) {
      console.warn('Cast error:', err);
    }
  };

  // Trakt.tv Scrobbler automatique
  const lastScrobbleRef = useRef<{ action: string; time: number }>({ action: '', time: 0 });

  const triggerTraktScrobble = (action: 'start' | 'pause' | 'stop', force = false) => {
    if (!profileId || !mediaInfo || !videoRef.current) return;
    const curr = videoRef.current.currentTime || 0;
    const dur = videoRef.current.duration || 1;
    const progress = Math.min(100, Math.max(0, Math.round((curr / dur) * 100)));

    const now = Date.now();
    if (!force && lastScrobbleRef.current.action === action && now - lastScrobbleRef.current.time < 5000) {
      return;
    }

    lastScrobbleRef.current = { action, time: now };
    api.scrobbleTrakt({
      profileId,
      action,
      progress,
      media: mediaInfo,
    }).catch(() => {});
  };

  useEffect(() => {
    if (isPlaying) {
      triggerTraktScrobble('start');
    } else if (currentTime > 0) {
      triggerTraktScrobble('pause');
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      triggerTraktScrobble('stop', true);
    };
  }, []);

  const togglePiP = async () => {
    try {
      if (!videoRef.current) return;
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  const resetHideTimer = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec)) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'k' || e.key === 'Enter') {
        e.preventDefault();
        togglePlay();
        triggerOSD(isPlaying ? 'Pause' : 'Lecture', isPlaying ? '⏸️' : '▶️');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skip(-10);
        triggerOSD('-10s', '⏪');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        skip(10);
        triggerOSD('+10s', '⏩');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (videoRef.current) {
          const newVol = Math.min(1, videoRef.current.volume + 0.1);
          videoRef.current.volume = newVol;
          setIsMuted(false);
          triggerOSD(`Volume ${Math.round(newVol * 100)}%`, '🔊');
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (videoRef.current) {
          const newVol = Math.max(0, videoRef.current.volume - 0.1);
          videoRef.current.volume = newVol;
          triggerOSD(`Volume ${Math.round(newVol * 100)}%`, newVol === 0 ? '🔇' : '🔉');
        }
      } else if (e.key === 'm') {
        e.preventDefault();
        if (videoRef.current) {
          const nextMuted = !videoRef.current.muted;
          videoRef.current.muted = nextMuted;
          setIsMuted(nextMuted);
          triggerOSD(nextMuted ? 'Son coupé' : 'Son activé', nextMuted ? '🔇' : '🔊');
        }
      } else if (e.key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'n' || e.key === 'N') {
        if (nextEpisode && onPlayNextEpisode) {
          e.preventDefault();
          handleSkipToNextEpisode();
        }
      } else if (e.key === 's' || e.key === 'S' || e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        handleSkipIntro();
      } else if (e.key === '[' || e.key === '{') {
        e.preventDefault();
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const currentSpeed = videoRef.current ? videoRef.current.playbackRate : playbackRate;
        const nextSpeed = speeds.slice().reverse().find((s) => s < currentSpeed) || 0.5;
        handleSetSpeed(nextSpeed);
        triggerOSD(`Vitesse ${nextSpeed}x`, '⚡');
      } else if (e.key === ']' || e.key === '}') {
        e.preventDefault();
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const currentSpeed = videoRef.current ? videoRef.current.playbackRate : playbackRate;
        const nextSpeed = speeds.find((s) => s > currentSpeed) || 2;
        handleSetSpeed(nextSpeed);
        triggerOSD(`Vitesse ${nextSpeed}x`, '⚡');
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleNightMode();
        triggerOSD(!nightMode ? 'Mode Nuit Activé' : 'Mode Standard', '🌙');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleCycleSleepTimer();
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleCycleAspectRatio();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleAddBookmark();
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        handleToggleAudioTranscode();
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration, aspectRatio, bookmarks, profileId, mediaId, currentTime]);

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      <video
        ref={videoRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
        className={`cursor-pointer transition-[filter] duration-200 ${
          aspectRatio === 'cover'
            ? 'w-full h-full object-cover'
            : aspectRatio === '16/9'
            ? 'w-full max-h-full aspect-video object-cover'
            : aspectRatio === '21/9'
            ? 'w-full max-h-full aspect-[21/9] object-cover'
            : aspectRatio === '4/3'
            ? 'h-full max-w-full aspect-[4/3] object-contain'
            : 'w-full h-full object-contain'
        }`}
        style={{
          filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
        }}
        onClick={togglePlay}
        crossOrigin="anonymous"
        playsInline
      >
        {effectiveSubtitles.map((sub) => (
          <track
            key={sub.id}
            kind="subtitles"
            label={`${sub.lang} (${sub.addonName || 'OpenSubtitles'})`}
            srcLang={sub.lang}
            src={api.getProxiedSubtitleUrl(sub.url)}
            default={selectedSub === sub.id}
          />
        ))}
      </video>

      {/* OSD HUD Overlay (On-Screen Display HUD) */}
      {osdInfo && (
        <div
          key={osdInfo.key}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none bg-black/85 backdrop-blur-md px-6 py-3.5 rounded-2xl border border-white/15 text-white font-extrabold text-base md:text-lg flex items-center gap-3 shadow-2xl shadow-black/90 animate-fade-in"
        >
          <span className="text-xl md:text-2xl">{osdInfo.icon}</span>
          <span>{osdInfo.text}</span>
        </div>
      )}

      {/* Drag & Drop Subtitles Overlay */}
      {isDraggingSub && (
        <div className="absolute inset-0 z-50 bg-indigo-950/85 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-indigo-400 pointer-events-none animate-fade-in p-6 text-center">
          <Upload className="w-16 h-16 text-indigo-300 animate-bounce mb-3" />
          <h3 className="text-xl font-bold text-white mb-1">Déposez votre fichier de sous-titres ici</h3>
          <p className="text-sm text-indigo-200">Prise en charge instantanée des fichiers .srt et .vtt</p>
        </div>
      )}

      {/* Buffering Indicator */}
      {buffering && !playbackError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 pointer-events-none">
          <div className="w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="mt-3 text-xs font-semibold text-slate-300 tracking-wider uppercase">Chargement du flux...</span>
        </div>
      )}

      {/* Fallback Panel with Mobile & Desktop options */}
      {playbackError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center max-w-lg mx-auto my-auto rounded-3xl border border-white/10 shadow-2xl z-40">
          {/* Bandeau d'auto-fallback si un flux suivant est disponible */}
          {fallbackCountdown !== null && fallbackStream && (
            <div className="w-full p-4 mb-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-full bg-amber-500/30 text-amber-300 font-black flex items-center justify-center shrink-0">
                  {fallbackCountdown}s
                </span>
                <div className="text-left truncate">
                  <div className="font-bold text-white truncate">Basculement auto en cours...</div>
                  <div className="text-[11px] text-amber-300 truncate">Flux suivant : {fallbackStream.name || 'Version alternative'}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    if (fallbackStream && onSelectStream) {
                      const target = fallbackStream;
                      setFallbackStream(null);
                      setFallbackCountdown(null);
                      setPlaybackError(null);
                      onSelectStream(target);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer"
                >
                  Basculer
                </button>
                <button
                  onClick={() => {
                    setFallbackCountdown(null);
                    setFallbackStream(null);
                  }}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition cursor-pointer"
                  title="Annuler le basculement automatique"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3.5 shadow-lg">
            <Radio className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-extrabold text-white mb-2 tracking-tight">Format vidéo cinéma détecté</h3>
          <p className="text-xs text-slate-300 mb-6 leading-relaxed max-w-md">
            Ce fichier utilise un format haute fidélité (4K ou audio multicanal). Pour en profiter sans coupure, lancez-le dans votre lecteur ou choisissez une version directe.
          </p>
          <div className="flex flex-col gap-2.5 w-full">
            <button
              onClick={handleRetryWithTranscode}
              className="w-full px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-xl shadow-cyan-600/25 transition cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400 active:scale-98"
            >
              <Sparkles className="w-4 h-4" />
              ⚡ Réparer & Lire directement (Transcodage AAC)
            </button>
            {availableStreams && availableStreams.length > 1 && onSelectStream && (
              <button
                onClick={() => {
                  setShowStreamSelector(true);
                }}
                className="w-full px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-xl transition cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400"
              >
                <Layers className="w-4 h-4" />
                Choisir un autre flux ({availableStreams.length} disponibles)
              </button>
            )}
            {onLaunchVLC && (
              <button
                onClick={onLaunchVLC}
                className="w-full px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 border border-white/10 transition cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
              >
                <ExternalLink className="w-4 h-4" />
                🎬 Lancer sur cet écran (VLC)
              </button>
            )}
            <button
              onClick={() => {
                window.location.href = getAndroidIntentUrl(streamUrl);
              }}
              className="w-full px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400"
            >
              <ExternalLink className="w-4 h-4" />
              📱 Lancer sur Android / TV (Just Player)
            </button>
            <button
              onClick={onClose}
              className="w-full px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 border border-white/5 transition cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
            >
              <X className="w-4 h-4" />
              Fermer le lecteur
            </button>
          </div>
        </div>
      )}

      {/* Style dynamique pour la taille et le contraste des sous-titres */}
      <style>{generateSubtitleCss({ size: subSize, color: subColor, background: subBg })}</style>

      {/* Toast d'action éphémère */}
      {skipToast && (
        <div className="absolute top-20 inset-x-0 mx-auto w-fit z-50 px-4 py-2 bg-indigo-600/95 text-white rounded-xl backdrop-blur-md shadow-2xl font-bold text-xs flex items-center gap-2 animate-fade-in pointer-events-none ring-1 ring-white/20">
          <FastForward className="w-4 h-4 text-white" />
          <span>{skipToast}</span>
        </div>
      )}

      {/* Bouton Flottant Intelligent : Passer l'intro / opening */}
      {smartIntro.canSkip && nextCountdown === null && (
        <button
          onClick={handleSkipIntro}
          className="absolute bottom-24 right-6 sm:right-8 z-40 px-4 py-2.5 rounded-2xl bg-[#111622]/95 hover:bg-[#182135] text-white border border-indigo-500/40 hover:border-indigo-400 backdrop-blur-md text-xs font-bold shadow-2xl transition flex items-center gap-2 cursor-pointer group pointer-events-auto ring-1 ring-indigo-500/20"
          title={`${smartIntro.buttonLabel} (Raccourci : S)`}
        >
          <FastForward className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition" />
          <span>{smartIntro.buttonLabel}</span>
          <span className="text-[10px] text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded font-mono border border-indigo-500/30">
            {smartIntro.badgeText}
          </span>
        </button>
      )}

      {/* Bandeau Binge-Watching & Saut de générique de fin */}
      {nextCountdown !== null && nextEpisode && (
        <div className="absolute bottom-24 right-6 sm:right-8 z-50 bg-[#111622]/95 border border-indigo-500/50 backdrop-blur-md p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-fade-in max-w-md pointer-events-auto ring-1 ring-indigo-500/30">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/25 border border-indigo-500/40 flex items-center justify-center font-black text-indigo-400 text-lg shrink-0">
            {nextCountdown}s
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block">
              Générique de fin détecté • Épisode suivant
            </span>
            <span className="text-xs font-bold text-white block truncate">
              S{nextEpisode.season} E{nextEpisode.episode} - {nextEpisode.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleSkipToNextEpisode}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/30"
              title="Passer au prochain épisode immédiatement (Raccourci : N)"
            >
              <SkipForward className="w-3.5 h-3.5 fill-white" />
              <span>Passer</span>
            </button>
            <button
              onClick={() => {
                setNextCountdown(null);
                setNextDeclined(true);
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Rester sur le générique (annule le saut automatique)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bouton Flottant manuel : Début de générique de fin (si saut auto décliné ou désactivé) */}
      {nextCountdown === null &&
        nextEpisode &&
        !nextDeclined &&
        isOutroCreditsDetected(currentTime, duration, skipOutroSec) && (
          <button
            onClick={handleSkipToNextEpisode}
            className="absolute bottom-24 right-6 sm:right-8 z-40 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/50 backdrop-blur-md text-xs font-bold shadow-2xl transition flex items-center gap-2 cursor-pointer pointer-events-auto"
            title="Passer au prochain épisode (Raccourci : N)"
          >
            <SkipForward className="w-4 h-4 fill-white" />
            <span>Passer à l'épisode suivant (S{nextEpisode.season} E{nextEpisode.episode})</span>
          </button>
        )}

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-between p-6 bg-gradient-to-t from-black/90 via-transparent to-black/70 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur transition cursor-pointer"
              title="Fermer le lecteur (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-sm md:text-base font-bold text-white drop-shadow line-clamp-1 max-w-xl">
              {title}
            </h2>
            {torrentStats && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs backdrop-blur shadow-md">
                <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                <span className="font-bold">WebTorrent P2P</span>
                <span className="text-slate-400">•</span>
                <span>{(torrentStats.downloadSpeed / (1024 * 1024)).toFixed(1)} Mo/s</span>
                <span className="text-slate-400">•</span>
                <span>{torrentStats.numPeers} pairs</span>
                <span className="text-slate-400">•</span>
                <span>{Math.round(torrentStats.progress * 100)}%</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {nextEpisode && onPlayNextEpisode && (
              <button
                onClick={onPlayNextEpisode}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-indigo-600/20"
                title={`Passer à l'épisode suivant (S${nextEpisode.season} E${nextEpisode.episode})`}
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Épisode suivant</span>
              </button>
            )}

            {onLaunchVLC && (
              <button
                onClick={onLaunchVLC}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition cursor-pointer"
                title="Basculer vers VLC"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">VLC</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="space-y-3 pointer-events-auto max-w-4xl mx-auto w-full">
          {/* Progress Slider avec Marqueurs de Signets */}
          <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
            <span className="w-12 text-right">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center group py-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-white/20 hover:bg-white/30 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition"
              />
              {/* Marqueurs visuels de signets sur la barre */}
              {duration > 0 &&
                bookmarks.map((bm) => {
                  const leftPct = Math.min(100, Math.max(0, (bm.time / duration) * 100));
                  return (
                    <button
                      key={bm.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToBookmark(bm.time, bm.title);
                      }}
                      className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 -ml-1.25 rounded-full bg-amber-400 hover:bg-amber-300 border border-black shadow-md cursor-pointer transition transform hover:scale-175 z-20"
                      style={{ left: `${leftPct}%` }}
                      title={`${bm.title || 'Signet'} (${formatTime(bm.time)})`}
                    />
                  );
                })}
            </div>
            <span className="w-12 text-left">{formatTime(duration)}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={togglePlay}
                className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition cursor-pointer"
                title={isPlaying ? 'Pause (Espace)' : 'Lecture (Espace)'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>

              <button
                onClick={() => skip(-10)}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Reculer de 10s"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => skip(10)}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Avancer de 10s"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title={isMuted ? 'Activer le son (M)' : 'Couper le son (M)'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Mode Nuit / Boost Dialogues */}
              <button
                onClick={toggleNightMode}
                className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                  nightMode
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title={
                  nightMode
                    ? 'Mode Nuit & Boost Dialogues Actif (calme les explosions, augmente les voix)'
                    : 'Activer le Mode Nuit & Boost Dialogues'
                }
              >
                <Moon className={`w-4 h-4 ${nightMode ? 'text-indigo-400 fill-indigo-400/30' : ''}`} />
                <span className="text-[10px] font-bold hidden sm:inline">
                  {nightMode ? 'Nuit' : ''}
                </span>
              </button>

              {/* Menu & Bouton Réparer le son / Audio AAC */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowAudioMenu(!showAudioMenu);
                    setShowBookmarkMenu(false);
                    setShowAdjustMenu(false);
                    setShowSleepMenu(false);
                    setShowSpeedMenu(false);
                    setShowSubMenu(false);
                    setShowSkipMenu(false);
                    setShowStreamSelector(false);
                  }}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                    isTranscodingAudio
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title={
                    isTranscodingAudio
                      ? 'Audio AAC Universel ACTIF (Résout les problèmes de silence sur AC3/DTS/TrueHD)'
                      : 'Pas de son ? Cliquez pour réparer et activer le son universel AAC'
                  }
                >
                  <Headphones className={`w-4 h-4 ${isTranscodingAudio ? 'text-emerald-400 animate-pulse' : 'text-slate-300'}`} />
                  <span className="text-[10px] font-bold hidden sm:inline">
                    {isTranscodingAudio ? 'AAC ⚡' : 'Audio'}
                  </span>
                </button>

                {showAudioMenu && (
                  <div className="absolute left-0 bottom-full mb-3 w-80 bg-[#111622] border border-white/10 rounded-2xl shadow-2xl p-3.5 z-50 space-y-3">
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                      <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                        <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                        Options Audio & Réparation du son
                      </div>
                      <button
                        onClick={() => setShowAudioMenu(false)}
                        className="text-slate-400 hover:text-white p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          if (isTranscodingAudio) stopTranscode(videoRef.current!);
                          setShowAudioMenu(false);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          !isTranscodingAudio
                            ? 'bg-white/10 text-white border border-white/15'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-white">Son Direct (Original)</div>
                          <div className="text-[10px] text-slate-400">Flux brut source sans conversion</div>
                        </div>
                        {!isTranscodingAudio && <Check className="w-4 h-4 text-emerald-400" />}
                      </button>

                      <button
                        onClick={() => {
                          if (!isTranscodingAudio) handleToggleAudioTranscode();
                          setShowAudioMenu(false);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          isTranscodingAudio
                            ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                            : 'text-slate-300 hover:text-white hover:bg-white/5 border border-emerald-500/20'
                        }`}
                      >
                        <div>
                          <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> ⚡ Réparer le son (Transcodage AAC)
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Recommandé pour AC3, EAC3, DTS, TrueHD & 5.1/7.1
                          </div>
                        </div>
                        {isTranscodingAudio && <Check className="w-4 h-4 text-emerald-400" />}
                      </button>
                    </div>

                    {/* Liste des pistes audio détectées via probe si disponibles */}
                    {availableAudioTracks.length > 1 && (
                      <div className="pt-2 border-t border-white/5">
                        <div className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center justify-between">
                          <span>Pistes Audio Détectées ({availableAudioTracks.length})</span>
                          <span className="text-[9px] text-indigo-400 font-mono">FFmpeg</span>
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                          {availableAudioTracks.map((tr) => (
                            <button
                              key={tr.index}
                              onClick={() => {
                                handleSelectAudioTrack(tr.index);
                                setShowAudioMenu(false);
                              }}
                              className={`w-full p-2 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer ${
                                isTranscodingAudio && selectedAudioTrackIndex === tr.index
                                  ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/30'
                                  : 'text-slate-300 hover:bg-white/5'
                              }`}
                            >
                              <div className="truncate">
                                <span className="font-mono text-[10px] mr-1.5 text-indigo-400">#{tr.index + 1}</span>
                                <span>{tr.title || (tr.language ? tr.language.toUpperCase() : `Piste ${tr.index + 1}`)}</span>
                                <span className="text-[10px] text-slate-500 ml-1.5">
                                  ({tr.codec?.toUpperCase()}{tr.channels ? ` • ${tr.channels}ch` : ''})
                                </span>
                              </div>
                              {isTranscodingAudio && selectedAudioTrackIndex === tr.index && (
                                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Option persistante Toujours transcoder */}
                    <div className="pt-2 border-t border-white/5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                        <input
                          type="checkbox"
                          checked={preferTranscodeAudio}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setPreferTranscodeAudio(val);
                            localStorage.setItem('stremo_prefer_transcode_audio', String(val));
                            triggerOSD(val ? 'Toujours son AAC activé' : 'Toujours son AAC désactivé', '⚙️');
                          }}
                          className="rounded border-white/20 bg-slate-800 text-emerald-500 focus:ring-emerald-400 w-3.5 h-3.5"
                        />
                        <span>Toujours utiliser l'audio AAC (Recommandé Linux)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 relative">
              {/* Signets & Marqueurs personnels */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowBookmarkMenu(!showBookmarkMenu);
                    setShowAdjustMenu(false);
                    setShowSleepMenu(false);
                    setShowSpeedMenu(false);
                    setShowSubMenu(false);
                    setShowSkipMenu(false);
                    setShowStreamSelector(false);
                  }}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                    bookmarks.length > 0 || showBookmarkMenu
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title="Signets & Marqueurs de scène (Touche B)"
                >
                  <Bookmark className={`w-4 h-4 ${bookmarks.length > 0 ? 'fill-amber-400/40 text-amber-400' : ''}`} />
                  <span className="hidden sm:inline">
                    {bookmarks.length > 0 ? `Signets (${bookmarks.length})` : 'Signets'}
                  </span>
                </button>

                {showBookmarkMenu && (
                  <div className="absolute right-0 bottom-full mb-3 w-80 bg-[#111622] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-white/5">
                      <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                        <Bookmark className="w-3 h-3 text-amber-400" /> Signets & Marqueurs
                      </div>
                      <span className="text-[10px] font-mono text-amber-400">Touche B</span>
                    </div>

                    {/* Bouton rapide d'ajout au temps courant */}
                    <div className="space-y-1.5">
                      <button
                        onClick={() => handleAddBookmark()}
                        className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                      >
                        <BookmarkPlus className="w-4 h-4" />
                        <span>Marquer ce moment ({formatTime(currentTime)})</span>
                      </button>

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Titre ou note personnalisée..."
                          value={bookmarkCustomTitle}
                          onChange={(e) => setBookmarkCustomTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddBookmark();
                          }}
                          className="flex-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                        {bookmarkCustomTitle && (
                          <button
                            onClick={() => handleAddBookmark()}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold transition cursor-pointer"
                          >
                            Ajouter
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Liste des signets enregistrés */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase text-slate-400 flex items-center justify-between">
                        <span>Marqueurs enregistrés</span>
                        <span className="text-amber-400">{bookmarks.length}</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {bookmarks.length === 0 ? (
                          <div className="p-3 text-center rounded-xl bg-white/5 text-slate-400 text-xs">
                            Aucun signet. Appuyez sur <kbd className="px-1 py-0.5 rounded bg-white/10 text-amber-300 font-mono text-[10px]">B</kbd> pour mémoriser un passage culte.
                          </div>
                        ) : (
                          bookmarks.map((bm) => (
                            <div
                              key={bm.id}
                              className="w-full p-2 rounded-xl bg-white/5 hover:bg-white/10 transition flex items-center justify-between gap-2 group cursor-pointer"
                              onClick={() => handleJumpToBookmark(bm.time, bm.title)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  {formatTime(bm.time)}
                                </span>
                                <span className="text-xs text-slate-200 truncate font-medium">
                                  {bm.title || 'Signet'}
                                </span>
                              </div>
                              <button
                                onClick={(e) => handleDeleteBookmark(bm.id, e)}
                                className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition opacity-80 group-hover:opacity-100"
                                title="Supprimer ce signet"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Format d'image & Égaliseur Vidéo */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowAdjustMenu(!showAdjustMenu);
                    setShowBookmarkMenu(false);
                    setShowSleepMenu(false);
                    setShowSpeedMenu(false);
                    setShowSubMenu(false);
                    setShowSkipMenu(false);
                    setShowStreamSelector(false);
                  }}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                    aspectRatio !== 'contain' || brightness !== 100 || contrast !== 100 || saturation !== 100 || showAdjustMenu
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title="Format d'image & Égaliseur Vidéo (Touche A)"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden md:inline">Rendu</span>
                </button>

                {showAdjustMenu && (
                  <div className="absolute right-0 bottom-full mb-3 w-80 bg-[#111622] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 space-y-3">
                    {/* Ratio d'aspect */}
                    <div>
                      <div className="flex items-center justify-between pb-1 border-b border-white/5 mb-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">
                          Format d'image
                        </span>
                        <span className="text-[10px] font-mono text-indigo-400">Touche A</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {aspectRatios.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => handleSetAspectRatio(r.id)}
                            className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition text-left flex items-center justify-between cursor-pointer ${
                              aspectRatio === r.id
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300'
                            }`}
                          >
                            <span className="truncate">{r.label}</span>
                            {aspectRatio === r.id && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Préréglages d'image */}
                    <div className="pt-2 border-t border-white/5">
                      <div className="text-[10px] font-black uppercase text-slate-400 mb-1.5 flex items-center justify-between">
                        <span>Profils d'image</span>
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <button
                          onClick={() => handleApplyPreset(100, 100, 100, 'Standard')}
                          className="py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-left font-medium transition cursor-pointer"
                        >
                          Standard (Défaut)
                        </button>
                        <button
                          onClick={() => handleApplyPreset(90, 118, 95, 'Cinéma')}
                          className="py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-300 text-left font-medium transition cursor-pointer"
                        >
                          🎬 Cinéma Sombre
                        </button>
                        <button
                          onClick={() => handleApplyPreset(105, 112, 135, 'Éclatant')}
                          className="py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 text-left font-medium transition cursor-pointer"
                        >
                          ✨ Éclatant (Vivid)
                        </button>
                        <button
                          onClick={() => handleApplyPreset(100, 125, 0, 'Noir & Blanc')}
                          className="py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-left font-medium transition cursor-pointer"
                        >
                          📽️ Noir & Blanc
                        </button>
                      </div>
                    </div>

                    {/* Égaliseur manuel */}
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-400">Égaliseur d'image</span>
                        <button
                          onClick={handleResetAdjustments}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
                        >
                          Réinitialiser
                        </button>
                      </div>

                      {/* Luminosité */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span className="flex items-center gap-1"><Sun className="w-3 h-3" /> Luminosité</span>
                          <span className="font-mono text-indigo-300 font-bold">{brightness}%</span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={150}
                          value={brightness}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setBrightness(v);
                            localStorage.setItem('stremo_video_brightness', String(v));
                          }}
                          className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      {/* Contraste */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span className="flex items-center gap-1"><Contrast className="w-3 h-3" /> Contraste</span>
                          <span className="font-mono text-indigo-300 font-bold">{contrast}%</span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={150}
                          value={contrast}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setContrast(v);
                            localStorage.setItem('stremo_video_contrast', String(v));
                          }}
                          className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      {/* Saturation */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span className="flex items-center gap-1">🎨 Saturation</span>
                          <span className="font-mono text-indigo-300 font-bold">{saturation}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          value={saturation}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setSaturation(v);
                            localStorage.setItem('stremo_video_saturation', String(v));
                          }}
                          className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Minuteur de mise en veille (Sleep Timer) */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowSleepMenu(!showSleepMenu);
                    setShowBookmarkMenu(false);
                    setShowAdjustMenu(false);
                    setShowSpeedMenu(false);
                    setShowSubMenu(false);
                    setShowSkipMenu(false);
                    setShowStreamSelector(false);
                  }}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                    sleepTimerMinutes !== null
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title="Minuteur de mise en veille (Sleep Timer - Touche T)"
                >
                  <Timer className="w-4 h-4" />
                  {sleepRemainingSec !== null && sleepRemainingSec > 0 ? (
                    <span className="font-mono text-[11px] text-amber-300 font-bold hidden sm:inline">
                      {Math.floor(sleepRemainingSec / 60)}:{String(sleepRemainingSec % 60).padStart(2, '0')}
                    </span>
                  ) : sleepTimerMinutes === -1 ? (
                    <span className="text-[10px] text-amber-300 font-bold hidden sm:inline">Fin</span>
                  ) : null}
                </button>

                {showSleepMenu && (
                  <div className="absolute right-0 bottom-full mb-3 w-56 bg-[#111622] border border-white/10 rounded-2xl shadow-2xl p-2.5 z-50 space-y-1">
                    <div className="px-2.5 py-1 border-b border-white/5 flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                      <span>Minuteur de veille</span>
                      <span className="text-amber-400 font-mono">Touche T</span>
                    </div>
                    {[
                      { label: 'Désactivé', value: null },
                      { label: '15 minutes', value: 15 },
                      { label: '30 minutes', value: 30 },
                      { label: '45 minutes', value: 45 },
                      { label: '60 minutes', value: 60 },
                      { label: 'Fin de l’épisode', value: -1 },
                    ].map((opt) => (
                      <button
                        key={String(opt.value)}
                        onClick={() => handleSetSleepTimer(opt.value)}
                        className={`w-full p-2 rounded-xl text-left text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                          sleepTimerMinutes === opt.value
                            ? 'bg-amber-500/20 text-amber-300 font-bold'
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {sleepTimerMinutes === opt.value && (
                          <Check className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Playback Speed selector */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowSpeedMenu(!showSpeedMenu);
                    setShowSubMenu(false);
                    setShowSkipMenu(false);
                  }}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold ${
                    playbackRate !== 1
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title="Vitesse de lecture"
                >
                  <Gauge className="w-4 h-4" />
                  <span>{playbackRate}x</span>
                </button>

                {showSpeedMenu && (
                  <div className="absolute right-0 bottom-full mb-3 w-40 bg-[#111622] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 space-y-1">
                    <div className="px-3 py-1.5 border-b border-white/5 text-[10px] font-black uppercase text-slate-400">
                      Vitesse
                    </div>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => handleSetSpeed(spd)}
                        className={`w-full p-2 rounded-xl text-left text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                          playbackRate === spd
                            ? 'bg-indigo-600/20 text-indigo-300'
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>{spd}x {spd === 1 ? '(Normal)' : ''}</span>
                        {playbackRate === spd && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Menu Saut de génériques (Intro & Outro) */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowSkipMenu(!showSkipMenu);
                    setShowSpeedMenu(false);
                    setShowSubMenu(false);
                  }}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                    showSkipMenu || autoSkipOutro
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title="Réglages du saut de génériques (Intro & Fin)"
                >
                  <FastForward className="w-4 h-4" />
                  <span className="hidden sm:inline">Génériques</span>
                </button>

                {showSkipMenu && (
                  <div className="absolute right-0 bottom-full mb-3 w-72 bg-[#111622] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 space-y-3">
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center justify-between">
                        <span>Générique de fin (Outro)</span>
                        <span className="text-indigo-400 font-semibold">{skipOutroSec}s avant la fin</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-2">
                        Moment où commence le générique de fin pour passer à l'épisode suivant.
                      </p>
                      <div className="grid grid-cols-4 gap-1">
                        {[90, 75, 45, 20].map((sec) => (
                          <button
                            key={sec}
                            onClick={() => handleSetSkipOutroSec(sec)}
                            className={`py-1.5 px-1 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                              skipOutroSec === sec
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Saut automatique</span>
                        <span className="text-[11px] text-slate-400 block">Enchaîner dès le générique</span>
                      </div>
                      <button
                        onClick={handleToggleAutoSkipOutro}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          autoSkipOutro ? 'bg-indigo-600' : 'bg-white/20'
                        }`}
                        title={autoSkipOutro ? 'Désactiver le saut auto' : 'Activer le saut auto'}
                      >
                        <span
                          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            autoSkipOutro ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {/* Intro Skip Settings */}
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white block">Saut automatique d'intro</span>
                          <span className="text-[11px] text-slate-400 block">Sauter l'intro dès le début</span>
                        </div>
                        <button
                          onClick={handleToggleAutoSkipIntro}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            autoSkipIntro ? 'bg-indigo-600' : 'bg-white/20'
                          }`}
                          title={autoSkipIntro ? "Désactiver le saut d'intro auto" : "Activer le saut d'intro auto"}
                        >
                          <span
                            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              autoSkipIntro ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[45, 60, 85, 90].map((sec) => (
                          <button
                            key={sec}
                            onClick={() => handleSetIntroDurationSec(sec)}
                            className={`py-1 px-1 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                              introDurationSec === sec
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                            }`}
                          >
                            +{sec}s
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Proxy Web Anti-CORS */}
                    <div className="pt-2 border-t border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white block">Proxy Web (anti-CORS)</span>
                          <span className="text-[10px] text-slate-400 block">Contourne les restrictions CDN distantes</span>
                        </div>
                        <button
                          onClick={() => {
                            const next = !useStreamProxy;
                            setUseStreamProxy(next);
                            localStorage.setItem('stremo_use_stream_proxy', String(next));
                            setSkipToast(next ? "Proxy Web activé" : "Proxy Web désactivé");
                            setTimeout(() => setSkipToast(null), 2000);
                          }}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            useStreamProxy ? 'bg-indigo-600' : 'bg-white/20'
                          }`}
                        >
                          <span
                            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              useStreamProxy ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <div className="text-[10px] font-black uppercase text-slate-400">
                        Actions rapides
                      </div>
                      <button
                        onClick={() => {
                          handleSkipIntro();
                          setShowSkipMenu(false);
                        }}
                        className="w-full py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center justify-between cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <FastForward className="w-3.5 h-3.5 text-indigo-400" />
                          Sauter l'intro (+85s)
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Touche S</span>
                      </button>
                      {nextEpisode && onPlayNextEpisode && (
                        <button
                          onClick={() => {
                            handleSkipToNextEpisode();
                            setShowSkipMenu(false);
                          }}
                          className="w-full py-1.5 px-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-xs font-semibold text-indigo-300 hover:text-white transition flex items-center justify-between cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <SkipForward className="w-3.5 h-3.5 text-indigo-400" />
                            Passer au prochain épisode
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Touche N</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Subtitles & Delay Button */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowSubMenu(!showSubMenu);
                    setShowSpeedMenu(false);
                    setShowSkipMenu(false);
                  }}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                    selectedSub
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title="Sous-titres, synchronisation et import local"
                >
                  <Subtitles className="w-4 h-4" />
                  <span className="text-xs font-bold hidden sm:inline">Sous-titres</span>
                  {localSubtitles.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </button>

                {showSubMenu && (
                  <div className="absolute right-0 bottom-full mb-3 w-88 bg-[#0e131f] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 space-y-2.5 backdrop-blur-xl ring-1 ring-white/5">
                    {/* En-tête et onglets du menu */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-xl text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setSubTab('tracks')}
                          className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                            subTab === 'tracks'
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Subtitles className="w-3 h-3" />
                          <span>Pistes ({effectiveSubtitles.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubTab('style')}
                          className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                            subTab === 'style'
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Palette className="w-3 h-3" />
                          <span>Style</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowSubMenu(false)}
                        className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                        title="Fermer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Onglet 1 : Pistes & Langues */}
                    {subTab === 'tracks' && (
                      <div className="space-y-2">
                        {/* Recherche & Filtres par langue */}
                        {effectiveSubtitles.length > 3 && (
                          <div className="space-y-1.5">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Filtrer les langues..."
                                value={subSearchQuery}
                                onChange={(e) => setSubSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>

                            {/* Puces de langues */}
                            {subtitleGroups.length > 1 && (
                              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setSubActiveLangFilter('all')}
                                  className={`px-2 py-0.5 rounded-full shrink-0 font-bold transition cursor-pointer ${
                                    subActiveLangFilter === 'all'
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-white/5 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  Tous ({effectiveSubtitles.length})
                                </button>
                                {subtitleGroups.map((g) => (
                                  <button
                                    key={g.code}
                                    type="button"
                                    onClick={() => setSubActiveLangFilter(g.code)}
                                    className={`px-2 py-0.5 rounded-full shrink-0 font-bold transition cursor-pointer flex items-center gap-1 ${
                                      subActiveLangFilter === g.code
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white/5 text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    <span>{g.flag}</span>
                                    <span>{g.label}</span>
                                    <span className="opacity-70">({g.tracks.length})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Liste déroulante des pistes */}
                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                          {/* Option Désactiver */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSub(null);
                              setShowSubMenu(false);
                            }}
                            className={`w-full p-2 rounded-xl text-left text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                              selectedSub === null
                                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <span>Désactivés (Aucun sous-titre)</span>
                            {selectedSub === null && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                          </button>

                          {effectiveSubtitles.length === 0 ? (
                            <div className="p-3 my-1 bg-white/5 rounded-xl text-center space-y-1">
                              <div className="text-xs text-slate-300 font-semibold">Aucune piste trouvée</div>
                              <div className="text-[10px] text-slate-400">
                                Importez un fichier .srt ou .vtt ci-dessous.
                              </div>
                            </div>
                          ) : (
                            subtitleGroups
                              .filter((g) => subActiveLangFilter === 'all' || g.code === subActiveLangFilter)
                              .map((group) => {
                                const matchingTracks = group.tracks.filter((t) => {
                                  if (!subSearchQuery.trim()) return true;
                                  const q = subSearchQuery.toLowerCase();
                                  return (
                                    t.lang.toLowerCase().includes(q) ||
                                    group.label.toLowerCase().includes(q) ||
                                    (t.addonName || '').toLowerCase().includes(q)
                                  );
                                });

                                if (matchingTracks.length === 0) return null;

                                return (
                                  <div key={group.code} className="pt-1">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 py-0.5 flex items-center gap-1.5">
                                      <span>{group.flag}</span>
                                      <span>{group.label}</span>
                                      <span className="text-[9px] text-slate-400 font-normal">
                                        ({matchingTracks.length})
                                      </span>
                                    </div>

                                    {matchingTracks.map((sub) => {
                                      const info = getLanguageInfo(sub.lang);
                                      return (
                                        <div
                                          key={sub.id}
                                          className={`w-full p-1.5 rounded-xl text-left text-xs font-semibold transition flex items-center justify-between group my-0.5 ${
                                            selectedSub === sub.id
                                              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                              : 'text-slate-300 hover:bg-white/5'
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedSub(sub.id);
                                              setShowSubMenu(false);
                                            }}
                                            className="flex-1 flex items-center gap-2 text-left truncate cursor-pointer"
                                          >
                                            <span className="text-sm shrink-0">{info.flag}</span>
                                            <div className="truncate flex-1 min-w-0">
                                              <span className="text-xs block truncate" title={sub.lang}>
                                                {info.cleanName}
                                              </span>
                                              <span className="text-[9px] text-slate-400 block truncate">
                                                {sub.isLocal ? 'Fichier importé' : sub.addonName || 'OpenSubtitles'}
                                              </span>
                                            </div>

                                            {info.isForced && (
                                              <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[8px] font-black uppercase">
                                                Forcé
                                              </span>
                                            )}
                                            {info.isSdh && (
                                              <span className="px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[8px] font-black uppercase">
                                                SDH
                                              </span>
                                            )}
                                            {sub.isLocal && (
                                              <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[8px] font-black uppercase">
                                                Local
                                              </span>
                                            )}
                                          </button>

                                          <div className="flex items-center gap-1 shrink-0 ml-1">
                                            {sub.isLocal && (
                                              <button
                                                type="button"
                                                onClick={(e) => handleRemoveLocalSub(sub.id, e)}
                                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                                                title="Supprimer ce sous-titre local"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            )}
                                            {selectedSub === sub.id && (
                                              <Check className="w-3.5 h-3.5 text-indigo-400 ml-1" />
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })
                          )}
                        </div>

                        {/* Import manuel de sous-titres locaux */}
                        <div className="pt-2 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-1.5 px-2.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 hover:text-white border border-indigo-500/25 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Importer un fichier (.srt, .vtt)</span>
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".srt,.vtt"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleImportSubtitleFile(file);
                                e.target.value = '';
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Onglet 2 : Style & Apparence */}
                    {subTab === 'style' && (
                      <div className="space-y-3 pt-1">
                        {/* Taille */}
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                            Taille du texte
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {[
                              { id: 'sm', label: 'Petite' },
                              { id: 'normal', label: 'Normale' },
                              { id: 'lg', label: 'Grande' },
                              { id: 'xl', label: 'Maxi' },
                            ].map((sz) => (
                              <button
                                key={sz.id}
                                type="button"
                                onClick={() => {
                                  setSubSize(sz.id as any);
                                  localStorage.setItem('stremo_sub_size', sz.id);
                                }}
                                className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition cursor-pointer text-center ${
                                  subSize === sz.id
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                                }`}
                              >
                                {sz.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Couleur */}
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                            Couleur du texte
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: 'white', label: 'Blanc', colorClass: 'bg-white text-slate-900' },
                              { id: 'yellow', label: 'Jaune Cinéma 🎬', colorClass: 'bg-amber-300 text-amber-950' },
                              { id: 'cyan', label: 'Cyan', colorClass: 'bg-cyan-300 text-cyan-950' },
                            ].map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSubColor(c.id as any);
                                  localStorage.setItem('stremo_sub_color', c.id);
                                }}
                                className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition cursor-pointer text-center border ${
                                  subColor === c.id
                                    ? 'border-indigo-400 bg-indigo-600/20 text-white'
                                    : 'border-white/5 bg-white/5 hover:bg-white/10 text-slate-300'
                                }`}
                              >
                                <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle ${c.colorClass}`} />
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Arrière-plan */}
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                            Arrière-plan & Contraste
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {[
                              { id: 'none', label: 'Ombre seule' },
                              { id: 'translucent', label: 'Translucide' },
                              { id: 'solid', label: 'Boîte opaque' },
                            ].map((bg) => (
                              <button
                                key={bg.id}
                                type="button"
                                onClick={() => {
                                  setSubBg(bg.id as any);
                                  localStorage.setItem('stremo_sub_bg', bg.id);
                                }}
                                className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition cursor-pointer text-center ${
                                  subBg === bg.id
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                                }`}
                              >
                                {bg.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Décalage temporel / Synchronisation */}
                        <div className="pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                              <Sliders className="w-3 h-3" /> Synchronisation
                            </span>
                            <span className="text-xs font-bold text-indigo-300">
                              {subDelay > 0 ? `+${subDelay}s` : `${subDelay}s`}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustSubDelay(-0.5)}
                              className="py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-300 hover:text-white transition cursor-pointer text-center"
                            >
                              -0.5s
                            </button>
                            <button
                              type="button"
                              onClick={handleResetSubDelay}
                              className="py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-400 hover:text-white transition cursor-pointer text-center"
                            >
                              0s (Reset)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustSubDelay(0.5)}
                              className="py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-300 hover:text-white transition cursor-pointer text-center"
                            >
                              +0.5s
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sélecteur de fichiers vidéo internes du torrent (ex: pack saison séries) */}
              {torrentStats?.files && torrentStats.files.filter((f) => f.isVideo).length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowTorrentFilesMenu(!showTorrentFilesMenu);
                      setShowStreamSelector(false);
                      setShowSubMenu(false);
                      setShowSpeedMenu(false);
                      setShowSkipMenu(false);
                    }}
                    className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                      showTorrentFilesMenu
                        ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                    title="Choisir un épisode / fichier vidéo dans ce torrent"
                  >
                    <Film className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold hidden md:inline">
                      Épisodes Torrent ({torrentStats.files.filter((f) => f.isVideo).length})
                    </span>
                  </button>

                  {showTorrentFilesMenu && (
                    <div className="absolute right-0 bottom-full mb-3 w-84 bg-[#111622] border border-cyan-500/30 rounded-2xl shadow-2xl p-3 z-50 space-y-2">
                      <div className="text-[10px] font-black uppercase text-cyan-400 mb-1 flex items-center justify-between">
                        <span>Fichiers du torrent</span>
                        <span className="text-slate-400 font-normal">
                          {torrentStats.files.filter((f) => f.isVideo).length} vidéos
                        </span>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                        {torrentStats.files
                          .filter((f) => f.isVideo)
                          .map((file) => {
                            const isCurrent = selectedTorrentFileIndex === file.index;
                            return (
                              <button
                                key={file.index}
                                onClick={() => handleSelectTorrentFile(file.index, file.name)}
                                className={`w-full p-2.5 rounded-xl text-left transition cursor-pointer flex items-center justify-between gap-2 border ${
                                  isCurrent
                                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200'
                                    : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-bold truncate">{file.name}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {(file.length / (1024 * 1024)).toFixed(0)} Mo
                                  </p>
                                </div>
                                {isCurrent && (
                                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sélecteur de flux alternatifs en cours de lecture */}
              {availableStreams && availableStreams.length > 1 && onSelectStream && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowStreamSelector(!showStreamSelector);
                      setShowSubMenu(false);
                      setShowSpeedMenu(false);
                      setShowSkipMenu(false);
                    }}
                    className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                      showStreamSelector
                        ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                    title="Changer de flux vidéo sans quitter le lecteur"
                  >
                    <Layers className="w-4 h-4" />
                    <span className="text-xs font-bold hidden md:inline">Flux ({availableStreams.length})</span>
                  </button>

                  {showStreamSelector && (
                    <div className="absolute right-0 bottom-full mb-3 w-80 bg-[#111622] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 space-y-2">
                      <div className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center justify-between">
                        <span>Flux alternatifs</span>
                        <span className="text-indigo-400 font-semibold">{availableStreams.length} flux</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                        {availableStreams.filter((s) => !!s.url).map((s, idx) => {
                          const isCurrent = s.url === streamUrl;
                          const parsed = parseStream(s);
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setShowStreamSelector(false);
                                if (!isCurrent) {
                                  onSelectStream(s);
                                }
                              }}
                              className={`w-full p-2 rounded-xl text-left transition flex items-center justify-between cursor-pointer border ${
                                isCurrent
                                  ? 'bg-indigo-600/20 text-white border-indigo-500/40'
                                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-transparent'
                              }`}
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    {parsed.resolutionLabel}
                                  </span>
                                  {parsed.cached && (
                                    <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                                      ⚡ {parsed.debrid || 'Debrid'}
                                    </span>
                                  )}
                                  {parsed.sizeLabel && (
                                    <span className="text-[10px] text-slate-400">
                                      {parsed.sizeLabel}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-medium truncate">
                                  {s.name || parsed.provider}
                                </div>
                              </div>
                              {isCurrent && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Google Cast / AirPlay */}
              <button
                onClick={handleCast}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Diffuser sur TV (Google Cast / AirPlay)"
              >
                <Cast className="w-4 h-4 text-slate-300 hover:text-indigo-400" />
              </button>

              {/* Native Picture-in-Picture */}
              <button
                onClick={togglePiP}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Picture-in-Picture (PiP)"
              >
                <PictureInPicture2 className="w-4 h-4" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Plein écran (F)"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
