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
  age: number;
  /** Zugehöriger Auslauf. */
  chain?: number;
}
/** Freier Strahl im Bildschirmrahmen; Breite aus q / Tempo, sichtbar ab 1 px. */
export interface StreamParcel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  q: number;
  width: number;
  chain: number;
  side: -1 | 1;
  age: number;
  distance: number;
  /** Zeitspanne des Glieds; beim Verfeinern auf die Stützstellen aufgeteilt. */
  duration: number;
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
  /** Verlorene Fläche / Spaltenbreite; Nachfüllen erst im stehenden Glas. */
  lostArea: number;
  /** Insgesamt ausgetretene Schnittfläche in px², unabhängig vom Nachfüllen. */
  spilled: number;
  idleFor: number;
  uprightFor: number;
  refillTime: number;
  refillArea: number;
  stream: StreamParcel[];
  streamChain: number;
  activeChains: [number, number];
  breakupGap: [number, number];
  /** Entnommene Fläche / Spaltenbreite, Quelle im nächsten Druckschritt. */
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
  /** Geglättete Bildschirm-Schwerkraft in g; erster Sensorwert initialisiert sie. */
  gravityLength: number | null;
  /** Zusätzliche Schaumhöhe nach dem Einschenken, 0…1. */
  foamBoost: number;
  /** Bereits über den Rand verlorene Schaumhöhe; endlich statt ständig erneuert. */
  foamLoss: number;
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
    spilled: 0,
    idleFor: 0,
    uprightFor: 0,
    refillTime: 0,
    refillArea: 0,
    stream: [],
    streamChain: 0,
    activeChains: [-1, -1],
    breakupGap: [0, 0],
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
    gravityLength: null,
    foamBoost: 0.35,
    foamLoss: 0,
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
  s.spilled = 0;
  s.foamLoss = 0;
  s.gravityLength = null;
  s.idleFor = 0;
  s.uprightFor = 0;
  s.refillTime = 0;
  s.refillArea = 0;
  s.stream = [];
  s.streamChain = 0;
  s.activeChains = [-1, -1];
  s.breakupGap = [0, 0];
  s.outflow.fill(0);
}

/**
 * Semiimplizite Massen- und Impulsbilanz auf einem versetzten Gitter.
 * Die Speicherkurve einer Spalte ist an Boden und geschlossener Kelchwand
 * begrenzt. Darüber steht die Höhe für den Druckkopf, nicht für mehr Masse.
 * Der tridiagonale Druckschritt erhält die lokalen Flüsse auch dort, wo
 * eine volle Spalte keine zusätzliche Flüssigkeit aufnehmen kann.
 */
