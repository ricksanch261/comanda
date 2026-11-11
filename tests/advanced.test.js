import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actions } from '../js/state/actions.js';
import { computeBill } from '../js/domain/billing.js';
import { getTableStatus } from '../js/domain/session.js';
import { fixture, open } from './fixtures.js';

test('portate trattenute: invio esclude la portata, marcia la invia', () => {
  const { d, tableId, items, groups } = fixture();
  const { sessionId, session: s, seat } = open(d, tableId, 2);
  const g = d.modifierGroups.find((x) => x.id === groups.cottura);
  actions.addOrderLine(d, { sessionId, menuItemId: items.risotto, assignment: { type: 'seat', seatIds: [seat(0)] } }); // Primi (1)
  actions.addOrderLine(d, { sessionId, menuItemId: items.tagliata, assignment: { type: 'seat', seatIds: [seat(1)] }, modifiers: [{ groupId: g.id, optionId: g.options[0].id }] }); // Secondi (2)
  const sent = actions.sendOrder(d, { sessionId, hold: [2] });
  assert.equal(sent.length, 1);
  assert.deepEqual(s.heldCourses, [2]);
  assert.equal(getTableStatus(d.tables[0], s), 'held');
  assert.equal(s.orderLines[1].status, 'draft');
  // nuove bozze dei secondi restano trattenute anche con un altro invio
  actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, assignment: { type: 'table' } });
  actions.sendOrder(d, { sessionId });
  assert.equal(s.orderLines[1].status, 'draft');
  const marched = actions.marchCourse(d, { sessionId, courseIndex: 2, now: '2026-01-01T21:00:00Z' });
  assert.deepEqual(marched, [s.orderLines[1].id]);
  assert.equal(s.orderLines[1].status, 'sent');
  assert.deepEqual(s.heldCourses, []);
  assert.equal(getTableStatus(d.tables[0], s), 'active');
  assert.throws(() => actions.marchCourse(d, { sessionId, courseIndex: 2 }));
});

test('storno: solo righe inviate, motivo obbligatorio, escluso dal conto', () => {
  const { d, tableId, items } = fixture();
  const { sessionId, session: s } = open(d, tableId, 2);
  const l = actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, assignment: { type: 'table' } });
  assert.throws(() => actions.voidLine(d, { sessionId, lineId: l, reason: 'x' }), /bozze/);
  actions.sendOrder(d, { sessionId });
  assert.throws(() => actions.voidLine(d, { sessionId, lineId: l, reason: '  ' }), /obbligatorio/);
  actions.voidLine(d, { sessionId, lineId: l, reason: 'Errore di inserimento' });
  assert.equal(s.orderLines[0].status, 'voided');
  assert.equal(s.orderLines[0].voidReason, 'Errore di inserimento');
  assert.equal(computeBill(s).totalCents, 0);
});

test('segna come servita', () => {
  const { d, tableId, items } = fixture();
  const { sessionId, session: s } = open(d, tableId, 2);
  const a = actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, assignment: { type: 'table' } });
  const b = actions.addOrderLine(d, { sessionId, menuItemId: items.tagliere, assignment: { type: 'table' } });
  actions.sendOrder(d, { sessionId });
  assert.equal(actions.markServed(d, { sessionId, lineIds: [a, b] }), 2);
  assert.ok(s.orderLines.every((l) => l.status === 'served' && l.servedAt));
});

test('sposta riga su un altro posto o sul tavolo (con controllo allergeni)', () => {
  const { d, tableId, items } = fixture();
  const { sessionId, session: s, seat } = open(d, tableId, 3);
  actions.updateSeat(d, { sessionId, seatId: seat(2), allergens: ['latte'] });
  const l = actions.addOrderLine(d, { sessionId, menuItemId: items.risotto, assignment: { type: 'seat', seatIds: [seat(0)] } });
  actions.sendOrder(d, { sessionId });
  actions.moveLine(d, { sessionId, lineId: l, assignment: { type: 'seat', seatIds: [seat(1)] } });
  assert.deepEqual(s.orderLines[0].assignment.seatIds, [seat(1)]);
  assert.throws(() => actions.moveLine(d, { sessionId, lineId: l, assignment: { type: 'table' } }), (e) => e.code === 'allergen');
  actions.moveLine(d, { sessionId, lineId: l, assignment: { type: 'table' }, allergenOverride: true });
  assert.equal(s.orderLines[0].assignment.type, 'table');
  assert.equal(s.orderLines[0].allergenOverride, true);
});

test('sposta tavolo: rimappa posti, righe e pagamenti; il vecchio tavolo torna libero', () => {
  const { d, tableId, t2, items } = fixture(); // T1 4 posti, T2 2 posti
  const { sessionId, session: s, seat } = open(d, tableId, 3);
  actions.updateSeat(d, { sessionId, seatId: seat(2), guestName: 'Anna' });
  actions.addOrderLine(d, { sessionId, menuItemId: items.tagliere, assignment: { type: 'shared', seatIds: [seat(0), seat(2)] } });
  actions.sendOrder(d, { sessionId });
  actions.addPayment(d, { sessionId, amountCents: 100, seatIds: [seat(0)] });
  const before = computeBill(s).seats.map((x) => x.totalCents);
  actions.moveSession(d, { sessionId, toTableId: t2 });
  const T2 = d.tables.find((t) => t.id === t2);
  assert.equal(s.tableId, t2);
  assert.deepEqual(s.seatsState.slice(0, 2).map((x) => x.seatId), T2.seats.map((x) => x.id));
  assert.equal(s.seatsState[2].isExtra, true);
  assert.equal(s.seatsState[2].guestName, 'Anna');
  assert.deepEqual(s.orderLines[0].assignment.seatIds, [T2.seats[0].id, s.seatsState[2].seatId]);
  assert.deepEqual(s.payments[0].seatIds, [T2.seats[0].id]);
  assert.deepEqual(computeBill(s).seats.map((x) => x.totalCents), before);
  assert.equal(getTableStatus(d.tables[0], d.sessions.find((x) => x.tableId === tableId && x.status !== 'closed')), 'free');
  assert.throws(() => actions.moveSession(d, { sessionId, toTableId: t2 }));
});

test('unisci tavoli: B confluisce in A con posti extra prefissati', () => {
  const { d, tableId, t2, items } = fixture();
  const A = open(d, tableId, 2);
  const B = open(d, t2, 2);
  actions.addOrderLine(d, { sessionId: B.sessionId, menuItemId: items.acqua, assignment: { type: 'seat', seatIds: [B.seat(1)] } });
  actions.mergeSessions(d, { targetSessionId: A.sessionId, sourceSessionId: B.sessionId });
  assert.equal(d.sessions.length, 1);
  const s = A.session;
  assert.equal(s.covers, 4);
  assert.equal(s.seatsState.length, 4);
  assert.deepEqual(s.seatsState.slice(2).map((x) => [x.isExtra, x.extraLabel]), [[true, 'T2·P1'], [true, 'T2·P2']]);
  assert.equal(s.orderLines.length, 1);
  const bill = computeBill(s);
  assert.equal(bill.seats[3].totalCents, 300);
});

test('editor piantina: layout limitato all’area e rotazione normalizzata', () => {
  const { d, tableId } = fixture();
  actions.setLayouts(d, { layouts: [{ id: tableId, layout: { x: 95, y: -5, w: 20, h: 20, rotation: -15 } }] });
  const L = d.tables[0].layout;
  assert.equal(L.x, 80);
  assert.equal(L.y, 0);
  assert.equal(L.rotation, 345);
});
