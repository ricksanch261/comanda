/**
 * I 14 allergeni del Reg. UE 1169/2011 e i controlli di conflitto.
 */
export const ALLERGENS = [
  { code: 'glutine', short: 'GL', label: 'Glutine', icon: 'grain' },
  { code: 'crostacei', short: 'CR', label: 'Crostacei', icon: 'set_meal' },
  { code: 'uova', short: 'UO', label: 'Uova', icon: 'egg' },
  { code: 'pesce', short: 'PE', label: 'Pesce', icon: 'phishing' },
  { code: 'arachidi', short: 'AR', label: 'Arachidi', icon: 'nutrition' },
  { code: 'soia', short: 'SO', label: 'Soia', icon: 'eco' },
  { code: 'latte', short: 'LA', label: 'Latte', icon: 'water_full' },
  { code: 'frutta_a_guscio', short: 'FG', label: 'Frutta a guscio', icon: 'park' },
  { code: 'sedano', short: 'SD', label: 'Sedano', icon: 'grass' },
  { code: 'senape', short: 'SN', label: 'Senape', icon: 'emoji_food_beverage' },
  { code: 'sesamo', short: 'SE', label: 'Sesamo', icon: 'scatter_plot' },
  { code: 'solfiti', short: 'SF', label: 'Solfiti', icon: 'wine_bar' },
  { code: 'lupini', short: 'LU', label: 'Lupini', icon: 'spa' },
  { code: 'molluschi', short: 'MO', label: 'Molluschi', icon: 'water' },
];

export const ALLERGEN_CODES = ALLERGENS.map((a) => a.code);

const byCode = new Map(ALLERGENS.map((a) => [a.code, a]));

export function getAllergen(code) {
  return byCode.get(code) || null;
}

export function isAllergenCode(code) {
  return byCode.has(code);
}

/** Filtra i codici non validi, rimuove i duplicati e ordina secondo l'elenco ufficiale. */
export function normalizeAllergens(list) {
  const set = new Set((list || []).filter(isAllergenCode));
  return ALLERGEN_CODES.filter((c) => set.has(c));
}

export function allergenLabels(list) {
  return normalizeAllergens(list).map((c) => byCode.get(c).label);
}

/** Allergeni in comune tra un piatto e le allergie dichiarate da un ospite. */
export function intersectAllergens(dishAllergens, guestAllergens) {
  const guest = new Set(guestAllergens || []);
  return normalizeAllergens(dishAllergens).filter((c) => guest.has(c));
}

/**
 * Posti destinatari di un'assegnazione.
 * - seat/shared: i posti indicati (se presenti nella sessione)
 * - table: tutti i posti della sessione
 */
export function targetSeatStates(session, assignment) {
  const seats = session?.seatsState || [];
  if (!assignment || assignment.type === 'table') return seats;
  const ids = new Set(assignment.seatIds || []);
  return seats.filter((s) => ids.has(s.seatId));
}

/**
 * Conflitti tra gli allergeni di un piatto e i posti destinatari.
 * @returns {{ seatId: string, guestName: string|null, allergens: string[], declared: string[] }[]}
 */
export function findAllergenConflicts(dishAllergens, session, assignment) {
  return targetSeatStates(session, assignment)
    .map((s) => ({
      seatId: s.seatId,
      guestName: s.guestName || null,
      allergens: intersectAllergens(dishAllergens, s.allergens),
      declared: normalizeAllergens(s.allergens),
    }))
    .filter((c) => c.allergens.length > 0);
}

/** true se almeno un posto della sessione ha allergie dichiarate. */
export function sessionHasAllergies(session) {
  return Boolean(session?.seatsState?.some((s) => s.allergens && s.allergens.length > 0));
}
