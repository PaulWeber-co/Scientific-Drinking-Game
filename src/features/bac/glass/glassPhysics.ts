import { GLASS_PROFILES, contourOf, halfWidthAt, liquidFor } from './glassShapes';
import type { GlassProfile, GlassShape, Liquid } from './glassShapes';
import { DRINK_CATALOG } from '../../../engine/drinks';

/**
 * Höhenfeld im Glasrahmen: x nach rechts, y ab Innenboden nach oben, in px.
 * Benachbarte Spalten tauschen Flüssigkeit über gerichtete Impulsflüsse aus.
 * Die hydraulische Tiefe begrenzt die Wellengeschwindigkeit im tiefen Glas.
 */

export const PX_PER_M = 1300;
/** Erdbeschleunigung in px/s². */
export const GRAVITY = 9.81 * PX_PER_M;
/** Stützstellen quer durchs Glas für Volumen, Zeichnen und Überlauf. */
export const COLUMNS = 56;
/** Höchste Füllung (Anteil der Innenhöhe). */
const MAX_FILL = 0.94;

export interface Bubble {
  x: number;
  y: number;
  r: number;
  age: number;
  sway: number;
}
/** Fliegender Tropfen in Bildschirmkoordinaten des Zeichenbereichs (y nach unten). */
export interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  foam: boolean;
}
/** Rinnsal außen am Glas, vom Rand abwärts. */
export interface Rivulet {
  side: -1 | 1;
  /** Kopf, als Abstand unter dem Rand in px. */
  head: number;
  /** Ende oben; steigt, wenn kein Nachschub kommt. */
  tail: number;
  width: number;
  feeding: boolean;
  foam: boolean;
  age: number;
}
export interface Puddle {
  x: number;
  r: number;
  age: number;
  foam: boolean;
}
export interface IceCube {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: number;
}
interface Site {
  x: number;
  timer: number;
}

export interface GlassSim {
  shape: GlassShape;
  profile: GlassProfile;
  look: Liquid;
  /** Füllung als Anteil der Innenhöhe: im Blut und noch im Magen. */
  level: number;
  pending: number;
  /** Geschwindigkeit an den Zellgrenzen, positive Richtung nach rechts. */
  flow: number[];
  /** Optisch verlorene Fläche / Spaltenbreite; der externe Pegel speist nach. */
  lostArea: number;
  /** Fläche / Spaltenbreite am Rand, im nächsten Druckschritt lokal entnommen. */
  outflow: number[];
  /** Mittlere Höhe der Oberfläche, aus dem Volumen bestimmt. */
  center: number;
  /** Oberfläche an den Stützstellen; außerhalb benetzter Abschnitte der Druckkopf. */
  surface: number[];
  /** Senkrechte Geschwindigkeit der Oberfläche an den Stützstellen. */
  surfaceVel: number[];
  /** Lage der Stützstellen und Innenkontur je Spalte. */
  colX: number[];
  colLo: number[];
  colHi: number[];
  /** Ruhebreite der freien Oberfläche. */
  width: number;
  /** Glas: seitlicher Versatz (Finger), Tempo, Beschleunigung und Neigung. */
  offset: number;
  offsetVel: number;
  offsetAcc: number;
  tilt: number;
  /** Wirksame Schwerkraft relativ zum Glas, y nach oben, in px/s². */
  gx: number;
  gy: number;
  /** Zusätzliche Schaumhöhe nach dem Einschenken, 0…1. */
  foamBoost: number;
  /** Höchster benetzter Stand an der linken und rechten Wand. */
  wetLeft: number;
  wetRight: number;
  /** Restzeit und Stelle des Einschenkstrahls. */
  pour: number;
  pourX: number;
  bubbles: Bubble[];
  sites: Site[];
  drops: Drop[];
  rivulets: Rivulet[];
  puddles: Puddle[];
  ice: IceCube[];
  time: number;
  bumpIn: number;
  seed: number;
}

/** Kleiner deterministischer Zufall, damit Tests und Standbilder stabil sind. */
function random(s: GlassSim): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss(s: GlassSim): number {
  return (random(s) + random(s) + random(s) - 1.5) * 2;
}

export function fillFraction(bac: number, target: number): number {
  return Math.min(MAX_FILL, 0.08 + (Math.max(0, bac) / (target > 0 ? target : 0.4)) * 0.64);
}

const PINT_LOOK = liquidFor(DRINK_CATALOG[0]);

