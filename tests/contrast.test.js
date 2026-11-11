import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf('}', start);
  return Object.fromEntries([...css.slice(start, end).matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}
const light = block(':root');
const dark = { ...light, ...block('[data-theme="dark"]') };

function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [primo piano, sfondo, minimo]
const TEXT = 4.5;
const GRAPHIC = 3;
const pairs = (t) => [
  [t['--color-text'], t['--color-bg'], TEXT],
  [t['--color-text'], t['--color-surface'], TEXT],
  [t['--color-text'], t['--color-surface-2'], TEXT],
  [t['--color-text-muted'], t['--color-bg'], TEXT],
  [t['--color-text-muted'], t['--color-surface'], TEXT],
  [t['--color-on-primary'], t['--color-primary'], TEXT],
  [t['--color-primary'], t['--color-surface'], TEXT],
  [t['--color-danger'], t['--color-surface'], TEXT],
  [t['--color-success'], t['--color-surface'], TEXT],
  [t['--color-info'], t['--color-surface'], TEXT],
  [t['--color-text'], t['--status-open'], TEXT],
  [t['--color-on-primary'], t['--status-active'], TEXT],
  ['#1D1A16', t['--status-held'], TEXT],
  [t['--color-on-primary'], t['--status-bill'], TEXT],
  [t['--status-allergen'], t['--color-surface'], GRAPHIC],
  ['#FFFFFF', t['--status-allergen'], GRAPHIC], // icona nel badge allergie
  [t['--color-info'], t['--color-bg'], GRAPHIC], // anello di focus
];

test('testo su rosso allergeni: bianco nel tema chiaro, scuro nel tema scuro', () => {
  assert.ok(ratio('#FFFFFF', light['--status-allergen']) >= TEXT);
  assert.ok(ratio('#1D1A16', dark['--status-allergen']) >= TEXT);
});

for (const [name, tokens] of [['chiaro', light], ['scuro', dark]]) {
  test(`contrasto WCAG AA dei token principali · tema ${name}`, () => {
    for (const [fg, bg, min] of pairs(tokens)) {
      const r = ratio(fg, bg);
      assert.ok(r >= min, `${fg} su ${bg}: ${r.toFixed(2)} < ${min}`);
    }
  });
}
