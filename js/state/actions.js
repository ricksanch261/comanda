/**
 * Azioni nominate dello store.
 * Ogni azione riceve una copia modificabile (draft) di AppData e il payload,
 * la modifica sul posto e può restituire un risultato.
 * Niente DOM e niente storage: sono testabili in Node.
 */
import {
  DomainError,
  SHAPES,
  DESTINATIONS,
  createSettings,
  createArea,
  createTable,

  createCategory,
  createMenuItem,
  createModifierGroup,
  createModifierOption,
  defaultSize,
} from '../domain/models.js';
import { normalizeAllergens } from '../domain/allergens.js';
import { findTableByLabel, buildBulkTables, findFreeSpot } from '../domain/tables.js';
import { newId } from '../domain/ids.js';

const byId = (list, id, what = 'Elemento') => {
  const found = list.find((x) => x.id === id);
  if (!found) throw new DomainError(`${what} non trovato.`, 'not_found');
  return found;
};
const nextSort = (list) => (list.length ? Math.max(...list.map((x) => x.sortOrder ?? 0)) + 1 : 0);
const reorderBy = (list, ids) => {
  ids.forEach((id, i) => {
    const item = list.find((x) => x.id === id);
    if (item) item.sortOrder = i;
  });
  list.sort((a, b) => a.sortOrder - b.sortOrder);
};
const trimmed = (v) => String(v ?? '').trim();

export const openSessionForTable = (d, tableId) =>
  d.sessions.find((s) => s.tableId === tableId && s.status !== 'closed') || null;

/* ------------------------------ Impostazioni ------------------------------ */

export function completeSetup(d, { restaurantName, adminPinHash }) {
  if (!trimmed(restaurantName)) throw new DomainError('Inserisci il nome del locale.');
  if (!adminPinHash) throw new DomainError('PIN non valido.');
  d.settings = createSettings({ ...d.settings, restaurantName: trimmed(restaurantName), adminPinHash });
}

export function updateSettings(d, patch) {
  const next = { ...d.settings, ...patch };
  if (!trimmed(next.restaurantName)) throw new DomainError('Il nome del locale è obbligatorio.');
  next.restaurantName = trimmed(next.restaurantName);
  if (patch.coverCharge) {
    const amount = Math.round(Number(patch.coverCharge.amountCents) || 0);
    if (amount < 0) throw new DomainError('Il coperto non può essere negativo.');
    next.coverCharge = { enabled: Boolean(patch.coverCharge.enabled), amountCents: amount };
  }
  if (patch.waiters) {
    next.waiters = patch.waiters
      .map((w) => ({ id: w.id || newId(), name: trimmed(w.name) }))
      .filter((w) => w.name);
  }
  d.settings = next;
}

export function setAdminPin(d, { adminPinHash }) {
  if (!adminPinHash) throw new DomainError('PIN non valido.');
  d.settings.adminPinHash = adminPinHash;
}

/**
 * Aggiorna l'elenco delle portate.
 * @param {{ name: string, prevIndex: number|null }[]} courses nel nuovo ordine
 * Gli indici di categorie, righe e portate trattenute vengono rimappati.
 */
export function setCourses(d, { courses }) {
  const list = courses.map((c) => ({ name: trimmed(c.name), prevIndex: c.prevIndex ?? null })).filter((c) => c.name);
  if (!list.length) throw new DomainError('Serve almeno una portata.');
  const map = new Map();
  list.forEach((c, i) => {
    if (c.prevIndex !== null) map.set(c.prevIndex, i);
  });
  const remap = (idx) => (idx === null || idx === undefined ? null : map.has(idx) ? map.get(idx) : null);
  d.categories.forEach((c) => (c.courseIndex = remap(c.courseIndex)));
  d.sessions.forEach((s) => {
    if (s.status === 'closed') return;
    s.orderLines.forEach((l) => (l.courseIndex = remap(l.courseIndex)));
    s.heldCourses = s.heldCourses.map(remap).filter((x) => x !== null);
  });
  d.settings.courses = list.map((c) => c.name);
}

export function markBackup(d, { at = new Date().toISOString() } = {}) {
  d.settings.lastBackupAt = at;
}

/* ---------------------------------- Aree ---------------------------------- */

export function addArea(d, { name }) {
  if (!trimmed(name)) throw new DomainError('Inserisci il nome dell’area.');
  const area = createArea({ name, sortOrder: nextSort(d.areas) });
  d.areas.push(area);
  return area.id;
}

export function updateArea(d, { id, name }) {
  if (!trimmed(name)) throw new DomainError('Inserisci il nome dell’area.');
  byId(d.areas, id, 'Area').name = trimmed(name);
}

export function removeArea(d, { id }) {
  byId(d.areas, id, 'Area');
  const n = d.tables.filter((t) => t.areaId === id).length;
  if (n) throw new DomainError(`L’area contiene ${n} ${n === 1 ? 'tavolo' : 'tavoli'}: spostali o eliminali prima.`);
  d.areas = d.areas.filter((a) => a.id !== id);
}

export function reorderAreas(d, { ids }) {
  reorderBy(d.areas, ids);
}

