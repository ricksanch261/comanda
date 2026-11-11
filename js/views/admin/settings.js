/**
 * Impostazioni generali (schermata 5): nome, coperto, portate, camerieri, tema, PIN.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, screen, field, switchRow, segmented } from '../../components/layout.js';
import { makeSortable } from '../../components/sortable.js';
import { openDialog } from '../../components/dialog.js';
import { toast } from '../../components/toast.js';
import { formatCents, parseEuroToCents } from '../../utils/format.js';
import { getPrefs, setPrefs } from '../../state/prefs.js';
import { hashPin, isValidPin } from '../../state/auth.js';
import { newId } from '../../domain/ids.js';

export default function settingsView() {
  const s = app.data.settings;
  const draft = {
    restaurantName: s.restaurantName,
    coverEnabled: s.coverCharge.enabled,
    coverText: formatCents(s.coverCharge.amountCents),
    courses: s.courses.map((name, i) => ({ key: newId(), name, prevIndex: i })),
    waiters: s.waiters.map((w) => ({ ...w })),
  };
  let errors = {};
  let dirty = false;
  const touch = () => (dirty = true);

  function save() {
    errors = {};
    const cents = parseEuroToCents(draft.coverText);
    if (draft.coverEnabled && (cents === null || cents < 0)) errors.cover = 'Importo non valido.';
    if (!draft.restaurantName.trim()) errors.name = 'Il nome è obbligatorio.';
    if (!draft.courses.some((c) => c.name.trim())) errors.courses = 'Serve almeno una portata.';
    if (Object.keys(errors).length) return app.rerender();
    const r1 = app.act('updateSettings', {
      restaurantName: draft.restaurantName,
      coverCharge: { enabled: draft.coverEnabled, amountCents: cents ?? 0 },
      waiters: draft.waiters,
    });
    if (!r1.ok) return;
    const r2 = app.act('setCourses', { courses: draft.courses });
    if (!r2.ok) return;
    dirty = false;
    // Riallinea gli indici delle portate al nuovo ordine salvato.
    draft.courses = app.data.settings.courses.map((name, i) => ({ key: newId(), name, prevIndex: i }));
    draft.waiters = app.data.settings.waiters.map((w) => ({ ...w }));
    toast('Impostazioni salvate');
  }

  async function changePin() {
    let p1 = '';
    let p2 = '';
    const err = h('div', { class: 'field__error', role: 'alert' });
    const ok = await openDialog({
      title: 'Cambia PIN',
      body: h('div', { class: 'stack stack--4' },
        field('Nuovo PIN (4–6 cifre)', h('input', { class: 'input', type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: 6, onInput: (e) => (p1 = e.target.value) })),
        field('Conferma PIN', h('input', { class: 'input', type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: 6, onInput: (e) => (p2 = e.target.value) })),
        err),
      actions: [
        { label: 'Annulla', value: false, variant: 'ghost' },
        {
          label: 'Salva PIN',
          variant: 'primary',
          onClick: async () => {
            if (!isValidPin(p1)) { err.textContent = 'Il PIN deve avere da 4 a 6 cifre.'; return false; }
            if (p1 !== p2) { err.textContent = 'I due PIN non coincidono.'; return false; }
            const r = app.act('setAdminPin', { adminPinHash: await hashPin(p1) });
            return r.ok ? true : false;
          },
        },
      ],
    });
    if (ok) toast('PIN aggiornato');
  }

  function courseList() {
    const list = h('div', { class: 'list' },
      draft.courses.map((c, i) =>
        h('div', { class: 'list-item seat-row', 'data-id': c.key },
          h('button', { type: 'button', class: 'icon-btn drag-handle', id: `drag-${c.key}`, 'aria-label': `Riordina ${c.name || 'portata'} (usa le frecce)` }, icon('drag_indicator')),
          h('input', {
            class: 'input grow',
            value: c.name,
            'aria-label': `Nome portata ${i + 1}`,
            onInput: (e) => { c.name = e.target.value; touch(); },
          }),
          h('button', {
            type: 'button',
            class: 'icon-btn icon-btn--danger',
            'aria-label': `Rimuovi ${c.name}`,
            disabled: draft.courses.length <= 1,
            onClick: () => { draft.courses.splice(i, 1); touch(); app.rerender(); },
          }, icon('delete')))));
    makeSortable(list, {
      onReorder: (keys) => {
        draft.courses.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
        touch();
        app.rerender();
      },
    });
    return list;
  }

  function waiterList() {
    return h('div', { class: 'list' },
      draft.waiters.map((w, i) =>
        h('div', { class: 'list-item seat-row' },
          h('span', { class: 'avatar' }, (w.name || '?').slice(0, 1).toUpperCase()),
          h('input', {
            class: 'input grow',
            value: w.name,
            placeholder: 'Nome',
            'aria-label': `Nome cameriere ${i + 1}`,
            onInput: (e) => { w.name = e.target.value; touch(); },
          }),
          h('button', {
            type: 'button',
            class: 'icon-btn icon-btn--danger',
            'aria-label': `Rimuovi ${w.name || 'cameriere'}`,
            onClick: () => { draft.waiters.splice(i, 1); touch(); app.rerender(); },
          }, icon('delete')))),
    );
  }

  return {
    title: 'Impostazioni',
    render() {
      const prefs = getPrefs();
      return screen({
        bar: appBar({
          title: 'Impostazioni',
          back: '/admin',
          actions: [h('button', { type: 'button', class: 'btn btn--primary btn--sm', onClick: save }, 'Salva')],
        }),
        bodyClass: 'screen__body--narrow',
        body: [
          dirty ? h('div', { class: 'banner banner--warning' }, icon('edit_note'), h('div', { class: 'banner__body' }, 'Modifiche non salvate.')) : null,
          h('section', { class: 'card stack stack--4' },
            field('Nome locale', h('input', { class: 'input', value: draft.restaurantName, onInput: (e) => { draft.restaurantName = e.target.value; touch(); } }), { error: errors.name }),
            switchRow({
              id: 'cover-enabled',
              label: 'Coperto',
              sub: 'Importo addebitato per ogni posto occupato',
              checked: draft.coverEnabled,
              onChange: (v) => { draft.coverEnabled = v; touch(); app.rerender(); },
            }),
            draft.coverEnabled
              ? field('Coperto a persona', h('div', { class: 'input-affix' }, h('span', { class: 'affix' }, '€'),
                  h('input', { class: 'input', id: 'cover-amount', inputmode: 'decimal', value: draft.coverText, onInput: (e) => { draft.coverText = e.target.value; touch(); } })), { error: errors.cover, id: 'cover-amount' })
              : null),
          h('section', { class: 'card stack stack--3' },
            h('h2', { class: 'section-title' }, 'Tema'),
            segmented({
              label: 'Tema',
              block: true,
              value: prefs.theme,
              options: [
                { value: 'auto', label: 'Automatico', icon: 'brightness_auto' },
                { value: 'light', label: 'Chiaro', icon: 'light_mode' },
                { value: 'dark', label: 'Scuro', icon: 'dark_mode' },
              ],
              onChange: (v) => { setPrefs({ theme: v }); app.rerender(); },
            }),
            h('p', { class: 'text-sm muted' }, 'Vale solo per questo dispositivo.')),
          h('section', { class: 'stack stack--3' },
            h('div', { class: 'row row--between' }, h('h2', { class: 'section-title' }, 'Portate · ordine di uscita'), h('span', { class: 'text-xs muted' }, 'Trascina per riordinare')),
            errors.courses && h('div', { class: 'field__error' }, errors.courses),
            courseList(),
            h('button', { type: 'button', class: 'btn', onClick: () => { draft.courses.push({ key: newId(), name: '', prevIndex: null }); touch(); app.rerender(); } }, icon('add'), 'Aggiungi portata')),
          h('section', { class: 'stack stack--3' },
            h('h2', { class: 'section-title' }, 'Camerieri (facoltativo)'),
            draft.waiters.length ? waiterList() : h('p', { class: 'text-sm muted' }, 'Se aggiungi dei camerieri, in Sala verrà chiesto “Chi sei?”.'),
            h('button', { type: 'button', class: 'btn', onClick: () => { draft.waiters.push({ id: newId(), name: '' }); touch(); app.rerender(); } }, icon('person_add'), 'Aggiungi cameriere')),
          h('section', { class: 'card stack stack--3' },
            h('h2', { class: 'section-title' }, 'Sicurezza'),
            h('button', { type: 'button', class: 'btn', onClick: changePin }, icon('password'), 'Cambia PIN amministratore')),
          h('div', { class: 'sticky-actions' }, h('button', { type: 'button', class: 'btn btn--primary btn--lg', onClick: save }, 'Salva impostazioni')),
        ],
      });
    },
  };
}
