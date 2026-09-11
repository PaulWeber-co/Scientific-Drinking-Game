import { beforeEach, describe, expect, it } from 'vitest';
import { usePlayer } from './player';
import { findDrink } from '../engine/drinks';
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
