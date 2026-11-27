import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import * as haptics from '../../lib/haptics';
import type { GamePlayer } from '../types';
import { memeBattle, type State } from './index';
import { createState, reduce } from './game';
import { draftStorageKey, Editor } from './Editor';
import { Results } from './Results';
import { Setup } from './Setup';
import { SaveMeme } from './parts';
import { VoteView } from './Vote';
import { renderMeme, shareMeme } from './render';

vi.mock('./render', () => ({ renderMeme: vi.fn(), shareMeme: vi.fn() }));

const roster: GamePlayer[] = [
  { id: 'p0', name: 'Anna', color: 'blue', online: true, isHost: true },
  { id: 'p1', name: 'Berta', color: 'pink', online: true },
  { id: 'p2', name: 'Carl', color: 'green', online: true },
];

beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.999));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Meme-Duell: Vorlagenwechsel aus Nutzersicht', () => {
  it('erklärt Budget und Zeitraum und lässt nur den Host den Zeitraum wählen', () => {
    const state = createState(roster);
    const dispatch = vi.fn();
    const { rerender } = render(
      <Setup state={state} players={roster} isHost dispatch={dispatch} />,
    );
    expect(screen.getByRole('button', { name: 'Pro Runde' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Für das ganze Spiel' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'rerollScope', scope: 'game' });
    rerender(
      <Setup
        state={{ ...state, options: { ...state.options, rerollScope: 'game' } }}
        players={roster}
        isHost={false}
        dispatch={dispatch}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Pro Runde' })).not.toBeInTheDocument();
    expect(screen.getByText('5× für das ganze Spiel')).toBeInTheDocument();
  });

  it('erklärt Gleiches Meme ohne Wechsel und widerspricht dem entspannten Modus nicht', () => {
    const initial = createState(roster);
    const dispatch = vi.fn();
    const { rerender } = render(
      <Setup
        state={{ ...initial, options: { ...initial.options, mode: 'gleich' } }}
        players={roster}
        isHost
        dispatch={dispatch}
      />,
    );
    expect(screen.getByText(/Deshalb gibt es hier keine Vorlagenwechsel/)).toBeInTheDocument();
    expect(screen.queryByText('Vorlagenwechsel gelten')).not.toBeInTheDocument();
    rerender(
      <Setup
        state={{ ...initial, options: { ...initial.options, mode: 'entspannt' } }}
        players={roster}
        isHost
        dispatch={dispatch}
      />,
    );
    expect(screen.queryByText(/das schwächste trinkt/)).not.toBeInTheDocument();
    expect(screen.getByText(/gemeinsam lachen/)).toBeInTheDocument();
  });

  it('bewahrt den Text beim kostenlosen Zurückholen und benennt die verbleibenden Wechsel', () => {
    const dispatch = vi.fn();
    let state = reduce(createState(roster), { type: 'start', by: 'p0' }, roster);
    state = { ...state, drawn: { ...state.drawn, p0: 'drake' } };
    const { rerender } = render(
      <Editor state={state} players={roster} me={roster[0]} topic={null} dispatch={dispatch} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Text 1'), { target: { value: 'Meine Pointe' } });
    expect(
      screen.getByRole('button', { name: 'Vorlage wechseln, noch 5 in dieser Runde' }),
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Vorlage wechseln, noch 5 in dieser Runde' }),
    );
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'reroll', round: 1, template: 'drake' });
    state = reduce(state, { ...dispatch.mock.calls.at(-1)![0], by: 'p0' }, roster);
    rerender(
      <Editor state={state} players={roster} me={roster[0]} topic={null} dispatch={dispatch} />,
    );
    expect(screen.queryByDisplayValue('Meine Pointe')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vorige Vorlage' }));
    state = reduce(state, { ...dispatch.mock.calls.at(-1)![0], by: 'p0' }, roster);
    rerender(
      <Editor state={state} players={roster} me={roster[0]} topic={null} dispatch={dispatch} />,
    );
    expect(screen.getByDisplayValue('Meine Pointe')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Vorlage wechseln, noch 4 in dieser Runde' }),
    ).toBeEnabled();
  });

  it('schickt den Entwurf erst bei null Sekunden und verhindert danach Vorlagenwechsel', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));
    const dispatch = vi.fn();
    const initial = reduce(createState(roster), { type: 'start', by: 'p0' }, roster);
    const state = {
      ...initial,
      deadline: Date.now() + 1000,
      drawn: { ...initial.drawn, p0: 'drake' },
    };
    render(
      <Editor state={state} players={roster} me={roster[0]} topic={null} dispatch={dispatch} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Text 1'), {
      target: { value: 'Letzte Sekunde' },
    });
    act(() => vi.advanceTimersByTime(800));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(400));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'submit',
      texts: ['Letzte Sekunde'],
      round: 1,
      template: 'drake',
    });
    expect(screen.getByRole('button', { name: /Vorlage wechseln/ })).toBeDisabled();
    expect(screen.getByPlaceholderText('Text 1')).toBeDisabled();
  });
});

