export interface GlassSim {
  tilt: number;
  surf: number;
  vel: number;
  level: number;
  pending: number;
  foam: number;
}

export function createSim(level: number, pending = 0): GlassSim {
  return { tilt: 0, surf: 0, vel: 0, level, pending, foam: 0.35 };
}

export function stepSim(
  s: GlassSim,
  dtSec: number,
  input: {
    target: number;
    levelGoal: number;
    pendingGoal: number;
    still: boolean;
  },
): void {
  const dt = Math.max(0, Math.min(0.033, dtSec));
  if (input.still) {
    s.tilt = input.target;
    s.surf = -s.tilt;
    s.vel = 0;
    s.level = input.levelGoal;
    s.pending = input.pendingGoal;
    s.foam = 0.35;
    return;
  }
  s.tilt += (input.target - s.tilt) * Math.min(1, dt * 9);
  // Kleine Teilschritte halten die Feder auch bei langsamen Bildern stabil.
  const steps = Math.max(1, Math.ceil(dt / 0.008));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    s.vel += (-70 * (s.surf + s.tilt) - 5 * s.vel) * h;
    s.surf += s.vel * h;
  }
  s.level += (input.levelGoal - s.level) * (1 - Math.exp(-2.2 * dt));
  s.pending += (input.pendingGoal - s.pending) * (1 - Math.exp(-2.2 * dt));
  s.foam = Math.max(0.35, s.foam - dt * 0.08);
}

export function splash(s: GlassSim, strength = 3.2): void {
  s.vel += strength;
  s.foam = 1;
}

export function fillFraction(bac: number, target: number): number {
  return Math.min(0.94, 0.08 + (Math.max(0, bac) / (target > 0 ? target : 0.4)) * 0.64);
}
