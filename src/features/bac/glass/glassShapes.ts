import type { DrinkCategory, DrinkDefinition } from '../../../engine/types';

export type GlassShape = 'pint' | 'wine' | 'flute' | 'tumbler' | 'highball' | 'shot';
const SHAPES: Record<DrinkCategory, GlassShape> = {
  beer: 'pint',
  wine: 'wine',
  sparkling: 'flute',
  cocktail: 'tumbler',
  longdrink: 'highball',
  soft: 'highball',
  spirit: 'shot',
};
export function shapeFor(category: DrinkCategory): GlassShape {
  return SHAPES[category];
}

export interface GlassProfile {
  points: readonly (readonly [number, number])[];
  height: number;
  stem: number;
}
// Halbe Innenbreite und Höhe, vom Boden bis zum Rand.
export const GLASS_PROFILES: Record<GlassShape, GlassProfile> = {
  pint: {
    points: [
      [40, 0],
      [44, 80],
      [56, 191],
    ],
    height: 191,
    stem: 0,
  },
  wine: {
    points: [
      [8, 0],
      [36, 15],
      [51, 50],
      [45, 100],
      [34, 145],
    ],
    height: 145,
    stem: 48,
  },
  flute: {
    points: [
      [6, 0],
      [22, 18],
      [27, 100],
      [25, 170],
    ],
    height: 170,
    stem: 30,
  },
  tumbler: {
    points: [
      [49, 0],
      [54, 125],
    ],
    height: 125,
    stem: 0,
  },
  highball: {
    points: [
      [31, 0],
      [35, 195],
    ],
    height: 195,
    stem: 0,
  },
  shot: {
    points: [
      [25, 0],
      [36, 82],
    ],
    height: 82,
    stem: 0,
  },
};

type Liquid = { top: string; mid: string; bottom: string; foam: boolean; cloudy: boolean };
const PALE = ['#f5df91', '#dfc469', '#a88d42'];
const CLEAR = ['#e7f6f5', '#b9d6d7', '#7faaaa'];
const GOLD = ['#f7c04a', '#e39a1f', '#a8620c'];
const COLORS: Record<string, string[]> = {
  'beer-helles': GOLD,
  'beer-pils': ['#ffe58a', '#efc447', '#bd8c25'],
  'beer-wheat': ['#f2cf78', '#d9aa46', '#aa752e'],
  'beer-radler': ['#fff0a8', '#ecd776', '#c5ae53'],
  'beer-ipa': ['#eeb052', '#ca7926', '#8c4517'],
  'wine-white': PALE,
  'wine-red': ['#8d3048', '#651c35', '#360e22'],
  'wine-rose': ['#f2b0a0', '#db887f', '#ae5961'],
  sparkling: PALE,
  aperol: ['#ffb34f', '#f57927', '#c34a15'],
  cocktail: ['#f3c16e', '#dc8b4a', '#ac5439'],
  'cocktail-strong': ['#e2aa65', '#b96c3e', '#793a28'],
  longdrink: ['#e8c775', '#b79448', '#786032'],
  'hard-seltzer': CLEAR,
  'shot-schnaps': CLEAR,
  'shot-tequila': CLEAR,
  'shot-liqueur': ['#c38b50', '#945929', '#573016'],
  soft: CLEAR,
};
const FALLBACK: Record<DrinkCategory, string[]> = {
  beer: GOLD,
  wine: PALE,
  sparkling: PALE,
  cocktail: COLORS.cocktail,
  longdrink: COLORS.longdrink,
  spirit: CLEAR,
  soft: CLEAR,
};
export function liquidFor(drink: DrinkDefinition): Liquid {
  const [top, mid, bottom] = COLORS[drink.id] ?? FALLBACK[drink.category];
  return { top, mid, bottom, foam: drink.category === 'beer', cloudy: drink.id === 'beer-wheat' };
}
