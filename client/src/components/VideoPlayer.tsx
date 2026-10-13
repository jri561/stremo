import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { api, type StreamSource } from '../api';
import { getAndroidIntentUrl } from '../players';
import {
  isOutroCreditsDetected,
  shouldAutoSkipIntro,
  getIntroTargetTime,
  getNextFallbackStream,
  parseStream,
  detectStreamAudioLanguage,
  matchSmartSubtitle,
} from '../streams';

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
  subtitles?: { id: string; lang: string; url: string; addonName?: string }[];
  initialTime?: number;
  nextEpisode?: NextEpisodeInfo | null;
  profileId?: string;
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
  const [subSize, setSubSize] = useState<'normal' | 'lg' | 'xl'>('normal');

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
      const matchingSub = subtitles[i];
      if (matchingSub && matchingSub.id === selectedSub) {
        track.mode = 'showing';
      } else {
        track.mode = 'disabled';
      }
    }
  }, [selectedSub, subtitles]);

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
    setPlaybackError(null);
    setFallbackStream(null);
    setFallbackCountdown(null);
    hasAutoSkippedIntroRef.current = false;
    setBuffering(true);

    const effectiveStreamUrl = useStreamProxy ? api.getProxiedStreamUrl(streamUrl) : streamUrl;
    triedProxyRef.current = useStreamProxy;

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
        // Tentative automatique de fallback sur le proxy local (contourne les erreurs CORS des CDN)
        if (!triedProxyRef.current && !streamUrl.includes('/api/proxy/stream')) {
          triedProxyRef.current = true;
          const proxied = api.getProxiedStreamUrl(streamUrl);
          setSkipToast("Contournement CORS : bascule sur le proxy local...");
          video.src = proxied;
          video.load();
          video.play().catch(() => {});
          return;
        }
        triggerPlaybackError('Format vidéo ou codec audio (ex: DTS / AC3 / HEVC) non décodable directement dans ce navigateur.');
      };
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [streamUrl, initialTime]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(curr);
    setDuration(dur);
    if (onProgress && Math.floor(curr) % 5 === 0) {
      onProgress(curr, dur);
    }

    // Saut précis AniSkip si disponible, sinon heuristique
    if (exactSkip?.intro && autoSkipIntro && !hasAutoSkippedIntroRef.current) {
      if (curr >= exactSkip.intro.start && curr < exactSkip.intro.end) {
        hasAutoSkippedIntroRef.current = true;
        if (videoRef.current) {
          videoRef.current.currentTime = exactSkip.intro.end;
          setSkipToast("Opening sauté automatiquement (AniSkip) ⏭️");
          setTimeout(() => setSkipToast(null), 2500);
        }
      }
    } else if (
      (isSeries || mediaInfo?.type === 'episode') &&
      autoSkipIntro &&
      !hasAutoSkippedIntroRef.current &&
      shouldAutoSkipIntro(curr, dur, autoSkipIntro)
    ) {
      hasAutoSkippedIntroRef.current = true;
      const targetTime = getIntroTargetTime(curr, dur, introDurationSec);
      if (videoRef.current) {
        videoRef.current.currentTime = targetTime;
        setSkipToast(`Intro sautée automatiquement (+${introDurationSec}s) ⏭️`);
        setTimeout(() => setSkipToast(null), 2500);
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
  };

  const handleSkipIntro = () => {
    if (!videoRef.current) return;
    const skipAmount = 85;
    videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + skipAmount);
    setSkipToast("Intro sautée (+85s)");
    setTimeout(() => setSkipToast(null), 1800);
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
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skip(-10);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        skip(10);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
          setIsMuted(false);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
        }
      } else if (e.key === 'm') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
          setIsMuted(videoRef.current.muted);
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
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration]);

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      <video
        ref={videoRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        crossOrigin="anonymous"
        playsInline
      >
        {subtitles.map((sub) => (
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
      <style>{`
        video::cue {
          font-size: ${subSize === 'xl' ? '1.8rem' : subSize === 'lg' ? '1.4rem' : '1.1rem'} !important;
          background: rgba(0, 0, 0, 0.75) !important;
          color: #ffffff !important;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9) !important;
          border-radius: 4px;
          padding: 2px 8px;
        }
      `}</style>

      {/* Toast d'action éphémère */}
      {skipToast && (
        <div className="absolute top-20 inset-x-0 mx-auto w-fit z-50 px-4 py-2 bg-indigo-600/95 text-white rounded-xl backdrop-blur-md shadow-2xl font-bold text-xs flex items-center gap-2 animate-fade-in pointer-events-none ring-1 ring-white/20">
          <FastForward className="w-4 h-4 text-white" />
          <span>{skipToast}</span>
        </div>
      )}

      {/* Bouton Flottant : Passer l'intro (+85s) */}
      {currentTime >= 10 && currentTime <= 240 && duration > 200 && nextCountdown === null && (
        <button
          onClick={handleSkipIntro}
          className="absolute bottom-24 right-6 sm:right-8 z-40 px-4 py-2.5 rounded-2xl bg-[#111622]/90 hover:bg-[#182135] text-white border border-white/20 hover:border-indigo-400 backdrop-blur-md text-xs font-bold shadow-2xl transition flex items-center gap-2 cursor-pointer group pointer-events-auto"
          title="Passer le générique d'ouverture (Raccourci : S)"
        >
          <FastForward className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition" />
          <span>Passer l'intro</span>
          <span className="text-[10px] text-slate-400 bg-white/10 px-1.5 py-0.5 rounded font-mono">+85s</span>
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
          {/* Progress Slider */}
          <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 bg-white/20 hover:bg-white/30 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition"
            />
            <span>{formatTime(duration)}</span>
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
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 relative">
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
                    {[0.75, 1, 1.25, 1.5, 2].map((spd) => (
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
              {subtitles.length > 0 && (
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
                    title="Sous-titres et synchronisation"
                  >
                    <Subtitles className="w-4 h-4" />
                    <span className="text-xs font-bold hidden sm:inline">Sous-titres</span>
                  </button>

                  {showSubMenu && (
                    <div className="absolute right-0 bottom-full mb-3 w-72 bg-[#111622] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 space-y-3">
                      <div>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1.5">
                          Pistes de sous-titres
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                          <button
                            onClick={() => {
                              setSelectedSub(null);
                              setShowSubMenu(false);
                            }}
                            className={`w-full p-1.5 rounded-xl text-left text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                              selectedSub === null
                                ? 'bg-indigo-600/20 text-indigo-300'
                                : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <span>Désactivés</span>
                            {selectedSub === null && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                          </button>

                          {subtitles.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => {
                                setSelectedSub(sub.id);
                                setShowSubMenu(false);
                              }}
                              className={`w-full p-1.5 rounded-xl text-left text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                                selectedSub === sub.id
                                  ? 'bg-indigo-600/20 text-indigo-300'
                                  : 'text-slate-300 hover:bg-white/5'
                              }`}
                            >
                              <span className="capitalize truncate max-w-[190px]">
                                {sub.lang} ({sub.addonName || 'OpenSubtitles'})
                              </span>
                              {selectedSub === sub.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Synchronisation / Décalage */}
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
                            onClick={() => handleAdjustSubDelay(-0.5)}
                            className="py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-300 hover:text-white transition cursor-pointer text-center"
                          >
                            -0.5s
                          </button>
                          <button
                            onClick={handleResetSubDelay}
                            className="py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-400 hover:text-white transition cursor-pointer text-center"
                          >
                            0s (Reset)
                          </button>
                          <button
                            onClick={() => handleAdjustSubDelay(0.5)}
                            className="py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-300 hover:text-white transition cursor-pointer text-center"
                          >
                            +0.5s
                          </button>
                        </div>
                      </div>

                      {/* Taille des sous-titres */}
                      <div className="pt-2 border-t border-white/5">
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1.5">
                          Taille du texte
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {(['normal', 'lg', 'xl'] as const).map((sz) => (
                            <button
                              key={sz}
                              onClick={() => setSubSize(sz)}
                              className={`py-1 px-1 rounded-lg text-[11px] font-bold transition cursor-pointer text-center ${
                                subSize === sz
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                              }`}
                            >
                              {sz === 'normal' ? 'Normal' : sz === 'lg' ? 'Grand' : 'Maxi'}
                            </button>
                          ))}
                        </div>
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
