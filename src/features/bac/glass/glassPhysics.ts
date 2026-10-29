import { GLASS_PROFILES, halfWidthAt, liquidFor } from './glassShapes';
import type { GlassProfile, GlassShape, Liquid } from './glassShapes';
import { DRINK_CATALOG } from '../../../engine/drinks';

/**
 * Flüssigkeit im Glas, wie sie sich wirklich bewegt.
 *
 * Das Schwappen ist eine Überlagerung von Eigenschwingungen (Moden) der
 * Oberfläche – genau so beschreibt es die Strömungslehre für Flüssigkeit in
 * einem Behälter. Jede Mode schwingt mit ihrer eigenen Frequenz aus der
 * Dispersionsrelation für Schwerewellen, ω² = g·k·tanh(k·h): ein schmales
 * Glas schwappt schneller als ein breites, eine flache Pfütze träger als ein
 * volles Glas. Ein Pint liegt so bei gut 3 Hz, wie in echt.
 *
 * Angeregt werden die Moden über die Richtung der wirksamen Schwerkraft
 * relativ zum Glas: Neigen (Sensor), Beschleunigen (Finger, Schütteln) und
 * Einschenken. Die Moden selbst sind linear; das Volumen hält eine eigene
 * Rechnung fest, die auch bei starker Neigung stimmt, wenn die Oberfläche den
 * Boden freilegt oder über den Rand steigt. Was über den Rand steigt,
 * schwappt über: als Tropfen, wenn es schnell geht, als Rinnsal außen am
 * Glas, wenn es nur knapp reicht.
 *
 * Koordinaten: x nach rechts ab der Glasmitte, y nach oben ab dem Innenboden,
 * in Bildpunkten. 1300 px entsprechen einem Meter.
 */

export const PX_PER_M = 1300;
/** Erdbeschleunigung in px/s². */
export const GRAVITY = 9.81 * PX_PER_M;
/** Eigenschwingungen der Oberfläche. Acht reichen bis zu feinen Kräuseln. */
export const MODES = 8;
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
  /** Modenamplituden (px) und ihre Geschwindigkeiten. */
  amp: number[];
  vel: number[];
  /** Quasistatische Neigung der Oberfläche relativ zum Glas (dy/dx). */
  slope: number;
  /** Mittlere Höhe der Oberfläche, aus dem Volumen bestimmt. */
  center: number;
  /** Oberfläche an den Stützstellen. */
  surface: number[];
  /** Senkrechte Geschwindigkeit der Oberfläche an den Stützstellen. */
  surfaceVel: number[];
  /** Lage der Stützstellen und Innenkontur je Spalte. */
  colX: number[];
  colLo: number[];
  colHi: number[];
  /** Ruhebreite der Oberfläche, nach der die Moden bemessen sind. */
  width: number;
  basis: number[][];
  gamma: number[];
  omega2: number[];
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
    amp: new Array(MODES).fill(0),
    vel: new Array(MODES).fill(0),
    slope: 0,
    center: 0,
    surface: new Array(COLUMNS).fill(0),
    surfaceVel: new Array(COLUMNS).fill(0),
    colX: [],
    colLo: [],
    colHi: [],
    width: 0,
    basis: [],
    gamma: [],
    omega2: [],
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
  const maxHalf = Math.max(...profile.points.map(([w]) => w));
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
    for (let y = 0; y <= profile.height; y += 0.5) {
      if (halfWidthAt(profile, y) >= Math.abs(x)) {
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
    }
    if (lo === Infinity) {
      lo = profile.height;
      hi = profile.height;
    }
    s.colLo.push(lo);
    s.colHi.push(hi);
  }
  s.width = 0;
  s.amp.fill(0);
  s.vel.fill(0);
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
  measure(s, true);
  settleIce(s);
  solveSurface(s);
}

