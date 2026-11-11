/**
 * Accesso all'area amministrativa tramite PIN (4–6 cifre).
 * Lo sblocco vale per la sessione del browser (sessionStorage).
 */
import { sha256Hex } from '../utils/sha256.js';

const KEY = 'gestione-tavoli:admin';
export const MAX_ATTEMPTS = 3;
export const LOCKOUT_MS = 30_000;

let failed = 0;
let lockedUntil = 0;

export function isValidPin(pin) {
  return /^\d{4,6}$/.test(String(pin));
}

export function hashPin(pin) {
  return sha256Hex(String(pin));
}

export async function verifyPin(pin, expectedHash) {
  if (Date.now() < lockedUntil) return { ok: false, locked: true, retryInMs: lockedUntil - Date.now() };
  const ok = (await hashPin(pin)) === expectedHash;
  if (ok) {
    failed = 0;
    unlockAdmin();
    return { ok: true };
  }
  failed += 1;
  if (failed >= MAX_ATTEMPTS) {
    failed = 0;
    lockedUntil = Date.now() + LOCKOUT_MS;
    return { ok: false, locked: true, retryInMs: LOCKOUT_MS };
  }
  return { ok: false, remaining: MAX_ATTEMPTS - failed };
}

export function lockRemainingMs() {
  return Math.max(0, lockedUntil - Date.now());
}

export function isAdminUnlocked() {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function unlockAdmin() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* ignorato */
  }
}

export function lockAdmin() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignorato */
  }
}
