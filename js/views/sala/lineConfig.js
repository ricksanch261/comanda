/**
 * Configurazione riga (schermata 21): varianti, quantità, nota, portata,
 * destinatari modificabili. Usata anche per modificare una bozza.
 * Restituisce { quantity, modifiers, note, courseIndex, assignment } oppure
 * { action: 'delete' | 'repeat' }, o null se annullata.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { openDialog } from '../../components/dialog.js';
import { stepper } from '../../components/stepper.js';
import { field } from '../../components/layout.js';
import { allergenTags } from '../../components/allergenPicker.js';
import { formatEuro, formatDelta } from '../../utils/format.js';
import { sessionSeats } from '../../domain/session.js';
import { findAllergenConflicts } from '../../domain/allergens.js';

export async function lineConfig({ item, table, session, assignment, line = null }) {
  const { modifierGroups, settings, categories } = app.data;
  const groups = item.modifierGroupIds.map((id) => modifierGroups.find((g) => g.id === id)).filter(Boolean);
  const cat = categories.find((c) => c.id === item.categoryId);
  const seats = sessionSeats(table, session);
  const state = {
    quantity: line?.quantity ?? 1,
    note: line?.note ?? '',
    courseIndex: line ? line.courseIndex : cat?.courseIndex ?? null,
    picked: new Map(groups.map((g) => [g.id, new Set((line?.modifiers || []).filter((m) => m.groupId === g.id).map((m) => m.optionId))])),
    table: assignment.type === 'table',
    seatIds: new Set(assignment.type === 'table' ? [] : assignment.seatIds),
  };
  const errors = h('div', { class: 'field__error', role: 'alert' });
  let cta = null;

  const unitPrice = () =>
    item.priceCents +
    groups.reduce((t, g) => t + [...state.picked.get(g.id)].reduce((s, oid) => s + (g.options.find((o) => o.id === oid)?.priceDeltaCents || 0), 0), 0);
  const currentAssignment = () => {
    if (state.table || state.seatIds.size === 0) return { type: 'table' };
    const ids = seats.map((s) => s.seatId).filter((id) => state.seatIds.has(id));
    return ids.length === 1 ? { type: 'seat', seatIds: ids } : { type: 'shared', seatIds: ids };
  };
  const refreshCta = () => {
    if (cta) cta.textContent = `${line ? 'Salva' : 'Aggiungi'} · ${formatEuro(unitPrice() * state.quantity)}`;
  };

  const groupEls = groups.map((g) => {
    const wrap = h('div', { class: 'chips chips--wrap', role: 'group', 'aria-label': g.name });
    const draw = () =>
      wrap.replaceChildren(
        ...g.options.map((o) =>
          h('button', {
            type: 'button',
            class: 'chip',
            'aria-pressed': String(state.picked.get(g.id).has(o.id)),
            onClick: () => {
              const set = state.picked.get(g.id);
              if (set.has(o.id)) set.delete(o.id);
              else {
                if (!g.multiple) set.clear();
                set.add(o.id);
              }
              draw();
              refreshCta();
            },
          }, o.name, o.priceDeltaCents ? h('span', { class: 'muted', style: { fontWeight: 400 } }, formatDelta(o.priceDeltaCents)) : null)),
      );
    draw();
    return h('div', { class: 'field' },
      h('span', { class: 'field__label' }, g.name, g.required ? ' · obbligatoria' : g.multiple ? ' · facoltative' : ' · facoltativa'),
      wrap);
  });

  const recipients = h('div', { class: 'chips chips--wrap', role: 'group', 'aria-label': 'Destinatari' });
  const conflictsEl = h('div');
  const drawRecipients = () => {
    recipients.replaceChildren(
      ...seats.map((s) =>
        h('button', {
          type: 'button',
          class: ['chip', s.allergens.length && 'chip--error'],
          'aria-pressed': String(!state.table && state.seatIds.has(s.seatId)),
          onClick: () => {
            state.table = false;
            if (state.seatIds.has(s.seatId)) state.seatIds.delete(s.seatId);
            else state.seatIds.add(s.seatId);
            if (!state.seatIds.size) state.table = true;
            drawRecipients();
          },
        }, icon(s.allergens.length ? 'warning' : 'person'), s.guestName ? `${s.label} · ${s.guestName}` : s.label)),
      h('button', {
        type: 'button',
        class: 'chip',
        'aria-pressed': String(state.table),
        onClick: () => { state.table = true; state.seatIds.clear(); drawRecipients(); },
      }, icon('table_restaurant'), 'Tavolo'),
    );
    const c = findAllergenConflicts(item.allergens, session, currentAssignment());
    conflictsEl.replaceChildren(
      c.length ? h('div', { class: 'field__error' }, icon('warning', 'icon--xs'), 'Allergene in conflitto con un destinatario: verrà chiesta conferma.') : '',
    );
  };
  drawRecipients();

  const body = h('div', { class: 'stack stack--4' },
    item.description ? h('p', { class: 'muted text-sm' }, item.description) : null,
    item.allergens.length ? h('div', { class: 'allergen-tags' }, allergenTags(item.allergens)) : null,
    ...groupEls,
    h('div', { class: 'form-grid form-grid--2' },
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Quantità'),
        stepper({ value: state.quantity, min: 1, max: 99, label: 'quantità', onChange: (v) => { state.quantity = v; refreshCta(); } })),
      field('Portata', h('select', { class: 'select', onChange: (e) => (state.courseIndex = e.target.value === '' ? null : Number(e.target.value)) },
        h('option', { value: '', selected: state.courseIndex === null }, 'Nessuna'),
        settings.courses.map((c, i) => h('option', { value: String(i), selected: state.courseIndex === i }, c))))),
    h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Per'), recipients, conflictsEl),
    field('Nota per la cucina', h('textarea', { class: 'textarea', rows: 2, maxlength: 140, placeholder: 'Es. senza cipolla', onInput: (e) => (state.note = e.target.value) }, state.note)),
    errors,
  );

  const actions = [];
  if (line) {
    actions.push({ label: 'Elimina', icon: 'delete', variant: 'danger-outline', value: { action: 'delete' } });
    actions.push({ label: 'Ripeti su…', icon: 'content_copy', variant: 'ghost', value: { action: 'repeat' } });
  }
  actions.push({
    label: 'Aggiungi',
    variant: 'primary',
    id: 'line-ok',
    onClick: () => {
      for (const g of groups) {
        if (g.required && !state.picked.get(g.id).size) {
          errors.textContent = `Scegli: ${g.name}.`;
          return false;
        }
      }
      return {
        quantity: state.quantity,
        note: state.note,
        courseIndex: state.courseIndex,
        modifiers: groups.flatMap((g) => [...state.picked.get(g.id)].map((optionId) => ({ groupId: g.id, optionId }))),
        assignment: currentAssignment(),
      };
    },
  });

  return openDialog({
    title: h('span', { class: 'row row--between', style: { width: '100%' } }, h('span', {}, item.name), h('span', { class: 'num' }, formatEuro(item.priceCents))),
    variant: 'sheet',
    body,
    actions,
    onOpen: ({ dialog }) => {
      cta = dialog.querySelector('[data-action="line-ok"]');
      refreshCta();
    },
  });
}
