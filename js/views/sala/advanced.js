/**
 * Funzioni avanzate di sala (M5): portate trattenute e marcia, righe servite,
 * storno con motivo (schermata 24), sposta riga, sposta e unisci tavoli.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { openDialog } from '../../components/dialog.js';
import { toast } from '../../components/toast.js';
import { formatEuro, plural } from '../../utils/format.js';
import { hasHeldWork, sessionSeats, openSessionOf, getTableStatus } from '../../domain/session.js';
import { findAllergenConflicts } from '../../domain/allergens.js';
import { allergenAlert } from './allergenAlert.js';

const courseName = (i) => app.data.settings.courses[i] ?? 'Altro';
const lower = (s) => s.toLocaleLowerCase('it-IT');

/** Prima portata trattenuta con righe da marciare. */
function nextHeldCourse(session) {
  const drafts = new Set(session.orderLines.filter((l) => l.status === 'draft').map((l) => l.courseIndex));
  return [...session.heldCourses].sort((a, b) => a - b).find((c) => drafts.has(c)) ?? null;
}

function march(session, courseIndex) {
  const r = app.act('marchCourse', { sessionId: session.id, courseIndex });
  if (r.ok) toast(`Marcia: ${lower(courseName(courseIndex))} · ${plural(r.result.length, 'riga inviata', 'righe inviate')}`, { icon: 'play_circle' });
}

/** Pulsante "Marcia" della bottom bar. */
export function marchBarButton({ session }) {
  const c = hasHeldWork(session) ? nextHeldCourse(session) : null;
  const wide = window.matchMedia('(min-width: 768px)').matches;
  return h('button', {
    type: 'button',
    class: 'bottom-bar__tool',
    disabled: c === null,
    'aria-label': c === null ? 'Marcia: nessuna portata in attesa' : `Marcia i ${lower(courseName(c))}`,
    onClick: () => c !== null && march(session, c),
  }, icon('play_circle', 'warning'), wide && c !== null ? `Marcia i ${lower(courseName(c))}` : 'Marcia');
}

/** Stato del gruppo di portata: "In attesa · da marciare". */
export function groupInfo({ session, group }) {
  if (group.courseIndex !== null && session.heldCourses.includes(group.courseIndex) && group.lines.some((l) => l.status === 'draft')) {
    return { icon: 'pause_circle', text: 'In attesa · da marciare', cls: 'warning' };
  }
  return null;
}

/** Azioni sul gruppo: Segue / Marcia / Servita. */
export function groupActions({ session, group }) {
  const c = group.courseIndex;
  const drafts = group.lines.filter((l) => l.status === 'draft');
  const sent = group.lines.filter((l) => l.status === 'sent');
  const held = c !== null && session.heldCourses.includes(c);
  const btns = [];
  if (c !== null && drafts.length) {
    if (held) {
      btns.push(h('button', { type: 'button', class: 'btn btn--sm', onClick: () => march(session, c) }, icon('play_circle', 'icon--sm warning'), 'Marcia'));
      btns.push(h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onClick: () => app.act('releaseCourse', { sessionId: session.id, courseIndex: c }), 'aria-label': `Non trattenere ${courseName(c)}` }, 'Non trattenere'));
    } else {
      btns.push(h('button', { type: 'button', class: 'btn btn--sm', onClick: () => app.act('holdCourse', { sessionId: session.id, courseIndex: c }), title: 'Trattieni: le bozze non partono con “Invia comanda”' }, icon('pause_circle', 'icon--sm'), 'Segue'));
    }
  }
  if (sent.length) {
    btns.push(h('button', {
      type: 'button',
      class: 'btn btn--sm btn--ghost',
      'aria-label': `Segna ${group.name} come servita`,
      onClick: () => {
        const r = app.act('markServed', { sessionId: session.id, lineIds: sent.map((l) => l.id) });
        if (r.ok) toast(`${group.name}: servita`, { icon: 'check_circle' });
      },
    }, icon('check_circle', 'icon--sm success'), 'Servita'));
  }
  return btns.length ? h('span', { class: 'row', style: { marginLeft: 'auto', gap: '4px' } }, btns) : null;
}

