import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

export interface HashResult {
  hash: string;
  salt: string;
}

/**
 * Hache un mot de passe avec un sel aléatoire ou spécifié en utilisant scrypt.
 */
export function hashPassword(password: string, customSalt?: string): HashResult {
  const salt = customSalt || randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

/**
 * Vérifie un mot de passe en temps constant.
 */
export function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
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
