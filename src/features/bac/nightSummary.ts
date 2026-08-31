import { estimateBac, soberAt } from '../../engine/bac';
import type { DrinkEvent, Profile } from '../../engine/types';
import { GAMES } from '../../games/registry';

export interface NightSummary {
  from: number;
  to: number;
  totalGrams: number;
  standardDrinks: number;
  calls: number;
  water: number;
  peakBac: number;
  peakAt: number;
  soberAt: number;
  topGame: string | null;
  topDrink: string | null;
  /** Wie oft die App "aussetzen" gesagt hat, statt nachzuschenken. */
  pacedRounds: number;
}

/** Ein Standardglas entspricht etwa 12 g reinem Alkohol. */
const STANDARD_DRINK_G = 12;

export function buildNightSummary(
  log: DrinkEvent[],
  profile: Profile,
  water: number,
  now = Date.now(),
): NightSummary | null {
  if (!log.length) return null;
  const from = Math.min(...log.map((e) => e.at));
  const totalGrams = log.reduce((s, e) => s + e.alcoholGrams, 0);

  let peakBac = 0;
  let peakAt = from;
  for (let t = from; t <= now; t += 10 * 60_000) {
    const { bac } = estimateBac(log, profile, t);
    if (bac > peakBac) {
      peakBac = bac;
      peakAt = t;
    }
  }

  const count = (key: (e: DrinkEvent) => string | undefined) => {
    const tally: Record<string, number> = {};
    for (const e of log) {
      const k = key(e);
      if (k) tally[k] = (tally[k] ?? 0) + 1;
    }
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    return best?.[0] ?? null;
  };

  const topSource = count((e) => e.source);
  return {
    from,
    to: now,
    totalGrams,
    standardDrinks: totalGrams / STANDARD_DRINK_G,
    calls: log.length,
    water,
    peakBac,
    peakAt,
    soberAt: soberAt(log, profile, now),
    topGame: GAMES.find((g) => g.id === topSource)?.name ?? null,
    topDrink: count((e) => e.drinkName),
    pacedRounds: 0,
  };
}
