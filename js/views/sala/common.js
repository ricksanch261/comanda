/**
 * Utilità condivise dalle schermate di Sala.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { getPrefs } from '../../state/prefs.js';
import { TABLE_STATUSES, getTableStatus, openSessionOf, timerStart, hasHeldWork } from '../../domain/session.js';
import { formatDuration } from '../../utils/format.js';

export { TABLE_STATUSES };

/** Stato UI per tavolo (filtro ordine, multi-selezione), sopravvive ai cambi di route. */
const uiByTable = new Map();
export function tableUi(tableId) {
  if (!uiByTable.has(tableId)) uiByTable.set(tableId, { filter: 'all', multi: false, sel: [], lastCat: null });
  return uiByTable.get(tableId);
}

export function currentWaiter() {
  const { waiters } = app.data.settings;
  const id = getPrefs().waiterId;
  return waiters.find((w) => w.id === id) || null;
}

export function waiterName(id) {
  return app.data.settings.waiters.find((w) => w.id === id)?.name ?? null;
}

export function tableInfo(table) {
  const session = openSessionOf(app.data.sessions, table.id);
  const status = getTableStatus(table, session);
  return { table, session, status, meta: TABLE_STATUSES[status] };
}

export function elapsed(session, now = Date.now()) {
  return formatDuration(now - new Date(timerStart(session)).getTime());
}

export function timerIsLate(session, now = Date.now()) {
  return hasHeldWork(session) && now - new Date(timerStart(session)).getTime() >= 20 * 60000;
}

export function statusPill(status) {
  const m = TABLE_STATUSES[status];
  return h('span', { class: ['status-pill', `status-pill--${status}`] }, icon(m.icon), m.label);
}

export function timerPill(session) {
  return h('span', { class: ['pill', timerIsLate(session) && 'pill--held'], title: 'Tempo dall’ultima comanda (o dall’apertura)' },
    icon('timer'), h('span', { class: 'visually-hidden' }, 'Tempo: '), elapsed(session));
}

/** Parsing del destinatario da query (?per=seat:ID | shared:ID,ID | table). */
export function parseTarget(per, session) {
  if (!per || !session) return null;
  if (per === 'table') return { type: 'table' };
  const [type, list] = per.split(':');
  const ids = (list || '').split(',').filter((id) => session.seatsState.some((s) => s.seatId === id));
  if (type === 'seat' && ids.length === 1) return { type: 'seat', seatIds: ids };
  if (type === 'shared' && ids.length >= 2) return { type: 'shared', seatIds: ids };
  return null;
}

export function encodeTarget(asg) {
  if (!asg || asg.type === 'table') return 'table';
  return `${asg.type}:${asg.seatIds.join(',')}`;
}

export function assignmentTag(asg, label) {
  if (!asg || asg.type === 'table') return h('span', { class: 'assign-tag' }, icon('table_restaurant'), 'Tavolo');
  if (asg.type === 'shared') return h('span', { class: 'assign-tag', title: `Condiviso: ${label}` }, icon('group'), `×${asg.seatIds.length}`);
  return h('span', { class: 'assign-tag' }, icon('person'), label);
}

/** Sala usa larghezza "telefono" sotto i 768px. */
export const isPhone = () => !window.matchMedia('(min-width: 768px)').matches;
