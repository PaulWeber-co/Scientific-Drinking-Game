import { expect, it } from 'vitest';
import { DRINK_CATALOG } from '../../../engine/drinks';
import { STAGE, createSim, stepSim } from './glassPhysics';
import type { StreamParcel } from './glassPhysics';
import { GLASS_PROFILES, glassFor, liquidFor } from './glassShapes';
import { calm, run, glass, tiltInput } from './glassTestHelpers';

/** Gleiche Kipp-Rampe in allen Zerfallsszenen, einschließlich des ersten Ruhebilds. */
function outflowFrame(drinkId: string, degrees: number, seconds: number) {
  const s = glass(drinkId, 0.94);
  s.seed = 7;
  const dt = 1 / 120;
  for (let time = 0; time < seconds; time += dt) {
    stepSim(s, dt, tiltInput(Math.min(1, time / 0.8) * degrees));
  }
  return s;
}

function variation(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

const breakupScenes = [
  ['beer-pils', 55, 0.7],
  ['wine-red', 55, 0.7],
  ['beer-wheat', 80, 0.5],
  ['longdrink', 80, 0.5],
] as const;

for (const [drinkId, degrees, seconds] of breakupScenes) {
  it(`zerlegt ${drinkId} unregelmäßig mit Satelliten statt einer Perlenkette`, () => {
    const s = outflowFrame(drinkId, degrees, seconds);
    // Tischspritzer ohne Ketten-ID gehören nicht zum fliegenden Auslauf.
    const drops = s.drops.filter((d) => !d.foam && d.chain !== undefined).sort((a, b) => a.x - b.x);
    expect(new Set(drops.map((d) => d.chain)).size).toBe(1);
    expect(drops.length).toBeGreaterThanOrEqual(4);
    const radii = drops.map((d) => d.r);
    const gaps = drops.slice(1).map((d, i) => Math.hypot(d.x - drops[i].x, d.y - drops[i].y));
    expect.soft(variation(radii)).toBeGreaterThanOrEqual(0.25);
    expect.soft(variation(gaps)).toBeGreaterThanOrEqual(0.25);
    const satellites = drops.filter((d) => d.r < 0.3);
    expect(satellites.length).toBeGreaterThan(0);
    expect(satellites.length).toBeLessThan(drops.length / 2);
  });
}

for (const drinkId of ['beer-wheat', 'longdrink']) {
  it(`verjüngt bei ${drinkId} das dicke Band vor dem Abriss zu einem Hals`, () => {
    const s = outflowFrame(drinkId, 80, 0.9);
    const chain = s.stream.filter((p) => p.chain === s.stream.at(-1)!.chain);
    expect(chain.length).toBeGreaterThanOrEqual(3);
    const [tip, middle, upstream] = chain;
    expect(tip.width).toBeLessThan(middle.width);
    expect(middle.width).toBeLessThan(upstream.width);
    // Eine geringe Beschleunigungsverdünnung allein ist noch kein Hals.
    expect(tip.width / chain.at(-1)!.width).toBeLessThanOrEqual(0.3);
    const drops = s.drops.filter(
      (d) => !d.foam && d.chain === tip.chain && d.r >= 0.3 && d.x > tip.x,
    );
    const first = drops.sort(
      (a, b) => Math.hypot(a.x - tip.x, a.y - tip.y) - Math.hypot(b.x - tip.x, b.y - tip.y),
    )[0];
    expect(first).toBeDefined();
    // Beim Zerfall zählt das Band vor dem Hals; dicke Bänder bilden mehrere
    // Tropfen mit höchstens 4 px Radius. Der Abstand skaliert mit dem Band.
    expect(first.r).toBeLessThanOrEqual(4);
    expect(Math.hypot(first.x - tip.x, first.y - tip.y)).toBeLessThan(chain.at(-1)!.width * 4);
  });
}

const shapeDrinks = Object.keys(GLASS_PROFILES).map((shape) =>
  DRINK_CATALOG.find((drink) => glassFor(drink) === shape)!,
);

for (const drink of shapeDrinks) {
  const drinkId = drink.id;
  it(`bildet bei ${glassFor(drink)} nach einer Sekunde sichtbare Zerfallstropfen`, () => {
    const s = outflowFrame(drinkId, 55, 1);
    // Einschließlich Satelliten, ohne Schaum und sekundäre Tischspritzer.
    const drops = s.drops.filter((d) => !d.foam && d.chain !== undefined);
    expect(drops.length).toBeGreaterThan(0);
    const mean = drops.reduce((sum, d) => sum + d.r, 0) / drops.length;
    expect(mean).toBeGreaterThanOrEqual(0.7);
    for (const d of drops) {
      expect(d.r).toBeLessThanOrEqual(4);
      if (d.r >= 0.3) expect(d.r).toBeGreaterThanOrEqual(0.7);
    }
  });

  for (const degrees of [55, 80]) {
    it(`behält bei ${drinkId} und ${degrees} Grad sichtbare Bänder und begrenzte Tropfen`, () => {
      const s = glass(drinkId, 0.94);
      let parcels = 0;
      let drops = 0;
      let minWidth = Infinity;
      let maxRadius = 0;
      for (let n = 0; n < 216; n++) {
        stepSim(s, 1 / 120, tiltInput(Math.min(1, n / 96) * degrees));
        for (const p of s.stream) {
          minWidth = Math.min(minWidth, p.width);
          parcels++;
        }
        drops += s.drops.filter((d) => !d.foam).length;
        for (const d of s.drops.filter((d) => !d.foam && d.chain !== undefined)) {
          maxRadius = Math.max(maxRadius, d.r);
        }
      }
      expect(minWidth).toBeGreaterThanOrEqual(1);
      expect(maxRadius).toBeLessThanOrEqual(4);
      expect(parcels).toBeGreaterThan(100);
      expect(drops).toBeGreaterThan(100);
    });
  }
}

it('hält ein dünnes Band bis zum Abriss sichtbar und verfolgt die Tropfen bis zum Tisch', () => {
  const s = createSim(0);
  const p: StreamParcel = {
    x: 200,
    y: 60,
    vx: 500,
    vy: 0,
    q: 400,
    width: 0.8,
    chain: 1,
    side: 1,
    age: 0,
    distance: 0,
    duration: 1 / 120,
  };
  s.stream = [p];
  const input = { ...tiltInput(55), levelGoal: 0 };
  stepSim(s, 1 / 120, input);
  expect(s.stream).toContain(p);
  expect(p.width).toBeGreaterThanOrEqual(1);
  expect(s.drops).toHaveLength(0);
  let travelSteps = 0;
  while (s.stream.length && travelSteps++ < 120) {
    expect(s.stream.every((p) => p.width >= 1)).toBe(true);
    stepSim(s, 1 / 120, input);
  }
  expect(s.stream).toHaveLength(0);
  // q = 400 ergibt 58 px Zerfallsstrecke; kein Abriss durch Verdünnung.
  expect(p.distance).toBeGreaterThanOrEqual(58);
  expect(p.distance).toBeLessThan(110);
  expect(s.drops.length).toBeGreaterThan(0);
  const drop = s.drops[0];
  expect(drop.r).toBeGreaterThanOrEqual(0.7);
  let outside = false;
  let steps = 0;
  while (drop.y < STAGE.table && steps++ < 120) {
    expect(s.drops).toContain(drop);
    outside ||= drop.x > STAGE.width + 20;
    stepSim(s, 1 / 120, input);
  }
  expect(outside).toBe(true);
  expect(drop.y).toBeGreaterThanOrEqual(STAGE.table);
  expect(s.drops).not.toContain(drop);
  expect(s.puddles.length).toBeGreaterThan(0);
});

it('bemisst Zerfallstropfen am Band vor dem Hals', () => {
  const s = createSim(0);
  s.seed = 7;
  s.stream = [
    {
      x: 140,
      y: 60,
      vx: 200,
      vy: 0,
      q: 1600,
      width: 8,
      chain: 1,
      side: 1,
      age: 0,
      distance: 110,
      duration: 1 / 120,
    },
  ];
  stepSim(s, 1 / 120, { ...calm, levelGoal: 0, gravity: { x: 0, y: 0 } });
  const drops = s.drops.filter((d) => d.chain === 1 && d.r >= 0.3);
  expect(drops.length).toBeGreaterThan(0);
  // Vor dem Hals ist das Band 8 px breit: 8 * 0.25 ergibt mindestens 2 px.
  // Die verjüngte Spitze darf die primären Tropfen nicht verkleinern.
  for (const d of drops) expect(d.r).toBeGreaterThanOrEqual(2);
});

it('streckt die Abstände derselben Zerfallstropfen beim Fallen', () => {
  const s = outflowFrame('wine-red', 55, 0.7);
  const drops = s.drops.filter((d) => !d.foam && d.y < 150).sort((a, b) => a.x - b.x);
  const a = drops[0];
  const b = drops.at(-1)!;
  expect(drops.length).toBeGreaterThanOrEqual(8);
  const before = Math.hypot(a.x - b.x, a.y - b.y);
  stepSim(s, 1 / 120, tiltInput(55));
  expect(s.drops).toContain(a);
  expect(s.drops).toContain(b);
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(before);
});

it('hält auch bei maximalem Bildschritt die Bandgrenze und die Teilchenzahl ein', () => {
  for (const [drinkId, degrees] of breakupScenes) {
    const s = glass(drinkId, 0.94);
    let parcels = 0;
    let drops = 0;
    for (let n = 0; n < Math.ceil(1.2 / 0.033); n++) {
      stepSim(s, 0.033, tiltInput(Math.min(1, (n * 0.033) / 0.8) * degrees));
      expect(s.stream.length).toBeLessThanOrEqual(256);
      expect(s.drops.length).toBeLessThanOrEqual(512);
      expect(s.stream.every((p) => p.width >= 1)).toBe(true);
      parcels += s.stream.length;
      drops += s.drops.length;
    }
    expect(parcels).toBeGreaterThan(10);
    expect(drops).toBeGreaterThan(10);
  }
});

for (const drink of DRINK_CATALOG.filter(
  (drink) => drink.category === 'beer' && liquidFor(drink).foam,
)) {
  it(`beendet aufrechten Schaumüberlauf bei ${drink.id} dauerhaft`, () => {
    const s = glass(drink.id, 0.94);
    const input = tiltInput(0);
    const startsAbove =
      s.look.foamHeight * (0.7 + 1.1 * s.foamBoost) > s.profile.height * 0.06 + 3.5;
    let initial = 0;
    for (let n = 0; n < 360; n++) {
      stepSim(s, 1 / 120, input);
      initial += s.rivulets.filter((r) => r.foam && r.feeding).length;
    }
    const seen = new Set(s.rivulets);
    let feeding = 0;
    let created = 0;
    for (let n = 0; n < 3240; n++) {
      feeding += s.rivulets.filter((r) => r.foam && r.feeding).length;
      stepSim(s, 1 / 120, input);
      for (const r of s.rivulets.filter((r) => r.foam)) {
        if (!seen.has(r)) created++;
        seen.add(r);
      }
    }
    expect(initial > 0).toBe(startsAbove);
    expect(feeding).toBe(0);
    expect(created).toBe(0);
    expect(s.rivulets.some((r) => r.foam && r.feeding)).toBe(false);
  });
}

it('verwirft kopfüber entwichene Tropfen vor dem Zurückdrehen', () => {
  const s = outflowFrame('beer-pils', 55, 0.7);
  run(s, 5, { ...tiltInput(0), gravity: { x: 0, y: -0.5 } });
  expect(s.spilled).toBeGreaterThan(0);
  const spilled = s.spilled;
  run(s, 0.1, tiltInput(0));
  const aboveAfter = s.drops.filter((d) => d.y < 0).length;
  expect(aboveAfter).toBe(0);
  expect(s.spilled).toBeGreaterThanOrEqual(spilled);
});

it('verwirft alte Außentropfen, erhält aber den Flug zum Tisch und die Bilanz', () => {
  const s = createSim(0);
  s.spilled = 123;
  const rising = { x: 50, y: -1, vx: 0, vy: -50, r: 1, foam: false, age: 0, chain: 1 };
  const falling = { ...rising, x: STAGE.width + 40, y: 40, vy: 100 };
  const old = { ...falling, age: 2.01 };
  const visible = { ...old, x: 50 };
  s.drops = [rising, falling, old, visible];
  stepSim(s, 0.001, { ...calm, levelGoal: 0 });
  expect(s.drops).not.toContain(rising);
  expect(s.drops).not.toContain(old);
  expect(s.drops).toContain(falling);
  expect(s.drops).toContain(visible);
  expect(s.spilled).toBe(123);
});
