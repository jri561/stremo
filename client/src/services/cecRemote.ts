/**
 * Service Client Télécommandes & HDMI-CEC
 * Détecte, normalise et dispatche les touches des télécommandes TV
 * (Samsung Anynet+, LG SimpLink, Sony BRAVIA Sync, Android TV, HTPC Linux)
 */

export type CecAction =
  | 'select'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'back'
  | 'menu'
  | 'play'
  | 'pause'
  | 'play_pause'
  | 'stop'
  | 'fast_forward'
  | 'rewind'
  | 'next'
  | 'prev'
  | 'volume_up'
  | 'volume_down'
  | 'mute'
  | 'color_red'
  | 'color_green'
  | 'color_yellow'
  | 'color_blue'
  | 'info'
  | 'subtitles'
  | 'audio_track'
  | 'aspect_ratio';

export interface CecProfile {
  id: string;
  name: string;
  vendor: string;
  description: string;
  features: string[];
}

export interface CecCommand {
  action: CecAction;
  label: string;
  code?: number;
  hexCode?: string;
  source: 'hardware' | 'simulated' | 'keyboard_cec';
  profileId: string;
  timestamp: number;
}

export const CEC_PROFILES: CecProfile[] = [
  {
    id: 'universal_cec',
    name: 'HDMI-CEC Standard Universel',
    vendor: 'HDMI Forum (CEC 1.4/2.0/2.1)',
    description: 'Compatible avec toutes les télévisions modernes HDMI (Philips EasyLink, Panasonic Viera Link, etc.)',
    features: ['dpad', 'transport', 'volume', 'standby', 'colors'],
  },
  {
    id: 'samsung_anynet',
    name: 'Samsung Anynet+ (Smart Remote)',
    vendor: 'Samsung Electronics',
    description: 'Profil optimisé pour télécommandes Samsung Tizen et One Remote (Keycode 10009 Return, Smart Hub)',
    features: ['dpad', 'transport', 'smart_hub', 'colors', 'volume'],
  },
  {
    id: 'lg_simplink',
    name: 'LG SimpLink (Magic Remote)',
    vendor: 'LG Electronics',
    description: 'Profil optimisé pour télécommandes LG webOS Magic Remote (Keycode 461 Back, touches de couleur)',
    features: ['dpad', 'transport', 'quick_access', 'colors', 'volume'],
  },
  {
    id: 'sony_bravia',
    name: 'Sony BRAVIA Sync',
    vendor: 'Sony Corporation',
    description: 'Profil optimisé pour télécommandes Sony BRAVIA Android TV (Sync Menu, Action, Info)',
    features: ['dpad', 'transport', 'sync_menu', 'colors', 'info'],
  },
  {
    id: 'android_tv',
    name: 'Android TV / Google TV Remote',
    vendor: 'Google / AOSP',
    description: 'Profil pour boîtiers TV Android, Nvidia Shield et télécommandes Bluetooth G10/G20',
    features: ['dpad', 'transport', 'home', 'back', 'voice'],
  },
  {
    id: 'linux_htpc',
    name: 'Linux HTPC & Raspberry Pi',
    vendor: 'Pulse-Eight / Linux CEC Subsystem',
    description: 'Communication directe avec /dev/cec0 ou adaptateur USB-CEC sous Linux',
    features: ['raw_cec', 'dpad', 'transport', 'colors', 'power'],
  },
];

const ACTION_LABELS: Record<CecAction, string> = {
  select: 'Sélectionner / OK',
  up: 'Haut',
  down: 'Bas',
  left: 'Gauche',
  right: 'Droite',
  back: 'Retour / Quitter',
  menu: 'Menu Principal',
  play: 'Lecture',
  pause: 'Pause',
  play_pause: 'Lecture / Pause',
  stop: 'Arrêt',
  fast_forward: 'Avance rapide (+15s)',
  rewind: 'Retour rapide (-15s)',
  next: 'Épisode suivant',
  prev: 'Précédent',
  volume_up: 'Volume +',
  volume_down: 'Volume -',
  mute: 'Sourdine',
  color_red: '🔴 Rouge (Sous-titres)',
  color_green: '🟢 Vert (Audio / Transcodage)',
  color_yellow: '🟡 Jaune (Signet)',
  color_blue: '🔵 Bleu (Format d\'image)',
  info: 'Informations / OSD',
  subtitles: 'Sous-titres',
  audio_track: 'Piste Audio',
  aspect_ratio: 'Format d\'image',
};

