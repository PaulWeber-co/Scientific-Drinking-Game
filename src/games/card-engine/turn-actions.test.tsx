import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('Andere Karte', () => {
  it.each(['wahrheit', 'pflicht'])('zieht im Modus %s ohne den Zug weiterzuschalten', (mode) => {
    const initial = truthOrDare.createState(players);
    const state = {
      ...truthOrDare.reduce(initial, { type: 'pickMode', mode, by: 'p0' }, players),
      drawn: { text: 'Erste Karte', mode },
      deck: [{ text: 'Zweite Karte', mode }],
    };
    const next = truthOrDare.reduce(state, { type: 'skip', by: 'p0' }, players);
    expect(next.drawn).toEqual({ text: 'Zweite Karte', mode });
    expect(next.order).toEqual(state.order);
    expect(next.turnIndex).toBe(state.turnIndex);
    expect(next.round).toBe(state.round);
    expect(next.mode).toBe(mode);
    expect(next.phase).toBe('card');
    expect(next.outcome).toBeNull();
    expect(next.deck).toEqual([]);
  });

  it.each(['wahrheit', 'pflicht'])('füllt den leeren Stapel nur mit %s auf', (mode) => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const initial = truthOrDare.createState(players);
      const state = {
        ...truthOrDare.reduce(initial, { type: 'pickMode', mode, by: 'p0' }, players),
        deck: [],
      };
      const next = truthOrDare.reduce(state, { type: 'skip', by: 'p0' }, players);
      expect(next.drawn?.mode).toBe(mode);
      expect(next.deck.length).toBeGreaterThan(0);
      expect(next.deck.every((card) => card.mode === mode)).toBe(true);
      expect(next.turnIndex).toBe(state.turnIndex);
      expect(next.round).toBe(state.round);
      expect(next.outcome).toBeNull();
    } finally {
      random.mockRestore();
    }
  });

  it.each(['choose', 'resolved', 'over'] as const)('ignoriert Überspringen in %s', (phase) => {
    const state = { ...truthOrDare.createState(players), phase };
    expect(truthOrDare.reduce(state, { type: 'skip', by: 'p0' }, players)).toBe(state);
  });

  it('ignoriert Überspringen ohne Freigabe', () => {
    const state = neverHaveIEver.createState(players);
    expect(neverHaveIEver.reduce(state, { type: 'skip', by: 'p0' }, players)).toBe(state);
  });

  it('wechselt die sichtbare Karte ohne Getränkebuchung', () => {
    const logSipsFor = vi.fn();
    const me = players[0];
    let state: ReturnType<typeof truthOrDare.createState> = {
      ...truthOrDare.createState(players),
      phase: 'card' as const,
      mode: 'wahrheit',
      drawn: { text: 'Erste Karte', mode: 'wahrheit' },
      deck: [{ text: 'Zweite Karte', mode: 'wahrheit' }],
    };
    const Game = truthOrDare.Component;
    const view = () => (
      <MemoryRouter>
        <PartyCtx.Provider value={{ me, players, logSipsFor } as unknown as PartyValue}>
          <Game
            state={state}
            players={players}
            me={me}
            isHost
            online={false}
            dispatch={(action) => {
              state = truthOrDare.reduce(state, { ...action, by: me.id }, players);
            }}
            quit={() => {}}
          />
        </PartyCtx.Provider>
      </MemoryRouter>
    );
    const rendered = render(view());
    fireEvent.click(screen.getByRole('button', { name: 'Andere Karte kostet nichts' }));
    rendered.rerender(view());
    expect(screen.getByText('Zweite Karte')).toBeInTheDocument();
    expect(screen.queryByText('Erste Karte')).toBeNull();
    expect(logSipsFor).not.toHaveBeenCalled();
  });
});
