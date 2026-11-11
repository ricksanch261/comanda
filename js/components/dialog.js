/**
 * Dialog accessibili basati su <dialog> (focus trap nativo, Esc = annulla).
 *
 *   const value = await openDialog({ title, body, actions: [{ label, value, variant }] })
 *
 * - body: Node oppure funzione (api) => Node, dove api = { close(value), dialog }.
 * - actions: { label, value, variant: 'primary'|'danger'|'danger-outline'|'ghost', icon,
 *              autofocus, onClick: () => valore | false (false = resta aperto) }
 * - dismissible: se false il tap sullo sfondo non chiude (Esc chiude sempre = annulla).
 * Restituisce una Promise che si risolve con il value dell'azione, o null se annullato.
 */
import { h, icon } from '../utils/dom.js';

export function openDialog({
  title,
  eyebrow = null,
  headIcon = null,
  body = null,
  actions = [],
  variant = 'dialog', // 'dialog' | 'sheet' | 'alert'
  wide = false,
  dismissible = true,
  stackActions = false,
  showClose = true,
  className = '',
  role = null,
  onOpen = null,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const titleId = `dlg-${Math.random().toString(36).slice(2)}`;
    const dialog = h('dialog', {
      class: ['dialog', variant === 'sheet' && 'dialog--sheet', variant === 'alert' && 'dialog--alert', wide && 'dialog--wide', className],
      'aria-labelledby': titleId,
      role: role || (variant === 'alert' ? 'alertdialog' : null),
    });

    function close(value = null) {
      if (settled) return;
      settled = true;
      dialog.classList.add('is-closing');
      const done = () => {
        if (dialog.open) dialog.close();
        dialog.remove();
      };
      const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-normal')) || 0;
      if (ms > 0) setTimeout(done, ms);
      else done();
      resolve(value);
    }

    const api = { close, dialog };
    const head = h(
      'div',
      { class: 'dialog__head' },
      headIcon && icon(headIcon),
      h(
        'div',
        { class: 'dialog__title' },
        eyebrow && h('div', { class: 'dialog__eyebrow' }, eyebrow),
        h('h2', { id: titleId, class: variant === 'alert' ? '' : 'dialog__title' }, title),
      ),
      showClose && variant !== 'alert'
        ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Chiudi', onClick: () => close(null) }, icon('close'))
        : null,
    );

    const bodyNode = typeof body === 'function' ? body(api) : body;
    const actionButtons = actions.map((a) =>
      h(
        'button',
        {
          type: 'button',
          class: ['btn', 'btn--lg', a.variant && `btn--${a.variant}`],
          autofocus: a.autofocus ? true : null,
          disabled: a.disabled || null,
          'data-action': a.id || null,
          onClick: async () => {
            if (a.onClick) {
              const r = await a.onClick(api);
              if (r === false) return;
              close(r === undefined ? a.value ?? true : r);
            } else close(a.value ?? true);
          },
        },
        a.icon && icon(a.icon),
        a.label,
      ),
    );

    dialog.append(
      head,
      bodyNode ? h('div', { class: 'dialog__body' }, bodyNode) : null,
      actionButtons.length ? h('div', { class: ['dialog__actions', stackActions && 'dialog__actions--stack'] }, actionButtons) : null,
    );

    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      close(null);
    });
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog || !dismissible) return;
      const r = dialog.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) close(null);
    });

    document.body.append(dialog);
    dialog.showModal();
    const auto = dialog.querySelector('[autofocus]');
    if (auto) auto.focus();
    if (onOpen) onOpen(api);
  });
}

/** Conferma semplice. Restituisce true/false. */
export async function confirmDialog({
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  danger = false,
  icon: headIcon = null,
}) {
  const r = await openDialog({
    title,
    headIcon,
    body: typeof message === 'string' ? h('p', {}, message) : message,
    actions: [
      { label: cancelLabel, value: false, variant: 'ghost', autofocus: danger },
      { label: confirmLabel, value: true, variant: danger ? 'danger' : 'primary', autofocus: !danger },
    ],
  });
  return r === true;
}
