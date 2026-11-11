/**
 * Stepper numerico −/valore/+ (48 px).
 */
import { h, icon } from '../utils/dom.js';

export function stepper({ value, min = 0, max = 99, step = 1, onChange, label, id }) {
  const clamp = (v) => Math.min(max, Math.max(min, v));
  let current = clamp(value);
  const input = h('input', {
    id,
    type: 'number',
    inputmode: 'numeric',
    min,
    max,
    value: current,
    'aria-label': label,
    onChange: (e) => set(Number(e.target.value)),
  });
  const dec = h('button', { type: 'button', 'aria-label': `Diminuisci ${label}`, onClick: () => set(current - step) }, icon('remove'));
  const inc = h('button', { type: 'button', 'aria-label': `Aumenta ${label}`, onClick: () => set(current + step) }, icon('add'));
  function sync() {
    input.value = current;
    dec.disabled = current <= min;
    inc.disabled = current >= max;
  }
  function set(v) {
    const next = clamp(Number.isFinite(v) ? Math.round(v) : current);
    current = next;
    sync();
    onChange(next);
  }
  sync();
  return h('div', { class: 'stepper' }, dec, input, inc);
}
