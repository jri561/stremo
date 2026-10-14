/**
 * Stremo HDMI-CEC Hardware Bridge
 * Détecte les contrôleurs matériels HDMI-CEC (Linux /dev/cec*, adaptateurs Pulse-Eight, Android TV)
 * et décode les commandes des télécommandes TV (Samsung Anynet+, LG SimpLink, Sony BRAVIA Sync, etc.)
 */

import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';

export interface CecProfile {
  id: string;
  name: string;
  vendor: string;
  description: string;
  keyPrefix?: string;
  features: string[];
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
    description: 'Profil optimisé pour télécommandes Samsung Tizen et One Remote (Keycodes 10009 Return, Smart Hub)',
    features: ['dpad', 'transport', 'smart_hub', 'colors', 'volume'],
  },
  {
    id: 'lg_simplink',
    name: 'LG SimpLink (Magic Remote)',
    vendor: 'LG Electronics',
    description: 'Profil optimisé pour télécommandes LG webOS Magic Remote (Keycode 461 Back, molette et touches de couleur)',
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
    description: 'Communication directe avec /dev/cec0 ou adaptateur USB-CEC Pulse-Eight sous Linux',
    features: ['raw_cec', 'dpad', 'transport', 'colors', 'power'],
  },
];

export interface CecCommand {
  action:
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
    | 'aspect_ratio'
    | 'power_on'
    | 'standby';
  label: string;
  code?: number;
  hexCode?: string;
  source: 'hardware' | 'simulated' | 'keyboard_cec';
  profileId: string;
  timestamp: number;
}

// Map standard HDMI-CEC User Control Codes (CEC 1.4 / 2.0 Operand [UI Command])
export const CEC_OPCODE_MAP: Record<number, { action: CecCommand['action']; label: string }> = {
  0x00: { action: 'select', label: 'Sélectionner / OK' },
  0x01: { action: 'up', label: 'Haut' },
  0x02: { action: 'down', label: 'Bas' },
  0x03: { action: 'left', label: 'Gauche' },
  0x04: { action: 'right', label: 'Droite' },
  0x09: { action: 'menu', label: 'Menu Principal' },
  0x0D: { action: 'back', label: 'Retour / Quitter' },
  0x36: { action: 'standby', label: 'Mise en veille TV (Standby 0x36)' },
  0x41: { action: 'volume_up', label: 'Volume +' },
  0x42: { action: 'volume_down', label: 'Volume -' },
  0x43: { action: 'mute', label: 'Sourdine (Mute)' },
  0x44: { action: 'play', label: 'Lecture' },
  0x45: { action: 'stop', label: 'Arrêt' },
  0x46: { action: 'pause', label: 'Pause' },
  0x48: { action: 'rewind', label: 'Retour rapide' },
  0x49: { action: 'fast_forward', label: 'Avance rapide' },
  0x4B: { action: 'next', label: 'Suivant' },
  0x4C: { action: 'prev', label: 'Précédent' },
  0x71: { action: 'color_red', label: 'Touche Rouge (Sous-titres)' },
  0x72: { action: 'color_green', label: 'Touche Verte (Audio)' },
  0x73: { action: 'color_yellow', label: 'Touche Jaune (Signet)' },
  0x74: { action: 'color_blue', label: 'Touche Bleue (Format)' },
};

export class CecHardwareBridge {
  private activeProfileId: string = 'universal_cec';
  private detectedAdapterPath: string | null = null;
  private isHardwareAvailable: boolean = false;
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor() {
    this.eventEmitter.setMaxListeners(100);
    this.detectHardware();
  }

  /**
   * Scanne le système Linux pour détecter un nœud HDMI-CEC (/dev/cec* ou /sys/class/cec)
   */
  public detectHardware(): boolean {
    try {
      if (process.platform === 'linux') {
        // 1. Vérification /dev/cec0 ou /dev/cec1
        const candidateDevs = ['/dev/cec0', '/dev/cec1', '/dev/cec2'];
        for (const dev of candidateDevs) {
          if (fs.existsSync(dev)) {
            this.detectedAdapterPath = dev;
            this.isHardwareAvailable = true;
            return true;
          }
        }

        // 2. Vérification sysfs
        if (fs.existsSync('/sys/class/cec')) {
          const entries = fs.readdirSync('/sys/class/cec');
          if (entries.length > 0) {
            this.detectedAdapterPath = path.join('/sys/class/cec', entries[0]);
            this.isHardwareAvailable = true;
            return true;
          }
        }
      }
    } catch {
      // Ignoré si droits insuffisants ou environnement conteneurisé
    }

    this.isHardwareAvailable = false;
    this.detectedAdapterPath = null;
    return false;
  }