export function createSim(
  level: number,
  pending = 0,
  shape: GlassShape = 'pint',
  look: Liquid = PINT_LOOK,
): GlassSim {
  const s: GlassSim = {
    shape,
    profile: GLASS_PROFILES[shape],
    look,
    level,
    pending,
    flow: new Array(COLUMNS + 1).fill(0),
    lostArea: 0,
    outflow: new Array(COLUMNS).fill(0),
    center: 0,
    surface: new Array(COLUMNS).fill(0),
    surfaceVel: new Array(COLUMNS).fill(0),
    colX: [],
    colLo: [],
    colHi: [],
    width: 0,
    offset: 0,
    offsetVel: 0,
    offsetAcc: 0,
    tilt: 0,
    gx: 0,
    gy: -GRAVITY,
    foamBoost: 0.35,
    wetLeft: 0,
    wetRight: 0,
    pour: 0,
    pourX: 0,
    bubbles: [],
    sites: [],
    drops: [],
    rivulets: [],
    puddles: [],
    ice: [],
    time: 0,
    bumpIn: 4,
    seed: 7,
  };
  setGlass(s, shape, look);
  return s;
}

/** Anderes Getränk, anderes Glas: Kontur neu vermessen, Inhalt neu einsetzen. */
export function setGlass(s: GlassSim, shape: GlassShape, look: Liquid): void {
  s.shape = shape;
  s.profile = GLASS_PROFILES[shape];
  s.look = look;
  const { profile } = s;
  const contour = contourOf(profile);
  const maxHalf = Math.max(...contour.map(([w]) => w));
  s.colX = [];
  s.colLo = [];
  s.colHi = [];
  for (let i = 0; i < COLUMNS; i++) {
    const x = -maxHalf + ((i + 0.5) * 2 * maxHalf) / COLUMNS;
    s.colX.push(x);
    // Wo diese Spalte innen beginnt und endet: bei bauchigen Gläsern liegt
    // der Rand der Spalte nicht oben, sondern dort, wo der Kelch einzieht.
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = 1; j < contour.length; j++) {
      const [w0, y0] = contour[j - 1];
      const [w1, y1] = contour[j];
      const ax = Math.abs(x);
      if (w0 < ax && w1 < ax) continue;
      const crossing = w0 === w1 ? y0 : y0 + ((ax - w0) / (w1 - w0)) * (y1 - y0);
      lo = Math.min(lo, w0 >= ax ? y0 : crossing);
      hi = Math.max(hi, w1 >= ax ? y1 : crossing);
    }
    if (lo === Infinity) {
      lo = profile.height;
      hi = profile.height;
    }
    s.colLo.push(lo);
    s.colHi.push(hi);
  }
  s.width = 0;
  s.flow.fill(0);
  s.bubbles = [];
  s.drops = [];
  s.rivulets = [];
  s.puddles = [];
  s.wetLeft = 0;
  s.wetRight = 0;
  // Keimstellen der Perlen: feste Kratzer im Boden, nicht jedes Mal woanders.
  const floor = halfWidthAt(profile, 2) * 0.8;
  const count = look.bubbles > 0 ? (look.fineBead ? 6 : 5) : 0;
  s.sites = Array.from({ length: count }, (_, i) => ({
    x: -floor + ((i + 0.5) * 2 * floor) / count + (random(s) - 0.5) * 4,
    timer: random(s),
  }));
  s.ice = [];
  const size = shape === 'highball' ? 21 : shape === 'spritz' ? 23 : 26;
  for (let i = 0; i < look.ice; i++) {
    s.ice.push({
      x: (i - (look.ice - 1) / 2) * size * 0.9,
      y: size / 2 + i * 4,
      vx: 0,
      vy: 0,
      angle: (random(s) - 0.5) * 0.5,
      spin: 0,
      size: size * (0.9 + random(s) * 0.15),
    });
  }
  resetSurface(s);
  settleIce(s);
}

/** Fläche im Schnitt; die gemeinsame Spaltenbreite kürzt sich heraus. */
function areaBelow(s: GlassSim, h: number): number {
  let area = 0;
  for (let i = 0; i < COLUMNS; i++) area += Math.max(0, Math.min(h, s.colHi[i]) - s.colLo[i]);
  return area;
}

function resetSurface(s: GlassSim): void {
  s.center = (s.level + s.pending) * s.profile.height;
  s.width = 2 * halfWidthAt(s.profile, s.center);
  s.surface.fill(s.center);
  s.surfaceVel.fill(0);
  s.flow.fill(0);
  s.lostArea = 0;
  s.outflow.fill(0);
}

/**
 * Semiimplizite Massen- und Impulsbilanz auf einem versetzten Gitter.
 * Die Speicherkurve einer Spalte ist an Boden und geschlossener Kelchwand
 * begrenzt. Darüber steht die Höhe für den Druckkopf, nicht für mehr Masse.
 * Der tridiagonale Druckschritt erhält die lokalen Flüsse auch dort, wo
 * eine volle Spalte keine zusätzliche Flüssigkeit aufnehmen kann.
 */
