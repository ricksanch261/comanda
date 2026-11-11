/**
 * Toast con azione opzionale (es. "Annulla"). Durata predefinita 5 s.
 */
import { h, icon } from '../utils/dom.js';

let host = null;

function getHost() {
  if (!host || !host.isConnected) {
    host = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  return host;
}

export function toast(message, { icon: iconName = 'check', action = null, duration = 5000, type = 'info' } = {}) {
  const container = getHost();
  let timer = null;
  const el = h(
    'div',
    { class: ['toast', type === 'error' && 'toast--error'] },
    icon(iconName),
    h('span', { class: 'toast__msg' }, message),
    action &&
      h(
        'button',
        {
          type: 'button',
          class: 'toast__action',
          onClick: () => {
            dismiss();
            action.onClick();
          },
        },
        action.label,
      ),
  );
  function dismiss() {
    clearTimeout(timer);
    if (!el.isConnected) return;
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 250);
  }
  // Al massimo 3 toast visibili.
  while (container.children.length >= 3) container.firstElementChild.remove();
  container.append(el);
  timer = setTimeout(dismiss, duration);
  return { dismiss };
}

export function toastError(err) {
  const message = typeof err === 'string' ? err : err?.message || 'Si è verificato un errore.';
  if (typeof err !== 'string' && err?.name !== 'DomainError') console.error(err);
  return toast(message, { icon: 'error', type: 'error', duration: 6000 });
}
