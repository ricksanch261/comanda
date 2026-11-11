/**
 * Componente "Tavolo con posti" (porting di TavoloPosti.dc.html).
 * - Tonda: posti su cerchio, partenza a ore 12, senso orario.
 * - Quadrata: distribuzione round-robin su 4 lati.
 * - Rettangolare: < 6 posti solo lati lunghi; ≥ 6 un posto per testata e gli
 *   altri sui lati lunghi; ordine orario a partire dalla testata sinistra.
 */
import { h, icon } from '../utils/dom.js';

export function computeSeatLayout({ shape, n, W, H, d, gap = 8 }) {
  const m = d + gap;
  let tb;
  const pos = [];
  if (shape === 'round') {
    const D = Math.max(40, Math.min(W, H) - 2 * m);
    tb = { x: (W - D) / 2, y: (H - D) / 2, w: D, h: D, round: true };
    const R = D / 2 + gap + d / 2;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      pos.push([W / 2 + R * Math.cos(a) - d / 2, H / 2 + R * Math.sin(a) - d / 2]);
    }
    return { tb, pos };
  }
  tb = { x: m, y: m, w: Math.max(40, W - 2 * m), h: Math.max(40, H - 2 * m), round: false };
  const buckets = { t: [], r: [], b: [], l: [] };
  if (shape === 'square') {
    const sides = ['t', 'r', 'b', 'l'];
    for (let i = 0; i < n; i++) buckets[sides[i % 4]].push(i);
  } else if (n >= 6) {
    buckets.l.push(0);
    const rest = n - 2;
    const top = Math.ceil(rest / 2);
    for (let i = 1; i <= top; i++) buckets.t.push(i);
    buckets.r.push(top + 1);
    for (let i = top + 2; i < n; i++) buckets.b.push(i);
  } else {
    const top = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) (i < top ? buckets.t : buckets.b).push(i);
  }
  buckets.b.reverse();
  buckets.l.reverse();
  const place = (arr, fn) => arr.forEach((idx, k) => { pos[idx] = fn((k + 1) / (arr.length + 1)); });
  place(buckets.t, (f) => [tb.x + tb.w * f - d / 2, tb.y - gap - d]);
  place(buckets.b, (f) => [tb.x + tb.w * (1 - f) - d / 2, tb.y + tb.h + gap]);
  place(buckets.r, (f) => [tb.x + tb.w + gap, tb.y + tb.h * f - d / 2]);
  place(buckets.l, (f) => [tb.x - gap - d, tb.y + tb.h * (1 - f) - d / 2]);
  return { tb, pos };
}

/**
 * Geometria del componente per forma e numero di posti.
 * Restituisce la dimensione dei posti (d) e del componente (W×H); se i posti
 * non stanno in maxW la larghezza naturale supera maxW (il contenitore scorre).
 */
export function seatGeometry(shape, n, maxW, base = 56) {
  let d = n <= 8 ? base : n <= 12 ? base - 8 : base - 14;
  d = Math.max(44, d);
  const m = d + 8;
  if (shape === 'round') {
    // Circonferenza dei centri dei posti ≥ n·(d+6)
    const R = Math.max((n * (d + 6)) / (2 * Math.PI), 50 + 8 + d / 2);
    const needed = Math.ceil(2 * R + d + 4);
    const side = Math.max(needed, Math.min(maxW, 100 + 2 * m + 40));
    return { d, W: side, H: side };
  }
  if (shape === 'square') {
    const perSide = Math.ceil(n / 4);
    const needed = Math.max(100 + 2 * m, (perSide + 1) * (d + 8) + 2 * m);
    const side = Math.max(needed, Math.min(maxW, 100 + 2 * m + 60));
    return { d, W: side, H: side };
  }
  const perLong = n >= 6 ? Math.ceil((n - 2) / 2) : Math.ceil(n / 2);
  const needed = Math.max(140 + 2 * m, (perLong + 1) * (d + 8) + 2 * m);
  const W = Math.max(needed, Math.min(maxW, 560));
  return { d, W, H: Math.round(2 * m + Math.max(84, d * 1.5)) };
}

