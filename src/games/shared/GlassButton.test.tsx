import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { GlassButton } from './GlassButton';
import { PartyCtx, PartyProvider, useParty, type PartyValue } from '../../features/party/PartyContext';
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
const removeEventFor = vi.fn();

function mount(patch: Partial<PartyValue> = {}) {
  const value = {
    mode: 'online',
    players: [me],
    me,
    logSipsFor,
    removeEventFor,
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
  logSipsFor.mockReset().mockReturnValue('glass-entry');
  removeEventFor.mockClear();
  sessionStorage.clear();
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
  it.each(['online', 'local'] as const)('öffnet den sichtbaren erweiterten Eintrag auch %s ohne langen Druck', (mode) => {
    mount({ mode });
    fireEvent.click(screen.getByRole('button', { name: 'Anderes Getränk oder andere Menge eintragen' }), { detail: 0 });
    expect(screen.getByRole('dialog', { name: 'Getränk eintragen' })).toBeInTheDocument();
    expect(logSipsFor).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '0,5 l' }));
    fireEvent.click(screen.getByRole('button', { name: '0,5 l Bier (Pils) eintragen' }), { detail: 0 });
    expect(logSipsFor).toHaveBeenCalledWith('p0', 13, 'glas', { drinkId: 'beer-pils', volumeMl: 500, at: expect.any(Number) });
    expect(screen.getByRole('status')).toHaveTextContent('0,5 l Bier (Pils) eingetragen');
  });
  it('bucht auch über native Tastatur- oder Screenreader-Aktivierung ohne Pointer', () => {
    mount();
    fireEvent.click(glas(), { detail: 0 });

    expect(logSipsFor).toHaveBeenCalledExactlyOnceWith('p0', PILS, 'glas', { volumeMl: 330 });
  });

  it('nennt das eingestellte Getränk, damit der Tap keine Überraschung ist', () => {
    mount();
    expect(glas().getAttribute('aria-label')).toBe('Glas Bier (Pils) eintragen');
  });

  it('bucht mit einem Tap ein ganzes Glas', () => {
    mount();
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());
    fireEvent.click(glas(), { detail: 1 });

    expect(logSipsFor).toHaveBeenCalledTimes(1);
    expect(logSipsFor).toHaveBeenCalledWith('p0', PILS, 'glas', { volumeMl: 330 });
  });

  it('rechnet das Glas aus dem Getränk, nicht aus einer festen Zahl', () => {
    // Gegenprobe zum Test darüber: ein Shot ist EIN Schluck, ein Pils acht.
    // Eine feste Zahl im Knopf würde beides gleich buchen.
    usePlayer.setState({ currentDrinkId: 'shot-tequila' });
    mount();
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());
    fireEvent.click(glas(), { detail: 1 });

    expect(logSipsFor).toHaveBeenCalledWith('p0', sipsPerServing(findDrink('shot-tequila')), 'glas', { volumeMl: 20 });
    expect(sipsPerServing(findDrink('shot-tequila'))).not.toBe(PILS);
  });

  it('bietet danach ein Rückgängig für dieselbe Person', () => {
    mount();
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());
    fireEvent.click(glas(), { detail: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(removeEventFor).toHaveBeenCalledWith('p0', 'glass-entry');
  });

  it('nimmt das Rückgängig nach acht Sekunden weg', () => {
    vi.useFakeTimers();
    mount();
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());
    fireEvent.click(glas(), { detail: 1 });
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
    fireEvent.click(glas(), { detail: 1 });

    // Der lange Druck darf NICHT zusätzlich ein Glas buchen.
    expect(logSipsFor).not.toHaveBeenCalled();
    expect(screen.getByText('½ Glas')).toBeTruthy();
    expect(screen.getByText('1 Std her')).toBeTruthy();
  });

  it('bucht ein halbes Glas als halbe Schluckzahl', () => {
    vi.useFakeTimers();
    mount();
    fireEvent.pointerDown(glas());
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(glas());
    fireEvent.click(glas(), { detail: 1 });

    fireEvent.click(screen.getByText('½ Glas'));
    fireEvent.click(screen.getByRole('button', { name: '½ Glas Bier (Pils) eintragen' }));

    expect(logSipsFor).toHaveBeenCalledWith('p0', Math.round(PILS / 2), 'glas', {
      drinkId: 'beer-pils',
      volumeMl: 165,
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
    fireEvent.click(glas(), { detail: 1 });

    fireEvent.click(screen.getByRole('button', { name: '1× Tequila / Wodka eintragen' }));

    expect(logSipsFor).toHaveBeenCalledWith('p0', 1, 'glas', {
      drinkId: 'shot-tequila',
      volumeMl: 20,
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

    expect(screen.queryByText('½ Glas')).toBeNull();
  });
});

describe('Glas-Knopf auf einem geteilten Handy', () => {
  it('öffnet die Personenauswahl auch ohne Pointer-Ereignisse', () => {
    mount({ mode: 'local', players: [me, mia] });
    fireEvent.click(glas(), { detail: 0 });

    expect(screen.getByText('Wer hat ausgetrunken?')).toBeInTheDocument();
    expect(logSipsFor).not.toHaveBeenCalled();
  });

  it('fragt zuerst, wer ausgetrunken hat', () => {
    mount({ mode: 'local', players: [me, mia] });
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());
    fireEvent.click(glas(), { detail: 1 });

    // Kein stiller Eintrag auf den Gerätebesitzer: bei Pass & Play sitzen
    // mehrere Leute an einem Handy.
    expect(logSipsFor).not.toHaveBeenCalled();
    expect(screen.getByText('Wer hat ausgetrunken?')).toBeTruthy();
  });

  it('bucht auf den Gast, der ausgewählt wurde', () => {
    mount({ mode: 'local', players: [me, mia] });
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());
    fireEvent.click(glas(), { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Mia/ }));

    expect(logSipsFor).toHaveBeenCalledWith('p1', sipsPerServing(findDrink('wine-red')), 'glas', { volumeMl: 200 });
  });

  it('führt aus der Rückfrage zum vollen Eintragen – der zweite Weg neben dem langen Druck', () => {
    mount({ mode: 'local', players: [me, mia] });
    fireEvent.pointerDown(glas());
    fireEvent.pointerUp(glas());
    fireEvent.click(glas(), { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Anderes Getränk oder andere Menge …' }));

    fireEvent.click(screen.getByRole('button', { name: 'Mia' }));
    fireEvent.click(screen.getByRole('button', { name: '1 Glas Rotwein eintragen' }));

    expect(logSipsFor).toHaveBeenCalledWith('p1', sipsPerServing(findDrink('wine-red')), 'glas', {
      drinkId: 'wine-red',
      volumeMl: 200,
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
    fireEvent.click(glas(), { detail: 1 });

    expect(logSipsFor).toHaveBeenCalledWith('p0', PILS, 'glas', { volumeMl: 330 });
  });
});

describe('Rückgängig nach zwischenzeitlichen Spielansagen', () => {
  it.each(['ich', 'gast'] as const)('entfernt bei %s das Glas und behält den neueren Spieleintrag', (target) => {
    let party!: PartyValue;
    function Probe() {
      party = useParty();
      return <GlassButton />;
    }
    render(<PartyProvider><Probe /></PartyProvider>);
    act(() => party.startLocal());
    if (target === 'gast') {
      act(() => party.addLocalPlayer({
        name: 'Mia', color: 'pink',
        profile: { ...defaultProfile(), name: 'Mia' }, drinkId: 'wine-red',
      }));
    }
    const playerId = target === 'ich' ? party.me.id : party.players.find((p) => p.name === 'Mia')!.id;
    const log = () => target === 'ich'
      ? usePlayer.getState().log
      : party.players.find((p) => p.id === playerId)!.local!.log;

    fireEvent.click(glas());
    if (target === 'gast') fireEvent.click(screen.getByRole('button', { name: /Mia/ }));
    const glassId = log()[0].id;
    act(() => { party.logSipsFor(playerId, 3, 'kings-cup'); });
    const gameId = log()[1].id;
    expect(log()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));

    expect(log()).toHaveLength(1);
    expect(log()[0]).toMatchObject({ id: gameId, source: 'kings-cup' });
    expect(log().some((entry) => entry.id === glassId)).toBe(false);
  });
});
