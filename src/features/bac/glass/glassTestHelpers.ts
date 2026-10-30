import { findDrink } from '../../../engine/drinks';
import { COLUMNS, createSim, stepSim, surfaceAt } from './glassPhysics';
import type { GlassSim, SimInput } from './glassPhysics';
import { GLASS_PROFILES, contourOf, glassFor, halfWidthAt, liquidFor } from './glassShapes';

export const calm: SimInput = { levelGoal: 0.4, pendingGoal: 0, still: false, ambient: false };

export function run(s: GlassSim, seconds: number, input: SimInput = calm) {
  for (let i = 0; i < Math.round(seconds * 120); i++) stepSim(s, 1 / 120, input);
}

/** Flüssigkeitsfläche im Glas, gerechnet wie die Physik selbst. */
export function area(s: GlassSim) {
  let a = 0;
  for (let i = 0; i < COLUMNS; i++)
    a += Math.max(0, Math.min(s.surface[i], s.colHi[i]) - s.colLo[i]);
  return a;
}

/** Nur echte freie Oberflächen zählen, weder trockener Boden noch volle Wand. */
export function angle(s: GlassSim) {
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

/** Feinere Messspalten und horizontale Profilschnitte statt Kern-Geometriedaten. */
export function measureArea(s: GlassSim) {
  const count = COLUMNS * 4;
  const half = Math.max(...contourOf(s.profile).map(([w]) => w));
  const dx = (2 * half) / count;
  const dy = s.profile.height / 2000;
  const widths = Array.from({ length: 2000 }, (_, i) => halfWidthAt(s.profile, (i + 0.5) * dy));
  const columns = Array.from({ length: count }, (_, i) => {
    const x = -half + (i + 0.5) * dx;
    const intervals: { lo: number; hi: number }[] = [];
    let start = -1;
    for (let j = 0; j <= widths.length; j++) {
      const inside = j < widths.length && widths[j] >= Math.abs(x);
      if (inside && start < 0) start = j;
      if (!inside && start >= 0) {
        intervals.push({ lo: start * dy, hi: j * dy });
        start = -1;
      }
    }
    return { x, intervals };
  });
  return () =>
    columns.reduce(
      (sum, { x, intervals }) =>
        sum +
        intervals.reduce(
          (value, { lo, hi }) => value + Math.max(0, Math.min(surfaceAt(s, x), hi) - lo) * dx,
          0,
        ),
      0,
    );
}

/** Fassung über horizontale Streifen: rechts der Schnittgeraden liegt Flüssigkeit. */
export function capacity(profile: (typeof GLASS_PROFILES)['pint'], degrees: number) {
  const dy = profile.height / 4000;
  const rim = halfWidthAt(profile, profile.height);
  const slope = Math.tan((degrees * Math.PI) / 180);
  let result = 0;
  for (let i = 0; i < 4000; i++) {
    const y = (i + 0.5) * dy;
    const w = halfWidthAt(profile, y);
    result += Math.max(0, Math.min(2 * w, w - rim + (profile.height - y) / slope)) * dy;
  }
  return result;
}

export function tiltInput(degrees: number): SimInput {
  const theta = (degrees * Math.PI) / 180;
  return { ...calm, levelGoal: 0.94, gravity: { x: Math.sin(theta), y: Math.cos(theta) } };
}

export function tiltSlowly(s: GlassSim, degrees: number, level = 0.94, from = 0) {
  const steps = Math.round((degrees - from) * 12);
  for (let i = 1; i <= steps; i++) {
    stepSim(s, 1 / 120, { ...tiltInput(from + i / 12), levelGoal: level });
  }
}

export function glass(drinkId: string, level: number) {
  const drink = findDrink(drinkId);
  return createSim(level, 0, glassFor(drink), liquidFor(drink));
}
