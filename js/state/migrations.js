/**
 * Migrazioni di schema versionate.
 * migrations[n] porta i dati dalla versione n alla versione n+1.
 * Vengono eseguite all'avvio e all'import di un backup.
 */
import { createEmptyData, createSettings, SCHEMA_VERSION } from '../domain/models.js';

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;

export const migrations = [
  // 0 → 1: dati senza versione (o parziali). Completa i campi mancanti con i default.
  (data) => {
    const empty = createEmptyData();
    const out = { ...empty, ...data };
    out.settings = createSettings(data.settings || {});
    out.settings.coverCharge = { ...empty.settings.coverCharge, ...(data.settings?.coverCharge || {}) };
    for (const key of ['areas', 'tables', 'categories', 'menuItems', 'modifierGroups', 'sessions']) {
      if (!Array.isArray(out[key])) out[key] = [];
    }
    out.sessions = out.sessions.map((s) => ({
      heldCourses: [],
      payments: [],
      seatsState: [],
      orderLines: [],
      ...s,
    }));
    out.schemaVersion = 1;
    return out;
  },
];

export class MigrationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Esegue in sequenza le migrazioni necessarie.
 * @param {object} data dati grezzi
 * @param {Array<Function>} list elenco migrazioni (iniettabile per i test)
 */
export function migrate(data, list = migrations) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new MigrationError('Dati non validi: atteso un oggetto.');
  }
  const target = list.length;
  let version = Number.isInteger(data.schemaVersion) ? data.schemaVersion : 0;
  if (version > target) {
    throw new MigrationError(
      `Il backup usa lo schema v${version}, più recente di quello supportato (v${target}). Aggiorna l'app.`,
    );
  }
  let out = structuredClone(data);
  while (version < target) {
    out = list[version](out);
    version += 1;
    out.schemaVersion = version;
  }
  return out;
}
