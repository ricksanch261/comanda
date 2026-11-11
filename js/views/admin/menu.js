/**
 * Menu – categorie e piatti (schermata 11): filtro, toggle "Esaurito" sempre visibile.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, emptyState } from '../../components/layout.js';
import { allergenTags } from '../../components/allergenPicker.js';
import { formatCents } from '../../utils/format.js';

export function normalizeSearch(s) {
  return String(s || '').toLocaleLowerCase('it-IT').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function menuView({ query }) {
  let catId = query.cat || 'all';
  let search = '';

  return {
    title: 'Menu',
    render() {
      const { categories, menuItems } = app.data;
      if (catId !== 'all' && !categories.some((c) => c.id === catId)) catId = 'all';
      const q = normalizeSearch(search);
      const items = menuItems
        .filter((m) => (catId === 'all' || m.categoryId === catId) && (!q || normalizeSearch(`${m.name} ${m.description}`).includes(q)))
        .sort((a, b) => {
          const ca = categories.findIndex((c) => c.id === a.categoryId);
          const cb = categories.findIndex((c) => c.id === b.categoryId);
          return ca - cb || a.sortOrder - b.sortOrder;
        });
      const soldOut = menuItems.filter((m) => !m.available).length;

      const body = !categories.length
        ? [
            emptyState({ iconName: 'menu_book', title: 'Menu vuoto', text: 'Aggiungi la prima categoria (es. Antipasti, Primi, Bevande).',
              action: h('a', { class: 'btn btn--primary', href: '#/admin/menu/categorie' }, icon('add'), 'Nuova categoria') }),
          ]
        : [
            h('div', { class: 'search' }, icon('search'),
              h('input', { class: 'input', id: 'menu-search', type: 'search', placeholder: 'Filtra piatti', 'aria-label': 'Filtra piatti', value: search, onInput: (e) => { search = e.target.value; app.rerender(); } })),
            h('div', { class: 'chips', role: 'group', 'aria-label': 'Categorie' },
              h('button', { type: 'button', class: 'chip', 'aria-pressed': String(catId === 'all'), onClick: () => { catId = 'all'; app.rerender(); } }, `Tutti · ${menuItems.length}`),
              categories.map((c) =>
                h('button', { type: 'button', class: 'chip', 'aria-pressed': String(catId === c.id), onClick: () => { catId = c.id; app.rerender(); } },
                  `${c.name} · ${menuItems.filter((m) => m.categoryId === c.id).length}`))),
            soldOut ? h('div', { class: 'banner banner--info' }, icon('info'), h('div', { class: 'banner__body' }, h('b', {}, 'Esauriti: '), `${soldOut} ${soldOut === 1 ? 'piatto' : 'piatti'} non ordinabili in sala.`)) : null,
            items.length
              ? h('div', { class: 'list' },
                  items.map((m) => {
                    const cat = categories.find((c) => c.id === m.categoryId);
                    return h('div', { class: ['list-item', !m.available && 'is-soldout'] },
                      h('a', { class: 'list-item__main', href: `#/admin/menu/piatto/${m.id}`, style: { color: 'inherit', textDecoration: 'none' } },
                        h('div', { class: 'row row--between' }, h('span', { class: 'list-item__title' }, m.name), h('span', { class: 'bold num' }, `€ ${formatCents(m.priceCents)}`)),
                        h('div', { class: 'list-item__sub' }, catId === 'all' && cat ? `${cat.name} · ` : '', m.destination === 'bar' ? 'Bar' : 'Cucina'),
                        m.allergens.length ? h('div', { class: 'allergen-tags', style: { marginTop: '4px' } }, allergenTags(m.allergens)) : null),
                      h('label', { class: 'soldout-toggle' },
                        h('span', { class: 'text-xs bold' }, 'Esaurito'),
                        h('input', {
                          type: 'checkbox',
                          role: 'switch',
                          class: 'switch',
                          checked: !m.available,
                          'aria-label': `${m.name} esaurito`,
                          onChange: (e) => app.act('setItemAvailable', { id: m.id, available: !e.target.checked }),
                        })));
                  }))
              : emptyState({ iconName: 'search_off', title: 'Nessun piatto', text: search ? 'Nessun risultato per la ricerca.' : 'Aggiungi il primo piatto di questa categoria.' }),
          ];

      return h('div', { class: 'screen' },
        appBar({
          title: 'Menu',
          back: '/admin',
          actions: [
            h('a', { class: 'btn btn--sm', href: '#/admin/menu/categorie' }, icon('category', 'icon--sm'), 'Categorie'),
          ],
        }),
        h('main', { class: 'screen__body screen__body--narrow' },
          body,
          categories.length
            ? h('a', { class: 'btn btn--primary btn--lg', href: `#/admin/menu/piatto/nuovo${catId !== 'all' ? `?cat=${catId}` : ''}` }, icon('add'), 'Nuovo piatto')
            : null));
    },
  };
}
