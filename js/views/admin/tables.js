/**
 * Tavoli – lista per area (schermata 7) e dialog "Crea tavoli in blocco" (schermata 8).
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, screen, emptyState, field } from '../../components/layout.js';
import { openDialog } from '../../components/dialog.js';
import { stepper } from '../../components/stepper.js';
import { toast } from '../../components/toast.js';
import { planBulkTables } from '../../domain/tables.js';
import { plural } from '../../utils/format.js';
import { createAreaFlow } from './areas.js';

export const SHAPE_OPTIONS = [
  { value: 'round', label: 'Tonda', icon: 'circle' },
  { value: 'square', label: 'Quadrata', icon: 'square' },
  { value: 'rect', label: 'Rettang.', icon: 'rectangle' },
];

export function shapePicker(value, onChange) {
  const wrap = h('div', { class: 'shape-picker', role: 'group', 'aria-label': 'Forma' });
  const draw = (v) =>
    wrap.replaceChildren(
      ...SHAPE_OPTIONS.map((o) =>
        h('button', {
          type: 'button',
          class: 'shape-option',
          'aria-pressed': String(o.value === v),
          onClick: () => { draw(o.value); onChange(o.value); },
        }, icon(o.icon), o.label)),
    );
  draw(value);
  return wrap;
}

export function areaSelect(value, onChange, id) {
  return h('select', { class: 'select', id, onChange: (e) => onChange(e.target.value) },
    app.data.areas.map((a) => h('option', { value: a.id, selected: a.id === value }, a.name)));
}

function nextNumber(tables, prefix) {
  let max = 0;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`, 'i');
  for (const t of tables) {
    const m = re.exec(t.label.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export async function bulkCreateDialog(areaId) {
  const d = app.data;
  const state = { areaId: areaId || d.areas[0]?.id, quantity: 10, seats: 4, shape: 'square', prefix: 'T', start: nextNumber(d.tables, 'T') };
  const preview = h('div', { class: 'stack' });
  const startInput = h('input', { class: 'input', id: 'bulk-start', type: 'number', inputmode: 'numeric', min: 0, value: state.start, onInput: (e) => { state.start = Number(e.target.value) || 0; refresh(); } });
  let cta;

  function refresh() {
    const plan = planBulkTables(state, app.data.tables);
    const ok = plan.filter((p) => !p.exists).length;
    const areaName = (id) => app.data.areas.find((a) => a.id === id)?.name ?? '';
    preview.replaceChildren(
      h('div', { class: 'row row--between' }, h('span', { class: 'section-title' }, 'Anteprima'),
        h('span', { class: 'text-sm muted' }, `${plural(ok, 'tavolo', 'tavoli')} · ${plural(ok * state.seats, 'posto', 'posti')}`)),
      h('div', { class: 'bulk-preview' },
        plan.slice(0, 60).map((p) => h('div', { class: ['bulk-preview__item', p.exists && 'is-skipped'] }, h('b', {}, p.label), `${state.seats} p.`))),
      ...plan.filter((p) => p.exists).map((p) =>
        h('div', { class: 'banner banner--info' }, icon('info'), h('div', { class: 'banner__body' }, `${p.label} esiste già in ${areaName(p.existingAreaId)}: verrà saltato.`))),
    );
    if (cta) {
      cta.disabled = ok === 0;
      cta.textContent = ok ? `Crea ${plural(ok, 'tavolo', 'tavoli')}` : 'Nessun tavolo da creare';
    }
  }

  const body = h('div', { class: 'stack stack--4' },
    field('Area', areaSelect(state.areaId, (v) => { state.areaId = v; refresh(); }, 'bulk-area')),
    h('div', { class: 'form-grid form-grid--2' },
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Quantità'), stepper({ value: state.quantity, min: 1, max: 100, label: 'quantità', onChange: (v) => { state.quantity = v; refresh(); } })),
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Posti per tavolo'), stepper({ value: state.seats, min: 1, max: 20, label: 'posti per tavolo', onChange: (v) => { state.seats = v; refresh(); } }))),
    h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Forma'), shapePicker(state.shape, (v) => { state.shape = v; })),
    h('div', { class: 'form-grid form-grid--2' },
      field('Prefisso (facoltativo)', h('input', { class: 'input', id: 'bulk-prefix', value: state.prefix, maxlength: 6, onInput: (e) => {
        state.prefix = e.target.value.trim();
        state.start = nextNumber(app.data.tables, state.prefix);
        startInput.value = state.start;
        refresh();
      } })),
      field('Numera da', startInput)),
    preview,
  );

  const result = await openDialog({
    title: 'Crea tavoli in blocco',
    variant: 'sheet',
    body,
    actions: [
      { label: 'Annulla', value: null, variant: 'ghost' },
      {
        label: 'Crea',
        id: 'bulk-create',
        variant: 'primary',
        onClick: () => {
          const r = app.act('bulkCreateTables', state);
          return r.ok ? r.result : false;
        },
      },
    ],
    onOpen: ({ dialog }) => {
      cta = dialog.querySelector('[data-action="bulk-create"]');
      refresh();
    },
  });
  if (result) {
    toast(`Creati ${plural(result.created.length, 'tavolo', 'tavoli')}${result.skipped.length ? ` · saltati: ${result.skipped.join(', ')}` : ''}`);
  }
  return result;
}

async function newTableDialog(areaId) {
  const state = { label: '', areaId: areaId || app.data.areas[0]?.id, shape: 'square', seats: 4 };
  const err = h('div', { class: 'field__error', role: 'alert' });
  const id = await openDialog({
    title: 'Nuovo tavolo',
    variant: 'sheet',
    body: h('div', { class: 'stack stack--4' },
      field('Numero o nome', h('input', { class: 'input', autofocus: true, placeholder: 'Es. 12 o Finestra', onInput: (e) => (state.label = e.target.value) })),
      field('Area', areaSelect(state.areaId, (v) => (state.areaId = v))),
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Posti'), stepper({ value: 4, min: 1, max: 20, label: 'posti', onChange: (v) => (state.seats = v) })),
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Forma'), shapePicker(state.shape, (v) => (state.shape = v))),
      err),
    actions: [
      { label: 'Annulla', value: null, variant: 'ghost' },
      {
        label: 'Crea tavolo',
        variant: 'primary',
        onClick: () => {
          try {
            return app.store.dispatch('addTable', state);
          } catch (e) {
            err.textContent = e.message;
            return false;
          }
        },
      },
    ],
  });
  if (id) app.navigate(`/admin/tavoli/${id}`);
}

/** Azioni aggiuntive nella app bar (estese dalle milestone successive). */
export const tablesBarExtensions = [];
const tablesBarActions = (areaId) => tablesBarExtensions.map((fn) => fn(areaId));