function stepField(s: GlassSim, dt: number, ambient: boolean): void {
  const rest = Math.max(1, (s.level + s.pending) * s.profile.height);
  s.width = 2 * halfWidthAt(s.profile, rest);
  const dx = s.colX[1] - s.colX[0];
  const k = Math.PI / s.width;
  // Im tiefen Wasser beteiligt sich nur noch eine Tiefe von ungefähr 1/k.
  const depth = Math.tanh(k * rest) / k;
  const axial = s.gy < 0 ? -s.gy : 0.025 * GRAVITY;
  const frequency = Math.sqrt(axial * k * Math.tanh(k * rest));
  const before = s.surface.slice();
  s.lostArea *= Math.exp(-8 * dt);
  const target = Math.max(0, areaBelow(s, (s.level + s.pending) * s.profile.height) - s.lostArea);
  const velocity = s.flow;
  if (target > 0 && s.surface.every((y, i) => y <= s.colLo[i])) {
    s.surface.fill((s.level + s.pending) * s.profile.height);
  }
  if (ambient) {
    // Eine kleine gerichtete Störung bricht die Symmetrie für parametrische Wellen.
    const kick = gauss(s) * Math.sqrt(dt) * 35;
    for (let i = 1; i < COLUMNS; i++)
      velocity[i] += kick * Math.cos((Math.PI * s.colX[i]) / s.width);
  }
  const steps = Math.max(
    1,
    Math.ceil(
      dt /
        Math.min(
          0.001,
          (0.35 * dx) /
            (Math.sqrt(axial * depth) +
              Math.sqrt(Math.abs(s.gx) * s.width) +
              Math.max(...velocity.map(Math.abs))),
        ),
    ),
  );
  const h = dt / steps;
  const mobility = new Float64Array(COLUMNS + 1);
  const predicted = new Float64Array(COLUMNS + 1);
  const mass = new Float64Array(COLUMNS);
  const rhs = new Float64Array(COLUMNS);
  const upper = new Float64Array(COLUMNS);
  const solved = new Float64Array(COLUMNS);
  const original = new Float64Array(COLUMNS);
  const amount = (i: number) => Math.max(0, Math.min(s.surface[i], s.colHi[i]) - s.colLo[i]);
  for (let n = 0; n < steps; n++) {
    let total = 0;
    let free = 0;
    for (let i = 0; i < COLUMNS; i++) {
      mass[i] = amount(i);
      total += mass[i];
      if (s.surface[i] > s.colLo[i] && s.surface[i] < s.colHi[i]) free++;
    }
    // Externe Pegeländerungen und optischer Nachfluss sind explizite Quellen.
    const drained = n === 0 ? s.outflow.reduce((sum, value) => sum + value, 0) : 0;
    const supply = (target - total + drained) / Math.max(1, free);
    for (let i = 1; i < COLUMNS; i++) {
      const bed = Math.max(s.colLo[i - 1], s.colLo[i]);
      const roof = Math.min(s.colHi[i - 1], s.colHi[i]);
      const wet = Math.max(0, Math.min(roof, Math.max(s.surface[i - 1], s.surface[i])) - bed);
      mobility[i] = Math.min(depth, wet);
      const u = velocity[i];
      const gradient = u >= 0 ? (u - velocity[i - 1]) / dx : (velocity[i + 1] - u) / dx;
      const drag = 2 * s.look.damping * frequency + Math.abs(u) / Math.max(12, s.width);
      predicted[i] = (u + h * (s.gx - u * gradient)) / (1 + h * drag);
    }
    for (let i = 0; i < COLUMNS; i++) {
      const source = s.surface[i] > s.colLo[i] && s.surface[i] < s.colHi[i] ? supply : 0;
      rhs[i] =
        mass[i] +
        source -
        (n === 0 ? s.outflow[i] : 0) -
        (h / dx) * (mobility[i + 1] * predicted[i + 1] - mobility[i] * predicted[i]);
    }
    const scale = (h * h * axial) / (dx * dx);
    const energy = () => {
      let value = 0;
      for (let i = 0; i < COLUMNS; i++) {
        const height = s.surface[i] - s.colLo[i];
        const capacity = s.colHi[i] - s.colLo[i];
        const wet = Math.max(0, Math.min(height, capacity));
        value +=
          0.5 * wet * wet + capacity * Math.max(0, height - capacity) - rhs[i] * s.surface[i];
        if (i > 0) value += 0.5 * scale * mobility[i] * (s.surface[i] - s.surface[i - 1]) ** 2;
      }
      return value;
    };
    // Gedämpftes Newton verhindert Sprünge über mehrere Boden-/Wandkontakte.
    for (let iteration = 0; iteration < 40; iteration++) {
      let residual = 0;
      for (let i = 0; i < COLUMNS; i++) {
        original[i] = s.surface[i];
        const left = scale * mobility[i];
        const right = scale * mobility[i + 1];
        const capacity = s.surface[i] > s.colLo[i] && s.surface[i] < s.colHi[i] ? 1 : 0;
        const diagonal = capacity + left + right + 1e-8;
        const value =
          rhs[i] -
          amount(i) -
          (i > 0 ? left * (s.surface[i] - s.surface[i - 1]) : 0) -
          (i + 1 < COLUMNS ? right * (s.surface[i] - s.surface[i + 1]) : 0);
        residual = Math.max(residual, Math.abs(value));
        const divisor = diagonal + (i > 0 ? left * upper[i - 1] : 0);
        upper[i] = -right / divisor;
        solved[i] = (value + (i > 0 ? left * solved[i - 1] : 0)) / divisor;
      }
      if (residual < 1e-8) break;
      for (let i = COLUMNS - 2; i >= 0; i--) solved[i] -= upper[i] * solved[i + 1];
      const initialEnergy = energy();
      let fraction = Math.min(1, (2 * s.profile.height) / Math.max(1, ...solved.map(Math.abs)));
      for (let attempt = 0; attempt < 24; attempt++) {
        for (let i = 0; i < COLUMNS; i++) s.surface[i] = original[i] + fraction * solved[i];
        if (energy() <= initialEnergy + 1e-8) break;
        fraction *= 0.5;
      }
    }
    for (let i = 1; i < COLUMNS; i++) {
      velocity[i] =
        mobility[i] > 0 ? predicted[i] - (h * axial * (s.surface[i] - s.surface[i - 1])) / dx : 0;
    }
    // Isolierte trockene Druckköpfe tragen keine Masse und brauchen kein Gedächtnis.
    for (let i = 0; i < COLUMNS; i++) {
      if (mobility[i] === 0 && mobility[i + 1] === 0 && amount(i) === 0) {
        s.surface[i] = Math.min(s.colLo[i], rest + (s.gx / axial) * s.colX[i]);
      }
    }
  }
  s.outflow.fill(0);
  s.center = sample(s, s.surface, 0);
  for (let i = 0; i < COLUMNS; i++) s.surfaceVel[i] = dt > 0 ? (s.surface[i] - before[i]) / dt : 0;
}

