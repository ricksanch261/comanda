/** Formattazione di valuta, numeri e tempi (locale it-IT). */

const nf = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
});

/** 1350 → "13,50" */
export function formatCents(cents) {
  return nf.format((Number(cents) || 0) / 100);
}

/** 1350 → "€ 13,50" */
export function formatEuro(cents) {
  return `€ ${formatCents(cents)}`;
}

/** Variazione di prezzo: 150 → "+1,50", -300 → "−3,00", 0 → "" */
export function formatDelta(cents) {
  if (!cents) return '';
  return `${cents > 0 ? '+' : '−'}${formatCents(Math.abs(cents))}`;
}

/**
 * Converte una stringa inserita dall'utente in centesimi.
 * Accetta "13", "13,5", "13,50", "13.50", "1.234,50", "€ 2,50".
 * Restituisce null se non valida.
 */
export function parseEuroToCents(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;
  let s = String(input ?? '').replace(/[€\s]/g, '').replace(/^\+/, '');
  if (!s) return null;
  const negative = s.startsWith('-') || s.startsWith('−');
  if (negative) s = s.slice(1);
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [int, dec = ''] = s.split('.');
  const cents = Number(int) * 100 + Number((dec + '00').slice(0, 2));
  return negative ? -cents : cents;
}

/** Durata compatta in stile mockup: 6′, 38′, 1h12′ */
export function formatDuration(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 60) return `${totalMin}′`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2, '0')}′`;
}

const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatTime(iso) {
  return iso ? timeFmt.format(new Date(iso)) : '';
}
export function formatDateTime(iso) {
  return iso ? dateTimeFmt.format(new Date(iso)).replace(',', '') : '';
}
export function formatDate(iso) {
  return iso ? dateFmt.format(new Date(iso)) : '';
}

/** Data locale in formato YYYY-MM-DD (per input type=date e nomi file). */
export function isoDay(date = new Date()) {
  const d = new Date(date);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "1 riga" / "3 righe" */
export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}
