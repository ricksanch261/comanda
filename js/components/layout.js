/**
 * Struttura comune delle schermate: app bar + corpo.
 */
import { h, icon } from '../utils/dom.js';

export function appBar({ title, eyebrow = null, sub = null, back = null, backIcon = 'arrow_back', backLabel = 'Indietro', actions = [], bordered = false }) {
  return h(
    'header',
    { class: ['app-bar', bordered && 'app-bar--bordered', !back && 'app-bar--pad'] },
    back
      ? h('a', { class: 'icon-btn', href: `#${back}`, 'aria-label': backLabel }, icon(backIcon))
      : null,
    h(
      'div',
      { class: 'app-bar__title' },
      eyebrow && h('div', { class: 'app-bar__eyebrow' }, eyebrow),
      typeof title === 'string' ? h('h1', {}, title) : title,
      sub && h('div', { class: 'app-bar__sub' }, sub),
    ),
    actions.length ? h('div', { class: 'app-bar__actions' }, actions) : null,
  );
}

export function screen({ bar, body, bodyClass = '', footer = null, className = '' }) {
  return h(
    'div',
    { class: ['screen', className] },
    bar,
    h('main', { class: ['screen__body', bodyClass] }, body),
    footer,
  );
}

/** Campo con etichetta. `control` è l'input già costruito. */
export function field(label, control, { hint = null, error = null, id = null } = {}) {
  const input = control.matches('input,select,textarea') ? control : control.querySelector('input,select,textarea') || control;
  const controlId = id || input.id || `f-${Math.random().toString(36).slice(2)}`;
  input.id = controlId;
  const hintId = hint || error ? `${controlId}-hint` : null;
  if (hintId) input.setAttribute('aria-describedby', hintId);
  if (error) input.setAttribute('aria-invalid', 'true');
  return h(
    'div',
    { class: 'field' },
    h('label', { class: 'field__label', for: controlId }, label),
    control,
    error
      ? h('div', { class: 'field__error', id: hintId }, icon('error', 'icon--xs'), error)
      : hint && h('div', { class: 'field__hint', id: hintId }, hint),
  );
}

export function emptyState({ iconName, title, text = '', action = null }) {
  return h(
    'div',
    { class: 'empty' },
    icon(iconName),
    h('div', { class: 'empty__title' }, title),
    text && h('div', { class: 'empty__text' }, text),
    action,
  );
}

export function switchRow({ label, sub = null, checked, onChange, id }) {
  const input = h('input', {
    type: 'checkbox',
    role: 'switch',
    class: 'switch',
    id,
    checked,
    onChange: (e) => onChange(e.target.checked),
  });
  return h(
    'label',
    { class: 'switch-row', for: id },
    h('span', { class: 'switch-row__label' }, h('span', { class: 'bold' }, label), sub && h('div', { class: 'text-sm muted' }, sub)),
    input,
  );
}

/** Controllo segmentato (scelta singola). */
export function segmented({ options, value, onChange, block = false, label }) {
  return h(
    'div',
    { class: ['segmented', block && 'segmented--block'], role: 'group', 'aria-label': label },
    options.map((o) =>
      h(
        'button',
        { type: 'button', 'aria-pressed': String(o.value === value), onClick: () => onChange(o.value) },
        o.icon && icon(o.icon),
        o.label,
      ),
    ),
  );
}
