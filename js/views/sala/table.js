/**
 * Vista tavolo (schermata 18) + selezione piatto (20) come pannello su tablet
 * o a schermo intero su smartphone.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar } from '../../components/layout.js';
import { openDialog, confirmDialog } from '../../components/dialog.js';
import { toast } from '../../components/toast.js';
import { tableSeats, seatGeometry } from '../../components/tableSeats.js';
import { formatCents, plural } from '../../utils/format.js';
import { findAllergenConflicts, allergenLabels } from '../../domain/allergens.js';
import {
  openSessionOf, getTableStatus, sessionSeats, groupByCourse, assignmentLabel, lineTouchesSeat, sendableLines, seatLabelOf,
} from '../../domain/session.js';
import { tableUi, statusPill, timerPill, waiterName, parseTarget, encodeTarget, assignmentTag, isPhone } from './common.js';
import { pickerBody, targetDescription } from './picker.js';
import { lineConfig } from './lineConfig.js';
import { allergenAlert } from './allergenAlert.js';
import { seatSheet } from './seatSheet.js';
import { sendSummary, lineDetail } from './sendSummary.js';
import { enableSwipeLeft } from '../../components/swipe.js';

/** Punti di estensione delle milestone successive. */
export const tableExtensions = {
  barButtons: [], // ({ table, session }) => Node | null
  moreItems: [], // ({ table, session, close }) => Node | null
  sentLineTap: null, // ({ table, session, line }) => void
  groupInfo: null, // ({ session, group }) => { icon, text, cls } | null
  groupActions: null, // ({ session, group }) => Node | null
  seatSubtotal: null, // ({ table, session, seatId }) => cents
};

const LINE_STATUS = {
  draft: { label: 'Bozza', icon: 'edit', cls: 'muted' },
  sent: { label: 'Inviata', icon: 'send', cls: 'info' },
  served: { label: 'Servita', icon: 'check_circle', cls: 'success' },
  voided: { label: 'Stornata', icon: 'block', cls: 'danger' },
};

