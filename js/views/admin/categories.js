/**
 * Categorie del menu: CRUD, associazione facoltativa a una portata, riordino.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, screen, emptyState, field } from '../../components/layout.js';
import { makeSortable } from '../../components/sortable.js';
import { openDialog, confirmDialog } from '../../components/dialog.js';
import { toast } from '../../components/toast.js';
import { plural } from '../../utils/format.js';

function courseSelect(value, onChange) {
  return h('select', { class: 'select', onChange: (e) => onChange(e.target.value === '' ? null : Number(e.target.value)) },
    h('option', { value: '', selected: value === null }, 'Nessuna (scelta manuale)'),
    app.data.settings.courses.map((c, i) => h('option', { value: String(i), selected: value === i }, c)));
}

async function editCategory(cat = null) {
  const state = { name: cat?.name ?? '', courseIndex: cat?.courseIndex ?? null };
  const err = h('div', { class: 'field__error', role: 'alert' });
  return openDialog({
    title: cat ? 'Modifica categoria' : 'Nuova categoria',
    body: h('div', { class: 'stack stack--4' },
      field('Nome', h('input', { class: 'input', value: state.name, autofocus: true, placeholder: 'Es. Primi', onInput: (e) => (state.name = e.target.value) })),
      field('Portata predefinita', courseSelect(state.courseIndex, (v) => (state.courseIndex = v)), { hint: 'I piatti di questa categoria escono con questa portata.' }),
      err),
    actions: [
      { label: 'Annulla', value: null, variant: 'ghost' },
      {
        label: cat ? 'Salva' : 'Crea categoria',
        variant: 'primary',
        onClick: () => {
          try {
            return cat ? (app.store.dispatch('updateCategory', { id: cat.id, ...state }), cat.id) : app.store.dispatch('addCategory', state);
          } catch (e) {
            err.textContent = e.message;
            return false;
          }
        },
      },
    ],
  });
}

export default function categoriesView() {
  async function remove(c) {
    const ok = await confirmDialog({ title: `Eliminare “${c.name}”?`, message: 'L’operazione non si può annullare.', confirmLabel: 'Elimina', danger: true });
    if (ok && app.act('removeCategory', { id: c.id }).ok) toast('Categoria eliminata', { icon: 'delete' });
  }
  return {
    title: 'Categorie',
    render() {
      const { categories, menuItems, settings } = app.data;
      let list = null;
      if (categories.length) {
        list = h('div', { class: 'list' },
          categories.map((c) =>
            h('div', { class: 'list-item', 'data-id': c.id },
              h('button', { type: 'button', class: 'icon-btn drag-handle', id: `drag-${c.id}`, 'aria-label': `Riordina ${c.name} (usa le frecce)` }, icon('drag_indicator')),
              h('a', { class: 'list-item__main', href: `#/admin/menu?cat=${c.id}`, style: { color: 'inherit', textDecoration: 'none' } },
                h('div', { class: 'list-item__title' }, c.name),
                h('div', { class: 'list-item__sub' },
                  plural(menuItems.filter((m) => m.categoryId === c.id).length, 'piatto', 'piatti'),
                  ' · ',
                  c.courseIndex !== null && settings.courses[c.courseIndex] ? `Portata: ${settings.courses[c.courseIndex]}` : 'Nessuna portata')),
              h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Modifica ${c.name}`, onClick: () => editCategory(c) }, icon('edit')),
              h('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': `Elimina ${c.name}`, onClick: () => remove(c) }, icon('delete')))));
        makeSortable(list, { onReorder: (ids) => app.act('reorderCategories', { ids }) });
      }
      return screen({
        bar: appBar({ title: 'Categorie', sub: 'Trascina per riordinare', back: '/admin/menu' }),
        bodyClass: 'screen__body--narrow',
        body: [
          list || emptyState({ iconName: 'category', title: 'Nessuna categoria', text: 'Le categorie raggruppano i piatti in sala.' }),
          h('button', { type: 'button', class: 'btn btn--primary btn--lg', onClick: () => editCategory() }, icon('add'), 'Nuova categoria'),
        ],
      });
    },
  };
}
