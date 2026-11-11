/**
 * Integrazione del conto nelle altre schermate di sala (mappa, vista tavolo).
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { computeBill, coverChargeFromSettings } from '../../domain/billing.js';
import { formatEuro } from '../../utils/format.js';

export function billSummary(session) {
  const bill = computeBill(session, { coverChargeCents: coverChargeFromSettings(app.data.settings) });
  return formatEuro(bill.totalCents);
}

/** Pulsante "Conto" della bottom bar: richiede il conto e apre la schermata. */
export function billBarButton({ table, session }) {
  return h('button', {
    type: 'button',
    class: 'bottom-bar__tool',
    onClick: () => {
      if (session.status === 'open') app.act('requestBill', { sessionId: session.id });
      app.navigate(`/sala/tavolo/${table.id}/conto`);
    },
  }, icon('receipt_long'), 'Conto');
}

export function seatSubtotal({ session, seatId }) {
  const bill = computeBill(session, { coverChargeCents: coverChargeFromSettings(app.data.settings) });
  return bill.seats.find((s) => s.seatId === seatId)?.totalCents ?? 0;
}

export function reopenItem({ session, close }) {
  if (session.status !== 'bill_requested') return null;
  return h('button', { type: 'button', class: 'list-item', onClick: () => { close(); app.act('cancelBillRequest', { sessionId: session.id }); } },
    icon('undo'), h('span', { class: 'list-item__main list-item__title' }, 'Annulla richiesta conto'));
}
