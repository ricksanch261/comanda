/**
 * Report di base sulle sessioni chiuse.
 */
import { computeBill, lineTotal } from './billing.js';

/** Totale di una sessione chiusa (istantanea se presente, altrimenti ricalcolato). */
export function sessionTotal(session) {
  if (session.billSnapshot) return session.billSnapshot.totalCents;
  return computeBill(session).totalCents;
}

/**
 * @param {object[]} sessions
 * @param {{ from?: Date|string, to?: Date|string }} range estremi inclusi (closedAt)
 */
export function computeReport(sessions, { from = null, to = null } = {}) {
  const f = from ? new Date(from).getTime() : -Infinity;
  const t = to ? new Date(to).getTime() : Infinity;
  const closed = sessions.filter((s) => {
    if (s.status !== 'closed' || !s.closedAt) return false;
    const at = new Date(s.closedAt).getTime();
    return at >= f && at <= t;
  });
  let revenue = 0;
  let paid = 0;
  let covers = 0;
  const items = new Map();
  for (const s of closed) {
    revenue += sessionTotal(s);
    paid += (s.payments || []).reduce((a, p) => a + p.amountCents, 0);
    covers += s.covers || 0;
    for (const l of s.orderLines) {
      if (l.status === 'voided') continue;
      const key = l.menuItemId || l.nameSnapshot;
      const cur = items.get(key) || { name: l.nameSnapshot, quantity: 0, revenueCents: 0 };
      cur.quantity += l.quantity;
      cur.revenueCents += lineTotal(l);
      items.set(key, cur);
    }
  }
  const list = [...items.values()];
  return {
    sessions: closed.length,
    revenueCents: revenue,
    paidCents: paid,
    covers,
    averagePerCoverCents: covers ? Math.round(revenue / covers) : 0,
    topByQuantity: [...list].sort((a, b) => b.quantity - a.quantity || b.revenueCents - a.revenueCents).slice(0, 10),
    topByRevenue: [...list].sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity).slice(0, 10),
  };
}

/** Sessioni chiuse prima di una certa data (per l'archiviazione). */
export function sessionsClosedBefore(sessions, date) {
  const limit = new Date(date).getTime();
  return sessions.filter((s) => s.status === 'closed' && s.closedAt && new Date(s.closedAt).getTime() < limit);
}
