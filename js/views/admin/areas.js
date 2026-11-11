/**
 * Aree / Sale (schermata 6): lista riordinabile.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, screen, emptyState } from '../../components/layout.js';
import { makeSortable } from '../../components/sortable.js';
import { promptText, confirmDialog } from '../../components/dialog.js';
import { toast } from '../../components/toast.js';
import { plural } from '../../utils/format.js';

export async function createAreaFlow() {
  const name = await promptText({ title: 'Nuova area', label: 'Nome dell’area', placeholder: 'Es. Dehors', confirmLabel: 'Crea area' });
  if (!name) return null;
  const r = app.act('addArea', { name });
  if (r.ok) toast(`Area “${name}” creata`);
  return r.ok ? r.result : null;
}

export default function areasView() {
  async function rename(area) {
    const name = await promptText({ title: 'Rinomina area', label: 'Nome dell’area', value: area.name });
    if (name) app.act('updateArea', { id: area.id, name });
  }
  async function remove(area) {
    const ok = await confirmDialog({ title: `Eliminare “${area.name}”?`, message: 'L’operazione non si può annullare.', confirmLabel: 'Elimina', danger: true });
    if (ok && app.act('removeArea', { id: area.id }).ok) toast('Area eliminata', { icon: 'delete' });
  }

  return {
    title: 'Aree',
    render() {
      const { areas, tables } = app.data;
      let list = null;
      if (areas.length) {
        list = h('div', { class: 'list' },
          areas.map((a) => {
            const n = tables.filter((t) => t.areaId === a.id).length;
            return h('div', { class: 'list-item', 'data-id': a.id },
              h('button', { type: 'button', class: 'icon-btn drag-handle', id: `drag-${a.id}`, 'aria-label': `Riordina ${a.name} (usa le frecce)` }, icon('drag_indicator')),
              h('a', { class: 'list-item__main', href: `#/admin/tavoli?area=${a.id}`, style: { color: 'inherit', textDecoration: 'none' } },
                h('div', { class: 'list-item__title' }, a.name),
                h('div', { class: 'list-item__sub' }, plural(n, 'tavolo', 'tavoli'))),
              h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Rinomina ${a.name}`, onClick: () => rename(a) }, icon('edit')),
              h('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': `Elimina ${a.name}`, onClick: () => remove(a) }, icon('delete')));
          }));
        makeSortable(list, { onReorder: (ids) => app.act('reorderAreas', { ids }) });
      }
      return screen({
        bar: appBar({ title: 'Aree', sub: 'Trascina per riordinare', back: '/admin' }),
        bodyClass: 'screen__body--narrow',
        body: [
          list || emptyState({ iconName: 'meeting_room', title: 'Nessuna area', text: 'Crea la prima sala, ad esempio “Sala interna” o “Dehors”.' }),
          h('button', { type: 'button', class: 'btn btn--primary btn--lg', onClick: createAreaFlow }, icon('add'), 'Nuova area'),
        ],
      });
    },
  };
}
