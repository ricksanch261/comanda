/**
 * Scheda posto (schermata 19): nome ospite e allergie.
 */
import { h } from '../../utils/dom.js';
import { app } from '../../app.js';
import { openDialog } from '../../components/dialog.js';
import { field } from '../../components/layout.js';
import { allergenPicker } from '../../components/allergenPicker.js';
import { seatLabelOf } from '../../domain/session.js';

export async function seatSheet({ table, session, seatId }) {
  const st = session.seatsState.find((s) => s.seatId === seatId);
  if (!st) return;
  const label = seatLabelOf(table, st);
  const state = { guestName: st.guestName || '', allergens: [...st.allergens] };
  const ok = await openDialog({
    title: `${label} · ${table.label}`,
    variant: 'sheet',
    body: h('div', { class: 'stack stack--4' },
      field('Nome ospite (facoltativo)', h('input', { class: 'input', value: state.guestName, maxlength: 30, autocomplete: 'off', onInput: (e) => (state.guestName = e.target.value) })),
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Allergie'),
        allergenPicker({ selected: state.allergens, label: 'Allergie dell’ospite', onChange: (l) => (state.allergens = l) }))),
    actions: [{ label: 'Salva posto', variant: 'primary', value: true }],
  });
  if (ok) app.act('updateSeat', { sessionId: session.id, seatId, guestName: state.guestName, allergens: state.allergens });
}
