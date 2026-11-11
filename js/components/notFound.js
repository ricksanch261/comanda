import { h, icon } from '../utils/dom.js';
import { appBar, screen, emptyState } from './layout.js';

/** View di cortesia per entità non trovate. */
export function notFound(message, back) {
  return {
    title: message,
    render: () =>
      screen({
        bar: appBar({ title: message, back }),
        bodyClass: 'screen__body--narrow',
        body: emptyState({ iconName: 'search_off', title: message, action: h('a', { class: 'btn', href: `#${back}` }, icon('arrow_back'), 'Torna indietro') }),
      }),
  };
}
