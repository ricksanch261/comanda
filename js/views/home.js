/**
 * Selettore di modalità (schermata 2): Sala / Amministrazione.
 */
import { h, icon } from '../utils/dom.js';
import { app } from '../app.js';

export default function homeView() {
  return {
    title: 'Inizio',
    render() {
      const { settings } = app.data;
      return h('div', { class: 'screen' },
        h('div', { class: 'screen__body screen__body--narrow home' },
          h('div', { class: 'home__brand' },
            h('div', { class: 'home__logo' }, icon('table_restaurant', 'icon--lg')),
            h('div', { class: 'muted text-sm' }, 'Gestione Tavoli'),
            h('h1', {}, settings.restaurantName || 'Benvenuto')),
          h('div', { class: 'stack' },
            h('a', { class: 'btn btn--primary btn--lg btn--block', href: '#/sala' }, icon('restaurant'), 'Entra in Sala'),
            h('a', { class: 'btn btn--lg btn--block', href: '#/admin' }, icon('lock'), 'Amministrazione'))));
    },
  };
}
