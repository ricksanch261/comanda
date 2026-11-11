/**
 * Dati di esempio per provare l'app (aree, tavoli, menu con allergeni e varianti).
 * Mantiene nome del locale, PIN e camerieri esistenti.
 */
import { actions } from './actions.js';
import { createEmptyData } from '../domain/models.js';

export function buildDemoData(current) {
  const d = createEmptyData();
  d.settings = { ...d.settings, ...current.settings, coverCharge: { enabled: true, amountCents: 250 } };
  const sala = actions.addArea(d, { name: 'Sala interna' });
  const dehors = actions.addArea(d, { name: 'Dehors' });
  actions.bulkCreateTables(d, { areaId: sala, quantity: 4, seats: 2, prefix: 'T', start: 1, shape: 'round' });
  actions.bulkCreateTables(d, { areaId: sala, quantity: 3, seats: 4, prefix: 'T', start: 5, shape: 'square' });
  actions.bulkCreateTables(d, { areaId: sala, quantity: 2, seats: 6, prefix: 'T', start: 8, shape: 'rect' });
  actions.bulkCreateTables(d, { areaId: dehors, quantity: 4, seats: 4, prefix: 'D', start: 1, shape: 'square' });
  const cat = (name, courseIndex) => actions.addCategory(d, { name, courseIndex });
  const C = d.settings.courses;
  const idx = (n) => (C.indexOf(n) >= 0 ? C.indexOf(n) : null);
  const ant = cat('Antipasti', idx('Antipasti'));
  const pri = cat('Primi', idx('Primi'));
  const sec = cat('Secondi', idx('Secondi'));
  const con = cat('Contorni', idx('Contorni'));
  const dol = cat('Dolci', idx('Dolci'));
  const bev = cat('Bevande', null);
  const cottura = actions.saveModifierGroup(d, { group: { name: 'Cottura', required: true, options: [{ name: 'Al sangue' }, { name: 'Media' }, { name: 'Ben cotta' }] } });
  const aggiunte = actions.saveModifierGroup(d, { group: { name: 'Aggiunte', multiple: true, options: [{ name: 'Rucola', priceDeltaCents: 150 }, { name: 'Grana', priceDeltaCents: 100 }] } });
  const formato = actions.saveModifierGroup(d, { group: { name: 'Formato', required: true, options: [{ name: 'Normale' }, { name: 'Mezza porzione', priceDeltaCents: -300 }] } });
  const item = (name, priceCents, categoryId, allergens = [], extra = {}) =>
    actions.saveMenuItem(d, { item: { name, priceCents, categoryId, allergens, destination: 'cucina', ...extra } });
  item('Tagliere toscano', 1800, ant, ['latte'], { description: 'Salumi e formaggi del territorio' });
  item('Bruschette al pomodoro', 450, ant, ['glutine']);
  item('Tagliatelle al ragù', 1300, pri, ['glutine', 'uova', 'sedano'], { description: 'Pasta all’uovo, ragù di manzo e maiale', modifierGroupIds: [formato] });
  item('Risotto ai funghi porcini', 1400, pri, ['latte'], { description: 'Carnaroli, porcini, parmigiano' });
  item('Spaghetti alle vongole', 1500, pri, ['glutine', 'molluschi'], { description: 'Vongole veraci, aglio, prezzemolo' });
  item('Gnocchi al pomodoro', 1200, pri, [], { description: 'Senza glutine, basilico fresco' });
  item('Tagliata di manzo', 2350, sec, [], { modifierGroupIds: [cottura, aggiunte] });
  item('Branzino al forno', 2100, sec, ['pesce']);
  item('Patate al forno', 350, con);
  item('Insalata mista', 400, con, ['senape']);
  item('Tiramisù', 600, dol, ['uova', 'latte', 'glutine']);
  item('Cantucci e vin santo', 700, dol, ['glutine', 'frutta_a_guscio', 'uova', 'solfiti']);
  item('Acqua naturale 75 cl', 300, bev, [], { destination: 'bar' });
  item('Calice Chianti', 600, bev, ['solfiti'], { destination: 'bar' });
  item('Caffè', 150, bev, [], { destination: 'bar' });
  return d;
}
