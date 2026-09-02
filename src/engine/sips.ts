import { estimateBac, widmarkFactor } from './bac';
import {
  DOSING_ABSORPTION,
  HARD_CAP_BAC,
  MAX_HARSHNESS,
  MAX_RISE_PER_TURN,
  MAX_SIPS_PER_TURN,
  MIN_AGE_ALCOHOL,
  NEUTRAL_BASE_SIPS,
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
 *  2. Wie viel Alkohol muss er dafür *trinken*?              -> Kopfraum · r · kg / Resorption
 *  3. Wie viele Schlucke seines Getränks sind das?
 *  4. Pro Ansage höchstens so viel, dass der Pegel um MAX_RISE_PER_TURN steigt.
 *
 * Wichtig ist der Unterschied zwischen Schritt 2 und einer reinen
 * Bruchteil-Regel: Wer immer nur ein Drittel der Lücke ausgibt, kommt nie am
 * Ziel an, weil zwischen zwei Ansagen weiter abgebaut wird. Deshalb schließt
 * die Rechnung die Lücke vollständig und begrenzt stattdessen das Tempo.
 *
 * Alkohol, der noch im Magen liegt, zählt bereits als getrunken – sonst
 * würde die App direkt nach einem Shot noch einmal nachlegen lassen. Dadurch
 * pendelt sich der tatsächliche Pegel leicht *unter* dem Ziel ein; diese
 * Abweichung geht bewusst in die sichere Richtung.
 */
export function personalSips(ctx: SipContext): SipResult {
  const { profile, drink, events, baseSips } = ctx;
  const now = ctx.now ?? Date.now();
  const unit = (n: number) => sipUnit(drink, n);

  const blockedReason = profile.designatedDriver
    ? 'Du fährst heute. Für dich gibt es die Aufgabe statt der Schlucke.'
    : profile.age < MIN_AGE_ALCOHOL
      ? `Unter ${MIN_AGE_ALCOHOL}: für dich gibt es die Aufgabe statt der Schlucke.`
      : profile.alcoholFree
        ? 'Alkoholfrei – du machst stattdessen die Aufgabe.'
        : drink.abvPercent <= 0
          ? 'Alkoholfreies Getränk – für dich zählt die Aufgabe.'
          : null;

  if (blockedReason) {
    return {
      sips: 0,
      phase: 'blocked',
      hint: blockedReason,
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

  if (headroom <= 0 || perSip <= 0 || volume <= 0) {
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

  /** Promille -> zu trinkende Gramm. */
  const gramsFor = (bac: number) => (bac * volume) / DOSING_ABSORPTION;

  const needed = gramsFor(headroom);
  const harshness = Math.min(MAX_HARSHNESS, Math.max(0, baseSips) / NEUTRAL_BASE_SIPS);
  const ceiling = gramsFor(MAX_RISE_PER_TURN) * harshness;
  // Notbremse: nie so viel, dass der harte Deckel gerissen wird.
  const emergency = gramsFor(Math.max(0, HARD_CAP_BAC - est.effective));

  const grams = Math.min(needed, ceiling, emergency);
  let sips = Math.round(grams / perSip);

  // Grobe Einheiten: ein ganzer Shot ist größer als das Tempo-Limit einer
  // Ansage. Ohne diese Ausnahme bekäme ein Shot-Trinker nie etwas ab. Das
  // Tempo-Limit ist eine Bremse, keine Sicherheitsgrenze – die ist der harte
  // Deckel, und der wird hier weiterhin eingehalten.
  if (sips === 0 && needed >= perSip / 2 && emergency >= perSip) sips = 1;

  sips = Math.min(sips, MAX_SIPS_PER_TURN);
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
  const volume = r * ctx.profile.weightKg;
  const headroom = ctx.profile.targetBac - est.effective;
  const perSip = alcoholPerSip(ctx.drink);
  if (headroom <= 0 || perSip <= 0 || volume <= 0) return 0;
  return Math.max(0, Math.round((headroom * volume) / DOSING_ABSORPTION / perSip));
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
