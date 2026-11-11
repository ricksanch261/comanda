/**
 * Setup iniziale (schermata 1): nome del locale e creazione del PIN admin.
 */
import { h, icon } from '../utils/dom.js';
import { app } from '../app.js';
import { field } from '../components/layout.js';
import { pinPad } from '../components/pinPad.js';
import { hashPin, isValidPin, unlockAdmin } from '../state/auth.js';

export default function setupView() {
  let step = 1;
  let name = '';
  let firstPin = null;
  let error = null;

  function next() {
    if (!name.trim()) {
      error = 'Inserisci il nome del locale.';
    } else {
      error = null;
      step = 2;
    }
    app.rerender();
  }

  async function onPin(pin) {
    if (!isValidPin(pin)) {
      error = 'Il PIN deve avere da 4 a 6 cifre.';
      return app.rerender();
    }
    if (!firstPin) {
      firstPin = pin;
      error = null;
      return app.rerender();
    }
    if (pin !== firstPin) {
      firstPin = null;
      error = 'I due PIN non coincidono. Riprova.';
      return app.rerender();
    }
    const adminPinHash = await hashPin(pin);
    const r = app.act('completeSetup', { restaurantName: name, adminPinHash });
    if (r.ok) {
      unlockAdmin();
      app.navigate('/admin', { replace: true });
    }
  }

  return {
    title: 'Benvenuto',
    render() {
      const stepper = h('div', { class: 'muted text-sm' }, `Passo ${step} di 2`);
      if (step === 1) {
        const input = h('input', {
          class: 'input',
          id: 'setup-name',
          value: name,
          autocomplete: 'organization',
          placeholder: 'Trattoria Da Rina',
          onInput: (e) => (name = e.target.value),
          onKeydown: (e) => e.key === 'Enter' && next(),
        });
        return h('div', { class: 'screen' },
          h('main', { class: 'screen__body screen__body--narrow setup' },
            stepper,
            h('div', { class: 'stack' }, h('h1', {}, 'Benvenuto.'), h('p', { class: 'text-lg' }, 'Come si chiama il locale?')),
            field('Nome del locale', input, { error }),
            h('div', { class: 'banner banner--info' }, icon('info'),
              h('div', { class: 'banner__body' }, 'Al passo successivo creerai il PIN per l’area Amministrazione. Tutti i dati restano su questo dispositivo.')),
            h('button', { type: 'button', class: 'btn btn--primary btn--lg btn--block', onClick: next }, 'Continua')));
      }
      return h('div', { class: 'screen' },
        h('main', { class: 'screen__body screen__body--narrow setup setup--pin' },
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Indietro', onClick: () => { step = 1; firstPin = null; error = null; app.rerender(); } }, icon('arrow_back')),
            stepper),
          h('div', { class: 'stack', style: { textAlign: 'center' } },
            h('h1', {}, firstPin ? 'Conferma il PIN' : 'Crea il PIN amministratore'),
            h('p', { class: 'muted' }, firstPin ? 'Digita di nuovo lo stesso PIN.' : 'Da 4 a 6 cifre. Serve per entrare in Amministrazione.')),
          pinPad({ onSubmit: onPin, error })));
    },
    afterRender(root) {
      root.querySelector('#setup-name')?.focus();
      root.querySelector('.pin')?.focus({ preventScroll: true });
    },
  };
}
