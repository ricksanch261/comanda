/**
 * Mappa tavoli (schermata 16): tab delle aree, piantina o griglia, legenda,
 * pannello "Da fare" su tablet.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, emptyState, segmented } from '../../components/layout.js';
import { openDialog } from '../../components/dialog.js';
import { getPrefs, setPrefs } from '../../state/prefs.js';
import { sessionHasAllergies } from '../../domain/allergens.js';
import { tableInfo, TABLE_STATUSES, elapsed, currentWaiter } from './common.js';
import { openTableDialog } from './openTableDialog.js';
import { billSummary } from './billHooks.js';

const STATUS_ORDER = { bill: 0, held: 1, active: 2, open: 3, free: 4 };

function cardMeta(info) {
  const { table, session, status, meta } = info;
  const text = status === 'free' ? `${table.seats.length} posti` : `${session.covers} · ${elapsed(session)}`;
  return h('span', { class: 'tcard__meta' }, icon(meta.icon), text);
}

function ariaFor(info) {
  const { table, session, status, meta } = info;
  const parts = [`Tavolo ${table.label}`, meta.longLabel || meta.label];
  if (session) parts.push(`${session.covers} coperti`, `da ${elapsed(session)}`);
  else parts.push(`${table.seats.length} posti`);
  if (session && sessionHasAllergies(session)) parts.push('allergie presenti');
  return parts.join(', ');
}

function onTable(info) {
  if (info.status === 'free') openTableDialog(info.table);
  else app.navigate(`/sala/tavolo/${info.table.id}`);
}

function algBadge(info) {
  return info.session && sessionHasAllergies(info.session)
    ? h('span', { class: 'tcard__alg', 'aria-hidden': 'true' }, icon('warning'))
    : null;
}

function planView(infos) {
  return h('div', { class: 'plan-wrap' },
    h('div', { class: 'plan', role: 'group', 'aria-label': 'Piantina' },
      infos.map((info) => {
        const { table } = info;
        const L = table.layout;
        return h('button', {
          type: 'button',
          class: ['tcard', `tcard--${info.status}`, `tcard--${table.shape}`],
          'aria-label': ariaFor(info),
          style: { left: `${L.x}%`, top: `${L.y}%`, width: `${L.w}%`, height: `${L.h}%`, transform: L.rotation ? `rotate(${L.rotation}deg)` : null },
          onClick: () => onTable(info),
        },
        h('span', { class: 'plan__inner', style: { transform: L.rotation ? `rotate(${-L.rotation}deg)` : null } },
          h('span', { class: 'tcard__label' }, table.label),
          cardMeta(info)),
        algBadge(info));
      })));
}

function gridView(infos) {
  const sorted = [...infos].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.table.label.localeCompare(b.table.label, 'it', { numeric: true }));
  return h('div', { class: 'tgrid' },
    sorted.map((info) => {
      const { table, session, status, meta } = info;
      return h('button', { type: 'button', class: ['tcard', `tcard--${status}`], 'aria-label': ariaFor(info), onClick: () => onTable(info) },
        h('span', { class: 'tcard__row' },
          h('span', { class: 'tcard__label' }, table.label),
          h('span', { class: 'tcard__meta' }, icon('person'), session ? session.covers : table.seats.length)),
        h('span', { class: 'tcard__row' },
          h('span', { class: 'tcard__meta' }, icon(meta.icon), meta.longLabel || meta.label),
          session ? h('span', {}, elapsed(session)) : null),
        algBadge(info));
    }));
}

function legend() {
  const item = (style, label, iconName) =>
    h('span', {}, h('i', { style, 'aria-hidden': 'true' }, iconName ? h('span', { class: 'icon', style: { fontSize: '10px', color: '#fff', display: 'grid', placeItems: 'center', maxWidth: 'none' } }, iconName) : null), label);
  return h('div', { class: 'legend', 'aria-hidden': 'true' },
    item({ border: '2px dashed var(--status-free)' }, 'Libero'),
    item({ background: 'var(--status-open)', border: '2px solid var(--color-primary)' }, 'Aperto'),
    item({ background: 'var(--status-active)' }, 'In corso'),
    item({ background: 'var(--status-held)' }, 'In attesa'),
    item({ background: 'var(--status-bill)' }, 'Conto'),
    item({ background: 'var(--status-allergen)', borderRadius: '50%' }, 'Allergie', 'warning'));
}

function sidePanel(allInfos) {
  const todo = [];
  for (const info of allInfos) {
    const { table, session, status } = info;
    if (status === 'held') todo.push({ info, title: 'Marcia la portata in attesa', sub: `Ultima comanda ${elapsed(session)} fa` });
    else if (status === 'bill') todo.push({ info, title: 'Conto richiesto', sub: `${session.covers} coperti${billSummary(session) ? ` · ${billSummary(session)}` : ''}` });
    else if (status === 'open') todo.push({ info, title: 'Nessuna comanda inviata', sub: `Aperto da ${elapsed(session)}${sessionHasAllergies(session) ? ' · allergie' : ''}` });
  }
  todo.sort((a, b) => STATUS_ORDER[a.info.status] - STATUS_ORDER[b.info.status]);
  const open = allInfos.filter((i) => i.session);
  const covers = open.reduce((t, i) => t + i.session.covers, 0);
  const free = allInfos.find((i) => i.status === 'free');
  return h('aside', { class: 'map-side stack stack--4', 'aria-label': 'Riepilogo' },
    h('div', { class: 'stat-grid' },
      h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'Tavoli aperti'), h('div', { class: 'stat__value' }, `${open.length} / ${allInfos.length}`)),
      h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'Coperti in sala'), h('div', { class: 'stat__value' }, covers))),
    h('h2', { class: 'section-title' }, 'Da fare'),
    todo.length
      ? h('div', { class: 'todo' },
          todo.map((t) =>
            h('a', { class: 'list-item todo-item', href: `#/sala/tavolo/${t.info.table.id}` },
              h('span', { class: ['table-thumb', `tcard--${t.info.status}`], style: { borderStyle: 'solid' } }, t.info.table.label),
              h('span', { class: 'list-item__main' }, h('div', { class: 'list-item__title' }, t.title), h('div', { class: 'list-item__sub' }, t.sub)),
              icon('chevron_right'))))
      : h('p', { class: 'text-sm muted' }, 'Niente in sospeso.'),
    free ? h('button', { type: 'button', class: 'btn btn--lg', onClick: () => openTableDialog(free.table) }, icon('add'), `Apri tavolo libero (${free.table.label})`) : null);
}

async function moreMenu() {
  await openDialog({
    title: 'Menu',
    variant: 'sheet',
    body: (api) =>
      h('div', { class: 'list' },
        h('a', { class: 'list-item', href: '#/admin', onClick: () => api.close() }, icon('lock'), h('span', { class: 'list-item__main list-item__title' }, 'Amministrazione')),
        app.data.settings.waiters.length
          ? h('a', { class: 'list-item', href: '#/sala/chi-sei', onClick: () => api.close() }, icon('badge'), h('span', { class: 'list-item__main list-item__title' }, 'Cambia cameriere'))
          : null,
        h('div', { class: 'list-item' }, icon('contrast'), h('span', { class: 'list-item__main list-item__title' }, 'Tema'),
          segmented({
            label: 'Tema',
            value: getPrefs().theme,
            options: [{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Chiaro' }, { value: 'dark', label: 'Scuro' }],
            onChange: (v) => { setPrefs({ theme: v }); api.close(); },
          }))),
  });
}

export default function mapView() {
  return {
    title: 'Sala',
    tick: 30000,
    render() {
      const { areas, tables, settings } = app.data;
      const prefs = getPrefs();
      if (settings.waiters.length && !currentWaiter()) {
        queueMicrotask(() => app.navigate('/sala/chi-sei', { replace: true }));
        return h('div');
      }
      const waiter = currentWaiter();
      const active = tables.filter((t) => t.active);
      const allInfos = active.map(tableInfo);
      let areaId = prefs.mapAreaId;
      if (!areas.some((a) => a.id === areaId)) areaId = areas[0]?.id ?? null;
      const infos = allInfos.filter((i) => i.table.areaId === areaId);
      const openCount = allInfos.filter((i) => i.session).length;
      const covers = allInfos.reduce((t, i) => t + (i.session?.covers ?? 0), 0);

      const bar = appBar({
        eyebrow: settings.restaurantName,
        title: 'Sala',
        actions: [
          waiter ? h('a', { class: 'waiter-chip', href: '#/sala/chi-sei', 'aria-label': `Cameriere: ${waiter.name}. Cambia` }, h('span', { class: 'avatar' }, waiter.name.slice(0, 1).toUpperCase()), waiter.name) : null,
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Menu', onClick: moreMenu }, icon('more_vert')),
        ],
      });

      if (!active.length) {
        return h('div', { class: 'screen' }, bar,
          h('main', { class: 'screen__body screen__body--narrow' },
            emptyState({ iconName: 'table_restaurant', title: 'Nessun tavolo', text: 'Crea le aree e i tavoli in Amministrazione.', action: h('a', { class: 'btn btn--primary', href: '#/admin/tavoli' }, 'Vai ai tavoli') })));
      }

      return h('div', { class: 'screen' },
        bar,
        h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Aree' },
          areas.map((a) => {
            const n = allInfos.filter((i) => i.table.areaId === a.id && i.session).length;
            return h('button', {
              type: 'button',
              role: 'tab',
              class: 'tab',
              'aria-selected': String(a.id === areaId),
              onClick: () => { setPrefs({ mapAreaId: a.id }); app.rerender(); },
            }, a.name, h('span', { class: 'tab__count', 'aria-label': `${n} aperti` }, n));
          })),
        h('div', { class: 'map-toolbar' },
          segmented({
            label: 'Vista',
            value: prefs.mapView,
            options: [{ value: 'plan', label: 'Piantina', icon: 'map' }, { value: 'grid', label: 'Griglia', icon: 'grid_view' }],
            onChange: (v) => { setPrefs({ mapView: v }); app.rerender(); },
          }),
          h('div', { class: 'text-sm muted' }, h('b', { style: { color: 'var(--color-text)' } }, openCount), ' aperti · ', h('b', { style: { color: 'var(--color-text)' } }, covers), ' coperti')),
        h('main', { class: 'map-layout' },
          h('div', {},
            infos.length
              ? prefs.mapView === 'grid' ? gridView(infos) : planView(infos)
              : h('div', { style: { padding: '0 16px' } }, emptyState({ iconName: 'table_restaurant', title: 'Nessun tavolo in quest’area' })),
            legend()),
          sidePanel(allInfos)));
    },
  };
}
