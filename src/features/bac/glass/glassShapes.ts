import type { DrinkCategory, DrinkDefinition } from '../../../engine/types';

export type GlassShape =
  | 'pint'
  | 'weizen'
  | 'wine'
  | 'spritz'
  | 'flute'
  | 'tumbler'
  | 'highball'
  | 'shot';

const SHAPES: Record<DrinkCategory, GlassShape> = {
  beer: 'pint',
  wine: 'wine',
  sparkling: 'flute',
  cocktail: 'tumbler',
  longdrink: 'highball',
  soft: 'highball',
  spirit: 'shot',
};
// Eigene Getränke kommen aus dem Speicher: eine unbekannte Gruppe bekommt das
// neutrale Glas, statt den Pegel-Tab abstürzen zu lassen.
export function shapeFor(category: DrinkCategory): GlassShape {
  return SHAPES[category] ?? 'highball';
}

/** Manche Getränke haben ihr eigenes Glas, nicht das ihrer Gruppe. */
const OWN_GLASS: Record<string, GlassShape> = {
  'beer-wheat': 'weizen',
  aperol: 'spritz',
};
export function glassFor(drink: DrinkDefinition): GlassShape {
  return OWN_GLASS[drink.id] ?? shapeFor(drink.category);
}

export interface GlassProfile {
  /** Innenkontur: halbe Breite und Höhe über dem Innenboden, von unten nach oben. */
  points: readonly (readonly [number, number])[];
  /** Innenhöhe vom Boden bis zum Rand. */
  height: number;
  /** Stiel zwischen Fuß und Kelch. */
  stem: number;
  /** Halbe Breite des Fußes (nur mit Stiel). */
  foot?: number;
  /** Wandstärke. */
  wall: number;
  /** Massiver Glasboden unter der Flüssigkeit. */
  base: number;
}

// Maße in Bildpunkten bei 1300 px pro Meter: ein Pint ist innen gut 14 cm
// hoch und oben gut 8 cm breit. Die Physik rechnet mit genau diesem Maßstab –
// deshalb schwappt ein Schnapsglas schneller als ein Weinkelch.
export const GLASS_PROFILES: Record<GlassShape, GlassProfile> = {
  pint: {
    points: [
      [38, 0],
      [41, 60],
      [46, 120],
      [54, 186],
    ],
    height: 186,
    stem: 0,
    wall: 2.5,
    base: 8,
  },
  weizen: {
    points: [
      [24, 0],
      [23, 30],
      [26, 70],
      [34, 118],
      [39, 152],
      [38, 176],
      [35, 194],
    ],
    height: 194,
    stem: 0,
    wall: 2.2,
    base: 9,
  },
  wine: {
    points: [
      [5, 0],
      [30, 12],
      [46, 42],
      [49, 70],
      [44, 104],
      [36, 130],
    ],
    height: 130,
    stem: 56,
    foot: 34,
    wall: 1.6,
    base: 2,
  },
  spritz: {
    points: [
      [6, 0],
      [36, 14],
      [54, 48],
      [56, 78],
      [50, 106],
      [44, 122],
    ],
    height: 122,
    stem: 50,
    foot: 38,
    wall: 1.6,
    base: 2,
  },
  flute: {
    points: [
      [4, 0],
      [17, 16],
      [24, 60],
      [26, 110],
      [24, 160],
    ],
    height: 160,
    stem: 42,
    foot: 27,
    wall: 1.4,
    base: 2,
  },
  tumbler: {
    points: [
      [47, 0],
      [52, 96],
    ],
    height: 96,
    stem: 0,
    wall: 3,
    base: 15,
  },
  highball: {
    points: [
      [31, 0],
      [34, 184],
    ],
    height: 184,
    stem: 0,
    wall: 2.5,
    base: 11,
  },
  shot: {
    points: [
      [21, 0],
      [29, 68],
    ],
    height: 68,
    stem: 0,
    wall: 3.5,
    base: 13,
  },
};

/**
 * Die Kontur als weiche Kurve: Catmull-Rom durch die Stützpunkte. Ein
 * Weinkelch aus sechs geraden Stücken sieht nach Vieleck aus, nicht nach Glas.
 * Physik und Zeichnung lesen beide diese Kurve, damit die Flüssigkeit genau
 * dort an die Wand stößt, wo die Wand gezeichnet ist.
 */
const dense = new WeakMap<GlassProfile, [number, number][]>();
export function contourOf(profile: GlassProfile): readonly (readonly [number, number])[] {
  let c = dense.get(profile);
  if (!c) {
    c = smooth(profile.points);
    dense.set(profile, c);
  }
  return c;
}

function smooth(points: GlassProfile['points']): [number, number][] {
  if (points.length < 3) return points.map(([w, y]) => [w, y]);
  const out: [number, number][] = [];
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const last = points[points.length - 1];
  out.push([last[0], last[1]]);
  return out;
}

/** Innere halbe Breite in Höhe `y`; außerhalb der Kontur die nächste Kante. */
export function halfWidthAt(profile: GlassProfile, y: number): number {
  const points = contourOf(profile);
  if (y <= points[0][1]) return points[0][0];
  for (let i = 1; i < points.length; i++) {
    const [w1, y1] = points[i - 1];
    const [w2, y2] = points[i];
    if (y <= y2) return y2 > y1 ? w1 + ((w2 - w1) * (y - y1)) / (y2 - y1) : w2;
  }
  return points[points.length - 1][0];
}

export type Garnish = 'orange' | 'lime' | 'limeWedge' | 'cherry';

