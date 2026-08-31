import { alcoholGrams } from './bac';
import type { IconName } from '../components/icons';
import type { DrinkCategory, DrinkDefinition } from './types';

/**
 * Getränke-Katalog. Werte sind realistische Durchschnitte – über
 * "Eigenes Getränk" kann jeder Volumen und Vol.-% selbst setzen.
 */
export const DRINK_CATALOG: DrinkDefinition[] = [
  { id: 'beer-pils', name: 'Bier (Pils)', category: 'beer', icon: 'beerMug', defaultVolumeMl: 330, abvPercent: 5.0, sipSizeMl: 40 },
  { id: 'beer-helles', name: 'Helles / Lager', category: 'beer', icon: 'beerMug', defaultVolumeMl: 500, abvPercent: 5.2, sipSizeMl: 40 },
  { id: 'beer-wheat', name: 'Weißbier', category: 'beer', icon: 'beerMug', defaultVolumeMl: 500, abvPercent: 5.4, sipSizeMl: 40 },
  { id: 'beer-radler', name: 'Radler', category: 'beer', icon: 'beerMug', defaultVolumeMl: 500, abvPercent: 2.5, sipSizeMl: 40 },
  { id: 'beer-ipa', name: 'Craft / IPA', category: 'beer', icon: 'beerBottle', defaultVolumeMl: 330, abvPercent: 6.5, sipSizeMl: 35 },
  { id: 'wine-white', name: 'Weißwein', category: 'wine', icon: 'wine', defaultVolumeMl: 200, abvPercent: 11.5, sipSizeMl: 20 },
  { id: 'wine-red', name: 'Rotwein', category: 'wine', icon: 'wine', defaultVolumeMl: 200, abvPercent: 13.5, sipSizeMl: 20 },
  { id: 'wine-rose', name: 'Rosé', category: 'wine', icon: 'wine', defaultVolumeMl: 200, abvPercent: 12.0, sipSizeMl: 20 },
  { id: 'sparkling', name: 'Sekt / Prosecco', category: 'sparkling', icon: 'flute', defaultVolumeMl: 100, abvPercent: 11.0, sipSizeMl: 20 },
  { id: 'aperol', name: 'Aperol Spritz', category: 'cocktail', icon: 'tumbler', defaultVolumeMl: 250, abvPercent: 8.0, sipSizeMl: 30 },
  { id: 'cocktail', name: 'Cocktail', category: 'cocktail', icon: 'cocktail', defaultVolumeMl: 250, abvPercent: 12.0, sipSizeMl: 30 },
  { id: 'cocktail-strong', name: 'Cocktail (stark)', category: 'cocktail', icon: 'cocktail', defaultVolumeMl: 200, abvPercent: 20.0, sipSizeMl: 30 },
  { id: 'longdrink', name: 'Longdrink', category: 'longdrink', icon: 'tallGlass', defaultVolumeMl: 300, abvPercent: 8.0, sipSizeMl: 35 },
  { id: 'hard-seltzer', name: 'Hard Seltzer', category: 'longdrink', icon: 'tallGlass', defaultVolumeMl: 330, abvPercent: 4.5, sipSizeMl: 40 },
  { id: 'shot-schnaps', name: 'Shot (Schnaps)', category: 'spirit', icon: 'shot', defaultVolumeMl: 20, abvPercent: 40, sipSizeMl: 20, sipIsUnit: true },
  { id: 'shot-liqueur', name: 'Shot (Likör)', category: 'spirit', icon: 'shot', defaultVolumeMl: 20, abvPercent: 20, sipSizeMl: 20, sipIsUnit: true },
  { id: 'shot-tequila', name: 'Tequila / Wodka', category: 'spirit', icon: 'shot', defaultVolumeMl: 20, abvPercent: 38, sipSizeMl: 20, sipIsUnit: true },
  { id: 'soft', name: 'Alkoholfrei', category: 'soft', icon: 'water', defaultVolumeMl: 250, abvPercent: 0, sipSizeMl: 40 },
];

export const CATEGORY_LABEL: Record<DrinkCategory, string> = {
  beer: 'Bier',
  wine: 'Wein',
  sparkling: 'Schaumwein',
  cocktail: 'Cocktails',
  longdrink: 'Longdrinks',
  spirit: 'Shots',
  soft: 'Ohne Alkohol',
};

export const CATEGORY_ORDER: DrinkCategory[] = [
  'beer',
  'wine',
  'sparkling',
  'cocktail',
  'longdrink',
  'spirit',
  'soft',
];

/** Reiner Alkohol in Gramm pro Schluck. */
export function alcoholPerSip(drink: DrinkDefinition): number {
  return alcoholGrams(drink.sipSizeMl, drink.abvPercent);
}

/** Wie viele Schlucke stecken in einem üblichen Glas? */
export function sipsPerServing(drink: DrinkDefinition): number {
  return Math.max(1, Math.round(drink.defaultVolumeMl / drink.sipSizeMl));
}

export function sipUnit(drink: DrinkDefinition, count: number): string {
  if (drink.sipIsUnit) return count === 1 ? 'Shot' : 'Shots';
  return count === 1 ? 'Schluck' : 'Schlucke';
}

export function findDrink(id: string, customs: DrinkDefinition[] = []): DrinkDefinition {
  return (
    customs.find((d) => d.id === id) ??
    DRINK_CATALOG.find((d) => d.id === id) ??
    DRINK_CATALOG[0]
  );
}

/** Baut ein Custom-Getränk aus Nutzereingaben. */
export function createCustomDrink(input: {
  name: string;
  volumeMl: number;
  abvPercent: number;
  icon?: IconName;
  category?: DrinkCategory;
}): DrinkDefinition {
  const abv = clamp(input.abvPercent, 0, 60);
  const volume = clamp(input.volumeMl, 10, 1000);
  // Starke Sachen trinkt man in kleinen Schlucken, Bier in großen.
  const sipSize = abv >= 25 ? Math.min(volume, 20) : abv >= 15 ? 25 : abv >= 8 ? 30 : 40;
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: input.name.trim() || 'Eigenes Getränk',
    category: input.category ?? (abv >= 25 ? 'spirit' : abv >= 8 ? 'cocktail' : 'beer'),
    icon: input.icon ?? 'sparkles',
    defaultVolumeMl: volume,
    abvPercent: abv,
    sipSizeMl: sipSize,
    sipIsUnit: abv >= 25 && volume <= 40,
    custom: true,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
