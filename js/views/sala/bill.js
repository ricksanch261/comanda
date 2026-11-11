/**
 * Conto (schermata 25): Totale / Per posto / Alla romana, quote per posto,
 * pagamenti parziali, residuo e chiusura.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, segmented, field } from '../../components/layout.js';
import { openDialog, confirmDialog } from '../../components/dialog.js';
import { toast } from '../../components/toast.js';
import { computeBill, coverChargeFromSettings, aggregateLines, splitRomana, paymentSummary } from '../../domain/billing.js';
import { openSessionOf, sessionSeats, lineTouchesSeat } from '../../domain/session.js';
import { formatCents, formatEuro, formatTime, parseEuroToCents, plural } from '../../utils/format.js';
import { tableUi } from './common.js';
import { printReceipt } from './receipt.js';

const METHODS = [
  { value: 'carta', label: 'Carta', icon: 'credit_card' },
  { value: 'contanti', label: 'Contanti', icon: 'payments' },
  { value: 'altro', label: 'Altro', icon: 'more_horiz' },
];
const methodLabel = (m) => METHODS.find((x) => x.value === m)?.label ?? m;

export function billOf(session) {
  const bill = computeBill(session, { coverChargeCents: coverChargeFromSettings(app.data.settings) });
  return { bill, pay: paymentSummary(session, bill) };
}

export default function billView({ params }) {
  const tableId = params.id;
  const ui = tableUi(tableId);
  ui.billMode ||= 'seat';
  ui.method ||= 'carta';
  let expanded = null;

  const ctx = () => {
    const table = app.data.tables.find((t) => t.id === tableId);
    const session = table ? openSessionOf(app.data.sessions, tableId) : null;
    return { table, session };
  };

  function pay(amountCents, seatIds = null, label = '') {
    const { session } = ctx();
    const r = app.act('addPayment', { sessionId: session.id, amountCents, method: ui.method, seatIds });
    if (r.ok) {
      const paymentId = r.result;
      toast(`Incassati ${formatEuro(amountCents)}${label ? ` da ${label}` : ''} · ${methodLabel(ui.method)}`, {
        icon: 'payments',
        action: { label: 'Annulla', onClick: () => app.act('removePayment', { sessionId: session.id, paymentId }) },
      });
    }
  }

  async function customPayment() {
    const { table, session } = ctx();
    const { pay: p } = billOf(session);
    const seats = sessionSeats(table, session);
    const state = { text: formatCents(Math.max(0, p.residualCents)), seatIds: new Set(), method: ui.method };
    const err = h('div', { class: 'field__error', role: 'alert' });
    const ok = await openDialog({
      title: 'Importo diverso',
      variant: 'sheet',
      body: h('div', { class: 'stack stack--4' },
        field('Importo', h('div', { class: 'input-affix' }, h('span', { class: 'affix' }, '€'),
          h('input', { class: 'input', inputmode: 'decimal', value: state.text, autofocus: true, onInput: (e) => (state.text = e.target.value) }))),
        h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Metodo'),
          segmented({ label: 'Metodo', block: true, value: state.method, options: METHODS, onChange: (v) => { state.method = v; ui.method = v; } })),
        h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Attribuisci ai posti (facoltativo)'),
          h('div', { class: 'chips chips--wrap' },
            seats.map((s) => h('button', {
              type: 'button',
              class: 'chip chip--sm',
              'aria-pressed': 'false',
              onClick: (e) => {
                if (state.seatIds.has(s.seatId)) state.seatIds.delete(s.seatId);
                else state.seatIds.add(s.seatId);
                e.currentTarget.setAttribute('aria-pressed', String(state.seatIds.has(s.seatId)));
              },
            }, s.label)))),
        err),
      actions: [
        { label: 'Annulla', value: false, variant: 'ghost' },
        {
          label: 'Registra pagamento',
          variant: 'primary',
          onClick: () => {
            const c = parseEuroToCents(state.text);
            if (!c || c <= 0) {
              err.textContent = 'Inserisci un importo valido.';
              return false;
            }
            state.cents = c;
            return true;
          },
        },
      ],
    });
    if (ok) {
      ui.method = state.method;
      pay(state.cents, state.seatIds.size ? [...state.seatIds] : null);
    }
  }

  async function close() {
    const { table, session } = ctx();
    const { pay: p } = billOf(session);
    if (session.orderLines.some((l) => l.status === 'draft')) {
      toast('Ci sono righe in bozza: inviale o eliminale prima di chiudere.', { icon: 'warning', type: 'error' });
      return;
    }
    let force = false;
    if (p.residualCents > 0) {
      force = await confirmDialog({
        title: `Chiudere con residuo ${formatEuro(p.residualCents)}?`,
        message: 'Il conto non è saldato. La chiusura resta registrata nello storico con il residuo.',
        confirmLabel: 'Chiudi comunque',
        danger: true,
        icon: 'warning',
      });
      if (!force) return;
    }
    const r = app.act('closeSession', { sessionId: session.id, force });
    if (r.ok) {
      toast(`Tavolo ${table.label} chiuso`, { icon: 'task_alt' });
      app.navigate('/sala', { replace: true });
    }
  }

  async function removePayment(p) {
    const { session } = ctx();
    const ok = await confirmDialog({ title: `Eliminare il pagamento di ${formatEuro(p.amountCents)}?`, message: `${methodLabel(p.method)} · ${formatTime(p.at)}`, confirmLabel: 'Elimina', danger: true });
    if (ok) app.act('removePayment', { sessionId: session.id, paymentId: p.id });
  }

  function methodPicker() {
    return segmented({ label: 'Metodo di pagamento', block: true, value: ui.method, options: METHODS, onChange: (v) => { ui.method = v; app.rerender(); } });
  }

  function seatMode(table, session, bill, p) {
    const seats = sessionSeats(table, session);
    return h('div', { class: 'list' },
      bill.seats.map((s) => {
        const info = seats.find((x) => x.seatId === s.seatId);
        const ps = p.perSeat.get(s.seatId);
        const st = {
          paid: { icon: 'check_circle', text: 'Pagato', cls: 'success' },
          partial: { icon: 'timelapse', text: `Parziale · ${formatCents(ps.paidCents)}`, cls: 'warning' },
          open: { icon: 'radio_button_unchecked', text: 'Da pagare', cls: 'muted' },
          empty: { icon: 'remove', text: 'Nessun importo', cls: 'muted' },
        }[ps.status];
        const lines = session.orderLines.filter((l) => l.status !== 'voided' && lineTouchesSeat(l, s.seatId)).length;
        const isOpen = expanded === s.seatId;
        const who = info.guestName ? `${info.label} · ${info.guestName}` : info.label;
        return h('div', { class: ['bill-seat', isOpen && 'is-open'] },
          h('button', { type: 'button', class: 'bill-seat__head', 'aria-expanded': String(isOpen), onClick: () => { expanded = isOpen ? null : s.seatId; app.rerender(); } },
            h('span', { class: ['bill-seat__badge', info.isExtra && 'is-extra'] }, info.label),
            h('span', { class: 'grow' },
              h('span', { class: 'bold' }, info.guestName || ''), info.guestName ? h('span', { class: 'muted' }, ' · ') : null,
              h('span', { class: 'muted text-sm' }, plural(lines, 'riga', 'righe')),
              h('span', { class: ['bill-seat__status', st.cls] }, icon(st.icon, 'icon--xs'), st.text)),
            h('span', { class: 'bill-seat__total num' }, formatEuro(s.totalCents)),
            icon(isOpen ? 'expand_less' : 'expand_more')),
          isOpen
            ? h('div', { class: 'bill-seat__body' },
                s.items.map((it) =>
                  h('div', { class: 'bill-item' },
                    h('span', { class: 'muted' }, it.kind === 'cover' ? 'Coperto' : `${it.quantity > 1 ? `${it.quantity}× ` : ''}${it.name}${it.share ? ` · quota 1/${it.share.of}` : ''}`),
                    h('span', { class: 'num' }, formatCents(it.amountCents)))),
                ps.paidCents ? h('div', { class: 'bill-item' }, h('span', { class: 'success' }, 'Già pagato'), h('span', { class: 'num success' }, `−${formatCents(ps.paidCents)}`)) : null,
                ps.residualCents > 0
                  ? h('div', { class: 'stack', style: { marginTop: '8px' } },
                      methodPicker(),
                      h('button', { type: 'button', class: 'btn btn--primary btn--block', onClick: () => pay(ps.residualCents, [s.seatId], who) },
                        icon('payments'), `Incassa ${formatEuro(ps.residualCents)} da ${info.label}`))
                  : null)
            : null);
      }));
  }

  function totalMode(session, bill, p) {
    const lines = aggregateLines(session);
    return h('div', { class: 'card stack' },
      lines.map((l) => h('div', { class: 'bill-item' },
        h('span', {}, `${l.quantity}× ${l.name}`, l.detail ? h('span', { class: 'muted text-sm' }, ` · ${l.detail}`) : null),
        h('span', { class: 'num' }, formatCents(l.amountCents)))),
      bill.coverTotalCents ? h('div', { class: 'bill-item' }, h('span', {}, `Coperto ${bill.seats.length} × ${formatCents(coverChargeFromSettings(app.data.settings))}`), h('span', { class: 'num' }, formatCents(bill.coverTotalCents))) : null,
      h('div', { class: 'bill-item bold', style: { borderTop: '1px solid var(--color-border)', paddingTop: '8px' } }, h('span', {}, 'Totale'), h('span', { class: 'num' }, formatEuro(bill.totalCents))),
      p.residualCents > 0
        ? h('div', { class: 'stack' }, methodPicker(),
            h('button', { type: 'button', class: 'btn btn--primary btn--lg', onClick: () => pay(p.residualCents) }, icon('payments'), `Incassa il residuo ${formatEuro(p.residualCents)}`))
        : null);
  }

  function romanaMode(session, bill, p) {
    const quotes = splitRomana(bill.totalCents, session.covers);
    const quota = quotes[0];
    const next = Math.min(quota, Math.max(0, p.residualCents));
    const left = quota > 0 ? Math.ceil(Math.max(0, p.residualCents) / quota) : 0;
    return h('div', { class: 'card stack stack--3' },
      h('div', { class: 'romana' },
        h('div', {}, h('div', { class: 'stat__label' }, `Totale ÷ ${session.covers} coperti`), h('div', { class: 'stat__value num' }, formatEuro(quota))),
        h('div', { class: 'text-sm muted' }, quotes.some((q) => q !== quota) ? `Quote: ${quotes.map(formatCents).join(' · ')} (il resto va alle prime quote)` : 'Quote uguali per tutti.')),
      h('div', { class: 'text-sm' }, p.residualCents > 0 ? `Restano circa ${plural(left, 'quota', 'quote')} da incassare.` : 'Tutte le quote sono state incassate.'),
      next > 0
        ? h('div', { class: 'stack' }, methodPicker(),
            h('button', { type: 'button', class: 'btn btn--primary btn--lg', onClick: () => pay(next, null, 'una quota') }, icon('payments'), `Incassa una quota ${formatEuro(next)}`))
        : null);
  }

  return {
    title: 'Conto',
    render() {
      const { table, session } = ctx();
      if (!table || !session) {
        queueMicrotask(() => app.navigate('/sala', { replace: true }));
        return h('div');
      }
      const { bill, pay: p } = billOf(session);
      const lineCount = session.orderLines.filter((l) => l.status !== 'voided').length;
      const drafts = session.orderLines.filter((l) => l.status === 'draft').length;
      const pct = bill.totalCents > 0 ? Math.min(100, Math.round((p.paidCents / bill.totalCents) * 100)) : 0;
      const settled = p.residualCents <= 0;

      return h('div', { class: 'screen bill-screen' },
        appBar({
          back: `/sala/tavolo/${tableId}`,
          title: `Conto · ${table.label}`,
          sub: `${plural(session.covers, 'coperto', 'coperti')} · ${plural(lineCount, 'riga', 'righe')} · dalle ${formatTime(session.openedAt)}`,
          actions: [h('button', { type: 'button', class: 'btn btn--sm', onClick: () => printReceipt({ table, session, mode: ui.billMode }) }, icon('print', 'icon--sm'), 'Preconto')],
        }),
        h('main', { class: 'screen__body bill-body', 'data-scroll': 'bill' },
          segmented({
            label: 'Modalità del conto',
            block: true,
            value: ui.billMode,
            options: [{ value: 'total', label: 'Totale' }, { value: 'seat', label: 'Per posto' }, { value: 'romana', label: 'Alla romana' }],
            onChange: (v) => { ui.billMode = v; app.rerender(); },
          }),
          drafts ? h('div', { class: 'banner banner--warning' }, icon('edit_note'), h('div', { class: 'banner__body' }, `${plural(drafts, 'riga', 'righe')} in bozza non ${drafts === 1 ? 'inviata' : 'inviate'}: ${drafts === 1 ? 'è inclusa' : 'sono incluse'} nel conto.`),
            h('a', { class: 'btn btn--sm', href: `#/sala/tavolo/${tableId}` }, 'Vai al tavolo')) : null,
          ui.billMode === 'seat'
            ? [h('div', { class: 'row text-sm muted', style: { alignItems: 'flex-start' } }, icon('call_split', 'icon--sm'),
                `Righe condivise e del tavolo ripartite in parti uguali tra i posti coinvolti.${coverChargeFromSettings(app.data.settings) ? ` Coperto ${formatEuro(coverChargeFromSettings(app.data.settings))} a persona.` : ''}`),
               seatMode(table, session, bill, p)]
            : ui.billMode === 'romana' ? romanaMode(session, bill, p) : totalMode(session, bill, p),
          session.payments.length
            ? h('section', { class: 'stack' },
                h('h2', { class: 'section-title' }, 'Pagamenti'),
                h('div', { class: 'list' },
                  session.payments.map((pm) => {
                    const seats = sessionSeats(table, session);
                    const who = pm.seatIds ? pm.seatIds.map((id) => seats.find((s) => s.seatId === id)?.label ?? '?').join(', ') : 'Importo libero';
                    return h('div', { class: 'list-item' },
                      icon(METHODS.find((m) => m.value === pm.method)?.icon ?? 'payments'),
                      h('span', { class: 'list-item__main' }, h('div', { class: 'list-item__title num' }, formatEuro(pm.amountCents)), h('div', { class: 'list-item__sub' }, `${methodLabel(pm.method)} · ${who} · ${formatTime(pm.at)}`)),
                      h('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': `Elimina pagamento di ${formatEuro(pm.amountCents)}`, onClick: () => removePayment(pm) }, icon('delete')));
                  })))
            : null),
        h('footer', { class: 'bill-footer' },
          h('div', { class: 'bill-totals' },
            h('div', {}, h('div', { class: 'stat__label' }, 'Totale'), h('div', { class: 'bill-totals__v num' }, formatEuro(bill.totalCents))),
            h('div', {}, h('div', { class: 'stat__label' }, 'Pagato'), h('div', { class: 'bill-totals__v num success' }, formatEuro(p.paidCents))),
            h('div', { style: { textAlign: 'right' } }, h('div', { class: 'stat__label' }, p.residualCents < 0 ? 'Resto' : 'Residuo'), h('div', { class: 'bill-totals__v bill-totals__v--big num' }, formatEuro(Math.abs(p.residualCents))))),
          h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Pagato', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('div', { style: { width: `${pct}%` } })),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'btn btn--lg', onClick: customPayment }, icon('edit'), 'Importo diverso…'),
            h('button', {
              type: 'button',
              class: ['btn', 'btn--lg', 'grow', settled ? 'btn--primary' : 'btn--locked'],
              onClick: close,
              'aria-describedby': settled ? null : 'close-hint',
            }, icon(settled ? 'task_alt' : 'lock'), settled ? 'Chiudi tavolo' : 'Chiudi tavolo · salda il residuo'),
            settled ? null : h('span', { id: 'close-hint', class: 'visually-hidden' }, 'Il residuo non è zero: verrà chiesta una conferma.'))));
    },
  };
}
