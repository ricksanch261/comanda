import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineTotal, distribute, computeBill, splitRomana, paymentSummary, aggregateLines } from '../js/domain/billing.js';
import { actions } from '../js/state/actions.js';
import { fixture, open } from './fixtures.js';

const seats = (n) => Array.from({ length: n }, (_, i) => ({ seatId: `p${i + 1}`, guestName: null, allergens: [], isExtra: false }));
let id = 0;
const line = (price, assignment, extra = {}) => ({
  id: `l${++id}`, nameSnapshot: `Piatto ${id}`, unitPriceCents: price, quantity: 1, modifiers: [], assignment, status: 'sent', ...extra,
});
const session = (n, lines, payments = []) => ({ seatsState: seats(n), orderLines: lines, payments, covers: n });
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const seatTotals = (bill) => bill.seats.map((s) => s.totalCents);

function assertInvariant(bill) {
  assert.equal(sum(seatTotals(bill)) + bill.unassignedCents, bill.totalCents, 'Σ quote = totale');
}

test('lineTotal: prezzo × quantità, 0 se stornata', () => {
  assert.equal(lineTotal(line(1300, { type: 'table' }, { quantity: 3 })), 3900);
  assert.equal(lineTotal(line(1300, { type: 'table' }, { status: 'voided' })), 0);
});

test('distribute: resto ai primi', () => {
  assert.deepEqual(distribute(1000, 3), [334, 333, 333]);
  assert.deepEqual(distribute(1001, 3), [334, 334, 333]);
  assert.deepEqual(distribute(999, 3), [333, 333, 333]);
  assert.deepEqual(distribute(5, 7), [1, 1, 1, 1, 1, 0, 0]);
  assert.deepEqual(distribute(0, 2), [0, 0]);
  assert.deepEqual(distribute(-100, 3), [-34, -33, -33]);
  assert.deepEqual(distribute(100, 0), []);
  assert.throws(() => distribute(10.5, 2));
  for (let t = 0; t < 500; t += 7) for (let k = 1; k < 9; k++) assert.equal(sum(distribute(t, k)), t);
});

test('riga singola: tutto al posto', () => {
  const bill = computeBill(session(3, [line(1400, { type: 'seat', seatIds: ['p2'] })]));
  assert.deepEqual(seatTotals(bill), [0, 1400, 0]);
  assert.equal(bill.totalCents, 1400);
  assertInvariant(bill);
});

test('riga condivisa: divisa tra i posti coinvolti, resto ai primi in ordine di posizione', () => {
  // ordine di assegnazione volutamente invertito: conta l'ordine dei posti
  const bill = computeBill(session(4, [line(1000, { type: 'shared', seatIds: ['p4', 'p1', 'p3'] })]));
  assert.deepEqual(seatTotals(bill), [334, 0, 333, 333]);
  assert.deepEqual(bill.seats[0].items[0].share, { of: 3 });
  assertInvariant(bill);
});

test('riga del tavolo: divisa tra tutti i posti occupati', () => {
  const bill = computeBill(session(6, [line(1800, { type: 'table' }), line(301, { type: 'table' })]));
  // 1800/6 = 300; 301/6 = 50 resto 1 → il primo posto prende un centesimo in più
  assert.deepEqual(seatTotals(bill), [351, 350, 350, 350, 350, 350]);
  assertInvariant(bill);
});

test('coperto per ogni posto occupato', () => {
  const bill = computeBill(session(3, [line(1000, { type: 'seat', seatIds: ['p1'] })]), { coverChargeCents: 250 });
  assert.deepEqual(seatTotals(bill), [1250, 250, 250]);
  assert.equal(bill.coverTotalCents, 750);
  assert.equal(bill.totalCents, 1750);
  assert.equal(bill.seats[1].items[0].kind, 'cover');
  assertInvariant(bill);
});

test('righe stornate escluse da ogni totale', () => {
  const bill = computeBill(session(2, [
    line(600, { type: 'seat', seatIds: ['p1'] }, { status: 'voided' }),
    line(1200, { type: 'shared', seatIds: ['p1', 'p2'] }, { status: 'voided' }),
    line(500, { type: 'seat', seatIds: ['p2'] }),
  ]));
  assert.deepEqual(seatTotals(bill), [0, 500]);
  assert.equal(bill.totalCents, 500);
  assert.equal(bill.seats[0].items.length, 0);
  assert.equal(aggregateLines(session(2, [line(600, { type: 'table' }, { status: 'voided' })])).length, 0);
});

test('quantità e varianti nel prezzo unitario', () => {
  const bill = computeBill(session(2, [line(2500, { type: 'shared', seatIds: ['p1', 'p2'] }, { quantity: 3 })]));
  assert.deepEqual(seatTotals(bill), [3750, 3750]);
});

test('alla romana: totale / coperti con la stessa regola del resto', () => {
  assert.deepEqual(splitRomana(17600, 6), [2934, 2934, 2933, 2933, 2933, 2933]);
  assert.equal(sum(splitRomana(17600, 6)), 17600);
  assert.deepEqual(splitRomana(1000, 0), [1000]);
});

