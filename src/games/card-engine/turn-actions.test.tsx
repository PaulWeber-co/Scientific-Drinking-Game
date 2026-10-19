import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { neverHaveIEver } from '../never-have-i-ever';
import { truthOrDare } from '../truth-or-dare';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { useApp } from '../../store/app';
import type { GameAction, GamePlayer } from '../types';

const players: GamePlayer[] = [
  { id: 'p0', name: 'Paul', color: 'blue', online: true },
  { id: 'p1', name: 'Lena', color: 'pink', online: true },
  { id: 'p2', name: 'Toni', color: 'green', online: true },
];

beforeEach(() => useApp.setState({ gameLength: 'mittel', spicy: {} }));

describe('Karten-Spiele: verspätete Aktionen', () => {
  it('blättert nur eine Karte weiter, wenn zwei Online-Handys gleichzeitig fertig sind', () => {
    const state = neverHaveIEver.createState(players);
    const actions: GameAction[] = [];
    const Game = neverHaveIEver.Component;
    render(
      <MemoryRouter>
        {players.slice(0, 2).map((me) => (
          <PartyCtx.Provider key={me.id} value={{ me, players } as unknown as PartyValue}>
            <Game
              state={state}
              players={players}
              me={me}
              isHost={me.id === 'p0'}
              online
              dispatch={(action) => actions.push({ ...action, by: me.id })}
              quit={() => {}}
            />
          </PartyCtx.Provider>
        ))}
      </MemoryRouter>,
    );

    // Beide Geräte zeigen noch dieselbe Karte, während die Aktionen reisen.
    for (const button of screen.getAllByRole('button', { name: /Nie gemacht/ })) {
      fireEvent.click(button);
    }
    for (const button of screen.getAllByRole('button', { name: 'Nächste Karte' })) {
      fireEvent.click(button);
    }
    expect(actions).toHaveLength(2);
    const next = neverHaveIEver.reduce(state, actions[0], players);
    expect(next.turnIndex).toBe(1);
    expect(neverHaveIEver.reduce(next, actions[1], players)).toBe(next);
  });

  it('wendet eine alte Erledigt-Aktion nicht auf den nächsten Spieler an', () => {
    let state = truthOrDare.createState(players);
    const turnKey = `${state.round}:${state.turnIndex}`;
    state = truthOrDare.reduce(
      state,
      { type: 'pickMode', mode: 'wahrheit', by: 'p0', turnKey },
      players,
    );
    state = truthOrDare.reduce(state, { type: 'resolve', by: 'p0', turnKey }, players);
    state = truthOrDare.reduce(state, { type: 'next', by: 'p0', turnKey }, players);
    expect(state.phase).toBe('choose');
    expect(truthOrDare.reduce(state, { type: 'resolve', by: 'p0', turnKey }, players)).toBe(state);
  });
});
