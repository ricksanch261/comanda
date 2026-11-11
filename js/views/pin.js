/**
 * Tastierino PIN per entrare in Amministrazione (schermata 3).
 */
import { h, icon } from '../utils/dom.js';
import { app } from '../app.js';
import { appBar } from '../components/layout.js';
import { pinPad } from '../components/pinPad.js';
import { verifyPin, lockRemainingMs } from '../state/auth.js';

export default function pinView({ query }) {
  let error = null;
  let timer = null;
  const next = query.next && query.next.startsWith('/admin') ? query.next : '/admin';

  function scheduleUnlock() {
    clearTimeout(timer);
    const ms = lockRemainingMs();
    if (ms > 0) timer = setTimeout(() => { error = null; app.rerender(); }, ms + 50);
  }

  async function onSubmit(pin) {
    const r = await verifyPin(pin, app.data.settings.adminPinHash);
    if (r.ok) return app.navigate(next, { replace: true });
    if (r.locked) {
      error = `Troppi tentativi. Riprova tra ${Math.ceil(r.retryInMs / 1000)} secondi.`;
      scheduleUnlock();
    } else {
      error = `PIN errato · ${r.remaining} ${r.remaining === 1 ? 'tentativo rimasto' : 'tentativi rimasti'}`;
    }
    app.rerender();
  }

  return {
    title: 'PIN amministratore',
    destroy: () => clearTimeout(timer),
    render() {
      const locked = lockRemainingMs() > 0;
      return h('div', { class: 'screen' },
        appBar({ title: '', back: '/', backIcon: 'close', backLabel: 'Annulla' }),
        h('main', { class: 'screen__body screen__body--narrow pin-screen' },
          h('div', { class: 'stack', style: { alignItems: 'center', textAlign: 'center' } },
            h('div', { class: 'home__logo' }, icon('lock', 'icon--lg')),
            h('h1', {}, 'PIN amministratore'),
            h('p', { class: 'muted' }, 'Amministrazione')),
          pinPad({ onSubmit, error, disabled: locked })));
    },
    afterRender(root) {
      root.querySelector('.pin')?.focus({ preventScroll: true });
    },
  };
}
