/**
 * Selettore dei 14 allergeni (icona + sigla + nome), multi-selezione.
 */
import { h, icon } from '../utils/dom.js';
import { ALLERGENS } from '../domain/allergens.js';

export function allergenPicker({ selected, onChange, label = 'Allergeni' }) {
  const set = new Set(selected);
  return h(
    'div',
    { class: 'allergen-grid', role: 'group', 'aria-label': label },
    ALLERGENS.map((a) =>
      h(
        'button',
        {
          type: 'button',
          class: 'allergen-option',
          'aria-pressed': String(set.has(a.code)),
          onClick: (e) => {
            if (set.has(a.code)) set.delete(a.code);
            else set.add(a.code);
            e.currentTarget.setAttribute('aria-pressed', String(set.has(a.code)));
            onChange([...set]);
          },
        },
        h('span', { class: 'allergen-option__icon' }, icon(a.icon)),
        h('span', { class: 'allergen-option__text' },
          h('span', { class: 'allergen-tag' }, a.short),
          h('span', { class: 'allergen-option__name' }, a.label)),
        h('span', { class: 'allergen-option__check' }, icon('check', 'icon--sm')),
      ),
    ),
  );
}

/** Sigle compatte degli allergeni (es. su card piatto). `hits` = codici in conflitto. */
export function allergenTags(codes, hits = []) {
  const hit = new Set(hits);
  return ALLERGENS.filter((a) => codes.includes(a.code)).map((a) =>
    h('span', { class: ['allergen-tag', hit.has(a.code) && 'is-hit'], title: a.label, 'aria-label': a.label }, a.short),
  );
}
