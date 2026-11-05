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
  toCanvas,
  rimHalfWidth,
  wallX,
} from './glassPhysics';
import { GLASS_PROFILES, glassFor, halfWidthAt, liquidFor } from './glassShapes';
import {
  calm,
  run,
  glass,
  area,
  angle,
  measureArea,
  capacity,
  tiltInput,
  tiltSlowly,
} from './glassTestHelpers';

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
      spilled = s.drops.length > 0 || s.rivulets.length > 0 || s.stream.length > 0;
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
    expect(s.stream).toHaveLength(0);
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
    stepSim(s, 1 / 60, {
      levelGoal: 0.5,
      pendingGoal: 0,
      still: true,
      gravity: { x: 0.5, y: 0.8 },
    });
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

it('behält die Länge der wirksamen Schwerkraft bei vertikaler Beschleunigung', () => {
  const low = createSim(0.5);
  const high = createSim(0.5);
  // Ein einzelner Beschleunigungswert nach aufrechter Ruhe ist keine flache Lage.
  run(low, 0.3, { ...calm, levelGoal: 0.5 });
  run(high, 0.3, { ...calm, levelGoal: 0.5 });
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

function fullArea(profile: (typeof GLASS_PROFILES)['pint']) {
  const dy = profile.height / 4000;
  let result = 0;
  for (let i = 0; i < 4000 * 0.94; i++) result += 2 * halfWidthAt(profile, (i + 0.5) * dy) * dy;
  return result;
}

for (const shape of Object.keys(GLASS_PROFILES) as (keyof typeof GLASS_PROFILES)[]) {
  describe(`Auslaufen ${shape}`, () => {
    it('steht bei flach liegendem Handy randvoll ohne neue Teilchen ruhig', () => {
      const s = createSim(0.94, 0, shape, { ...liquidFor(findDrink('wine-red')), foam: false });
      let emitted = 0;
      let peak = 0;
      for (let n = 0; n < 600; n++) {
        stepSim(s, 1 / 120, { ...tiltInput(0), gravity: { x: 0.03, y: 0.02 } });
        emitted += s.drops.length + s.stream.length + s.rivulets.length;
        peak = Math.max(peak, Math.abs(angle(s)));
      }
      expect(emitted).toBe(0);
      expect(s.lostArea).toBe(0);
      expect(peak).toBeLessThan(2);
    });

    for (const seconds of [0.3, 0.6]) {
      for (const table of [{ x: 0.017, y: 0 }, { x: 0.03, y: 0.02 }]) {
        it.each([false, true])(
          `bleibt beim Hinlegen in ${seconds} s auf ${table.x}/${table.y} g ruhig (Tischbewegung: %s)`,
          (ambient) => {
            const s = createSim(0.94, 0, shape, {
              ...liquidFor(findDrink('wine-red')),
              foam: false,
            });
            run(s, 0.5, tiltInput(0));
            const full = measureArea(s)();
            let peak = 0;
            // Neigung des Handys: 90° aufrecht → 0° flach, danach 1 s auf dem Tisch.
            const steps = Math.round(seconds * 120);
            for (let n = 1; n <= steps + 120; n++) {
              const theta = (Math.max(0, 1 - n / steps) * Math.PI) / 2;
              stepSim(s, 1 / 120, {
                ...tiltInput(0),
                ambient,
                gravity: {
                  x: table.x * Math.cos(theta),
                  y: Math.sin(theta) + table.y * Math.cos(theta),
                },
              });
              peak = Math.max(peak, Math.abs(angle(s)));
            }
            const measured = JSON.stringify({
              shape,
              seconds,
              table,
              ambient,
              peak,
              spilled: s.spilled,
            });
            // Beim Ablegen darf es kurz schwappen wie ein abgestelltes Glas. Ein
            // randvolles, schnell abgestelltes Glas verliert höchstens ein paar Tropfen.
            expect(peak, measured).toBeLessThan(12);
            expect(s.spilled, measured).toBeLessThan(full * 0.01);
          },
        );
      }
    }

    // Fassung bei 55 Grad und Nachfüllen teilen denselben Kippverlauf.
    // Die Bilanz bleibt als Messwerte erhalten, bevor das Nachfüllen fortsetzt.
    const tilted = new Map<number, ReturnType<typeof simulateTilt>>();
    function simulateTilt(degrees: number) {
      const s = createSim(0.94, 0, shape);
      const measured = measureArea(s);
      tiltSlowly(s, degrees);
      run(s, 3, tiltInput(degrees));
      const before = s.spilled;
      let emitted = 0;
      for (let i = 0; i < 120; i++) {
        const drops = new Set(s.drops);
        stepSim(s, 1 / 120, tiltInput(degrees));
        emitted += s.stream.filter((p) => p.age === 0).length;
        emitted += s.drops.filter((d) => !drops.has(d)).length;
      }
      return { s, actual: measured(), before, emitted, spilled: s.spilled, level: s.level };
    }
    function atTilt(degrees: number) {
      let result = tilted.get(degrees);
      if (!result) {
        result = simulateTilt(degrees);
        tilted.set(degrees, result);
      }
      return result;
    }

    for (const degrees of [30, 55, 80]) {
      it(`erreicht bei ${degrees} Grad die Fassung und stoppt bilanziert`, () => {
        const profile = GLASS_PROFILES[shape];
        const target = fullArea(profile);
        const expected = capacity(profile, degrees);
        if (expected >= target) return;
        const { actual, before, emitted, spilled, level } = atTilt(degrees);
        expect(Math.abs(actual / expected - 1)).toBeLessThanOrEqual(0.03);
        expect(emitted).toBe(0);
        expect(spilled - before).toBeLessThan(target * 0.005);
        expect(Math.abs(spilled / (target - actual) - 1)).toBeLessThanOrEqual(0.05);
        expect(level).toBe(0.94);
      });
    }

    it('füllt nach dem Auslaufen bei flach liegendem Handy wieder nach', () => {
      const s = structuredClone(atTilt(55).s);
      const measured = measureArea(s);
      const target = fullArea(s.profile);
      expect(s.lostArea).toBeGreaterThan(0);
      run(s, 3, { ...tiltInput(0), gravity: { x: 0.03, y: 0.02 } });
      const error = Math.abs(measured() / target - 1);
      expect(error).toBeLessThanOrEqual(0.01);
    });

    it('füllt erst aufrecht nach einer Pause ruhig wieder nach', () => {
      const s = atTilt(55).s;
      const measured = measureArea(s);
      const target = fullArea(s.profile);
      const lost = s.lostArea;
      run(s, 1, tiltInput(30));
      expect(s.lostArea).toBeGreaterThanOrEqual(lost * 0.999);
      run(s, 0.5, tiltInput(0));
      const paused = measured();
      expect(s.lostArea).toBeGreaterThanOrEqual(lost * 0.999);
      expect(paused).toBeLessThan(target * 0.95);
      run(s, 2.5, tiltInput(0));
      const filled = measured();
      expect(Math.abs(filled / target - 1)).toBeLessThanOrEqual(0.01);
      run(s, 0.5, tiltInput(0));
      expect(Math.abs(angle(s))).toBeLessThan(1);
    });

    it('bildet ein dünner werdendes Band mit Tropfen und löst es von der Lippe', () => {
      const s = createSim(0.94, 0, shape);
      // Gleichmäßiges Ankippen hält den Fluss bis zum Messpunkt bei einer Sekunde.
      for (let i = 1; i <= 120; i++) stepSim(s, 1 / 120, tiltInput((55 * i) / 120));
      expect(s.stream?.length ?? 0).toBeGreaterThan(2);
      const chain = s.stream.filter((p) => p.chain === s.stream.at(-1)!.chain);
      expect(chain.length).toBeGreaterThan(2);
      for (let i = 1; i < chain.length; i++) {
        const a = chain[i - 1];
        const b = chain[i];
        const ratio = Math.hypot(a.x - b.x, a.y - b.y) / (2 * Math.max(a.width, b.width));
        expect(ratio).toBeLessThan(1);
      }
      // Array-Reihenfolge: unten/alt zuerst, oben/jung zuletzt.
      expect(chain[0].width).toBeLessThan(chain.at(-1)!.width);
      expect(s.drops.some((d) => !d.foam && d.y > chain.at(-1)!.y)).toBe(true);
      // Die Quelle wird waagerecht und ohne Welle beendet; das freie Band bleibt.
      s.surface.fill(0.94 * s.profile.height);
      s.flow.fill(0);
      const youngest = chain.at(-1)!;
      const start = { x: youngest.x, y: youngest.y };
      stepSim(s, 1 / 120, tiltInput(0));
      expect(Math.hypot(youngest.x - start.x, youngest.y - start.y)).toBeGreaterThan(0.1);
      expect(youngest.age).toBeGreaterThan(0);
      run(s, 0.3 - 1 / 120, tiltInput(0));
      let nearLip = 0;
      for (const side of [-1, 1]) {
        const lip = toCanvas(
          s,
          side * (rimHalfWidth(s.profile) + s.profile.wall),
          s.profile.height,
        );
        nearLip += s.stream.filter((p) => Math.hypot(p.x - lip.x, p.y - lip.y) < 3).length;
      }
      expect(nearLip).toBe(0);
    });

    it('erhält die Schwerkraftrichtung bei Strahl und Tropfen auch über Kopf', () => {
      for (const degrees of [80, 120]) {
        const s = createSim(0.1, 0, shape);
        const p = {
          ...toCanvas(s, 0, s.profile.height),
          vx: 100,
          vy: 100,
          q: 10000,
          width: 16,
          chain: 1,
          side: 1 as const,
          age: 0,
          distance: 0,
          duration: 1 / 120,
        };
        const drop = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, r: 1, foam: false, age: 0 };
        s.stream = [p];
        s.drops = [drop];
        const input = { ...tiltInput(degrees), levelGoal: 0.1 };
        const dt = 0.001;
        stepSim(s, dt, input);
        const expectedX = 100 + input.gravity!.x * GRAVITY * dt;
        const expectedY = 100 + input.gravity!.y * GRAVITY * dt;
        expect(p.vx).toBeCloseTo(expectedX, 8);
        expect(p.vy).toBeCloseTo(expectedY, 8);
        expect(drop.vx).toBeCloseTo(expectedX, 8);
        expect(drop.vy).toBeCloseTo(expectedY, 8);
      }
    });

    it('leert einen aktiven Strahl beim Ruhebild und beim Glaswechsel', () => {
      const s = createSim(0.94, 0, shape);
      for (let i = 1; i <= 120; i++) stepSim(s, 1 / 120, tiltInput((55 * i) / 120));
      expect(s.stream?.length ?? 0).toBeGreaterThan(0);
      const seed = s.seed;
      stepSim(s, 1 / 120, { ...tiltInput(55), still: true });
      expect(s.stream).toHaveLength(0);
      expect(s.seed).toBe(seed);
      expect(s.spilled).toBe(0);
      for (let i = 1; i <= 120; i++) stepSim(s, 1 / 120, tiltInput((55 * i) / 120));
      expect(s.stream?.length ?? 0).toBeGreaterThan(0);
      setGlass(s, shape, s.look);
      expect(s.stream).toHaveLength(0);
      expect(s.spilled).toBe(0);
    });
  });
}
