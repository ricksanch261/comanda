/* Gestione Tavoli — service worker: precache degli asset e strategia cache-first. */
const CACHE_VERSION = 'v1.0.1';
const CACHE = `gestione-tavoli-${CACHE_VERSION}`;
const FONT_CACHE = 'gestione-tavoli-fonts';

// Percorsi relativi allo scope (funziona anche sotto /<nome-repo>/ su GitHub Pages).
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/base.css',
  'css/components.css',
  'css/print.css',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
  'js/app.js',
  'js/main.js',
  'js/router.js',
  'js/routes.js',
  'js/sw-register.js',
  'js/components/allergenPicker.js',
  'js/components/dialog.js',
  'js/components/layout.js',
  'js/components/notFound.js',
  'js/components/pinPad.js',
  'js/components/sortable.js',
  'js/components/swipe.js',
  'js/components/stepper.js',
  'js/components/tableSeats.js',
  'js/components/toast.js',
  'js/domain/allergens.js',
  'js/domain/billing.js',
  'js/domain/ids.js',
  'js/domain/models.js',
  'js/domain/reports.js',
  'js/domain/session.js',
  'js/domain/tables.js',
  'js/state/actions.js',
  'js/state/auth.js',
  'js/state/demo.js',
  'js/state/localRepository.js',
  'js/state/migrations.js',
  'js/state/prefs.js',
  'js/state/repository.js',
  'js/state/store.js',
  'js/utils/dom.js',
  'js/utils/format.js',
  'js/utils/sha256.js',
  'js/views/home.js',
  'js/views/pin.js',
  'js/views/setup.js',
  'js/views/admin/areas.js',
  'js/views/admin/categories.js',
  'js/views/admin/dashboard.js',
  'js/views/admin/data.js',
  'js/views/admin/floorPlan.js',
  'js/views/admin/menu.js',
  'js/views/admin/menuItem.js',
  'js/views/admin/modifierGroups.js',
  'js/views/admin/reports.js',
  'js/views/admin/settings.js',
  'js/views/admin/tableDetail.js',
  'js/views/admin/tables.js',
  'js/views/sala/advanced.js',
  'js/views/sala/allergenAlert.js',
  'js/views/sala/bill.js',
  'js/views/sala/billHooks.js',
  'js/views/sala/common.js',
  'js/views/sala/lineConfig.js',
  'js/views/sala/map.js',
  'js/views/sala/openTableDialog.js',
  'js/views/sala/picker.js',
  'js/views/sala/receipt.js',
  'js/views/sala/seatSheet.js',
  'js/views/sala/sendSummary.js',
  'js/views/sala/table.js',
  'js/views/sala/whoAmI.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })))),
  );
  // Al primo install attiva subito; gli aggiornamenti aspettano il consenso ("Aggiorna").
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gestione-tavoli-') && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirst(request, cacheName = CACHE) {
  const cached = await caches.match(request, { ignoreSearch: cacheName === CACHE });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Font di Google: cache-first in una cache separata (persistono tra le versioni).
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Navigazioni: l'app è una SPA con hash routing → sempre index.html dalla cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(new URL('index.html', self.registration.scope).href).then((r) => r || fetch(request)),
    );
    return;
  }
  event.respondWith(cacheFirst(request));
});
