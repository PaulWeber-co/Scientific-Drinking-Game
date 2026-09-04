import { describe, expect, it } from 'vitest';
import { estimateBac } from './bac';
import { OVER_DANGER_BAC, OVER_PAUSE_BAC, OVER_STOP_BAC } from './constants';
import { DRINK_CATALOG, findDrink } from './drinks';
import { overTargetCall, personalSips } from './sips';
import type { BacEstimate, DrinkEvent, Profile } from './types';

const paul: Profile = {
  name: 'Paul',
  color: 'blue',
  age: 30,
  weightKg: 82,
  sex: 'male',
  stomach: 'light',
  targetBac: 0.4,
  alcoholFree: false,
  designatedDriver: false,
};
const beer = findDrink('beer-pils');
const NOW = 1_700_000_000_000;

/** Ein Ereignis vor `minutesAgo` Minuten, so dosiert, dass `effective` jetzt ~`bac` ist. */
function eventFor(bac: number, minutesAgo: number): DrinkEvent {
  const at = NOW - minutesAgo * 60_000;
  let lo = 0;
  let hi = 600;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const ev = { id: 'x', at, drinkId: 'beer-pils', drinkName: 'Bier', sips: 1, alcoholGrams: mid };
    if (estimateBac([ev], paul, NOW).effective < bac) lo = mid;
    else hi = mid;
  }
  return { id: 'x', at, drinkId: 'beer-pils', drinkName: 'Bier', sips: 1, alcoholGrams: hi };
}

const est = (effective: number, pending = 0): BacEstimate => ({
  bac: effective - pending,
  pending,
  effective,
  totalAlcoholGrams: 0,
  r: 0.68,
  rSource: 'standard',
});

describe('Ansagen über dem Ziel', () => {
  it('sagt auf fünf Pegelstufen mindestens drei verschiedene Dinge', () => {
    const hints = [0.66, 0.87, 1.2, 1.53, 2.1].map((bac) =>
      personalSips({
        profile: paul,
        drink: beer,
        events: [eventFor(bac, 90)],
        baseSips: 3,
        now: NOW,
      }),
    );
    expect(hints.every((h) => h.sips === 0 && h.phase === 'over')).toBe(true);
    expect(hints.map((h) => h.severity)).toEqual(['water', 'pause', 'stop', 'stop', 'danger']);
    expect(new Set(hints.map((h) => h.hint)).size).toBeGreaterThanOrEqual(3);
    expect(hints.map((h) => h.hint)).not.toContain(
      'Du bist über deinem Pegel. Diese Runde: Wasser.',
    );
  });

  it('bleibt knapp über dem Ziel bei „Pegel sitzt“', () => {
    const r = personalSips({
      profile: paul,
      drink: beer,
      events: [eventFor(0.5, 90)],
      baseSips: 3,
      now: NOW,
    });
    expect(r.phase).toBe('maintaining');
    expect(r.severity).toBeUndefined();
  });

  it('stuft an den Wirkungsschwellen um', () => {
    expect(overTargetCall(est(OVER_PAUSE_BAC - 0.01), 0.6).severity).toBe('water');
    expect(overTargetCall(est(OVER_PAUSE_BAC), 0.6).severity).toBe('pause');
    expect(overTargetCall(est(OVER_STOP_BAC), 0.6).severity).toBe('stop');
    expect(overTargetCall(est(OVER_DANGER_BAC), 0.6).severity).toBe('danger');
  });

  it('nennt die Zeit bis zurück am Ziel, und sie wächst mit dem Abstand', () => {
    const minutes = (effective: number) => {
      const hint = overTargetCall(est(effective), 0.4).hint;
      const h = Number(hint.match(/(\d+) Stunden?/)?.[1] ?? 0);
      const m = Number(hint.match(/(\d+) Minuten/)?.[1] ?? 0);
      return h * 60 + m;
    };
    expect(minutes(0.6)).toBeGreaterThan(0);
    expect(minutes(0.7)).toBeGreaterThan(minutes(0.6));
    // 0,3 ‰ Abstand bei 0,15 ‰/h Abbau sind zwei Stunden.
    expect(minutes(0.7)).toBe(120);
    expect(overTargetCall(est(0.7), 0.4).hint).toMatch(/2 Stunden/);
    expect(overTargetCall(est(0.6), 0.4).hint).toMatch(/1 Stunde 20 Minuten/);
  });

  it('sagt dazu, wenn der Pegel noch steigt', () => {
    const falling = overTargetCall(est(0.65, 0), 0.4).hint;
    const rising = overTargetCall(est(0.65, 0.1), 0.4).hint;
    expect(rising).not.toBe(falling);
    expect(rising).toMatch(/kommt noch was nach/);
    expect(falling).not.toMatch(/kommt noch was nach/);
  });

  it('nennt in der Gefahr-Stufe die Erste-Hilfe-Regel', () => {
    expect(overTargetCall(est(2.2), 0.4).hint).toMatch(/112/);
    expect(overTargetCall(est(2.2), 0.4).hint).toMatch(/Seitenlage/);
  });
});

describe('Härte 0', () => {
  it('ergibt für jedes Getränk 0 Schluck, auch nüchtern', () => {
    for (const drink of DRINK_CATALOG.filter((d) => d.abvPercent > 0)) {
      const r = personalSips({ profile: paul, drink, events: [], baseSips: 0, now: NOW });
      expect(r.sips, drink.id).toBe(0);
    }
  });

  it('lässt die Shot-Ausnahme bei Härte 1 weiter greifen', () => {
    // Härte 1 begrenzt auf ~1,9 g, ein Shot hat 6,3 g: die Rundung allein
    // ergäbe 0 – erst die Ausnahme macht daraus den einen Shot.
    const shot = findDrink('shot-schnaps');
    const r = personalSips({ profile: paul, drink: shot, events: [], baseSips: 1, now: NOW });
    expect(r.sips).toBe(1);
  });
});
