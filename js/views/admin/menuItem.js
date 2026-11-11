/**
 * Dettaglio piatto (schermata 12): prezzo, descrizione, destinazione,
 * 14 allergeni, gruppi di varianti, disponibilità.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, screen, field, switchRow, segmented } from '../../components/layout.js';
import { allergenPicker } from '../../components/allergenPicker.js';
import { openDialog, confirmDialog } from '../../components/dialog.js';
import { toast } from '../../components/toast.js';
import { notFound } from '../../components/notFound.js';
import { formatCents, parseEuroToCents, formatDelta } from '../../utils/format.js';

export function describeGroup(g) {
  const opts = g.options.slice(0, 3).map((o) => `${o.name}${o.priceDeltaCents ? ` ${formatDelta(o.priceDeltaCents)}` : ''}`).join(', ');
  return `${g.required ? 'Obbligatorio' : 'Facoltativo'} · ${g.multiple ? 'più scelte' : '1 scelta'} · ${opts}${g.options.length > 3 ? ' …' : ''}`;
}

export default function menuItemView({ params, query }) {
  const isNew = params.id === 'nuovo';
  const existing = isNew ? null : app.data.menuItems.find((m) => m.id === params.id);
  if (!isNew && !existing) return notFound('Piatto non trovato', '/admin/menu');
  const { categories } = app.data;

  const draft = existing
    ? { ...existing, allergens: [...existing.allergens], modifierGroupIds: [...existing.modifierGroupIds] }
    : { name: '', description: '', priceCents: 0, categoryId: query.cat || categories[0]?.id, allergens: [], destination: 'cucina', modifierGroupIds: [], available: true };
  let priceText = existing ? formatCents(existing.priceCents) : '';
  let errors = {};
  let dirty = false;
  const touch = () => (dirty = true);

  function save() {
    errors = {};
    const cents = parseEuroToCents(priceText);
    if (!draft.name.trim()) errors.name = 'Inserisci il nome del piatto.';
    if (cents === null || cents < 0) errors.price = 'Inserisci un prezzo valido (es. 13,50).';
    if (Object.keys(errors).length) return app.rerender();
    const r = app.act('saveMenuItem', { item: { ...draft, id: existing?.id, priceCents: cents } });
    if (!r.ok) return;
    dirty = false;
    toast(isNew ? 'Piatto creato' : 'Piatto salvato');
    if (isNew) app.navigate(`/admin/menu?cat=${draft.categoryId}`, { replace: true });
    else app.rerender();
  }

  async function remove() {
    const ok = await confirmDialog({ title: `Eliminare “${existing.name}”?`, message: 'Le comande già inviate mantengono nome e prezzo.', confirmLabel: 'Elimina piatto', danger: true });
    if (ok && app.act('removeMenuItem', { id: existing.id }).ok) {
      toast('Piatto eliminato', { icon: 'delete' });
      app.navigate('/admin/menu', { replace: true });
    }
  }

  async function linkGroup() {
    const free = app.data.modifierGroups.filter((g) => !draft.modifierGroupIds.includes(g.id));
    const chosen = await openDialog({
      title: 'Collega gruppo di varianti',
      variant: 'sheet',
      body: (api) =>
        h('div', { class: 'stack' },
          free.length
            ? h('div', { class: 'list' },
                free.map((g) => h('button', { type: 'button', class: 'list-item', onClick: () => api.close(g.id) },
                  h('span', { class: 'list-item__main' }, h('div', { class: 'list-item__title' }, g.name), h('div', { class: 'list-item__sub' }, describeGroup(g))),
                  icon('add_link'))))
            : h('p', { class: 'muted' }, 'Non ci sono altri gruppi da collegare.'),
          h('a', { class: 'btn', href: '#/admin/varianti/nuovo', onClick: () => api.close(null) }, icon('add'), 'Crea un nuovo gruppo')),
    });
    if (chosen) {
      draft.modifierGroupIds.push(chosen);
      touch();
      app.rerender();
    }
  }

  return {
    title: isNew ? 'Nuovo piatto' : 'Modifica piatto',
    render() {
      const groups = draft.modifierGroupIds.map((id) => app.data.modifierGroups.find((g) => g.id === id)).filter(Boolean);
      const cat = app.data.categories.find((c) => c.id === draft.categoryId);
      const courseName = cat && cat.courseIndex !== null ? app.data.settings.courses[cat.courseIndex] : null;
      return screen({
        bar: appBar({
          title: isNew ? 'Nuovo piatto' : 'Modifica piatto',
          back: `/admin/menu${draft.categoryId ? `?cat=${draft.categoryId}` : ''}`,
          actions: [h('button', { type: 'button', class: 'btn btn--primary btn--sm', onClick: save }, 'Salva')],
        }),
        bodyClass: 'screen__body--narrow',
        body: [
          dirty ? h('div', { class: 'banner banner--warning' }, icon('edit_note'), h('div', { class: 'banner__body' }, 'Modifiche non salvate.')) : null,
          h('section', { class: 'card stack stack--4' },
            field('Nome', h('input', { class: 'input', id: 'item-name', value: draft.name, onInput: (e) => { draft.name = e.target.value; touch(); } }), { error: errors.name }),
            h('div', { class: 'form-grid form-grid--2' },
              field('Categoria · portata',
                h('select', { class: 'select', onChange: (e) => { draft.categoryId = e.target.value; touch(); app.rerender(); } },
                  app.data.categories.map((c) => h('option', { value: c.id, selected: c.id === draft.categoryId }, c.name))),
                { hint: courseName ? `Esce con: ${courseName}` : 'Nessuna portata associata' }),
              field('Prezzo', h('div', { class: 'input-affix' }, h('span', { class: 'affix' }, '€'),
                h('input', { class: 'input', id: 'item-price', inputmode: 'decimal', value: priceText, placeholder: '0,00', onInput: (e) => { priceText = e.target.value; touch(); } })),
              { error: errors.price, id: 'item-price' })),
            field('Descrizione', h('textarea', { class: 'textarea', rows: 3, onInput: (e) => { draft.description = e.target.value; touch(); } }, draft.description)),
            h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Destinazione'),
              segmented({
                label: 'Destinazione',
                block: true,
                value: draft.destination,
                options: [{ value: 'cucina', label: 'Cucina', icon: 'skillet' }, { value: 'bar', label: 'Bar', icon: 'local_bar' }],
                onChange: (v) => { draft.destination = v; touch(); app.rerender(); },
              })),
            switchRow({ id: 'item-soldout', label: 'Esaurito', sub: 'Disattiva il piatto in sala', checked: !draft.available, onChange: (v) => { draft.available = !v; touch(); } })),
          h('section', { class: 'stack stack--3' },
            h('div', { class: 'row row--between' },
              h('h2', { class: 'section-title' }, 'Allergeni · Reg. UE 1169/2011'),
              h('span', { class: 'text-sm muted', id: 'alg-count' }, `${draft.allergens.length} selezionati`)),
            allergenPicker({
              selected: draft.allergens,
              onChange: (list) => {
                draft.allergens = list;
                touch();
                const c = document.getElementById('alg-count');
                if (c) c.textContent = `${list.length} selezionati`;
              },
            })),
          h('section', { class: 'stack stack--3' },
            h('h2', { class: 'section-title' }, 'Gruppi di varianti'),
            groups.length
              ? h('div', { class: 'list' },
                  groups.map((g) =>
                    h('div', { class: 'list-item' },
                      h('span', { class: 'list-item__main' }, h('div', { class: 'list-item__title' }, g.name), h('div', { class: 'list-item__sub' }, describeGroup(g))),
                      h('button', {
                        type: 'button',
                        class: 'icon-btn',
                        'aria-label': `Scollega ${g.name}`,
                        onClick: () => { draft.modifierGroupIds = draft.modifierGroupIds.filter((x) => x !== g.id); touch(); app.rerender(); },
                      }, icon('link_off')))))
              : h('p', { class: 'text-sm muted' }, 'Nessuna variante (es. cottura, formato, aggiunte).'),
            h('button', { type: 'button', class: 'btn', onClick: linkGroup }, icon('add_link'), 'Collega gruppo')),
          existing ? h('button', { type: 'button', class: 'btn btn--danger-outline', onClick: remove }, icon('delete'), 'Elimina piatto') : null,
          h('div', { class: 'sticky-actions' }, h('button', { type: 'button', class: 'btn btn--primary btn--lg', onClick: save }, isNew ? 'Crea piatto' : 'Salva piatto')),
        ],
      });
    },
  };
}
