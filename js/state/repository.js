/**
 * Interfaccia di persistenza.
 * Le view non la usano mai direttamente: passa tutto dallo store.
 * Un'implementazione futura (es. Supabase) deve solo estendere Repository.
 */
import { migrate } from './migrations.js';
import { validateAppData } from '../domain/models.js';

export class Repository {
  /** @returns {Promise<object|null>} AppData migrato, o null al primo avvio */
  async load() { throw new Error('Repository.load non implementato'); }
  /** @param {object} data AppData */
  async save(data) { throw new Error('Repository.save non implementato'); }
  /** @returns {Promise<string>} JSON del backup */
  async exportJSON() { throw new Error('Repository.exportJSON non implementato'); }
  /** @param {string} json @returns {Promise<object>} AppData importato */
  async importJSON(json) { throw new Error('Repository.importJSON non implementato'); }
}

export class ImportError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ImportError';
    this.details = details;
  }
}

/**
 * Valida e migra un backup JSON senza salvarlo.
 * Lancia ImportError con un messaggio leggibile se il contenuto non è valido.
 */
export function parseBackup(json) {
  let raw;
  try {
    raw = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new ImportError('Il file non è un JSON valido.');
  }
  // Un backup può essere AppData nudo o avvolto in { app, exportedAt, data }.
  if (raw && raw.app === 'gestione-tavoli' && raw.data) raw = raw.data;
  let data;
  try {
    data = migrate(raw);
  } catch (e) {
    throw new ImportError(e.message);
  }
  const errors = validateAppData(data);
  if (errors.length) throw new ImportError('Il backup non è valido.', errors);
  return data;
}

/** Serializza AppData nel formato di backup. */
export function serializeBackup(data, now = new Date()) {
  return JSON.stringify(
    { app: 'gestione-tavoli', exportedAt: now.toISOString(), data },
    null,
    2,
  );
}
