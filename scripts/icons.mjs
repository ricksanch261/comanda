/**
 * Elenca le icone Material Symbols usate nel codice (per il sottoinsieme del font).
 *   node scripts/icons.mjs          → stampa l'elenco ordinato, separato da virgole
 *   node scripts/icons.mjs --write  → aggiorna index.html
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
}

/** Primo argomento di ogni chiamata icon( … ). */
function firstArgs(src) {
  const out = [];
  const re = /\bicon\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let s = '';
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') {
        if (depth === 0) break;
        depth--;
      } else if (c === ',' && depth === 0) break;
      s += c;
    }
    out.push(s);
  }
  return out;
}

export function collectIcons(root = new URL('..', import.meta.url).pathname) {
  const names = new Set();
  const word = /'([a-z][a-z0-9_]*)'/g;
  for (const file of walk(join(root, 'js'))) {
    const src = readFileSync(file, 'utf8');
    for (const arg of firstArgs(src)) {
      // Esclude i confronti (es. k === 'bar' ? …).
      const clean = arg.replace(/[!=]==?\s*'[^']*'|'[^']*'\s*[!=]==?/g, '');
      for (const m of clean.matchAll(word)) names.add(m[1]);
    }
    for (const m of src.matchAll(/\b(?:icon|headIcon|iconName|backIcon)\s*[:=]\s*'([a-z][a-z0-9_]*)'/g)) names.add(m[1]);
    for (const m of src.matchAll(/\bcard\('([a-z][a-z0-9_]*)'/g)) names.add(m[1]);
  }
  return [...names].sort();
}

if (import.meta.url === `file://${process.argv[1]}` && !process.argv.includes('--write')) {
  console.log(collectIcons().join(','));
}

/** Aggiorna il parametro icon_names del font in index.html:  node scripts/icons.mjs --write */
if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--write')) {
  const { writeFileSync } = await import('node:fs');
  const file = new URL('../index.html', import.meta.url);
  const html = readFileSync(file, 'utf8');
  const next = html.replace(/icon_names=[a-z0-9_,]+/, `icon_names=${collectIcons().join(',')}`);
  writeFileSync(file, next);
  console.log('index.html aggiornato');
}