/** Oberfläche an beliebiger Stelle, zwischen den Stützstellen linear. */
export function surfaceAt(s: GlassSim, x: number): number {
  return sample(s, s.surface, x);
}

function sample(s: GlassSim, values: number[], x: number): number {
  const xs = s.colX;
  if (x <= xs[0]) return values[0];
  if (x >= xs[COLUMNS - 1]) return values[COLUMNS - 1];
  const step = xs[1] - xs[0];
  const f = (x - xs[0]) / step;
  const i = Math.floor(f);
  const t = f - i;
  return values[i] * (1 - t) + values[i + 1] * t;
}

/** Wo die Oberfläche die Wand berührt (halbe Breite, knapp innen). */
export function wallX(s: GlassSim): number {
  const h = Math.max(0, Math.min(s.profile.height, s.center));
  return Math.max(1, halfWidthAt(s.profile, h) - 1);
}

/** Neigung der Oberfläche an der Stelle x. */
function surfaceSlopeAt(s: GlassSim, x: number): number {
  return (surfaceAt(s, x + 2) - surfaceAt(s, x - 2)) / 4;
}

export interface SimInput {
  levelGoal: number;
  pendingGoal: number;
  still: boolean;
  /**
   * Richtung der Schwerkraft auf dem Bildschirm (x rechts, y unten) in
   * Einheiten von g, samt Beschleunigung des Handys. Ohne Sensor: null.
   */
  gravity?: { x: number; y: number } | null;
  /** Wohin der Finger das Glas zieht (px); null, wenn niemand zieht. */
  hold?: number | null;
  /** Leises Leben am Tisch (Zittern, Stöße). Aus nur für Messungen. */
  ambient?: boolean;
}

