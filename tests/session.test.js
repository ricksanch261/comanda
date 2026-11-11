import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTableStatus, timerStart, groupByCourse, sendableLines, assignmentLabel } from '../js/domain/session.js';

const base = () => ({ status: 'open', openedAt: '2026-01-01T20:00:00Z', orderLines: [], heldCourses: [], seatsState: [], payments: [] });

test('stato del tavolo derivato dalla sessione', () => {
  assert.equal(getTableStatus({}, null), 'free');
  assert.equal(getTableStatus({}, { ...base(), status: 'closed' }), 'free');
  const s = base();
  assert.equal(getTableStatus({}, s), 'open');
  s.orderLines.push({ status: 'draft', courseIndex: 1 });
  assert.equal(getTableStatus({}, s), 'open');
  s.orderLines.push({ status: 'sent', courseIndex: 0, sentAt: '2026-01-01T20:10:00Z' });
  assert.equal(getTableStatus({}, s), 'active');
  s.heldCourses = [1];
  assert.equal(getTableStatus({}, s), 'held');
  s.status = 'bill_requested';
  assert.equal(getTableStatus({}, s), 'bill');
});

test('timer: dall’apertura se nulla è inviato, poi dall’ultima comanda', () => {
  const s = base();
  assert.equal(timerStart(s), s.openedAt);
  s.orderLines.push({ status: 'sent', sentAt: '2026-01-01T20:10:00Z' }, { status: 'sent', sentAt: '2026-01-01T20:30:00Z' });
  assert.equal(timerStart(s), '2026-01-01T20:30:00Z');
});

test('raggruppamento per portata e righe inviabili', () => {
  const s = base();
  s.orderLines = [
    { id: 'a', status: 'draft', courseIndex: 2 },
    { id: 'b', status: 'draft', courseIndex: 0 },
    { id: 'c', status: 'sent', courseIndex: null },
    { id: 'd', status: 'draft', courseIndex: 1 },
  ];
  const g = groupByCourse(s.orderLines, ['Antipasti', 'Primi', 'Secondi']);
  assert.deepEqual(g.map((x) => x.name), ['Antipasti', 'Primi', 'Secondi', 'Altro']);
  s.heldCourses = [2];
  assert.deepEqual(sendableLines(s).map((l) => l.id), ['b', 'd']);
});

test('etichetta assegnazione', () => {
  const table = { seats: [{ id: 'p1', label: 'P1' }, { id: 'p2', label: 'P2' }] };
  const s = { ...base(), seatsState: [{ seatId: 'p1' }, { seatId: 'p2' }, { seatId: 'x', isExtra: true, extraLabel: 'Extra 1' }] };
  assert.equal(assignmentLabel(table, s, { type: 'table' }), 'Tavolo');
  assert.equal(assignmentLabel(table, s, { type: 'shared', seatIds: ['p1', 'x'] }), 'P1, Extra 1');
});
