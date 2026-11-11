import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectIcons } from '../scripts/icons.mjs';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((f) => {
    const p = `${dir}/${f}`;
    return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
  });
}

const sw = read('service-worker.js');
const assets = [...sw.matchAll(/^\s*'([^']+)',$/gm)].map((m) => m[1]);

test('il service worker precarica tutti gli asset dell’app', () => {
  const files = [...walk('js'), ...walk('css'), ...walk('assets/icons'), 'index.html', 'manifest.webmanifest'];
  for (const f of files) assert.ok(assets.includes(f), `manca nel precache: ${f}`);
  for (const a of assets) if (a !== './') assert.ok(existsSync(join(root, a)), `file inesistente nel precache: ${a}`);
  assert.match(sw, /const CACHE_VERSION = '[^']+'/);
});

test('manifest con percorsi relativi, icone e display standalone', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.orientation, 'any');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.ok(m.icons.some((i) => i.sizes === '192x192'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const i of m.icons) {
    assert.ok(!i.src.startsWith('/'), 'percorso relativo');
    assert.ok(existsSync(join(root, i.src)));
  }
});

test('index.html usa solo percorsi relativi', () => {
  const html = read('index.html');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (m[1].startsWith('http')) continue;
    assert.ok(!m[1].startsWith('/'), `percorso assoluto: ${m[1]}`);
  }
});

test('il sottoinsieme del font icone contiene tutte le icone usate (npm run icons)', () => {
  const html = read('index.html');
  const list = new Set(/icon_names=([a-z0-9_,]+)/.exec(html)[1].split(','));
  const missing = collectIcons(root).filter((n) => !list.has(n));
  assert.deepEqual(missing, [], 'esegui: npm run icons');
  const sorted = [...list];
  assert.deepEqual(sorted, [...sorted].sort(), 'icon_names deve essere in ordine alfabetico');
});
