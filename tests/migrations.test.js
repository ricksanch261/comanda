import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, migrations, CURRENT_SCHEMA_VERSION, MigrationError } from '../js/state/migrations.js';
import { createEmptyData, validateAppData } from '../js/domain/models.js';
import { parseBackup, serializeBackup, ImportError } from '../js/state/repository.js';
import { LocalRepository, STORAGE_KEY } from '../js/state/localRepository.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}

test('la versione corrente coincide con il numero di migrazioni', () => {
  assert.equal(CURRENT_SCHEMA_VERSION, migrations.length);
});

test('dati senza versione vengono portati alla versione corrente con i default', () => {
  const out = migrate({ settings: { restaurantName: 'Da Rina' }, areas: [{ id: 'a1', name: 'Sala' }] });
  assert.equal(out.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(out.settings.restaurantName, 'Da Rina');
  assert.deepEqual(out.settings.coverCharge, { enabled: false, amountCents: 0 });
  assert.ok(Array.isArray(out.tables));
  assert.ok(Array.isArray(out.sessions));
  assert.deepEqual(validateAppData(out), []);
});

test('le sessioni legacy ricevono i campi mancanti', () => {
  const out = migrate({ sessions: [{ id: 's1', tableId: 't', status: 'open', covers: 2 }] });
  assert.deepEqual(out.sessions[0].heldCourses, []);
  assert.deepEqual(out.sessions[0].payments, []);
  assert.deepEqual(out.sessions[0].orderLines, []);
});

test('dati già aggiornati restano invariati', () => {
  const data = createEmptyData();
  data.settings.restaurantName = 'X';
  assert.deepEqual(migrate(data), data);
});

test('migrate non modifica l’oggetto di input', () => {
  const input = { settings: {} };
  migrate(input);
  assert.deepEqual(input, { settings: {} });
});

test('le migrazioni vengono eseguite in ordine', () => {
  const calls = [];
  const list = [
    (d) => { calls.push(0); return { ...d, a: 1 }; },
    (d) => { calls.push(1); return { ...d, b: d.a + 1 }; },
  ];
  const out = migrate({ schemaVersion: 0 }, list);
  assert.deepEqual(calls, [0, 1]);
  assert.equal(out.b, 2);
  assert.equal(out.schemaVersion, 2);
  assert.deepEqual(migrate({ schemaVersion: 1, a: 5 }, list).b, 6);
});

test('uno schema più recente di quello supportato viene rifiutato', () => {
  assert.throws(() => migrate({ schemaVersion: 99 }), MigrationError);
});

test('input non valido viene rifiutato', () => {
  assert.throws(() => migrate(null), MigrationError);
  assert.throws(() => migrate([]), MigrationError);
});

test('parseBackup accetta il formato di export e valida', () => {
  const data = createEmptyData();
  data.settings.restaurantName = 'Trattoria';
  const json = serializeBackup(data);
  assert.deepEqual(parseBackup(json), data);
  assert.throws(() => parseBackup('{non json'), ImportError);
  assert.throws(() => parseBackup(JSON.stringify({ schemaVersion: 1, settings: {}, areas: 'x' })), ImportError);
});

test('LocalRepository salva, carica, esporta e importa', async () => {
  const storage = memoryStorage();
  const repo = new LocalRepository(storage);
  assert.equal(await repo.load(), null);
  const data = createEmptyData();
  data.settings.restaurantName = 'Osteria';
  await repo.save(data);
  assert.ok(storage.getItem(STORAGE_KEY));
  assert.deepEqual(await repo.load(), data);
  const json = await repo.exportJSON();
  await repo.clear();
  assert.equal(await repo.load(), null);
  const imported = await repo.importJSON(json);
  assert.deepEqual(imported, data);
  assert.deepEqual(await repo.load(), data);
});
