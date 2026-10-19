import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { estimateBac } from '../../engine/bac';
import { findDrink } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';
import type { SipResult } from '../../engine/types';
import type { GamePlayer } from '../../games/types';
import { defaultProfile, usePlayer } from '../../store/player';
import { useFilm } from '../../store/film';
import { useNights } from '../../store/nights';
import { PartyProvider, useParty, type PartyValue } from './PartyContext';
import { useSipsForPlayer } from './sips';

const NOW = new Date('2026-10-19T20:00:00Z').getTime();
let api!: PartyValue;
let dose: SipResult | null;

function Probe() {
  api = useParty();
  dose = useSipsForPlayer(api.players.find((p) => p.local) ?? null, 3);
  return null;
}

function setup() {
  return render(<PartyProvider><Probe /></PartyProvider>);
}

function addGuest() {
  act(() => api.addLocalPlayer({
    name: 'Mia', color: 'pink', profile: { ...defaultProfile(), name: 'Mia' }, drinkId: 'wine-red',
  }));
  return api.players.find((p) => p.local)!;
}

const guest = () => api.players.find((p) => p.local)!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  sessionStorage.clear();
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    log: [], carryoverLog: [], customDrinks: [], nightStartedAt: null,
    waterCount: 0, preloadAskedAt: null,
  });
  useNights.setState({ nights: [], current: [] });
  useFilm.setState({ photos: [], pendingDeletes: [], mine: 0, rolls: 1, usedHigh: 0 });
});
afterEach(() => vi.useRealTimers());

describe('Abend und Restalkohol von Pass-&-Play-Gästen', () => {
  it('beginnt den Abend auch bei einem Getränk ausschließlich für einen Gast', () => {
    setup();
    const mia = addGuest();
    act(() => api.logSipsFor(mia.id, 20, 'glas'));

    expect(usePlayer.getState().nightStartedAt).toBe(NOW);
    expect(usePlayer.getState().log).toHaveLength(0);
    expect(guest().local?.log).toHaveLength(1);
  });

  it('beginnt bei ungültigen Mengen oder unbekannten Personen keinen Abend', () => {
    setup();
    const mia = addGuest();
    act(() => api.logSipsFor(mia.id, 0));
    act(() => api.logSipsFor('gibt-es-nicht', 3));
    expect(usePlayer.getState().nightStartedAt).toBeNull();
  });

  it('trennt abgeschlossene Gastlogs vom neuen Abend und erhält deren Dosierung', () => {
    setup();
    const mia = addGuest();
    act(() => api.logSipsFor(mia.id, 20, 'glas'));
    const previousDose = dose;
    const [event] = guest().local!.log;
    expect(previousDose?.phase).toBe('over');

    act(() => usePlayer.getState().endNight());

    expect(guest().local?.log).toHaveLength(0);
    expect(guest().local?.carryoverLog).toEqual([event]);
    expect(dose).toEqual(previousDose);
    expect(usePlayer.getState().nightStartedAt).toBeNull();

    act(() => api.logSipsFor(mia.id, 2, 'glas'));
    expect(guest().local?.log).toHaveLength(1);
    expect(guest().local?.carryoverLog).toEqual([event]);
    expect(useNights.getState().nights).toHaveLength(1);
  });

  it('erhält getrennte Gastlogs und Restalkohol nach dem Neuladen', () => {
    const view = setup();
    const mia = addGuest();
    act(() => api.logSipsFor(mia.id, 20, 'glas'));
    act(() => usePlayer.getState().endNight());
    const previousDose = dose;
    view.unmount();

    setup();
    expect(guest().local?.log).toHaveLength(0);
    expect(guest().local?.carryoverLog).toHaveLength(1);
    expect(dose).toEqual(previousDose);
  });

  it('trennt Gastlogs auch wenn der alte Abend vor dem Provider-Mount automatisch abgeschlossen wurde', () => {
    const profile = { ...defaultProfile(), name: 'Mia' };
    const event = makeDrinkEvent(findDrink('wine-red'), 20, 'glas', NOW - 30 * 60_000);
    const saved: GamePlayer = {
      id: 'gast', name: 'Mia', color: 'pink', local: { profile, drinkId: 'wine-red', log: [event] },
    };
    sessionStorage.setItem('sdg.local-players', JSON.stringify([saved]));
    setup();

    expect(guest().local?.log).toHaveLength(0);
    expect(guest().local?.carryoverLog).toEqual([event]);
    expect(estimateBac(guest().local!.carryoverLog!, profile).effective).toBeGreaterThan(0);
    expect(dose?.phase).toBe('over');
  });

  it('verwirft konservativ vollständig abgebauten Gast-Restalkohol vor dem nächsten Abend', () => {
    setup();
    const mia = addGuest();
    act(() => api.logSipsFor(mia.id, 20, 'glas'));
    act(() => usePlayer.getState().endNight());
    act(() => vi.advanceTimersByTime(48 * 3_600_000));
    act(() => api.logSipsFor(mia.id, 1, 'glas'));

    expect(guest().local?.log).toHaveLength(1);
    expect(guest().local?.carryoverLog).toHaveLength(0);
  });
});