/** Nel riepilogo comanda: scelta delle portate da trattenere. */
export function holdOptions({ session, drafts, state }) {
  const courses = [...new Set(drafts.map((l) => l.courseIndex).filter((c) => c !== null && !session.heldCourses.includes(c)))].sort((a, b) => a - b);
  if (courses.length < 2) return null;
  // Di default partono i piatti della prima portata, le successive "seguono".
  state.hold = courses.slice(1);
  return (redraw) =>
    h('section', { class: 'stack' },
      h('h3', { class: 'section-title' }, 'Portate successive'),
      courses.slice(1).map((c) =>
        h('label', { class: 'check-row' },
          h('input', {
            type: 'checkbox',
            class: 'checkbox',
            checked: state.hold.includes(c),
            onChange: (e) => {
              state.hold = e.target.checked ? [...state.hold, c] : state.hold.filter((x) => x !== c);
              redraw();
            },
          }),
          h('span', {}, `${courseName(c)} in attesa (da marciare)`))));
}

/* ------------------------------ Righe inviate ----------------------------- */

const VOID_REASONS = ['Errore di inserimento', 'Piatto rifiutato', 'Cambio ordine del cliente', 'Problema in cucina', 'Omaggio'];

/** Storno riga (schermata 24): motivo obbligatorio. */
export async function voidDialog({ session, line }) {
  const state = { reason: '', other: '' };
  const err = h('div', { class: 'field__error', role: 'alert' });
  const otherInput = h('input', { class: 'input', placeholder: 'Scrivi il motivo', 'aria-label': 'Altro motivo', hidden: true, onInput: (e) => (state.other = e.target.value) });
  const chips = h('div', { class: 'chips chips--wrap', role: 'radiogroup', 'aria-label': 'Motivo' });
  const draw = () =>
    chips.replaceChildren(
      ...[...VOID_REASONS, 'Altro…'].map((r) =>
        h('button', {
          type: 'button',
          class: 'chip',
          role: 'radio',
          'aria-checked': String(state.reason === r),
          'aria-pressed': String(state.reason === r),
          onClick: () => {
            state.reason = r;
            otherInput.hidden = r !== 'Altro…';
            if (r === 'Altro…') otherInput.focus();
            err.textContent = '';
            draw();
          },
        }, r)),
    );
  draw();
  const r = await openDialog({
    title: `Storna “${line.nameSnapshot}”?`,
    body: h('div', { class: 'stack stack--3' },
      h('p', {}, 'La riga è già stata inviata. Il motivo è obbligatorio e resta nello storico.'),
      h('div', { class: 'text-sm muted' }, `${line.quantity}× ${line.nameSnapshot} · ${formatEuro(line.unitPriceCents * line.quantity)}`),
      chips,
      otherInput,
      err),
    actions: [
      { label: 'Annulla', value: null, variant: 'ghost', autofocus: true },
      {
        label: 'Storna',
        variant: 'danger',
        onClick: () => {
          const reason = state.reason === 'Altro…' ? state.other.trim() : state.reason;
          if (!reason) {
            err.textContent = 'Scegli o scrivi un motivo.';
            return false;
          }
          return reason;
        },
      },
    ],
  });
  if (r) {
    const res = app.act('voidLine', { sessionId: session.id, lineId: line.id, reason: r });
    if (res.ok) toast(`Stornata: ${line.nameSnapshot}`, { icon: 'block' });
  }
}

