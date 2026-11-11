/**
 * Dashboard admin (schermata 4).
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, screen } from '../../components/layout.js';
import { lockAdmin } from '../../state/auth.js';
import { plural } from '../../utils/format.js';

export const ADMIN_SECTIONS = [
  { path: '/admin/impostazioni', icon: 'tune', title: 'Impostazioni', sub: (d) => 'Nome, coperto, portate, camerieri, PIN' },
  { path: '/admin/aree', icon: 'meeting_room', title: 'Aree e sale', sub: (d) => plural(d.areas.length, 'area', 'aree') },
  { path: '/admin/tavoli', icon: 'table_restaurant', title: 'Tavoli e posti', sub: (d) => plural(d.tables.length, 'tavolo', 'tavoli') },
  { path: '/admin/piantina', icon: 'map', title: 'Piantina', sub: () => 'Disposizione dei tavoli per area' },
  { path: '/admin/menu', icon: 'menu_book', title: 'Menu', sub: (d) => `${plural(d.categories.length, 'categoria', 'categorie')} · ${plural(d.menuItems.length, 'piatto', 'piatti')}` },
  { path: '/admin/varianti', icon: 'tune', title: 'Gruppi di varianti', sub: (d) => plural(d.modifierGroups.length, 'gruppo', 'gruppi') },
];

/** Altre milestone aggiungono sezioni e banner qui. */
export const dashboardExtensions = { banners: [] };

export default function dashboardView() {
  return {
    title: 'Amministrazione',
    render() {
      const d = app.data;
      return screen({
        bar: appBar({
          eyebrow: d.settings.restaurantName,
          title: 'Amministrazione',
          back: '/',
          backIcon: 'home',
          backLabel: 'Inizio',
          actions: [
            h('a', { class: 'btn btn--sm', href: '#/sala' }, icon('restaurant', 'icon--sm'), 'Sala'),
            h('button', {
              type: 'button',
              class: 'icon-btn',
              'aria-label': 'Esci dall’amministrazione',
              title: 'Esci',
              onClick: () => {
                lockAdmin();
                app.navigate('/');
              },
            }, icon('logout')),
          ],
        }),
        body: [
          ...dashboardExtensions.banners.map((b) => b()).filter(Boolean),
          h('nav', { class: 'admin-grid', 'aria-label': 'Sezioni' },
            ADMIN_SECTIONS.map((s) =>
              h('a', { class: 'admin-tile', href: `#${s.path}` },
                h('span', { class: 'admin-tile__icon' }, icon(s.icon)),
                h('span', { class: 'grow' },
                  h('div', { class: 'admin-tile__title' }, s.title),
                  h('div', { class: 'admin-tile__sub' }, s.sub(d))),
                icon('chevron_right')))),
        ],
      });
    },
  };
}
