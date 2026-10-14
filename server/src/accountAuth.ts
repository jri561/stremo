import { scrypt, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

export interface HashResult {
  hash: string;
  salt: string;
}

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

/**
 * Hache un mot de passe de manière asynchrone sans bloquer l'event loop Node.js.
 */
export async function hashPassword(password: string, customSalt?: string): Promise<HashResult> {
  const salt = customSalt || randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

/**
 * Version synchrone pour les tests unitaires synchrones.
 */
export function hashPasswordSync(password: string, customSalt?: string): HashResult {
  const salt = customSalt || randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

/**
 * Vérifie un mot de passe en temps constant de manière asynchrone sans bloquer l'event loop Node.js.
 */
export async function verifyPassword(password: string, expectedHash: string, salt: string): Promise<boolean> {
  if (!password || !expectedHash || !salt) return false;
  try {
    const derivedKey = await scryptAsync(password, salt);
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    if (derivedKey.length !== expectedBuffer.length) return false;
    return timingSafeEqual(derivedKey, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Version synchrone pour les tests unitaires synchrones.
 */
export function verifyPasswordSync(password: string, expectedHash: string, salt: string): boolean {
  if (!password || !expectedHash || !salt) return false;
  try {
    const derivedKey = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    if (derivedKey.length !== expectedBuffer.length) return false;
    return timingSafeEqual(derivedKey, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Génère un jeton de session cryptographique opaque (64 caractères hexadécimaux).
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}
