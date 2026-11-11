/**
 * Riepilogo comanda (schermata 23) prima dell'invio, diviso Cucina/Bar.
 * Restituisce { hold: number[] } se confermato, altrimenti null.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { openDialog } from '../../components/dialog.js';
import { assignmentLabel, seatLabelOf } from '../../domain/session.js';
import { allergenLabels } from '../../domain/allergens.js';
import { plural } from '../../utils/format.js';

export function lineDetail(line) {
  return [...line.modifiers.map((m) => m.name), line.note].filter(Boolean).join(' · ');
}

/** Estensione per le portate trattenute (M5). */
export const summaryExtensions = { holdOptions: null };

export async function sendSummary({ table, session }) {
  const { courses } = app.data.settings;
  const drafts = session.orderLines.filter((l) => l.status === 'draft');
  const state = { hold: [] };
  const holdUi = summaryExtensions.holdOptions ? summaryExtensions.holdOptions({ session, drafts, state }) : null;
  const held = () => new Set([...(session.heldCourses || []), ...state.hold]);

  const body = h('div', { class: 'stack stack--4' });
  const cta = { el: null };
  function draw() {
    const H = held();
    const toSend = drafts.filter((l) => !H.has(l.courseIndex));
    const byDest = { cucina: [], bar: [] };
    for (const l of toSend) {
      const dest = app.data.menuItems.find((m) => m.id === l.menuItemId)?.destination || 'cucina';
      byDest[dest].push(l);
    }
    const allergic = session.seatsState.filter((s) => s.allergens.length);
    const children = [
      ...['cucina', 'bar'].filter((k) => byDest[k].length).map((k) =>
        h('section', { class: 'card stack', style: { padding: '12px' } },
          h('h3', { class: 'row' }, icon(k === 'bar' ? 'local_bar' : 'skillet'), k === 'bar' ? 'Bar' : 'Cucina', h('span', { class: 'muted text-sm' }, `· ${plural(byDest[k].length, 'riga', 'righe')}`)),
          h('ul', { class: 'summary-lines' },
            byDest[k].map((l) =>
              h('li', {},
                h('div', { class: 'grow' },
                  h('div', { class: 'bold' }, `${l.quantity}× ${l.nameSnapshot}`),
                  h('div', { class: 'text-sm muted' }, [l.courseIndex !== null ? courses[l.courseIndex] : null, lineDetail(l)].filter(Boolean).join(' · ')),
                  l.allergenOverride ? h('div', { class: 'text-sm bold', style: { color: 'var(--status-allergen)' } }, icon('warning', 'icon--xs'), ' Allergia segnalata') : null),
                h('span', { class: 'assign-tag' }, assignmentLabel(table, session, l.assignment))))))),
      toSend.length ? null : h('p', { class: 'muted' }, 'Tutte le bozze sono in portate trattenute.'),
      allergic.length
        ? h('div', { class: 'banner banner--block' }, icon('warning'),
            h('div', { class: 'banner__body' }, h('b', {}, 'Al tavolo: '),
              allergic.map((s) => `${seatLabelOf(table, s)}${s.guestName ? ` ${s.guestName}` : ''} ${allergenLabels(s.allergens).join(', ')}`).join(' · ')))
        : null,
      holdUi ? holdUi(draw) : null,
    ];
    body.replaceChildren(...children.filter(Boolean));
    if (cta.el) {
      cta.el.disabled = toSend.length === 0;
      cta.el.lastChild.textContent = `Invia ${plural(toSend.length, 'riga', 'righe')}`;
    }
  }
  draw();
  const r = await openDialog({
    title: `Invia comanda · ${table.label}`,
    variant: 'sheet',
    body,
    actions: [{ label: 'Invia', icon: 'send', variant: 'primary', id: 'send-confirm', value: true }],
    onOpen: ({ dialog }) => {
      cta.el = dialog.querySelector('[data-action="send-confirm"]');
      draw();
    },
  });
  return r ? { hold: state.hold } : null;
}