/**
 * @param {object} o
 * @param {'round'|'square'|'rect'} o.shape
 * @param {{ label, guest?, allergies?: string[], count?, extra?, selected?, ariaLabel? }[]} o.seats
 */
export function tableSeats({
  shape,
  seats,
  width,
  height,
  seatSize = 56,
  centerLabel = 'Tavolo',
  centerSelected = false,
  centerCount = 0,
  onSeat = null,
  onSeatLong = null,
  onCenter = null,
  interactive = true,
}) {
  const d = seatSize;
  const { tb, pos } = computeSeatLayout({ shape, n: seats.length, W: width, H: height, d });
  const root = h('div', { class: 'tseats', style: { width: `${width}px`, height: `${height}px` } });

  const centerTag = interactive ? 'button' : 'div';
  root.append(
    h('div', {
      class: ['tseats__table', tb.round && 'is-round'],
      style: { left: `${tb.x}px`, top: `${tb.y}px`, width: `${tb.w}px`, height: `${tb.h}px` },
    },
    interactive
      ? h(centerTag, {
          type: 'button',
          class: 'tseats__center',
          'aria-pressed': String(Boolean(centerSelected)),
          'aria-label': `${centerLabel}: piatti per tutto il tavolo${centerCount ? `, ${centerCount} righe` : ''}`,
          onClick: () => onCenter && onCenter(),
        },
        h('span', { class: 'row', style: { gap: '6px' } }, icon('table_restaurant', 'icon--sm'), centerLabel),
        centerCount ? h('span', { class: 'tseats__center-count' }, `${centerCount} ${centerCount === 1 ? 'riga' : 'righe'}`) : null)
      : null),
  );

  seats.forEach((s, i) => {
    const [x, y] = pos[i];
    const has = (s.count ?? 0) > 0;
    const alg = s.allergies && s.allergies.length > 0;
    const tag = interactive ? 'button' : 'div';
    let pressTimer = null;
    let longFired = false;
    const el = h(tag, {
      type: interactive ? 'button' : null,
      class: ['tseat', shape === 'round' && 'is-round', s.selected && 'is-selected', has && 'has-lines', s.extra && 'is-extra', d < 56 && 'is-small'],
      style: { left: `${x}px`, top: `${y}px`, width: `${d}px`, height: `${d}px` },
      'aria-pressed': interactive ? String(Boolean(s.selected)) : null,
      'aria-label': interactive
        ? s.ariaLabel ||
          [s.label, s.guest, alg ? `allergie: ${s.allergies.join(', ')}` : null, has ? `${s.count} ${s.count === 1 ? 'riga' : 'righe'}` : null]
            .filter(Boolean).join(', ')
        : null,
      onClick: (e) => {
        if (longFired) { longFired = false; e.preventDefault(); return; }
        onSeat && onSeat(i, e);
      },
      onContextmenu: onSeatLong ? (e) => { e.preventDefault(); clearTimeout(pressTimer); if (!longFired) onSeatLong(i); longFired = false; } : null,
      onPointerdown: onSeatLong
        ? (e) => {
            if (e.button !== 0) return;
            longFired = false;
            pressTimer = setTimeout(() => { longFired = true; onSeatLong(i); }, 550);
          }
        : null,
      onPointerup: () => clearTimeout(pressTimer),
      onPointerleave: () => clearTimeout(pressTimer),
      onPointercancel: () => clearTimeout(pressTimer),
    },
    h('span', { class: 'tseat__label' }, s.label),
    s.guest && d >= 56 ? h('span', { class: 'tseat__guest' }, s.guest) : null,
    alg ? h('span', { class: 'tseat__alg', title: 'Allergie' }, icon('warning')) : null,
    has ? h('span', { class: 'tseat__count' }, s.count) : null);
    root.append(el);
  });
  return root;
}

/** Anteprima non interattiva (admin). */
export function tableSeatsPreview({ shape, seats, maxWidth = 340, seatSize = 48 }) {
  const { d, W, H } = seatGeometry(shape, seats.length, maxWidth, seatSize);
  return tableSeats({ shape, seats, width: W, height: H, seatSize: d, interactive: false });
}