test('pagamenti parziali: per posto e per importo, residuo', () => {
  const s = session(3, [line(3000, { type: 'table' }), line(1000, { type: 'seat', seatIds: ['p1'] })]);
  const bill = computeBill(s, { coverChargeCents: 200 });
  assert.deepEqual(seatTotals(bill), [2200, 1200, 1200]);
  s.payments = [
    { id: 'a', amountCents: 2200, method: 'carta', seatIds: ['p1'] },
    { id: 'b', amountCents: 500, method: 'contanti', seatIds: ['p2'] },
    { id: 'c', amountCents: 300, method: 'contanti', seatIds: null },
  ];
  const ps = paymentSummary(s, bill);
  assert.equal(ps.paidCents, 3000);
  assert.equal(ps.residualCents, 1600);
  assert.equal(ps.perSeat.get('p1').status, 'paid');
  assert.equal(ps.perSeat.get('p2').status, 'partial');
  assert.equal(ps.perSeat.get('p2').residualCents, 700);
  assert.equal(ps.perSeat.get('p3').status, 'open');
});

test('pagamento per più posti diviso tra i posti', () => {
  const s = session(2, [line(1001, { type: 'table' })], [{ id: 'x', amountCents: 1001, seatIds: ['p1', 'p2'] }]);
  const ps = paymentSummary(s, computeBill(s));
  assert.equal(ps.perSeat.get('p1').paidCents, 501);
  assert.equal(ps.perSeat.get('p2').paidCents, 500);
  assert.equal(ps.residualCents, 0);
});

test('invariante "somma quote = totale" su casi casuali', () => {
  let seed = 42;
  const rnd = (n) => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed % n;
  };
  for (let iter = 0; iter < 300; iter++) {
    const n = 1 + rnd(12);
    const lines = [];
    for (let j = 0; j < rnd(15); j++) {
      const type = ['seat', 'shared', 'table'][rnd(3)];
      const ids = [...new Set(Array.from({ length: 1 + rnd(n) }, () => `p${1 + rnd(n)}`))];
      const asg = type === 'table' ? { type } : type === 'seat' ? { type, seatIds: [ids[0]] } : { type, seatIds: ids };
      lines.push(line(1 + rnd(5000), asg, { quantity: 1 + rnd(4), status: rnd(6) === 0 ? 'voided' : 'sent' }));
    }
    const bill = computeBill(session(n, lines), { coverChargeCents: rnd(2) ? 250 : 0 });
    assertInvariant(bill);
    assert.equal(bill.unassignedCents, 0);
  }
});

test('criterio: piatto a un posto, a 2 posti e al tavolo ripartito correttamente nel preconto per posto', () => {
  const { d, tableId, items } = fixture({ cover: 250 });
  const { sessionId, session: s, seat } = open(d, tableId, 4);
  actions.addOrderLine(d, { sessionId, menuItemId: items.tagliatelle, assignment: { type: 'seat', seatIds: [seat(0)] } }); // 1300
  actions.addOrderLine(d, { sessionId, menuItemId: items.tagliere, assignment: { type: 'shared', seatIds: [seat(1), seat(2)] } }); // 1800
  actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, quantity: 2, assignment: { type: 'table' } }); // 600
  const bill = computeBill(s, { coverChargeCents: 250 });
  assert.deepEqual(seatTotals(bill), [1300 + 150 + 250, 900 + 150 + 250, 900 + 150 + 250, 150 + 250]);
  assert.equal(bill.totalCents, 1300 + 1800 + 600 + 4 * 250);
  assertInvariant(bill);
});

test('conto: richiesta, pagamenti, chiusura solo a residuo zero o con conferma', () => {
  const { d, tableId, items } = fixture({ cover: 200 });
  const { sessionId, session: s, seat } = open(d, tableId, 2);
  actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, assignment: { type: 'table' } });
  actions.requestBill(d, { sessionId });
  assert.equal(s.status, 'bill_requested');
  assert.throws(() => actions.closeSession(d, { sessionId }), /bozza/);
  actions.sendOrder(d, { sessionId });
  // totale 300 + 2×200 = 700
  actions.addPayment(d, { sessionId, amountCents: 350, method: 'carta', seatIds: [seat(0)] });
  assert.throws(() => actions.addPayment(d, { sessionId, amountCents: 0 }));
  assert.throws(() => actions.closeSession(d, { sessionId }), (e) => e.code === 'residual');
  const pid = actions.addPayment(d, { sessionId, amountCents: 300 });
  actions.removePayment(d, { sessionId, paymentId: pid });
  actions.addPayment(d, { sessionId, amountCents: 350, method: 'contanti', seatIds: [seat(1)] });
  actions.closeSession(d, { sessionId, now: '2026-01-01T23:00:00Z' });
  assert.equal(s.status, 'closed');
  assert.deepEqual(s.billSnapshot, { totalCents: 700, coverChargeCents: 200, residualCents: 0 });
  // il tavolo torna libero: si può riaprire
  open(d, tableId, 2);
});

test('chiusura forzata con residuo', () => {
  const { d, tableId, items } = fixture();
  const { sessionId, session: s } = open(d, tableId, 2);
  actions.addOrderLine(d, { sessionId, menuItemId: items.acqua, assignment: { type: 'table' } });
  actions.sendOrder(d, { sessionId });
  actions.closeSession(d, { sessionId, force: true });
  assert.equal(s.billSnapshot.residualCents, 300);
});