class CecRemoteManager {
  private activeProfileId: string = 'universal_cec';
  private isEnabled: boolean = true;
  private isOsdEnabled: boolean = true;
  private listeners: Set<(cmd: CecCommand) => void> = new Set();
  private lastCommand: CecCommand | null = null;
  private eventSource: EventSource | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const storedProfile = localStorage.getItem('stremo_cec_profile');
        if (storedProfile && CEC_PROFILES.some((p) => p.id === storedProfile)) {
          this.activeProfileId = storedProfile;
        }
        const storedEnabled = localStorage.getItem('stremo_cec_enabled');
        if (storedEnabled !== null) {
          this.isEnabled = storedEnabled === 'true';
        }
        const storedOsd = localStorage.getItem('stremo_cec_osd');
        if (storedOsd !== null) {
          this.isOsdEnabled = storedOsd === 'true';
        }
      } catch {}

      this.initKeyboardListener();
      this.initSseListener();
    }
  }

  public getAvailableProfiles(): CecProfile[] {
    return CEC_PROFILES;
  }

  public getActiveProfile(): CecProfile {
    return CEC_PROFILES.find((p) => p.id === this.activeProfileId) || CEC_PROFILES[0];
  }

  public setActiveProfile(profileId: string): void {
    if (CEC_PROFILES.some((p) => p.id === profileId)) {
      this.activeProfileId = profileId;
      try {
        localStorage.setItem('stremo_cec_profile', profileId);
      } catch {}
      this.notifyListeners({
        action: 'info',
        label: `Profil HDMI-CEC activé : ${this.getActiveProfile().name}`,
        source: 'simulated',
        profileId,
        timestamp: Date.now(),
      });
    }
  }

  public isCecEnabled(): boolean {
    return this.isEnabled;
  }

  public setCecEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('stremo_cec_enabled', String(enabled));
    } catch {}
  }

  public isOsdFeedbackEnabled(): boolean {
    return this.isOsdEnabled;
  }

  public setOsdFeedbackEnabled(enabled: boolean): void {
    this.isOsdEnabled = enabled;
    try {
      localStorage.setItem('stremo_cec_osd', String(enabled));
    } catch {}
  }

  public getLastCommand(): CecCommand | null {
    return this.lastCommand;
  }

  public subscribe(listener: (cmd: CecCommand) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public dispatchCommand(cmd: CecCommand): void {
    this.lastCommand = cmd;
    this.notifyListeners(cmd);
  }

  private notifyListeners(cmd: CecCommand): void {
    for (const listener of this.listeners) {
      try {
        listener(cmd);
      } catch (err) {
        console.error('Erreur dans un écouteur CEC:', err);
      }
    }
  }

  /**
   * Traduit un événement clavier en commande normalisée HDMI-CEC
   */
  public mapKeyboardEvent(e: KeyboardEvent): CecCommand | null {
    if (!this.isEnabled) return null;

    const key = e.key;
    const keyCode = e.keyCode || e.which;

    let action: CecAction | null = null;

    // 1. Touches de couleur CEC (Samsung, LG, Philips, Sony, Android TV)
    if (key === 'ColorF0Red' || keyCode === 403 || keyCode === 183) {
      action = 'color_red';
    } else if (key === 'ColorF1Green' || keyCode === 404 || keyCode === 184) {
      action = 'color_green';
    } else if (key === 'ColorF2Yellow' || keyCode === 405 || keyCode === 185) {
      action = 'color_yellow';
    } else if (key === 'ColorF3Blue' || keyCode === 406 || keyCode === 186) {
      action = 'color_blue';
    }
    // 2. Touches de transport multimédia standard & TV
    else if (key === 'MediaPlay' || keyCode === 415 || keyCode === 126) {
      action = 'play';
    } else if (key === 'MediaPause' || (keyCode === 19 && !e.ctrlKey) || keyCode === 127) {
      action = 'pause';
    } else if (key === 'MediaPlayPause' || keyCode === 179 || keyCode === 85) {
      action = 'play_pause';
    } else if (key === 'MediaStop' || keyCode === 178 || keyCode === 413 || keyCode === 86) {
      action = 'stop';
    } else if (key === 'MediaFastForward' || key === 'FastForward' || keyCode === 228 || keyCode === 417 || keyCode === 90) {
      action = 'fast_forward';
    } else if (key === 'MediaRewind' || key === 'Rewind' || keyCode === 227 || keyCode === 412 || keyCode === 89) {
      action = 'rewind';
    } else if (key === 'MediaTrackNext' || keyCode === 87) {
      action = 'next';
    } else if (key === 'MediaTrackPrevious' || keyCode === 88) {
      action = 'prev';
    }
    // 3. Touches de retour Smart TV spécifiques (Samsung Tizen 10009, LG webOS 461, Android TV 4)
    else if (
      key === 'GoBack' ||
      key === 'BrowserBack' ||
      keyCode === 10009 ||
      keyCode === 461 ||
      (keyCode === 4 && !e.altKey && !e.ctrlKey)
    ) {
      action = 'back';
    }
    // 4. Sous-titres & Audio TV
    else if (key === 'Subtitle' || keyCode === 460 || keyCode === 175) {
      action = 'subtitles';
    } else if (key === 'AudioTrack' || keyCode === 10140) {
      action = 'audio_track';
    } else if (key === 'Info' || keyCode === 457 || keyCode === 165) {
      action = 'info';
    }

    if (!action) return null;

    return {
      action,
      label: ACTION_LABELS[action] || action,
      code: keyCode,
      hexCode: '0x' + (keyCode ? keyCode.toString(16).toUpperCase() : '00'),
      source: 'keyboard_cec',
      profileId: this.activeProfileId,
      timestamp: Date.now(),
    };
  }

  private initKeyboardListener(): void {
    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        // Ne pas intercepter la saisie dans un champ texte standard
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }

        const cmd = this.mapKeyboardEvent(e);
        if (cmd) {
          // Événement reconnu comme commande télécommande TV
          e.preventDefault();
          this.dispatchCommand(cmd);
        }
      },
      { capture: true }
    );
  }

  private initSseListener(): void {
    try {
      this.eventSource = new EventSource('/api/hardware/cec/events');
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'cec_key' && data.command) {
            this.dispatchCommand({
              ...data.command,
              source: 'hardware',
            });
          }
        } catch {}
      };
      this.eventSource.onerror = () => {
        // Reconnexion automatique gérée nativement par EventSource
      };
    } catch {
      // Ignoré si indisponible
    }
  }

  public simulateAction(action: CecAction): CecCommand {
    const cmd: CecCommand = {
      action,
      label: ACTION_LABELS[action] || action,
      source: 'simulated',
      profileId: this.activeProfileId,
      timestamp: Date.now(),
    };
    this.dispatchCommand(cmd);
    return cmd;
  }
}

export const cecRemote = new CecRemoteManager();