export function stepSim(s: GlassSim, dtSec: number, input: SimInput): void {
  const dt = Math.max(0, Math.min(0.033, dtSec));
  if (input.still) {
    s.level = input.levelGoal;
    s.pending = input.pendingGoal;
    s.flow.fill(0);
    s.offset = 0;
    s.offsetVel = 0;
    s.offsetAcc = 0;
    s.tilt = 0;
    s.gx = 0;
    s.gy = -GRAVITY;
    s.pour = 0;
    s.drops = [];
    s.rivulets = [];
    resetSurface(s);
    settleIce(s);
    return;
  }
  s.time += dt;
  // Füllstand gleitet: ein neues Getränk läuft ein, Abbau sinkt langsam.
  s.level += (input.levelGoal - s.level) * (1 - Math.exp(-2.2 * dt));
  s.pending += (input.pendingGoal - s.pending) * (1 - Math.exp(-2.2 * dt));

  // --- Das Glas selbst: dem Finger folgen oder zurück in die Mitte gleiten.
  const holding = input.hold !== null && input.hold !== undefined;
  const k = holding ? 900 : 46;
  const c = 2 * Math.sqrt(k) * (holding ? 0.9 : 0.85);
  const goal = holding ? (input.hold as number) : 0;
  s.offsetAcc = k * (goal - s.offset) - c * s.offsetVel;
  s.offsetVel += s.offsetAcc * dt;
  s.offset += s.offsetVel * dt;
  // Wer ein Glas trägt, kippt es leicht gegen die Laufrichtung.
  const tiltGoal = Math.max(-0.2, Math.min(0.2, -s.offsetVel * 0.00022));
  s.tilt += (tiltGoal - s.tilt) * (1 - Math.exp(-10 * dt));

  // --- Wirksame Schwerkraft relativ zum Glas.
  const down = input.gravity ?? { x: 0, y: 1 };
  const pull = Math.min(3, Math.hypot(down.x, down.y));
  const norm = Math.hypot(down.x, down.y) || 1;
  // Bildschirm (y unten) minus Scheinkraft des Fingers, dann ins Glas gedreht.
  const sx = (down.x / norm) * pull * GRAVITY - s.offsetAcc;
  const sy = (down.y / norm) * pull * GRAVITY;
  const cos = Math.cos(-s.tilt);
  const sin = Math.sin(-s.tilt);
  const lx = cos * sx - sin * sy;
  const ly = sin * sx + cos * sy;
  s.gx = lx;
  s.gy = -ly;
  // Kopfüber bleibt die Rechnung auf eine kleine axiale Restkraft begrenzt.
  const gScale = s.gy < 0 ? -s.gy / GRAVITY : 0.025;
  if (s.pour > 0) {
    s.pour = Math.max(0, s.pour - dt);
    const index = Math.max(1, Math.min(COLUMNS - 1, Math.round((s.pourX - s.colX[0]) / (s.colX[1] - s.colX[0]))));
    s.flow[index] += gauss(s) * 150 * dt;
  }
  const ambient = input.ambient !== false;
  if (ambient && !input.gravity && !holding) {
    s.bumpIn -= dt;
    if (s.bumpIn <= 0) {
      s.bumpIn = 5 + random(s) * 9;
      const kick = (random(s) < 0.5 ? -1 : 1) * (30 + random(s) * 45);
      for (let i = 1; i < COLUMNS; i++) s.flow[i] += kick * Math.cos(Math.PI * s.colX[i] / s.width);
    }
  }
  stepField(s, dt, ambient);

  overflow(s, dt);
  wetWalls(s, dt);
  stepFoam(s, dt);
  stepBubbles(s, dt);
  stepIce(s, dt, gScale);
  stepDrops(s, dt, input.gravity ?? { x: 0, y: 1 });
}

/** Oberfläche am Rand in Höhe des Randes, links und rechts. */
export function rimHalfWidth(profile: GlassProfile): number {
  return halfWidthAt(profile, profile.height);
}

/**
 * Was über den Rand steigt, verlässt das Glas.
 *
 * Knapp darüber und langsam: es läuft außen am Glas herunter – Flüssigkeit
 * haftet an der Wand (Teekanneneffekt). Deutlich darüber oder mit Schwung:
 * es fliegt als Tropfen. Der übergelaufene Wellenberg fehlt danach, die
 * Schwingung verliert also Energie.
 */
