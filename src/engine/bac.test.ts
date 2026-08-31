import { describe, expect, it } from 'vitest';
import {
  alcoholGrams,
  bacZone,
  bodyWaterLiters,
  drivingLight,
  estimateBac,
  residualBac,
  soberAt,
  widmarkFactor,
} from './bac';
import { alcoholPerSip, createCustomDrink, DRINK_CATALOG, findDrink } from './drinks';
import { makeDrinkEvent, personalSips, sipsToTarget } from './sips';
import { ageGate } from './age';
import type { DrinkEvent, Profile } from './types';

const HOUR = 3_600_000;

const max: Profile = {
  name: 'Max',
  color: 'blue',
  age: 28,
  weightKg: 85,
  sex: 'male',
  stomach: 'light',
  targetBac: 0.4,
  alcoholFree: false,
  designatedDriver: false,
};
const lisa: Profile = { ...max, name: 'Lisa', weightKg: 60, sex: 'female', color: 'pink' };

describe('alcoholGrams', () => {
  it('rechnet 500 ml Bier mit 5 % in ~19.7 g reinen Alkohol um', () => {
    expect(alcoholGrams(500, 5)).toBeCloseTo(19.73, 1);
  });
  it('ist 0 für alkoholfreie Getränke', () => {
    expect(alcoholGrams(330, 0)).toBe(0);
  });
});

describe('widmarkFactor', () => {
  it('nutzt die Standardwerte ohne Körpergröße', () => {
    expect(widmarkFactor(max)).toEqual({ r: 0.68, source: 'standard' });
    expect(widmarkFactor(lisa)).toEqual({ r: 0.55, source: 'standard' });
  });
  it('leitet r aus dem Körperwasser ab, sobald die Größe bekannt ist', () => {
    const withHeight = { ...max, heightCm: 182 };
    const { r, source } = widmarkFactor(withHeight);
    expect(source).toBe('watson');
    expect(r).toBeGreaterThan(0.6);
    expect(r).toBeLessThan(0.85);
  });
  it('mittelt bei divers zwischen den Formeln', () => {
    const d = widmarkFactor({ ...max, sex: 'diverse', heightCm: 175 }).r;
    const m = widmarkFactor({ ...max, sex: 'male', heightCm: 175 }).r;
    const f = widmarkFactor({ ...max, sex: 'female', heightCm: 175 }).r;
    expect(d).toBeGreaterThan(f);
    expect(d).toBeLessThan(m);
  });
  it('ignoriert unplausible Körpergrößen', () => {
    expect(bodyWaterLiters({ ...max, heightCm: 40 })).toBeUndefined();
  });
});

describe('estimateBac', () => {
  const beer = findDrink('beer-helles');

  it('ist 0 ohne Konsum', () => {
    expect(estimateBac([], max).bac).toBe(0);
  });

  it('nähert sich nach voller Resorption dem Widmark-Wert an', () => {
    const t0 = Date.now();
    const ev: DrinkEvent[] = [makeDrinkEvent(beer, 12, 'test', t0)]; // ~15.2 g
    const after2h = estimateBac(ev, max, t0 + 2 * HOUR);
    const grams = ev[0].alcoholGrams * 0.9; // Resorptionsdefizit
    const widmark = grams / (0.68 * 85) - 0.15 * 2;
    expect(after2h.bac).toBeCloseTo(Math.max(0, widmark), 1);
  });

  it('zeigt direkt nach dem Trinken kaum Blutalkohol, aber offenen Nachschub', () => {
    const t0 = Date.now();
    const ev = [makeDrinkEvent(findDrink('shot-schnaps'), 2, 'test', t0)];
    const now = estimateBac(ev, max, t0 + 60_000);
    expect(now.bac).toBeLessThan(now.pending);
    expect(now.effective).toBeGreaterThan(now.bac);
  });

  it('baut den Pegel über die Zeit wieder ab', () => {
    const t0 = Date.now();
    const ev = [makeDrinkEvent(beer, 20, 'test', t0)];
    const peak = estimateBac(ev, max, t0 + 1 * HOUR).bac;
    const later = estimateBac(ev, max, t0 + 4 * HOUR).bac;
    expect(later).toBeLessThan(peak);
    expect(later).toBeGreaterThanOrEqual(0);
  });

  it('fällt nie unter null', () => {
    const t0 = Date.now();
    const ev = [makeDrinkEvent(beer, 2, 'test', t0)];
    expect(estimateBac(ev, max, t0 + 24 * HOUR).bac).toBe(0);
  });

  it('gibt leichteren Personen bei gleicher Menge mehr Promille', () => {
    const t0 = Date.now();
    const ev = [makeDrinkEvent(beer, 15, 'test', t0)];
    const a = estimateBac(ev, max, t0 + 90 * 60_000).bac;
    const b = estimateBac(ev, lisa, t0 + 90 * 60_000).bac;
    expect(b).toBeGreaterThan(a);
  });

  it('resorbiert auf vollem Magen langsamer', () => {
    const t0 = Date.now();
    const ev = [makeDrinkEvent(beer, 10, 'test', t0)];
    const empty = estimateBac(ev, { ...max, stomach: 'empty' }, t0 + 15 * 60_000).bac;
    const full = estimateBac(ev, { ...max, stomach: 'full' }, t0 + 15 * 60_000).bac;
    expect(empty).toBeGreaterThan(full);
  });
});

