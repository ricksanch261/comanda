/**
 * Avviso allergene (schermata 22), bloccante: focus iniziale su "Annulla",
 * Esc = Annulla, nessuna chiusura al tap sullo sfondo.
 * Restituisce true se il cameriere conferma comunque.
 */
import { h, icon } from '../../utils/dom.js';
import { openDialog } from '../../components/dialog.js';
import { getAllergen, allergenLabels } from '../../domain/allergens.js';
import { seatLabelOf } from '../../domain/session.js';

export async function allergenAlert({ dishName, conflicts, table, session }) {
  const seatState = (id) => session.seatsState.find((s) => s.seatId === id);
  const first = conflicts[0];
  const who = (c) => {
    const label = seatLabelOf(table, seatState(c.seatId));
    return c.guestName ? `${label} · ${c.guestName}` : label;
  };
  const title = conflicts.length === 1 ? `Allergene per ${first.guestName || seatLabelOf(table, seatState(first.seatId))}` : `Allergeni per ${conflicts.length} posti`;

  const r = await openDialog({
    title,
    eyebrow: 'Attenzione',
    headIcon: 'warning',
    variant: 'alert',
    dismissible: false,
    stackActions: true,
    body: h('div', { class: 'stack stack--4' },
      h('p', { class: 'text-md', style: { lineHeight: '1.45' } },
        h('b', {}, dishName),
        conflicts.length === 1
          ? [' contiene un allergene dichiarato dall’ospite al posto ', h('b', {}, seatLabelOf(table, seatState(first.seatId))), '.']
          : ' contiene allergeni dichiarati da più ospiti.'),
      ...conflicts.map((c) =>
        h('dl', { class: 'kv' },
          h('dt', {}, c.allergens.length > 1 ? 'Allergeni' : 'Allergene'),
          h('dd', { class: 'row row--wrap', style: { color: 'var(--status-allergen)' } },
            c.allergens.map((code) => {
              const a = getAllergen(code);
              return h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'allergen-tag is-hit' }, a.short), a.label);
            })),
          h('dt', {}, 'Posto'),
          h('dd', {}, who(c)),
          h('dt', {}, 'Dichiarate'),
          h('dd', { style: { fontWeight: 'var(--font-weight-regular)' } }, allergenLabels(c.declared).join(', ')))),
      h('div', { class: 'row text-sm muted', style: { alignItems: 'flex-start' } }, icon('info', 'icon--sm'), 'Se confermi, la comanda per la cucina riporterà l’avviso allergia.')),
    actions: [
      { label: 'Annulla', value: false, variant: 'primary', autofocus: true, id: 'alg-cancel' },
      { label: 'Conferma comunque', value: true, variant: 'danger-outline', id: 'alg-confirm' },
    ],
  });
  return r === true;
}
