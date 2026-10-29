import { describe, expect, it } from 'vitest';
import { createSim, fillFraction, splash, stepSim } from './glassPhysics';

describe('Glasphysik', () => {
  it.each([false, true])('beruhigt die Feder, still=%s', (still) => {
    const s = createSim(0.2);
    s.tilt = 0.4;
    s.surf = -0.2;
    splash(s);
    for (let i = 0; i < 360; i++)
      stepSim(s, 1 / 120, {
        target: 0,
        levelGoal: 0.4,
        pendingGoal: 0,
        still,
      });
    expect(Math.abs(s.surf + s.tilt)).toBeLessThan(0.01);
    expect(Math.abs(s.vel)).toBeLessThan(0.01);
  });
  it('füllt monoton und begrenzt', () => {
    let last = 0;
    for (let i = 0; i <= 200; i++) {
      const fraction = fillFraction(i / 100, 0.4);
      expect(fraction).toBeGreaterThanOrEqual(last);
      expect(fraction).toBeLessThanOrEqual(0.94);
      last = fraction;
    }
    expect(fillFraction(0, 0.4)).toBe(0.08);
    expect(fillFraction(0.4, 0.4)).toBeCloseTo(0.72);
    expect(fillFraction(0.2, 0)).toBe(fillFraction(0.2, 0.4));
  });
  it('senkt die schwebende Schicht und klemmt die Zeit', () => {
    const s = createSim(0.3, 0.4);
    for (let i = 0; i < 360; i++)
      stepSim(s, 1 / 120, {
        target: 0,
        levelGoal: 0.3,
        pendingGoal: 0.1,
        still: false,
      });
    expect(s.pending).toBeCloseTo(0.1, 2);
    const a = createSim(0);
    const b = createSim(0);
    const input = { target: 0.4, levelGoal: 0.6, pendingGoal: 0.2, still: false };
    stepSim(a, 100, input);
    stepSim(b, 0.033, input);
    expect(a).toEqual(b);
  });
});

it('lässt die Füllung steigen, während die Magen-Schicht sinkt', () => {
  // So sieht ein Getränk aus, das ins Blut übergeht: der Blutanteil (level)
  // wächst, der Magenanteil (pending) schrumpft, oben bleibt es etwa gleich.
  const s = createSim(0.2, 0.3);
  for (let i = 0; i < 600; i++)
    stepSim(s, 1 / 120, { target: 0, levelGoal: 0.45, pendingGoal: 0.05, still: false });
  expect(s.level).toBeCloseTo(0.45, 2);
  expect(s.pending).toBeCloseTo(0.05, 2);
  expect(s.level + s.pending).toBeCloseTo(0.5, 2);
});