describe('Restalkohol', () => {
  const beer = findDrink('beer-helles');

  it('rechnet die Nüchternzeit konservativ (später als der Durchschnitt)', () => {
    const t0 = Date.now();
    const ev = [makeDrinkEvent(beer, 30, 'test', t0)];
    const sober = soberAt(ev, max, t0);
    const hours = (sober - t0) / HOUR;
    expect(hours).toBeGreaterThan(2);
    expect(hours).toBeLessThan(24);
    expect(estimateBac(ev, max, sober, { beta: 0.1, resorptionDeficit: 0 }).bac).toBeLessThan(0.01);
  });

  it('gibt bei null Konsum sofort nüchtern zurück', () => {
    const t0 = Date.now();
    expect(soberAt([], max, t0)).toBe(t0);
  });

  it('liefert für den Fahr-Check einen höheren Wert als die Live-Schätzung', () => {
    const t0 = Date.now();
    const ev = [makeDrinkEvent(beer, 25, 'test', t0)];
    const at = t0 + 6 * HOUR;
    expect(residualBac(ev, max, at)).toBeGreaterThan(estimateBac(ev, max, at).bac);
  });

  it('zeigt grün nur bei echten 0.0 Promille', () => {
    expect(drivingLight(0)).toBe('green');
    expect(drivingLight(0.1)).toBe('yellow');
    expect(drivingLight(0.45)).toBe('red');
  });
});

describe('bacZone', () => {
  it('trifft die Zonen', () => {
    expect(bacZone(0.05)).toBe('sober');
    expect(bacZone(0.2)).toBe('warmup');
    expect(bacZone(0.4)).toBe('sweet');
    expect(bacZone(0.7)).toBe('edge');
    expect(bacZone(1.2)).toBe('over');
  });
});

