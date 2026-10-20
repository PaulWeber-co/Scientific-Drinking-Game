import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAUSE_MS, bacEvents, closeStaleNight, defaultProfile, migratePlayer, usePlayer } from './player';
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

/** Zwei Abende trennt eine Pause – nicht erst die 14-Stunden-Grenze. */
describe('Pause trennt Abende', () => {
  const H = 3_600_000;
  const vormittag = new Date(2026, 8, 12, 11, 0, 0).getTime();

  beforeEach(() => {
    usePlayer.setState({ ...usePlayer.getInitialState(), profile: defaultProfile() });
    useNights.setState({ nights: [], current: [] });
  });
  afterEach(() => vi.useRealTimers());

  it('ein Spiel am Vormittag und ein Getränk am Abend sind zwei Abende', () => {
    vi.useFakeTimers();
    vi.setSystemTime(vormittag);
    usePlayer.getState().beginNight();
    vi.setSystemTime(vormittag + 9 * H);
    usePlayer.getState().logEvent(makeDrinkEvent(findDrink('beer-pils', []), 3));
    expect(usePlayer.getState().nightStartedAt).toBe(vormittag + 9 * H);
    expect(usePlayer.getState().log).toHaveLength(1);
  });

  it('innerhalb der Pause bleibt es derselbe Abend', () => {
    vi.useFakeTimers();
    vi.setSystemTime(vormittag);
    usePlayer.getState().beginNight();
    vi.setSystemTime(vormittag + PAUSE_MS - 1000);
    usePlayer.getState().beginNight();
    vi.setSystemTime(vormittag + 2 * PAUSE_MS - 2000);
    usePlayer.getState().beginNight();
    expect(usePlayer.getState().nightStartedAt).toBe(vormittag);
  });

  it('schließt einen pausierten Abend auch beim Start der App', () => {
    usePlayer.setState({ nightStartedAt: vormittag, lastActiveAt: vormittag });
    closeStaleNight(usePlayer.getState(), vormittag + PAUSE_MS + 1);
    expect(usePlayer.getState().nightStartedAt).toBeNull();
  });

  it('erhält beim automatischen Abendwechsel den Restalkohol des alten Abends', () => {
    vi.useFakeTimers();
    vi.setSystemTime(vormittag);
    usePlayer.getState().logSips(120);
    const [previous] = usePlayer.getState().log;

    const now = vormittag + PAUSE_MS + 1;
    vi.setSystemTime(now);
    usePlayer.getState().logSips(2);

    const state = usePlayer.getState();
    expect(state.nightStartedAt).toBe(now);
    expect(state.lastActiveAt).toBe(now);
    expect(state.log).toHaveLength(1);
    expect(state.carryoverLog).toEqual([previous]);
    expect(useNights.getState().nights[0].log).toEqual([previous]);
    const expected = estimateBac([previous, ...state.log], state.profile!, now);
    expect(expected.bac).toBeGreaterThan(0.1);
    expect(estimateBac(bacEvents(state), state.profile!, now)).toEqual(expected);
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

  it('übernimmt v4-Aktivitätsdaten und ergänzt die Resthistorie beim Laden', async () => {
    const now = Date.now();
    const log = [makeDrinkEvent(findDrink('beer-pils'), 2, 'glas', now - 1000)];
    localStorage.setItem('sdg.player', JSON.stringify({
      version: 4,
      state: {
        profile: defaultProfile(), log, nightStartedAt: now - 2000, lastActiveAt: now,
      },
    }));

    await usePlayer.persist.rehydrate();

    expect(usePlayer.getState().log).toEqual(log);
    expect(usePlayer.getState().carryoverLog).toEqual([]);
    expect(usePlayer.getState().lastActiveAt).toBe(now);
  });

  it('erhält v5-Resthistorie ohne Aktivitätsfeld und nutzt die letzte Logzeit', async () => {
    const now = Date.now();
    const carryoverLog = [makeDrinkEvent(findDrink('beer-pils'), 40, 'glas', now - 2 * 3_600_000)];
    const log = [makeDrinkEvent(findDrink('beer-pils'), 2, 'glas', now - 1000)];
    // v5 vor dem Merge kannte lastActiveAt noch nicht. Frische Defaults
    // entsprechen dem Zustand vor der ersten Rehydration beim App-Start.
    usePlayer.setState(usePlayer.getInitialState());
    localStorage.setItem('sdg.player', JSON.stringify({
      version: 5,
      state: {
        profile: defaultProfile(), carryoverLog, log,
        nightStartedAt: now - 7 * 3_600_000,
      },
    }));

    await usePlayer.persist.rehydrate();

    expect(usePlayer.getState().carryoverLog).toEqual(carryoverLog);
    expect(usePlayer.getState().log).toEqual(log);
    expect(usePlayer.getState().nightStartedAt).toBe(now - 7 * 3_600_000);
    expect(usePlayer.getState().lastActiveAt).toBeNull();
  });
});
