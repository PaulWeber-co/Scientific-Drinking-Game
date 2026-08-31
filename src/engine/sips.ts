import { estimateBac, widmarkFactor } from './bac';
import {
  HARD_CAP_BAC,
  MAX_SIPS_PER_TURN,
  MIN_AGE_ALCOHOL,
  NEUTRAL_BASE_SIPS,
  PACE_ROUNDS,
  SIP_ROUND_FLOOR,
} from './constants';
import { alcoholPerSip, sipUnit } from './drinks';
import type { DrinkDefinition, DrinkEvent, Profile, SipResult } from './types';

export interface SipContext {
  profile: Profile;
  drink: DrinkDefinition;
  events: DrinkEvent[];
  /** Was das Spiel ansagt – 3 ist "normal", 1 ist mild, 6+ ist eine Strafe. */
  baseSips: number;
  now?: number;
}

/**
 * Das Herzstück: übersetzt die Spiel-Ansage ("trink 3") in eine
 * persönliche Schluckzahl.
 *
 * Prinzip:
 *  1. Wie weit ist der Spieler noch vom Zielpegel entfernt?  -> Kopfraum
 *  2. Wie viel Gramm Alkohol fehlen dafür?                  -> Kopfraum * r * kg
 *  3. Wie viele Schlucke seines Getränks sind das?
 *  4. Das Ganze auf mehrere Ansagen strecken und mit der Spielhärte gewichten.
 *
 * Alkohol, der noch im Magen liegt, zählt bereits als "getrunken" – sonst
 * würde die App direkt nach einem Shot noch einmal nachlegen lassen.
 */
export function personalSips(ctx: SipContext): SipResult {
  const { profile, drink, events, baseSips } = ctx;
  const now = ctx.now ?? Date.now();
  const unit = (n: number) => sipUnit(drink, n);

  if (
    profile.alcoholFree ||
    profile.designatedDriver ||
    profile.age < MIN_AGE_ALCOHOL ||
    drink.abvPercent <= 0
  ) {
    return {
      sips: 0,
      phase: 'blocked',
      hint: profile.designatedDriver
        ? 'Du fährst heute. Für dich gibt es die Aufgabe statt der Schlucke.'
        : 'Alkoholfrei – du machst stattdessen die Aufgabe.',
      unit: unit(0),
      alcoholGrams: 0,
    };
  }

  const est = estimateBac(events, profile, now);
  const { r } = widmarkFactor(profile);
  const volume = r * profile.weightKg;
  const target = Math.min(profile.targetBac, HARD_CAP_BAC);
  const headroom = target - est.effective;
  const perSip = alcoholPerSip(drink);

  if (headroom <= 0 || perSip <= 0) {
    const over = est.effective - target;
    return {
      sips: 0,
      phase: over > 0.15 ? 'over' : 'maintaining',
      hint:
        over > 0.15
          ? 'Du bist über deinem Pegel. Diese Runde: Wasser.'
          : 'Pegel sitzt. Du darfst diese Runde aussetzen.',
      unit: unit(0),
      alcoholGrams: 0,
    };
  }

  const neededGrams = headroom * volume;
  const rawSips = neededGrams / perSip;
  const weight = Math.max(0, baseSips) / NEUTRAL_BASE_SIPS;
  const scaled = (rawSips / PACE_ROUNDS) * weight;

  let sips: number;
  if (scaled < SIP_ROUND_FLOOR) sips = 0;
  else sips = Math.max(1, Math.round(scaled));

  // Notbremse: nie so viel ausgeben, dass der harte Deckel gerissen wird.
  const capGrams = Math.max(0, (HARD_CAP_BAC - est.effective) * volume);
  sips = Math.min(sips, Math.floor(capGrams / perSip), MAX_SIPS_PER_TURN);
  sips = Math.max(0, sips);

  const phase = est.effective >= target * 0.9 ? 'maintaining' : 'reaching';
  return {
    sips,
    phase,
    hint:
      sips === 0
        ? 'Pegel passt gerade. Aussetzen ist die richtige Antwort.'
        : phase === 'reaching'
          ? 'Du baust noch auf – deshalb etwas mehr.'
          : 'Nur so viel, wie du seit eben abgebaut hast.',
    unit: unit(sips),
    alcoholGrams: round2(sips * perSip),
  };
}

/** Wie viele Schlucke bräuchte der Spieler insgesamt bis zum Zielpegel? */
export function sipsToTarget(ctx: Omit<SipContext, 'baseSips'>): number {
  const now = ctx.now ?? Date.now();
  const est = estimateBac(ctx.events, ctx.profile, now);
  const { r } = widmarkFactor(ctx.profile);
  const headroom = ctx.profile.targetBac - est.effective;
  const perSip = alcoholPerSip(ctx.drink);
  if (headroom <= 0 || perSip <= 0) return 0;
  return Math.max(0, Math.round((headroom * r * ctx.profile.weightKg) / perSip));
}

/** Erzeugt das Log-Event für getrunkene Schlucke. */
export function makeDrinkEvent(
  drink: DrinkDefinition,
  sips: number,
  source?: string,
  at: number = Date.now(),
): DrinkEvent {
  return {
    id: `${at.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at,
    drinkId: drink.id,
    drinkName: drink.name,
    sips,
    alcoholGrams: round2(sips * alcoholPerSip(drink)),
    source,
  };
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}