describe('Meme-Duell: Speichern', () => {
  it('zeigt einen fehlgeschlagenen Export an und erlaubt einen neuen Versuch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(renderMeme).mockRejectedValueOnce(new Error('Offline'));
    render(<SaveMeme meme={{ t: 'drake', x: ['A', 'B'] }} caption="Mein Meme" />);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht gespeichert werden');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
    vi.mocked(renderMeme).mockResolvedValueOnce(new Blob(['Bild'], { type: 'image/jpeg' }));
    vi.mocked(shareMeme).mockResolvedValueOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(shareMeme).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Meme-Duell: Entwürfe', () => {
  const draftState = () => {
    const state = reduce(createState(roster), { type: 'start', by: 'p0' }, roster);
    return { ...state, drawn: { ...state.drawn, p0: 'drake' }, deadline: Date.now() + 60_000 };
  };

  it('stellt einen ungesendeten Entwurf nach Unmount und Remount wieder her', () => {
    const props = { state: draftState(), players: roster, me: roster[0], topic: null, dispatch: vi.fn() };
    const first = render(<Editor {...props} />);
    fireEvent.change(screen.getByPlaceholderText('Text 2'), { target: { value: 'Meine Pointe' } });
    first.unmount();

    render(<Editor {...props} />);
    expect(screen.getByPlaceholderText('Text 1')).toHaveValue('');
    expect(screen.getByPlaceholderText('Text 2')).toHaveValue('Meine Pointe');
    expect(screen.getByRole('button', { name: 'Fertig' })).toBeEnabled();
  });

  it('sichert den zurückgeholten Text nach Nochmal ändern und blendet den Abgabehinweis aus', () => {
    const state = draftState();
    const props = { players: roster, me: roster[0], topic: null, dispatch: vi.fn() };
    const first = render(<Editor {...props} state={{ ...state, memes: { p0: { t: 'drake', x: ['Fertige Pointe'] } } }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal ändern' }));
    expect(props.dispatch).toHaveBeenCalledWith({ type: 'edit', round: 1, template: 'drake' });
    first.unmount();

    render(<Editor {...props} state={state} />);
    expect(screen.getByPlaceholderText('Text 1')).toHaveValue('Fertige Pointe');
    expect(screen.queryByText(/Sobald alle fertig sind/)).not.toBeInTheDocument();
  });

  it('zeigt den Hinweis vor der ersten Abgabe direkt unter den Aktionen in Runde eins', () => {
    const state = draftState();
    const props = { players: roster, me: roster[0], topic: null, dispatch: vi.fn() };
    const { rerender } = render(<Editor {...props} state={state} />);
    const note = screen.getByText('Sobald alle fertig sind, beginnt die Abstimmung. Bis dahin kannst du noch ändern.');
    expect(note).toHaveClass('t-caption');
    expect(note.previousElementSibling).toContainElement(screen.getByRole('button', { name: 'Fertig' }));
    rerender(<Editor {...props} state={{ ...state, round: 2 }} />);
    expect(note).not.toBeInTheDocument();
  });

  it.each(['vote', 'create'] as const)('räumt den alten Entwurf beim Wechsel zu %s auf', (phase) => {
    const state = draftState();
    const me = roster[0];
    const Game = memeBattle.Component;
    const view = (s: State) => (
      <MemoryRouter>
        <PartyCtx.Provider value={{ me, players: roster } as unknown as PartyValue}>
          <Game state={s} players={roster} me={me} isHost online dispatch={vi.fn()} quit={vi.fn()} />
        </PartyCtx.Provider>
      </MemoryRouter>
    );
    const { rerender } = render(view(state));
    fireEvent.change(screen.getByPlaceholderText('Text 1'), { target: { value: 'Alter Entwurf' } });
    const key = draftStorageKey(me.id, state.round, state.deadline);
    const otherKey = draftStorageKey('anderes-gerät', state.round, state.deadline);
    localStorage.setItem(otherKey, 'anderer Entwurf');
    expect(localStorage.getItem(key)).toContain('Alter Entwurf');

    const next = phase === 'vote'
      ? roster.reduce((s, p) => reduce(s, { type: 'submit', by: p.id, texts: ['Neue Pointe'] }, roster), state as State)
      : { ...state, round: state.round + 1, deadline: state.deadline + 60_000 };
    rerender(view(next));
    expect(next.phase).toBe(phase);
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(otherKey)).toBe('anderer Entwurf');
    if (phase === 'create') expect(screen.getByPlaceholderText('Text 1')).toHaveValue('');
  });

  it.each([
    { role: 'Host', close: 'Spiel beenden', confirm: 'Beenden', me: roster[0] },
    { role: 'Gast', close: 'Spiel verlassen', confirm: 'Verlassen', me: roster[1] },
  ])('behandelt den Entwurf beim bestätigten Verlassen als $role', ({ close, confirm, me }) => {
    const isHost = !!me.isHost;
    const initial = draftState();
    const state = { ...initial, drawn: { ...initial.drawn, [me.id]: 'drake' } };
    const Game = memeBattle.Component;
    const quit = vi.fn();
    const party = { me, players: roster, mode: 'online', connection: 'online', isHost } as unknown as PartyValue;
    render(
      <MemoryRouter>
        <PartyCtx.Provider value={party}>
          <Game state={state} players={roster} me={me} isHost={isHost} online dispatch={vi.fn()} quit={quit} />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText('Text 1'), { target: { value: 'Alter Entwurf' } });
    const key = draftStorageKey(me.id, state.round, state.deadline);
    fireEvent.click(screen.getByRole('button', { name: close }));
    expect(localStorage.getItem(key)).toContain('Alter Entwurf');
    fireEvent.click(screen.getByRole('button', { name: confirm }));
    expect(quit).toHaveBeenCalledOnce();
    if (isHost) expect(localStorage.getItem(key)).toBeNull();
    else expect(localStorage.getItem(key)).toContain('Alter Entwurf');
  });
});

describe('Meme-Duell: geteilte Rundensiege', () => {
  it.each(['klassisch', 'entspannt'] as const)('zeigt und feiert in %s beide Sieger vor dem Rest', (mode) => {
    const signal = vi.spyOn(haptics, 'haptic');
    const state: State = {
      ...createState(roster),
      phase: 'results',
      options: { ...createState(roster).options, mode },
      order: ['p0', 'p2', 'p1'],
      points: { p0: 10, p1: 10, p2: 0 },
      memes: {
        p0: { t: 'drake', x: ['Erster Siegertext'] },
        p1: { t: 'drake', x: ['Zweiter Siegertext'] },
        p2: { t: 'drake', x: ['Dritter Text'] },
      },
    };
    const view = (me: GamePlayer) => (
      <PartyCtx.Provider value={{ me, players: roster } as unknown as PartyValue}>
        <Results state={state} players={roster} me={me} topic={null} dispatch={vi.fn()} />
      </PartyCtx.Provider>
    );
    const observer = render(view(roster[2]));
    const kicker = screen.getByText('Gleichstand – 2 Memes teilen sich die Runde');
    const hero = within(kicker.parentElement!);
    expect(hero.getByText('Anna')).toBeInTheDocument();
    expect(hero.getByText('Berta')).toBeInTheDocument();
    expect(hero.queryByText('DRITTER TEXT')).not.toBeInTheDocument();
    expect(screen.getByText('DRITTER TEXT')).toBeInTheDocument();
    observer.unmount();

    for (const winner of roster.slice(0, 2)) {
      signal.mockClear();
      const { unmount } = render(view(winner));
      expect(screen.getByText('Du teilst dir den Rundensieg')).toBeInTheDocument();
      expect(signal).toHaveBeenCalledWith('success');
      unmount();
    }
  });
});

describe('Meme-Duell: laufende Abstimmung', () => {
  it('zählt abgegebene Stimmen abwesender Mitglieder nicht als Stimmen der noch Anwesenden', () => {
    const fourth: GamePlayer = { id: 'p3', name: 'Dora', color: 'green', online: true };
    const members = [...roster, fourth];
    let state = reduce(createState(members), { type: 'start', by: 'p0' }, members);
    for (const p of members)
      state = reduce(state, { type: 'submit', by: p.id, texts: ['Meme'] }, members);
    const author = state.order[0];
    const voters = members.filter((p) => p.id !== author);
    for (const p of voters.slice(0, 2)) {
      state = reduce(state, { type: 'vote', by: p.id, target: author, value: 1 }, members);
    }
    const active = members.map((p) => (p.id === voters[0].id ? { ...p, online: false } : p));
    render(
      <VoteView
        state={state}
        players={active}
        me={members.find((p) => p.id === author)!}
        topic={null}
        dispatch={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('1 von 2 haben abgestimmt')).toBeInTheDocument();
  });
});

describe('Meme-Duell: Update während einer alten Runde', () => {
  it('zeigt den Neustart an, obwohl der alte Zustand keine Vorlagen hat', () => {
    const me: GamePlayer = { id: 'p0', name: 'Anna', color: 'blue', online: true };
    const dispatch = vi.fn();
    const state = {
      phase: 'writing',
      prompt: 3,
      deck: [1, 2],
      answers: {},
      votes: {},
    } as unknown as State;
    const party = {
      me,
      players: [me],
      mode: 'online',
      gameId: 'meme-battle',
      logSipsFor: vi.fn(),
      undoLastFor: vi.fn(),
    } as unknown as PartyValue;
    const Component = memeBattle.Component;

    render(
      <MemoryRouter>
        <PartyCtx.Provider value={party}>
          <Component
            state={state}
            players={[me]}
            me={me}
            isHost
            online
            dispatch={dispatch}
            quit={vi.fn()}
          />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Neue Version')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Neu starten' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'restart' });
  });
});
