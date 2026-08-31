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