async function chooseTarget(table, session, title) {
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

/** Tap su una riga inviata/servita: menu azioni. */
export async function sentLineTap({ table, session, line }) {
  const choice = await openDialog({
    title: `${line.quantity}× ${line.nameSnapshot}`,
    variant: 'sheet',
    body: (api) =>
      h('div', { class: 'list' },
        line.status === 'sent'
          ? h('button', { type: 'button', class: 'list-item', onClick: () => api.close('served') }, icon('check_circle', 'success'), h('span', { class: 'list-item__main list-item__title' }, 'Segna come servita'))
          : null,
        h('button', { type: 'button', class: 'list-item', onClick: () => api.close('move') }, icon('swap_horiz'), h('span', { class: 'list-item__main list-item__title' }, 'Sposta su un altro posto o sul tavolo')),
        h('button', { type: 'button', class: 'list-item', onClick: () => api.close('repeat') }, icon('content_copy'), h('span', { class: 'list-item__main list-item__title' }, 'Ripeti (nuova bozza)')),
        h('button', { type: 'button', class: 'list-item', onClick: () => api.close('void') }, icon('block', 'danger'), h('span', { class: 'list-item__main list-item__title danger' }, 'Storna…'))),
  });
  if (choice === 'served') app.act('markServed', { sessionId: session.id, lineIds: [line.id] });
  if (choice === 'void') voidDialog({ session, line });
  if (choice === 'move' || choice === 'repeat') {
    const asg = await chooseTarget(table, session, choice === 'move' ? `Sposta “${line.nameSnapshot}” su…` : `Ripeti “${line.nameSnapshot}” su…`);
    if (!asg) return;
    const item = app.data.menuItems.find((m) => m.id === line.menuItemId);
    const fresh = openSessionOf(app.data.sessions, table.id);
    const conflicts = item ? findAllergenConflicts(item.allergens, fresh, asg) : [];
    const override = conflicts.length ? await allergenAlert({ dishName: line.nameSnapshot, conflicts, table, session: fresh }) : false;
    if (conflicts.length && !override) return;
    if (choice === 'move') {
      if (app.act('moveLine', { sessionId: session.id, lineId: line.id, assignment: asg, allergenOverride: override }).ok) toast('Riga spostata', { icon: 'swap_horiz' });
    } else if (app.act('repeatOrderLine', { sessionId: session.id, lineId: line.id, assignment: asg, allergenOverride: override }).ok) {
      toast(`Ripetuto: ${line.nameSnapshot}`);
    }
  }
}

/* --------------------------- Sposta / unisci tavoli ------------------------ */

function tablePicker(tables, api) {
  if (!tables.length) return h('p', { class: 'muted' }, 'Nessun tavolo disponibile.');
  const areas = app.data.areas;
  return h('div', { class: 'stack stack--3' },
    areas.map((a) => {
      const list = tables.filter((t) => t.areaId === a.id);
      if (!list.length) return null;
      return h('div', { class: 'stack' },
        h('div', { class: 'section-title' }, a.name),
        h('div', { class: 'chips chips--wrap' },
          list.map((t) => h('button', { type: 'button', class: 'chip', onClick: () => api.close(t.id) }, t.label, h('span', { class: 'muted', style: { fontWeight: 400 } }, ` · ${t.seats.length} p.`)))));
    }));
}

export function moveTableItem({ table, session, close }) {
  return h('button', {
    type: 'button',
    class: 'list-item',
    onClick: async () => {
      close();
      const free = app.data.tables.filter((t) => t.active && t.id !== table.id && !openSessionOf(app.data.sessions, t.id));
      const to = await openDialog({ title: `Sposta ${table.label} su…`, variant: 'sheet', body: (api) => tablePicker(free, api) });
      if (!to) return;
      const target = app.data.tables.find((t) => t.id === to);
      if (app.act('moveSession', { sessionId: session.id, toTableId: to }).ok) {
        toast(`${table.label} spostato su ${target.label}`, { icon: 'move_up' });
        app.navigate(`/sala/tavolo/${to}`, { replace: true });
      }
    },
  }, icon('move_up'), h('span', { class: 'list-item__main list-item__title' }, 'Sposta tavolo'));
}

export function mergeTableItem({ table, session, close }) {
  return h('button', {
    type: 'button',
    class: 'list-item',
    onClick: async () => {
      close();
      const others = app.data.tables.filter((t) => t.id !== table.id && openSessionOf(app.data.sessions, t.id));
      const from = await openDialog({
        title: `Unisci a ${table.label}`,
        variant: 'sheet',
        body: (api) => h('div', { class: 'stack' },
          h('p', { class: 'text-sm muted' }, `Il servizio del tavolo scelto confluisce in ${table.label}: i suoi posti diventano posti extra, con il nome del tavolo d’origine.`),
          tablePicker(others, api)),
      });
      if (!from) return;
      const src = app.data.tables.find((t) => t.id === from);
      const srcSession = openSessionOf(app.data.sessions, from);
      if (app.act('mergeSessions', { targetSessionId: session.id, sourceSessionId: srcSession.id }).ok) {
        toast(`${src.label} unito a ${table.label}`, { icon: 'merge' });
      }
    },
  }, icon('merge'), h('span', { class: 'list-item__main list-item__title' }, 'Unisci un altro tavolo'));
}

export function closeItem({ table, session, close }) {
  if (getTableStatus(table, session) === 'free') return null;
  return h('button', { type: 'button', class: 'list-item', onClick: () => { close(); app.navigate(`/sala/tavolo/${table.id}/conto`); } },
    icon('task_alt'), h('span', { class: 'list-item__main list-item__title' }, 'Chiudi tavolo (dal conto)'));
}
