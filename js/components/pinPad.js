/**
 * Tastierino PIN (tasti 72 px). Supporta anche la tastiera fisica.
 */
import { h, icon } from '../utils/dom.js';

export function pinPad({ length = 6, minLength = 4, onSubmit, error = null, disabled = false, submitLabel = 'Conferma' }) {
  let value = '';
  const dots = h('div', { class: 'pin__dots', 'aria-hidden': 'true' });
  const live = h('div', { class: 'visually-hidden', 'aria-live': 'polite' });
  const errorEl = h('div', { class: 'pin__error', role: 'alert' }, error ? [icon('error', 'icon--sm'), error] : null);
  const ok = h('button', { type: 'button', class: 'pin__key pin__key--ok', 'aria-label': submitLabel, onClick: submit }, icon('check'));

  function sync() {
    dots.replaceChildren(
      ...Array.from({ length: Math.max(minLength, value.length) }, (_, i) =>
        h('span', { class: ['pin__dot', i < value.length && 'is-filled'] }),
      ),
    );
    live.textContent = `${value.length} cifre inserite`;
    ok.disabled = disabled || value.length < minLength;
  }
  function press(d) {
    if (disabled || value.length >= length) return;
    value += d;
    errorEl.replaceChildren();
    sync();
  }
  function del() {
    value = value.slice(0, -1);
    sync();
  }
  function submit() {
    if (disabled || value.length < minLength) return;
    const v = value;
    value = '';
    sync();
    onSubmit(v);
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) =>
    h('button', { type: 'button', class: 'pin__key', disabled, onClick: () => press(d) }, d),
  );
  const pad = h(
    'div',
    {
      class: 'pin',
      tabindex: '0',
      'aria-label': 'Tastierino PIN: digita le cifre e premi Invio',
      onKeydown: (e) => {
        if (/^\d$/.test(e.key)) press(e.key);
        else if (e.key === 'Backspace') del();
        else if (e.key === 'Enter') submit();
        else return;
        e.preventDefault();
      },
    },
    dots,
    live,
    errorEl,
    h('div', { class: 'pin__grid' },
      keys,
      h('button', { type: 'button', class: 'pin__key pin__key--fn', 'aria-label': 'Cancella', onClick: del }, icon('backspace')),
      h('button', { type: 'button', class: 'pin__key', disabled, onClick: () => press('0') }, '0'),
      ok),
  );
  sync();
  return pad;
}
