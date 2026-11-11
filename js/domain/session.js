/**
 * Funzioni pure sulle sessioni (servizi) dei tavoli.
 */
import { sessionHasAllergies } from './allergens.js';

/** Stato del tavolo, derivato (non salvato). */
export const TABLE_STATUSES = {
  free: { key: 'free', label: 'Libero', icon: 'event_available' },
  open: { key: 'open', label: 'Aperto', icon: 'schedule' },
  active: { key: 'active', label: 'In corso', icon: 'restaurant' },
  held: { key: 'held', label: 'In attesa', longLabel: 'Portata in attesa', icon: 'pause_circle' },
  bill: { key: 'bill', label: 'Conto', icon: 'receipt_long' },
};

/**
 * getTableStatus(table, session) → 'free' | 'open' | 'active' | 'held' | 'bill'
 * (libero, aperto, in_corso, portata_in_attesa, conto)
 */
export function getTableStatus(table, session) {
  if (!session || session.status === 'closed') return 'free';
  if (session.status === 'bill_requested') return 'bill';
  if (hasHeldWork(session)) return 'held';
  if (session.orderLines.some((l) => l.status === 'sent' || l.status === 'served')) return 'active';
  return 'open';
}

/** Ci sono portate trattenute (con righe ancora da marciare). */
export function hasHeldWork(session) {
  if (!session.heldCourses?.length) return false;
  const held = new Set(session.heldCourses);
  return session.orderLines.some((l) => l.status === 'draft' && held.has(l.courseIndex));
}

export function hasAllergies(session) {
  return sessionHasAllergies(session);
}

/** Momento di riferimento del timer: ultima comanda inviata, altrimenti apertura. */
export function timerStart(session) {
  const sent = session.orderLines.map((l) => l.sentAt).filter(Boolean).sort();
  return sent.length ? sent[sent.length - 1] : session.openedAt;
}

export function openSessionOf(sessions, tableId) {
  return sessions.find((s) => s.tableId === tableId && s.status !== 'closed') || null;
}

/** Etichetta di un posto della sessione (posto configurato o extra). */
export function seatLabelOf(table, seatState) {
  if (!seatState) return '?';
  if (seatState.isExtra) return seatState.extraLabel || 'Extra';
  return table?.seats.find((s) => s.id === seatState.seatId)?.label ?? '?';
}

/**
 * Posti della sessione nell'ordine di ripartizione (posizione, poi extra).
 * @returns {{ seatId, label, guestName, allergens, isExtra, index }[]}
 */
export function sessionSeats(table, session) {
  return (session?.seatsState || []).map((s, index) => ({
    seatId: s.seatId,
    label: seatLabelOf(table, s),
    guestName: s.guestName || null,
    allergens: s.allergens || [],
    isExtra: Boolean(s.isExtra),
    index,
  }));
}

/** Descrizione breve di un'assegnazione: "P1", "P1, P3", "Tavolo". */
export function assignmentLabel(table, session, assignment) {
  if (!assignment || assignment.type === 'table') return 'Tavolo';
  const map = new Map(sessionSeats(table, session).map((s) => [s.seatId, s.label]));
  return assignment.seatIds.map((id) => map.get(id) ?? '?').join(', ');
}

export function lineSeatIds(line) {
  return line.assignment?.type === 'table' ? [] : line.assignment?.seatIds || [];
}

/** La riga riguarda il posto (singolo o condiviso)? */
export function lineTouchesSeat(line, seatId) {
  return lineSeatIds(line).includes(seatId);
}

export function draftLines(session) {
  return session.orderLines.filter((l) => l.status === 'draft');
}

/** Righe in bozza che "Invia comanda" spedirebbe (escluse le portate trattenute). */
export function sendableLines(session) {
  const held = new Set(session.heldCourses || []);
  return session.orderLines.filter((l) => l.status === 'draft' && !held.has(l.courseIndex));
}

/**
 * Raggruppa le righe per portata, nell'ordine delle portate; null in fondo.
 * @returns {{ courseIndex: number|null, name: string, lines: object[] }[]}
 */
export function groupByCourse(lines, courses) {
  const groups = new Map();
  for (const l of lines) {
    const k = l.courseIndex ?? null;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(l);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a - b))
    .map(([courseIndex, ls]) => ({
      courseIndex,
      name: courseIndex === null ? 'Altro' : courses[courseIndex] ?? `Portata ${courseIndex + 1}`,
      lines: ls,
    }));
}