  public getStatus() {
    return {
      available: this.isHardwareAvailable,
      adapterPath: this.detectedAdapterPath,
      platform: process.platform,
      activeProfile: this.activeProfileId,
      profiles: CEC_PROFILES,
    };
  }

  public setProfile(profileId: string): boolean {
    const exists = CEC_PROFILES.some((p) => p.id === profileId);
    if (!exists) return false;
    this.activeProfileId = profileId;
    this.eventEmitter.emit('profile_changed', profileId);
    return true;
  }

  public getActiveProfile(): CecProfile {
    return CEC_PROFILES.find((p) => p.id === this.activeProfileId) || CEC_PROFILES[0];
  }

  /**
   * Décode un opcode HDMI-CEC et émet la commande normalisée.
   */
  public decodeCecOpcode(opcode: number, source: 'hardware' | 'simulated' | 'keyboard_cec' = 'hardware'): CecCommand | null {
    const mapping = CEC_OPCODE_MAP[opcode];
    if (!mapping) return null;

    const command: CecCommand = {
      action: mapping.action,
      label: mapping.label,
      code: opcode,
      hexCode: '0x' + opcode.toString(16).padStart(2, '0').toUpperCase(),
      source,
      profileId: this.activeProfileId,
      timestamp: Date.now(),
    };

    this.eventEmitter.emit('cec_command', command);
    return command;
  }

  /**
   * Simule ou injecte une commande HDMI-CEC (pour les tests ou les télécommandes virtuelles).
   */
  public simulateCommand(action: CecCommand['action']): CecCommand {
    const entry = Object.entries(CEC_OPCODE_MAP).find(([_, v]) => v.action === action);
    const opcode = entry ? parseInt(entry[0], 10) : 0x00;
    const label = entry ? entry[1].label : action;

    const command: CecCommand = {
      action,
      label,
      code: opcode,
      hexCode: '0x' + opcode.toString(16).padStart(2, '0').toUpperCase(),
      source: 'simulated',
      profileId: this.activeProfileId,
      timestamp: Date.now(),
    };

    this.eventEmitter.emit('cec_command', command);
    return command;
  }

  /**
   * Allume la télévision via HDMI-CEC (Opcode 0x04: Image View On)
   */
  public async powerOnTv(): Promise<{ success: boolean; state: 'on'; opcode: string; method: string }> {
    let method = 'emulated';
    try {
      if (process.platform === 'linux') {
        const { execSync } = await import('node:child_process');
        if (this.hasCommand('cec-ctl')) {
          execSync('cec-ctl -d /dev/cec0 --image-view-on', { stdio: 'ignore', timeout: 2000 });
          method = 'cec-ctl';
        } else if (this.hasCommand('cec-client')) {
          execSync("echo 'on 0' | cec-client -s -d 1", { stdio: 'ignore', timeout: 2000 });
          method = 'cec-client';
        }
      }
    } catch {
      // Ignoré en cas d'absence de binaire ou d'erreur système
    }

    const command: CecCommand = {
      action: 'power_on',
      label: 'Allumage TV (Image View On 0x04)',
      code: 0x04,
      hexCode: '0x04',
      source: method === 'emulated' ? 'simulated' : 'hardware',
      profileId: this.activeProfileId,
      timestamp: Date.now(),
    };

    this.eventEmitter.emit('cec_command', command);
    this.eventEmitter.emit('cec_power', { state: 'on', opcode: '0x04', method, timestamp: Date.now() });

    return {
      success: true,
      state: 'on',
      opcode: '0x04',
      method,
    };
  }

