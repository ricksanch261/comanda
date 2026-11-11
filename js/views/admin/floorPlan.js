/**
 * Editor della piantina (schermata 10): tavoli trascinabili, ridimensionabili e
 * ruotabili (scatti di 15°), griglia di aggancio, palette delle forme,
 * annulla/ripeti. Le coordinate sono in % di un'area quadrata.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, emptyState, field } from '../../components/layout.js';
import { openDialog } from '../../components/dialog.js';
import { stepper } from '../../components/stepper.js';
import { toast } from '../../components/toast.js';
import { SHAPE_OPTIONS } from './tables.js';
import { createAreaFlow } from './areas.js';

const GRID = 2.5; // % ≈ 20 px su una piantina di 800 px
const ROT_STEP = 15;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round1 = (v) => Math.round(v * 10) / 10;

function nextLabel(tables) {
  const nums = tables.map((t) => /^(\D*)(\d+)$/.exec(t.label.trim())).filter(Boolean);
  if (!nums.length) return String(tables.length + 1);
  const last = nums.reduce((m, x) => (Number(x[2]) > Number(m[2]) ? x : m));
  let n = Number(last[2]) + 1;
  const used = new Set(tables.map((t) => t.label.trim().toLowerCase()));
  while (used.has(`${last[1]}${n}`.toLowerCase())) n++;
  return `${last[1]}${n}`;
}

export default function floorPlanView({ params }) {
  let areaId = params.areaId || null;
  let draft = new Map(); // id → layout
  let history = [];
  let hIndex = -1;
  let selected = null;
  let snap = true;
  let dirty = false;

  function resetDraft() {
    draft = new Map(app.data.tables.filter((t) => t.areaId === areaId).map((t) => [t.id, { ...t.layout }]));
    history = [JSON.stringify([...draft])];
    hIndex = 0;
    dirty = false;
  }

  function commit() {
    history = history.slice(0, hIndex + 1);
    history.push(JSON.stringify([...draft]));
    if (history.length > 100) history.shift();
    hIndex = history.length - 1;
    dirty = true;
    app.rerender();
  }
  function undo() {
    if (hIndex <= 0) return;
    hIndex--;
    draft = new Map(JSON.parse(history[hIndex]));
    dirty = true;
    app.rerender();
  }
  function redo() {
    if (hIndex >= history.length - 1) return;
    hIndex++;
    draft = new Map(JSON.parse(history[hIndex]));
    dirty = true;
    app.rerender();
  }

  function save() {
    const layouts = [...draft].filter(([id]) => app.data.tables.some((t) => t.id === id)).map(([id, layout]) => ({ id, layout }));
    if (app.act('setLayouts', { layouts }).ok) {
      dirty = false;
      toast('Piantina salvata');
      resetDraft();
      app.rerender();
    }
  }

  const sn = (v) => (snap ? Math.round(v / GRID) * GRID : round1(v));

  function normalize(L) {
    const w = clamp(L.w, 6, 100);
    const hh = clamp(L.h, 6, 100);
    return { ...L, w, h: hh, x: clamp(L.x, 0, 100 - w), y: clamp(L.y, 0, 100 - hh), rotation: ((Math.round(L.rotation) % 360) + 360) % 360 };
  }

  function update(id, patch, el, record = false) {
    const next = normalize({ ...draft.get(id), ...patch });
    draft.set(id, next);
    if (el) applyStyle(el, next);
    if (record) commit();
  }

  function applyStyle(el, L) {
    el.style.left = `${L.x}%`;
    el.style.top = `${L.y}%`;
    el.style.width = `${L.w}%`;
    el.style.height = `${L.h}%`;
    el.style.transform = L.rotation ? `rotate(${L.rotation}deg)` : '';
    const inner = el.querySelector('.plan__inner');
    if (inner) inner.style.transform = L.rotation ? `rotate(${-L.rotation}deg)` : '';
  }

  /** Gestione del trascinamento: move | resize | rotate */
  function startDrag(e, id, mode) {
    const canvas = e.currentTarget.closest('.plan');
    const el = canvas.querySelector(`[data-table="${id}"]`);
    const rect = canvas.getBoundingClientRect();
    const start = { ...draft.get(id) };
    const px = e.clientX;
    const py = e.clientY;
    let moved = false;
    e.preventDefault();
    e.stopPropagation();
    if (selected !== id) {
      selected = id;
      canvas.querySelectorAll('.ed-table').forEach((t) => t.classList.toggle('is-selected', t.dataset.table === id));
    }
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev) => {
      const dx = ((ev.clientX - px) / rect.width) * 100;
      const dy = ((ev.clientY - py) / rect.height) * 100;
      if (Math.abs(dx) + Math.abs(dy) > 0.3) moved = true;
      if (mode === 'move') update(id, { x: sn(start.x + dx), y: sn(start.y + dy) }, el);
      else if (mode === 'resize') update(id, { w: sn(start.w + dx), h: sn(start.h + dy) }, el);
      else if (mode === 'rotate') {
        const cx = rect.left + ((start.x + start.w / 2) / 100) * rect.width;
        const cy = rect.top + ((start.y + start.h / 2) / 100) * rect.height;
        const deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
        update(id, { rotation: Math.round(deg / ROT_STEP) * ROT_STEP }, el);
      }
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      if (moved) commit();
      else app.rerender();
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }

  function onKey(e, id) {
    const step = e.shiftKey ? 5 : snap ? GRID : 1;
    const L = draft.get(id);
    const map = { ArrowLeft: { x: L.x - step }, ArrowRight: { x: L.x + step }, ArrowUp: { y: L.y - step }, ArrowDown: { y: L.y + step } };
    if (map[e.key]) {
      e.preventDefault();
      selected = id;
      update(id, map[e.key], null, true);
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      update(id, { rotation: L.rotation + (e.shiftKey ? -ROT_STEP : ROT_STEP) }, null, true);
    }
  }

  async function addFromPalette(shape) {
    const tables = app.data.tables;
    const state = { label: nextLabel(tables), seats: shape === 'rect' ? 6 : shape === 'round' ? 2 : 4 };
    const err = h('div', { class: 'field__error', role: 'alert' });
    const id = await openDialog({
      title: `Nuovo tavolo · ${SHAPE_OPTIONS.find((s) => s.value === shape).label}`,
      body: h('div', { class: 'stack stack--4' },
        field('Numero o nome', h('input', { class: 'input', value: state.label, autofocus: true, onInput: (e) => (state.label = e.target.value) })),
        h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Posti'), stepper({ value: state.seats, min: 1, max: 20, label: 'posti', onChange: (v) => (state.seats = v) })),
        err),
      actions: [
        { label: 'Annulla', value: null, variant: 'ghost' },
        {
          label: 'Aggiungi alla piantina',
          variant: 'primary',
          onClick: () => {
            try {
              return app.store.dispatch('addTable', { label: state.label, areaId, shape, seats: state.seats });
            } catch (e) {
              err.textContent = e.message;
              return false;
            }
          },
        },
      ],
    });
    if (id) {
      const t = app.data.tables.find((x) => x.id === id);
      draft.set(id, { ...t.layout });
      selected = id;
      commit();
    }
  }

  function duplicate(id) {
    const src = app.data.tables.find((t) => t.id === id);
    const r = app.act('addTable', { label: nextLabel(app.data.tables), areaId, shape: src.shape, seats: src.seats.length });
    if (!r.ok) return;
    const L = draft.get(id);
    const created = app.data.tables.find((t) => t.id === r.result);
    draft.set(r.result, normalize({ ...created.layout, w: L.w, h: L.h, rotation: L.rotation }));
    selected = r.result;
    commit();
    toast(`Creato ${created.label}`);
  }

  function selectedPanel(tables) {
    const t = tables.find((x) => x.id === selected);
    if (!t) return h('p', { class: 'text-sm muted' }, 'Tocca un tavolo per selezionarlo. Trascinalo per spostarlo, usa la maniglia in basso a destra per ridimensionarlo e quella in alto per ruotarlo. Da tastiera: frecce per spostare, R per ruotare.');
    const L = draft.get(t.id);
    const num = (label, key) =>
      field(label, h('input', {
        class: 'input',
        type: 'number',
        inputmode: 'decimal',
        min: 6,
        max: 100,
        step: snap ? GRID : 0.5,
        value: round1(L[key]),
        onChange: (e) => update(t.id, { [key]: Number(e.target.value) || L[key] }, null, true),
      }));
    return h('div', { class: 'stack stack--3' },
      h('div', { class: 'row row--between' }, h('h2', { class: 'section-title' }, 'Selezionato'), h('span', { class: 'bold' }, `Tavolo ${t.label}`)),
      h('div', { class: 'text-sm muted' }, `${t.seats.length} posti · ${SHAPE_OPTIONS.find((s) => s.value === t.shape).label}`),
      h('div', { class: 'form-grid form-grid--2' }, num('Larghezza (%)', 'w'), num('Altezza (%)', 'h')),
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, `Rotazione · ${L.rotation}°`),
        h('div', { class: 'rot-grid' },
          h('button', { type: 'button', class: 'btn btn--sm', 'aria-label': 'Ruota di −15°', onClick: () => update(t.id, { rotation: L.rotation - ROT_STEP }, null, true) }, icon('rotate_left')),
          [0, 45, 90, 135].map((deg) => h('button', { type: 'button', class: 'chip chip--sm', 'aria-pressed': String(L.rotation === deg), onClick: () => update(t.id, { rotation: deg }, null, true) }, `${deg}°`)),
          h('button', { type: 'button', class: 'btn btn--sm', 'aria-label': 'Ruota di +15°', onClick: () => update(t.id, { rotation: L.rotation + ROT_STEP }, null, true) }, icon('rotate_right')))),
      h('div', { class: 'form-grid form-grid--2' },
        h('button', { type: 'button', class: 'btn', onClick: () => duplicate(t.id) }, icon('content_copy'), 'Duplica'),
        h('a', { class: 'btn', href: `#/admin/tavoli/${t.id}` }, icon('edit'), 'Dettagli tavolo')));
  }

  return {
    title: 'Piantina',
    render() {
      const { areas } = app.data;
      if (!areas.length) {
        return h('div', { class: 'screen' }, appBar({ title: 'Piantina', back: '/admin' }),
          h('main', { class: 'screen__body screen__body--narrow' },
            emptyState({ iconName: 'map', title: 'Nessuna area', text: 'Crea prima un’area.' }),
            h('button', { type: 'button', class: 'btn btn--primary', onClick: createAreaFlow }, icon('add'), 'Nuova area')));
      }
      if (!areas.some((a) => a.id === areaId)) {
        areaId = areas[0].id;
        resetDraft();
      } else if (!history.length) resetDraft();
      const tables = app.data.tables.filter((t) => t.areaId === areaId);
      for (const t of tables) if (!draft.has(t.id)) draft.set(t.id, { ...t.layout });

      const canvas = h('div', { class: ['plan', 'plan--editor', snap && 'plan--snap'], role: 'application', 'aria-label': 'Piantina modificabile', onPointerdown: (e) => { if (e.target === e.currentTarget) { selected = null; app.rerender(); } } },
        tables.map((t) => {
          const L = draft.get(t.id);
          const el = h('button', {
            type: 'button',
            class: ['tcard', 'tcard--open', 'ed-table', `tcard--${t.shape}`, selected === t.id && 'is-selected'],
            'data-table': t.id,
            id: `ed-${t.id}`,
            'aria-label': `Tavolo ${t.label}, posizione ${Math.round(L.x)}, ${Math.round(L.y)}, rotazione ${L.rotation} gradi`,
            onPointerdown: (e) => startDrag(e, t.id, 'move'),
            onKeydown: (e) => onKey(e, t.id),
            onFocus: () => { if (selected !== t.id) { selected = t.id; app.rerender(); } },
          },
          h('span', { class: 'plan__inner' }, h('span', { class: 'tcard__label' }, t.label), h('span', { class: 'tcard__meta' }, `${t.seats.length} p.`)),
          selected === t.id ? h('span', { class: 'ed-handle ed-handle--resize', 'aria-hidden': 'true', onPointerdown: (e) => startDrag(e, t.id, 'resize') }) : null,
          selected === t.id ? h('span', { class: 'ed-handle ed-handle--rotate', 'aria-hidden': 'true', onPointerdown: (e) => startDrag(e, t.id, 'rotate') }, icon('rotate_right')) : null);
          applyStyle(el, L);
          return el;
        }));

      return h('div', { class: 'screen' },
        appBar({
          title: 'Piantina',
          back: `/admin/tavoli?area=${areaId}`,
          actions: [
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Annulla', disabled: hIndex <= 0, onClick: undo }, icon('undo')),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Ripeti', disabled: hIndex >= history.length - 1, onClick: redo }, icon('redo')),
            h('button', { type: 'button', class: 'btn btn--primary btn--sm', disabled: !dirty, onClick: save }, 'Salva'),
          ],
        }),
        h('div', { class: 'ed-toolbar' },
          h('select', {
            class: 'select',
            'aria-label': 'Area',
            style: { width: 'auto', minWidth: '160px' },
            onChange: (e) => {
              if (dirty && !window.confirm('Ci sono modifiche non salvate. Cambiare area e perderle?')) { e.target.value = areaId; return; }
              areaId = e.target.value;
              selected = null;
              resetDraft();
              app.rerender();
            },
          }, areas.map((a) => h('option', { value: a.id, selected: a.id === areaId }, a.name))),
          h('label', { class: 'chip', style: { cursor: 'pointer' } },
            h('input', { type: 'checkbox', class: 'checkbox', checked: snap, onChange: (e) => { snap = e.target.checked; app.rerender(); }, style: { width: '18px', height: '18px' } }),
            icon('grid_4x4'), 'Aggancio 20 px'),
          dirty ? h('span', { class: 'text-sm warning bold' }, 'Modifiche non salvate') : null),
        h('main', { class: 'ed-layout' },
          h('aside', { class: 'ed-palette', 'aria-label': 'Forme' },
            h('h2', { class: 'section-title' }, 'Forme'),
            h('div', { class: 'ed-palette__list' },
              SHAPE_OPTIONS.map((s) => h('button', { type: 'button', class: 'shape-option', onClick: () => addFromPalette(s.value) }, icon(s.icon), s.value === 'rect' ? 'Rettangolare' : s.label)))),
          h('div', { class: 'ed-canvas' }, tables.length ? canvas : emptyState({ iconName: 'table_restaurant', title: 'Nessun tavolo in quest’area', text: 'Aggiungi un tavolo dalla palette delle forme.' })),
          h('aside', { class: 'ed-side card' }, selectedPanel(tables))));
    },
  };
}
