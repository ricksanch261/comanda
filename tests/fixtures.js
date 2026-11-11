import { actions } from '../js/state/actions.js';
import { createEmptyData } from '../js/domain/models.js';

/** Dati di esempio: 1 area, tavolo T1 da 4 posti, menu con allergeni e varianti. */
export function fixture({ seats = 4, cover = 0 } = {}) {
  const d = createEmptyData();
  d.settings.restaurantName = 'Test';
  d.settings.adminPinHash = 'x';
  d.settings.coverCharge = { enabled: cover > 0, amountCents: cover };
  const areaId = actions.addArea(d, { name: 'Sala' });
  const tableId = actions.addTable(d, { label: 'T1', areaId, seats });
  const t2 = actions.addTable(d, { label: 'T2', areaId, seats: 2 });
  const primi = actions.addCategory(d, { name: 'Primi', courseIndex: 1 });
  const secondi = actions.addCategory(d, { name: 'Secondi', courseIndex: 2 });
  const bevande = actions.addCategory(d, { name: 'Bevande', courseIndex: null });
  const cottura = actions.saveModifierGroup(d, { group: { name: 'Cottura', required: true, options: [{ name: 'Al sangue' }, { name: 'Media' }] } });
  const aggiunte = actions.saveModifierGroup(d, { group: { name: 'Aggiunte', multiple: true, options: [{ name: 'Rucola', priceDeltaCents: 150 }, { name: 'Grana', priceDeltaCents: 100 }] } });
  const item = (name, priceCents, categoryId, extra = {}) =>
    actions.saveMenuItem(d, { item: { name, priceCents, categoryId, destination: 'cucina', ...extra } });
  const ids = {
    risotto: item('Risotto', 1400, primi, { allergens: ['latte'] }),
    tagliatelle: item('Tagliatelle', 1300, primi, { allergens: ['glutine', 'uova'] }),
    tagliata: item('Tagliata', 2350, secondi, { modifierGroupIds: [cottura, aggiunte] }),
    acqua: item('Acqua', 300, bevande, { destination: 'bar' }),
    tagliere: item('Tagliere', 1800, primi),
  };
  return { d, areaId, tableId, t2, cats: { primi, secondi, bevande }, groups: { cottura, aggiunte }, items: ids };
}

export function open(d, tableId, covers) {
  const sessionId = actions.openTable(d, { tableId, covers });
  const session = d.sessions.find((s) => s.id === sessionId);
  return { sessionId, session, seat: (i) => session.seatsState[i].seatId };
}
