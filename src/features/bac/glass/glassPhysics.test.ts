import { describe, expect, it } from 'vitest';
import { DRINK_CATALOG, findDrink } from '../../../engine/drinks';
import {
  COLUMNS,
  GRAVITY,
  tap,
  createSim,
  fillFraction,
  setGlass,
  splash,
  stepSim,
  surfaceAt,
  wallX,
} from './glassPhysics';
import type { GlassSim, SimInput } from './glassPhysics';
import { GLASS_PROFILES, contourOf, glassFor, halfWidthAt, liquidFor } from './glassShapes';

const calm: SimInput = { levelGoal: 0.4, pendingGoal: 0, still: false, ambient: false };

function run(s: GlassSim, seconds: number, input: SimInput = calm) {
  for (let i = 0; i < Math.round(seconds * 120); i++) stepSim(s, 1 / 120, input);
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
    expect(Math.max(...s.surfaceVel.map(Math.abs))).toBeGreaterThan(1);
    run(s, 25);
    expect(Math.max(...s.surfaceVel.map(Math.abs))).toBeLessThan(0.5);
    expect(Math.max(...s.surface.map((y) => Math.abs(y - s.center)))).toBeLessThan(0.2);
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
    expect(s.surfaceVel).toEqual(new Array(COLUMNS).fill(0));
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


/** Nur echte freie Oberflächen zählen, weder trockener Boden noch volle Wand. */
function angle(s: GlassSim) {
  const wet = s.colX
    .map((x, i) => [x, s.surface[i], i])
    .filter(([, y, i]) => y > s.colLo[i] + 0.1 && y < s.colHi[i] - 0.1);
  const mx = wet.reduce((a, [x]) => a + x, 0) / wet.length;
  const my = wet.reduce((a, [, y]) => a + y, 0) / wet.length;
  return (
    (Math.atan(
      wet.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0) /
        wet.reduce((a, [x]) => a + (x - mx) ** 2, 0),
    ) *
      180) /
    Math.PI
  );
}

/** Unabhängige horizontale Streifenintegration der Profilfläche. */
function spillAngle(profile: (typeof GLASS_PROFILES)['pint']) {
  const dy = profile.height / 2000;
  let target = 0;
  for (let y = dy / 2; y < profile.height / 2; y += dy) target += 2 * halfWidthAt(profile, y) * dy;
  let lo = 0;
  let hi = Math.PI / 2;
  for (let n = 0; n < 40; n++) {
    const theta = (lo + hi) / 2;
    const slope = Math.tan(theta);
    const center = profile.height - slope * halfWidthAt(profile, profile.height);
    let volume = 0;
    for (let y = dy / 2; y < profile.height; y += dy) {
      const w = halfWidthAt(profile, y);
      volume += Math.max(0, Math.min(2 * w, w - (y - center) / slope)) * dy;
    }
    if (volume > target) lo = theta;
    else hi = theta;
  }
  return (((lo + hi) / 2) * 180) / Math.PI;
}

/** Feinere Messspalten und horizontale Profilschnitte statt Kern-Geometriedaten. */
function measureArea(s: GlassSim) {
  const count = COLUMNS * 4;
  const half = Math.max(...contourOf(s.profile).map(([w]) => w));
  const dx = (2 * half) / count;
  const dy = s.profile.height / 2000;
  const widths = Array.from({ length: 2000 }, (_, i) => halfWidthAt(s.profile, (i + 0.5) * dy));
  const columns = Array.from({ length: count }, (_, i) => {
    const x = -half + (i + 0.5) * dx;
    const inside = widths.map((w, j) => (w >= Math.abs(x) ? j : -1)).filter((j) => j >= 0);
    return { x, lo: inside[0] * dy, hi: (inside.at(-1)! + 1) * dy };
  });
  return () =>
    columns.reduce(
      (sum, { x, lo, hi }) => sum + Math.max(0, Math.min(surfaceAt(s, x), hi) - lo) * dx,
      0,
    );
}

