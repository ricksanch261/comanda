/**
 * Dettaglio tavolo (schermata 9): etichetta, forma, area e lista dei posti
 * con etichette modificabili e riordinabili.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, screen, field, switchRow } from '../../components/layout.js';
import { makeSortable } from '../../components/sortable.js';
import { confirmDialog } from '../../components/dialog.js';
import { toast } from '../../components/toast.js';
import { shapePicker, areaSelect } from './tables.js';
import { notFound } from '../../components/notFound.js';
import { tableSeatsPreview } from '../../components/tableSeats.js';
import { newId } from '../../domain/ids.js';

export default function tableDetailView({ params }) {
  const table = app.data.tables.find((t) => t.id === params.id);
  if (!table) return notFound('Tavolo non trovato', '/admin/tavoli');

  const draft = {
    label: table.label,
    areaId: table.areaId,
    shape: table.shape,
    active: table.active,
    seats: table.seats.map((s) => ({ key: s.id, id: s.id, label: s.label })),
  };
  let error = null;
  let dirty = false;
  const touch = () => (dirty = true);

  function save() {
    const r = app.act('updateTable', {
      id: table.id,
      label: draft.label,
      areaId: draft.areaId,
      shape: draft.shape,
      active: draft.active,
      seats: draft.seats.map((s) => ({ id: s.id, label: s.label })),
    });
    if (r.ok) {
      dirty = false;
      const saved = app.data.tables.find((t) => t.id === table.id);
      draft.seats = saved.seats.map((s) => ({ key: s.id, id: s.id, label: s.label }));
      toast('Tavolo salvato');
    }
  }

  async function remove() {
    const ok = await confirmDialog({ title: `Eliminare il tavolo ${table.label}?`, message: 'Lo storico dei servizi chiusi resta nei report.', confirmLabel: 'Elimina', danger: true });
    if (ok && app.act('removeTable', { id: table.id }).ok) {
      toast('Tavolo eliminato', { icon: 'delete' });
      app.navigate(`/admin/tavoli?area=${table.areaId}`, { replace: true });
    }
  }

  function seatList() {
    const list = h('div', { class: 'list' },
      draft.seats.map((s, i) =>
        h('div', { class: 'list-item seat-row', 'data-id': s.key },
          h('button', { type: 'button', class: 'icon-btn drag-handle', id: `drag-${s.key}`, 'aria-label': `Riordina ${s.label} (usa le frecce)` }, icon('drag_indicator')),
          h('span', { class: 'seat-row__pos', 'aria-hidden': 'true' }, i + 1),
          h('input', {
            class: 'input grow',
            id: `seat-${s.key}`,
            value: s.label,
            maxlength: 20,
            'aria-label': `Etichetta posto ${i + 1}`,
            onInput: (e) => { s.label = e.target.value; touch(); },
            onChange: () => app.rerender(),
          }),
          h('button', {
            type: 'button',
            class: 'icon-btn icon-btn--danger',
            'aria-label': `Rimuovi ${s.label}`,
            disabled: draft.seats.length <= 1,
            onClick: () => { draft.seats.splice(i, 1); touch(); app.rerender(); },
          }, icon('delete')))));
    makeSortable(list, {
      onReorder: (keys) => {
        draft.seats.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
        touch();
        app.rerender();
      },
    });
    return list;
  }

  function addSeat() {
    const used = new Set(draft.seats.map((s) => s.label));
    let n = draft.seats.length + 1;
    while (used.has(`P${n}`)) n++;
    draft.seats.push({ key: newId(), id: null, label: `P${n}` });
    touch();
    app.rerender();
  }

  return {
    title: `Tavolo ${table.label}`,
    render() {
      if (!app.data.tables.some((t) => t.id === table.id)) return h('div');
      return screen({
        bar: appBar({
          title: `Tavolo ${draft.label || table.label}`,
          back: `/admin/tavoli?area=${table.areaId}`,
          actions: [h('button', { type: 'button', class: 'btn btn--primary btn--sm', onClick: save }, 'Salva')],
        }),
        bodyClass: 'screen__body--narrow',
        body: [
          dirty ? h('div', { class: 'banner banner--warning' }, icon('edit_note'), h('div', { class: 'banner__body' }, 'Modifiche non salvate.')) : null,
          error && h('div', { class: 'banner banner--danger' }, icon('error'), h('div', { class: 'banner__body' }, error)),
          h('section', { class: 'card stack stack--4' },
            h('div', { class: 'form-grid form-grid--2' },
              field('Etichetta', h('input', { class: 'input', value: draft.label, maxlength: 20, onInput: (e) => { draft.label = e.target.value; touch(); } })),
              field('Area', areaSelect(draft.areaId, (v) => { draft.areaId = v; touch(); }))),
            h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Forma'),
              shapePicker(draft.shape, (v) => { draft.shape = v; touch(); app.rerender(); })),
            switchRow({ id: 'table-active', label: 'Attivo', sub: 'I tavoli disattivati non compaiono in Sala', checked: draft.active, onChange: (v) => { draft.active = v; touch(); } })),
          h('div', { class: 'table-preview', 'aria-hidden': 'true' },
            tableSeatsPreview({ shape: draft.shape, seats: draft.seats.map((s) => ({ label: s.label })) })),
          h('section', { class: 'stack stack--3' },
            h('div', { class: 'row row--between' },
              h('h2', { class: 'section-title' }, `Posti · ${draft.seats.length}`),
              h('span', { class: 'text-xs muted' }, 'Trascina per riordinare')),
            seatList(),
            h('button', { type: 'button', class: 'btn', disabled: draft.seats.length >= 20, onClick: addSeat }, icon('add'), 'Aggiungi posto')),
          h('button', { type: 'button', class: 'btn btn--danger-outline', onClick: remove }, icon('delete'), 'Elimina tavolo'),
          h('div', { class: 'sticky-actions' }, h('button', { type: 'button', class: 'btn btn--primary btn--lg', onClick: save }, 'Salva tavolo')),
        ],
      });
    },
  };
}
