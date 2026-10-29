import { expect, it } from 'vitest';
import { CATEGORY_ORDER, DRINK_CATALOG } from '../../../engine/drinks';
import { GLASS_PROFILES, glassFor, halfWidthAt, liquidFor, shapeFor } from './glassShapes';

it('liefert für den gesamten Katalog Formen und Farben', () => {
  expect(DRINK_CATALOG.length).toBeGreaterThan(0);
  let checked = 0;
  for (const drink of DRINK_CATALOG) {
    const profile = GLASS_PROFILES[shapeFor(drink.category)];
    expect(profile.height).toBeGreaterThan(0);
    for (const color of [liquidFor(drink).top, liquidFor(drink).mid, liquidFor(drink).bottom]) {
      expect(color).toMatch(/^(#[a-f\d]{6}|rgba\([\d.,\s]+\))$/i);
    }
    // Bier hat eine Krone, Sekt einen hauchdünnen Rand, Stilles keinen Schaum.
    if (drink.category === 'beer') expect(liquidFor(drink).foamHeight).toBeGreaterThanOrEqual(8);
    else if (drink.category !== 'sparkling') expect(liquidFor(drink).foam).toBe(false);
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

it('gibt Weißbier und Spritz ihr eigenes Glas', () => {
  const drink = (id: string) => DRINK_CATALOG.find((d) => d.id === id)!;
  expect(glassFor(drink('beer-wheat'))).toBe('weizen');
  expect(glassFor(drink('aperol'))).toBe('spritz');
  expect(glassFor(drink('beer-pils'))).toBe('pint');
});

it('gibt eigenen Getränken den Look ihrer Gruppe, aber keine fremde Beilage', () => {
  const custom = { ...DRINK_CATALOG[0], id: 'custom-mexikaner', category: 'spirit' as const };
  expect(liquidFor(custom).garnish).toBeUndefined();
  expect(liquidFor(custom).saltRim).toBeUndefined();
  expect(liquidFor(DRINK_CATALOG.find((d) => d.id === 'shot-tequila')!).saltRim).toBe(true);
});

it('führt die Kontur glatt und stetig von unten bis zum Rand', () => {
  for (const profile of Object.values(GLASS_PROFILES)) {
    let last = -1;
    for (let y = 0; y <= profile.height; y += 1) {
      const w = halfWidthAt(profile, y);
      expect(w).toBeGreaterThan(0);
      // Am Kelchboden läuft die Wand flach aus, Sprünge gibt es nirgends.
      if (last >= 0) expect(Math.abs(w - last)).toBeLessThan(4);
      last = w;
    }
    expect(halfWidthAt(profile, profile.height)).toBeCloseTo(profile.points[profile.points.length - 1][0], 5);
  }
});
