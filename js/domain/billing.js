/**
 * Calcolo del conto, ripartizione per posto, alla romana e pagamenti.
 * Tutti gli importi sono in centesimi interi.
 *
 * Regole:
 * - riga "seat": tutto al posto;
 * - riga "shared" tra k posti: divisione in centesimi interi, il resto va un
 *   centesimo alla volta ai primi posti in ordine di posizione;
 * - riga "table": divisa tra tutti i posti occupati con la stessa regola;
 * - coperto: importo per ogni posto occupato;
 * - le righe stornate sono escluse da ogni totale;
 * - invariante: Σ quote dei posti = totale del tavolo.
 *
 * L'ordine dei posti è quello di session.seatsState (posizione, poi extra).
 */

/** Totale di una riga (0 se stornata). */
export function lineTotal(line) {
  if (!line || line.status === 'voided') return 0;
  return line.unitPriceCents * line.quantity;
}

/**
 * Divide `total` in `k` parti intere; il resto va ai primi.
 * distribute(1000, 3) → [334, 333, 333]
 */
export function distribute(total, k) {
  if (!Number.isInteger(total)) throw new TypeError('total deve essere un intero (centesimi)');
  if (!(Number.isInteger(k) && k > 0)) return [];
  const base = Math.trunc(total / k);
  let rest = total - base * k; // stesso segno di total, |rest| < k
  const sign = Math.sign(rest);
  return Array.from({ length: k }, () => {
    if (rest !== 0) {
      rest -= sign;
      return base + sign;
    }
    return base;
  });
}

/** Coperto effettivo da applicare (0 se disattivato). */
export function coverChargeFromSettings(settings) {
  return settings?.coverCharge?.enabled ? settings.coverCharge.amountCents || 0 : 0;
}

/**
 * Calcola il conto della sessione.
 * @returns {{
 *   seats: { seatId: string, items: BillItem[], totalCents: number }[],
 *   linesTotalCents: number, coverTotalCents: number, totalCents: number,
 *   unassignedCents: number
 * }}
 * BillItem = { lineId|null, kind: 'seat'|'shared'|'table'|'cover', name, quantity, amountCents, share: { of: number }|null }
 */
export function computeBill(session, { coverChargeCents = 0 } = {}) {
  const order = (session.seatsState || []).map((s) => s.seatId);
  const seats = order.map((seatId) => ({ seatId, items: [], totalCents: 0 }));
  const bySeat = new Map(seats.map((s) => [s.seatId, s]));
  const add = (seatId, item) => {
    const s = bySeat.get(seatId);
    s.items.push(item);
    s.totalCents += item.amountCents;
  };
  let linesTotal = 0;
  let unassigned = 0;

  for (const line of session.orderLines || []) {
    const total = lineTotal(line);
    if (line.status === 'voided') continue;
    linesTotal += total;
    const a = line.assignment || { type: 'table' };
    let targets = a.type === 'table' ? order : order.filter((id) => (a.seatIds || []).includes(id));
    let kind = a.type;
    if (!targets.length) {
      // Posti non più presenti: la riga diventa del tavolo.
      targets = order;
      kind = 'table';
    }
    if (!targets.length) {
      unassigned += total;
      continue;
    }
    const parts = distribute(total, targets.length);
    targets.forEach((seatId, i) =>
      add(seatId, {
        lineId: line.id,
        kind,
        name: line.nameSnapshot,
        quantity: line.quantity,
        amountCents: parts[i],
        share: targets.length > 1 ? { of: targets.length } : null,
      }),
    );
  }

  const cover = Math.max(0, Math.round(coverChargeCents || 0));
  if (cover) for (const s of seats) add(s.seatId, { lineId: null, kind: 'cover', name: 'Coperto', quantity: 1, amountCents: cover, share: null });
  const coverTotal = cover * seats.length;

  return {
    seats,
    linesTotalCents: linesTotal,
    coverTotalCents: coverTotal,
    totalCents: linesTotal + coverTotal,
    unassignedCents: unassigned,
  };
}

/** Quote "alla romana": totale diviso per i coperti. */
export function splitRomana(totalCents, covers) {
  return distribute(totalCents, Math.max(1, Math.floor(covers || 1)));
}

/** Righe aggregate per il conto totale (stesso nome + prezzo unitario). */
export function aggregateLines(session) {
  const map = new Map();
  for (const l of session.orderLines || []) {
    if (l.status === 'voided') continue;
    const mods = l.modifiers.map((m) => m.name).join(', ');
    const key = `${l.nameSnapshot}|${mods}|${l.unitPriceCents}`;
    const cur = map.get(key) || { name: l.nameSnapshot, detail: mods, unitPriceCents: l.unitPriceCents, quantity: 0, amountCents: 0 };
    cur.quantity += l.quantity;
    cur.amountCents += lineTotal(l);
    map.set(key, cur);
  }
  return [...map.values()];
}

/**
 * Riepilogo pagamenti.
 * I pagamenti con seatIds sono attribuiti a quei posti (divisi in parti intere);
 * quelli senza seatIds valgono solo sul totale.
 */
export function paymentSummary(session, bill) {
  const paid = (session.payments || []).reduce((t, p) => t + p.amountCents, 0);
  const perSeat = new Map(bill.seats.map((s) => [s.seatId, { dueCents: s.totalCents, paidCents: 0 }]));
  for (const p of session.payments || []) {
    const ids = (p.seatIds || []).filter((id) => perSeat.has(id));
    if (!ids.length) continue;
    distribute(p.amountCents, ids.length).forEach((amt, i) => {
      perSeat.get(ids[i]).paidCents += amt;
    });
  }
  for (const v of perSeat.values()) {
    v.residualCents = Math.max(0, v.dueCents - v.paidCents);
    v.status = v.dueCents <= 0 ? 'empty' : v.paidCents >= v.dueCents ? 'paid' : v.paidCents > 0 ? 'partial' : 'open';
  }
  return {
    totalCents: bill.totalCents,
    paidCents: paid,
    residualCents: bill.totalCents - paid,
    perSeat,
  };
}
