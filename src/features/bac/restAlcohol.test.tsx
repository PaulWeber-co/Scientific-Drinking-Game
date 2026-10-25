import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { defaultProfile, usePlayer } from '../../store/player';
import { findDrink } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';
import { PartyCtx, type PartyValue } from '../party/PartyContext';
import { useMySips } from '../party/sips';
import { useLiveBac } from './useLiveBac';

const NOW = new Date('2026-10-19T22:00:00Z').getTime();
const me = { id: 'self', name: 'Paul', color: 'blue' as const };
const value = { me } as PartyValue;
const wrapper = ({ children }: { children: ReactNode }) => (
  <PartyCtx.Provider value={value}>{children}</PartyCtx.Provider>
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  usePlayer.setState({
    ...usePlayer.getInitialState(),
    profile: defaultProfile(),
    log: [makeDrinkEvent(findDrink('beer-pils'), 40, 'glas', NOW - 3_600_000)],
    nightStartedAt: NOW - 3_600_000,
  });
});

afterEach(() => vi.useRealTimers());

describe('laufende Berechnung nach Abendabschluss', () => {
  it('zeigt weiterhin Pegel und verhindert eine neue Aufbaudosis', () => {
    const { result } = renderHook(() => ({ bac: useLiveBac().estimate, dose: useMySips(3) }), {
      wrapper,
    });
    const before = result.current.bac!.bac;
    expect(before).toBeGreaterThan(0.5);
    expect(result.current.dose!.sips).toBe(0);

    act(() => usePlayer.getState().endNight());
    expect(result.current.bac!.bac).toBe(before);
    expect(result.current.dose!.sips).toBe(0);

    act(() => usePlayer.getState().beginNight());
    expect(result.current.dose!.sips).toBe(0);

    // Nach dem echten Abbau darf die normale Dosierung wieder anlaufen.
    act(() => vi.advanceTimersByTime(24 * 3_600_000));
    expect(result.current.bac!.bac).toBe(0);
    expect(result.current.dose!.sips).toBeGreaterThan(0);
  });
});

describe('frisch eingetragenes Getränk', () => {
  it('zählt sofort mit, nicht erst beim nächsten Takt', () => {
    const { result } = renderHook(() => useLiveBac().estimate, { wrapper });
    const vorher = result.current!.effective;
    // Die Uhr läuft weiter, der 20-s-Takt aber noch nicht: genau die Lücke
    // zwischen Tipp und nächstem Neuberechnen.
    vi.setSystemTime(NOW + 15_000);
    act(() =>
      usePlayer.setState((s) => ({
        log: [...s.log, makeDrinkEvent(findDrink('beer-helles'), 40, 'glas', NOW + 15_000)],
      })),
    );
    expect(result.current!.pending).toBeGreaterThan(0.1);
    expect(result.current!.effective).toBeGreaterThan(vorher + 0.1);
  });
});
