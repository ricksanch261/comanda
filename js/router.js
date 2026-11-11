/**
 * Hash router (#/admin/..., #/sala/...), compatibile con GitHub Pages.
 * Le route sono pattern con parametri: "/sala/tavolo/:id".
 */
export function parseHash(hash = location.hash) {
  const h = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = h.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  return { path: path || '/', query };
}

export function compile(pattern) {
  const keys = [];
  const re = pattern
    .replace(/\/$/, '')
    .replace(/[.+*?^${}()[\]\\]/g, '\\$&')
    .replace(/\/:(\w+)(\\\?)?/g, (_, key, optional) => {
      keys.push(key);
      return optional ? '(?:/([^/]+))?' : '/([^/]+)';
    });
  return { re: new RegExp(`^${re || ''}/?$`), keys };
}

export function matchRoute(routes, path) {
  for (const route of routes) {
    route._c ||= compile(route.path);
    const m = route._c.re.exec(path);
    if (m) {
      const params = {};
      route._c.keys.forEach((k, i) => {
        if (m[i + 1] !== undefined) params[k] = decodeURIComponent(m[i + 1]);
      });
      return { route, params };
    }
  }
  return null;
}

export function createRouter(routes, onRoute) {
  function resolve() {
    const { path, query } = parseHash();
    const match = matchRoute(routes, path);
    onRoute({ ...(match || { route: null, params: {} }), path, query });
  }
  return {
    start() {
      window.addEventListener('hashchange', resolve);
      resolve();
    },
    navigate(to, { replace = false } = {}) {
      const hash = `#${to.startsWith('/') ? to : `/${to}`}`;
      if (hash === location.hash) return resolve();
      if (replace) {
        history.replaceState(history.state, '', hash);
        resolve();
      } else {
        location.hash = hash;
      }
    },
    refresh: resolve,
  };
}