for (const shape of Object.keys(GLASS_PROFILES) as (keyof typeof GLASS_PROFILES)[]) {
  describe(`Höhenfeld ${shape}`, () => {
    it('folgt der Neigung bis fünfundachtzig Grad', () => {
      const measured = [];
      for (const degrees of [15, 30, 45, 60, 75, 85]) {
        const s = createSim(0.5, 0, shape);
        const theta = (degrees * Math.PI) / 180;
        run(s, 4, { ...calm, levelGoal: 0.5, gravity: { x: Math.sin(theta), y: Math.cos(theta) } });
        measured.push(angle(s));
      }
      measured.forEach((value, i) =>
        expect(Math.abs(value - [15, 30, 45, 60, 75, 85][i])).toBeLessThanOrEqual(2),
      );
    });

    it('läuft am geometrisch berechneten Kippwinkel über', () => {
      const s = createSim(0.5, 0, shape, { ...liquidFor(findDrink('wine-red')), foam: false });
      const expected = spillAngle(s.profile);
      let first = NaN;
      for (let n = 0; n < (85 * 60) / 5; n++) {
        const degrees = (n * 5) / 60;
        const theta = (degrees * Math.PI) / 180;
        stepSim(s, 1 / 60, {
          ...calm,
          levelGoal: 0.5,
          gravity: { x: Math.sin(theta), y: Math.cos(theta) },
        });
        if (s.drops.length || s.rivulets.length) {
          first = degrees;
          break;
        }
      }
      expect(Math.abs(first - expected)).toBeLessThanOrEqual(3);
    });

    it('schwingt mit der Dispersionsfrequenz des Profils', () => {
      const s = createSim(0.5, 0, shape);
      const h = s.profile.height / 2;
      const width = 2 * halfWidthAt(s.profile, h);
      const k = Math.PI / width;
      const expected = Math.sqrt(GRAVITY * k * Math.tanh(k * h)) / (2 * Math.PI);
      // Kleine erste Eigenform, ohne Impuls beim Loslassen.
      s.surface = s.colX.map((x) => h + 0.3 * Math.sin((Math.PI * x) / width));
      const crossings: number[] = [];
      let previous = surfaceAt(s, width / 4) - surfaceAt(s, -width / 4);
      for (let n = 1; n <= 1200; n++) {
        stepSim(s, 1 / 240, { ...calm, levelGoal: 0.5 });
        const value = surfaceAt(s, width / 4) - surfaceAt(s, -width / 4);
        if (previous < 0 && value >= 0) crossings.push(n / 240);
        previous = value;
      }
      expect(crossings.length).toBeGreaterThanOrEqual(3);
      const measured = (crossings.length - 1) / (crossings.at(-1)! - crossings[0]);
      expect(Math.abs(measured / expected - 1)).toBeLessThanOrEqual(0.1);
    });

    it('hält die Fläche beim Schütteln ohne Überlauf', () => {
      const s = createSim(0.15, 0, shape);
      const measuredArea = measureArea(s);
      const before = measuredArea();
      let maxError = 0;
      for (let n = 0; n < 600; n++) {
        stepSim(s, 1 / 60, {
          ...calm,
          levelGoal: 0.15,
          gravity: { x: 0.5 * Math.sin((2 * Math.PI * 3 * n) / 60), y: 1 },
        });
        maxError = Math.max(maxError, Math.abs(measuredArea() / before - 1));
        expect(s.drops.length + s.rivulets.length).toBe(0);
      }
      expect(maxError).toBeLessThanOrEqual(0.01);
    });

    it('antwortet sichtbar auf Antippen', () => {
      const s = createSim(0.5, 0, shape);
      const x = s.width / 4;
      const rest = surfaceAt(s, x);
      tap(s, x);
      let peak = 0;
      for (let n = 0; n < 60; n++) {
        stepSim(s, 1 / 120, { ...calm, levelGoal: 0.5 });
        peak = Math.max(peak, Math.abs(surfaceAt(s, x) - rest));
      }
      expect(peak).toBeGreaterThanOrEqual(4);
    });

    it('regt sich durch vertikales Schütteln an', () => {
      const s = createSim(0.5, 0, shape);
      let peak = 0;
      for (let n = 0; n < 240; n++) {
        stepSim(s, 1 / 120, {
          ...calm,
          levelGoal: 0.5,
          ambient: true,
          gravity: { x: 0, y: 1 + 0.8 * Math.sin((2 * Math.PI * 4 * n) / 120) },
        });
        peak = Math.max(peak, Math.abs(angle(s)));
      }
      expect(peak).toBeGreaterThanOrEqual(2);
    });

    it('bilanziert den Fluss an jeder gemeinsamen Spaltengrenze', () => {
      const s = createSim(0.5, 0, shape);
      const dx = s.colX[1] - s.colX[0];
      const h = s.profile.height / 2;
      const k = Math.PI / (2 * halfWidthAt(s.profile, h));
      const depth = Math.tanh(k * h) / k;
      const initial = s.surface.slice();
      const mass = initial.map((y, i) => Math.max(0, Math.min(y, s.colHi[i]) - s.colLo[i]));
      const mobility = Array.from({ length: COLUMNS + 1 }, (_, i) => {
        if (i === 0 || i === COLUMNS) return 0;
        const bed = Math.max(s.colLo[i - 1], s.colLo[i]);
        const roof = Math.min(s.colHi[i - 1], s.colHi[i]);
        return Math.min(
          depth,
          Math.max(0, Math.min(roof, Math.max(initial[i - 1], initial[i])) - bed),
        );
      });
      const dt = 0.0002;
      stepSim(s, dt, { ...calm, levelGoal: 0.5, gravity: { x: 0.1, y: 1 } });
      for (let i = 0; i < COLUMNS; i++) {
        const actual = Math.max(0, Math.min(s.surface[i], s.colHi[i]) - s.colLo[i]);
        const expected =
          mass[i] + (dt / dx) * (mobility[i] * s.flow[i] - mobility[i + 1] * s.flow[i + 1]);
        expect(Math.abs(actual - expected)).toBeLessThan(1e-6);
      }
    });

    it('bleibt bei maximaler Schrittweite endlich und deterministisch', () => {
      const a = createSim(0.5, 0, shape);
      const b = createSim(0.5, 0, shape);
      tap(a, a.width / 4);
      tap(b, b.width / 4);
      for (let n = 0; n < 300; n++) {
        const theta = ((85 * Math.PI) / 180) * Math.sin(n / 30);
        const input = {
          ...calm,
          levelGoal: 0.5,
          ambient: true,
          gravity: {
            x: Math.sin(theta),
            y: Math.cos(theta) * (1 + 0.8 * Math.sin(n)),
          },
        };
        stepSim(a, 0.033, input);
        stepSim(b, 0.033, input);
        expect(a.surface.every(Number.isFinite)).toBe(true);
        expect(a.flow.every(Number.isFinite)).toBe(true);
      }
      expect(a).toEqual(b);
      run(a, 10, { ...calm, levelGoal: 0.5 });
      expect(Math.abs(angle(a))).toBeLessThan(2);
      const expectedArea = area(createSim(0.5, 0, shape));
      expect(Math.abs(area(a) / expectedArea - 1)).toBeLessThan(0.01);
      const seed = a.seed;
      stepSim(a, 0.033, { ...calm, still: true });
      expect(a.seed).toBe(seed);
      expect(a.surface.every((y) => y === a.surface[0])).toBe(true);
    });

    // Ein Bild hat bei 60 Hz 16 ms. Gemessen liegt ein Schritt allein bei
    // gut 0,5 ms, unter voller Testlast schwankt das um das Doppelte. Die
    // Grenze fängt einen Rückfall um ein Vielfaches, nicht die Zehntel.
    it('berechnet einen Schritt im Mittel unter vier Millisekunden', () => {
      const s = createSim(0.5, 0, shape);
      tap(s, s.width / 4);
      const start = performance.now();
      for (let n = 0; n < 600; n++)
        stepSim(s, 1 / 60, {
          ...calm,
          levelGoal: 0.5,
          ambient: true,
          gravity: { x: 0.5 * Math.sin((2 * Math.PI * 3 * n) / 60), y: 1 },
        });
      const ms = (performance.now() - start) / 600;
      expect(ms).toBeLessThan(4);
    });
  });
}

it('behält die Länge der wirksamen Schwerkraft bei vertikaler Beschleunigung', () => {
  const low = createSim(0.5);
  const high = createSim(0.5);
  tap(low, low.width / 4);
  tap(high, high.width / 4);
  stepSim(low, 1 / 60, { ...calm, levelGoal: 0.5, gravity: { x: 0, y: 0.2 } });
  stepSim(high, 1 / 60, { ...calm, levelGoal: 0.5, gravity: { x: 0, y: 1.8 } });
  expect(low.gy).toBeCloseTo(-0.2 * GRAVITY);
  expect(high.gy).toBeCloseTo(-1.8 * GRAVITY);
  expect(low.surface).not.toEqual(high.surface);
});

it('erzeugt in einem leeren Glas keine Flüssigkeit', () => {
  const s = createSim(0);
  run(s, 1, { ...calm, levelGoal: 0 });
  expect(area(s)).toBe(0);
});
