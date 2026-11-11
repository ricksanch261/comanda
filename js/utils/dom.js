/**
 * Micro-helper per costruire il DOM senza framework.
 *   h('button', { class: 'btn', onClick: fn, 'aria-pressed': true }, 'Testo')
 */
const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'indeterminate', 'hidden', 'open', 'multiple', 'readOnly', 'required']);
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'g', 'line', 'polyline', 'text']);

export function h(tag, props, ...children) {
  const el = SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false && !k.startsWith('aria-')) continue;
      if (k === 'class' || k === 'className') {
        const cls = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
        if (cls) el.setAttribute('class', cls);
      } else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sv === undefined || sv === null) continue;
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      } else if (k === 'dataset') {
        Object.assign(el.dataset, v);
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'ref' && typeof v === 'function') {
        v(el);
      } else if (PROPS.has(k)) {
        el[k] = v;
      } else {
        el.setAttribute(k, v === true ? '' : String(v));
      }
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Icona Material Symbols (decorativa). */
export function icon(name, extraClass = '') {
  return h('span', { class: ['icon', extraClass], 'aria-hidden': 'true' }, name);
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function fragment(...children) {
  const f = document.createDocumentFragment();
  appendChildren(f, children);
  return f;
}

/** Restituisce true se la viewport è "tablet" (≥ 768px). */
export function isWide() {
  return window.matchMedia('(min-width: 768px)').matches;
}

/** Scarica un testo come file. */
export function downloadText(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}
