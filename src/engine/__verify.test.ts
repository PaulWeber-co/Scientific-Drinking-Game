/**
 * Unabhängige Nachrechnung der BAC-Engine.
 *
 * Die Tests hier vergleichen die numerische Simulation nicht mit sich selbst,
 * sondern mit geschlossenen Lösungen derselben Differentialgleichung und mit
 * Werten aus der Literatur. Sie sind bewusst ausführlich – die Zahlen sind das
 * Versprechen dieser App.
 */
import { describe, expect, it } from 'vitest';
import { alcoholGrams, bodyWaterLiters, estimateBac, soberAt, widmarkFactor } from './bac';
import { ABSORPTION_TAU_MIN, BETA_TYPICAL, RESORPTION_DEFICIT } from './constants';
import { findDrink } from './drinks';
import { makeDrinkEvent } from './sips';
import type { Profile } from './types';

const MIN = 60_000;
const HOUR = 3_600_000;

const man: Profile = {
  name: 'Referenz',
  color: 'blue',
  age: 30,
  weightKg: 80,
  sex: 'male',
  stomach: 'light',
  targetBac: 0.4,
  alcoholFree: false,
  designatedDriver: false,
};

/**
 * Geschlossene Lösung derselben Modellgleichung:
 *   dB/dt = (A / V) · (1/τ) · e^(−t/τ) − β,   B(0) = 0
 * also B(t) = (A/V)·(1 − e^(−t/τ)) − β·t, solange B > 0 bleibt.
 */
function analytic(grams: number, volume: number, tauMin: number, beta: number, minutes: number) {
  const absorbed = (grams / volume) * (1 - Math.exp(-minutes / tauMin));
  return Math.max(0, absorbed - (beta * minutes) / 60);
}

describe('Modell gegen geschlossene Lösung', () => {
  const t0 = Date.UTC(2026, 0, 1, 20, 0, 0);
  const tau = ABSORPTION_TAU_MIN.light;
  const { r } = widmarkFactor(man);
  const volume = r * man.weightKg;

  it('trifft ohne Abbau exakt die Resorptionskurve', () => {
    const drink = findDrink('beer-helles');
    const ev = [makeDrinkEvent(drink, 12, 'test', t0)];
    const grams = ev[0].alcoholGrams * (1 - RESORPTION_DEFICIT);

    for (const minutes of [5, 10, 20, 30, 60, 120]) {
      const sim = estimateBac(ev, man, t0 + minutes * MIN, { beta: 0 }).bac;
      const exact = analytic(grams, volume, tau, 0, minutes);
      // Eine Minute Schrittweite: der Fehler liegt im Promille-Bereich der Kurve.
      expect(Math.abs(sim - exact), `${minutes} min`).toBeLessThan(0.005);
    }
  });

  it('trifft mit Abbau die geschlossene Lösung, solange der Pegel positiv bleibt', () => {
    const drink = findDrink('wine-red');
    const ev = [makeDrinkEvent(drink, 20, 'test', t0)];
    const grams = ev[0].alcoholGrams * (1 - RESORPTION_DEFICIT);

    for (const minutes of [10, 20, 40, 60, 90]) {
      const sim = estimateBac(ev, man, t0 + minutes * MIN).bac;
      const exact = analytic(grams, volume, tau, BETA_TYPICAL, minutes);
      expect(exact, `${minutes} min sollte positiv sein`).toBeGreaterThan(0.01);
      expect(Math.abs(sim - exact), `${minutes} min`).toBeLessThan(0.006);
    }
  });

  it('erreicht den Peak zum analytisch erwarteten Zeitpunkt', () => {
    const drink = findDrink('shot-schnaps');
    const ev = [makeDrinkEvent(drink, 4, 'test', t0)];
    const grams = ev[0].alcoholGrams * (1 - RESORPTION_DEFICIT);
    // dB/dt = 0  ->  t* = τ · ln( A / (V · τ · β_pro_Minute) )
    const betaPerMin = BETA_TYPICAL / 60;
    const tStar = tau * Math.log(grams / volume / (tau * betaPerMin));

    let best = { bac: -1, minutes: 0 };
    for (let m = 0; m <= 180; m++) {
      const bac = estimateBac(ev, man, t0 + m * MIN).bac;
      if (bac > best.bac) best = { bac, minutes: m };
    }
    expect(Math.abs(best.minutes - tStar), `erwartet ${tStar.toFixed(1)} min`).toBeLessThan(3);
  });

  it('nähert sich für grosse Zeiten der reinen Widmark-Geraden', () => {
    const drink = findDrink('beer-helles');
    const ev = [makeDrinkEvent(drink, 30, 'test', t0)];
    const grams = ev[0].alcoholGrams * (1 - RESORPTION_DEFICIT);
    const minutes = 150; // Resorption ist nach 150 min bei tau=16 praktisch fertig
    const widmark = grams / volume - (BETA_TYPICAL * minutes) / 60;
    const sim = estimateBac(ev, man, t0 + minutes * MIN).bac;
    expect(widmark).toBeGreaterThan(0.05);
    expect(Math.abs(sim - widmark)).toBeLessThan(0.006);
  });

  it('erhält die Alkoholmasse: resorbiert + offen = konsumiert', () => {
    const drink = findDrink('cocktail');
    const ev = [makeDrinkEvent(drink, 6, 'test', t0)];
    const gross = ev[0].alcoholGrams * (1 - RESORPTION_DEFICIT);

    for (const minutes of [3, 15, 45, 120]) {
      const at = t0 + minutes * MIN;
      const est = estimateBac(ev, man, at, { beta: 0 });
      // Ohne Abbau muss bac + pending exakt der gesamten Menge entsprechen.
      expect(Math.abs(est.bac + est.pending - gross / volume), `${minutes} min`).toBeLessThan(0.004);
    }
  });
});