export default function tableView({ params, query, path }) {
  const tableId = params.id;
  const adding = path.endsWith('/aggiungi');
  const ui = tableUi(tableId);
  let search = '';
  const base = `/sala/tavolo/${tableId}`;

  const ctx = () => {
    const table = app.data.tables.find((t) => t.id === tableId);
    const session = table ? openSessionOf(app.data.sessions, tableId) : null;
    return { table, session };
  };

  function goAdd(asg) {
    search = '';
    if (!adding) ui.pickerPushed = true;
    app.navigate(`${base}/aggiungi?per=${encodeURIComponent(encodeTarget(asg))}`, { replace: adding });
  }

  /** Esce dal selettore piatti senza lasciare voci duplicate nella cronologia. */
  function leavePicker() {
    if (ui.pickerPushed) {
      ui.pickerPushed = false;
      history.back();
    } else app.navigate(base, { replace: true });
  }

  function onSeat(seats, i) {
    const s = seats[i];
    if (ui.multi) {
      ui.sel = ui.sel.includes(s.seatId) ? ui.sel.filter((x) => x !== s.seatId) : [...ui.sel, s.seatId];
      return app.rerender();
    }
    ui.filter = s.seatId;
    goAdd({ type: 'seat', seatIds: [s.seatId] });
  }

  function onCenter() {
    ui.multi = false;
    ui.sel = [];
    ui.filter = 'table';
    goAdd({ type: 'table' });
  }

  async function addItem(item, opts) {
    const { table, session } = ctx();
    const conflicts = findAllergenConflicts(item.allergens, session, opts.assignment);
    let override = false;
    if (conflicts.length) {
      override = await allergenAlert({ dishName: item.name, conflicts, table, session });
      if (!override) return false;
    }
    const r = app.act('addOrderLine', { sessionId: session.id, menuItemId: item.id, ...opts, allergenOverride: override });
    if (!r.ok) return false;
    const lineId = r.result;
    const td = targetDescription(table, session, opts.assignment);
    toast(`Aggiunto: ${item.name} · ${td.short}`, {
      action: { label: 'Annulla', onClick: () => app.act('removeOrderLine', { sessionId: session.id, lineId }) },
    });
    if (isPhone()) leavePicker();
    return true;
  }

  async function configure(item, assignment) {
    const { table, session } = ctx();
    const res = await lineConfig({ item, table, session, assignment });
    if (res) await addItem(item, res);
  }

  async function quickAdd(item, assignment) {
    const groups = item.modifierGroupIds.map((id) => app.data.modifierGroups.find((g) => g.id === id)).filter(Boolean);
    if (groups.some((g) => g.required)) return configure(item, assignment);
    return addItem(item, { assignment });
  }

  async function chooseSeat(title) {
    const { table, session } = ctx();
    return openDialog({
      title,
      variant: 'sheet',
      body: (api) =>
        h('div', { class: 'chips chips--wrap' },
          sessionSeats(table, session).map((s) =>
            h('button', { type: 'button', class: 'chip', onClick: () => api.close({ type: 'seat', seatIds: [s.seatId] }) }, s.guestName ? `${s.label} · ${s.guestName}` : s.label)),
          h('button', { type: 'button', class: 'chip', onClick: () => api.close({ type: 'table' }) }, icon('table_restaurant'), 'Tavolo')),
    });
  }

  async function onLineTap(line) {
    const { table, session } = ctx();
    if (line.status !== 'draft') {
      if (tableExtensions.sentLineTap) tableExtensions.sentLineTap({ table, session, line });
      return;
    }
    const item = app.data.menuItems.find((m) => m.id === line.menuItemId) || {
      id: line.menuItemId, name: line.nameSnapshot, description: '', priceCents: line.unitPriceCents, allergens: [], modifierGroupIds: [], categoryId: null,
    };
    const res = await lineConfig({ item, table, session, assignment: line.assignment, line });
    if (!res) return;
    if (res.action === 'delete') {
      const r = app.act('removeOrderLine', { sessionId: session.id, lineId: line.id });
      if (r.ok) toast('Riga eliminata', { icon: 'delete', action: { label: 'Annulla', onClick: () => app.act('restoreOrderLine', { sessionId: session.id, ...r.result }) } });
      return;
    }
    if (res.action === 'repeat') {
      const asg = await chooseSeat(`Ripeti “${line.nameSnapshot}” su…`);
      if (!asg) return;
      const conflicts = findAllergenConflicts(item.allergens || [], ctx().session, asg);
      const override = conflicts.length ? await allergenAlert({ dishName: line.nameSnapshot, conflicts, table, session: ctx().session }) : false;
      if (conflicts.length && !override) return;
      if (app.act('repeatOrderLine', { sessionId: session.id, lineId: line.id, assignment: asg, allergenOverride: override }).ok) toast(`Ripetuto: ${line.nameSnapshot}`);
      return;
    }
    const changedAsg = JSON.stringify(res.assignment) !== JSON.stringify(line.assignment);
    let override = false;
    if (changedAsg) {
      const conflicts = findAllergenConflicts(item.allergens || [], session, res.assignment);
      if (conflicts.length) {
        override = await allergenAlert({ dishName: line.nameSnapshot, conflicts, table, session });
        if (!override) return;
      }
    }
    if (app.act('updateOrderLine', { sessionId: session.id, lineId: line.id, ...res, assignment: changedAsg ? res.assignment : undefined, allergenOverride: override }).ok) toast('Riga aggiornata');
  }

  async function send() {
    const { table, session } = ctx();
    const res = await sendSummary({ table, session });
    if (!res) return;
    const r = app.act('sendOrder', { sessionId: session.id, hold: res.hold });
    if (r.ok) toast(`Comanda inviata · ${plural(r.result.length, 'riga', 'righe')}`, { icon: 'send' });
  }

  async function more() {
    const { table, session } = ctx();
    await openDialog({
      title: `Tavolo ${table.label}`,
      variant: 'sheet',
      body: (api) => {
        const items = [
          h('button', { type: 'button', class: 'list-item', onClick: () => { api.close(); app.act('addSeat', { sessionId: session.id }); toast('Posto aggiunto', { icon: 'person_add' }); } },
            icon('person_add'), h('span', { class: 'list-item__main list-item__title' }, 'Aggiungi un posto')),
          ...tableExtensions.moreItems.map((fn) => fn({ table, session, close: api.close })),
        ];
        if (app.data.settings.waiters.length) {
          items.push(h('div', { class: 'list-item' }, icon('badge'),
            h('span', { class: 'list-item__main' }, h('div', { class: 'list-item__title' }, 'Cameriere'),
              h('div', { class: 'chips chips--wrap', style: { marginTop: '6px' } },
                app.data.settings.waiters.map((w) =>
                  h('button', { type: 'button', class: 'chip chip--sm', 'aria-pressed': String(session.waiterId === w.id), onClick: () => { app.act('setWaiter', { sessionId: session.id, waiterId: w.id }); api.close(); } }, w.name))))));
        }
        if (!session.orderLines.some((l) => l.status !== 'draft') && !session.payments.length) {
          items.push(h('button', {
            type: 'button',
            class: 'list-item',
            onClick: async () => {
              api.close();
              const ok = await confirmDialog({ title: `Liberare ${table.label}?`, message: 'Il tavolo torna libero e le bozze vengono eliminate.', confirmLabel: 'Libera tavolo', danger: true });
              if (ok && app.act('cancelSession', { sessionId: session.id }).ok) {
                toast(`${table.label} libero`);
                app.navigate('/sala', { replace: true });
              }
            },
          }, icon('event_available', 'danger'), h('span', { class: 'list-item__main list-item__title danger' }, 'Annulla apertura')));
        }
        return h('div', { class: 'list' }, items.filter(Boolean));
      },
    });
  }

  /* ------------------------------ Rendering ------------------------------ */

  function seatData(table, session, asgSel) {
    const seats = sessionSeats(table, session);
    const live = session.orderLines.filter((l) => l.status !== 'voided');
    const selSet = new Set(ui.multi ? ui.sel : asgSel && asgSel.type !== 'table' ? asgSel.seatIds : []);
    return seats.map((s) => {
      const count = live.filter((l) => lineTouchesSeat(l, s.seatId)).length;
      const sub = tableExtensions.seatSubtotal ? tableExtensions.seatSubtotal({ table, session, seatId: s.seatId }) : null;
      return {
        ...s,
        label: s.label,
        guest: s.guestName,
        allergies: allergenLabels(s.allergens),
        count,
        extra: s.isExtra,
        selected: selSet.has(s.seatId),
        ariaLabel: [s.label, s.guestName, s.allergens.length ? `allergie: ${allergenLabels(s.allergens).join(', ')}` : null, plural(count, 'riga', 'righe'), sub != null ? `${formatCents(sub)} euro` : null].filter(Boolean).join(', '),
      };
    });
  }

  function schema(table, session, asgSel) {
    const seats = seatData(table, session, asgSel);
    const phone = isPhone();
    const maxW = phone ? Math.min(window.innerWidth - 32, 440) : Math.min(560, (window.innerWidth >= 1024 ? 600 : window.innerWidth) - 40);
    const geo = seatGeometry(table.shape, seats.length, maxW, phone ? 56 : 68);
    const centerCount = session.orderLines.filter((l) => l.status !== 'voided' && l.assignment.type === 'table').length;
    const multiHint = ui.multi
      ? ui.sel.length > 1 ? `Piatto condiviso tra ${seats.filter((s) => ui.sel.includes(s.seatId)).map((s) => s.label).join(', ')}` : 'Seleziona 2 o più posti'
      : asgSel ? (asgSel.type === 'table' ? 'Piatto per tutto il tavolo' : `${targetDescription(table, session, asgSel).short} → scegli il piatto`) : 'Tocca un posto per aggiungere un piatto · tieni premuto per nome e allergie';

    return h('section', { class: 'tv__schema', 'aria-label': 'Schema del tavolo' },
      h('div', { class: 'tv__seats', 'data-scroll': 'seats' },
        tableSeats({
          shape: table.shape,
          seats,
          width: geo.W,
          height: geo.H,
          seatSize: geo.d,
          centerSelected: !ui.multi && asgSel?.type === 'table',
          centerCount,
          onSeat: (i) => onSeat(seats, i),
          onSeatLong: (i) => seatSheet({ table, session, seatId: seats[i].seatId }),
          onCenter,
        })),
      h('div', { class: 'tv__hintbar' },
        h('button', {
          type: 'button',
          class: ['chip', 'chip--toggle'],
          'aria-pressed': String(ui.multi),
          onClick: () => { ui.multi = !ui.multi; ui.sel = []; app.rerender(); },
        }, icon(ui.multi ? 'check_box' : 'select_check_box'), isPhone() ? 'Più posti' : 'Multi-selezione'),
        h('span', { class: 'tv__hint', 'aria-live': 'polite' }, multiHint),
        ui.multi && ui.sel.length > 1
          ? h('button', { type: 'button', class: 'btn btn--primary btn--sm', onClick: () => { const ids = ui.sel; ui.multi = false; ui.sel = []; goAdd({ type: 'shared', seatIds: ids }); } }, icon('group_add'), 'Aggiungi condiviso')
          : null));
  }

  function orderPanel(table, session) {
    const seats = sessionSeats(table, session);
    if (ui.filter !== 'all' && ui.filter !== 'table' && !seats.some((s) => s.seatId === ui.filter)) ui.filter = 'all';
    const lines = session.orderLines.filter((l) =>
      ui.filter === 'all' ? true : ui.filter === 'table' ? l.assignment.type === 'table' : lineTouchesSeat(l, ui.filter));
    const groups = groupByCourse(lines, app.data.settings.courses);
    const chips = [{ key: 'all', label: 'Tutti' }, ...seats.map((s) => ({ key: s.seatId, label: s.label, alg: s.allergens.length > 0 })), { key: 'table', label: 'Tavolo' }];
    const focusSeat = seats.find((s) => s.seatId === ui.filter);

    return h('section', { class: 'tv__order', 'aria-label': 'Ordine' },
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtra per posto' },
        chips.map((c) =>
          h('button', { type: 'button', class: ['chip', 'chip--sm', c.alg && 'chip--alg'], 'aria-pressed': String(ui.filter === c.key), onClick: () => { ui.filter = c.key; app.rerender(); } },
            c.alg ? icon('warning') : null, c.label))),
      focusSeat
        ? h('div', { class: 'seat-focus' },
            h('div', { class: 'grow' },
              h('div', { class: 'bold' }, focusSeat.guestName ? `${focusSeat.label} · ${focusSeat.guestName}` : focusSeat.label,
                tableExtensions.seatSubtotal ? h('span', { class: 'muted', style: { fontWeight: 400 } }, ` · € ${formatCents(tableExtensions.seatSubtotal({ table, session, seatId: focusSeat.seatId }))}`) : null),
              focusSeat.allergens.length
                ? h('div', { class: 'target-card__alg' }, icon('warning', 'icon--xs'), allergenLabels(focusSeat.allergens).join(', '))
                : h('div', { class: 'text-sm muted' }, 'Nessuna allergia')),
            h('button', { type: 'button', class: 'btn btn--sm', onClick: () => seatSheet({ table, session, seatId: focusSeat.seatId }) }, icon('edit', 'icon--sm'), 'Posto'),
            h('button', { type: 'button', class: 'btn btn--primary btn--sm', onClick: () => goAdd({ type: 'seat', seatIds: [focusSeat.seatId] }) }, icon('add', 'icon--sm'), 'Piatto'))
        : null,
      groups.length
        ? h('div', { class: 'order-groups' }, groups.map((g) => orderGroup(table, session, g)))
        : h('div', { class: 'empty' }, icon('receipt'), h('div', { class: 'empty__title' }, 'Nessun ordine'),
            h('div', { class: 'empty__text' }, ui.filter === 'all' ? 'Tocca un posto per iniziare.' : 'Nessuna riga per questo filtro.')));
  }

  function groupInfo(session, g) {
    const ext = tableExtensions.groupInfo?.({ session, group: g });
    if (ext) return ext;
    const live = g.lines.filter((l) => l.status !== 'voided');
    if (live.length && live.every((l) => l.status === 'served')) return { icon: 'check_circle', text: 'Servita', cls: 'success' };
    if (live.some((l) => l.status === 'draft')) return { icon: 'edit_note', text: 'Bozza · non inviata', cls: 'muted' };
    if (live.length) {
      const last = live.map((l) => l.sentAt).filter(Boolean).sort().pop();
      return { icon: 'send', text: `Inviata${last ? ` · ${new Date(last).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : ''}`, cls: 'info' };
    }
    return { icon: 'block', text: 'Stornata', cls: 'muted' };
  }

  function orderGroup(table, session, g) {
    const info = groupInfo(session, g);
    return h('div', { class: 'order-group' },
      h('div', { class: 'order-group__head' },
        h('h3', { class: 'order-group__name' }, g.name),
        h('span', { class: ['order-group__info', info.cls] }, icon(info.icon, 'icon--xs'), info.text),
        tableExtensions.groupActions?.({ session, group: g })),
      g.lines.map((l) => orderLine(table, session, l)));
  }

  function orderLine(table, session, l) {
    const st = LINE_STATUS[l.status];
    const label = assignmentLabel(table, session, l.assignment);
    const sub = [
      l.assignment.type === 'shared' ? `Condiviso: ${label}` : null,
      lineDetail(l),
      l.allergenOverride ? 'allergia segnalata' : null,
      l.status === 'voided' && l.voidReason ? `Storno: ${l.voidReason}` : null,
    ].filter(Boolean).join(' · ');
    const tappable = l.status === 'draft' || (l.status !== 'voided' && tableExtensions.sentLineTap);
    const el = h(tappable ? 'button' : 'div', {
      type: tappable ? 'button' : null,
      class: ['oline', `oline--${l.status}`, l.allergenOverride && 'has-alg'],
      'aria-label': `${l.quantity} ${l.nameSnapshot}, ${label}, ${st.label}, ${formatCents(l.unitPriceCents * l.quantity)} euro${l.allergenOverride ? ', allergia segnalata' : ''}`,
      onClick: tappable ? () => onLineTap(l) : null,
    },
    assignmentTag(l.assignment, label),
    h('span', { class: 'oline__main' },
      h('span', { class: 'oline__name' }, l.allergenOverride ? icon('warning', 'icon--xs oline__alg') : null, `${l.quantity}× ${l.nameSnapshot}`),
      sub ? h('span', { class: 'oline__sub' }, sub) : null),
    h('span', { class: 'oline__end' },
      h('span', { class: 'oline__price num' }, formatCents(l.unitPriceCents * l.quantity)),
      h('span', { class: ['oline__status', st.cls] }, icon(st.icon), st.label)));
    if (l.status === 'draft') {
      el.setAttribute('aria-description', 'Bozza: tocca per modificare, scorri a sinistra per eliminare');
      enableSwipeLeft(el, () => {
        const r = app.act('removeOrderLine', { sessionId: session.id, lineId: l.id });
        if (r.ok) toast(`Riga eliminata: ${l.nameSnapshot}`, { icon: 'delete', action: { label: 'Annulla', onClick: () => app.act('restoreOrderLine', { sessionId: session.id, ...r.result }) } });
      });
    }
    return el;
  }

  function bottomBar(table, session) {
    const n = sendableLines(session).length;
    return h('nav', { class: 'bottom-bar', 'aria-label': 'Azioni tavolo' },
      h('button', { type: 'button', class: 'btn btn--primary btn--lg bottom-bar__main', disabled: n === 0, onClick: send },
        icon('send'), 'Invia comanda', n ? h('span', { class: 'bottom-bar__count', 'aria-label': `${n} righe in bozza` }, n) : null),
      ...tableExtensions.barButtons.map((fn) => fn({ table, session })).filter(Boolean),
      h('button', { type: 'button', class: 'icon-btn bottom-bar__more', 'aria-label': 'Altre azioni', onClick: more }, icon('more_horiz')));
  }

  function header(table, session) {
    const status = getTableStatus(table, session);
    const area = app.data.areas.find((a) => a.id === table.areaId)?.name;
    const waiter = waiterName(session.waiterId);
    return appBar({
      back: '/sala',
      title: h('div', { class: 'row', style: { gap: '8px' } }, h('h1', {}, table.label), statusPill(status)),
      sub: [area, plural(session.covers, 'coperto', 'coperti'), waiter].filter(Boolean).join(' · '),
      actions: [timerPill(session)],
    });
  }

  return {
    title: 'Tavolo',
    tick: 30000,
    render() {
      const { table, session } = ctx();
      if (!table || !session) {
        queueMicrotask(() => app.navigate('/sala', { replace: true }));
        return h('div');
      }
      const asg = adding ? parseTarget(query.per, session) : null;
      if (adding && !asg) {
        queueMicrotask(() => app.navigate(base, { replace: true }));
        return h('div');
      }
      const picker = asg
        ? pickerBody({
            table, session, assignment: asg, ui, search, wide: !isPhone(),
            onSearch: (v) => { search = v; app.rerender(); },
            onQuickAdd: (m) => quickAdd(m, asg),
            onConfigure: (m) => configure(m, asg),
            onChangeTarget: isPhone() ? leavePicker : null,
          })
        : null;

      if (asg && isPhone()) {
        return h('div', { class: 'screen' },
          appBar({
            title: 'Aggiungi piatto',
            sub: `${table.label} · portata automatica dalla categoria`,
            actions: [h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Chiudi', onClick: leavePicker }, icon('close'))],
          }),
          h('main', { class: 'screen__body' }, picker));
      }

      return h('div', { class: 'screen tv-screen' },
        header(table, session),
        h('main', { class: 'tv' },
          schema(table, session, asg),
          asg
            ? h('section', { class: 'tv__panel', 'aria-label': 'Aggiungi piatto' },
                h('div', { class: 'tv__panel-head' },
                  h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Chiudi selezione piatto', onClick: leavePicker }, icon('arrow_back')),
                  h('div', {}, h('div', { class: 'bold' }, `Aggiungi piatto · ${table.label}`), h('div', { class: 'text-sm muted' }, 'tocca un altro posto per cambiare'))),
                picker)
            : orderPanel(table, session)),
        bottomBar(table, session));
    },
    afterRender(root) {
      const s = root.querySelector('#picker-search');
      if (s && search) {
        s.focus();
        s.setSelectionRange(s.value.length, s.value.length);
      }
    },
  };
}
