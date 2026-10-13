import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';

// Bus d'événements mémoire pour le temps réel multi-écrans
export const syncEmitter = new EventEmitter();
syncEmitter.setMaxListeners(200);

/**
 * Notifie immédiatement l'écran TV récepteur dès qu'un appareil mobile
 * ou un ordinateur valide l'appairage.
 */
export function notifyPairSuccess(code: string, data: any): void {
  const cleanCode = code.toUpperCase().trim();
  syncEmitter.emit(`pair:${cleanCode}`, data);
}

/**
 * Envoie une commande de télécommande en temps réel à l'écran connecté
 * (Play, Pause, Seek, Next, Volume, CastMedia).
 */
export function sendRemoteCommand(code: string, command: { action: string; payload?: any }): void {
  const cleanCode = code.toUpperCase().trim();
  syncEmitter.emit(`remote:${cleanCode}`, command);
}

/**
 * Endpoint Server-Sent Events (SSE) : écoute en temps réel de l'état d'un écran.
 */
export function handlePairSse(req: Request, res: Response): void {
  const rawCode = req.params.code;
  if (!rawCode) {
    res.status(400).json({ error: 'Code requis' });
    return;
  }

  const code = String(rawCode).toUpperCase().trim();

  // En-têtes obligatoires SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });

  // Message d'accueil SSE
  res.write(`data: ${JSON.stringify({ type: 'connected', code })}\n\n`);

  // Heartbeat toutes les 15s pour éviter la coupure par les proxys/navigateurs
  const keepAliveTimer = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  // 1. Écoute de l'appairage réussi
  const pairListener = (data: any) => {
    res.write(`data: ${JSON.stringify({ type: 'paired', code, data })}\n\n`);
  };
  syncEmitter.on(`pair:${code}`, pairListener);

  // 2. Écoute des commandes de télécommande mobile
  const remoteListener = (command: any) => {
    res.write(`data: ${JSON.stringify({ type: 'remote', code, command })}\n\n`);
  };
  syncEmitter.on(`remote:${code}`, remoteListener);

  // Nettoyage lors de la déconnexion
  req.on('close', () => {
    clearInterval(keepAliveTimer);
    syncEmitter.off(`pair:${code}`, pairListener);
    syncEmitter.off(`remote:${code}`, remoteListener);
  });
}

/**
 * Endpoint de télécommande : permet à un smartphone d'envoyer des commandes à la TV appairée.
 */
export function handleRemoteCommand(req: Request, res: Response): void {
  const rawCode = req.params.code;
  const { action, payload } = req.body || {};

  if (!rawCode || !action) {
    res.status(400).json({ success: false, error: 'Code et action requis' });
    return;
  }

  const code = String(rawCode).toUpperCase().trim();
  sendRemoteCommand(code, { action, payload });

  res.json({ success: true, message: `Commande ${action} envoyée à ${code}` });
}

export interface LanDevice {
  deviceId: string;
  name: string;
  deviceType: 'tv' | 'mobile' | 'desktop';
  ipAddress?: string;
  userAgent?: string;
  activeProfileName?: string;
  pairCode?: string;
  lastSeen: number;
}

const activeDevices = new Map<string, LanDevice>();

export function announceLanDevice(device: Omit<LanDevice, 'lastSeen'>): LanDevice {
  const dev: LanDevice = {
    ...device,
    lastSeen: Date.now(),
  };
  activeDevices.set(device.deviceId, dev);
  return dev;
}

export function getLanDevices(excludeDeviceId?: string): LanDevice[] {
  const now = Date.now();
  const valid: LanDevice[] = [];
  for (const [id, dev] of activeDevices.entries()) {
    if (now - dev.lastSeen <= 60000) {
      if (!excludeDeviceId || dev.deviceId !== excludeDeviceId) {
        valid.push(dev);
      }
    } else {
      activeDevices.delete(id);
    }
  }
  return valid;
}

export function handleLanAnnounce(req: Request, res: Response): void {
  const { deviceId, name, deviceType, activeProfileName, pairCode } = req.body || {};
  if (!deviceId || !name) {
    res.status(400).json({ success: false, error: 'deviceId et name requis' });
    return;
  }
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const dev = announceLanDevice({
    deviceId,
    name,
    deviceType: deviceType || 'desktop',
    ipAddress: ipAddress.replace(/^.*:/, ''),
    userAgent,
    activeProfileName,
    pairCode,
  });
  res.json({ success: true, device: dev });
}

export function handleGetLanDevices(req: Request, res: Response): void {
  const exclude = req.query.exclude as string | undefined;
  const devices = getLanDevices(exclude);
  res.json({ success: true, devices });
}