  /**
   * Met la télévision en veille via HDMI-CEC (Opcode 0x36: Standby)
   */
  public async standbyTv(): Promise<{ success: boolean; state: 'standby'; opcode: string; method: string }> {
    let method = 'emulated';
    try {
      if (process.platform === 'linux') {
        const { execSync } = await import('node:child_process');
        if (this.hasCommand('cec-ctl')) {
          execSync('cec-ctl -d /dev/cec0 --standby', { stdio: 'ignore', timeout: 2000 });
          method = 'cec-ctl';
        } else if (this.hasCommand('cec-client')) {
          execSync("echo 'standby 0' | cec-client -s -d 1", { stdio: 'ignore', timeout: 2000 });
          method = 'cec-client';
        }
      }
    } catch {
      // Ignoré en cas d'absence de binaire ou d'erreur système
    }

    const command: CecCommand = {
      action: 'standby',
      label: 'Mise en veille TV (Standby 0x36)',
      code: 0x36,
      hexCode: '0x36',
      source: method === 'emulated' ? 'simulated' : 'hardware',
      profileId: this.activeProfileId,
      timestamp: Date.now(),
    };

    this.eventEmitter.emit('cec_command', command);
    this.eventEmitter.emit('cec_power', { state: 'standby', opcode: '0x36', method, timestamp: Date.now() });

    return {
      success: true,
      state: 'standby',
      opcode: '0x36',
      method,
    };
  }

  private hasCommand(cmd: string): boolean {
    try {
      const { execSync } = require('node:child_process');
      execSync(`which ${cmd}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  public onCommand(listener: (cmd: CecCommand) => void) {
    this.eventEmitter.on('cec_command', listener);
  }

  public offCommand(listener: (cmd: CecCommand) => void) {
    this.eventEmitter.off('cec_command', listener);
  }

  public onPower(listener: (power: { state: string; opcode: string; method: string }) => void) {
    this.eventEmitter.on('cec_power', listener);
  }

  public offPower(listener: (power: { state: string; opcode: string; method: string }) => void) {
    this.eventEmitter.off('cec_power', listener);
  }
}

export const cecBridge = new CecHardwareBridge();

/**
 * Route GET /api/hardware/cec/status
 */
export function handleGetCecStatus(_req: Request, res: Response): void {
  res.json({ success: true, ...cecBridge.getStatus() });
}

/**
 * Route POST /api/hardware/cec/profile
 */
export function handleSetCecProfile(req: Request, res: Response): void {
  const { profileId } = req.body || {};
  if (!profileId) {
    res.status(400).json({ success: false, error: 'profileId requis' });
    return;
  }
  const updated = cecBridge.setProfile(String(profileId));
  if (!updated) {
    res.status(404).json({ success: false, error: 'Profil HDMI-CEC non reconnu' });
    return;
  }
  res.json({ success: true, activeProfile: cecBridge.getActiveProfile() });
}

/**
 * Route POST /api/hardware/cec/simulate
 */
export function handleSimulateCecCommand(req: Request, res: Response): void {
  const { action, opcode } = req.body || {};
  let command: CecCommand | null = null;

  if (typeof opcode === 'number') {
    command = cecBridge.decodeCecOpcode(opcode, 'simulated');
  } else if (typeof action === 'string') {
    command = cecBridge.simulateCommand(action as CecCommand['action']);
  }

  if (!command) {
    res.status(400).json({ success: false, error: 'Action ou opcode CEC invalide' });
    return;
  }

  res.json({ success: true, command });
}

/**
 * Route POST /api/hardware/cec/power
 * Allume la TV (0x04 Image View On) ou la met en veille (0x36 Standby)
 */
export async function handleCecPowerControl(req: Request, res: Response): Promise<void> {
  const { state } = req.body || {};
  if (state === 'on') {
    const result = await cecBridge.powerOnTv();
    res.json(result);
  } else if (state === 'standby' || state === 'off') {
    const result = await cecBridge.standbyTv();
    res.json(result);
  } else {
    res.status(400).json({ success: false, error: "Paramètre state 'on' ou 'standby' requis" });
  }
}

/**
 * Route GET /api/hardware/cec/events (Server-Sent Events)
 * Permet aux applications frontend de recevoir les touches télécommande HDMI en continu.
 */
export function handleCecEventsSse(_req: Request, res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', profile: cecBridge.getActiveProfile().id })}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  const commandListener = (cmd: CecCommand) => {
    res.write(`data: ${JSON.stringify({ type: 'cec_key', command: cmd })}\n\n`);
  };

  const powerListener = (p: any) => {
    res.write(`data: ${JSON.stringify({ type: 'cec_power', power: p })}\n\n`);
  };

  cecBridge.onCommand(commandListener);
  cecBridge.onPower(powerListener);

  _req.on('close', () => {
    clearInterval(keepAlive);
    cecBridge.offCommand(commandListener);
    cecBridge.offPower(powerListener);
  });
}