/** Moden für die aktuelle Ruhebreite: Form, Frequenz, Anteil an einer Neigung. */
function measure(s: GlassSim, force = false): void {
  const height = s.profile.height;
  const rest = Math.max(4, (s.level + s.pending) * height);
  const width = 2 * halfWidthAt(s.profile, rest);
  if (!force && Math.abs(width - s.width) < 0.5) return;
  s.width = width;
  s.basis = [];
  s.gamma = [];
  s.omega2 = [];
  for (let n = 1; n <= MODES; n++) {
    const k = (n * Math.PI) / width;
    s.omega2.push(GRAVITY * k * Math.tanh(k * rest));
    // Anteil dieser Mode an einer schrägen Ebene y = x: nur ungerade Moden.
    s.gamma.push(n % 2 ? (-4 * width) / (n * n * Math.PI * Math.PI) : 0);
    s.basis.push(s.colX.map((x) => modeShape(n, x, width)));
  }
}

function modeShape(n: number, x: number, width: number): number {
  const xi = Math.min(1, Math.max(0, (x + width / 2) / width));
  return Math.cos(n * Math.PI * xi);
}

/** Fläche unter der horizontalen Linie in Höhe `h`, gerechnet über die Spalten. */
function areaBelow(s: GlassSim, h: number): number {
  let area = 0;
  for (let i = 0; i < COLUMNS; i++) {
    area += Math.max(0, Math.min(h, s.colHi[i]) - s.colLo[i]);
  }
  return area;
}

/**
 * Oberfläche an den Stützstellen, mit einer Mittelhöhe, die das Volumen hält.
 *
 * Die Moden haben über die Breite den Mittelwert null – in einem geraden Glas
 * stimmt das Volumen damit von selbst. In schrägen Wänden, bei freigelegtem
 * Boden oder über dem Rand nicht mehr; dort sucht eine Halbierung die
 * Mittelhöhe, bei der die Fläche wieder passt.
 */
