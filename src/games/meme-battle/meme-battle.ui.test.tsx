import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import type { GamePlayer } from '../types';
import { memeBattle, type State } from './index';
import { createState, reduce } from './game';
import { Editor } from './Editor';
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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
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
