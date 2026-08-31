import {
  ABSORPTION_TAU_MIN,
  BETA_CONSERVATIVE,
  BETA_TYPICAL,
  BLOOD_WATER_FRACTION,
  ETHANOL_DENSITY,
  RESORPTION_DEFICIT,
  WIDMARK_R,
} from './constants';
import type { BacEstimate, BacZone, DrinkEvent, Profile } from './types';

const MS_PER_HOUR = 3_600_000;
const MS_PER_MIN = 60_000;

/** Reiner Alkohol in Gramm für ein Volumen mit gegebenem ABV. */
export function alcoholGrams(volumeMl: number, abvPercent: number): number {
  return (volumeMl * abvPercent) / 100 * ETHANOL_DENSITY;
}

/**
 * Körperwasser nach Watson et al. (1980) in Litern.
 * Nur sinnvoll mit Körpergröße – sonst undefined.
 */
export function bodyWaterLiters(profile: Profile): number | undefined {
  const { heightCm, weightKg, age, sex } = profile;
  if (!heightCm || heightCm < 120 || heightCm > 230) return undefined;
  const male = 2.447 - 0.09516 * age + 0.1074 * heightCm + 0.3362 * weightKg;
  const female = -2.097 + 0.1069 * heightCm + 0.2466 * weightKg;
  if (sex === 'male') return male;
  if (sex === 'female') return female;
  return (male + female) / 2;
}

/**
 * Widmark-Verteilungsfaktor r.
 * Mit Körpergröße wird er aus dem Körperwasser abgeleitet (präziser als
 * die pauschalen Tabellenwerte), sonst greift der Standardwert je Geschlecht.
 */
export function widmarkFactor(profile: Profile): { r: number; source: 'watson' | 'standard' } {
  const tbw = bodyWaterLiters(profile);
  if (tbw && profile.weightKg > 0) {
    const r = tbw / profile.weightKg / BLOOD_WATER_FRACTION;
    // Ausreißer (extreme BMI-Werte) auf einen plausiblen Korridor begrenzen.
    return { r: clamp(r, 0.45, 0.85), source: 'watson' };
  }
  return { r: WIDMARK_R[profile.sex], source: 'standard' };
}

/** Anteil eines Drinks, der nach `minutes` Minuten resorbiert ist (0..1). */
export function absorbedFraction(minutes: number, tauMin: number): number {
  if (minutes <= 0) return 0;
  return 1 - Math.exp(-minutes / tauMin);
}

interface SimulationOptions {
  /** Abbaurate in Promille/h. */
  beta?: number;
  /** Anteil des Alkohols, der das Blut nie erreicht (0..1). */
  resorptionDeficit?: number;
}

/**
 * Schätzt den Blutalkohol zum Zeitpunkt `at`.
 *
 * Gegenüber der reinen Widmark-Formel modellieren wir zusätzlich die
 * Resorption: Alkohol wirkt nicht sofort, sondern steigt exponentiell ins Blut.
 * Ohne das würde die App direkt nach einem Shot einen viel zu hohen Wert
 * anzeigen – und direkt danach zu wenig nachschenken.
 */
export function estimateBac(
  events: DrinkEvent[],
  profile: Profile,
  at: number = Date.now(),
  options: SimulationOptions = {},
): BacEstimate {
  const beta = options.beta ?? BETA_TYPICAL;
  const deficit = options.resorptionDeficit ?? RESORPTION_DEFICIT;
  const { r, source } = widmarkFactor(profile);
  const relevant = events.filter((e) => e.at <= at).sort((a, b) => a.at - b.at);
  const totalAlcoholGrams = relevant.reduce((sum, e) => sum + e.alcoholGrams, 0);

  const empty: BacEstimate = {
    bac: 0,
    pending: 0,
    effective: 0,
    totalAlcoholGrams,
    r,
    rSource: source,
  };
  if (!relevant.length || profile.weightKg <= 0) return empty;

  const tau = ABSORPTION_TAU_MIN[profile.stomach] ?? ABSORPTION_TAU_MIN.light;
  const volume = r * profile.weightKg; // "kg Verteilungsraum" – g Alkohol pro Promille

  // Schrittweise Simulation: pro Minute resorbierten Alkohol addieren und
  // gleichzeitig linear abbauen. Abbau greift nur, solange Alkohol im Blut ist.
  const start = relevant[0].at;
  const stepMs = MS_PER_MIN;
  let bac = 0;
  for (let t = start; t < at; t += stepMs) {
    const next = Math.min(t + stepMs, at);
    let absorbedG = 0;
    for (const e of relevant) {
      if (e.at >= next) break;
      const groß = e.alcoholGrams * (1 - deficit);
      const f0 = absorbedFraction((t - e.at) / MS_PER_MIN, tau);
      const f1 = absorbedFraction((next - e.at) / MS_PER_MIN, tau);
      absorbedG += groß * (f1 - f0);
    }
    bac += absorbedG / volume;
    bac = Math.max(0, bac - (beta * (next - t)) / MS_PER_HOUR);
  }

  // Was noch im Magen liegt, kommt garantiert noch – das rechnen wir mit ein,
  // damit direkt nach einem Shot niemand "nachlegen" muss.
  let pendingG = 0;
  for (const e of relevant) {
    const groß = e.alcoholGrams * (1 - deficit);
    pendingG += groß * (1 - absorbedFraction((at - e.at) / MS_PER_MIN, tau));
  }

  return {
    bac: round3(bac),
    pending: round3(pendingG / volume),
    effective: round3(bac + pendingG / volume),
    totalAlcoholGrams,
    r,
    rSource: source,
  };
}

