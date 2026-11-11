/**
 * Azioni nominate dello store.
 * Ogni azione riceve una copia modificabile (draft) di AppData e il payload,
 * la modifica sul posto e può restituire un risultato.
 * Le azioni sono funzioni pure rispetto all'esterno: niente DOM, niente storage.
 */
import { DomainError, createSettings } from '../domain/models.js';

/* ------------------------------ Impostazioni ------------------------------ */

export function completeSetup(d, { restaurantName, adminPinHash }) {
  if (!String(restaurantName ?? '').trim()) throw new DomainError('Inserisci il nome del locale.');
  if (!adminPinHash) throw new DomainError('PIN non valido.');
  d.settings = createSettings({ ...d.settings, restaurantName: restaurantName.trim(), adminPinHash });
}

export function updateSettings(d, patch) {
  const next = { ...d.settings, ...patch };
  if (!String(next.restaurantName ?? '').trim()) throw new DomainError('Il nome del locale è obbligatorio.');
  next.restaurantName = next.restaurantName.trim();
  d.settings = next;
}

export function markBackup(d, { at = new Date().toISOString() } = {}) {
  d.settings.lastBackupAt = at;
}

export const actions = {
  completeSetup,
  updateSettings,
  markBackup,
};
