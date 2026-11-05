import { describe, expect, it } from 'vitest';
import { findDrink } from '../../../engine/drinks';
import { COLUMNS, GRAVITY, tap, createSim, stepSim, surfaceAt } from './glassPhysics';
import { GLASS_PROFILES, halfWidthAt, liquidFor } from './glassShapes';
import { calm, run, area, angle, measureArea, capacity, tiltSlowly } from './glassTestHelpers';

/** Unabhängige horizontale Streifenintegration der Profilfläche. */
function spillAngle(profile: (typeof GLASS_PROFILES)['pint']) {
  const dy = profile.height / 2000;
  let target = 0;
  for (let y = dy / 2; y < profile.height / 2; y += dy) target += 2 * halfWidthAt(profile, y) * dy;
  const strips = [];
  for (let y = dy / 2; y < profile.height; y += dy) {
    strips.push({ y, width: halfWidthAt(profile, y) });
  }
  let lo = 0;
  let hi = Math.PI / 2;
  for (let n = 0; n < 40; n++) {
    const theta = (lo + hi) / 2;
    const slope = Math.tan(theta);
    const center = profile.height - slope * halfWidthAt(profile, profile.height);
    let volume = 0;
    for (const { y, width: w } of strips) {
      volume += Math.max(0, Math.min(2 * w, w - (y - center) / slope)) * dy;
    }
    if (volume > target) lo = theta;
    else hi = theta;
  }
  return (((lo + hi) / 2) * 180) / Math.PI;
}

for (const shape of Object.keys(GLASS_PROFILES) as (keyof typeof GLASS_PROFILES)[]) {
  describe(`Höhenfeld ${shape}`, () => {
    it('folgt der Neigung bis fünfundachtzig Grad', () => {
      const measured = [];
      const s = createSim(0.5, 0, shape);
      let previous = 0;
      for (const degrees of [15, 30, 45, 60, 75, 85]) {
        const theta = (degrees * Math.PI) / 180;
        // Bei echtem Mengenverlust kann ein schlagartiger Sprung das Glas leeren.
        // Langsames Kippen lässt eine messbare freie Oberfläche zurück.
        tiltSlowly(s, degrees, 0.5, previous);
        previous = degrees;
        run(s, 4, { ...calm, levelGoal: 0.5, gravity: { x: Math.sin(theta), y: Math.cos(theta) } });
        if (capacity(s.profile, degrees) === 0) {
          // Bei nach außen geneigten Wänden kann die Fassung exakt null sein.
          // Eine leere Innenkontur hat keine messbare freie Oberfläche.
          expect(area(s)).toBeLessThan(1e-5);
          expect(s.spilled).toBeGreaterThan(0);
        } else {
          measured.push({ degrees, value: angle(s) });
        }
      }
      measured.forEach(({ degrees, value }) =>
        expect(Math.abs(value - degrees)).toBeLessThanOrEqual(2),
      );
    });

    it('folgt der Neigung auch bei schräg nach hinten gehaltenem Handy', () => {
      // Nach hinten geneigt liegt nur ein Teil der Schwerkraft in der Bildebene.
      for (const length of [0.5, 0.7]) {
        const s = createSim(0.5, 0, shape);
        const theta = (30 * Math.PI) / 180;
        for (let n = 1; n <= 60; n++) {
          const t = (theta * n) / 60;
          stepSim(s, 1 / 120, {
            ...calm,
            levelGoal: 0.5,
            gravity: { x: length * Math.sin(t), y: length * Math.cos(t) },
          });
        }
        run(s, 4, {
          ...calm,
          levelGoal: 0.5,
          gravity: { x: length * Math.sin(theta), y: length * Math.cos(theta) },
        });
        expect(Math.abs(angle(s) - 30), `${shape} ${length} g`).toBeLessThanOrEqual(2);
      }
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
        if (s.drops.length || s.rivulets.length || s.stream.length) {
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
        expect(s.drops.length + s.rivulets.length + s.stream.length).toBe(0);
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
