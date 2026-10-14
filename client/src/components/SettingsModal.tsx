import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Volume2,
  Subtitles,
  FastForward,
  Play,
  Monitor,
  Check,
  Palette,
  Layers,
  Sparkles,
  Info,
  Sliders,
  Headphones,
  Tv,
  Radio,
  Gamepad2,
} from 'lucide-react';
import type { Profile } from '../api';
import { generateSubtitleCss, type SubtitleStyleSettings } from '../subtitles';
import { cecRemote, CEC_PROFILES, type CecCommand } from '../services/cecRemote';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeProfile: Profile;
  onUpdateProfile: (
    id: string,
    updates: {
      name: string;
      avatar: string;
      isKids: boolean;
      pin?: string | null;
      preferredAudioLanguage?: string;
      preferredSubtitleLanguage?: string;
      subtitleMode?: string;
    }
  ) => Promise<void>;
  defaultPlayer: string;
  onSelectPlayer: (player: any) => void;
  isTvMode?: boolean;
  onToggleTvMode?: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  activeProfile,
  onUpdateProfile,
  defaultPlayer,
  onSelectPlayer,
  isTvMode,
  onToggleTvMode,
}) => {
  const [activeTab, setActiveTab] = useState<'audio_subs' | 'playback' | 'interface' | 'remote_cec'>('audio_subs');

  // Télécommande & HDMI-CEC
  const [cecEnabled, setCecEnabled] = useState<boolean>(() => cecRemote.isCecEnabled());
  const [cecProfileId, setCecProfileId] = useState<string>(() => cecRemote.getActiveProfile().id);
  const [cecOsd, setCecOsd] = useState<boolean>(() => cecRemote.isOsdFeedbackEnabled());
  const [lastCecCommand, setLastCecCommand] = useState<CecCommand | null>(() => cecRemote.getLastCommand());
  const [cecHardwareStatus, setCecHardwareStatus] = useState<{ available: boolean; adapterPath: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/hardware/cec/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCecHardwareStatus({ available: data.available, adapterPath: data.adapterPath });
        }
      })
      .catch(() => {});

    const unsubscribe = cecRemote.subscribe((cmd) => {
      setLastCecCommand(cmd);
    });
    return () => unsubscribe();
  }, []);

  // Audio & Sous-titres
  const [audioLang, setAudioLang] = useState<string>(activeProfile.preferredAudioLanguage || 'fra');
  const [subLang, setSubLang] = useState<string>(activeProfile.preferredSubtitleLanguage || 'fra');
  const [subMode, setSubMode] = useState<string>(activeProfile.subtitleMode || 'foreign_only');

  // Styles de sous-titres
  const [subSize, setSubSize] = useState<SubtitleStyleSettings['size']>(() => {
    return (localStorage.getItem('stremo_sub_size') as any) || 'normal';
  });
  const [subColor, setSubColor] = useState<SubtitleStyleSettings['color']>(() => {
    return (localStorage.getItem('stremo_sub_color') as any) || 'white';
  });
  const [subBg, setSubBg] = useState<SubtitleStyleSettings['background']>(() => {
    return (localStorage.getItem('stremo_sub_bg') as any) || 'translucent';
  });

  // Saut d'intro et Binge-watching
  const [autoSkipIntro, setAutoSkipIntro] = useState<boolean>(() => {
    return localStorage.getItem('stremo_auto_skip_intro') !== 'false';
  });
  const [introDurationSec, setIntroDurationSec] = useState<number>(() => {
    const saved = localStorage.getItem('stremo_intro_duration_sec');
    return saved ? Number(saved) : 80;
  });
  const [autoSkipOutro, setAutoSkipOutro] = useState<boolean>(() => {
    return localStorage.getItem('stremo_auto_skip_outro') !== 'false';
  });
  const [skipOutroSec, setSkipOutroSec] = useState<number>(() => {
    const saved = localStorage.getItem('stremo_skip_outro_sec');
    return saved ? Number(saved) : 75;
  });

  // Proxy de streaming
  const [useStreamProxy, setUseStreamProxy] = useState<boolean>(() => {
    return localStorage.getItem('stremo_use_stream_proxy') === 'true';
  });

  // Compatibilité audio maximale (Transcodage AAC universel)
  const [preferTranscodeAudio, setPreferTranscodeAudio] = useState<boolean>(() => {
    return localStorage.getItem('stremo_prefer_transcode_audio') === 'true';
  });

  const [savingToast, setSavingToast] = useState(false);

  if (!isOpen) return null;

  const handleSavePreferences = async () => {
    // 1. Sauvegarde dans le profil SQLite distant
    await onUpdateProfile(activeProfile.id, {
      name: activeProfile.name,
      avatar: activeProfile.avatar,
      isKids: activeProfile.isKids === 1,
      pin: activeProfile.pin,
      preferredAudioLanguage: audioLang,
      preferredSubtitleLanguage: subLang,
      subtitleMode: subMode,
    });

    // 2. Persistance locale instantanée
    localStorage.setItem('stremo_pref_audio_lang', audioLang);
    localStorage.setItem('stremo_pref_sub_lang', subLang);
    localStorage.setItem('stremo_pref_sub_mode', subMode);
    localStorage.setItem('stremo_sub_size', subSize);
    localStorage.setItem('stremo_sub_color', subColor);
    localStorage.setItem('stremo_sub_bg', subBg);
    localStorage.setItem('stremo_auto_skip_intro', String(autoSkipIntro));
    localStorage.setItem('stremo_intro_duration_sec', String(introDurationSec));
    localStorage.setItem('stremo_auto_skip_outro', String(autoSkipOutro));
    localStorage.setItem('stremo_skip_outro_sec', String(skipOutroSec));
    localStorage.setItem('stremo_use_stream_proxy', String(useStreamProxy));
    localStorage.setItem('stremo_prefer_transcode_audio', String(preferTranscodeAudio));

    // Persistance Télécommande & HDMI-CEC
    cecRemote.setCecEnabled(cecEnabled);
    cecRemote.setActiveProfile(cecProfileId);
    cecRemote.setOsdFeedbackEnabled(cecOsd);
    fetch('/api/hardware/cec/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: cecProfileId }),
    }).catch(() => {});

    setSavingToast(true);
    setTimeout(() => {
      setSavingToast(false);
      onClose();
    }, 800);
  };

  const previewCss = generateSubtitleCss({
    size: subSize,
    color: subColor,
    background: subBg,
  });

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[100] animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0e121a] border border-white/10 rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Style injecté pour l'aperçu du sous-titre */}
        <style>{previewCss.replace(/video::cue/g, '.preview-subtitle-cue')}</style>

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Paramètres de l'application</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {activeProfile.name}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Langues, esthétique des sous-titres et lecture intelligente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Onglets */}
        <div className="flex border-b border-white/5 bg-white/[0.01] px-5 gap-2 shrink-0">
          {[
            { id: 'audio_subs', label: 'Audio & Sous-titres', icon: <Subtitles className="w-4 h-4" /> },
            { id: 'playback', label: 'Lecture & Intros', icon: <FastForward className="w-4 h-4" /> },
            { id: 'interface', label: 'Lecteur & App', icon: <Monitor className="w-4 h-4" /> },
            { id: 'remote_cec', label: 'Télécommande & CEC', icon: <Tv className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Onglet 1 : Audio & Sous-titres */}
          {activeTab === 'audio_subs' && (
            <div className="space-y-6">
              {/* Choix des langues audio et sous-titres par défaut */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Langue audio principale</span>
                  </label>
                  <select
                    value={audioLang}
                    onChange={(e) => setAudioLang(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#141923] border border-white/10 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="fra">🇫🇷 Français (VF / Doublage)</option>
                    <option value="eng">🇬🇧 Anglais (VO)</option>
                    <option value="jpn">🇯🇵 Japonais (Anime)</option>
                    <option value="spa">🇪🇸 Espagnol</option>
                    <option value="deu">🇩🇪 Allemand</option>
                    <option value="ita">🇮🇹 Italien</option>
                    <option value="por">🇵🇹 Portugais</option>
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Stremo privilégiera automatiquement les flux disponibles dans cette langue.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Subtitles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Langue des sous-titres par défaut</span>
                  </label>
                  <select
                    value={subLang}
                    onChange={(e) => setSubLang(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#141923] border border-white/10 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="fra">🇫🇷 Français</option>
                    <option value="eng">🇬🇧 Anglais</option>
                    <option value="spa">🇪🇸 Espagnol</option>
                    <option value="jpn">🇯🇵 Japonais</option>
                    <option value="deu">🇩🇪 Allemand</option>
                    <option value="ita">🇮🇹 Italien</option>
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Piste linguistique qui sera sélectionnée pour ce profil.
                  </p>
                </div>
              </div>

              {/* Règle intelligente d'activation automatique */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Comportement d'activation automatique
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'foreign_only',
                      label: '💬 Intelligent (VOSTFR)',
                      desc: 'Active les sous-titres seulement si l’audio est en langue étrangère (masqués en VF).',
                    },
                    {
                      id: 'always',
                      label: '✅ Toujours actifs',
                      desc: 'Affiche toujours les sous-titres, quelle que soit la langue audio.',
                    },
                    {
                      id: 'off',
                      label: '❌ Désactivés',
                      desc: 'Ne met aucun sous-titre automatiquement par défaut.',
                    },
                  ].map((mode) => (
                    <button
                      type="button"
                      key={mode.id}
                      onClick={() => setSubMode(mode.id)}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        subMode === mode.id
                          ? 'border-indigo-500 bg-indigo-500/15 font-bold text-white ring-1 ring-indigo-500/40'
                          : 'border-white/5 bg-white/5 hover:border-white/10 text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold text-white mb-1">{mode.label}</div>
                      <div className="text-[10px] text-slate-400 leading-relaxed">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personnalisation du style & rendu visuel */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Esthétique & Style visuel des sous-titres</span>
                  </div>
                  <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                    Rendu Cinéma
                  </span>
                </div>

                {/* Cadre d'aperçu en direct */}
                <div className="relative h-24 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-white/10 flex items-center justify-center overflow-hidden shadow-inner p-2">
                  <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
                  <span className="preview-subtitle-cue relative z-10 select-none">
                    Exemple de sous-titre de haute qualité dans Stremo
                  </span>
                </div>

                {/* Options : Taille, Couleur, Fond */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5">Taille</label>
                    <div className="grid grid-cols-4 gap-1">
                      {(['sm', 'normal', 'lg', 'xl'] as const).map((sz) => (
                        <button
                          type="button"
                          key={sz}
                          onClick={() => setSubSize(sz)}
                          className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition cursor-pointer text-center ${
                            subSize === sz
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white/5 hover:bg-white/10 text-slate-400'
                          }`}
                        >
                          {sz === 'sm' ? 'Fin' : sz === 'normal' ? 'Std' : sz === 'lg' ? 'Grand' : 'Max'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5">Couleur</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'white', label: 'Blanc', dot: 'bg-white' },
                        { id: 'yellow', label: 'Jaune 🎬', dot: 'bg-amber-300' },
                        { id: 'cyan', label: 'Cyan', dot: 'bg-cyan-300' },
                      ].map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => setSubColor(c.id as any)}
                          className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition cursor-pointer text-center flex items-center justify-center gap-1 ${
                            subColor === c.id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white/5 hover:bg-white/10 text-slate-400'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5">Arrière-plan</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'none', label: 'Ombre' },
                        { id: 'translucent', label: 'Translucide' },
                        { id: 'solid', label: 'Opaque' },
                      ].map((bg) => (
                        <button
                          type="button"
                          key={bg.id}
                          onClick={() => setSubBg(bg.id as any)}
                          className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition cursor-pointer text-center ${
                            subBg === bg.id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white/5 hover:bg-white/10 text-slate-400'
                          }`}
                        >
                          {bg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Onglet 2 : Lecture & Intros intelligentes */}
          {activeTab === 'playback' && (
            <div className="space-y-6">
              {/* Saut d'intro intelligent */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FastForward className="w-4 h-4 text-indigo-400" />
                      <span>Saut d'intro intelligent & adaptatif</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Adapte la durée selon le type d'œuvre : Anime (90s standard japonais), Sitcoms (25s), Séries dramatiques (80s).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoSkipIntro(!autoSkipIntro)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      autoSkipIntro ? 'bg-indigo-600' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        autoSkipIntro ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300">
                      Durée par défaut pour séries standards
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Utilisée quand aucun timecode exact AniSkip n'est répertorié.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={15}
                      max={120}
                      step={5}
                      value={introDurationSec}
                      onChange={(e) => setIntroDurationSec(Number(e.target.value))}
                      className="flex-1 accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />
                    <span className="font-mono text-xs font-bold text-indigo-300 w-12 text-right">
                      +{introDurationSec}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Générique de fin & Binge-Watching */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>Enchaînement automatique (Binge-Watching)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Propose et lance l'épisode suivant dès le début du générique de fin.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoSkipOutro(!autoSkipOutro)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      autoSkipOutro ? 'bg-indigo-600' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        autoSkipOutro ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300">
                      Début du générique de fin
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Temps restant avant la fin de l'épisode pour afficher le bandeau suivant.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={30}
                      max={150}
                      step={5}
                      value={skipOutroSec}
                      onChange={(e) => setSkipOutroSec(Number(e.target.value))}
                      className="flex-1 accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />
                    <span className="font-mono text-xs font-bold text-indigo-300 w-12 text-right">
                      -{skipOutroSec}s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Onglet 3 : Lecteur & Application */}
          {activeTab === 'interface' && (
            <div className="space-y-6">
              {/* Choix du lecteur vidéo par défaut */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Lecteur vidéo par défaut</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'integrated',
                      label: 'Stremo Web (Recommandé)',
                      desc: 'Lecteur direct HTML5 dans votre navigateur ou PWA.',
                    },
                    {
                      id: 'vlc',
                      label: 'VLC Media Player',
                      desc: 'Ouvre l’application VLC installée sur votre ordinateur ou box.',
                    },
                    {
                      id: 'justplayer',
                      label: 'Just Player / Android TV',
                      desc: 'Idéal pour le décodage matériel natif sur TV et smartphones.',
                    },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => onSelectPlayer(p.id)}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        defaultPlayer === p.id
                          ? 'border-indigo-500 bg-indigo-500/15 font-bold text-white ring-1 ring-indigo-500/40'
                          : 'border-white/5 bg-white/5 hover:border-white/10 text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold text-white mb-1">{p.label}</div>
                      <div className="text-[10px] text-slate-400 leading-relaxed">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode TV / Salon */}
              {onToggleTvMode && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-indigo-400" />
                      <span>Interface Mode Salon / Téléviseur</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Agrandit les tuiles et active la navigation fluide pour télécommande D-Pad.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleTvMode}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      isTvMode ? 'bg-indigo-600' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        isTvMode ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Proxy de streaming local */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>Proxy de streaming local (Anti-CORS)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Relaye les flux distants bloqués par les restrictions du navigateur.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUseStreamProxy(!useStreamProxy)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    useStreamProxy ? 'bg-cyan-600' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      useStreamProxy ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Compatibilité Audio Maximale (Transcodage AAC Stéréo) */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Headphones className="w-4 h-4 text-emerald-400" />
                    <span>Compatibilité Audio Maximale (Son Universel AAC)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Convertit automatiquement l'audio haute fidélité (AC3, DTS, TrueHD) en AAC stéréo universel. Recommandé sur Linux si vous n'entendez aucun son sur certains films.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreferTranscodeAudio(!preferTranscodeAudio)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    preferTranscodeAudio ? 'bg-emerald-600' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      preferTranscodeAudio ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Onglet 4 : Télécommande & Matériel HDMI-CEC */}
          {activeTab === 'remote_cec' && (
            <div className="space-y-6">
              {/* Statut matériel du contrôleur HDMI-CEC */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-lg ${
                      cecHardwareStatus?.available ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'
                    }`}
                  >
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Contrôleur HDMI-CEC</h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          cecHardwareStatus?.available ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-300'
                        }`}
                      >
                        {cecHardwareStatus?.available ? 'Matériel Détecté' : 'Émulation Active (Web / Smart TV)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {cecHardwareStatus?.adapterPath
                        ? `Périphérique : ${cecHardwareStatus.adapterPath}`
                        : 'Compatible télécommandes TV (Samsung Anynet+, LG SimpLink, Sony BRAVIA, Android TV)'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-300 font-semibold">OSD</label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !cecOsd;
                        setCecOsd(next);
                        cecRemote.setOsdFeedbackEnabled(next);
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        cecOsd ? 'bg-indigo-600' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          cecOsd ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-300 font-semibold">Activer CEC</label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !cecEnabled;
                        setCecEnabled(next);
                        cecRemote.setCecEnabled(next);
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        cecEnabled ? 'bg-indigo-600' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          cecEnabled ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sélecteur de profil matériel */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Profil matériel de la télécommande TV</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CEC_PROFILES.map((p) => {
                    const isSelected = cecProfileId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setCecProfileId(p.id);
                          cecRemote.setActiveProfile(p.id);
                        }}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-600/10 border-indigo-500 shadow-md shadow-indigo-500/10'
                            : 'bg-white/[0.02] border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-xs font-bold ${isSelected ? 'text-indigo-400' : 'text-white'}`}>
                            {p.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{p.description}</p>
                        <span className="text-[10px] text-slate-500 mt-2 font-mono">{p.vendor}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Raccourcis Touches de Couleur CEC */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Raccourcis des 4 touches de couleur (Télécommande TV)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-red-500/20 flex flex-col items-center text-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/40"></span>
                    <span className="font-bold text-white text-[11px]">Touche Rouge</span>
                    <span className="text-[10px] text-slate-400">Sous-titres / Recherche</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-emerald-500/20 flex flex-col items-center text-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40"></span>
                    <span className="font-bold text-white text-[11px]">Touche Verte</span>
                    <span className="text-[10px] text-slate-400">Audio / Mode TV</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-amber-500/20 flex flex-col items-center text-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-amber-400 shadow-lg shadow-amber-500/40"></span>
                    <span className="font-bold text-white text-[11px]">Touche Jaune</span>
                    <span className="text-[10px] text-slate-400">Signet / Favoris</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-blue-500/20 flex flex-col items-center text-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/40"></span>
                    <span className="font-bold text-white text-[11px]">Touche Bleue</span>
                    <span className="text-[10px] text-slate-400">Format d'image (Zoom)</span>
                  </div>
                </div>
              </div>

              {/* Testeur interactif en direct */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-indigo-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Testeur interactif de télécommande
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400">Appuyez sur une touche pour tester</span>
                </div>

                <div className="p-3 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between min-h-[50px]">
                  {lastCecCommand ? (
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-mono text-xs font-bold">
                        {lastCecCommand.hexCode || '0x00'}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white">{lastCecCommand.label}</p>
                        <p className="text-[10px] text-slate-400">
                          Action: {lastCecCommand.action} • Source: {lastCecCommand.source}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic">En attente d'un signal télécommande ou clavier...</span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => cecRemote.simulateAction('play_pause')}
                      className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 cursor-pointer"
                    >
                      Test Lecture
                    </button>
                    <button
                      type="button"
                      onClick={() => cecRemote.simulateAction('color_red')}
                      className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-[11px] text-red-300 cursor-pointer"
                    >
                      Test Rouge
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer avec bouton de sauvegarde */}
        <div className="p-4 border-t border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>Modifications appliquées immédiatement à ce profil.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleSavePreferences}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center gap-1.5"
            >
              {savingToast ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Enregistré !</span>
                </>
              ) : (
                <span>Enregistrer</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
