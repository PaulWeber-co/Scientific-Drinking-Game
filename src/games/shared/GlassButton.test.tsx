import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { GlassButton } from './GlassButton';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { defaultProfile, usePlayer } from '../../store/player';
import { sipsPerServing } from '../../engine/drinks';
import { findDrink } from '../../engine/drinks';
import type { GamePlayer } from '../types';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

/**
 * Der Glas-Knopf ist die einzige Stelle, an der ein ganzes Getränk mitten im
 * Spiel gebucht wird. Er sitzt im gemeinsamen Rahmen, gilt also für alle 17
 * Spiele – ein Fehler hier trifft jedes davon.
 */

const me: GamePlayer = { id: 'p0', name: 'Paul', color: 'blue', online: true };
const mia: GamePlayer = {
  id: 'p1',
  name: 'Mia',
  color: 'pink',
  online: true,
  local: { profile: { ...defaultProfile(), name: 'Mia' }, drinkId: 'wine-red', log: [] },
};

const logSipsFor = vi.fn();
const undoLastFor = vi.fn();

function mount(patch: Partial<PartyValue> = {}) {
  const value = {
    mode: 'online',
    players: [me],
    me,
    logSipsFor,
    undoLastFor,
    ...patch,
  } as unknown as PartyValue;
  return render(
    <PartyCtx.Provider value={value}>
      <GlassButton />
    </PartyCtx.Provider>,
  );
}

const glas = () => screen.getByRole('button', { name: /^Glas .* eintragen$/ });

/** Ein Glas Pils sind so viele Schlucke – aus dem Katalog, nicht geraten. */
const PILS = sipsPerServing(findDrink('beer-pils'));

beforeEach(() => {
  logSipsFor.mockClear();
  undoLastFor.mockClear();
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    onboarded: true,
    currentDrinkId: 'beer-pils',
    customDrinks: [],
    log: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Glas-Knopf im Spielrahmen', () => {
  it('nennt das eingestellte Getränk, damit der Tap keine Überraschung ist', () => {
    mount();
    expect(glas().getAttribute('aria-label')).toBe('Glas Bier (Pils) eintragen');
  });

  it('bucht mit einem Tap ein ganzes Glas', () => {
    mount();
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());

    expect(logSipsFor).toHaveBeenCalledTimes(1);
    expect(logSipsFor).toHaveBeenCalledWith('p0', PILS, 'glas');
  });

  it('rechnet das Glas aus dem Getränk, nicht aus einer festen Zahl', () => {
    // Gegenprobe zum Test darüber: ein Shot ist EIN Schluck, ein Pils acht.
    // Eine feste Zahl im Knopf würde beides gleich buchen.
    usePlayer.setState({ currentDrinkId: 'shot-tequila' });
    mount();
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());

    expect(logSipsFor).toHaveBeenCalledWith('p0', sipsPerServing(findDrink('shot-tequila')), 'glas');
    expect(sipsPerServing(findDrink('shot-tequila'))).not.toBe(PILS);
  });

  it('bietet danach ein Rückgängig für dieselbe Person', () => {
    mount();
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());

    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(undoLastFor).toHaveBeenCalledWith('p0');
  });

  it('nimmt das Rückgängig nach acht Sekunden weg', () => {
    vi.useFakeTimers();
    mount();
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeTruthy();

    // Kurz davor steht es noch – sonst pruefte der Test nur, dass es
    // irgendwann verschwindet, nicht wann.
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
  });

  it('öffnet beim langen Druck das volle Eintragen statt zu buchen', () => {
    vi.useFakeTimers();
    mount();
    fireEvent.pointerDown(glas());
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(glas());

    // Der lange Druck darf NICHT zusätzlich ein Glas buchen.
    expect(logSipsFor).not.toHaveBeenCalled();
    expect(screen.getByText('Halbes')).toBeTruthy();
    expect(screen.getByText('1 Std her')).toBeTruthy();
  });

  it('bucht ein halbes Glas als halbe Schluckzahl', () => {
    vi.useFakeTimers();
    mount();
    fireEvent.pointerDown(glas());
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(glas());

    fireEvent.click(screen.getByText('Halbes'));
    fireEvent.click(screen.getByRole('button', { name: '½ Glas Bier (Pils) eintragen' }));

    expect(logSipsFor).toHaveBeenCalledWith('p0', Math.round(PILS / 2), 'glas', {
      drinkId: 'beer-pils',
      at: expect.any(Number),
    });
    expect(screen.getByText('½ Glas Bier (Pils) eingetragen')).toBeTruthy();
  });

  it('bucht ein anderes Getränk, ohne das eingestellte umzustellen', () => {
    // Der Sinn des Umbaus: Bier ist eingestellt, der Shot zwischendurch geht
    // als Shot ins Log – und die nächste Ansage bleibt in Bier.
    vi.useFakeTimers();
    mount();
    fireEvent.pointerDown(glas());
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(glas());

    fireEvent.click(screen.getByRole('button', { name: '1× Tequila / Wodka eintragen' }));

    expect(logSipsFor).toHaveBeenCalledWith('p0', 1, 'glas', {
      drinkId: 'shot-tequila',
      at: expect.any(Number),
    });
    expect(usePlayer.getState().currentDrinkId).toBe('beer-pils');
    expect(glas().getAttribute('aria-label')).toBe('Glas Bier (Pils) eintragen');
  });

  it('bricht den langen Druck ab, wenn der Finger die Fläche verlässt', () => {
    // Ohne diesen Zweig bleibt der Timer stehen und die Mengen springen auf,
    // nachdem der Finger längst weitergewischt ist.
    vi.useFakeTimers();
    mount();
    fireEvent.pointerDown(glas());
    fireEvent.pointerLeave(glas());
    act(() => vi.advanceTimersByTime(500));

    expect(screen.queryByText('Halbes')).toBeNull();
  });
});

