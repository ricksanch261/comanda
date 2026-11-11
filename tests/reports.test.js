import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeReport } from '../js/domain/reports.js';
import { actions } from '../js/state/actions.js';
import { parseBackup, serializeBackup } from '../js/state/repository.js';
import { fixture, open } from './fixtures.js';

function closedService(d, tableId, items, at, cover = true) {
  const { sessionId, seat } = open(d, tableId, 2);
  actions.addOrderLine(d, { sessionId, menuItemId: items.tagliere, assignment: { type: 'shared', seatIds: [seat(0), seat(1)] } });
  actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, quantity: 2, assignment: { type: 'table' } });
  const v = actions.addOrderLine(d, { sessionId, menuItemId: items.risotto, assignment: { type: 'seat', seatIds: [seat(0)] } });
  actions.sendOrder(d, { sessionId });
  actions.voidLine(d, { sessionId, lineId: v, reason: 'errore' });
  actions.addPayment(d, { sessionId, amountCents: 2400 + (cover ? 500 : 0) });
  actions.closeSession(d, { sessionId, now: at });
}

test('report: incasso, coperti, scontrino medio, top piatti, filtro date', () => {
  const { d, tableId, items } = fixture({ cover: 250 });
  closedService(d, tableId, items, '2026-03-01T22:00:00Z');
  closedService(d, tableId, items, '2026-03-02T22:00:00Z');
  open(d, tableId, 2); // aperta: esclusa
  const r = computeReport(d.sessions);
  assert.equal(r.sessions, 2);
  assert.equal(r.revenueCents, 2 * (1800 + 600 + 500));
  assert.equal(r.covers, 4);
  assert.equal(r.averagePerCoverCents, 1450);
  assert.deepEqual(r.topByQuantity.map((x) => [x.name, x.quantity]), [['Acqua', 4], ['Tagliere', 2]]);
  assert.deepEqual(r.topByRevenue.map((x) => x.name), ['Tagliere', 'Acqua']);
  const one = computeReport(d.sessions, { from: '2026-03-02T00:00:00Z', to: '2026-03-02T23:59:59Z' });
  assert.equal(one.sessions, 1);
});

test('archiviazione delle sessioni chiuse più vecchie', () => {
  const { d, tableId, items } = fixture();
  closedService(d, tableId, items, '2025-01-01T22:00:00Z', false);
  closedService(d, tableId, items, '2026-03-01T22:00:00Z', false);
  const removed = actions.archiveSessions(d, { before: '2026-01-01T00:00:00Z' });
  assert.equal(removed.length, 1);
  assert.equal(d.sessions.length, 1);
});

test('criterio: export e import JSON ripristinano esattamente lo stato', () => {
  const { d, tableId, items } = fixture({ cover: 250 });
  closedService(d, tableId, items, '2026-03-01T22:00:00Z');
  const { sessionId, seat } = open(d, tableId, 3);
  actions.updateSeat(d, { sessionId, seatId: seat(1), guestName: 'Giulia', allergens: ['latte'] });
  d.settings.lastBackupAt = '2026-03-01T00:00:00Z';
  const restored = parseBackup(serializeBackup(d));
  assert.deepEqual(restored, d);
});
