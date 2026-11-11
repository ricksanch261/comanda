/**
 * "Chi sei?" (schermata 2): scelta del cameriere, ricordata sul dispositivo.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, screen } from '../../components/layout.js';
import { getPrefs, setPrefs } from '../../state/prefs.js';

export default function whoAmIView() {
  return {
    title: 'Chi sei?',
    render() {
      const { settings } = app.data;
      const current = getPrefs().waiterId;
      return screen({
        bar: appBar({ eyebrow: settings.restaurantName, title: 'Chi sei?', back: '/', backIcon: 'home', backLabel: 'Inizio' }),
        bodyClass: 'screen__body--narrow',
        body: [
          h('p', { class: 'muted' }, 'Scegli il tuo nome: i tavoli che apri ti verranno attribuiti.'),
          h('div', { class: 'list' },
            settings.waiters.map((w) =>
              h('button', {
                type: 'button',
                class: 'list-item',
                'aria-pressed': String(w.id === current),
                onClick: () => {
                  setPrefs({ waiterId: w.id });
                  app.navigate('/sala', { replace: true });
                },
              },
              h('span', { class: 'avatar' }, w.name.slice(0, 1).toUpperCase()),
              h('span', { class: 'list-item__main list-item__title' }, w.name),
              w.id === current ? icon('check_circle', 'success') : icon('chevron_right')))),
        ],
      });
    },
  };
}
