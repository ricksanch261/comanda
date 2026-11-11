/**
 * Report (schermata 15): incasso, coperti, scontrino medio per coperto e
 * classifica dei piatti, con filtro per intervallo di date.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, screen, segmented, field, emptyState } from '../../components/layout.js';
import { computeReport } from '../../domain/reports.js';
import { formatEuro, formatCents, isoDay, plural } from '../../utils/format.js';

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function rangeFor(preset, custom) {
  const now = new Date();
  const today = startOfDay(now);
  switch (preset) {
    case 'today': return { from: today, to: endOfDay(now) };
    case 'yesterday': { const y = new Date(today.getTime() - 86400000); return { from: y, to: endOfDay(y) }; }
    case '7d': return { from: new Date(today.getTime() - 6 * 86400000), to: endOfDay(now) };
    case '30d': return { from: new Date(today.getTime() - 29 * 86400000), to: endOfDay(now) };
    case 'custom': {
      const f = custom.from ? startOfDay(new Date(`${custom.from}T00:00`)) : null;
      const t = custom.to ? endOfDay(new Date(`${custom.to}T00:00`)) : null;
      return { from: f, to: t };
    }
    default: return { from: null, to: null };
  }
}

export default function reportsView() {
  let preset = 'today';
  let rank = 'quantity';
  const custom = { from: isoDay(new Date(Date.now() - 6 * 86400000)), to: isoDay() };

  return {
    title: 'Report',
    render() {
      const r = computeReport(app.data.sessions, rangeFor(preset, custom));
      const top = rank === 'quantity' ? r.topByQuantity : r.topByRevenue;
      const max = Math.max(1, ...top.map((x) => (rank === 'quantity' ? x.quantity : x.revenueCents)));
      return screen({
        bar: appBar({ title: 'Report', back: '/admin' }),
        bodyClass: 'screen__body--narrow',
        body: [
          h('div', { class: 'chips', role: 'group', 'aria-label': 'Intervallo' },
            [['today', 'Oggi'], ['yesterday', 'Ieri'], ['7d', '7 giorni'], ['30d', '30 giorni'], ['all', 'Tutto'], ['custom', 'Personalizzato']].map(([k, l]) =>
              h('button', { type: 'button', class: 'chip', 'aria-pressed': String(preset === k), onClick: () => { preset = k; app.rerender(); } }, l))),
          preset === 'custom'
            ? h('div', { class: 'form-grid form-grid--2' },
                field('Dal', h('input', { class: 'input', type: 'date', value: custom.from, onChange: (e) => { custom.from = e.target.value; app.rerender(); } })),
                field('Al', h('input', { class: 'input', type: 'date', value: custom.to, onChange: (e) => { custom.to = e.target.value; app.rerender(); } })))
            : null,
          h('div', { class: 'kpi-grid' },
            h('div', { class: 'stat kpi kpi--main' }, h('div', { class: 'stat__label' }, 'Incasso'), h('div', { class: 'stat__value num' }, formatEuro(r.revenueCents)),
              h('div', { class: 'text-xs muted' }, `${plural(r.sessions, 'tavolo chiuso', 'tavoli chiusi')}${r.paidCents !== r.revenueCents ? ` · incassati ${formatEuro(r.paidCents)}` : ''}`)),
            h('div', { class: 'stat kpi' }, h('div', { class: 'stat__label' }, 'Coperti'), h('div', { class: 'stat__value num' }, r.covers)),
            h('div', { class: 'stat kpi' }, h('div', { class: 'stat__label' }, 'Scontrino medio'), h('div', { class: 'stat__value num' }, formatEuro(r.averagePerCoverCents)), h('div', { class: 'text-xs muted' }, 'per coperto'))),
          h('section', { class: 'stack stack--3' },
            h('div', { class: 'row row--between row--wrap' },
              h('h2', { class: 'section-title' }, 'Piatti più venduti · top 10'),
              segmented({ label: 'Ordina per', value: rank, options: [{ value: 'quantity', label: 'Quantità' }, { value: 'revenue', label: 'Incasso' }], onChange: (v) => { rank = v; app.rerender(); } })),
            top.length
              ? h('ol', { class: 'rank' },
                  top.map((x, i) => {
                    const v = rank === 'quantity' ? x.quantity : x.revenueCents;
                    return h('li', { class: 'rank__item' },
                      h('span', { class: 'rank__pos' }, i + 1),
                      h('span', { class: 'rank__main' },
                        h('span', { class: 'row row--between' }, h('span', { class: 'bold' }, x.name), h('span', { class: 'num bold' }, rank === 'quantity' ? `${x.quantity}` : `€ ${formatCents(x.revenueCents)}`)),
                        h('span', { class: 'rank__bar', 'aria-hidden': 'true' }, h('span', { style: { width: `${Math.max(2, (v / max) * 100)}%` } })),
                        h('span', { class: 'text-xs muted' }, rank === 'quantity' ? `€ ${formatCents(x.revenueCents)}` : `${x.quantity} venduti`)));
                  }))
              : emptyState({ iconName: 'bar_chart', title: 'Nessun dato', text: 'Non ci sono tavoli chiusi nell’intervallo scelto.' })),
        ],
      });
    },
  };
}
