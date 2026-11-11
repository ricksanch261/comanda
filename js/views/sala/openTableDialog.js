/**
 * Dialog "Apri tavolo" (schermata 17): stepper dei coperti e scelta del cameriere.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { openDialog } from '../../components/dialog.js';
import { stepper } from '../../components/stepper.js';
import { getPrefs } from '../../state/prefs.js';

export async function openTableDialog(table) {
  const { waiters } = app.data.settings;
  const state = { covers: table.seats.length, waiterId: getPrefs().waiterId || null };
  if (!waiters.some((w) => w.id === state.waiterId)) state.waiterId = waiters[0]?.id ?? null;
  const note = h('div', { class: 'field__hint', 'aria-live': 'polite' });
  const syncNote = () => {
    const extra = state.covers - table.seats.length;
    note.replaceChildren(
      extra > 0
        ? h('span', { class: 'row' }, icon('person_add', 'icon--sm'), `Il tavolo ha ${table.seats.length} posti: ${extra === 1 ? 'verrà aggiunto 1 posto extra' : `verranno aggiunti ${extra} posti extra`}.`)
        : `Posti configurati: ${table.seats.length}.`,
    );
  };
  syncNote();
  const waiterChips = () =>
    h('div', { class: 'chips chips--wrap', role: 'group', 'aria-label': 'Cameriere' },
      waiters.map((w) =>
        h('button', {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(state.waiterId === w.id),
          onClick: (e) => {
            state.waiterId = w.id;
            e.currentTarget.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget)));
          },
        }, w.name)));

  const sessionId = await openDialog({
    title: `Apri ${table.label}`,
    variant: 'sheet',
    body: h('div', { class: 'stack stack--4' },
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Coperti'),
        h('div', { class: 'row' }, stepper({ value: state.covers, min: 1, max: 40, label: 'coperti', id: 'open-covers', onChange: (v) => { state.covers = v; syncNote(); } })),
        note),
      waiters.length ? h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Cameriere'), waiterChips()) : null),
    actions: [
      {
        label: 'Apri tavolo',
        icon: 'meeting_room',
        variant: 'primary',
        autofocus: true,
        onClick: () => {
          const r = app.act('openTable', { tableId: table.id, covers: state.covers, waiterId: state.waiterId });
          return r.ok ? r.result : false;
        },
      },
    ],
  });
  if (sessionId) app.navigate(`/sala/tavolo/${table.id}`);
}
