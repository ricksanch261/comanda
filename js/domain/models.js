/**
 * Factory e validazione delle entità del dominio.
 * Tutti gli importi sono in centesimi (interi).
 */
import { newId } from './ids.js';

export const SCHEMA_VERSION = 1;

export const DEFAULT_COURSES = ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci'];
export const SHAPES = ['round', 'square', 'rect'];
export const DESTINATIONS = ['cucina', 'bar'];
export const PAYMENT_METHODS = ['contanti', 'carta', 'altro'];
export const LINE_STATUSES = ['draft', 'sent', 'served', 'voided'];
export const SESSION_STATUSES = ['open', 'bill_requested', 'closed'];

export class DomainError extends Error {
  constructor(message, code = 'domain') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function createSettings(patch = {}) {
  return {
    restaurantName: '',
    currency: 'EUR',
    coverCharge: { enabled: false, amountCents: 0 },
    adminPinHash: '',
    courses: [...DEFAULT_COURSES],
    waiters: [],
    lastBackupAt: null,
    ...patch,
  };
}

export function createEmptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: createSettings(),
    areas: [],
    tables: [],
    categories: [],
    menuItems: [],
    modifierGroups: [],
    sessions: [],
  };
}

export function createArea({ name, sortOrder = 0 } = {}) {
  return { id: newId(), name: String(name ?? '').trim() || 'Nuova area', sortOrder };
}

export function seatLabel(index) {
  return `P${index + 1}`;
}

export function createSeats(count, startPosition = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: newId(),
    label: seatLabel(startPosition + i),
    position: startPosition + i,
  }));
}

/** Dimensioni di default (in % della piantina quadrata) per forma. */
export function defaultSize(shape, seatCount = 4) {
  if (shape === 'rect') return { w: Math.min(60, 20 + Math.ceil(seatCount / 2) * 7.5), h: 20 };
  if (shape === 'square') return { w: 20, h: 20 };
  return { w: 18, h: 18 };
}

export function createTable({ label, areaId, shape = 'square', seats = 4, layout } = {}) {
  const size = defaultSize(shape, seats);
  return {
    id: newId(),
    label: String(label ?? '').trim(),
    areaId,
    shape: SHAPES.includes(shape) ? shape : 'square',
    layout: { x: 5, y: 5, w: size.w, h: size.h, rotation: 0, ...(layout || {}) },
    active: true,
    seats: createSeats(seats),
  };
}

export function createCategory({ name, sortOrder = 0, courseIndex = null } = {}) {
  return { id: newId(), name: String(name ?? '').trim() || 'Nuova categoria', sortOrder, courseIndex };
}

export function createMenuItem(patch = {}) {
  return {
    id: newId(),
    categoryId: null,
    name: '',
    description: '',
    priceCents: 0,
    allergens: [],
    destination: 'cucina',
    modifierGroupIds: [],
    available: true,
    sortOrder: 0,
    ...patch,
  };
}

export function createModifierGroup(patch = {}) {
  return {
    id: newId(),
    name: '',
    required: false,
    multiple: false,
    options: [],
    ...patch,
  };
}

export function createModifierOption({ name = '', priceDeltaCents = 0 } = {}) {
  return { id: newId(), name, priceDeltaCents };
}

export function createSeatState({ seatId, isExtra = false, extraLabel } = {}) {
  const s = { seatId: seatId ?? newId(), guestName: null, allergens: [], isExtra };
  if (isExtra) s.extraLabel = extraLabel ?? 'Extra';
  return s;
}

export function createSession({ tableId, covers, waiterId = null, seatsState = [], now = new Date() }) {
  return {
    id: newId(),
    tableId,
    status: 'open',
    openedAt: now.toISOString(),
    closedAt: null,
    waiterId,
    covers,
    seatsState,
    orderLines: [],
    heldCourses: [],
    payments: [],
  };
}

export function createOrderLine(patch = {}) {
  return {
    id: newId(),
    menuItemId: null,
    nameSnapshot: '',
    unitPriceCents: 0,
    quantity: 1,
    modifiers: [],
    note: '',
    assignment: { type: 'table' },
    courseIndex: null,
    status: 'draft',
    voidReason: null,
    createdAt: new Date().toISOString(),
    sentAt: null,
    servedAt: null,
    allergenOverride: false,
    ...patch,
  };
}

/* ------------------------------------------------------------------ */
/* Validazione                                                         */
/* ------------------------------------------------------------------ */

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v);

/**
 * Valida la struttura di AppData (dopo le migrazioni).
 * Restituisce un array di messaggi d'errore (vuoto = valido).
 */
export function validateAppData(data) {
  const errors = [];
  if (!isObj(data)) return ['Il file non contiene un oggetto valido.'];
  if (!isInt(data.schemaVersion)) errors.push('schemaVersion mancante o non valida.');
  if (!isObj(data.settings)) errors.push('settings mancante.');
  for (const key of ['areas', 'tables', 'categories', 'menuItems', 'modifierGroups', 'sessions']) {
    if (!Array.isArray(data[key])) errors.push(`${key} deve essere un elenco.`);
  }
  if (errors.length) return errors;

  const ids = new Set();
  const checkId = (e, where) => {
    if (!e || typeof e.id !== 'string' || !e.id) errors.push(`${where}: id mancante.`);
    else if (ids.has(e.id)) errors.push(`${where}: id duplicato ${e.id}.`);
    else ids.add(e.id);
  };
  data.areas.forEach((a, i) => checkId(a, `areas[${i}]`));
  data.tables.forEach((t, i) => {
    checkId(t, `tables[${i}]`);
    if (!Array.isArray(t.seats)) errors.push(`tables[${i}].seats deve essere un elenco.`);
    if (!SHAPES.includes(t.shape)) errors.push(`tables[${i}].shape non valida.`);
  });
  data.categories.forEach((c, i) => checkId(c, `categories[${i}]`));
  data.menuItems.forEach((m, i) => {
    checkId(m, `menuItems[${i}]`);
    if (!isInt(m.priceCents)) errors.push(`menuItems[${i}].priceCents deve essere un intero.`);
  });
  data.modifierGroups.forEach((g, i) => checkId(g, `modifierGroups[${i}]`));
  data.sessions.forEach((s, i) => {
    checkId(s, `sessions[${i}]`);
    if (!SESSION_STATUSES.includes(s.status)) errors.push(`sessions[${i}].status non valido.`);
    if (!Array.isArray(s.orderLines)) errors.push(`sessions[${i}].orderLines deve essere un elenco.`);
  });
  return errors;
}