/**
 * Höchster Pegel, der aus dem bisherigen Konsum noch entsteht,
 * plus der Zeitpunkt dazu. Nützlich für "du hast deinen Peak schon hinter dir".
 */
export function projectPeak(
  events: DrinkEvent[],
  profile: Profile,
  from: number = Date.now(),
): { bac: number; at: number } {
  let best = { bac: 0, at: from };
  for (let i = 0; i <= 180; i += 5) {
    const t = from + i * MS_PER_MIN;
    const { bac } = estimateBac(events, profile, t);
    if (bac > best.bac) best = { bac, at: t };
  }
  return best;
}

/** Promille zu einem beliebigen späteren Zeitpunkt (Restalkohol). */
export function bacAt(
  events: DrinkEvent[],
  profile: Profile,
  at: number,
  options: SimulationOptions = {},
): number {
  return estimateBac(events, profile, at, options).bac;
}

/**
 * Wann ist der Pegel wieder bei 0.0 Promille?
 * Rechnet bewusst konservativ (langsamer Abbau, kein Resorptionsdefizit),
 * damit die Antwort auf "kann ich fahren?" im Zweifel zu spät statt zu früh ist.
 */
export function soberAt(events: DrinkEvent[], profile: Profile, from: number = Date.now()): number {
  const safe: SimulationOptions = { beta: BETA_CONSERVATIVE, resorptionDeficit: 0 };
  const now = estimateBac(events, profile, from, safe);
  if (now.effective <= 0.001) return from;
  // Obergrenze: Pegel + alles was noch kommt, geteilt durch die Abbaurate,
  // plus Puffer für die Resorption.
  const hours = now.effective / BETA_CONSERVATIVE + 1;
  let lo = from;
  let hi = from + hours * MS_PER_HOUR;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (estimateBac(events, profile, mid, safe).bac > 0.001) lo = mid;
    else hi = mid;
  }
  return Math.ceil(hi);
}

/** Konservativer Restalkohol zu einer Zielzeit (für den Fahr-Check). */
export function residualBac(events: DrinkEvent[], profile: Profile, at: number): number {
  return bacAt(events, profile, at, { beta: BETA_CONSERVATIVE, resorptionDeficit: 0 });
}

export function bacZone(bac: number): BacZone {
  if (bac < 0.1) return 'sober';
  if (bac < 0.3) return 'warmup';
  if (bac <= 0.55) return 'sweet';
  if (bac <= 0.8) return 'edge';
  return 'over';
}

export const ZONE_META: Record<BacZone, { label: string; color: string; note: string }> = {
  sober: { label: 'Nüchtern', color: 'var(--teal)', note: 'Noch nichts passiert.' },
  warmup: { label: 'Aufwärmen', color: 'var(--blue)', note: 'Der Pegel baut sich auf.' },
  sweet: { label: 'Sweet Spot', color: 'var(--green)', note: 'Genau hier willst du bleiben.' },
  edge: { label: 'Grenzbereich', color: 'var(--orange)', note: 'Ab hier kippt die gute Laune.' },
  over: { label: 'Zu viel', color: 'var(--red)', note: 'Wasser. Jetzt.' },
};

/** Ampel für den Fahrtauglichkeits-Check. Grün gibt es erst bei echten 0.0. */
export function drivingLight(bac: number): 'green' | 'yellow' | 'red' {
  if (bac <= 0.001) return 'green';
  if (bac < 0.3) return 'yellow';
  return 'red';
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function round3(v: number) {
  return Math.round(v * 1000) / 1000;
}