describe('personalSips', () => {
  const beer = findDrink('beer-pils');
  const cocktail = findDrink('cocktail');
  const shot = findDrink('shot-schnaps');

  it('gibt einem nüchternen Spieler Schlucke aus', () => {
    const res = personalSips({ profile: max, drink: beer, events: [], baseSips: 3 });
    expect(res.sips).toBeGreaterThan(0);
    expect(res.phase).toBe('reaching');
  });

  it('gibt beim gleichen Spielzug weniger vom stärkeren Getränk', () => {
    const withBeer = personalSips({ profile: lisa, drink: beer, events: [], baseSips: 3 }).sips;
    const withCocktail = personalSips({
      profile: lisa,
      drink: cocktail,
      events: [],
      baseSips: 3,
    }).sips;
    expect(withCocktail).toBeLessThan(withBeer);
  });

  it('gibt schwereren Spielern mehr als leichteren', () => {
    const heavy = personalSips({ profile: max, drink: beer, events: [], baseSips: 3 }).sips;
    const light = personalSips({ profile: lisa, drink: beer, events: [], baseSips: 3 }).sips;
    expect(heavy).toBeGreaterThan(light);
  });

  it('skaliert mit der Härte des Spielzugs', () => {
    const mild = personalSips({ profile: max, drink: beer, events: [], baseSips: 1 }).sips;
    const harsh = personalSips({ profile: max, drink: beer, events: [], baseSips: 6 }).sips;
    expect(harsh).toBeGreaterThan(mild);
  });

  it('setzt aus, sobald der Zielpegel erreicht ist', () => {
    const t0 = Date.now();
    const events = [makeDrinkEvent(beer, 40, 'test', t0 - 90 * 60_000)];
    const res = personalSips({ profile: lisa, drink: beer, events, baseSips: 3, now: t0 });
    expect(res.sips).toBe(0);
    expect(['maintaining', 'over']).toContain(res.phase);
  });

  it('legt nach einem frischen Shot nicht sofort nach', () => {
    const t0 = Date.now();
    const events = [makeDrinkEvent(shot, 3, 'test', t0 - 60_000)];
    const res = personalSips({ profile: lisa, drink: shot, events, baseSips: 3, now: t0 });
    expect(res.sips).toBe(0);
  });

  it('gibt einem designierten Fahrer nie Schlucke', () => {
    const res = personalSips({
      profile: { ...max, designatedDriver: true },
      drink: beer,
      events: [],
      baseSips: 6,
    });
    expect(res.sips).toBe(0);
    expect(res.phase).toBe('blocked');
    expect(res.hint).toMatch(/f[äa]hrst/i);
  });

  it('blockt bei alkoholfreiem Modus komplett', () => {
    const res = personalSips({
      profile: { ...max, alcoholFree: true },
      drink: beer,
      events: [],
      baseSips: 5,
    });
    expect(res.sips).toBe(0);
    expect(res.phase).toBe('blocked');
  });

  it('blockt unter 18', () => {
    const res = personalSips({ profile: { ...max, age: 17 }, drink: beer, events: [], baseSips: 3 });
    expect(res.phase).toBe('blocked');
  });

  it('reißt nie den harten Deckel', () => {
    const res = personalSips({ profile: lisa, drink: beer, events: [], baseSips: 40 });
    expect(res.sips).toBeLessThanOrEqual(6);
  });

  it('nennt Shots Shots', () => {
    const res = personalSips({ profile: max, drink: shot, events: [], baseSips: 3 });
    expect(res.unit).toMatch(/Shot/);
  });
});

describe('sipsToTarget', () => {
  it('sinkt, je näher der Spieler am Ziel ist', () => {
    const beer = findDrink('beer-pils');
    const t0 = Date.now();
    const start = sipsToTarget({ profile: max, drink: beer, events: [], now: t0 });
    const later = sipsToTarget({
      profile: max,
      drink: beer,
      events: [makeDrinkEvent(beer, 5, 'test', t0 - 30 * 60_000)],
      now: t0,
    });
    expect(later).toBeLessThan(start);
  });
});

describe('Getränke-Katalog', () => {
  it('hat für jedes Getränk plausible Werte', () => {
    for (const d of DRINK_CATALOG) {
      expect(d.sipSizeMl).toBeGreaterThan(0);
      expect(d.sipSizeMl).toBeLessThanOrEqual(d.defaultVolumeMl);
      expect(d.abvPercent).toBeGreaterThanOrEqual(0);
      expect(d.abvPercent).toBeLessThan(60);
      expect(alcoholPerSip(d)).toBeLessThan(10);
    }
  });
  it('hat eindeutige IDs', () => {
    const ids = DRINK_CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('baut Custom-Getränke mit sinnvoller Schluckgröße', () => {
    const gin = createCustomDrink({ name: 'Gin Tonic', volumeMl: 300, abvPercent: 10 });
    expect(gin.sipSizeMl).toBe(30);
    expect(gin.custom).toBe(true);
    const strong = createCustomDrink({ name: 'Absinth', volumeMl: 20, abvPercent: 55 });
    expect(strong.sipIsUnit).toBe(true);
  });
  it('deckelt unmögliche Eingaben', () => {
    const weird = createCustomDrink({ name: 'X', volumeMl: 99999, abvPercent: 999 });
    expect(weird.abvPercent).toBe(60);
    expect(weird.defaultVolumeMl).toBe(1000);
  });
});

describe('ageGate', () => {
  it('sperrt unter 16, schränkt 16-17 ein, gibt ab 18 frei', () => {
    expect(ageGate(15)).toBe('blocked');
    expect(ageGate(16)).toBe('restricted');
    expect(ageGate(17)).toBe('restricted');
    expect(ageGate(18)).toBe('full');
    expect(ageGate(NaN)).toBe('blocked');
  });
});
