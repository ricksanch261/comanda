/**
 * Regole sui tavoli: etichette, creazione in blocco, posizionamento in piantina.
 * Le coordinate della piantina sono in % di un'area quadrata (0–100).
 */
import { createTable, defaultSize } from './models.js';

export function normalizeLabel(label) {
  return String(label ?? '').trim().toLocaleLowerCase('it-IT');
}

export function findTableByLabel(tables, label, exceptId = null) {
  const n = normalizeLabel(label);
  return tables.find((t) => t.id !== exceptId && normalizeLabel(t.label) === n) || null;
}

/**
 * Anteprima della creazione in blocco.
 * @returns {{ label: string, exists: boolean, existingAreaId?: string }[]}
 */
export function planBulkTables({ quantity, start = 1, prefix = '' }, existingTables) {
  const out = [];
  const qty = Math.max(0, Math.min(200, Math.floor(quantity || 0)));
  for (let i = 0; i < qty; i++) {
    const label = `${prefix ?? ''}${Number(start) + i}`.trim();
    const existing = findTableByLabel(existingTables, label);
    out.push({ label, exists: Boolean(existing), existingAreaId: existing?.areaId });
  }
  return out;
}

function overlaps(a, b, gap = 2) {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

/** Primo spazio libero (scansione a righe) per un tavolo w×h nella piantina. */
export function findFreeSpot(occupied, w, h, step = 2.5) {
  for (let y = 3; y + h <= 97; y += step) {
    for (let x = 3; x + w <= 97; x += step) {
      const r = { x, y, w, h };
      if (!occupied.some((o) => overlaps(r, o))) return { x, y };
    }
  }
  // Nessuno spazio: sovrappone in basso a destra (l'utente riordina dall'editor).
  return { x: Math.max(0, 97 - w), y: Math.max(0, 97 - h) };
}

/** Crea gli oggetti Table per una creazione in blocco (salta le etichette esistenti). */
export function buildBulkTables({ areaId, quantity, seats, start, prefix, shape }, existingTables) {
  const plan = planBulkTables({ quantity, start, prefix }, existingTables);
  const occupied = existingTables.filter((t) => t.areaId === areaId).map((t) => t.layout);
  const created = [];
  for (const p of plan) {
    if (p.exists) continue;
    const size = defaultSize(shape, seats);
    const spot = findFreeSpot(occupied, size.w, size.h);
    const table = createTable({ label: p.label, areaId, shape, seats, layout: { ...size, ...spot } });
    occupied.push(table.layout);
    created.push(table);
  }
  return { created, skipped: plan.filter((p) => p.exists).map((p) => p.label) };
}