describe('Watson und Widmark', () => {
  it('reproduziert das Körperwasser aus der Originalformel', () => {
    // Watson 1980, Mann: 2.447 − 0.09516·Alter + 0.1074·Größe + 0.3362·Gewicht
    const p = { ...man, heightCm: 180 };
    const expected = 2.447 - 0.09516 * 30 + 0.1074 * 180 + 0.3362 * 80;
    expect(bodyWaterLiters(p)).toBeCloseTo(expected, 6);
    expect(expected).toBeGreaterThan(40);
    expect(expected).toBeLessThan(50);
  });

  it('reproduziert das Körperwasser für Frauen', () => {
    const p: Profile = { ...man, sex: 'female', weightKg: 62, heightCm: 168 };
    const expected = -2.097 + 0.1069 * 168 + 0.2466 * 62;
    expect(bodyWaterLiters(p)).toBeCloseTo(expected, 6);
  });

  it('liefert r-Werte im forensisch üblichen Korridor', () => {
    const cases: [Partial<Profile>, number, number][] = [
      [{ sex: 'male', weightKg: 80, heightCm: 180, age: 30 }, 0.65, 0.78],
      [{ sex: 'female', weightKg: 62, heightCm: 168, age: 28 }, 0.55, 0.7],
      [{ sex: 'male', weightKg: 110, heightCm: 178, age: 45 }, 0.5, 0.68],
    ];
    for (const [patch, lo, hi] of cases) {
      const { r } = widmarkFactor({ ...man, ...patch });
      expect(r, JSON.stringify(patch)).toBeGreaterThanOrEqual(lo);
      expect(r, JSON.stringify(patch)).toBeLessThanOrEqual(hi);
    }
  });

  it('gibt Übergewichtigen einen kleineren Verteilungsfaktor als Schlanken', () => {
    const schlank = widmarkFactor({ ...man, weightKg: 70, heightCm: 185 }).r;
    const kraeftig = widmarkFactor({ ...man, weightKg: 110, heightCm: 175 }).r;
    expect(kraeftig).toBeLessThan(schlank);
  });
});

