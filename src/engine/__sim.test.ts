import { describe, expect, it } from 'vitest';
import { absorbedFraction, estimateBac, soberAt, widmarkFactor } from './bac';
import { ABSORPTION_TAU_MIN, BETA_TYPICAL, RESORPTION_DEFICIT } from './constants';
import { buildNightSummary } from '../features/bac/nightSummary';
import type { DrinkEvent, Profile } from './types';

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 3_600_000;

/**
 * Referenz: die naive Simulation, die pro Minute über alle Drinks summiert.
 * Sie ist offensichtlich korrekt, aber quadratisch – deshalb rechnet die App
 * inkrementell. Dieser Test hält beide Wege deckungsgleich.
 */
function referenceBac(events: DrinkEvent[], profile: Profile, at: number): number {
  const { r } = widmarkFactor(profile);
  const volume = r * profile.weightKg;
  const tau = ABSORPTION_TAU_MIN[profile.stomach];
  const relevant = events.filter((e) => e.at <= at).sort((a, b) => a.at - b.at);
  if (!relevant.length) return 0;
  let bac = 0;
  for (let t = relevant[0].at; t < at; t += MS_PER_MIN) {
    const next = Math.min(t + MS_PER_MIN, at);
    let absorbed = 0;
    for (const e of relevant) {
      if (e.at >= next) break;
      const gross = e.alcoholGrams * (1 - RESORPTION_DEFICIT);
      absorbed +=
        gross *
        (absorbedFraction((next - e.at) / MS_PER_MIN, tau) -
          absorbedFraction((t - e.at) / MS_PER_MIN, tau));
    }
    bac += absorbed / volume;
    bac = Math.max(0, bac - (BETA_TYPICAL * (next - t)) / MS_PER_HOUR);
  }
  return Math.round(bac * 1000) / 1000;
}

/** Deterministischer Zufall, damit ein Fehlschlag reproduzierbar bleibt. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

const profile = (patch: Partial<Profile> = {}): Profile => ({
  name: 'Test',
  color: 'blue',
  age: 28,
  weightKg: 78,
  heightCm: 180,
  sex: 'male',
  stomach: 'light',
  targetBac: 0.4,
  alcoholFree: false,
  designatedDriver: false,
  ...patch,
});

function randomNight(seed: number, hours: number, count: number, t0: number): DrinkEvent[] {
  const rand = rng(seed);
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    at: Math.round(t0 + rand() * hours * MS_PER_HOUR),
    drinkId: 'beer-pils',
    drinkName: 'Bier',
    sips: 3,
    alcoholGrams: Math.round(rand() * 900) / 100,
  })).sort((a, b) => a.at - b.at);
}

describe('Simulation: schnelle und naive Rechnung stimmen ueberein', () => {
  const t0 = Date.UTC(2026, 0, 1, 20, 0, 0);

  it('liefert bei zufaelligen Abenden denselben Pegel', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const hours = 2 + (seed % 7);
      const log = randomNight(seed, hours, 3 + (seed % 20), t0);
      const p = profile({
        stomach: (['empty', 'light', 'full'] as const)[seed % 3],
        sex: (['male', 'female', 'diverse'] as const)[seed % 3],
        weightKg: 52 + (seed % 50),
      });
      for (const m of [5, 30, 90, 200, hours * 60 + 120]) {
        const at = t0 + m * MS_PER_MIN;
        expect(estimateBac(log, p, at).bac, `seed ${seed}, +${m} min`).toBeCloseTo(
          referenceBac(log, p, at),
          3,
        );
      }
    }
  });

  it('trifft auch Faelle, in denen der Pegel zwischendurch auf null faellt', () => {
    // Ein Drink, sechs Stunden Pause, noch ein Drink: die Null-Klammer greift.
    const log: DrinkEvent[] = [
      { id: 'a', at: t0, drinkId: 'shot', drinkName: 'Shot', sips: 1, alcoholGrams: 6 },
      { id: 'b', at: t0 + 6 * MS_PER_HOUR, drinkId: 'shot', drinkName: 'Shot', sips: 1, alcoholGrams: 6 },
    ];
    const p = profile();
    for (const m of [60, 180, 360, 380, 420, 600]) {
      const at = t0 + m * MS_PER_MIN;
      expect(estimateBac(log, p, at).bac, `+${m} min`).toBeCloseTo(referenceBac(log, p, at), 3);
    }
    expect(estimateBac(log, p, t0 + 350 * MS_PER_MIN).bac).toBe(0);
  });

  it('bleibt auch bei Drinks in derselben Minute deckungsgleich', () => {
    const log: DrinkEvent[] = Array.from({ length: 6 }, (_, i) => ({
      id: `e${i}`,
      at: t0 + Math.floor(i / 3) * 1000,
      drinkId: 'beer-pils',
      drinkName: 'Bier',
      sips: 2,
      alcoholGrams: 3.2,
    }));
    const p = profile();
    const at = t0 + 90 * MS_PER_MIN;
    expect(estimateBac(log, p, at).bac).toBeCloseTo(referenceBac(log, p, at), 3);
  });

  it('rechnet einen langen Abend schnell genug fuers Handy', () => {
    // Vor der inkrementellen Simulation brauchten soberAt und der
    // Abend-Rueckblick hier je ~600 ms und haben den Hauptthread blockiert.
    const now = Date.now();
    const log = randomNight(7, 8, 80, now - 8 * MS_PER_HOUR);
    const p = profile();
    const t = performance.now();
    for (let i = 0; i < 5; i++) {
      soberAt(log, p, now);
      buildNightSummary(log, p, 0, now);
    }
    const perRun = (performance.now() - t) / 5;
    expect(perRun, `${perRun.toFixed(1)} ms pro Durchlauf`).toBeLessThan(60);
  });
});
