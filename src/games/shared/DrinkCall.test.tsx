import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DrinkCall } from './DrinkCall';
import {
  PartyCtx,
  PartyProvider,
  useParty,
  type PartyValue,
} from '../../features/party/PartyContext';
import { defaultProfile, usePlayer } from '../../store/player';
import type { GamePlayer } from '../types';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

beforeEach(() =>
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Anna', designatedDriver: true },
    currentDrinkId: 'beer-pils',
    log: [],
    carryoverLog: [],
  }),
);

describe('Trinkansage', () => {
  it('bucht für Fahrer alkoholfrei und behält den Eintrag beim erneuten Rendern', () => {
    let party!: PartyValue;
    function View() {
      party = useParty();
      return <DrinkCall player={party.me} baseSips={3} source="truth-or-dare" compact />;
    }
    const view = render(
      <PartyProvider>
        <View />
      </PartyProvider>,
    );
    act(() => party.startLocal());
    fireEvent.click(screen.getByRole('button', { name: /hat getrunken/ }));
    expect(usePlayer.getState().log).toHaveLength(1);
    expect(usePlayer.getState().log[0]).toMatchObject({
      drinkId: 'soft',
      alcoholGrams: 0,
      sips: 3,
    });
    expect(screen.getByText('Eingetragen')).toBeInTheDocument();
    view.rerender(
      <PartyProvider>
        <View />
      </PartyProvider>,
    );
    expect(screen.getByRole('button', { name: /hat getrunken/ })).toBeDisabled();
    expect(usePlayer.getState().log).toHaveLength(1);
  });

  it.each([true, false])('zeigt bei lokalen Mitspielern=%s den eindeutigen Namen', (shared) => {
    const me: GamePlayer = { id: 'p0', name: 'Anna', color: 'blue', online: true };
    const guest: GamePlayer = {
      id: 'p1',
      name: 'Ben',
      color: 'pink',
      online: true,
      local: { profile: defaultProfile(), drinkId: 'soft', log: [] },
    };
    render(
      <PartyCtx.Provider
        value={
          { me, players: shared ? [me, guest] : [me], logSipsFor: vi.fn() } as unknown as PartyValue
        }
      >
        <DrinkCall player={me} baseSips={3} compact />
      </PartyCtx.Provider>,
    );
    expect(screen.getByText(shared ? 'Anna' : 'Du')).toBeInTheDocument();
    expect(screen.getByText('Eintragen')).toBeInTheDocument();
  });

  it('bietet bei alkoholfreier Härte null keine Ersatzaufgabe an', () => {
    const me: GamePlayer = { id: 'p0', name: 'Anna', color: 'blue', online: true };
    render(
      <PartyCtx.Provider value={{ me, players: [me] } as unknown as PartyValue}>
        <DrinkCall player={me} baseSips={0} />
      </PartyCtx.Provider>,
    );
    expect(screen.queryByText('Stattdessen')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
