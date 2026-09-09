export function formatBac(bac: number): string {
  return bac.toFixed(2).replace('.', ',');
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'jetzt';
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} Min`;
  if (m === 0) return `${h} Std`;
  return `${h} Std ${m} Min`;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Fisher-Yates, mit optionalem RNG. */
export function shuffle<T>(input: readonly T[], rng: () => number = Math.random): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pick<T>(arr: readonly T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Datumsstempel im Papierrand, wie ihn eine Einwegkamera einbelichtet:
 * „08 09 26". Steht hier und nicht bei den Spiel-Bausteinen, weil ihn
 * inzwischen drei Stellen brauchen – und drei Kopien wären drei Formate.
 */
export function formatStamp(at: number = Date.now()): string {
  const d = new Date(at);
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `${zwei(d.getDate())} ${zwei(d.getMonth() + 1)} ${zwei(d.getFullYear() % 100)}`;
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/**
 * Datum eines Abends, wie man es im Rückblick lesen will.
 *
 * Die letzten beiden Tage bekommen Wörter statt Zahlen – „Gestern" findet
 * sich schneller wieder als „Fr, 5. September". Verglichen wird nach
 * Kalendertag, nicht nach 24-Stunden-Abstand: ein Abend, der um 2 Uhr
 * endet, war trotzdem gestern.
 */
export function formatNightDate(ts: number, now: number = Date.now()): string {
  const d = new Date(ts);
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(new Date(now)) - midnight(d)) / 86_400_000);
  if (days === 0) return 'Heute';
  if (days === 1) return 'Gestern';
  const label = `${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear()
    ? label
    : `${label} ${d.getFullYear()}`;
}
