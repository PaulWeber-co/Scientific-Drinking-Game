import { estimateBac, widmarkFactor } from './bac';
import {
  BETA_TYPICAL,
  DOSING_ABSORPTION,
  HARD_CAP_BAC,
  MAX_HARSHNESS,
  MAX_RISE_PER_TURN,
  MAX_SIPS_PER_TURN,
  MIN_AGE_ALCOHOL,
  NEUTRAL_BASE_SIPS,
  OVER_DANGER_BAC,
  OVER_PAUSE_BAC,
  OVER_STOP_BAC,
  OVER_TOLERANCE_BAC,
} from './constants';
import { alcoholPerSip, sipUnit } from './drinks';
import type {
  BacEstimate,
  DrinkDefinition,
  DrinkEvent,
  OverSeverity,
  Profile,
  SipResult,
} from './types';

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
    if (est.effective - target > OVER_TOLERANCE_BAC) {
      const call = overTargetCall(est, target);
      return {
        sips: 0,
        phase: 'over',
        severity: call.severity,
        hint: call.hint,
        unit: unit(0),
        alcoholGrams: 0,
      };
    }
    return {
      sips: 0,
      phase: 'maintaining',
      hint: 'Pegel sitzt. Du darfst diese Runde aussetzen.',
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
  // Deckel, und der wird hier weiterhin eingehalten. Härte 0 heißt „keine
  // Ansage" und bekommt auch hier keinen Schluck.
  if (sips === 0 && baseSips > 0 && drink.sipIsUnit && needed >= perSip / 2 && emergency >= perSip)
    sips = 1;

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

/**
 * Ansage oberhalb des Ziels: vier Stufen nach absolutem Pegel, in den
 * ersten beiden mit der Zeit, bis der Pegel wieder am Ziel ist (Abstand
 * durch Abbaurate – das „ZeroLine"-Muster der Promille-Apps). Liegt noch
 * Alkohol im Magen, steht das dabei, damit niemand nachlegt. Sachlich,
 * kurz, ohne Tadel; die letzte Stufe nennt die Erste-Hilfe-Regel.
 */
/** „35 Minuten", „1 Stunde 50 Minuten", „2 Stunden" – für die Ansage. */
function formatWait(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Minuten`;
  const hours = h === 1 ? '1 Stunde' : `${h} Stunden`;
  return m ? `${hours} ${m} Minuten` : hours;
}

export function overTargetCall(
  est: BacEstimate,
  target: number,
): { severity: OverSeverity; hint: string } {
  // Erst ab einem spürbaren Rest im Magen (etwa ein Drittel Bier), sonst
  // hieße es noch 90 Minuten nach dem letzten Schluck „es kommt was nach".
  const rising = est.pending >= 0.05;
  // Auf 5 Minuten gerundet: die Schätzung ist keine Uhr.
  const wait = formatWait(
    Math.max(5, Math.ceil(((est.effective - target) / BETA_TYPICAL) * 12) * 5),
  );
  if (est.effective >= OVER_DANGER_BAC) {
    return {
      severity: 'danger',
      hint: 'Das ist gefährlich. Nichts mehr trinken, nicht allein lassen. Wird jemand nicht wach oder atmet unregelmäßig: 112 und stabile Seitenlage.',
    };
  }
  if (est.effective >= OVER_STOP_BAC) {
    return {
      severity: 'stop',
      hint: 'Für heute ist Schluss. Wasser, etwas essen, und bleib bei den anderen.',
    };
  }
  if (est.effective >= OVER_PAUSE_BAC) {
    return {
      severity: 'pause',
      hint: `Deutlich drüber${rising ? ', und es kommt noch was nach' : ''}. Mach eine Pause: Wasser, etwas essen, frische Luft. Frühestens in ${wait} wieder dabei.`,
    };
  }
  return {
    severity: 'water',
    hint: `Über dem Ziel${rising ? ', und es kommt noch was nach' : ''}. Diese Runde Wasser – in etwa ${wait} passt es wieder.`,
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
