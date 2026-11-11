import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/state/store.js';
import { compile, matchRoute } from '../js/router.js';
import { formatCents, formatEuro, parseEuroToCents, formatDuration } from '../js/utils/format.js';
import { sha256Fallback, sha256Hex } from '../js/utils/sha256.js';

test('lo store applica le azioni, notifica e salva con debounce', async () => {
  const saved = [];
  const store = createStore({
    data: { n: 0 },
    repository: { save: async (d) => saved.push(d) },
    actions: { inc: (d, by = 1) => { d.n += by; return d.n; } },
    debounceMs: 10,
  });
  const seen = [];
  store.subscribe((s, a) => seen.push([s.n, a]));
  assert.equal(store.actions.inc(2), 2);
  store.dispatch('inc');
  assert.equal(store.getState().n, 3);
  assert.deepEqual(seen, [[2, 'inc'], [3, 'inc']]);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].n, 3);
});

test('se un’azione lancia un errore lo stato resta invariato', () => {
  const store = createStore({
    data: { list: [1] },
    actions: { bad: (d) => { d.list.push(2); throw new Error('no'); } },
  });
  assert.throws(() => store.actions.bad());
  assert.deepEqual(store.getState().list, [1]);
});

test('router: pattern con parametri e parametri facoltativi', () => {
  const routes = [{ path: '/sala/tavolo/:id' }, { path: '/admin/piantina/:areaId?' }, { path: '/' }];
  assert.deepEqual(matchRoute(routes, '/sala/tavolo/abc').params, { id: 'abc' });
  assert.deepEqual(matchRoute(routes, '/admin/piantina').params, {});
  assert.deepEqual(matchRoute(routes, '/admin/piantina/x1').params, { areaId: 'x1' });
  assert.equal(matchRoute(routes, '/').route.path, '/');
  assert.equal(matchRoute(routes, '/nope'), null);
  assert.ok(compile('/a/:b').re.test('/a/1/'));
});

test('formattazione valuta it-IT', () => {
  assert.equal(formatCents(1300), '13,00');
  assert.equal(formatEuro(123450), '€ 1.234,50');
  assert.equal(parseEuroToCents('13,5'), 1350);
  assert.equal(parseEuroToCents('€ 2,50'), 250);
  assert.equal(parseEuroToCents('1.234,50'), 123450);
  assert.equal(parseEuroToCents('13.50'), 1350);
  assert.equal(parseEuroToCents('abc'), null);
  assert.equal(parseEuroToCents('-3'), -300);
  assert.equal(formatDuration(6 * 60000), '6′');
  assert.equal(formatDuration(72 * 60000), '1h12′');
});

test('sha256: fallback JS coincide con Web Crypto', async () => {
  const bytes = new TextEncoder().encode('1234');
  assert.equal(sha256Fallback(bytes), await sha256Hex('1234'));
  assert.equal(sha256Fallback(new TextEncoder().encode('')), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
