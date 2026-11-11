/**
 * Registrazione del service worker e banner "Nuova versione disponibile — Aggiorna".
 */
import { h, icon } from './utils/dom.js';

function showUpdateBanner(worker) {
  if (document.querySelector('.update-banner')) return;
  const banner = h('div', { class: 'banner banner--info update-banner', role: 'status' },
    icon('system_update'),
    h('div', { class: 'banner__body' }, h('b', {}, 'Nuova versione disponibile')),
    h('div', { class: 'banner__actions' },
      h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onClick: () => banner.remove() }, 'Dopo'),
      h('button', {
        type: 'button',
        class: 'btn btn--sm btn--primary',
        onClick: () => {
          banner.remove();
          worker.postMessage({ type: 'SKIP_WAITING' });
        },
      }, 'Aggiorna')));
  document.body.append(banner);
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('service-worker.js');
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(nw);
        });
      });
      // Controlla aggiornamenti quando l'app torna in primo piano.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (e) {
      console.warn('Service worker non registrato', e);
    }
  });
}
