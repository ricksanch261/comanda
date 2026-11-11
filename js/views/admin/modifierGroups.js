/**
 * Gruppi di varianti (schermata 13): elenco e dettaglio con opzioni e supplementi.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, screen, emptyState, field, switchRow } from '../../components/layout.js';
import { makeSortable } from '../../components/sortable.js';
import { confirmDialog } from '../../components/dialog.js';
import { toast } from '../../components/toast.js';
import { notFound } from '../../components/notFound.js';
import { formatCents, parseEuroToCents } from '../../utils/format.js';
import { describeGroup } from './menuItem.js';
import { newId } from '../../domain/ids.js';

export function modifierGroupsView() {
  return {
    title: 'Gruppi di varianti',
    render() {
      const { modifierGroups, menuItems } = app.data;
      return screen({
        bar: appBar({ title: 'Gruppi di varianti', back: '/admin' }),
        bodyClass: 'screen__body--narrow',
        body: [
          modifierGroups.length
            ? h('div', { class: 'list' },
                modifierGroups.map((g) => {
                  const n = menuItems.filter((m) => m.modifierGroupIds.includes(g.id)).length;
                  return h('a', { class: 'list-item', href: `#/admin/varianti/${g.id}` },
                    h('span', { class: 'list-item__main' },
                      h('div', { class: 'list-item__title' }, g.name),
                      h('div', { class: 'list-item__sub' }, describeGroup(g)),
                      h('div', { class: 'list-item__sub' }, `Usato da ${n} ${n === 1 ? 'piatto' : 'piatti'}`)),
                    icon('chevron_right'));
                }))
            : emptyState({ iconName: 'tune', title: 'Nessun gruppo', text: 'Es. “Cottura” con al sangue, media, ben cotta; oppure “Aggiunte” con supplementi.' }),
          h('a', { class: 'btn btn--primary btn--lg', href: '#/admin/varianti/nuovo' }, icon('add'), 'Nuovo gruppo'),
        ],
      });
    },
  };
}

export function modifierGroupDetailView({ params }) {
  const isNew = params.id === 'nuovo';
  const existing = isNew ? null : app.data.modifierGroups.find((g) => g.id === params.id);
  if (!isNew && !existing) return notFound('Gruppo non trovato', '/admin/varianti');
  const draft = existing
    ? { ...existing, options: existing.options.map((o) => ({ ...o, key: o.id, priceText: o.priceDeltaCents ? formatCents(o.priceDeltaCents) : '' })) }
    : { name: '', required: false, multiple: false, options: [{ key: newId(), name: '', priceText: '' }] };
  let error = null;
  let dirty = false;
  const touch = () => (dirty = true);

  function save() {
    error = null;
    const options = [];
    for (const o of draft.options) {
      if (!o.name.trim()) continue;
      const cents = o.priceText.trim() ? parseEuroToCents(o.priceText) : 0;
      if (cents === null) {
        error = `Supplemento non valido per “${o.name}”.`;
        return app.rerender();
      }
      options.push({ id: o.id, name: o.name, priceDeltaCents: cents });
    }
    const r = app.act('saveModifierGroup', { group: { id: existing?.id, name: draft.name, required: draft.required, multiple: draft.multiple, options } });
    if (!r.ok) return;
    dirty = false;
    toast(isNew ? 'Gruppo creato' : 'Gruppo salvato');
    if (isNew) app.navigate(`/admin/varianti/${r.result}`, { replace: true });
    else app.rerender();
  }

  async function remove() {
    const n = app.data.menuItems.filter((m) => m.modifierGroupIds.includes(existing.id)).length;
    const ok = await confirmDialog({
      title: `Eliminare “${existing.name}”?`,
      message: n ? `Verrà scollegato da ${n} ${n === 1 ? 'piatto' : 'piatti'}.` : 'L’operazione non si può annullare.',
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (ok && app.act('removeModifierGroup', { id: existing.id }).ok) {
      toast('Gruppo eliminato', { icon: 'delete' });
      app.navigate('/admin/varianti', { replace: true });
    }
  }

  return {
    title: isNew ? 'Nuovo gruppo' : draft.name,
    render() {
      const usedBy = existing ? app.data.menuItems.filter((m) => m.modifierGroupIds.includes(existing.id)) : [];
      const list = h('div', { class: 'list' },
        draft.options.map((o, i) =>
          h('div', { class: 'list-item seat-row', 'data-id': o.key },
            h('button', { type: 'button', class: 'icon-btn drag-handle', id: `drag-${o.key}`, 'aria-label': `Riordina ${o.name || 'opzione'} (usa le frecce)` }, icon('drag_indicator')),
            h('input', { class: 'input grow', value: o.name, placeholder: 'Opzione', 'aria-label': `Nome opzione ${i + 1}`, onInput: (e) => { o.name = e.target.value; touch(); } }),
            h('div', { class: 'input-affix', style: { width: '112px', flex: 'none' } }, h('span', { class: 'affix' }, '€'),
              h('input', { class: 'input', inputmode: 'decimal', value: o.priceText, placeholder: '+0,00', 'aria-label': `Supplemento opzione ${i + 1}`, onInput: (e) => { o.priceText = e.target.value; touch(); } })),
            h('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': `Rimuovi opzione ${o.name}`, onClick: () => { draft.options.splice(i, 1); touch(); app.rerender(); } }, icon('delete')))));
      makeSortable(list, { onReorder: (keys) => { draft.options.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key)); touch(); app.rerender(); } });

      return screen({
        bar: appBar({ title: isNew ? 'Nuovo gruppo' : draft.name || 'Gruppo', back: '/admin/varianti', actions: [h('button', { type: 'button', class: 'btn btn--primary btn--sm', onClick: save }, 'Salva')] }),
        bodyClass: 'screen__body--narrow',
        body: [
          dirty ? h('div', { class: 'banner banner--warning' }, icon('edit_note'), h('div', { class: 'banner__body' }, 'Modifiche non salvate.')) : null,
          error && h('div', { class: 'banner banner--danger' }, icon('error'), h('div', { class: 'banner__body' }, error)),
          h('section', { class: 'card stack stack--3' },
            field('Nome del gruppo', h('input', { class: 'input', value: draft.name, placeholder: 'Es. Cottura', onInput: (e) => { draft.name = e.target.value; touch(); } })),
            switchRow({ id: 'grp-required', label: 'Obbligatorio', sub: 'Il cameriere deve scegliere un’opzione', checked: draft.required, onChange: (v) => { draft.required = v; touch(); } }),
            switchRow({ id: 'grp-multiple', label: 'Scelta multipla', sub: 'Si possono scegliere più opzioni', checked: draft.multiple, onChange: (v) => { draft.multiple = v; touch(); } })),
          h('section', { class: 'stack stack--3' },
            h('div', { class: 'row row--between' }, h('h2', { class: 'section-title' }, 'Opzioni'), h('span', { class: 'text-xs muted' }, 'Supplemento: negativo per uno sconto')),
            list,
            h('button', { type: 'button', class: 'btn', onClick: () => { draft.options.push({ key: newId(), name: '', priceText: '' }); touch(); app.rerender(); } }, icon('add'), 'Aggiungi opzione')),
          usedBy.length ? h('div', { class: 'banner banner--info' }, icon('info'), h('div', { class: 'banner__body' }, `Usato da ${usedBy.length} ${usedBy.length === 1 ? 'piatto' : 'piatti'}: ${usedBy.map((m) => m.name).join(', ')}.`)) : null,
          existing ? h('button', { type: 'button', class: 'btn btn--danger-outline', onClick: remove }, icon('delete'), 'Elimina gruppo') : null,
          h('div', { class: 'sticky-actions' }, h('button', { type: 'button', class: 'btn btn--primary btn--lg', onClick: save }, 'Salva gruppo')),
        ],
      });
    },
  };
}
