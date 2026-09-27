import { beforeEach, describe, expect, it } from 'vitest';
import { migratePlayer, usePlayer } from './player';
import { createCustomDrink, findDrink } from '../engine/drinks';
import { makeDrinkEvent } from '../engine/sips';

/** `removeEvent` nimmt einen bestimmten Eintrag – nicht den letzten wie `undoLast`. */
describe('removeEvent', () => {
  beforeEach(() => {
    usePlayer.setState({ log: [], nightStartedAt: null });
  });

  it('entfernt genau den Eintrag mit dieser Kennung, auch mitten im Log', () => {
    const pils = findDrink('beer-pils');
    const a = makeDrinkEvent(pils, 1, 'glas', 1);
    const b = makeDrinkEvent(pils, 2, 'glas', 2);
    const c = makeDrinkEvent(pils, 3, 'glas', 3);
    usePlayer.setState({ log: [a, b, c] });

    usePlayer.getState().removeEvent(b.id);

    expect(usePlayer.getState().log.map((e) => e.sips)).toEqual([1, 3]);
  });
});

describe('migratePlayer', () => {
  it('macht aus einem alten 4-cl-Shot wieder ein ganzes Glas', () => {
    // So legte die App bis v3 einen 4-cl-Shot an: Glas 40 ml, Shot 20 ml.
    const alt = {
      ...createCustomDrink({ name: 'Tequila', volumeMl: 40, abvPercent: 38 }),
      sipSizeMl: 20,
    };
    const bier = createCustomDrink({ name: 'Hausbier', volumeMl: 500, abvPercent: 5 });
    const neu = migratePlayer({ profile: null, customDrinks: [alt, bier] }, 3) as {
      customDrinks: { sipSizeMl: number }[];
    };
    expect(neu.customDrinks[0].sipSizeMl).toBe(40);
    expect(neu.customDrinks[1].sipSizeMl).toBe(bier.sipSizeMl);
  });

  it('lässt aktuelle Stände unberührt', () => {
    const shot = {
      ...createCustomDrink({ name: 'X', volumeMl: 40, abvPercent: 40 }),
      sipSizeMl: 20,
    };
    const neu = migratePlayer({ customDrinks: [shot] }, 4) as {
      customDrinks: { sipSizeMl: number }[];
    };
    expect(neu.customDrinks[0].sipSizeMl).toBe(20);
  });
});
