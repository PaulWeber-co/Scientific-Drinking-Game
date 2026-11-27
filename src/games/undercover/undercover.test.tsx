import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { render } from '../../test/render';
import { useState } from 'react';
import { undercover } from './index';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn(), setHapticsEnabled: vi.fn() }));
import { meta } from './meta';
import { WORDS } from './words';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { usePlayer, defaultProfile } from '../../store/player';
import { useApp } from '../../store/app';
import type { GameAction, GameActionInput, GamePlayer } from '../types';

const me: GamePlayer = { id: 'p0', name: 'Paul', color: 'blue', online: true };
const runde = (n: number): GamePlayer[] => [
  me,
  ...Array.from({ length: n - 1 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Gast ${i + 1}`,
    color: 'pink' as const,
    online: true,
  })),
];

type State = ReturnType<typeof undercover.createState>;
const tun = (s: State, a: GameActionInput, players: GamePlayer[]) =>
  undercover.reduce(s, { ...a, by: a.by ?? me.id, at: Date.now() } as GameAction, players);

/** Alle schauen ihr Wort an – der Weg von `reveal` nach `describe`. */
function alleGesehen(s: State, players: GamePlayer[]): State {
  let next = s;
  for (const p of players) next = tun(next, { type: 'seen', who: p.id, by: p.id }, players);
  return next;
}

/** Von `reveal` bis zur Abstimmung: alle schauen, dann ein Tipp auf „abstimmen". */
function bisVote(players: GamePlayer[], start?: State): State {
  const s = alleGesehen(start ?? undercover.createState(players), players);
  return tun(s, { type: 'startVote' }, players);
}

/** Alle stimmen ab. Der Schluessel ist der Waehler, der Wert sein Ziel. */
function abstimmen(s: State, players: GamePlayer[], stimmen: Record<string, string>): State {
  let next = s;
  for (const [waehler, ziel] of Object.entries(stimmen)) {
    next = tun(next, { type: 'vote', target: ziel, by: waehler }, players);
  }
  return next;
}

beforeEach(() => {
  let seed = 12345;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });
  useApp.setState({ gameLength: 'endlos', spicy: {}, taskOnSkip: 'aus', undercoverCount: 1 });
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    currentDrinkId: 'beer-pils',
    log: [],
  });
});

afterEach(() => vi.restoreAllMocks());

describe('Undercover mit mehreren Rollen', () => {
  function mountRound(state: State, players: GamePlayer[], player = me) {
    const Game = undercover.Component;
    return render(
      <PartyCtx.Provider value={{
        me: player, players, mode: 'online', gameId: 'undercover', isHost: player.id === me.id,
      } as PartyValue}>
        <Game
          state={state}
          players={players}
          me={player}
          online
          isHost={player.id === me.id}
          dispatch={vi.fn()}
          quit={vi.fn()}
        />
      </PartyCtx.Provider>,
    );
  }

  function raus(s: State, id: string, players: GamePlayer[]) {
    return tun(s, { type: 'countVotes', counts: { [id]: players.length } }, players);
  }

  function zwei() {
    const players = runde(6);
    useApp.getState().setUndercoverCount(2);
    return { players, start: bisVote(players) };
  }

  it.each([
    [6, 2, 'zu zweit'],
    [9, 3, 'zu dritt'],
  ])('lost bei %i Personen %i Rollen aus und zeigt allen denselben Hinweis %s', (n, count, label) => {
    const players = runde(n);
    useApp.getState().setUndercoverCount(count);
    const state = undercover.createState(players);
    expect(state.undercoverIds).toHaveLength(count);
    expect(new Set(state.undercoverIds).size).toBe(count);

    for (const p of players) {
      const { unmount } = mountRound(state, players, p);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Karte hochschieben' }), { key: 'Enter' });
      const card = document.querySelector('.peekcard__under')!;
      if (state.undercoverIds.includes(p.id)) {
        expect(card).toHaveTextContent(`Du bist Undercover – ihr seid ${label}`);
        expect(card.querySelector('.peekcard__word')).toHaveTextContent(state.hint);
        for (const other of players) expect(card).not.toHaveTextContent(other.name);
      } else {
        expect(card).toHaveTextContent('Dein Wort');
        expect(card).not.toHaveTextContent('Du bist Undercover');
      }
      unmount();
    }
  });

  it('kappt die Wunschzahl bei vier Aktiven auf eins, ab sechs auf zwei und ab neun auf drei', () => {
    useApp.getState().setUndercoverCount(3);
    const roster = runde(9);
    const active = (n: number) => roster.map((p, i) => ({ ...p, online: i < n }));
    const start = undercover.createState(active(4));
    expect(start.undercoverIds).toHaveLength(1);
    expect(start.order).toHaveLength(4);
    expect(start.order).toContain(start.undercoverIds[0]);

    useApp.getState().setUndercoverCount(1);
    const next = tun({ ...start, phase: 'over' }, { type: 'newRound' }, active(6));
    expect(next.undercoverIds).toHaveLength(2);
    const restart = tun({ ...next, phase: 'final' }, { type: 'restart' }, roster);
    expect(restart.undercoverIds).toHaveLength(3);
    expect(restart.round).toBe(1);
  });

  it('entscheidet bei Gleichstand der Lager für Undercover', () => {
    const { players, start } = zwei();
    const group = players.filter((p) => !start.undercoverIds.includes(p.id));
    let state = raus(start, group[0].id, players);
    expect(state.phase).toBe('result');
    const { unmount } = mountRound(state, players);
    expect(screen.getByText(/2 Undercover sind noch im Spiel/)).toBeVisible();
    unmount();

    state = tun(state, { type: 'continue' }, players);
    state = tun(state, { type: 'startVote' }, players);
    state = raus(state, group[1].id, players);
    expect(state.phase).toBe('over');
    expect(state.winner).toBe('undercover');
    expect(state.agentWins).toBe(1);
  });

  it('zählt ein kurz getrenntes Gruppenmitglied bei der Siegprüfung mit', () => {
    const { players, start } = zwei();
    const [out, offline] = players.filter((p) => !start.undercoverIds.includes(p.id));
    const current = players.map((p) => p.id === offline.id ? { ...p, online: false } : p);
    const state = raus(start, out.id, current);
    expect(state).toMatchObject({ phase: 'result', winner: null, agentWins: 0, groupWins: 0 });
  });

  it('gibt der Gruppe keinen Sieg, wenn der einzige Undercover kurz offline ist', () => {
    const players = runde(4).map((p) => ({ ...p, isHost: p.id === me.id }));
    const current = players.map((p) => p.id === 'p1' ? { ...p, online: false } : p);
    const start = { ...bisVote(players), undercoverIds: ['p1'] };
    const state = abstimmen(start, current, { p0: 'p2', p2: 'p3', p3: 'p2' });
    expect(state).toMatchObject({ phase: 'result', winner: null, lastOut: 'p2', agentWins: 0, groupWins: 0 });
    mountRound(state, current);
    expect(screen.getByText(/1 Undercover ist noch im Spiel/)).toBeVisible();
  });

  it.each(['Fehlversuch', 'Überspringen'] as const)(
    'wertet den Gleichstand für Undercover bei %s',
    (attempt) => {
      const players = runde(6).map((p) => ({ ...p, isHost: p.id === me.id }));
      const start = { ...bisVote(players), undercoverIds: ['p1', 'p2'] };
      const guess = raus(start, 'p1', players);
      const wrong = guess.guessOptions.find((word) => word !== guess.word)!;
      const current = players.slice(0, 3).map((p) =>
        p.id === 'p1' && attempt === 'Überspringen' ? { ...p, online: false } : p,
      );
      const state = tun(guess, attempt === 'Fehlversuch'
        ? { type: 'guess', word: wrong, by: 'p1' }
        : { type: 'skipAbsent', who: 'p1' }, current);
      expect(state).toMatchObject({
        phase: 'over', winner: 'undercover', agentWins: 1, groupWins: 0,
        guessed: attempt === 'Fehlversuch' ? wrong : null,
      });
    },
  );

  it('dreht die Beschreibreihenfolge über ausgeschiedene Plätze hinweg weiter', () => {
    const players = runde(6);
    const order = players.map((p) => p.id);
    const start = bisVote(players, { ...undercover.createState(players), order, undercoverIds: ['p5'] });

    const first = tun(raus(start, 'p1', players), { type: 'continue' }, players);
    expect(first.order).toEqual(['p2', 'p3', 'p4', 'p5', 'p0', 'p1']);
    const { unmount } = mountRound(first, players);
    expect(screen.getByText(/Gast 2 fängt an, dann reihum/)).toBeVisible();
    unmount();

    const second = tun(raus(tun(first, { type: 'startVote' }, players), 'p3', players), { type: 'continue' }, players);
    expect(second.order[0]).toBe('p4');
  });

  it('nennt beim Beschreiben die erste anwesende Person, die noch mitspielt', () => {
    const players = runde(5);
    const state: State = {
      ...undercover.createState(players),
      phase: 'describe',
      order: ['p1', 'p0', 'p3', 'p2', 'p4'],
      eliminated: [me.id],
    };
    const current = players.map((p) => p.id === 'p1' ? { ...p, online: false } : p);
    const { unmount } = mountRound(state, current);
    expect(screen.getByText(/Gast 3 fängt an, dann reihum/)).toBeVisible();
    unmount();

    mountRound(state, players.map((p) => ({ ...p, online: false })));
    expect(screen.getByText(/Gast 1 fängt an, dann reihum/)).toBeVisible();
  });

  it('lässt eine kurz getrennte Person ihre Karte noch aufdecken', () => {
    const players = runde(4).map((p) => ({ ...p, isHost: p.id === me.id }));
    const offline = players.map((p) => p.id === 'p3' ? { ...p, online: false } : p);
    let state = undercover.createState(players);
    for (const p of players.slice(0, -1)) {
      state = tun(state, { type: 'seen', by: p.id, who: p.id }, offline);
    }
    expect(state.phase).toBe('reveal');
    state = tun(state, { type: 'seen', by: 'p3', who: 'p3' }, players);
    expect(state.phase).toBe('describe');
  });

  it('lässt Online-Gäste ohne Host-Eintrag nur die eigene Karte bestätigen', () => {
    const players = runde(4).map((p) => ({ ...p, isHost: p.id === me.id }));
    const start = undercover.createState(players);
    const guests = players.slice(1);
    expect(tun(start, { type: 'seen', by: 'p1', who: 'p2' }, guests)).toBe(start);
    expect(tun(start, { type: 'seen', by: 'p1', who: 'p1' }, guests).seen).toEqual(['p1']);
  });

  it('nimmt Stimmen nur von aktiven Rundenteilnehmenden und für gültige Ziele an', () => {
    const players = runde(6).map((p) => ({ ...p, isHost: p.id === me.id }));
    const start = { ...bisVote(players), eliminated: ['p2'], votes: { p0: 'p1', p4: 'p5', p5: 'p2' } };
    const current = players.map((p) => p.id === 'p4' ? { ...p, online: false } : p);
    expect(tun(start, { type: 'vote', by: 'p2', target: 'p1' }, current)).toBe(start);
    expect(tun(start, { type: 'vote', by: 'p4', target: 'p1' }, current)).toBe(start);
    expect(tun(start, { type: 'vote', by: 'p1', target: 'p2' }, current)).toBe(start);
    const next = tun(start, { type: 'vote', by: 'p1', target: 'p5' }, current);
    expect(next).toMatchObject({ phase: 'vote', votes: { p0: 'p1', p1: 'p5' } });
    expect(Object.keys(next.votes)).toEqual(['p0', 'p1']);
  });

  it('lässt nach falschem Raten mit einer weiteren Undercover-Rolle weiterbeschreiben', () => {
    const { players, start } = zwei();
    const [first, second] = start.undercoverIds;
    const guess = raus(start, first, players);
    expect(guess.phase).toBe('guess');
    const wrong = guess.guessOptions.find((word) => word !== guess.word)!;
    const state = tun(guess, { type: 'guess', word: wrong, by: first }, players);
    expect(state).toMatchObject({ phase: 'describe', eliminated: [first], winner: null, agentWins: 0, groupWins: 0 });
    expect(state.votes).toEqual({});
    expect(state.order[0]).toBe([...start.order.slice(1), start.order[0]].find((id) => id !== first));
    expect(state.undercoverIds).toContain(second);
    mountRound(state, players);
    expect(screen.getByText(/daneben\. 1 Undercover ist noch im Spiel/)).toBeVisible();
    expect(document.querySelector('.call')).toBeNull();
  });

  it('gibt der Gruppe den Sieg, wenn alle Undercover raus sind und falsch raten', () => {
    const { players, start } = zwei();
    let state = start;
    for (const id of start.undercoverIds) {
      state = raus(tun(state, { type: 'startVote' }, players), id, players);
      const wrong = state.guessOptions.find((word) => word !== state.word)!;
      state = tun(state, { type: 'guess', word: wrong, by: id }, players);
    }
    expect(state).toMatchObject({ phase: 'over', winner: 'gruppe', agentWins: 0, groupWins: 1 });
  });

  it('lässt nur die enttarnte Person online raten und gibt bei Treffer Undercover den Sieg', () => {
    const { players, start } = zwei();
    const online = players.map((p) => ({ ...p, isHost: p.id === me.id }));
    const [first, second] = start.undercoverIds;
    const guess = raus(start, first, online);
    const { unmount } = mountRound(guess, online, online.find((p) => p.id === second)!);
    expect(screen.queryByRole('button', { name: guess.word })).toBeNull();
    unmount();
    expect(tun(guess, { type: 'guess', word: guess.word, by: second }, online)).toBe(guess);
    const state = tun(guess, { type: 'guess', word: guess.word, by: first }, online);
    expect(state).toMatchObject({ phase: 'over', winner: 'undercover', agentWins: 1, groupWins: 0 });
  });

  it('schließt beide Undercover aus der Trinkliste nach einem Treffer aus', () => {
    const { players, start } = zwei();
    const guess = raus(start, start.undercoverIds[0], players);
    const state = tun(guess, { type: 'guess', word: guess.word }, players);
    const group = players.filter((p) => !state.undercoverIds.includes(p.id));
    mountRound(state, players, group[0]);
    const unknown = group.slice(1);
    expect(screen.getByText(`${unknown.map((p) => p.name).join(', ')} sehen die eigene Menge auf dem eigenen Handy.`)).toBeVisible();
  });
});

describe('Undercover nach übersprungenem Aufdecken', () => {
  it.each([
    { phase: 'describe', label: 'beim Beschreiben', agent: false },
    { phase: 'vote', label: 'beim Abstimmen', agent: true },
    { phase: 'result', label: 'nach der Auszählung', agent: false },
    { phase: 'guess', label: 'beim letzten Rateversuch', agent: true },
    { phase: 'over', label: 'nach der Entscheidung', agent: true },
  ])('zeigt die eigene Karte $label nach der Rückkehr', ({ phase, agent }) => {
    const players = runde(6).map((p) => ({ ...p, isHost: p.id === me.id }));
    const guest = players[1];
    const offline = players.map((p) => p.id === guest.id ? { ...p, online: false } : p);
    const start = {
      ...undercover.createState(players),
      undercoverIds: agent ? [guest.id, players[5].id] : [players[5].id],
    };
    let state = alleGesehen(start, offline);
    expect(state.phase).toBe('reveal');
    state = tun(state, { type: 'skipAbsent', who: guest.id }, offline);
    expect(state.phase).toBe('describe');
    expect(state.seen).not.toContain(guest.id);
    if (phase !== 'describe') state = tun(state, { type: 'startVote' }, offline);
    if (phase === 'vote') state = tun(state, { type: 'vote', target: guest.id }, players);
    if (phase === 'result') state = tun(state, { type: 'countVotes', counts: { [players[2].id]: 3 } }, offline);
    if (phase === 'guess' || phase === 'over') {
      state = tun(state, { type: 'countVotes', counts: { [guest.id]: 3 } }, players);
    }
    if (phase === 'over') state = tun(state, { type: 'guess', by: guest.id, word: state.word }, players);
    expect(state.phase).toBe(phase);

    const dispatch = vi.fn((action: GameActionInput) => {
      state = tun(state, { ...action, by: guest.id }, players);
    });
    const view = (viewer: GamePlayer, roster: GamePlayer[]) => (
      <PartyCtx.Provider value={{
        me: viewer, players: roster, mode: 'online', connection: 'online', isHost: viewer.isHost,
      } as PartyValue}>
        <undercover.Component
          state={state} players={roster} me={viewer} isHost={Boolean(viewer.isHost)} online
          dispatch={dispatch} quit={vi.fn()}
        />
      </PartyCtx.Provider>
    );
    const { rerender } = render(view(players[0], players));
    const label = 'Karte hochschieben';
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    rerender(view(guest, offline));
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    rerender(view(guest, players));
    const card = screen.getByRole('button', { name: label });
    const confirm = screen.getByRole('button', { name: 'Gemerkt' });
    expect(confirm).toBeDisabled();
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Karte zudecken' })).toHaveAttribute('aria-pressed', 'true');
    const face = screen.getByText(agent ? state.hint : state.word, { selector: '.peekcard__word' })
      .closest('.peekcard__under');
    expect(face).toHaveAttribute('aria-hidden', 'false');
    expect(face).toHaveTextContent(agent ? 'Du bist Undercover – ihr seid zu zweit' : 'Dein Wort');
    if (agent) expect(face).not.toHaveTextContent(state.word);
    expect(confirm).toBeEnabled();
    const before = state;
    fireEvent.click(confirm);
    expect(state).toEqual({ ...before, seen: [...before.seen, guest.id] });
    rerender(view(guest, players));
    expect(screen.queryByRole('button', { name: /Karte (hochschieben|zudecken)/ })).not.toBeInTheDocument();
  });

  it('bestätigt spät nur die eigene Karte der laufenden Runde', () => {
    const players = runde(4).map((p) => ({ ...p, isHost: p.id === me.id }));
    const guest = players[1];
    const newcomer = { ...guest, id: 'new' };
    const state: State = { ...undercover.createState(players), phase: 'describe', round: 2 };
    const seen = { type: 'seen', by: guest.id, who: guest.id, round: state.round };
    expect(tun(state, { ...seen, by: players[2].id }, players)).toBe(state);
    expect(tun(state, { ...seen, round: 1 }, players)).toBe(state);
    expect(tun(state, { ...seen, by: newcomer.id, who: newcomer.id }, [...players, newcomer])).toBe(state);
    expect(tun(state, seen, players.filter((p) => p.id !== guest.id))).toBe(state);
    const final = { ...state, phase: 'final' as const };
    expect(tun(final, seen, players)).toBe(final);
    const confirmed = tun(state, seen, players);
    expect(confirmed.seen).toEqual([guest.id]);
    expect(tun(confirmed, seen, players)).toBe(confirmed);
  });
});

describe('Undercover auf einem geteilten Handy', () => {
  it('bietet sich ohne eigene Geräte an', () => {
    // Vorher hielt `requiresOwnDevice` das Spiel aus dem Pass-&-Play-Modus
    // heraus - und der Reducer haette es dort auch gar nicht gekonnt.
    expect(meta.requiresOwnDevice).toBe(false);
  });

  it('zählt jeden einzeln, obwohl alle Aktionen vom selben Gerät kommen', () => {
    // Der eigentliche Blocker: offline traegt JEDE Aktion `by = Geraetebesitzer`.
    // Ueber `by` haette `seen` nie mehr als einen Eintrag bekommen.
    const players = runde(5);
    let s = undercover.createState(players);
    expect(s.phase).toBe('reveal');
    for (const p of players) {
      s = tun(s, { type: 'seen', who: p.id, by: me.id }, players);
    }
    expect(s.seen).toHaveLength(players.length);
    expect(s.phase).toBe('describe');
  });

  it('öffnet am geteilten Handy in späteren Phasen keine Karte', () => {
    const players = runde(4);
    const state: State = { ...undercover.createState(players), phase: 'describe' };
    render(
      <PartyCtx.Provider value={{ me, players, mode: 'local' } as PartyValue}>
        <undercover.Component
          state={state} players={players} me={me} isHost online={false} dispatch={vi.fn()} quit={vi.fn()}
        />
      </PartyCtx.Provider>,
    );
    expect(screen.queryByRole('button', { name: /hochschieben/ })).not.toBeInTheDocument();
    expect(tun(state, { type: 'seen', who: me.id, round: state.round }, players)).toBe(state);
  });

  it('läuft am Gerät von der Übergabe bis durch die Abstimmung', () => {
    const players = runde(4);
    function Harness() {
      const [state, setState] = useState(() => undercover.createState(players));
      const Game = undercover.Component;
      return (
        <PartyCtx.Provider value={{ me, players } as unknown as PartyValue}>
          <Game
            state={state}
            players={players}
            me={me}
            isHost
            online={false}
            dispatch={(a: GameActionInput) => setState((s) => tun(s, a, players))}
            quit={() => {}}
          />
        </PartyCtx.Provider>
      );
    }
    render(<Harness />);
    // Auf den EXAKTEN Namen pruefen, nicht auf ein Muster: `player={me}` statt
    // `player={current}` wuerde bei jeder Uebergabe denselben Namen zeigen und
    // trotzdem durchlaufen - der Lauf saehe es nicht, die Runde am Tisch schon.
    const gesehen: string[] = [];
    const rollen: string[] = [];
    for (let i = 0; i < players.length; i++) {
      // Keine Übergabe-Seite mehr: der Name steht auf der Karte selbst.
      expect(screen.queryByRole('button', { name: /^Ich bin / })).toBeNull();
      const weiter = screen.getByRole('button', { name: 'Gemerkt – weitergeben' });
      expect((weiter as HTMLButtonElement).disabled, 'weitergeben ohne hinzusehen').toBe(true);
      const karte = screen.getByRole('button', { name: / · hochschieben$/ });
      gesehen.push(karte.getAttribute('aria-label')!.replace(' · hochschieben', ''));
      fireEvent.keyDown(karte, { key: 'Enter' });
      rollen.push(document.querySelector('.peekcard__under')!.textContent!);
      fireEvent.click(weiter);
    }
    expect(new Set(gesehen).size, `dieselbe Person mehrfach: ${gesehen.join(', ')}`).toBe(
      players.length,
    );
    // Genau eine Karte sagt es, und sie zeigt den Hinweis statt des Worts.
    const verdeckt = rollen.filter((t) => t.includes('Du bist Undercover'));
    expect(verdeckt).toHaveLength(1);
    expect(rollen.filter((t) => t.includes('Dein Wort'))).toHaveLength(players.length - 1);
    expect(screen.getByRole('button', { name: /abstimmen/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /hochschieben/ })).not.toBeInTheDocument();

    // Und durch die Abstimmung hindurch – dort hing das Spiel am geteilten
    // Handy, weil jede Stimme dieselbe Geräte-ID trug.
    fireEvent.click(screen.getByRole('button', { name: /abstimmen/ }));
    const aufdecken = screen.getByRole('button', { name: 'Aufdecken' }) as HTMLButtonElement;
    expect(aufdecken.disabled, 'ohne Finger ließ sich aufdecken').toBe(true);
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Mehr Finger bei Gast 1' }));
    }
    fireEvent.click(aufdecken);
    expect(screen.queryByRole('button', { name: 'Aufdecken' })).toBeNull();
  });
});

describe('Undercover: Abstimmung auf einem geteilten Handy', () => {
  it('kommt über gezählte Finger aus der Abstimmung heraus', () => {
    // Über `vote` trug am geteilten Handy JEDE Stimme `by = Gerätebesitzer`.
    // Es kam nie mehr als ein Eintrag zustande, und die Runde hing für immer.
    const players = runde(5);
    const start = { ...bisVote(players), undercoverIds: ['p4'] };
    const offline = abstimmen(start, players, {
      p0: 'p1',
      p1: 'p1',
      p2: 'p1',
      p3: 'p2',
      p4: 'p2',
    });
    expect(offline.phase).toBe('result');

    const s = tun(start, { type: 'countVotes', counts: { p1: 3, p2: 2 } }, players);
    expect(s.phase).toBe('result');
    expect(s.lastOut).toBe('p1');
    expect(s.eliminated).toEqual(['p1']);
    expect(s.tie).toBe(false);
  });

  it('führt einen enttarnten Undercover auch hier zum Rateversuch', () => {
    const players = runde(4);
    const start = bisVote(players);
    const s = tun(start, { type: 'countVotes', counts: { [start.undercoverIds[0]]: 4 } }, players);
    expect(s.phase).toBe('guess');
    expect(s.lastOut).toBe(start.undercoverIds[0]);
  });

  it('wertet ohne einen einzigen Finger nichts aus', () => {
    const players = runde(4);
    const start = bisVote(players);
    expect(tun(start, { type: 'countVotes', counts: {} }, players)).toBe(start);
  });

  it('zählt keine Finger für bereits Ausgeschiedene und deckelt je Person', () => {
    const players = runde(5);
    const start = { ...bisVote(players), eliminated: ['p3'], undercoverIds: ['p4'] };
    const s = tun(start, { type: 'countVotes', counts: { p3: 4, p1: 99 } }, players);
    expect(s.lastOut).toBe('p1');
    // Vier lebende Personen zeigen – mehr Finger kann niemand abbekommen.
    expect(Object.keys(s.votes)).toHaveLength(4);
  });
});

describe('Undercover: Stimmengleichstand', () => {
  it('entscheidet nicht mehr nach der Reihenfolge der Stimmabgabe', () => {
    // Vorher nahm `Object.keys(counts).find(...)` immer den zuerst gewaehlten.
    // Ueber viele Laeufe muessen beide Gleichstand-Kandidaten vorkommen.
    const players = runde(4);
    const raus = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const s = abstimmen(bisVote(players), players, {
        p0: 'p1',
        p1: 'p1',
        p2: 'p2',
        p3: 'p2',
      });
      expect(s.tie, 'kein Gleichstand hergestellt').toBe(true);
      raus.add(s.lastOut!);
    }
    expect(raus.has('p1'), 'p1 kam nie raus').toBe(true);
    expect(raus.has('p2'), 'p2 kam nie raus – es entschied die Reihenfolge').toBe(true);
  });

  it('sagt der Runde, dass das Los entschieden hat', () => {
    const players = runde(4);
    const s = abstimmen(bisVote(players), players, { p0: 'p1', p1: 'p1', p2: 'p2', p3: 'p2' });
    expect(s.tie).toBe(true);
  });

  it('meldet keinen Losentscheid, wenn es keinen gab', () => {
    // Gegenprobe: ein immer gesetztes Flag waere so gut wie keins.
    const players = runde(4);
    const s = abstimmen(bisVote(players), players, { p0: 'p1', p1: 'p1', p2: 'p1', p3: 'p2' });
    expect(s.tie).toBe(false);
    expect(s.lastOut).toBe('p1');
  });
});

describe('Undercover: der letzte Rateversuch', () => {
  /** Baut eine Runde, in der ein bekannter Undercover rausgewählt wird. */
  function enttarnt(players: GamePlayer[]) {
    const s = bisVote(players);
    const stimmen = Object.fromEntries(players.map((p) => [p.id, s.undercoverIds[0]]));
    return abstimmen(s, players, stimmen);
  }

  it('gibt dem Enttarnten drei Wörter zur Wahl, darunter das richtige', () => {
    const players = runde(4);
    const s = enttarnt(players);
    expect(s.phase).toBe('guess');
    expect(s.guessOptions).toHaveLength(3);
    expect(s.guessOptions).toContain(s.word);
    expect(new Set(s.guessOptions).size, 'ein Wort stand doppelt').toBe(3);
  });

  it('zeigt die Auswahl online nur auf dem Gerät des Enttarnten', () => {
    const players = runde(4);
    const state = { ...enttarnt(players), undercoverIds: ['p1'], lastOut: 'p1' };
    const dispatch = vi.fn();
    const Game = undercover.Component;
    const view = (player: GamePlayer, online: boolean) => (
      <PartyCtx.Provider value={{ me: player, players } as unknown as PartyValue}>
        <Game
          state={state}
          players={players}
          me={player}
          isHost={player.id === me.id}
          online={online}
          dispatch={dispatch}
          quit={() => {}}
        />
      </PartyCtx.Provider>
    );
    const { rerender } = render(view(me, true));
    for (const word of state.guessOptions) {
      expect(screen.queryByRole('button', { name: word })).toBeNull();
    }

    rerender(view(players[1], true));
    fireEvent.click(screen.getByRole('button', { name: state.guessOptions[0] }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'guess', word: state.guessOptions[0] });

    // Am geteilten Handy muss die Auswahl beim Gerätebesitzer weiterhin bedienbar sein.
    rerender(view(me, false));
    expect(screen.getByRole('button', { name: state.guessOptions[0] })).toBeTruthy();
  });

  it('dreht die Runde, wenn er trifft', () => {
    const players = runde(4);
    let s = enttarnt(players);
    const punkteVorher = s.agentWins;
    s = tun(s, { type: 'guess', word: s.word }, players);
    expect(s.winner).toBe('undercover');
    expect(s.agentWins).toBe(punkteVorher + 1);
    expect(s.phase).toBe('over');
  });

  it('gibt der Gruppe den Punkt, wenn er danebenliegt', () => {
    const players = runde(4);
    let s = enttarnt(players);
    const falsch = s.guessOptions.find((w) => w !== s.word)!;
    const punkteVorher = s.groupWins;
    s = tun(s, { type: 'guess', word: falsch }, players);
    expect(s.winner).toBe('gruppe');
    expect(s.groupWins).toBe(punkteVorher + 1);
  });
});

describe('Undercover: Abwechslung', () => {
  it('lost Undercover frei aus – auch zweimal hintereinander dieselbe Person', () => {
    // User-Entscheid 2026-09-16: eine Sperre entlastet den Vorgänger.
    const players = runde(4);
    let s = undercover.createState(players);
    let wiederholt = 0;
    for (let i = 0; i < 60; i++) {
      const vorher = s.undercoverIds[0];
      let n = bisVote(players, s);
      const stimmen = Object.fromEntries(players.map((p) => [p.id, n.undercoverIds[0]]));
      n = abstimmen(n, players, stimmen);
      n = tun(n, { type: 'guess', word: 'daneben' }, players);
      n = tun(n, { type: 'newRound' }, players);
      expect(n.phase, 'Partie vorzeitig zu Ende').toBe('reveal');
      if (n.undercoverIds[0] === vorher) wiederholt++;
      s = n;
    }
    expect(wiederholt).toBeGreaterThan(0);
  });

  it('lässt nicht immer dieselbe Person anfangen', () => {
    const players = runde(5);
    // Der Undercover wird festgelegt, damit der Rauswurf sicher NICHT in den
    // Rateversuch fuehrt. Ein `if (phase === 'result')` waere ein Notausgang,
    // der den Test bei jeder Aenderung stillschweigend leer laufen liesse.
    const start = { ...bisVote(players), undercoverIds: ['p4'] };
    const ersterVorher = start.order[0];
    let s = abstimmen(start, players, { p0: 'p1', p1: 'p1', p2: 'p1', p3: 'p2', p4: 'p2' });
    expect(s.phase, 'unerwarteter Pfad').toBe('result');
    s = tun(s, { type: 'continue' }, players);
    expect(s.order[0]).not.toBe(ersterVorher);
  });
});

describe('Undercover: Hinweise', () => {
  it('gibt nie das Wort selbst als Hinweis, und jedes Wort gibt es nur einmal', () => {
    for (const w of WORDS) {
      expect(w.hints.map((h) => h.toLowerCase()), w.word).not.toContain(w.word.toLowerCase());
      expect(new Set(w.hints).size, w.word).toBe(3);
    }
    expect(new Set(WORDS.map((w) => w.word)).size).toBe(WORDS.length);
  });

  it('bietet beim Raten nur Wörter derselben Kategorie an', () => {
    for (let i = 0; i < 30; i++) {
      const players = runde(4);
      let s = bisVote(players);
      const stimmen = Object.fromEntries(players.map((p) => [p.id, s.undercoverIds[0]]));
      s = abstimmen(s, players, stimmen);
      const kat = new Set(s.guessOptions.map((o) => WORDS.find((w) => w.word === o)!.category));
      expect(kat.size).toBe(1);
      expect(WORDS.find((w) => w.word === s.word)!.hints).toContain(s.hint);
    }
  });

  it('lässt auch Undercover als Erste beschreiben', () => {
    let erste = 0;
    for (let i = 0; i < 200; i++) {
      const s = undercover.createState(runde(4));
      if (s.order[0] === s.undercoverIds[0]) erste++;
    }
    expect(erste).toBeGreaterThan(0);
  });

  it('springt aus dem Beschreiben direkt zur Abstimmung, sonst nirgends', () => {
    const players = runde(4);
    const start = undercover.createState(players);
    expect(tun(start, { type: 'startVote' }, players).phase).toBe('reveal');
    expect(bisVote(players, start).phase).toBe('vote');
  });
});

describe('Undercover online: der Host schaltet weiter', () => {
  // Host markiert, sonst gilt jede Aktion als erlaubt (geteiltes Handy).
  const online = (n: number): GamePlayer[] =>
    runde(n).map((p) => ({ ...p, isHost: p.id === me.id }));

  it('Gäste können weder abstimmen lassen noch weiterschalten', () => {
    const players = online(4);
    const beschreiben = alleGesehen(undercover.createState(players), players);
    expect(tun(beschreiben, { type: 'startVote', by: 'p1' }, players)).toBe(beschreiben);
    const vote = tun(beschreiben, { type: 'startVote' }, players);
    expect(vote.phase).toBe('vote');

    // Ein Unschuldiger fliegt: Ergebnis, dann „Weiter beschreiben".
    const unschuldig = players.find((p) => p.id !== vote.undercoverIds[0])!.id;
    let s = vote;
    for (const p of players) s = tun(s, { type: 'vote', target: unschuldig, by: p.id }, players);
    expect(s.phase).toBe('result');
    expect(tun(s, { type: 'continue', by: 'p1' }, players)).toBe(s);
    expect(tun(s, { type: 'continue' }, players).phase).toBe('describe');
  });

  it('neue Runde nur vom Host', () => {
    const players = online(4);
    const over = { ...undercover.createState(players), phase: 'over' as const, winner: 'gruppe' as const };
    expect(tun(over, { type: 'newRound', by: 'p2' }, players)).toBe(over);
    expect(tun(over, { type: 'newRound' }, players).round).toBe(2);
  });

  it('der Host zählt mit Fingern aus, ein Gast nicht', () => {
    const players = online(4);
    const vote = bisVote(players);
    const counts = { [vote.undercoverIds[0]]: 3, [players.find((p) => p.id !== vote.undercoverIds[0])!.id]: 1 };
    expect(tun(vote, { type: 'countVotes', counts, by: 'p1' }, players)).toBe(vote);
    const out = tun(vote, { type: 'countVotes', counts }, players);
    expect(out.lastOut).toBe(vote.undercoverIds[0]);
  });

  function mountOnline(state: State, who: GamePlayer, players: GamePlayer[]) {
    const sent: GameActionInput[] = [];
    const Game = undercover.Component;
    render(
      <PartyCtx.Provider value={{ me: who, players, mode: 'online' } as unknown as PartyValue}>
        <Game
          state={state}
          players={players}
          me={who}
          isHost={who.isHost === true}
          online
          dispatch={(a: GameActionInput) => sent.push(a)}
          quit={() => {}}
        />
      </PartyCtx.Provider>,
    );
    return sent;
  }

  it('Gast sieht statt des Knopfs, wer weiterschaltet', () => {
    const players = online(4);
    const beschreiben = alleGesehen(undercover.createState(players), players);
    mountOnline(beschreiben, players[1], players);
    expect(screen.queryByRole('button', { name: /abstimmen/ })).toBeNull();
    expect(screen.getByText('Paul schaltet weiter.')).toBeTruthy();
  });

  it('Host schaltet online auf Fingerzählen um', () => {
    const players = online(4);
    const sent = mountOnline(bisVote(players), players[0], players);
    fireEvent.click(screen.getByRole('button', { name: 'Mit Fingern auszählen' }));
    expect(screen.getByText(/Auf drei zeigen alle/)).toBeTruthy();
    expect(sent).toEqual([]);
  });
});