function overflow(s: GlassSim, dt: number): void {
  const { profile } = s;
  const rim = rimHalfWidth(profile);
  for (const side of [-1, 1] as const) {
    const x = side * (rim - 1);
    const y = surfaceAt(s, x);
    const over = y - profile.height;
    const rising = sample(s, s.surfaceVel, x);
    let feeding = false;
    if (over > 0.4) {
      // Ausfluss über eine Kante: v ≈ √(2·g·h).
      const speed = Math.sqrt(2 * Math.hypot(s.gx, s.gy) * over * 0.6);
      const fling = over > 3 || Math.abs(rising) > 120 || Math.abs(s.offsetVel) > 160;
      if (fling) {
        const count = Math.min(4, Math.ceil(over * dt * 30 + random(s) * 1.2));
        for (let k = 0; k < count; k++) emitDrop(s, side, speed, rising);
      } else {
        feeding = true;
      }
      // Der austretende Impuls fehlt der nächsten Welle; der Pegel bleibt extern vorgegeben.
      const dx = s.colX[1] - s.colX[0];
      const index = Math.max(0, Math.min(COLUMNS - 1, Math.round((x - s.colX[0]) / dx)));
      const available = Math.max(0, Math.min(s.surface[index], s.colHi[index]) - s.colLo[index]);
      // Optischer Abfluss bleibt klein: der von außen vorgegebene Pegel soll
      // beim Nachspeisen keine starke Gegenströmung zum Rand erzeugen.
      const budget = areaBelow(s, (s.level + s.pending) * profile.height) * dt * 0.01;
      const loss = Math.min(available * 0.2, speed * over * dt / dx, budget);

      s.lostArea += loss;
      s.outflow[index] += loss;
      const face = side < 0 ? index + 1 : index;
      s.flow[face] *= Math.exp(-dt * 7 * Math.min(1, over / 5));
    }
    // Schaum steigt zuerst über: er ist leicht und steht über dem Wasser.
    const foamTop = y + foamHeight(s);
    const foamOver = s.look.foam ? foamTop - profile.height - 3 : 0;
    const foamFeeding = foamOver > 0.5 && s.look.foamHeight > 4;
    if (foamFeeding) s.foamBoost = Math.max(0, s.foamBoost - dt * 0.05 * foamOver);
    feedRivulet(s, side, feeding, false, over, dt);
    if (s.look.foam && s.look.foamHeight > 4) feedRivulet(s, side, foamFeeding, true, foamOver, dt);
  }
  for (const r of s.rivulets) {
    r.age += dt;
    const length = outerLength(s);
    // Ein Rinnsal läuft zäh die Wand hinab, Schaum noch langsamer.
    if (r.head < length) r.head = Math.min(length, r.head + dt * (r.foam ? 26 : 70));
    if (!r.feeding) r.tail += dt * (r.foam ? 14 : 40);
    if (r.head >= length && !r.foam && r.age % 0.4 < dt) {
      addPuddle(s, side2x(s, r.side), 1.2, false);
    }
  }
  s.rivulets = s.rivulets.filter((r) => r.tail < r.head || r.feeding);
}

function feedRivulet(s: GlassSim, side: -1 | 1, feeding: boolean, foam: boolean, amount: number, dt: number) {
  let r = s.rivulets.find((v) => v.side === side && v.foam === foam && v.feeding);
  if (feeding) {
    if (!r) {
      if (s.rivulets.length > 6) return;
      r = { side, head: 0, tail: 0, width: foam ? 3.5 : 2.2, feeding: true, foam, age: 0 };
      s.rivulets.push(r);
    }
    r.width = Math.min(foam ? 6 : 3.4, r.width + amount * dt * (foam ? 1.2 : 0.8));
  } else if (r) {
    r.feeding = false;
  }
}

/** Länge der Außenwand vom Rand bis zum Tisch. */
export function outerLength(s: GlassSim): number {
  return s.profile.height + s.profile.base;
}

function side2x(s: GlassSim, side: -1 | 1): number {
  const { profile } = s;
  const bottom = profile.stem ? (profile.foot ?? 30) : profile.points[0][0] + profile.wall;
  return side * (bottom + 2);
}

function emitDrop(s: GlassSim, side: -1 | 1, speed: number, rising: number) {
  if (s.drops.length > 90) return;
  const { profile } = s;
  const rim = rimHalfWidth(profile) + profile.wall;
  const local = { x: side * rim, y: profile.height + 1 };
  const out = Math.min(520, speed * (0.7 + random(s) * 0.6));
  const up = Math.max(-80, Math.min(420, rising * 0.6 + random(s) * 60));
  // In den Zeichenbereich: Glas gedreht und versetzt, y nach unten.
  const p = toCanvas(s, local.x, local.y);
  const cos = Math.cos(s.tilt);
  const sin = Math.sin(s.tilt);
  const vxl = side * out;
  const vyl = -up;
  s.drops.push({
    x: p.x,
    y: p.y,
    vx: cos * vxl - sin * vyl + s.offsetVel,
    vy: sin * vxl + cos * vyl,
    r: 1 + random(s) * 1.8,
    foam: false,
  });
}

/** Lage des Glasbodens im Zeichenbereich. */
export const STAGE = { width: 280, height: 270, centerX: 140, table: 248 };

/** Unterkante des Innenraums über dem Tisch. */
export function innerLift(profile: GlassProfile): number {
  return (profile.stem ? profile.stem + 3 : 0) + profile.base;
}

/** Punkt im Glas (y nach oben ab Innenboden) → Zeichenbereich (y nach unten). */
export function toCanvas(s: GlassSim, x: number, y: number): { x: number; y: number } {
  const ly = -(innerLift(s.profile) + y);
  const cos = Math.cos(s.tilt);
  const sin = Math.sin(s.tilt);
  return {
    x: STAGE.centerX + s.offset + cos * x - sin * ly,
    y: STAGE.table + sin * x + cos * ly,
  };
}