describe('Plausibilität gegen bekannte Faustwerte', () => {
  const t0 = Date.UTC(2026, 0, 1, 20, 0, 0);

  it('ein halber Liter Bier bringt einen 80-kg-Mann auf rund 0,2 Promille', () => {
    const beer = findDrink('beer-helles');
    const glass = alcoholGrams(500, 5.2);
    expect(glass).toBeCloseTo(20.5, 0);
    const sips = Math.round(500 / beer.sipSizeMl);
    const ev = [makeDrinkEvent(beer, sips, 'test', t0)];
    let peak = 0;
    for (let m = 0; m <= 180; m += 5) peak = Math.max(peak, estimateBac(ev, man, t0 + m * MIN).bac);

    // Gaengige Promillerechner nennen hier 0,3 und meinen damit A/(r·m) ohne
    // jeden Abbau – also den theoretischen Wert im Moment des Trinkens. Real
    // laeuft der Abbau waehrend der Resorption mit, und 10 % erreichen das
    // Blut nie. Uebrig bleibt ein Maximum um 0,2, erreicht nach gut einer
    // halben Stunde. Das deckt sich mit Atemalkoholmessungen.
    expect(peak).toBeGreaterThan(0.16);
    expect(peak).toBeLessThan(0.28);
    const naiv = (glass / (0.68 * 80));
    expect(naiv).toBeCloseTo(0.377, 2);
  });

  it('erreicht das Maximum im Zeitfenster der Literatur', () => {
    const beer = findDrink('beer-helles');
    // Drei Bier innerhalb einer Stunde – der typische Partyfall.
    const ev = [0, 20, 40].map((m) => makeDrinkEvent(beer, 13, 'test', t0 + m * MIN));
    const last = t0 + 40 * MIN;

    for (const [stomach, loMin, hiMin] of [
      ['empty', 20, 60],
      ['light', 30, 75],
      ['full', 40, 100],
    ] as const) {
      const p: Profile = { ...man, stomach };
      let best = { bac: 0, at: t0 };
      for (let m = 0; m <= 300; m++) {
        const at = t0 + m * MIN;
        const bac = estimateBac(ev, p, at).bac;
        if (bac > best.bac) best = { bac, at };
      }
      const afterLast = (best.at - last) / MIN;
      expect(afterLast, `${stomach}: Maximum ${afterLast} min nach dem letzten Drink`)
        .toBeGreaterThanOrEqual(loMin);
      expect(afterLast, `${stomach}: Maximum ${afterLast} min nach dem letzten Drink`)
        .toBeLessThanOrEqual(hiMin);
    }
  });

  it('senkt den Peak, wenn vorher gegessen wurde', () => {
    const ev = [makeDrinkEvent(findDrink('beer-helles'), 13, 'test', t0)];
    const peakFor = (stomach: Profile['stomach']) => {
      let peak = 0;
      for (let m = 0; m <= 240; m += 2)
        peak = Math.max(peak, estimateBac(ev, { ...man, stomach }, t0 + m * MIN).bac);
      return peak;
    };
    expect(peakFor('empty')).toBeGreaterThan(peakFor('light'));
    expect(peakFor('light')).toBeGreaterThan(peakFor('full'));
  });

  it('zwei Gläser Wein bringen eine 60-kg-Frau in den Bereich der Fahruntüchtigkeit', () => {
    const woman: Profile = { ...man, sex: 'female', weightKg: 60 };
    const wine = findDrink('wine-red');
    const ev = [
      makeDrinkEvent(wine, 10, 'test', t0),
      makeDrinkEvent(wine, 10, 'test', t0 + 20 * MIN),
    ];
    let peak = 0;
    for (let m = 0; m <= 240; m += 5) peak = Math.max(peak, estimateBac(ev, woman, t0 + m * MIN).bac);
    expect(peak).toBeGreaterThan(0.5);
    expect(peak).toBeLessThan(1.0);
  });

  it('baut ungefähr die Literaturrate pro Stunde ab', () => {
    const beer = findDrink('beer-helles');
    const ev = [makeDrinkEvent(beer, 40, 'test', t0)];
    const a = estimateBac(ev, man, t0 + 3 * HOUR).bac;
    const b = estimateBac(ev, man, t0 + 4 * HOUR).bac;
    expect(a - b).toBeCloseTo(BETA_TYPICAL, 2);
  });
});

describe('Nüchternzeit', () => {
  const t0 = Date.UTC(2026, 0, 1, 22, 0, 0);

  it('ist tatsächlich nüchtern – und eine Viertelstunde vorher noch nicht', () => {
    const cases: [string, number][] = [
      ['beer-helles', 40],
      ['shot-schnaps', 12],
      ['wine-red', 30],
      ['cocktail-strong', 10],
    ];
    for (const [id, sips] of cases) {
      const ev = [makeDrinkEvent(findDrink(id), sips, 'test', t0)];
      const sober = soberAt(ev, man, t0);
      const safe = { beta: 0.1, resorptionDeficit: 0 };
      expect(estimateBac(ev, man, sober, safe).bac, id).toBeLessThanOrEqual(0.001);
      expect(estimateBac(ev, man, sober - 15 * MIN, safe).bac, id).toBeGreaterThan(0.001);
    }
  });

  it('hält auch, wenn spät noch viel dazukommt', () => {
    // Der schlimmste Fall fuer die Schaetzung: grosse Menge, voller Magen,
    // also langsame Resorption kurz vor dem Ende des Abends.
    const satt: Profile = { ...man, stomach: 'full' };
    const ev = [
      makeDrinkEvent(findDrink('shot-schnaps'), 10, 'test', t0),
      makeDrinkEvent(findDrink('shot-schnaps'), 8, 'test', t0 + 30 * MIN),
    ];
    const sober = soberAt(ev, satt, t0 + 35 * MIN);
    expect(estimateBac(ev, satt, sober, { beta: 0.1, resorptionDeficit: 0 }).bac).toBeLessThanOrEqual(
      0.001,
    );
  });

  it('ist konservativer als die Live-Anzeige', () => {
    const ev = [makeDrinkEvent(findDrink('beer-helles'), 30, 'test', t0)];
    const sober = soberAt(ev, man, t0);
    // Zur ausgewiesenen Nuechternzeit ist der realistische Wert laengst bei 0.
    expect(estimateBac(ev, man, sober).bac).toBe(0);
  });
});
