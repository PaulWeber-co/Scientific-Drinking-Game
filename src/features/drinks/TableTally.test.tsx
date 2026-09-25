import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TableTally } from './TableTally';
import { PartyCtx, type PartyValue } from '../party/PartyContext';
import { defaultProfile, usePlayer } from '../../store/player';
import { findDrink, sipsPerServing } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';
import type { GamePlayer } from '../../games/types';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

/**
 * „Der Tisch" ist die Antwort auf „wer hat wie viel". Er liest zwei Logs:
 * meins aus dem Store, das der Gäste aus der Runde – und muss beide auch
 * wieder korrigieren können.
 */

const JETZT = new Date('2026-09-11T22:00:00Z').getTime();
const PILS = sipsPerServing(findDrink('beer-pils'));

const me: GamePlayer = { id: 'p0', name: 'Paul', color: 'blue', online: true };
const gast = (log = [makeDrinkEvent(findDrink('wine-red'), 10, 'glas', JETZT - 3_600_000)]): GamePlayer => ({
  id: 'p1',
  name: 'Mia',
  color: 'pink',
  online: true,
  local: { profile: { ...defaultProfile(), name: 'Mia' }, drinkId: 'wine-red', log },
});

const removeEventFor = vi.fn();

function mount(players: GamePlayer[], mode: 'local' | 'online' = 'local', hideEmpty = false) {
  const value = { mode, players, me, removeEventFor } as unknown as PartyValue;
  return render(
    <PartyCtx.Provider value={value}>
      <TableTally hideEmpty={hideEmpty} />
    </PartyCtx.Provider>,
  );
}

beforeEach(() => {
  removeEventFor.mockClear();
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    onboarded: true,
    currentDrinkId: 'beer-pils',
    customDrinks: [],
    log: [],
  });
});

describe('Der Tisch', () => {
  it('zeigt je Person die Gläser je Getränk', () => {
    usePlayer.setState({ log: [makeDrinkEvent(findDrink('beer-pils'), PILS * 2, 'glas', JETZT)] });
    mount([me, gast()]);

    expect(screen.getByText('2 Bier (Pils)')).toBeTruthy();
    expect(screen.getByText('1 Rotwein')).toBeTruthy();
    expect(screen.getByText('Mia')).toBeTruthy();
  });

  it('bleibt bei einer Person unsichtbar', () => {
    mount([me]);
    expect(screen.queryByText('Der Tisch')).toBeNull();
  });

  it('versteckt sich mit hideEmpty, solange niemand etwas hat', () => {
    mount([me, gast([])], 'local', true);
    expect(screen.queryByText('Der Tisch')).toBeNull();
  });

  it('erscheint mit hideEmpty, sobald ein Gast etwas hat', () => {
    // Gegenprobe: derselbe Aufruf, nur das Gast-Log ist nicht leer.
    mount([me, gast()], 'local', true);
    expect(screen.getByText('Der Tisch')).toBeTruthy();
  });

  it('klappt die Einträge eines Gastes auf und entfernt einen davon', () => {
    // Ohne diesen Weg ist ein Fehlgriff für einen Gast nirgends korrigierbar:
    // das Trink-Log im Pegel-Tab zeigt nur mein eigenes.
    const g = gast();
    mount([me, g]);
    fireEvent.click(screen.getByRole('button', { name: 'Einträge von Mia' }));
    fireEvent.click(screen.getByRole('button', { name: /^Eintrag .* entfernen$/ }));

    expect(removeEventFor).toHaveBeenCalledWith('p1', g.local!.log[0].id);
  });

  it('kennt bei Gästen die eigenen Getränke dieses Geräts', () => {
    const eigenes = { ...findDrink('wine-red'), id: 'custom-1', name: 'Omas Likör', custom: true };
    usePlayer.setState({ customDrinks: [eigenes] });
    mount([me, gast([makeDrinkEvent(eigenes, sipsPerServing(eigenes), 'glas', JETZT)])]);

    expect(screen.getByText('1 Omas Likör')).toBeTruthy();
  });

  it('zeigt online von anderen nur die Zone', () => {
    const anderer: GamePlayer = { id: 'p2', name: 'Nils', color: 'teal', online: true, zone: 'sweet' };
    mount([me, anderer], 'online');
    expect(screen.queryByText('noch nichts eingetragen')).toBeTruthy(); // ich
    expect(screen.queryByRole('button', { name: 'Einträge von Nils' })).toBeNull();
    expect(screen.getByText(/Trinkmengen bleiben auf jedem Handy/)).toBeTruthy();
  });
});