function addPuddle(s: GlassSim, x: number, amount: number, foam: boolean) {
  const near = s.puddles.find((p) => Math.abs(p.x - x) < p.r + 6 && p.foam === foam);
  if (near) {
    near.r = Math.min(46, Math.sqrt(near.r * near.r + amount * 9));
    near.age = Math.min(near.age, 0.5);
    return;
  }
  if (s.puddles.length > 10) s.puddles.shift();
  s.puddles.push({ x, r: 2 + amount, age: 0, foam });
}

function stepDrops(s: GlassSim, dt: number, down: { x: number; y: number }) {
  const gx = down.x * GRAVITY;
  const gy = Math.max(0.3, down.y) * GRAVITY;
  const kept: Drop[] = [];
  for (const d of s.drops) {
    d.vx += gx * dt;
    d.vy += gy * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.y >= STAGE.table) {
      addPuddle(s, d.x, d.r, d.foam);
      // Aufprall: ein, zwei winzige Spritzer, die gleich wieder liegen.
      if (d.r > 1.6 && s.drops.length < 90) {
        kept.push({ x: d.x, y: STAGE.table - 1, vx: (random(s) - 0.5) * 160, vy: -120 - random(s) * 120, r: 0.7, foam: d.foam });
      }
      continue;
    }
    if (d.x < -20 || d.x > STAGE.width + 20 || d.y < -60) continue;
    kept.push(d);
  }
  s.drops = kept;
  for (const p of s.puddles) p.age += dt;
  s.puddles = s.puddles.filter((p) => p.age < 6);
}

/** Wo die Flüssigkeit an der Wand war, bleibt ein Film, der langsam abläuft. */
function wetWalls(s: GlassSim, dt: number) {
  const x = wallX(s);
  const left = surfaceAt(s, -x);
  const right = surfaceAt(s, x);
  // Wein läuft in Tränen ab (wenige px pro Sekunde), Wasser fast sofort.
  const drain = s.look.film > 0 ? 3 + (1 - s.look.film) * 10 : 60;
  s.wetLeft = Math.max(left, s.wetLeft - drain * dt);
  s.wetRight = Math.max(right, s.wetRight - drain * dt);
  s.wetLeft = Math.min(s.wetLeft, s.profile.height);
  s.wetRight = Math.min(s.wetRight, s.profile.height);
}

/** Höhe der Schaumkrone in px. */
export function foamHeight(s: GlassSim): number {
  if (!s.look.foam) return 0;
  return s.look.foamHeight * (0.7 + 1.1 * s.foamBoost);
}

function stepFoam(s: GlassSim, dt: number) {
  // Bierschaum fällt in Minuten zusammen; hier reicht eine halbe Minute.
  s.foamBoost = Math.max(0.25, s.foamBoost - dt * 0.025);
}

function stepBubbles(s: GlassSim, dt: number) {
  const { look } = s;
  if (!look.bubbles) return;
  const height = s.profile.height;
  const fine = look.fineBead;
  // Perlen steigen gegen die wirksame Schwerkraft, nicht stur nach oben.
  const g = Math.hypot(s.gx, s.gy) || 1;
  const ux = -s.gx / g;
  const uy = -s.gy / g;
  const rate = look.bubbles * (fine ? 5 : 3.2) * (1 + s.foamBoost * 1.5);
  for (const site of s.sites) {
    site.timer -= dt * rate;
    if (site.timer <= 0 && s.bubbles.length < 160 && surfaceAt(s, site.x) > 6) {
      site.timer += 0.6 + random(s) * 0.8;
      s.bubbles.push({ x: site.x, y: 1.5, r: fine ? 0.45 : 0.6, age: 0, sway: random(s) * 6.28 });
    }
  }
  const kept: Bubble[] = [];
  for (const b of s.bubbles) {
    b.age += dt;
    // Eine Perle wächst beim Steigen und wird dabei schneller.
    b.r = Math.min(fine ? 1.1 : 1.9, b.r + dt * (fine ? 0.5 : 0.9));
    const v = Math.min(fine ? 190 : 140, (fine ? 45 : 25) + b.age * (fine ? 150 : 90));
    b.x += ux * v * dt + Math.sin(b.age * 9 + b.sway) * dt * (fine ? 2 : 5);
    b.y += uy * v * dt;
    const half = halfWidthAt(s.profile, b.y) - b.r - 0.5;
    if (Math.abs(b.x) > half) b.x = Math.sign(b.x) * half;
    if (b.y >= surfaceAt(s, b.x) - b.r || b.y > height || b.y < -2) continue;
    kept.push(b);
  }
  s.bubbles = kept;
}

