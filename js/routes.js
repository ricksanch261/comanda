/**
 * Tabella delle route. `admin: true` richiede lo sblocco con PIN.
 */
import { h } from './utils/dom.js';
import homeView from './views/home.js';
import setupView from './views/setup.js';
import pinView from './views/pin.js';
import dashboardView from './views/admin/dashboard.js';
import settingsView from './views/admin/settings.js';
import areasView from './views/admin/areas.js';
import tablesView from './views/admin/tables.js';
import tableDetailView from './views/admin/tableDetail.js';
import menuView from './views/admin/menu.js';
import categoriesView from './views/admin/categories.js';
import menuItemView from './views/admin/menuItem.js';
import mapView from './views/sala/map.js';
import whoAmIView from './views/sala/whoAmI.js';
import tableView, { tableExtensions } from './views/sala/table.js';
import billView from './views/sala/bill.js';
import { billBarButton, seatSubtotal, reopenItem } from './views/sala/billHooks.js';

tableExtensions.barButtons.push(billBarButton);
tableExtensions.seatSubtotal = seatSubtotal;
tableExtensions.moreItems.push(reopenItem);
import { modifierGroupsView, modifierGroupDetailView } from './views/admin/modifierGroups.js';

export const routes = [
  { path: '/', view: homeView },
  { path: '/setup', view: setupView },
  { path: '/pin', view: pinView },
  { path: '/sala', view: mapView },
  { path: '/sala/chi-sei', view: whoAmIView },
  { path: '/sala/tavolo/:id', view: tableView },
  { path: '/sala/tavolo/:id/aggiungi', view: tableView },
  { path: '/sala/tavolo/:id/conto', view: billView },
  { path: '/admin', view: dashboardView, admin: true },
  { path: '/admin/impostazioni', view: settingsView, admin: true },
  { path: '/admin/aree', view: areasView, admin: true },
  { path: '/admin/tavoli', view: tablesView, admin: true },
  { path: '/admin/tavoli/:id', view: tableDetailView, admin: true },
  { path: '/admin/menu', view: menuView, admin: true },
  { path: '/admin/menu/categorie', view: categoriesView, admin: true },
  { path: '/admin/menu/piatto/:id', view: menuItemView, admin: true },
  { path: '/admin/varianti', view: modifierGroupsView, admin: true },
  { path: '/admin/varianti/:id', view: modifierGroupDetailView, admin: true },
];

export function notFoundView() {
  return {
    title: 'Pagina non trovata',
    render: () =>
      h('div', { class: 'screen' },
        h('div', { class: 'screen__body screen__body--narrow' },
          h('div', { class: 'empty' },
            h('h1', { class: 'empty__title' }, 'Pagina non trovata'),
            h('a', { class: 'btn btn--primary', href: '#/' }, 'Torna all’inizio')))),
  };
}
