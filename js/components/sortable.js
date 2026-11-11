/**
 * Lista riordinabile: trascinamento con il puntatore (touch e mouse) sulla
 * maniglia, e da tastiera con ↑/↓ sulla maniglia (che è un <button>).
 *
 *   makeSortable(listEl, { onReorder: (ids) => ... })
 * Gli elementi della lista devono avere data-id; la maniglia la classe .drag-handle.
 */
export function makeSortable(list, { onReorder, itemSelector = '[data-id]' }) {
  let dragging = null;
  let pointerId = null;

  const items = () => [...list.querySelectorAll(`:scope > ${itemSelector}`)];
  const ids = () => items().map((el) => el.dataset.id);

  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.drag-handle');
    if (!handle || !list.contains(handle)) return;
    const item = handle.closest(itemSelector);
    if (!item) return;
    e.preventDefault();
    dragging = item;
    pointerId = e.pointerId;
    handle.setPointerCapture(e.pointerId);
    item.classList.add('is-dragging');
  });

  list.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const over = items().find((el) => {
      if (el === dragging) return false;
      const r = el.getBoundingClientRect();
      return e.clientY >= r.top && e.clientY <= r.bottom;
    });
    if (!over) return;
    const r = over.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    over[after ? 'after' : 'before'](dragging);
  });

  const end = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging.classList.remove('is-dragging');
    dragging = null;
    onReorder(ids());
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);

  list.addEventListener('keydown', (e) => {
    const handle = e.target.closest('.drag-handle');
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const item = handle.closest(itemSelector);
    const sibling = e.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling || !sibling.matches(itemSelector)) return;
    e.preventDefault();
    if (e.key === 'ArrowUp') sibling.before(item);
    else sibling.after(item);
    handle.focus();
    const newIds = ids();
    // Il focus va mantenuto anche dopo il ri-render: segnaliamo l'id.
    handle.id ||= `drag-${item.dataset.id}`;
    onReorder(newIds);
  });
}
