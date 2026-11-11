/**
 * Selezione piatto (schermata 20): categorie in chip, ricerca, piatti con
 * allergeni (quelli in conflitto evidenziati), esauriti disattivati.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { allergenTags } from '../../components/allergenPicker.js';
import { emptyState } from '../../components/layout.js';
import { formatCents } from '../../utils/format.js';
import { intersectAllergens, targetSeatStates, allergenLabels, normalizeAllergens } from '../../domain/allergens.js';
import { seatLabelOf } from '../../domain/session.js';
import { normalizeSearch } from '../admin/menu.js';

export function targetDescription(table, session, asg) {
  if (asg.type === 'table') return { avatar: table.label, title: 'Per tutto il tavolo', short: 'Tavolo' };
  const states = targetSeatStates(session, asg);
  if (asg.type === 'seat') {
    const s = states[0];
    const label = seatLabelOf(table, s);
    return { avatar: label, title: `Per ${s.guestName || label}`, short: label };
  }
  const labels = states.map((s) => seatLabelOf(table, s)).join(', ');
  return { avatar: `×${states.length}`, title: `Condiviso: ${labels}`, short: labels };
}

/**
 * @param {object} o
 * @param {object} o.ui stato UI del tavolo (lastCat)
 * @param {Function} o.onQuickAdd (item) => void
 * @param {Function} o.onConfigure (item) => void
 */
export function pickerBody({ table, session, assignment, ui, search, onSearch, onQuickAdd, onConfigure, onChangeTarget, wide }) {
  const { categories, menuItems } = app.data;
  const usable = categories.filter((c) => menuItems.some((m) => m.categoryId === c.id));
  if (!usable.some((c) => c.id === ui.lastCat)) ui.lastCat = usable[0]?.id ?? null;
  const q = normalizeSearch(search);
  const items = menuItems
    .filter((m) => (q ? normalizeSearch(`${m.name} ${m.description}`).includes(q) : m.categoryId === ui.lastCat))
    .sort((a, b) => (a.available === b.available ? 0 : a.available ? -1 : 1) || categories.findIndex((c) => c.id === a.categoryId) - categories.findIndex((c) => c.id === b.categoryId) || a.sortOrder - b.sortOrder);

  const states = targetSeatStates(session, assignment);
  const guestAllergens = normalizeAllergens(states.flatMap((s) => s.allergens));
  const td = targetDescription(table, session, assignment);

  return h('div', { class: 'picker' },
    h('div', { class: ['target-card', guestAllergens.length && 'has-allergies'] },
      h('span', { class: 'avatar' }, td.avatar),
      h('div', { class: 'grow' },
        h('div', { class: 'bold' }, td.title),
        guestAllergens.length
          ? h('div', { class: 'target-card__alg' }, icon('warning', 'icon--xs'), `Allergie: ${allergenLabels(guestAllergens).join(', ')}`, wide ? ' — piatti a rischio segnalati' : '')
          : h('div', { class: 'text-sm muted' }, 'Nessuna allergia dichiarata')),
      onChangeTarget ? h('button', { type: 'button', class: 'btn btn--link', onClick: onChangeTarget }, 'Cambia') : null),
    h('div', { class: 'search' }, icon('search'),
      h('input', { class: 'input', id: 'picker-search', type: 'search', placeholder: 'Cerca nel menu', 'aria-label': 'Cerca nel menu', value: search, autocomplete: 'off', onInput: (e) => onSearch(e.target.value) })),
    q ? null : h('div', { class: 'chips', role: 'tablist', 'aria-label': 'Categorie' },
      usable.map((c) =>
        h('button', {
          type: 'button',
          role: 'tab',
          class: 'chip',
          'aria-selected': String(c.id === ui.lastCat),
          onClick: () => { ui.lastCat = c.id; app.rerender(); },
        }, c.name))),
    h('div', { class: 'dish-list', 'data-scroll': 'dishes' },
      !menuItems.length
        ? emptyState({ iconName: 'menu_book', title: 'Menu vuoto', text: 'Aggiungi i piatti in Amministrazione.' })
        : items.length
          ? items.map((m) => dishCard(m, guestAllergens, { onQuickAdd, onConfigure }))
          : emptyState({ iconName: 'search_off', title: 'Nessun piatto', text: q ? 'Nessun risultato per la ricerca.' : '' })));
}

function dishCard(m, guestAllergens, { onQuickAdd, onConfigure }) {
  const hits = intersectAllergens(m.allergens, guestAllergens);
  const out = !m.available;
  return h('div', { class: ['dish', out && 'is-out', hits.length && !out && 'is-conflict'], 'aria-disabled': out ? 'true' : null },
    h('button', { type: 'button', class: 'dish__main', disabled: out, onClick: () => onConfigure(m), 'aria-label': `${m.name}, ${formatCents(m.priceCents)} euro${out ? ', esaurito' : ''}. Opzioni` },
      h('span', { class: 'dish__head' }, h('span', { class: 'dish__name' }, m.name), h('span', { class: 'dish__price num' }, formatCents(m.priceCents))),
      m.description ? h('span', { class: 'dish__desc' }, m.description) : null,
      m.allergens.length || out || hits.length
        ? h('span', { class: 'allergen-tags' },
            allergenTags(m.allergens, hits),
            hits.length && !out ? h('span', { class: 'dish__conflict' }, icon('warning', 'icon--xs'), `Contiene ${allergenLabels(hits).join(', ')}`) : null,
            out ? h('span', { class: 'dish__out' }, 'ESAURITO') : null)
        : null),
    out
      ? h('button', { type: 'button', class: 'dish__add is-out', disabled: true, 'aria-label': `${m.name} esaurito` }, icon('block'))
      : h('button', { type: 'button', class: 'dish__add', 'aria-label': `Aggiungi ${m.name}`, onClick: () => onQuickAdd(m) }, icon('add')));
}