export default function tablesView({ query }) {
  let areaId = query.area || null;

  return {
    title: 'Tavoli',
    render() {
      const { areas, tables, sessions } = app.data;
      if (!areas.length) {
        return screen({
          bar: appBar({ title: 'Tavoli', back: '/admin' }),
          bodyClass: 'screen__body--narrow',
          body: [
            emptyState({ iconName: 'meeting_room', title: 'Prima crea un’area', text: 'I tavoli appartengono a un’area (sala, dehors…).' }),
            h('button', { type: 'button', class: 'btn btn--primary btn--lg', onClick: createAreaFlow }, icon('add'), 'Nuova area'),
          ],
        });
      }
      if (!areas.some((a) => a.id === areaId)) areaId = areas[0].id;
      const inArea = tables.filter((t) => t.areaId === areaId);
      const openIds = new Set(sessions.filter((s) => s.status !== 'closed').map((s) => s.tableId));

      return h('div', { class: 'screen' },
        appBar({ title: 'Tavoli', back: '/admin', actions: tablesBarActions(areaId) }),
        h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Aree' },
          areas.map((a) =>
            h('button', {
              type: 'button',
              role: 'tab',
              class: 'tab',
              'aria-selected': String(a.id === areaId),
              onClick: () => { areaId = a.id; app.rerender(); },
            }, a.name, h('span', { class: 'tab__count' }, tables.filter((t) => t.areaId === a.id).length)))),
        h('main', { class: 'screen__body screen__body--narrow' },
          inArea.length
            ? h('div', { class: 'list' },
                inArea.map((t) =>
                  h('a', { class: 'list-item', href: `#/admin/tavoli/${t.id}` },
                    h('span', { class: ['table-thumb', `table-thumb--${t.shape}`] }, t.label),
                    h('span', { class: 'list-item__main' },
                      h('div', { class: 'list-item__title' }, `Tavolo ${t.label}`),
                      h('div', { class: 'list-item__sub' },
                        plural(t.seats.length, 'posto', 'posti'),
                        !t.active ? ' · disattivato' : '',
                        openIds.has(t.id) ? ' · servizio aperto' : '')),
                    icon('chevron_right'))))
            : emptyState({ iconName: 'table_restaurant', title: 'Nessun tavolo', text: 'Crea i tavoli per questa area.' }),
          h('div', { class: 'form-grid form-grid--2' },
            h('button', { type: 'button', class: 'btn btn--lg', onClick: () => newTableDialog(areaId) }, icon('add'), 'Nuovo tavolo'),
            h('button', { type: 'button', class: 'btn btn--primary btn--lg', onClick: () => bulkCreateDialog(areaId) }, icon('library_add'), 'Crea in blocco'))));
    },
  };
}
