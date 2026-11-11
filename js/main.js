/**
 * Bootstrap: carica i dati, crea lo store, avvia il router e il service worker.
 */
import { app } from './app.js';
import { createRouter } from './router.js';
import { createStore } from './state/store.js';
import { actions } from './state/actions.js';
import { LocalRepository, StorageQuotaError } from './state/localRepository.js';
import { createEmptyData } from './domain/models.js';
import { applyTheme } from './state/prefs.js';
import { isAdminUnlocked } from './state/auth.js';
import { routes, notFoundView } from './routes.js';
import { toast, toastError } from './components/toast.js';
import { h } from './utils/dom.js';
import { registerServiceWorker } from './sw-register.js';

const root = document.getElementById('app');
let current = null; // { view, match }
let rerenderQueued = false;

function isSetupDone(data) {
  return Boolean(data.settings.restaurantName && data.settings.adminPinHash);
}

function render({ resetScroll = false } = {}) {
  if (!current) return;
  const scrolls = {};
  root.querySelectorAll('[data-scroll]').forEach((el) => {
    scrolls[el.dataset.scroll] = el.scrollTop;
  });
  const winY = window.scrollY;
  const activeId = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : null;

  let node;
  try {
    node = current.view.render();
  } catch (e) {
    console.error(e);
    node = h('div', { class: 'screen' }, h('div', { class: 'screen__body' }, h('div', { class: 'banner banner--danger' }, `Errore di visualizzazione: ${e.message}`)));
  }
  root.replaceChildren(node);

  if (resetScroll) {
    window.scrollTo(0, 0);
    const heading = root.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  } else {
    root.querySelectorAll('[data-scroll]').forEach((el) => {
      if (scrolls[el.dataset.scroll] != null) el.scrollTop = scrolls[el.dataset.scroll];
    });
    window.scrollTo(0, winY);
    if (activeId) document.getElementById(activeId)?.focus({ preventScroll: true });
  }
  current.view.afterRender?.(root);
}

function queueRerender() {
  if (rerenderQueued) return;
  rerenderQueued = true;
  requestAnimationFrame(() => {
    rerenderQueued = false;
    render();
  });
}

function onRoute(match) {
  const data = app.store.getState();
  const path = match.path;

  const hasSetup = routes.some((r) => r.path === '/setup');
  if (hasSetup && !isSetupDone(data) && path !== '/setup') return app.navigate('/setup', { replace: true });
  if (isSetupDone(data) && path === '/setup') return app.navigate('/', { replace: true });
  if (match.route?.admin && !isAdminUnlocked()) {
    return app.navigate(`/pin?next=${encodeURIComponent(path)}`, { replace: true });
  }

  if (current?.view.destroy) current.view.destroy();
  const factory = match.route ? match.route.view : notFoundView;
  const view = factory({ params: match.params, query: match.query, path });
  current = { view, match };
  document.title = view.title ? `${view.title} · Gestione Tavoli` : 'Gestione Tavoli';
  render({ resetScroll: true });
}

async function boot() {
  applyTheme();
  const repository = new LocalRepository();
  let data = null;
  try {
    data = await repository.load();
  } catch (e) {
    console.error(e);
    root.replaceChildren(
      h('div', { class: 'boot' }, h('div', { class: 'banner banner--danger', style: { maxWidth: '480px' } },
        h('div', {}, h('b', {}, 'Impossibile leggere i dati salvati. '), e.message))),
    );
    return;
  }

  app.repository = repository;
  app.store = createStore({
    data: data || createEmptyData(),
    repository,
    actions,
    onSaveError: (e) => {
      if (e instanceof StorageQuotaError) toast(e.message, { icon: 'warning', type: 'error', duration: 10000 });
      else toastError(e);
    },
  });
  app.rerender = queueRerender;
  app.store.subscribe(queueRerender);

  const flush = () => app.store.flush();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  app.router = createRouter(routes, onRoute);
  app.router.start();
  registerServiceWorker();
}

boot();