function solveSurface(s: GlassSim): void {
  const height = s.profile.height;
  const shape: number[] = s.colX.map((x, i) => {
    let y = s.slope * x;
    for (let n = 0; n < MODES; n++) y += (s.amp[n] - s.slope * s.gamma[n]) * s.basis[n][i];
    return y;
  });
  const target = areaBelow(s, (s.level + s.pending) * height);
  const area = (c: number) => {
    let a = 0;
    for (let i = 0; i < COLUMNS; i++) {
      a += Math.max(0, Math.min(c + shape[i], s.colHi[i]) - s.colLo[i]);
    }
    return a;
  };
  let lo = -2 * height;
  let hi = 3 * height;
  for (let k = 0; k < 22; k++) {
    const mid = (lo + hi) / 2;
    if (area(mid) < target) lo = mid;
    else hi = mid;
  }
  s.center = (lo + hi) / 2;
  for (let i = 0; i < COLUMNS; i++) s.surface[i] = s.center + shape[i];
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
    s.amp.fill(0);
    s.vel.fill(0);
    s.slope = 0;
    s.offset = 0;
    s.offsetVel = 0;
    s.offsetAcc = 0;
    s.tilt = 0;
    s.gx = 0;
    s.gy = -GRAVITY;
    s.pour = 0;
    s.drops = [];
    s.rivulets = [];
    measure(s);
    settleIce(s);
    solveSurface(s);
    return;
  }
  s.time += dt;
  // Füllstand gleitet: ein neues Getränk läuft ein, Abbau sinkt langsam.
  s.level += (input.levelGoal - s.level) * (1 - Math.exp(-2.2 * dt));
  s.pending += (input.pendingGoal - s.pending) * (1 - Math.exp(-2.2 * dt));
  measure(s);

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
  let down = input.gravity ?? { x: 0, y: 1 };
  // Liegt das Handy flach, fehlt der Schwerkraft in der Bildebene die
  // Richtung. Ein gedachtes „unten" ergänzt sie, damit das Glas dann
  // ruhig steht und auf leichtes Kippen trotzdem antwortet.
  const planar = down.x * down.x + down.y * down.y;
  down = { x: down.x, y: down.y + 0.75 * Math.max(0, 1 - planar) };
  const pull = Math.min(1.8, Math.max(0.6, Math.hypot(down.x, down.y)));
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
  // Kopfüber hält keine Oberfläche: dann höchstens steil.
  const axial = Math.max(0.15 * GRAVITY, -s.gy);
  const maxSlope = Math.tan((72 * Math.PI) / 180);
  s.slope = Math.max(-maxSlope, Math.min(maxSlope, s.gx / axial));
  const gScale = axial / GRAVITY;

  // --- Anregung: Einschenken, Tisch, Hand.
  const force = new Array(MODES).fill(0);
  if (s.pour > 0) {
    s.pour = Math.max(0, s.pour - dt);
    const jet = Math.min(1, s.pour / 0.25);
    for (let n = 0; n < MODES; n++) {
      // Der Strahl drückt die Oberfläche an seiner Stelle nach unten und
      // wühlt sie dabei auf.
      force[n] -= (jet * 420 * modeShape(n + 1, s.pourX, s.width)) / (1 + n * 0.3);
      force[n] += (jet * gauss(s) * 900) / (n + 1);
    }
  }
  const ambient = input.ambient !== false;
  if (ambient && !input.gravity && !holding) {
    // Ohne Sensor steht das Glas auf einem Tisch, an dem gelacht wird:
    // feines Zittern und ab und zu ein Stoß gegen den Tisch.
    s.bumpIn -= dt;
    if (s.bumpIn <= 0) {
      s.bumpIn = 5 + random(s) * 9;
      const kick = (random(s) < 0.5 ? -1 : 1) * (30 + random(s) * 45);
      s.vel[0] += kick;
      s.vel[2] += kick * 0.3;
    }
  }
  for (let n = 0; ambient && n < Math.min(4, MODES); n++) {
    s.vel[n] += (gauss(s) * Math.sqrt(dt) * (input.gravity ? 5 : 12)) / (n + 1);
  }

  // --- Moden integrieren, in kleinen Schritten für die schnellen Kräusel.
  const before = s.surface.slice();
  const steps = Math.max(1, Math.ceil(dt / 0.004));
  const h = dt / steps;
  for (let k2 = 0; k2 < steps; k2++) {
    for (let n = 0; n < MODES; n++) {
      const w2 = s.omega2[n] * gScale;
      const w = Math.sqrt(w2);
      // Zähigkeit wirkt an der Wand und steigt mit der Wellenzahl.
      const zeta = s.look.damping * Math.pow(n + 1, 0.75);
      const acc = w2 * (s.slope * s.gamma[n] - s.amp[n]) - 2 * zeta * w * s.vel[n] + force[n];
      s.vel[n] += acc * h;
      s.amp[n] += s.vel[n] * h;
    }
  }
  solveSurface(s);
  for (let i = 0; i < COLUMNS; i++) s.surfaceVel[i] = dt > 0 ? (s.surface[i] - before[i]) / dt : 0;

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
      const speed = Math.sqrt(2 * GRAVITY * over * 0.6);
      const fling = over > 3 || Math.abs(rising) > 120 || Math.abs(s.offsetVel) > 160;
      if (fling) {
        const count = Math.min(4, Math.ceil(over * dt * 30 + random(s) * 1.2));
        for (let k = 0; k < count; k++) emitDrop(s, side, speed, rising);
      } else {
        feeding = true;
      }
      // Energie geht mit dem Überlauf.
      const loss = Math.exp(-dt * 7 * Math.min(1, over / 5));
      for (let n = 0; n < MODES; n++) {
        const rest = s.slope * s.gamma[n];
        s.amp[n] = rest + (s.amp[n] - rest) * loss;
        s.vel[n] *= loss;
      }
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
  for (let n = 0; n < MODES; n++) s.vel[n] += gauss(s) * 6;
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
  for (let n = 1; n < MODES; n++) s.vel[n] += (modeShape(n + 1, x, s.width) * 26) / Math.sqrt(n);
  s.vel[0] += (random(s) - 0.5) * 20;
}
