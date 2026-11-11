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

import * as adv from './views/sala/advanced.js';
import { summaryExtensions } from './views/sala/sendSummary.js';

tableExtensions.barButtons.push(adv.marchBarButton, billBarButton);
tableExtensions.sentLineTap = adv.sentLineTap;
tableExtensions.groupInfo = adv.groupInfo;
tableExtensions.groupActions = adv.groupActions;
tableExtensions.moreItems.push(adv.moveTableItem, adv.mergeTableItem, adv.closeItem);
summaryExtensions.holdOptions = adv.holdOptions;
tableExtensions.seatSubtotal = seatSubtotal;
tableExtensions.moreItems.push(reopenItem);
import dataView, { backupBanner, gettingStartedBanner } from './views/admin/data.js';
import reportsView from './views/admin/reports.js';
import { dashboardExtensions } from './views/admin/dashboard.js';
import floorPlanView from './views/admin/floorPlan.js';
import { tablesBarExtensions } from './views/admin/tables.js';
import { h as hh, icon as ic } from './utils/dom.js';
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
  { path: '/admin/piantina/:areaId?', view: floorPlanView, admin: true },
  { path: '/admin/dati', view: dataView, admin: true },
  { path: '/admin/report', view: reportsView, admin: true },
  { path: '/admin/varianti', view: modifierGroupsView, admin: true },
  { path: '/admin/varianti/:id', view: modifierGroupDetailView, admin: true },
];

dashboardExtensions.banners.push(gettingStartedBanner, backupBanner);
tablesBarExtensions.push((areaId) => hh('a', { class: 'btn btn--sm', href: `#/admin/piantina/${areaId}` }, ic('map', 'icon--sm'), 'Piantina'));

export function notFoundView({ path } = {}) {
  return {
    title: 'Pagina non trovata',
    render: () =>
      h('div', { class: 'screen' },
        h('div', { class: 'screen__body screen__body--narrow' },
          h('div', { class: 'empty' },
            h('h1', { class: 'empty__title' }, 'Pagina non trovata'),
            h('p', { class: 'empty__text' }, path ? `L’indirizzo “${path}” non esiste in questa versione dell’app.` : ''),
            h('p', { class: 'empty__text' }, 'Se l’app è stata appena aggiornata, ricaricala per scaricare la versione nuova.'),
            h('div', { class: 'row row--wrap', style: { justifyContent: 'center' } },
              h('button', { type: 'button', class: 'btn', onClick: () => hardReload() }, 'Ricarica l’app'),
              h('a', { class: 'btn btn--primary', href: '#/' }, 'Torna all’inizio'))))),
  };
}

/** Ricarica scartando le cache dell'app (service worker e Cache Storage). */
async function hardReload() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) || [];
    await Promise.all(regs.map((r) => r.update().catch(() => {})));
    const keys = (await globalThis.caches?.keys()) || [];
    await Promise.all(keys.filter((k) => k.startsWith('gestione-tavoli-') && k !== 'gestione-tavoli-fonts').map((k) => caches.delete(k)));
  } catch {
    /* ricarica comunque */
  }
  location.reload();
}