describe('Glas-Knopf auf einem geteilten Handy', () => {
  it('fragt zuerst, wer ausgetrunken hat', () => {
    mount({ mode: 'local', players: [me, mia] });
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());

    // Kein stiller Eintrag auf den Gerätebesitzer: bei Pass & Play sitzen
    // mehrere Leute an einem Handy.
    expect(logSipsFor).not.toHaveBeenCalled();
    expect(screen.getByText('Wer hat ausgetrunken?')).toBeTruthy();
  });

  it('bucht auf den Gast, der ausgewählt wurde', () => {
    mount({ mode: 'local', players: [me, mia] });
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());
    fireEvent.click(screen.getByRole('button', { name: /Mia/ }));

    expect(logSipsFor).toHaveBeenCalledWith('p1', PILS, 'glas');
  });

  it('führt aus der Rückfrage zum vollen Eintragen – der zweite Weg neben dem langen Druck', () => {
    mount({ mode: 'local', players: [me, mia] });
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());
    fireEvent.click(screen.getByRole('button', { name: /Anderes Getränk/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Mia' }));
    fireEvent.click(screen.getByRole('button', { name: '1 Glas Rotwein eintragen' }));

    expect(logSipsFor).toHaveBeenCalledWith('p1', sipsPerServing(findDrink('wine-red')), 'glas', {
      drinkId: 'wine-red',
      at: expect.any(Number),
    });
    expect(screen.getByText('1 Glas Rotwein für Mia eingetragen')).toBeTruthy();
  });

  it('nimmt online den direkten Weg, ohne Rückfrage', () => {
    // Gegenprobe: dieselbe Besetzung, aber online – dort gehört jedes Handy
    // genau einer Person, eine Auswahl wäre nur ein Umweg.
    mount({ mode: 'online', players: [me, mia] });
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());

    expect(logSipsFor).toHaveBeenCalledWith('p0', PILS, 'glas');
  });
});
