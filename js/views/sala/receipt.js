/**
 * Preconto stampabile (schermata 26): formato scontrino 80 mm, "Documento non fiscale".
 * Viene generato in #print-root e stampato con window.print().
 */
import { h } from '../../utils/dom.js';
import { app } from '../../app.js';
import { computeBill, coverChargeFromSettings, aggregateLines, splitRomana, paymentSummary } from '../../domain/billing.js';
import { sessionSeats } from '../../domain/session.js';
import { formatCents, formatDateTime } from '../../utils/format.js';

const row = (left, right, cls = '') => h('div', { class: ['rc-row', cls] }, h('span', {}, left), h('span', { class: 'rc-amt' }, right));

export function buildReceipt({ table, session, mode = 'total', now = new Date() }) {
  const { settings } = app.data;
  const cover = coverChargeFromSettings(settings);
  const bill = computeBill(session, { coverChargeCents: cover });
  const pay = paymentSummary(session, bill);
  const seats = sessionSeats(table, session);
  const body = [];

  if (mode === 'seat') {
    for (const s of bill.seats) {
      const info = seats.find((x) => x.seatId === s.seatId);
      if (!s.items.length) continue;
      body.push(h('div', { class: 'rc-sub' }, info.guestName ? `${info.label} · ${info.guestName}` : info.label));
      for (const it of s.items) {
        const name = it.kind === 'cover' ? 'Coperto' : `${it.quantity > 1 ? `${it.quantity}× ` : ''}${it.name}${it.share ? ` (1/${it.share.of})` : ''}`;
        body.push(row(name, formatCents(it.amountCents)));
      }
      body.push(row('Subtotale', formatCents(s.totalCents), 'rc-bold'));
    }
  } else {
    for (const l of aggregateLines(session)) {
      body.push(row(`${l.quantity}× ${l.name}${l.detail ? ` (${l.detail})` : ''}`, formatCents(l.amountCents)));
    }
    if (bill.coverTotalCents) body.push(row(`Coperto ${bill.seats.length} × ${formatCents(cover)}`, formatCents(bill.coverTotalCents)));
  }

  return h('div', { class: 'receipt' },
    h('div', { class: 'rc-center rc-title' }, settings.restaurantName.toUpperCase()),
    h('div', { class: 'rc-sep' }),
    row(`Tavolo ${table.label} · ${session.covers} coperti`, ''),
    row(formatDateTime(now.toISOString()), ''),
    h('div', { class: 'rc-sep' }),
    body,
    h('div', { class: 'rc-sep' }),
    row('TOTALE', `€ ${formatCents(bill.totalCents)}`, 'rc-total'),
    mode === 'romana' ? row(`Per persona (÷${session.covers})`, `€ ${formatCents(splitRomana(bill.totalCents, session.covers)[0])}`) : null,
    pay.paidCents ? row('Pagato', `€ ${formatCents(pay.paidCents)}`) : null,
    pay.paidCents ? row('Residuo', `€ ${formatCents(Math.max(0, pay.residualCents))}`, 'rc-bold') : null,
    h('div', { class: 'rc-sep' }),
    h('div', { class: 'rc-center rc-bold' }, 'DOCUMENTO NON FISCALE'),
    h('div', { class: 'rc-center' }, 'Preconto · non valido ai fini fiscali'),
    h('div', { class: 'rc-center', style: { marginTop: '6px' } }, 'Grazie e arrivederci'));
}

export function printReceipt(opts) {
  let root = document.getElementById('print-root');
  if (!root) {
    root = h('div', { id: 'print-root', 'aria-hidden': 'true' });
    document.body.append(root);
  }
  root.replaceChildren(buildReceipt(opts));
  window.print();
}
