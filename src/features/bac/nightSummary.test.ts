import { describe, expect, it } from 'vitest';
import { estimateBac, soberAt } from '../../engine/bac';
import { findDrink } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';
import { defaultProfile } from '../../store/player';
import { buildNightSummary } from './nightSummary';

describe('Rückblick mit Restalkohol', () => {
  it('rechnet den Pegel mit Restalkohol, zählt aber nur die aktuellen Getränke', () => {
    const now = new Date('2026-10-19T22:00:00Z').getTime();
    const profile = defaultProfile();
    const beer = findDrink('beer-pils');
    const previous = makeDrinkEvent(beer, 40, 'glas', now - 3_600_000);
    const current = makeDrinkEvent(beer, 2, 'glas', now);
    const events = [previous, current];
    const summary = buildNightSummary([current], profile, 1, now, events)!;

    expect(summary.calls).toBe(1);
    expect(summary.totalGrams).toBe(current.alcoholGrams);
    expect(summary.soberAt).toBe(soberAt(events, profile, now));
    expect(summary.soberAt).toBeGreaterThan(soberAt([current], profile, now));
    expect(summary.peakBac).toBeGreaterThanOrEqual(estimateBac(events, profile, now).bac);
    expect(summary.peakAt).toBeGreaterThanOrEqual(now);
  });
});