function stepField(s: GlassSim, dt: number, ambient: boolean): number[] {
  const discharge = [0, 0];
  const rest = Math.max(1, (s.level + s.pending) * s.profile.height);
  s.width = 2 * halfWidthAt(s.profile, rest);
  const dx = s.colX[1] - s.colX[0];
  const k = Math.PI / s.width;
  // Im tiefen Wasser beteiligt sich nur noch eine Tiefe von ungefähr 1/k.
  const depth = Math.tanh(k * rest) / k;
  const axial = s.gy < 0 ? -s.gy : 0.025 * GRAVITY;
  const frequency = Math.sqrt(axial * k * Math.tanh(k * rest));
  const before = s.surface.slice();
  s.idleFor += dt;
  s.uprightFor = Math.atan2(Math.abs(s.gx), -s.gy) < Math.PI / 9 ? s.uprightFor + dt : 0;
  if (s.uprightFor > 0.5 && s.idleFor > 0.5) {
    if (s.refillTime === 0) s.refillArea = s.lostArea;
    s.refillTime += dt;
    const t = Math.min(1, s.refillTime / 2);
    // Die Rampe startet und endet ohne Sprung der Quellstärke.
    s.lostArea = s.refillArea * (1 - t * t * (3 - 2 * t));
  } else {
    s.refillTime = 0;
  }
  const targetArea = areaBelow(s, (s.level + s.pending) * s.profile.height);
  const target = Math.max(0, targetArea - s.lostArea);
  const velocity = s.flow;
  if (
    target > 1e-6 &&
    s.surface.every((y, i) => Math.max(0, Math.min(y, s.colHi[i]) - s.colLo[i]) < 1e-6)
  ) {
    s.flow.fill(0);
    let lo = 0;
    let hi = s.profile.height;
    for (let i = 0; i < 30; i++) {
      const middle = (lo + hi) / 2;
      if (areaBelow(s, middle) > target) hi = middle;
      else lo = middle;
    }
    s.surface.fill((lo + hi) / 2);
  }
  if (ambient) {
    // Eine kleine gerichtete Störung bricht die Symmetrie für parametrische Wellen.
    // Flach auf dem Tisch ruht das Glas: beim Hinlegen ist die wirksame
    // Schwerkraft kurz schwach, ein voller Stoß ließe es dann überschwappen.
    const kick = gauss(s) * Math.sqrt(dt) * 35 * inclination(s);
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
  const rim = rimHalfWidth(s.profile);
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
  for (let n = 0; n < steps; n++) {
    let total = 0;
    let free = 0;
    for (let i = 0; i < COLUMNS; i++) {
      mass[i] = amount(i);
      total += mass[i];
      if (s.surface[i] > s.colLo[i] && s.surface[i] < s.colHi[i]) free++;
    }
    // Der Wehrfluss wird mit derselben kleinen Schrittweite wie der Druck gelöst.
    // Ein großer Entzug je Bild würde den Rand abwechselnd leerziehen und aufstauen.
    drainRim(s, h, discharge, rim);
    const drained = s.outflow.reduce((sum, value) => sum + value, 0);
    const supply = (Math.max(0, targetArea - s.lostArea) - total + drained) / Math.max(1, free);
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
        s.outflow[i] -
        (h / dx) * (mobility[i + 1] * predicted[i + 1] - mobility[i] * predicted[i]);
    }
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
      let largest = 1;
      for (let i = 0; i < COLUMNS; i++) largest = Math.max(largest, Math.abs(solved[i]));
      let fraction = Math.min(1, (2 * s.profile.height) / largest);
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
    s.outflow.fill(0);
  }
  s.center = sample(s, s.surface, 0);
  for (let i = 0; i < COLUMNS; i++) s.surfaceVel[i] = dt > 0 ? (s.surface[i] - before[i]) / dt : 0;
  return discharge;
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

/** 1 = Handy aufrecht, 0 = flach; aus der geglätteten Länge der Schwerkraft. */
function inclination(s: GlassSim): number {
  const t = Math.max(0, Math.min(1, ((s.gravityLength ?? 1) - 0.17) / (0.42 - 0.17)));
  return t * t * (3 - 2 * t);
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
  // 0,1 s erkennt Hinlegen zügig; die 4-Hz-Anregung bleibt im Rohbetrag erhalten.
  s.gravityLength =
    (s.gravityLength ?? pull) + (pull - (s.gravityLength ?? pull)) * (1 - Math.exp(-dt / 0.1));
  const inclined = inclination(s);
  // Schwache Rohvektoren haben keine verlässliche Richtung: sofort nach unten.
  const directionTransition = Math.max(0, Math.min(1, (pull - 0.17) / (0.42 - 0.17)));
  // Darüber zählt nur die Richtung: wer das Handy schräg nach hinten hält,
  // misst weniger als 1 g in der Bildebene, die Oberfläche steht trotzdem waagerecht.
  const directionWeight = directionTransition * directionTransition * (3 - 2 * directionTransition);
  const directionX = (down.x / norm) * directionWeight;
  const directionY = 1 + (down.y / norm - 1) * directionWeight;
  const directionLength = Math.hypot(directionX, directionY) || 1;
  // Der Betrag blendet verzögert zu 1 g, damit vertikales Schütteln weiter anregt.
  const magnitude = 1 + (pull - 1) * inclined;
  const effectiveDown = {
    x: (directionX / directionLength) * magnitude,
    y: (directionY / directionLength) * magnitude,
  };
  // Bildschirm (y unten) minus Scheinkraft des Fingers, dann ins Glas gedreht.
  const sx = effectiveDown.x * GRAVITY - s.offsetAcc;
  const sy = effectiveDown.y * GRAVITY;
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
  const discharge = stepField(s, dt, ambient);

  stepDrops(s, dt, down);
  stepStream(s, dt, down);
  overflow(s, dt, discharge);
  refineStream(s);
  wetWalls(s, dt);
  stepFoam(s, dt);
  stepBubbles(s, dt);
  stepIce(s, dt, gScale);
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
 * es fließt als freier Strahl. Der übergelaufene Wellenberg fehlt danach, die
 * Schwingung verliert also Energie.
 */
function rimHeight(s: GlassSim, side: -1 | 1, rim = rimHalfWidth(s.profile)): number {
  const x = side * rim;
  const edge = side < 0 ? 0 : COLUMNS - 1;
  const neighbor = edge - side;
  const slope = (s.surface[edge] - s.surface[neighbor]) / (s.colX[edge] - s.colX[neighbor]);
  return surfaceAt(s, x) + slope * (x - Math.max(s.colX[0], Math.min(s.colX[COLUMNS - 1], x)));
}

function drainRim(s: GlassSim, dt: number, discharge: number[], rim: number) {
  const { profile } = s;
  for (const side of [-1, 1] as const) {
    const over = rimHeight(s, side, rim) - profile.height;
    if (over > 0.12) {
      const dx = s.colX[1] - s.colX[0];
      const free = s.surface.map((y, i) => y > s.colLo[i] && y < s.colHi[i]);
      const storage = free.filter(Boolean).length;
      // Exakte Integration von dh/dt ∝ -h^(3/2): der Wehrfluss kann
      // innerhalb eines Schritts nicht mehr als seinen Druckkopf abbauen.
      const nextOver =
        (over ** -0.5 +
          (0.65 * Math.sqrt(2 * Math.hypot(s.gx, s.gy)) * dt) / (2 * Math.max(1, storage) * dx)) **
        -2;
      const lowering = over - nextOver;
      let loss = 0;
      for (let i = 0; i < COLUMNS; i++) {
        if (!free[i] || s.surface[i] - s.colLo[i] < 1e-6) continue;
        const take = Math.min(Math.max(0, s.surface[i] - s.colLo[i] - s.outflow[i]), lowering);
        s.outflow[i] += take;
        loss += take;
      }
      if (loss > 0) {
        discharge[side < 0 ? 0 : 1] += loss * dx;
        s.lostArea += loss;
        s.spilled += loss * dx;
        s.idleFor = 0;
        s.refillTime = 0;
      }
    }
  }
}

function overflow(s: GlassSim, dt: number, discharge: number[]): void {
  const { profile } = s;
  for (const side of [-1, 1] as const) {
    const y = rimHeight(s, side);
    const over = y - profile.height;
    const rising = sample(s, s.surfaceVel, side * rimHalfWidth(profile));
    const slot = side < 0 ? 0 : 1;
    const q = dt > 0 ? discharge[slot] / dt : 0;
    const speed = Math.cbrt((2 * Math.hypot(s.gx, s.gy) * q) / 0.65);
    const feeding = q > 0 && speed < 215 && Math.abs(rising) < 120 && Math.abs(s.offsetVel) < 160;
    if (q > 0 && !feeding) emitStream(s, side, speed, rising, q, dt);
    else s.activeChains[slot] = -1;
    // Schaum steigt zuerst über: er ist leicht und steht über dem Wasser.
    const availableFoam = foamHeight(s);
    const foamTop = y + availableFoam;
    const foamOver = s.look.foam ? foamTop - profile.height - 3 : 0;
    const foamFeeding = foamOver > 0.5 && availableFoam > 0.5 && s.look.foamHeight > 4;
    if (foamFeeding) {
      s.foamBoost = Math.max(0, s.foamBoost - dt * 0.05 * foamOver);
      s.foamLoss += dt * foamOver * 3;
      s.idleFor = 0;
    }
    feedRivulet(s, side, feeding, false, over, dt);
    if (s.look.foam && s.look.foamHeight > 4) feedRivulet(s, side, foamFeeding, true, foamOver, dt);
  }
  for (const r of s.rivulets) {
    r.age += dt;
    const length = outerLength(s);
    // Ein Rinnsal läuft zäh die Wand hinab, Schaum noch langsamer.
    if (r.head < length) r.head = Math.min(length, r.head + dt * (r.foam ? 26 : 70));
    if (
      r.foam &&
      r.feeding &&
      Math.floor(r.age / 0.45) !== Math.floor((r.age - dt) / 0.45) &&
      s.drops.length < 90
    ) {
      const y = profile.height - r.head;
      const p = toCanvas(
        s,
        r.side * (halfWidthAt(profile, Math.max(0, y)) + profile.wall + r.width / 2),
        y,
      );
      s.drops.push({
        ...p,
        vx: s.offsetVel + r.side * (8 + random(s) * 16),
        vy: 15,
        r: 0.7 + random(s) * 1.5,
        foam: true,
        age: 0,
      });
    }
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

function emitStream(s: GlassSim, side: -1 | 1, speed: number, rising: number, q: number, dt: number) {
  const slot = side < 0 ? 0 : 1;
  if (s.activeChains[slot] < 0) s.activeChains[slot] = ++s.streamChain;
  const p = toCanvas(s, side * (rimHalfWidth(s.profile) + s.profile.wall), s.profile.height);
  const cos = Math.cos(s.tilt);
  const sin = Math.sin(s.tilt);
  const vx = side * speed;
  const vy = -Math.max(-80, Math.min(160, rising * 0.25));
  const parcel: StreamParcel = {
    ...p,
    vx: cos * vx - sin * vy + s.offsetVel,
    vy: sin * vx + cos * vy,
    q,
    width: 0,
    chain: s.activeChains[slot],
    side,
    age: 0,
    distance: 0,
    duration: dt,
  };
  parcel.width = streamWidth(parcel);
  s.stream.push(parcel);
  if (s.stream.length > 256) s.stream.shift();
}

const MIN_STREAM_WIDTH = 1;

function breakupDistance(p: StreamParcel): number {
  return Math.min(110, 22 + Math.sqrt(p.q) * 1.8);
}

function streamWidth(p: StreamParcel): number {
  // Die Zeichenbreite bleibt bis zum Abriss sichtbar, auch bei kleinem Fluss.
  const width = Math.max(MIN_STREAM_WIDTH, Math.min(16, p.q / Math.max(1, Math.hypot(p.vx, p.vy))));
  const end = breakupDistance(p);
  const neck = Math.min(end * 0.65, Math.max(12, width * 3));
  const t = Math.max(0, Math.min(1, (p.distance - end + neck) / neck));
  const tip = Math.min(width, Math.max(MIN_STREAM_WIDTH, width * 0.18));
  return width + (tip - width) * t * t * (3 - 2 * t);
}

/** Abrissabstände im Wegmaß bleiben unabhängig von Bildrate und Stützstellen. */
function breakParcel(s: GlassSim, p: StreamParcel) {
  const speed = Math.max(1, Math.hypot(p.vx, p.vy));
  const nx = p.vx / speed;
  const ny = p.vy / speed;
  const tip = Math.max(MIN_STREAM_WIDTH, streamWidth({ ...p, distance: breakupDistance(p) }));
  const slot = p.side < 0 ? 0 : 1;
  const length = p.duration * speed;
  // Größen und Abstände aus dem Band vor dem Hals. Die Begrenzung hält
  // dünne Strahlen sichtbar und teilt dicke in mehrere mittlere Tropfen.
  const body = Math.max(2, Math.min(8, p.q / speed));
  let offset = s.breakupGap[slot];
  while (offset < length && s.drops.length < 512) {
    const r = Math.max(0.9, Math.min(4, body * (0.25 + random(s) * 0.5)));
    const x = p.x + nx * (offset - length / 2);
    const y = p.y + ny * (offset - length / 2);
    s.drops.push({ x, y, vx: p.vx, vy: p.vy, r, foam: false, chain: p.chain, age: 0 });
    const gap = body * (1.4 + random(s) ** 2 * 5);
    if (random(s) < 0.18 && s.drops.length < 512) {
      s.drops.push({
        x: x + nx * gap * 0.55 - ny * tip * 0.25,
        y: y + ny * gap * 0.55 + nx * tip * 0.25,
        vx: p.vx - ny * 8,
        vy: p.vy + nx * 8,
        r: 0.15 + random(s) * 0.15,
        foam: false,
        chain: p.chain,
        age: 0,
      });
    }
    offset += gap;
  }
  s.breakupGap[slot] = Math.max(0, offset - length);
}

/** Zusätzliche Stützstellen im freien Band schließen Lücken bei großen Bildschritten. */
function refineStream(s: GlassSim) {
  const refined: StreamParcel[] = [];
  const chains = new Map<number, StreamParcel[]>();
  for (const p of s.stream) {
    const chain = chains.get(p.chain) ?? [];
    chain.push(p);
    chains.set(p.chain, chain);
  }
  const ordered = [...chains.values()].flat();
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i - 1];
    const b = ordered[i];
    if (a && a.chain === b.chain) {
      const gap = Math.hypot(a.x - b.x, a.y - b.y);
      const count = Math.max(
        1,
        Math.min(
          Math.ceil(gap / (1.5 * Math.min(a.width, b.width))),
          257 - refined.length - ordered.length + i,
        ),
      );
      b.duration /= count;
      for (let j = 1; j < count; j++) {
        const t = j / count;
        const mix = (x: number, y: number) => x + (y - x) * t;
        const p: StreamParcel = {
          x: mix(a.x, b.x),
          y: mix(a.y, b.y),
          vx: mix(a.vx, b.vx),
          vy: mix(a.vy, b.vy),
          q: mix(a.q, b.q),
          width: 0,
          chain: b.chain,
          side: b.side,
          age: mix(a.age, b.age),
          distance: mix(a.distance, b.distance),
          duration: b.duration,
        };
        p.width = streamWidth(p);
        refined.push(p);
      }
    }
    refined.push(b);
  }
  s.stream = refined;
}

function stepStream(s: GlassSim, dt: number, down: { x: number; y: number }) {
  const kept: StreamParcel[] = [];
  const segments = new Map<number, { chain: number; hasParcel: boolean }>();
  let detached: StreamParcel | undefined;
  for (const p of s.stream) {
    const segment = segments.get(p.chain) ?? { chain: p.chain, hasParcel: false };
    segments.set(p.chain, segment);
    p.age += dt;
    p.vx += down.x * GRAVITY * dt;
    p.vy += down.y * GRAVITY * dt;
    const travel = Math.hypot(p.vx, p.vy) * dt;
    p.distance += travel;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.width = streamWidth(p);
    // Der Fluss bestimmt die Zerfallsstrecke; bis dahin bleibt das Band sichtbar.
    const breakup = breakupDistance(p);
    if (p.y >= STAGE.table) {
      if (p.duration > 0) addPuddle(s, p.x, p.width, false);
    } else if (p.distance >= breakup) {
      breakParcel(s, p);
      detached = p;
    } else if (p.x > -20 && p.x < STAGE.width + 20 && p.y > -60) {
      // Schnitt mit der Abrissstelle: der Hals endet exakt dort, statt ein
      // ganzes Bildglied vor den Tropfen stumpf abzuschneiden.
      if (detached?.chain === p.chain && detached.distance >= breakup) {
        const t = (breakup - p.distance) / (detached.distance - p.distance);
        const tip = {
          ...p,
          x: p.x + (detached.x - p.x) * t,
          y: p.y + (detached.y - p.y) * t,
          distance: breakup,
          duration: 0,
          chain: segment.chain,
        };
        tip.width = streamWidth(tip);
        kept.push(tip);
      }
      detached = undefined;
      p.chain = segment.chain;
      segment.hasParcel = true;
      kept.push(p);
      continue;
    }
    if (segment.hasParcel) {
      const previous = segment.chain;
      segment.chain = ++s.streamChain;
      segment.hasParcel = false;
      const slot = p.side < 0 ? 0 : 1;
      if (s.activeChains[slot] === previous) s.activeChains[slot] = segment.chain;
    }
  }
  s.stream = kept;
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
  const gy = down.y * GRAVITY;
  const kept: Drop[] = [];
  for (const d of s.drops) {
    d.age += dt;
    d.vx += gx * dt;
    d.vy += gy * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.y >= STAGE.table) {
      addPuddle(s, d.x, d.r, d.foam);
      // Aufprall: ein, zwei winzige Spritzer, die gleich wieder liegen.
      if (d.r > 1.6 && s.drops.length < 90) {
        kept.push({
          x: d.x,
          y: STAGE.table - 1,
          vx: (random(s) - 0.5) * 160,
          vy: -120 - random(s) * 120,
          r: 0.7,
          foam: d.foam,
          age: 0,
        });
      }
      continue;
    }
    const outside = d.x < 0 || d.x > STAGE.width || d.y < 0;
    if (outside && (d.vy <= 0 || d.age > 2)) continue;
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
  return Math.max(0, s.look.foamHeight * (0.7 + 1.1 * s.foamBoost) - s.foamLoss);
}

function stepFoam(s: GlassSim, dt: number) {
  // Bierschaum fällt in Minuten zusammen; hier reicht eine halbe Minute.
  s.foamBoost = Math.max(0.25, s.foamBoost - dt * 0.025);
  if (s.uprightFor > 0.5 && s.idleFor > 0.5) {
    // Nur freie Randhöhe nachbilden; verlorener Schaum darf nicht erneut überlaufen.
    const headroom = Math.max(
      0,
      s.profile.height + 3 - Math.max(rimHeight(s, -1), rimHeight(s, 1)),
    );
    const minimumLoss = Math.max(0, s.look.foamHeight * (0.7 + 1.1 * s.foamBoost) - headroom);
    s.foamLoss = Math.max(minimumLoss, s.foamLoss * Math.exp(-2 * dt));
  }
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
