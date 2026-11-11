import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLERGENS,
  ALLERGEN_CODES,
  normalizeAllergens,
  intersectAllergens,
  findAllergenConflicts,
  sessionHasAllergies,
  allergenLabels,
} from '../js/domain/allergens.js';

test('ci sono esattamente i 14 allergeni UE con codice, sigla, etichetta e icona', () => {
  assert.equal(ALLERGENS.length, 14);
  assert.deepEqual(ALLERGEN_CODES, [
    'glutine', 'crostacei', 'uova', 'pesce', 'arachidi', 'soia', 'latte',
    'frutta_a_guscio', 'sedano', 'senape', 'sesamo', 'solfiti', 'lupini', 'molluschi',
  ]);
  for (const a of ALLERGENS) {
    assert.match(a.short, /^[A-Z]{2}$/);
    assert.ok(a.label && a.icon);
  }
  assert.equal(new Set(ALLERGENS.map((a) => a.short)).size, 14);
});

test('normalizeAllergens filtra, deduplica e ordina', () => {
  assert.deepEqual(normalizeAllergens(['latte', 'xyz', 'glutine', 'latte']), ['glutine', 'latte']);
  assert.deepEqual(normalizeAllergens(undefined), []);
  assert.deepEqual(allergenLabels(['latte', 'glutine']), ['Glutine', 'Latte']);
});

test('intersezione tra allergeni del piatto e dell’ospite', () => {
  assert.deepEqual(intersectAllergens(['glutine', 'uova', 'sedano'], ['latte', 'glutine']), ['glutine']);
  assert.deepEqual(intersectAllergens(['pesce'], []), []);
});

const session = {
  seatsState: [
    { seatId: 'p1', guestName: 'Luca', allergens: [] },
    { seatId: 'p2', guestName: 'Giulia', allergens: ['glutine', 'latte'] },
    { seatId: 'p3', guestName: null, allergens: ['latte'] },
  ],
};

test('conflitto su riga per posto', () => {
  const c = findAllergenConflicts(['latte'], session, { type: 'seat', seatIds: ['p2'] });
  assert.deepEqual(c, [{ seatId: 'p2', guestName: 'Giulia', allergens: ['latte'], declared: ['glutine', 'latte'] }]);
  assert.deepEqual(findAllergenConflicts(['latte'], session, { type: 'seat', seatIds: ['p1'] }), []);
});

test('conflitto su riga condivisa considera solo i posti coinvolti', () => {
  const c = findAllergenConflicts(['latte'], session, { type: 'shared', seatIds: ['p1', 'p3'] });
  assert.deepEqual(c.map((x) => x.seatId), ['p3']);
});

test('conflitto su riga del tavolo considera tutti i posti', () => {
  const c = findAllergenConflicts(['latte', 'glutine'], session, { type: 'table' });
  assert.deepEqual(c.map((x) => [x.seatId, x.allergens]), [['p2', ['glutine', 'latte']], ['p3', ['latte']]]);
});

test('piatto senza allergeni non genera conflitti', () => {
  assert.deepEqual(findAllergenConflicts([], session, { type: 'table' }), []);
});

test('criterio di accettazione: allergia "latte" e piatto con latte → avviso', () => {
  const s = { seatsState: [{ seatId: 'a', guestName: null, allergens: ['latte'] }] };
  assert.equal(findAllergenConflicts(['latte'], s, { type: 'seat', seatIds: ['a'] }).length, 1);
});

test('sessionHasAllergies', () => {
  assert.equal(sessionHasAllergies(session), true);
  assert.equal(sessionHasAllergies({ seatsState: [{ allergens: [] }] }), false);
  assert.equal(sessionHasAllergies(null), false);
});