export interface Liquid {
  top: string;
  mid: string;
  bottom: string;
  /** Schaumkrone (nur Bier). */
  foam: boolean;
  /** Ruhende Höhe der Krone in px. */
  foamHeight: number;
  /** Trüb wie Weißbier oder Radler. */
  cloudy: boolean;
  /** Kohlensäure: Perlen pro Sekunde und Keimstelle, 0 = still. */
  bubbles: number;
  /** Feine, schnelle Perlage wie bei Sekt statt grober Bierperlen. */
  fineBead: boolean;
  /** Eiswürfel im Glas. */
  ice: number;
  /** Dämpfung der Grundschwingung (Anteil der kritischen). */
  damping: number;
  /** Flüssigkeitsfilm an der Wand nach dem Schwappen (Kirchenfenster beim Wein). */
  film: number;
  /** Kalt serviert: Kondenswasser außen am Glas. */
  cold: boolean;
  garnish?: Garnish;
  straw?: boolean;
  saltRim?: boolean;
}

type Base = Omit<Liquid, 'top' | 'mid' | 'bottom'>;
const STILL: Base = {
  foam: false,
  foamHeight: 0,
  cloudy: false,
  bubbles: 0,
  fineBead: false,
  ice: 0,
  damping: 0.014,
  film: 0,
  cold: false,
};
// Schaum dämpft das Schwappen spürbar – Bier beruhigt sich schneller als Wasser.
const BEER: Base = { ...STILL, foam: true, foamHeight: 12, bubbles: 1, damping: 0.045, cold: true };

const PALE = ['#f5df91', '#dfc469', '#a88d42'];
const CLEAR = ['#e7f6f5', '#b9d6d7', '#7faaaa'];
const GOLD = ['#f7c04a', '#e39a1f', '#a8620c'];

const LOOKS: Record<string, [string[], Base]> = {
  'beer-helles': [GOLD, BEER],
  'beer-pils': [['#ffe58a', '#efc447', '#bd8c25'], BEER],
  'beer-wheat': [['#f2cf78', '#d9aa46', '#aa752e'], { ...BEER, foamHeight: 20, cloudy: true, bubbles: 0.8 }],
  'beer-radler': [['#fff0a8', '#ecd776', '#c5ae53'], { ...BEER, foamHeight: 9, cloudy: true, bubbles: 1.3 }],
  'beer-ipa': [['#eeb052', '#ca7926', '#8c4517'], { ...BEER, foamHeight: 10, cloudy: true }],
  'wine-white': [PALE, { ...STILL, film: 0.7, cold: true }],
  'wine-red': [['#8d3048', '#651c35', '#360e22'], { ...STILL, film: 1 }],
  'wine-rose': [['#f2b0a0', '#db887f', '#ae5961'], { ...STILL, film: 0.8, cold: true }],
  sparkling: [PALE, { ...STILL, foam: true, foamHeight: 2.5, bubbles: 2.4, fineBead: true, film: 0.4, cold: true }],
  aperol: [
    ['#ffb34f', '#f57927', '#c34a15'],
    { ...STILL, bubbles: 0.9, fineBead: true, ice: 3, damping: 0.03, cold: true, garnish: 'orange' },
  ],
  cocktail: [['#f3c16e', '#dc8b4a', '#ac5439'], { ...STILL, ice: 3, damping: 0.03, cold: true, garnish: 'lime' }],
  'cocktail-strong': [
    ['#e2aa65', '#b96c3e', '#793a28'],
    { ...STILL, ice: 2, damping: 0.035, film: 0.5, cold: true, garnish: 'cherry' },
  ],
  longdrink: [
    ['#e8c775', '#b79448', '#786032'],
    { ...STILL, bubbles: 0.6, ice: 4, damping: 0.028, cold: true, straw: true },
  ],
  'hard-seltzer': [CLEAR, { ...STILL, bubbles: 1.3, ice: 3, damping: 0.026, cold: true, garnish: 'limeWedge' }],
  'shot-schnaps': [CLEAR, { ...STILL, damping: 0.02, film: 0.3 }],
  'shot-tequila': [['#f4ecc8', '#ddd0a0', '#b3a56e'], { ...STILL, damping: 0.02, film: 0.3, garnish: 'limeWedge', saltRim: true }],
  // Likör ist sirupartig: er schwappt träge und zieht dicke Schlieren.
  'shot-liqueur': [['#c38b50', '#945929', '#573016'], { ...STILL, damping: 0.07, film: 1 }],
  soft: [['#e3f3f7', '#b4d7e0', '#7aa7b6'], { ...STILL, bubbles: 0.5, ice: 3, damping: 0.024, cold: true, straw: true }],
};
const FALLBACK: Record<DrinkCategory, [string[], Base]> = {
  beer: [GOLD, BEER],
  wine: [PALE, { ...STILL, film: 0.7 }],
  sparkling: LOOKS.sparkling,
  cocktail: LOOKS.cocktail,
  longdrink: LOOKS.longdrink,
  spirit: [CLEAR, { ...STILL, damping: 0.02, film: 0.3 }],
  soft: LOOKS.soft,
};

export function liquidFor(drink: DrinkDefinition): Liquid {
  // Eigene Getränke übernehmen den Look ihrer Gruppe – ohne Beilage: wer
  // „Mexikaner" anlegt, will keine Limette im Glas.
  const own = LOOKS[drink.id];
  const [[top, mid, bottom], base] = own ?? FALLBACK[drink.category] ?? [CLEAR, STILL];
  const look: Liquid = { top, mid, bottom, ...base };
  if (!own) {
    delete look.garnish;
    delete look.saltRim;
  }
  return look;
}
