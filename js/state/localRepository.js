/**
 * Implementazione di Repository su localStorage.
 */
import { Repository, parseBackup, serializeBackup } from './repository.js';
import { migrate } from './migrations.js';

export const STORAGE_KEY = 'gestione-tavoli:v1';

export class StorageQuotaError extends Error {
  constructor() {
    super('Spazio di archiviazione esaurito. Esporta un backup e archivia lo storico dei tavoli chiusi.');
    this.name = 'StorageQuotaError';
  }
}

function isQuotaError(e) {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)
  );
}

export class LocalRepository extends Repository {
  constructor(storage = globalThis.localStorage, key = STORAGE_KEY) {
    super();
    this.storage = storage;
    this.key = key;
  }

  async load() {
    const raw = this.storage.getItem(this.key);
    if (raw == null) return null;
    return migrate(JSON.parse(raw));
  }

  async save(data) {
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
    } catch (e) {
      if (isQuotaError(e)) throw new StorageQuotaError();
      throw e;
    }
  }

  async exportJSON(data) {
    const current = data ?? (await this.load());
    return serializeBackup(current);
  }

  async importJSON(json) {
    const data = parseBackup(json);
    await this.save(data);
    return data;
  }

  async clear() {
    this.storage.removeItem(this.key);
  }
}
