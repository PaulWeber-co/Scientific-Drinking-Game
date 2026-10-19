import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bacEvents, closeStaleNight, defaultProfile, migratePlayer, usePlayer } from './player';
import { createCustomDrink, findDrink } from '../engine/drinks';
import { makeDrinkEvent } from '../engine/sips';
import { estimateBac, residualBac, soberAt } from '../engine/bac';
import { useNights } from './nights';

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

describe('Restalkohol nach dem Abendabschluss', () => {
  const now = new Date('2026-10-19T22:00:00Z').getTime();
  const hour = 3_600_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    usePlayer.setState({
      ...usePlayer.getInitialState(),
      profile: defaultProfile(),
      onboarded: true,
      log: [makeDrinkEvent(findDrink('beer-pils'), 40, 'glas', now - hour)],
      nightStartedAt: now - hour,
    });
    useNights.setState({ nights: [], current: [] });
  });

  afterEach(() => vi.useRealTimers());

  it('archiviert das Abendlog, ohne Pegel oder Fahrtprognose auf null zu setzen', () => {
    const before = bacEvents(usePlayer.getState());
    const profile = usePlayer.getState().profile!;
    const bacBefore = estimateBac(before, profile, now);
    const driveBefore = residualBac(before, profile, now + hour);
    expect(bacBefore.bac).toBeGreaterThan(0.5);

    usePlayer.getState().endNight();

    const state = usePlayer.getState();
    expect(state.log).toEqual([]);
    expect(state.nightStartedAt).toBeNull();
    expect(useNights.getState().nights[0].log).toEqual(before);
    expect(estimateBac(bacEvents(state), profile, now)).toEqual(bacBefore);
    expect(residualBac(bacEvents(state), profile, now + hour)).toBe(driveBefore);
  });

  it('behält den Restalkohol nach erneutem Laden und zählt ihn nicht doppelt', async () => {
    usePlayer.getState().endNight();
    const before = bacEvents(usePlayer.getState());
    // Rehydration des gespeicherten Stands, ohne ihn vorher zu überschreiben.
    await usePlayer.persist.rehydrate();
    expect(bacEvents(usePlayer.getState())).toEqual(before);
    usePlayer.getState().endNight();
    expect(bacEvents(usePlayer.getState())).toEqual(before);

    usePlayer.getState().logSips(2);
    expect(bacEvents(usePlayer.getState())).toHaveLength(2);
    expect(usePlayer.getState().log).toHaveLength(1);
    const expectedSoberAt = soberAt(bacEvents(usePlayer.getState()), usePlayer.getState().profile!, now);
    usePlayer.getState().endNight();
    expect(usePlayer.getState().carryoverLog).toHaveLength(2);
    expect(useNights.getState().nights[0].log).toHaveLength(1);
    expect(useNights.getState().nights[0].soberAt).toBe(expectedSoberAt);
    expect(useNights.getState().nights[0].peakAt).toBeGreaterThanOrEqual(now);
  });

  it('bewahrt auch beim automatischen Abschluss einen spät getrunkenen Drink', () => {
    usePlayer.setState({ nightStartedAt: now - 15 * hour });
    closeStaleNight(usePlayer.getState(), now);
    expect(usePlayer.getState().log).toEqual([]);
    expect(estimateBac(bacEvents(usePlayer.getState()), defaultProfile(), now).bac).toBeGreaterThan(0.5);
  });

  it('entfernt die Resthistorie erst nach konservativ berechnetem Abbau', () => {
    usePlayer.getState().endNight();
    vi.setSystemTime(now + 24 * hour);
    usePlayer.getState().beginNight();
    expect(usePlayer.getState().carryoverLog).toEqual([]);
    expect(bacEvents(usePlayer.getState())).toEqual([]);
  });

  it('berücksichtigt Restalkohol auch bei einem rückdatierten Eintrag nach dem Abbau', () => {
    usePlayer.getState().endNight();
    vi.setSystemTime(now + 24 * hour);
    usePlayer.getState().logEvent(makeDrinkEvent(findDrink('beer-pils'), 2, 'vorher', now));
    expect(bacEvents(usePlayer.getState())).toHaveLength(2);
  });

  it('behält beim Neuladen die Historie für einen überlappenden Nachtrag', async () => {
    usePlayer.getState().endNight();
    const profile = usePlayer.getState().profile!;
    const sober = soberAt(bacEvents(usePlayer.getState()), profile, now);
    const later = sober + 60_000;
    vi.setSystemTime(later);
    await usePlayer.persist.rehydrate();

    const entry = makeDrinkEvent(findDrink('beer-pils'), 2, 'vorher', sober - 2 * hour);
    usePlayer.getState().logEvent(entry);
    // Allein wäre der kleine Nachtrag schon abgebaut. Zusammen mit dem
    // vorherigen Abend hat er dessen Abbauzeit aber verlängert.
    expect(residualBac([entry], profile, later)).toBe(0);
    expect(residualBac(bacEvents(usePlayer.getState()), profile, later)).toBeGreaterThan(0.01);
  });

  it('löscht bei „Alle Daten löschen“ auch die Restalkohol-Historie', () => {
    usePlayer.getState().endNight();
    expect(usePlayer.getState().carryoverLog.length).toBeGreaterThan(0);
    usePlayer.getState().resetAll();
    expect(bacEvents(usePlayer.getState())).toEqual([]);
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
