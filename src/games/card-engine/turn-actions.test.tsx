import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ersteZeile } from '../erste-zeile';
import { neverHaveIEver } from '../never-have-i-ever';
import { truthOrDare } from '../truth-or-dare';
import { meta as truthOrDareMeta } from '../truth-or-dare/meta';
import { createCardGame } from './createCardGame';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { useApp } from '../../store/app';
import type { GameAction, GameActionInput, GamePlayer } from '../types';

const players: GamePlayer[] = [
  { id: 'p0', name: 'Paul', color: 'blue', online: true, isHost: true },
  { id: 'p1', name: 'Lena', color: 'pink', online: true, isHost: false },
  { id: 'p2', name: 'Toni', color: 'green', online: true, isHost: false },
];

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.999);
  useApp.setState({ gameLength: 'mittel', spicy: {} });
});
afterEach(() => vi.restoreAllMocks());

describe('Karten-Spiele: verspätete Aktionen', () => {
  it('sendet eine Selbstauskunft mit der Revision der sichtbaren Karte', () => {
    const game = createCardGame({
      ...truthOrDareMeta,
      actor: 'turn',
      asker: 'prev',
      drink: 'self-declare',
      baseSips: 3,
      cards: [{ text: 'Erste Karte' }],
    });
    const first = game.reduce(game.createState(players), { type: 'pickMode', mode: 'wahrheit', by: players[0].id }, players);
    const replacement = game.reduce(first, { type: 'setHeat', heat: 1, by: players[0].id }, players);
    const me = players[1];
    const dispatch = vi.fn<(action: GameActionInput) => void>();
    const Game = game.Component;
    render(
      <MemoryRouter>
        <PartyCtx.Provider value={{ me, players } as unknown as PartyValue}>
          <Game state={replacement} players={players} me={me} isHost={false} online dispatch={dispatch} quit={vi.fn()} />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Nie gemacht/ }));
    const action = { ...dispatch.mock.calls[0][0], by: me.id };
    expect(game.reduce(replacement, action, players).declared).toEqual({ p1: 'no' });
    expect(game.reduce(first, action, players)).toBe(first);
  });

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
    const localPlayers = [me, ...players.slice(1).map((p) => ({ ...p, isHost: undefined }))];
    let state: ReturnType<typeof truthOrDare.createState> = {
      ...truthOrDare.createState(localPlayers),
      order: ['p1', 'p0', 'p2'],
      phase: 'card' as const,
      mode: 'wahrheit',
      drawn: { text: 'Erste Karte', mode: 'wahrheit' },
      deck: [{ text: 'Zweite Karte', mode: 'wahrheit' }],
    };
    const Game = truthOrDare.Component;
    const view = () => (
      <MemoryRouter>
        <PartyCtx.Provider value={{ me, players: localPlayers, logSipsFor } as unknown as PartyValue}>
          <Game
            state={state}
            players={localPlayers}
            me={me}
            isHost
            online={false}
            dispatch={(action) => {
              state = truthOrDare.reduce(state, { ...action, by: me.id }, localPlayers);
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

describe('Wahrheit oder Pflicht: fragende Person', () => {
  it('zeigt den vorigen Platz im Chip und überspringt fehlende und offline Plätze', () => {
    const state = { ...truthOrDare.createState(players), order: ['p0', 'p1', 'missing', 'p2'] };
    const Game = truthOrDare.Component;
    const view = (roster: GamePlayer[], me: GamePlayer) => (
      <MemoryRouter>
        <PartyCtx.Provider value={{ me, players: roster } as unknown as PartyValue}>
          <Game state={state} players={roster} me={me} isHost={!!me.isHost} online dispatch={vi.fn()} quit={vi.fn()} />
        </PartyCtx.Provider>
      </MemoryRouter>
    );
    const { rerender } = render(view(players, players[1]));
    expect(screen.getByText('Toni fragt: Wahrheit oder Pflicht?')).toBeInTheDocument();
    expect(within(screen.getByText('fragt').closest('.pchip')!).getByText('Toni')).toBeInTheDocument();

    const roster = players.map((p) => p.id === 'p2' ? { ...p, online: false } : p);
    rerender(view(roster, players[0]));
    expect(screen.getByText('Lena fragt: Wahrheit oder Pflicht?')).toBeInTheDocument();
    rerender(view(roster, players[1]));
    expect(screen.getByText('Du fragst: Wahrheit oder Pflicht?')).toBeInTheDocument();
    expect(within(screen.getByText('Du fragst').closest('.pchip')!).getByText('Lena')).toBeInTheDocument();
  });

  it('zeigt zu zweit die andere Person als fragende Person', () => {
    const pair = players.slice(0, 2);
    const Game = truthOrDare.Component;
    const state = truthOrDare.createState(pair);
    render(
      <MemoryRouter>
        <PartyCtx.Provider value={{ me: pair[0], players: pair } as unknown as PartyValue}>
          <Game state={state} players={pair} me={pair[0]} isHost online dispatch={vi.fn()} quit={vi.fn()} />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Lena fragt: Wahrheit oder Pflicht?')).toBeInTheDocument();
  });

  it('gibt die Kartenknöpfe online nur für Zug und Frage frei', () => {
    const Game = truthOrDare.Component;
    const initial = truthOrDare.createState(players);
    const state = truthOrDare.reduce(initial, { type: 'pickMode', mode: 'wahrheit', by: 'p0' }, players);
    const dispatch = vi.fn();
    const view = (me: GamePlayer) => (
      <MemoryRouter>
        <PartyCtx.Provider value={{ me, players } as unknown as PartyValue}>
          <Game state={state} players={players} me={me} isHost={!!me.isHost} online dispatch={dispatch} quit={vi.fn()} />
        </PartyCtx.Provider>
      </MemoryRouter>
    );
    const { rerender } = render(view(players[1]));
    const buttons = [/^Gemacht$/, /Andere Karte/, /Kneifen und trinken/];
    for (const name of buttons) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    for (const me of [players[0], players[2]]) {
      rerender(view(me));
      for (const name of buttons) expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Gemacht' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'resolve', outcome: 'done', turnKey: '1:0' });
  });

  it('wendet verspätete Kartenaktionen der beiden Geräte nicht auf die Ersatzkarte an', () => {
    const initial = truthOrDare.createState(players);
    const state = {
      ...truthOrDare.reduce(initial, { type: 'pickMode', mode: 'wahrheit', by: 'p0' }, players),
      drawn: { text: 'Erste Karte' },
      deck: [{ text: 'Zweite Karte' }, { text: 'Dritte Karte' }],
    };
    const dispatch = vi.fn();
    const Game = truthOrDare.Component;
    const view = (current: typeof initial, me: GamePlayer) => (
      <MemoryRouter>
        <PartyCtx.Provider value={{ me, players } as unknown as PartyValue}>
          <Game state={current} players={players} me={me} isHost={!!me.isHost} online dispatch={dispatch} quit={vi.fn()} />
        </PartyCtx.Provider>
      </MemoryRouter>
    );
    const { rerender } = render(view(state, players[2]));
    fireEvent.click(screen.getByRole('button', { name: /Andere Karte/ }));
    const skip = { ...dispatch.mock.lastCall![0], by: 'p2' };
    const replacement = truthOrDare.reduce(state, skip, players);
    expect(replacement.drawn?.text).toBe('Zweite Karte');

    rerender(view(state, players[0]));
    fireEvent.click(screen.getByRole('button', { name: 'Gemacht' }));
    expect(truthOrDare.reduce(replacement, { ...dispatch.mock.lastCall![0], by: 'p0' }, players)).toBe(replacement);
    expect(truthOrDare.reduce(replacement, skip, players)).toBe(replacement);

    rerender(view(replacement, players[0]));
    fireEvent.click(screen.getByRole('button', { name: 'Gemacht' }));
    const done = { ...dispatch.mock.lastCall![0], by: 'p0' };
    const resolved = truthOrDare.reduce(replacement, done, players);
    expect(resolved.phase).toBe('resolved');
    const next = truthOrDare.reduce(resolved, { ...done, type: 'next' }, players);
    expect(truthOrDare.reduce(next, {
      type: 'pickMode', mode: 'wahrheit', by: 'p1', turnKey: '1:1',
    }, players).phase).toBe('card');
  });

  it('verwirft alte Kartenaktionen auch nach einem Härtewechsel', () => {
    const initial = truthOrDare.createState(players);
    const card = truthOrDare.reduce(initial, { type: 'pickMode', mode: 'pflicht', by: 'p0' }, players);
    const replacement = truthOrDare.reduce(card, { type: 'setHeat', heat: 1, by: 'p0' }, players);
    const done: GameAction = { type: 'resolve', outcome: 'done', by: 'p2', turnKey: '1:0' };
    expect(truthOrDare.reduce(replacement, done, players)).toBe(replacement);
    expect(truthOrDare.reduce(replacement, { ...done, turnKey: '1:0:1' }, players).phase).toBe('resolved');
  });

  it('lässt im geteilten Spiel das Gerät für andere Sitzplätze bestätigen', () => {
    const localPlayers = [players[0], ...players.slice(1).map((p) => ({ ...p, isHost: undefined }))];
    const state = { ...truthOrDare.createState(localPlayers), phase: 'card' as const, order: ['p1', 'p0', 'p2'] };
    expect(truthOrDare.reduce(state, { type: 'resolve', by: 'p0' }, localPlayers).phase).toBe('resolved');
  });

  it('belässt bei Erste Zeile den Zugchip und die Bedienung ohne Fragechip', () => {
    const Game = ersteZeile.Component;
    render(
      <MemoryRouter>
        <PartyCtx.Provider value={{ me: players[1], players } as unknown as PartyValue}>
          <Game state={ersteZeile.createState(players)} players={players} me={players[1]} isHost={false} online dispatch={vi.fn()} quit={vi.fn()} />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText('ist dran')).toBeInTheDocument();
    expect(screen.queryByText(/fragt/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Erraten/ })).toBeEnabled();
  });
});
