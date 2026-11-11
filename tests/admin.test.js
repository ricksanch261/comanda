import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actions } from '../js/state/actions.js';
import { createEmptyData } from '../js/domain/models.js';
import { planBulkTables } from '../js/domain/tables.js';

function setup() {
  const d = createEmptyData();
  const areaId = actions.addArea(d, { name: 'Sala interna' });
  return { d, areaId };
}

test('criterio: creo 10 tavoli da 4 posti in un’unica operazione e rinomino ogni posto', () => {
  const { d, areaId } = setup();
  const r = actions.bulkCreateTables(d, { areaId, quantity: 10, seats: 4, start: 1, prefix: 'T', shape: 'square' });
  assert.equal(r.created.length, 10);
  assert.deepEqual(d.tables.map((t) => t.label), ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10']);
  assert.ok(d.tables.every((t) => t.seats.length === 4));
  assert.deepEqual(d.tables[0].seats.map((s) => s.label), ['P1', 'P2', 'P3', 'P4']);
  const t = d.tables[0];
  actions.updateTable(d, { id: t.id, seats: t.seats.map((s, i) => ({ id: s.id, label: ['Capotavola', 'Finestra', 'Muro', 'Corridoio'][i] })) });
  assert.deepEqual(d.tables[0].seats.map((s) => s.label), ['Capotavola', 'Finestra', 'Muro', 'Corridoio']);
  assert.deepEqual(d.tables[0].seats.map((s) => s.position), [0, 1, 2, 3]);
});

test('la creazione in blocco salta le etichette esistenti', () => {
  const { d, areaId } = setup();
  actions.addTable(d, { label: 'D13', areaId, seats: 2 });
  const plan = planBulkTables({ quantity: 4, start: 11, prefix: 'D' }, d.tables);
  assert.deepEqual(plan.map((p) => [p.label, p.exists]), [['D11', false], ['D12', false], ['D13', true], ['D14', false]]);
  const r = actions.bulkCreateTables(d, { areaId, quantity: 4, seats: 2, start: 11, prefix: 'D' });
  assert.equal(r.created.length, 3);
  assert.deepEqual(r.skipped, ['D13']);
});

test('i tavoli creati in blocco non si sovrappongono nella piantina', () => {
  const { d, areaId } = setup();
  actions.bulkCreateTables(d, { areaId, quantity: 8, seats: 4, shape: 'square' });
  const L = d.tables.map((t) => t.layout);
  for (let i = 0; i < L.length; i++)
    for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      assert.equal(overlap, false, `tavoli ${i} e ${j} sovrapposti`);
    }
});

test('etichette duplicate vengono rifiutate', () => {
  const { d, areaId } = setup();
  actions.addTable(d, { label: '12', areaId });
  assert.throws(() => actions.addTable(d, { label: ' 12 ', areaId }), /Esiste già/);
});

test('non si può eliminare un tavolo con una sessione aperta', () => {
  const { d, areaId } = setup();
  const id = actions.addTable(d, { label: '1', areaId });
  d.sessions.push({ id: 's', tableId: id, status: 'open', orderLines: [], seatsState: [], heldCourses: [], payments: [] });
  assert.throws(() => actions.removeTable(d, { id }), /servizio aperto/);
  d.sessions[0].status = 'closed';
  actions.removeTable(d, { id });
  assert.equal(d.tables.length, 0);
});

test('un’area con tavoli non si elimina; riordino aree', () => {
  const { d, areaId } = setup();
  const b = actions.addArea(d, { name: 'Dehors' });
  actions.addTable(d, { label: '1', areaId });
  assert.throws(() => actions.removeArea(d, { id: areaId }));
  actions.reorderAreas(d, { ids: [b, areaId] });
  assert.deepEqual(d.areas.map((a) => a.name), ['Dehors', 'Sala interna']);
  actions.removeArea(d, { id: b });
  assert.equal(d.areas.length, 1);
});

test('piatti: salvataggio con allergeni normalizzati, esaurito, varianti', () => {
  const { d } = setup();
  const cat = actions.addCategory(d, { name: 'Primi', courseIndex: 1 });
  const g = actions.saveModifierGroup(d, { group: { name: 'Cottura', required: true, options: [{ name: 'Al sangue' }, { name: 'Media', priceDeltaCents: 0 }, { name: '' }] } });
  assert.equal(d.modifierGroups[0].options.length, 2);
  const id = actions.saveMenuItem(d, { item: { name: 'Tagliata', priceCents: 2350, categoryId: cat, destination: 'cucina', allergens: ['latte', 'boh', 'glutine'], modifierGroupIds: [g, 'x'] } });
  const item = d.menuItems.find((m) => m.id === id);
  assert.deepEqual(item.allergens, ['glutine', 'latte']);
  assert.deepEqual(item.modifierGroupIds, [g]);
  actions.setItemAvailable(d, { id, available: false });
  assert.equal(item.available, false);
  actions.removeModifierGroup(d, { id: g });
  assert.deepEqual(item.modifierGroupIds, []);
  assert.throws(() => actions.removeCategory(d, { id: cat }));
  assert.throws(() => actions.saveMenuItem(d, { item: { name: 'X', priceCents: -1, categoryId: cat, destination: 'cucina' } }));
});

test('setCourses rimappa gli indici delle categorie', () => {
  const { d } = setup();
  // Antipasti, Primi, Secondi, Contorni, Dolci
  const cat = actions.addCategory(d, { name: 'Secondi di carne', courseIndex: 2 });
  const dolci = actions.addCategory(d, { name: 'Dolci', courseIndex: 4 });
  actions.setCourses(d, { courses: [{ name: 'Secondi', prevIndex: 2 }, { name: 'Antipasti', prevIndex: 0 }, { name: 'Nuova', prevIndex: null }] });
  assert.deepEqual(d.settings.courses, ['Secondi', 'Antipasti', 'Nuova']);
  assert.equal(d.categories.find((c) => c.id === cat).courseIndex, 0);
  assert.equal(d.categories.find((c) => c.id === dolci).courseIndex, null);
});
