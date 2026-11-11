/**
 * Preferenze dell'interfaccia di questo dispositivo (non fanno parte di AppData
 * e non finiscono nel backup): tema, cameriere attivo, vista della mappa.
 */
const KEY = 'gestione-tavoli:prefs';

const defaults = {
  theme: 'auto', // 'auto' | 'light' | 'dark'
  waiterId: null,
  mapView: 'plan', // 'plan' | 'grid'
  mapAreaId: null,
};

let cache = null;

function read() {
  if (cache) return cache;
  try {
    cache = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    cache = { ...defaults };
  }
  return cache;
}

export function getPrefs() {
  return read();
}

export function setPrefs(patch) {
  cache = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* preferenze non essenziali */
  }
  if ('theme' in patch) applyTheme();
  return cache;
}

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

/** Applica data-theme su <html>: default da prefers-color-scheme, override manuale. */
export function applyTheme() {
  const { theme } = read();
  const dark = theme === 'dark' || (theme === 'auto' && media?.matches);
  const mode = dark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#12110F' : '#1B5B52');
}

media?.addEventListener?.('change', () => applyTheme());