/* --------------------------------- Tavoli --------------------------------- */

function checkLabel(d, label, exceptId) {
  if (!trimmed(label)) throw new DomainError('Inserisci il numero o il nome del tavolo.');
  const dup = findTableByLabel(d.tables, label, exceptId);
  if (dup) throw new DomainError(`Esiste già un tavolo “${dup.label}”.`);
}

export function addTable(d, { label, areaId, shape = 'square', seats = 4 }) {
  checkLabel(d, label);
  byId(d.areas, areaId, 'Area');
  const n = Math.max(1, Math.min(20, Math.floor(seats)));
  const size = defaultSize(shape, n);
  const spot = findFreeSpot(d.tables.filter((t) => t.areaId === areaId).map((t) => t.layout), size.w, size.h);
  const table = createTable({ label: trimmed(label), areaId, shape, seats: n, layout: { ...size, ...spot } });
  d.tables.push(table);
  return table.id;
}

/**
 * Aggiorna un tavolo. `seats` (facoltativo) è l'elenco completo nel nuovo ordine:
 * { id?, label } — senza id = posto nuovo.
 */
export function updateTable(d, { id, label, areaId, shape, active, seats }) {
  const table = byId(d.tables, id, 'Tavolo');
  const session = openSessionForTable(d, id);
  if (label !== undefined) {
    checkLabel(d, label, id);
    table.label = trimmed(label);
  }
  if (areaId !== undefined && areaId !== table.areaId) {
    byId(d.areas, areaId, 'Area');
    table.areaId = areaId;
    const spot = findFreeSpot(d.tables.filter((t) => t.areaId === areaId && t.id !== id).map((t) => t.layout), table.layout.w, table.layout.h);
    table.layout = { ...table.layout, ...spot };
  }
  if (shape !== undefined) {
    if (!SHAPES.includes(shape)) throw new DomainError('Forma non valida.');
    if (shape !== table.shape) {
      const size = defaultSize(shape, seats?.length ?? table.seats.length);
      table.layout = { ...table.layout, w: size.w, h: size.h };
    }
    table.shape = shape;
  }
  if (active !== undefined) {
    if (!active && session) throw new DomainError('Il tavolo ha un servizio aperto: chiudilo prima di disattivarlo.');
    table.active = Boolean(active);
  }
  if (seats !== undefined) {
    if (!seats.length) throw new DomainError('Il tavolo deve avere almeno un posto.');
    if (seats.length > 20) throw new DomainError('Massimo 20 posti per tavolo.');
    if (seats.some((s) => !trimmed(s.label))) throw new DomainError('Ogni posto deve avere un’etichetta.');
    const keep = new Set(seats.filter((s) => s.id).map((s) => s.id));
    if (session) {
      const removed = table.seats.filter((s) => !keep.has(s.id));
      const used = removed.filter((s) => session.seatsState.some((ss) => ss.seatId === s.id));
      if (used.length) throw new DomainError('Non puoi rimuovere posti occupati in un servizio aperto.');
    }
    table.seats = seats.map((s, i) => ({ id: s.id || newId(), label: trimmed(s.label), position: i }));
    if (session) {
      // Mantiene l'ordine dei posti della sessione coerente con le nuove posizioni.
      const pos = new Map(table.seats.map((s) => [s.id, s.position]));
      const regular = session.seatsState.filter((s) => !s.isExtra).sort((a, b) => pos.get(a.seatId) - pos.get(b.seatId));
      session.seatsState = [...regular, ...session.seatsState.filter((s) => s.isExtra)];
    }
  }
}

export function removeTable(d, { id }) {
  byId(d.tables, id, 'Tavolo');
  if (openSessionForTable(d, id)) throw new DomainError('Non puoi eliminare un tavolo con un servizio aperto.');
  d.tables = d.tables.filter((t) => t.id !== id);
}

export function bulkCreateTables(d, { areaId, quantity, seats, start = 1, prefix = '', shape = 'square' }) {
  byId(d.areas, areaId, 'Area');
  const q = Math.floor(quantity);
  const s = Math.floor(seats);
  if (!(q >= 1 && q <= 100)) throw new DomainError('La quantità deve essere tra 1 e 100.');
  if (!(s >= 1 && s <= 20)) throw new DomainError('I posti per tavolo devono essere tra 1 e 20.');
  if (!SHAPES.includes(shape)) throw new DomainError('Forma non valida.');
  const { created, skipped } = buildBulkTables({ areaId, quantity: q, seats: s, start, prefix: trimmed(prefix), shape }, d.tables);
  d.tables.push(...created);
  return { created: created.map((t) => t.id), skipped };
}

export function setTableLayout(d, { id, layout }) {
  const table = byId(d.tables, id, 'Tavolo');
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const next = { ...table.layout, ...layout };
  next.w = clamp(next.w, 6, 100);
  next.h = clamp(next.h, 6, 100);
  next.x = clamp(next.x, 0, 100 - next.w);
  next.y = clamp(next.y, 0, 100 - next.h);
  next.rotation = ((Math.round(next.rotation) % 360) + 360) % 360;
  table.layout = next;
}

