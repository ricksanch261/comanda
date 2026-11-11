/**
 * Tabella delle route. `admin: true` richiede lo sblocco con PIN.
 */
import { h } from './utils/dom.js';
import homeView from './views/home.js';

export const routes = [
  { path: '/', view: homeView },
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
