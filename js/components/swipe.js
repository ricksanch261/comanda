/**
 * Scorrimento a sinistra per eliminare (righe in bozza).
 * Il tap normale continua a funzionare; dopo uno swipe il click viene ignorato.
 */
export function enableSwipeLeft(el, onSwipe, threshold = 96) {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let active = false;
  let swiping = false;
  let suppressClick = false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    active = true;
    swiping = false;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
  });
  el.addEventListener('pointermove', (e) => {
    if (!active) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    if (!swiping) {
      if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5 && mx < 0) {
        swiping = true;
        el.setPointerCapture(e.pointerId);
        el.classList.add('is-swiping');
      } else if (Math.abs(my) > 12) {
        active = false;
      }
      return;
    }
    dx = Math.min(0, mx);
    el.style.transform = `translateX(${dx}px)`;
    el.classList.toggle('is-swipe-armed', dx < -threshold);
  });
  const end = () => {
    if (!active) return;
    active = false;
    if (!swiping) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    el.classList.remove('is-swiping', 'is-swipe-armed');
    if (dx < -threshold) {
      el.style.transition = reduced ? '' : 'transform var(--duration-normal), opacity var(--duration-normal)';
      el.style.transform = 'translateX(-100%)';
      el.style.opacity = '0';
      setTimeout(onSwipe, reduced ? 0 : 200);
    } else {
      el.style.transition = 'transform var(--duration-fast)';
      el.style.transform = '';
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('click', (e) => {
    if (suppressClick) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
}
