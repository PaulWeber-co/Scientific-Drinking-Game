import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { neverHaveIEver } from '../never-have-i-ever';
import { truthOrDare } from '../truth-or-dare';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { useApp } from '../../store/app';
import type { GameAction, GamePlayer } from '../types';

const players: GamePlayer[] = [
  { id: 'p0', name: 'Paul', color: 'blue', online: true, isHost: true },
  { id: 'p1', name: 'Lena', color: 'pink', online: true },
  { id: 'p2', name: 'Toni', color: 'green', online: true },
];

beforeEach(() => useApp.setState({ gameLength: 'mittel', spicy: {} }));

describe('Karten-Spiele: verspätete Aktionen', () => {
  it('lässt nur den Host weiterblättern und überspringt bei doppeltem Tippen keine Karte', () => {
    const state = {
      ...neverHaveIEver.createState(players),
      declared: { p0: 'no', p1: 'no', p2: 'no' } as const,
    };
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

    // Nur der Host hat den Knopf. Beide Taps entstehen noch auf derselben
    // Ansicht, bevor der neue Zustand über das Netzwerk zurückkommt.
    const buttons = screen.getAllByRole('button', { name: 'Nächste Karte' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);
    expect(actions).toHaveLength(2);
    const next = neverHaveIEver.reduce(state, actions[0], players);
    expect(next.turnIndex).toBe(1);
    expect(neverHaveIEver.reduce(next, actions[1], players)).toBe(next);
  });

  it('überträgt eine verspätete Selbstauskunft nicht auf die nächste Karte', () => {
    const state = neverHaveIEver.createState(players);
    const actions: GameAction[] = [];
    const me = players[1];
    const Game = neverHaveIEver.Component;
    render(
      <MemoryRouter>
        <PartyCtx.Provider value={{ me, players } as unknown as PartyValue}>
          <Game
            state={state}
            players={players}
            me={me}
            isHost={false}
            online
            dispatch={(action) => actions.push({ ...action, by: me.id })}
            quit={() => {}}
          />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Nie gemacht/ }));
    expect(actions).toHaveLength(1);
    expect(neverHaveIEver.reduce(state, actions[0], players).declared).toEqual({ p1: 'no' });

    // Der Host zieht vor, während die Antwort des Gasts noch unterwegs ist.
    const next = neverHaveIEver.reduce(
      state,
      { type: 'next', by: 'p0', turnKey: `${state.round}:${state.turnIndex}` },
      players,
    );
    expect(next.turnIndex).toBe(1);
    expect(next.declared).toEqual({});
    expect(neverHaveIEver.reduce(next, actions[0], players)).toBe(next);
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