/* ---------------------------------- Menu ---------------------------------- */

function checkCourse(d, courseIndex) {
  if (courseIndex === null || courseIndex === undefined || courseIndex === '') return null;
  const i = Number(courseIndex);
  if (!Number.isInteger(i) || i < 0 || i >= d.settings.courses.length) throw new DomainError('Portata non valida.');
  return i;
}

export function addCategory(d, { name, courseIndex = null }) {
  if (!trimmed(name)) throw new DomainError('Inserisci il nome della categoria.');
  const cat = createCategory({ name, courseIndex: checkCourse(d, courseIndex), sortOrder: nextSort(d.categories) });
  d.categories.push(cat);
  return cat.id;
}

export function updateCategory(d, { id, name, courseIndex }) {
  const cat = byId(d.categories, id, 'Categoria');
  if (name !== undefined) {
    if (!trimmed(name)) throw new DomainError('Inserisci il nome della categoria.');
    cat.name = trimmed(name);
  }
  if (courseIndex !== undefined) cat.courseIndex = checkCourse(d, courseIndex);
}

export function removeCategory(d, { id }) {
  byId(d.categories, id, 'Categoria');
  const n = d.menuItems.filter((m) => m.categoryId === id).length;
  if (n) throw new DomainError(`La categoria contiene ${n} ${n === 1 ? 'piatto' : 'piatti'}: spostali o eliminali prima.`);
  d.categories = d.categories.filter((c) => c.id !== id);
}

export function reorderCategories(d, { ids }) {
  reorderBy(d.categories, ids);
}

/** Crea o aggiorna un piatto. Restituisce l'id. */
export function saveMenuItem(d, { item }) {
  const name = trimmed(item.name);
  if (!name) throw new DomainError('Inserisci il nome del piatto.');
  const price = Math.round(Number(item.priceCents));
  if (!Number.isFinite(price) || price < 0) throw new DomainError('Il prezzo non è valido.');
  byId(d.categories, item.categoryId, 'Categoria');
  if (!DESTINATIONS.includes(item.destination)) throw new DomainError('Destinazione non valida.');
  const groupIds = (item.modifierGroupIds || []).filter((id) => d.modifierGroups.some((g) => g.id === id));
  const clean = {
    name,
    description: trimmed(item.description),
    priceCents: price,
    categoryId: item.categoryId,
    allergens: normalizeAllergens(item.allergens),
    destination: item.destination,
    modifierGroupIds: [...new Set(groupIds)],
    available: item.available !== false,
  };
  if (item.id && d.menuItems.some((m) => m.id === item.id)) {
    Object.assign(byId(d.menuItems, item.id, 'Piatto'), clean);
    return item.id;
  }
  const sameCat = d.menuItems.filter((m) => m.categoryId === item.categoryId);
  const created = createMenuItem({ ...clean, sortOrder: nextSort(sameCat) });
  d.menuItems.push(created);
  return created.id;
}

export function removeMenuItem(d, { id }) {
  byId(d.menuItems, id, 'Piatto');
  d.menuItems = d.menuItems.filter((m) => m.id !== id);
}

export function setItemAvailable(d, { id, available }) {
  byId(d.menuItems, id, 'Piatto').available = Boolean(available);
}

export function reorderMenuItems(d, { ids }) {
  reorderBy(d.menuItems, ids);
}

/** Crea o aggiorna un gruppo di varianti. Restituisce l'id. */
export function saveModifierGroup(d, { group }) {
  const name = trimmed(group.name);
  if (!name) throw new DomainError('Inserisci il nome del gruppo.');
  const options = (group.options || [])
    .map((o) => ({ id: o.id || createModifierOption().id, name: trimmed(o.name), priceDeltaCents: Math.round(Number(o.priceDeltaCents) || 0) }))
    .filter((o) => o.name);
  if (!options.length) throw new DomainError('Aggiungi almeno un’opzione.');
  const clean = { name, required: Boolean(group.required), multiple: Boolean(group.multiple), options };
  if (group.id && d.modifierGroups.some((g) => g.id === group.id)) {
    Object.assign(byId(d.modifierGroups, group.id, 'Gruppo'), clean);
    return group.id;
  }
  const created = createModifierGroup(clean);
  d.modifierGroups.push(created);
  return created.id;
}

export function removeModifierGroup(d, { id }) {
  byId(d.modifierGroups, id, 'Gruppo');
  d.modifierGroups = d.modifierGroups.filter((g) => g.id !== id);
  d.menuItems.forEach((m) => (m.modifierGroupIds = m.modifierGroupIds.filter((g) => g !== id)));
}


export const actions = {
  completeSetup,
  updateSettings,
  setAdminPin,
  setCourses,
  markBackup,
  addArea,
  updateArea,
  removeArea,
  reorderAreas,
  addTable,
  updateTable,
  removeTable,
  bulkCreateTables,
  setTableLayout,
  addCategory,
  updateCategory,
  removeCategory,
  reorderCategories,
  saveMenuItem,
  removeMenuItem,
  setItemAvailable,
  reorderMenuItems,
  saveModifierGroup,
  removeModifierGroup,
};
