import { nightPeak, soberAt } from '../../engine/bac';
import type { DrinkEvent, Profile } from '../../engine/types';
import type { Night } from '../../store/nights';
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
}

/** Ein Standardglas entspricht etwa 12 g reinem Alkohol. */
const STANDARD_DRINK_G = 12;

/**
 * Alles, was sich ohne Körperdaten aus dem Log ergibt.
 *
 * Getrennt vom Rest, weil ein archivierter Abend genau diese Zahlen frisch
 * rechnen kann – seine profilabhängigen liegen eingefroren daneben.
 */
function logFigures(log: DrinkEvent[], water: number, now: number) {
  const totalGrams = log.reduce((s, e) => s + e.alcoholGrams, 0);

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
    from: Math.min(...log.map((e) => e.at)),
    to: now,
    totalGrams,
    standardDrinks: totalGrams / STANDARD_DRINK_G,
    calls: log.length,
    water,
    topGame: GAMES.find((g) => g.id === topSource)?.name ?? null,
    topDrink: count((e) => e.drinkName),
  };
}

export function buildNightSummary(
  log: DrinkEvent[],
  profile: Profile,
  water: number,
  now = Date.now(),
): NightSummary | null {
  if (!log.length) return null;
  return {
    ...logFigures(log, water, now),
    ...nightPeak(log, profile, now),
    soberAt: soberAt(log, profile, now),
  };
}

/**
 * Rückblick auf einen archivierten Abend.
 *
 * Nimmt die eingefrorenen Promille-Zahlen statt sie neu zu rechnen: das
 * heutige Gewicht sagt nichts darüber, wie voll jemand vor drei Wochen war.
 */
export function summarizeNight(night: Night): NightSummary | null {
  if (!night.log.length) return null;
  return {
    ...logFigures(night.log, night.waterCount, night.endedAt),
    peakBac: night.peakBac,
    peakAt: night.peakAt,
    soberAt: night.soberAt,
  };
}
