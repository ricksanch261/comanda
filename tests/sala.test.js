import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actions } from '../js/state/actions.js';
import { fixture, open } from './fixtures.js';

test('apertura tavolo: coperti oltre i posti creano posti extra', () => {
  const { d, t2 } = fixture();
  const { session } = open(d, t2, 3);
  assert.equal(session.seatsState.length, 3);
  assert.equal(session.seatsState[2].isExtra, true);
  assert.equal(session.seatsState[2].extraLabel, 'Extra 1');
  assert.throws(() => actions.openTable(d, { tableId: t2, covers: 2 }), /già aperto/);
});

test('apertura con meno coperti dei posti: solo i primi posti sono occupati', () => {
  const { d, tableId } = fixture();
  const { session, sessionId } = open(d, tableId, 2);
  assert.equal(session.seatsState.length, 2);
  actions.addSeat(d, { sessionId });
  assert.equal(session.seatsState.length, 3);
  assert.equal(session.seatsState[2].isExtra, false);
  assert.equal(session.covers, 3);
});

test('righe per posto, condivise e tavolo', () => {
  const { d, tableId, items } = fixture();
  const { sessionId, session, seat } = open(d, tableId, 4);
  actions.addOrderLine(d, { sessionId, menuItemId: items.tagliatelle, assignment: { type: 'seat', seatIds: [seat(0)] } });
  actions.addOrderLine(d, { sessionId, menuItemId: items.tagliere, assignment: { type: 'shared', seatIds: [seat(2), seat(0)] } });
  actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, quantity: 2, assignment: { type: 'table' } });
  assert.equal(session.orderLines.length, 3);
  assert.deepEqual(session.orderLines[1].assignment.seatIds, [seat(0), seat(2)], 'ordinati per posizione');
  assert.equal(session.orderLines[0].courseIndex, 1, 'portata dalla categoria');
  assert.equal(session.orderLines[2].courseIndex, null);
  assert.ok(session.orderLines.every((l) => l.status === 'draft'));
  assert.throws(() => actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, assignment: { type: 'shared', seatIds: [seat(0)] } }), /almeno 2/);
});

test('varianti: obbligatorie richieste, prezzo con supplementi', () => {
  const { d, tableId, items, groups } = fixture();
  const { sessionId, session, seat } = open(d, tableId, 2);
  const asg = { type: 'seat', seatIds: [seat(0)] };
  assert.throws(() => actions.addOrderLine(d, { sessionId, menuItemId: items.tagliata, assignment: asg }), /Cottura/);
  const g1 = d.modifierGroups.find((g) => g.id === groups.cottura);
  const g2 = d.modifierGroups.find((g) => g.id === groups.aggiunte);
  actions.addOrderLine(d, {
    sessionId,
    menuItemId: items.tagliata,
    assignment: asg,
    modifiers: [{ groupId: g1.id, optionId: g1.options[0].id }, { groupId: g2.id, optionId: g2.options[0].id }, { groupId: g2.id, optionId: g2.options[1].id }],
  });
  assert.equal(session.orderLines[0].unitPriceCents, 2350 + 150 + 100);
  assert.equal(session.orderLines[0].nameSnapshot, 'Tagliata');
});

test('criterio: allergia "latte" + piatto con latte richiede conferma', () => {
  const { d, tableId, items } = fixture();
  const { sessionId, session, seat } = open(d, tableId, 2);
  actions.updateSeat(d, { sessionId, seatId: seat(1), guestName: 'Giulia', allergens: ['latte'] });
  const asg = { type: 'seat', seatIds: [seat(1)] };
  assert.throws(() => actions.addOrderLine(d, { sessionId, menuItemId: items.risotto, assignment: asg }), (e) => e.code === 'allergen');
  assert.equal(session.orderLines.length, 0);
  actions.addOrderLine(d, { sessionId, menuItemId: items.risotto, assignment: asg, allergenOverride: true });
  assert.equal(session.orderLines[0].allergenOverride, true);
  // Riga per il tavolo: coinvolge anche il posto con allergia.
  assert.throws(() => actions.addOrderLine(d, { sessionId, menuItemId: items.risotto, assignment: { type: 'table' } }), (e) => e.code === 'allergen');
  // Nessun conflitto per l'altro posto.
  actions.addOrderLine(d, { sessionId, menuItemId: items.risotto, assignment: { type: 'seat', seatIds: [seat(0)] } });
  assert.equal(session.orderLines[1].allergenOverride, false);
});

test('piatti esauriti non si ordinano', () => {
  const { d, tableId, items } = fixture();
  const { sessionId } = open(d, tableId, 2);
  actions.setItemAvailable(d, { id: items.acqua, available: false });
  assert.throws(() => actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, assignment: { type: 'table' } }), /esaurito/);
});

test('invio comanda: draft → sent; bozze modificabili, inviate no; annulla eliminazione', () => {
  const { d, tableId, items } = fixture();
  const { sessionId, session, seat } = open(d, tableId, 2);
  const l1 = actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, assignment: { type: 'table' } });
  const l2 = actions.addOrderLine(d, { sessionId, menuItemId: items.tagliere, assignment: { type: 'seat', seatIds: [seat(0)] } });
  actions.updateOrderLine(d, { sessionId, lineId: l2, quantity: 2, note: 'senza pepe' });
  const removed = actions.removeOrderLine(d, { sessionId, lineId: l2 });
  assert.equal(session.orderLines.length, 1);
  actions.restoreOrderLine(d, { sessionId, ...removed });
  assert.deepEqual(session.orderLines.map((l) => l.id), [l1, l2]);
  const sent = actions.sendOrder(d, { sessionId, now: '2026-01-01T20:00:00Z' });
  assert.deepEqual(sent, [l1, l2]);
  assert.ok(session.orderLines.every((l) => l.status === 'sent' && l.sentAt === '2026-01-01T20:00:00.000Z'));
  assert.throws(() => actions.updateOrderLine(d, { sessionId, lineId: l1, quantity: 3 }), /storno/);
  assert.throws(() => actions.sendOrder(d, { sessionId }), /Nessuna riga/);
});

test('ripeti: duplica una riga su un altro posto', () => {
  const { d, tableId, items } = fixture();
  const { sessionId, session, seat } = open(d, tableId, 3);
  const l1 = actions.addOrderLine(d, { sessionId, menuItemId: items.tagliere, assignment: { type: 'seat', seatIds: [seat(0)] }, note: 'x' });
  actions.repeatOrderLine(d, { sessionId, lineId: l1, assignment: { type: 'seat', seatIds: [seat(2)] } });
  assert.equal(session.orderLines[1].note, 'x');
  assert.deepEqual(session.orderLines[1].assignment.seatIds, [seat(2)]);
});

test('annulla apertura solo senza righe inviate', () => {
  const { d, tableId, items } = fixture();
  const { sessionId } = open(d, tableId, 2);
  actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, assignment: { type: 'table' } });
  actions.sendOrder(d, { sessionId });
  assert.throws(() => actions.cancelSession(d, { sessionId }));
  const { sessionId: s2 } = open(d, fixture().t2 && d.tables[1].id, 1);
  actions.cancelSession(d, { sessionId: s2 });
  assert.equal(d.sessions.length, 1);
});
