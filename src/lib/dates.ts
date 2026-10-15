/** Week-ends candidats : on manipule des vendredis au format ISO (AAAA-MM-JJ). */
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function toIso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(iso: string, days: number): Date {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return d;
}

/** Date ISO décalée de `days` jours (ex. : dimanche de retour = vendredi + 2). */
export function shiftIso(iso: string, days: number): string {
  return toIso(addDays(iso, days));
}

/** Les `count` prochains vendredis à partir de demain. */
export function upcomingWeekends(count = 12, from = new Date()): string[] {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 12);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(toIso(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

/** « 13 – 15 nov. » (ou « 30 oct. – 1 nov. ») */
export function weekendRange(fridayIso: string, nights = 2): string {
  const start = parse(fridayIso);
  const end = addDays(fridayIso, nights);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}

/** « le week-end du 13 novembre » */
export function weekendLong(fridayIso: string): string {
  const d = parse(fridayIso);
  return `le week-end du ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

export function weekendParts(fridayIso: string) {
  const d = parse(fridayIso);
  return { day: `${d.getDate()}`, month: MONTHS[d.getMonth()], monthLong: MONTHS_LONG[d.getMonth()] };
}

/** Nombre de jours avant le départ (négatif si passé). */
export function daysUntil(fridayIso: string, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((parse(fridayIso).getTime() - today.getTime()) / 86_400_000);
}
