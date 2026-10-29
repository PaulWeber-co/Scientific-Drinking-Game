import { expect, it } from 'vitest';
import { CATEGORY_ORDER, DRINK_CATALOG } from '../../../engine/drinks';
import { GLASS_PROFILES, liquidFor, shapeFor } from './glassShapes';

it('liefert für den gesamten Katalog Formen und Farben', () => {
  expect(DRINK_CATALOG.length).toBeGreaterThan(0);
  let checked = 0;
  for (const drink of DRINK_CATALOG) {
    const profile = GLASS_PROFILES[shapeFor(drink.category)];
    expect(profile.height).toBeGreaterThan(0);
    for (const color of [liquidFor(drink).top, liquidFor(drink).mid, liquidFor(drink).bottom]) {
      expect(color).toMatch(/^(#[a-f\d]{6}|rgba\([\d.,\s]+\))$/i);
    }
    expect(liquidFor(drink).foam).toBe(drink.category === 'beer');
    checked++;
  }
  expect(checked).toBe(DRINK_CATALOG.length);
});
it.each(CATEGORY_ORDER)('unterstützt eigene Getränke: %s', (category) => {
  const drink = { ...DRINK_CATALOG[0], id: 'custom-test', category };
  expect(GLASS_PROFILES[shapeFor(category)]).toBeDefined();
  const liquid = liquidFor(drink);
  for (const color of [liquid.top, liquid.mid, liquid.bottom])
    expect(color).toMatch(/^#[a-f\d]{6}$/i);
});

it('ordnet jede Gruppe ihrem Glas zu, Alkoholfrei teilt sich das Longdrinkglas', () => {
  const erwartet = {
    beer: 'pint',
    wine: 'wine',
    sparkling: 'flute',
    cocktail: 'tumbler',
    longdrink: 'highball',
    soft: 'highball',
    spirit: 'shot',
  } as const;
  expect(Object.keys(erwartet).sort()).toEqual([...CATEGORY_ORDER].sort());
  for (const c of CATEGORY_ORDER) expect(shapeFor(c), c).toBe(erwartet[c]);
  expect(new Set(CATEGORY_ORDER.map(shapeFor)).size).toBe(6);
});

it('fällt bei einer unbekannten Gruppe aus dem Speicher auf das neutrale Glas zurück', () => {
  const kaputt = { ...DRINK_CATALOG[0], id: 'custom-alt', category: 'punsch' as never };
  expect(shapeFor(kaputt.category)).toBe('highball');
  expect(liquidFor(kaputt).top).toMatch(/^#[0-9a-f]{6}$/i);
});