/** Eis schwimmt: knapp ein Zehntel ragt heraus, der Rest folgt den Wellen. */
function stepIce(s: GlassSim, dt: number, gScale: number) {
  if (!s.ice.length) return;
  const { profile } = s;
  for (const c of s.ice) {
    const surf = surfaceAt(s, c.x);
    const floating = surf - 0.4 * c.size;
    const resting = c.size / 2;
    const goal = Math.max(resting, floating);
    const afloat = floating > resting;
    // Senkrecht: Auftrieb als Feder auf die Schwimmlage – das gibt das Wippen.
    c.vy += (110 * (goal - c.y) - 2 * Math.sqrt(110) * 0.35 * c.vy) * dt;
    c.y += c.vy * dt;
    if (c.y < resting) {
      c.y = resting;
      c.vy = Math.max(0, c.vy);
    }
    // Waagerecht: auf der schrägen Oberfläche gleitet ein Würfel bergab.
    const slope = afloat ? surfaceSlopeAt(s, c.x) : 0;
    const push = afloat ? -GRAVITY * gScale * slope * 0.05 : -s.offsetAcc * 0.02;
    c.vx += (push - (afloat ? 2.2 : 9) * c.vx) * dt;
    c.x += c.vx * dt;
    const half = halfWidthAt(profile, Math.max(0, c.y - c.size / 2)) - c.size * 0.55;
    if (Math.abs(c.x) > half) {
      c.x = Math.sign(c.x) * Math.max(0, half);
      c.vx *= -0.3;
      c.spin += c.vx * 0.002;
    }
    // Drehen: schwimmend mit der Welle, liegend bleibt er, wie er liegt.
    const angleGoal = afloat ? Math.atan(slope) * 0.8 : c.angle;
    c.spin += (40 * (angleGoal - c.angle) - 2 * Math.sqrt(40) * 0.5 * c.spin) * dt;
    c.angle += c.spin * dt;
  }
  // Würfel stoßen sich ab, statt ineinander zu stecken.
  for (let i = 0; i < s.ice.length; i++) {
    for (let j = i + 1; j < s.ice.length; j++) {
      const a = s.ice[i];
      const b = s.ice[j];
      const min = (a.size + b.size) * 0.46;
      const dx = b.x - a.x;
      if (Math.abs(dx) < min && Math.abs(b.y - a.y) < min) {
        const push = (min - Math.abs(dx)) / 2;
        const dir = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx);
        a.x -= dir * push;
        b.x += dir * push;
        const v = (a.vx + b.vx) / 2;
        a.vx = v - dir * 4;
        b.vx = v + dir * 4;
        // Liegt der eine auf dem Grund, stapelt sich der andere darauf.
        if (a.y <= a.size / 2 + 0.5 && b.y <= b.size / 2 + 0.5) b.y = Math.max(b.y, a.y + 3);
      }
    }
  }
}

/** Im Standbild: Eis an seinen Ruheplatz, ohne Simulation. */
function settleIce(s: GlassSim) {
  const height = (s.level + s.pending) * s.profile.height;
  s.ice.forEach((c, i) => {
    c.y = Math.max(c.size / 2, height - 0.4 * c.size);
    c.x = (i - (s.ice.length - 1) / 2) * c.size * 0.95;
    c.vx = 0;
    c.vy = 0;
    c.spin = 0;
  });
}

/**
 * Einschenken: ein Strahl trifft die Oberfläche etwas neben der Mitte, wirft
 * Wellen auf, treibt Perlen hoch und lässt die Krone wachsen.
 */
export function splash(s: GlassSim, strength = 1): void {
  s.pour = 0.75 * Math.min(1.4, strength);
  s.pourX = (random(s) - 0.5) * s.width * 0.3;
  s.foamBoost = Math.min(1, s.foamBoost + 0.65 * strength);
  for (let i = 1; i < COLUMNS; i++) s.flow[i] += gauss(s) * 6;
  if (s.look.bubbles > 0) {
    for (let i = 0; i < 26 && s.bubbles.length < 160; i++) {
      const y = random(s) * Math.max(4, s.surface[COLUMNS >> 1] - 4);
      s.bubbles.push({
        x: (random(s) - 0.5) * halfWidthAt(s.profile, y) * 1.4,
        y,
        r: 0.6 + random(s) * 0.8,
        age: random(s) * 0.4,
        sway: random(s) * 6.28,
      });
    }
  }
}

/** Antippen: das Glas klingt kurz an, die Oberfläche kräuselt sich. */
export function tap(s: GlassSim, x: number): void {
  const radius = s.width * 0.12;
  for (let i = 1; i < COLUMNS; i++) {
    const distance = ((s.colX[i - 1] + s.colX[i]) / 2 - x) / radius;
    s.flow[i] += 260 * distance * Math.exp(-distance * distance / 2);
  }
}
