import { describe, expect, it } from 'vitest';
import { DRINK_CATALOG, findDrink } from '../../../engine/drinks';
import {
  COLUMNS,
  MODES,
  createSim,
  fillFraction,
  setGlass,
  splash,
  stepSim,
  surfaceAt,
  wallX,
} from './glassPhysics';
import type { GlassSim, SimInput } from './glassPhysics';
import { GLASS_PROFILES, glassFor, halfWidthAt, liquidFor } from './glassShapes';

const calm: SimInput = { levelGoal: 0.4, pendingGoal: 0, still: false, ambient: false };

function run(s: GlassSim, seconds: number, input: SimInput = calm) {
  for (let t = 0; t < seconds; t += 1 / 120) stepSim(s, 1 / 120, input);
}

function glass(drinkId: string, level: number) {
  const drink = findDrink(drinkId);
  return createSim(level, 0, glassFor(drink), liquidFor(drink));
}

/** Flüssigkeitsfläche im Glas, gerechnet wie die Physik selbst. */
function area(s: GlassSim) {
  let a = 0;
  for (let i = 0; i < COLUMNS; i++) a += Math.max(0, Math.min(s.surface[i], s.colHi[i]) - s.colLo[i]);
  return a;
}

describe('Glasphysik', () => {
  it('beruhigt sich nach dem Einschenken wieder', () => {
    const s = createSim(0.4);
    splash(s);
    run(s, 0.5);
    expect(Math.max(...s.vel.map(Math.abs))).toBeGreaterThan(1);
    run(s, 25);
    expect(Math.max(...s.vel.map(Math.abs))).toBeLessThan(0.5);
    expect(Math.max(...s.amp.map(Math.abs))).toBeLessThan(0.2);
  });

  it('schwappt mit der Frequenz eines echten Glases: ein Pint gut 3 Hz, ein Schnapsglas schneller, ein Weinkelch langsamer', () => {
    const hz = (s: GlassSim) => Math.sqrt(s.omega2[0]) / (2 * Math.PI);
    const pint = glass('beer-pils', 0.72);
    const shot = glass('shot-schnaps', 0.72);
    const wine = glass('wine-red', 0.72);
    expect(hz(pint)).toBeGreaterThan(2.6);
    expect(hz(pint)).toBeLessThan(3.8);
    expect(hz(shot)).toBeGreaterThan(hz(pint));
    expect(hz(wine)).toBeLessThan(hz(shot));
    // Eine flache Pfütze schwappt träger als ein volles Glas.
    expect(hz(glass('beer-pils', 0.08))).toBeLessThan(hz(pint));
  });

  it('legt die Oberfläche beim Kippen waagerecht zur Welt und hält dabei das Volumen', () => {
    const s = createSim(0.4);
    run(s, 0.1);
    const before = area(s);
    // Schwerkraft zeigt schräg nach rechts unten: rechts steigt die Flüssigkeit.
    const tilted = { ...calm, gravity: { x: Math.sin(0.3), y: Math.cos(0.3) } };
    run(s, 12, tilted);
    const x = wallX(s) - 4;
    const slope = (surfaceAt(s, x) - surfaceAt(s, -x)) / (2 * x);
    expect(slope).toBeCloseTo(Math.tan(0.3), 1);
    expect(area(s)).toBeCloseTo(before, -1);
  });

  it('lässt die Flüssigkeit beim Anschieben zurückbleiben', () => {
    const s = createSim(0.5);
    run(s, 0.2);
    for (let i = 0; i < 6; i++) stepSim(s, 1 / 60, { ...calm, levelGoal: 0.5, hold: 60 });
    // Das Glas fährt nach rechts, links steht die Flüssigkeit höher.
    expect(s.offset).toBeGreaterThan(10);
    expect(surfaceAt(s, -20)).toBeGreaterThan(surfaceAt(s, 20));
  });

  it('schwappt aus einem randvollen Glas über – als Tropfen oder außen am Glas herunter', () => {
    const s = createSim(0.94);
    run(s, 0.2, { ...calm, levelGoal: 0.94 });
    let spilled = false;
    for (let k = 0; k < 120 && !spilled; k++) {
      // Hin und her schieben wie ein ungeduldiger Tisch.
      stepSim(s, 1 / 60, { ...calm, levelGoal: 0.94, hold: k % 20 < 10 ? 60 : -60 });
      spilled = s.drops.length > 0 || s.rivulets.length > 0;
    }
    expect(spilled).toBe(true);
    run(s, 3, { ...calm, levelGoal: 0.94 });
    expect(s.puddles.length).toBeGreaterThan(0);
  });

  it('läuft bei halbvollem Glas und sanftem Kippen nicht über', () => {
    const s = createSim(0.5);
    run(s, 4, { ...calm, levelGoal: 0.5, gravity: { x: 0.2, y: 0.98 } });
    expect(s.drops).toHaveLength(0);
    expect(s.rivulets).toHaveLength(0);
  });

  it('lässt Eis oben schwimmen und bei fast leerem Glas am Grund liegen', () => {
    const full = glass('cocktail', 0.8);
    run(full, 3, { ...calm, levelGoal: 0.8 });
    expect(full.ice.length).toBeGreaterThan(0);
    for (const cube of full.ice) {
      const surface = surfaceAt(full, cube.x);
      // Knapp ein Zehntel ragt heraus.
      expect(cube.y + cube.size / 2).toBeGreaterThan(surface);
      expect(cube.y).toBeLessThan(surface);
    }
    const empty = glass('cocktail', 0.08);
    run(empty, 3, { ...calm, levelGoal: 0.08 });
    for (const cube of empty.ice) expect(cube.y).toBeLessThan(cube.size);
    for (const cube of empty.ice) {
      expect(Math.abs(cube.x)).toBeLessThanOrEqual(halfWidthAt(empty.profile, cube.y));
    }
  });

  it('lässt Perlen steigen und an der Oberfläche platzen', () => {
    const s = glass('sparkling', 0.7);
    run(s, 3, { ...calm, levelGoal: 0.7 });
    expect(s.bubbles.length).toBeGreaterThan(5);
    for (const b of s.bubbles) expect(b.y).toBeLessThan(surfaceAt(s, b.x));
    const still = glass('wine-red', 0.7);
    run(still, 3, { ...calm, levelGoal: 0.7 });
    expect(still.bubbles).toHaveLength(0);
  });

  it('wechselt das Glas mit dem Getränk und behält den Füllstand', () => {
    const s = createSim(0.6);
    const wine = DRINK_CATALOG.find((d) => d.id === 'wine-red')!;
    setGlass(s, glassFor(wine), liquidFor(wine));
    expect(s.profile).toBe(GLASS_PROFILES.wine);
    expect(s.level).toBe(0.6);
    run(s, 0.2, { ...calm, levelGoal: 0.6 });
    expect(s.center).toBeGreaterThan(0.4 * s.profile.height);
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
    run(s, 3, { ...calm, levelGoal: 0.3, pendingGoal: 0.1 });
    expect(s.pending).toBeCloseTo(0.1, 2);
    const a = createSim(0);
    const b = createSim(0);
    const input = { ...calm, levelGoal: 0.6, pendingGoal: 0.2 };
    stepSim(a, 100, input);
    stepSim(b, 0.033, input);
    expect(a).toEqual(b);
  });

  it('steht im Ruhebild still und waagerecht', () => {
    const s = createSim(0.5);
    splash(s);
    stepSim(s, 1 / 60, { levelGoal: 0.5, pendingGoal: 0, still: true, gravity: { x: 0.5, y: 0.8 } });
    expect(s.amp).toEqual(new Array(MODES).fill(0));
    expect(Math.max(...s.surface) - Math.min(...s.surface)).toBeLessThan(0.01);
  });
});

it('lässt die Füllung steigen, während die Magen-Schicht sinkt', () => {
  // So sieht ein Getränk aus, das ins Blut übergeht: der Blutanteil (level)
  // wächst, der Magenanteil (pending) schrumpft, oben bleibt es etwa gleich.
  const s = createSim(0.2, 0.3);
  run(s, 5, { ...calm, levelGoal: 0.45, pendingGoal: 0.05 });
  expect(s.level).toBeCloseTo(0.45, 2);
  expect(s.pending).toBeCloseTo(0.05, 2);
  expect(s.level + s.pending).toBeCloseTo(0.5, 2);
});
