import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { render } from '../../test/render';
import { useState } from 'react';
import { topTen } from './index';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn(), setHapticsEnabled: vi.fn() }));

import { meta } from './meta';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { usePlayer, defaultProfile } from '../../store/player';
import { useApp } from '../../store/app';
import { useSeen } from '../../store/seen';
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

type State = ReturnType<typeof topTen.createState>;
const tun = (s: State, a: GameActionInput, players: GamePlayer[]) =>
  topTen.reduce(s, { ...a, by: a.by ?? me.id, at: Date.now() } as GameAction, players);

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.999);
  useApp.setState({ gameLength: 'endlos', spicy: {}, taskOnSkip: 'aus' });
  useSeen.setState({ seen: {}, cursor: 0 });
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    currentDrinkId: 'beer-pils',
    log: [],
  });
  // jsdom kennt weder Layout noch Pointer-Capture – beides stellt die
  // Aufdeck-Karte (PeekCard), sonst loest der Tipp-zum-Aufdecken-Pfad nie aus.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 200,
  });
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
});

/** Tippt die Aufdeck-Karte auf, ohne zu ziehen – die Bedienung ohne Wischen. */
function tippeKarteAuf() {
  const deckel = document.querySelector('.peekcard__lid') as HTMLElement;
  fireEvent.pointerDown(deckel, { pointerId: 1, clientY: 300 });
  fireEvent.pointerUp(deckel, { pointerId: 1 });
}

describe('Top Ten auf einem geteilten Handy', () => {
  it('bietet sich ohne eigene Geräte an', () => {
    expect(meta.requiresOwnDevice).toBe(false);
  });

  it('läuft an einem Gerät von der Zahlen-Übergabe bis in die nächste Runde durch', () => {
    const players = runde(3);
    function Harness() {
      const [state, setState] = useState<State>(() => topTen.createState(players));
      const Game = topTen.Component;
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

    // Übergabe: jede Person sieht ihre Zahl per Aufdeck-Karte, sagt sie laut
    // (im Test: notiert), dann weiter ans nächste Handy.
    const gesehen: { name: string; zahl: number }[] = [];
    for (const p of players) {
      fireEvent.click(screen.getByRole('button', { name: `Ich bin ${p.name}` }));
      tippeKarteAuf();
      const zahl = Number(document.querySelector('.secret__num')!.textContent);
      gesehen.push({ name: p.name, zahl });
      fireEvent.click(screen.getByRole('button', { name: 'Habe ich gesehen' }));
    }

    // Aufdecken: der Kapitän tippt in der richtigen Reihenfolge – keine Fehler.
    const richtig = [...gesehen].sort((a, b) => a.zahl - b.zahl);
    for (const p of richtig) {
      fireEvent.click(screen.getByRole('button', { name: p.name }));
    }

    // Auflösung, dann weiter in Runde 2 – die Übergabe beginnt von vorn.
    expect(screen.getByText('Perfekt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Runde' }));
    expect(screen.getByRole('button', { name: /^Ich bin / })).toBeTruthy();
  });

  it('lässt am geteilten Handy auch einen Gast als Kapitän aufdecken', () => {
    // Ab Runde zwei ist ein Gast Kapitän. Vorher zeigte das Handy dann nur
    // „Nur Gast 1 deckt gerade auf." – ohne Knopf, die Partie hing.
    const players = runde(3);
    let spiel!: State;
    function Harness() {
      const [state, setState] = useState<State>(() => topTen.createState(players));
      spiel = state;
      const Game = topTen.Component;
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

    const runde1 = () => {
      const gesehen: { name: string; zahl: number }[] = [];
      for (const p of players) {
        fireEvent.click(screen.getByRole('button', { name: `Ich bin ${p.name}` }));
        tippeKarteAuf();
        gesehen.push({ name: p.name, zahl: Number(document.querySelector('.secret__num')!.textContent) });
        fireEvent.click(screen.getByRole('button', { name: 'Habe ich gesehen' }));
      }
      for (const p of [...gesehen].sort((a, b) => a.zahl - b.zahl)) {
        fireEvent.click(screen.getByRole('button', { name: p.name }));
      }
    };

    runde1();
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Runde' }));
    runde1();
    const kapitaen = players[spiel.captainIndex % players.length];
    expect(kapitaen.id).not.toBe(me.id);
    expect(screen.queryByText(/deckt gerade auf/)).toBeNull();
    expect(spiel.phase).toBe('results');
  });

  it('kostet beim Aufdecken ein Plättchen, wenn eine Zahl kleiner ist als die vorherige', () => {
    const players = runde(4);
    let s = topTen.createState(players);
    const startTokens = s.tokens;
    s = tun(s, { type: 'startReveal' }, players);
    const byNumber = [...s.order].sort((a, b) => s.numbers[a] - s.numbers[b]);
    const [kleinste, zweitkleinste] = byNumber;
    s = tun(s, { type: 'reveal', id: zweitkleinste }, players);
    expect(s.tokens, 'die erste aufgedeckte Zahl kann keinen Fehler auslösen').toBe(startTokens);
    s = tun(s, { type: 'reveal', id: kleinste }, players);
    expect(s.tokens, 'eine kleinere Zahl nach einer größeren muss ein Plättchen kosten').toBe(
      startTokens - 1,
    );
  });

  it('beendet die Partie sofort, wenn der Plättchenvorrat leer ist', () => {
    const players = runde(3);
    let s = topTen.createState(players);
    expect(s.tokens).toBe(3);
    // Volle Absteige-Reihenfolge je Runde: garantiert bei drei Spielern zwei
    // Fehler, unabhängig davon, wie die Zahlen ausgeteilt wurden.
    for (let runden = 0; runden < 10 && s.phase !== 'over'; runden++) {
      s = tun(s, { type: 'startReveal' }, players);
      const absteigend = [...s.order].sort((a, b) => s.numbers[b] - s.numbers[a]);
      for (const id of absteigend) {
        if (s.phase !== 'revealing') break;
        s = tun(s, { type: 'reveal', id }, players);
      }
      if (s.phase === 'results') s = tun(s, { type: 'next' }, players);
    }
    expect(s.phase).toBe('over');
    expect(s.tokens).toBe(0);
    expect(s.lostGame).toBe(true);
  });
});

describe('Top Ten online', () => {
  const roster = runde(4).map((p) => ({ ...p, isHost: p.id === me.id }));

  it('online: sammelt getippte Antworten und wechselt nach der letzten zum Vorlesen', () => {
    let state = topTen.createState(roster);
    expect(tun(state, { type: 'startReveal' }, roster)).toBe(state);
    expect(tun(state, { type: 'startSorting' }, roster)).toBe(state);
    for (const p of roster.slice(0, -1)) {
      state = tun(state, { type: 'submit', text: `Antwort von ${p.name}`, by: p.id }, roster);
      expect(state.phase).toBe('writing');
    }
    state = tun(state, { type: 'submit', text: 'Die letzte Antwort', by: roster[3].id }, roster);
    expect(state.phase).toBe('reading');
    expect(Object.keys(state.answers)).toHaveLength(4);
  });

  it('wartet beim Vorlesen nicht auf später beigetretene Gäste ohne Geheimzahl', () => {
    const start = topTen.createState(roster);
    const guest: GamePlayer = { id: 'p4', name: 'Später Gast', color: 'pink', online: true, isHost: false };
    const players = [...roster, guest];
    const Game = topTen.Component;
    const view = (state: State, me: GamePlayer) => (
      <PartyCtx.Provider value={{ me, players } as unknown as PartyValue}>
        <Game state={state} players={players} me={me} isHost={!!me.isHost} online dispatch={vi.fn()} quit={vi.fn()} />
      </PartyCtx.Provider>
    );
    const { rerender } = render(view(start, guest));
    expect(screen.getByText('Du schaust diese Runde zu.')).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(tun(start, { type: 'submit', text: 'Nicht Teil der Runde', by: guest.id }, players)).toBe(start);

    let state = tun(start, { type: 'submit', text: 'Antwort', by: roster[0].id }, players);
    rerender(view(state, roster[0]));
    expect(screen.queryByText(/Später Gast/)).not.toBeInTheDocument();
    for (const p of roster.slice(1)) {
      state = tun(state, { type: 'submit', text: 'Antwort', by: p.id }, players);
    }
    expect(state.phase).toBe('reading');
    rerender(view(state, roster[0]));
    const rows = within(screen.getByRole('list', { name: 'Antworten' })).getAllByRole('listitem');
    expect(rows).toHaveLength(roster.length);
    state = tun(state, { type: 'startSorting' }, players);
    for (const id of [...state.order].sort((a, b) => state.numbers[a] - state.numbers[b])) {
      state = tun(state, { type: 'reveal', id }, players);
    }
    expect(state.phase).toBe('results');
    rerender(view(state, roster[0]));
    expect(screen.getByText(/Gast 1, Gast 2, Gast 3 sehen die eigene Menge/)).toBeVisible();
    expect(screen.queryByText(/Später Gast/)).not.toBeInTheDocument();
    expect(tun(state, { type: 'next' }, players).numbers[guest.id]).toBeGreaterThan(0);
  });

  it('zeigt beim Vorlesen Kategorie und Antworten ohne Geheimzahlen und markiert die eigene Zeile', () => {
    const players = roster.map((p) => p.id === 'p3' ? { ...p, online: false } : p);
    let state = topTen.createState(players);
    for (const p of players.slice(0, -1)) {
      state = tun(state, { type: 'submit', text: `Antwort von ${p.name}`, by: p.id }, players);
    }
    const Game = topTen.Component;
    const dispatch = vi.fn();
    const view = (viewer: GamePlayer) => (
      <PartyCtx.Provider value={{ me: viewer, players } as unknown as PartyValue}>
        <Game state={state} players={players} me={viewer} isHost={!!viewer.isHost} online dispatch={dispatch} quit={vi.fn()} />
      </PartyCtx.Provider>
    );
    const { rerender } = render(view(players[1]));
    expect(screen.getByText('Ein Ort zum Uebernachten')).toBeInTheDocument();
    const rows = within(screen.getByRole('list', { name: 'Antworten' })).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.textContent)).toEqual([
      'PaulAntwort von Paul',
      'Gast 1Antwort von Gast 1Lies deine Antwort laut vor',
      'Gast 2Antwort von Gast 2',
      'Gast 3—',
    ]);
    expect(rows[1]).toHaveAttribute('style', expect.stringContaining('var(--surface-3)'));
    expect(screen.getByText('Paul startet das Sortieren.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alle gehört – sortieren' })).not.toBeInTheDocument();
    rerender(view(players[0]));
    fireEvent.click(screen.getByRole('button', { name: 'Alle gehört – sortieren' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'startSorting' });
  });

  it('lässt nur den anwesenden Kapitän sortieren und wechselt nach dem Überspringen zum nächsten Sitz', () => {
    let state = { ...topTen.createState(roster), captainIndex: 1 };
    for (const p of roster) {
      state = tun(state, { type: 'submit', text: `Antwort von ${p.name}`, by: p.id }, roster);
    }
    expect(state.phase).toBe('reading');
    expect(tun(state, { type: 'startSorting', by: 'p2' }, roster)).toBe(state);
    expect(tun(state, { type: 'startSorting', by: 'p0' }, roster)).toBe(state);
    const sorting = tun(state, { type: 'startSorting', by: 'p1' }, roster);
    expect(sorting.phase).toBe('revealing');
    expect(tun(sorting, { type: 'reveal', by: 'p2', id: 'p0' }, roster)).toBe(sorting);
    expect(tun(sorting, { type: 'startSorting', by: 'p1' }, roster)).toBe(sorting);

    const offline = roster.map((p) => p.id === 'p1' ? { ...p, online: false } : p);
    expect(tun(state, { type: 'startSorting', by: 'p0' }, offline)).toBe(state);
    expect(tun(state, { type: 'startSorting', by: 'p1' }, offline)).toBe(state);
    expect(tun(state, { type: 'skipAbsent', by: 'p0', who: 'p1' }, offline).captainIndex).toBe(2);

    const present = roster.filter((p) => p.id !== 'p1');
    const Game = topTen.Component;
    const dispatch = vi.fn();
    const view = (s: State, viewer = present[0]) => (
      <PartyCtx.Provider value={{ me: viewer, players: present } as unknown as PartyValue}>
        <Game state={s} players={present} me={viewer} isHost={Boolean(viewer.isHost)} online dispatch={dispatch} quit={vi.fn()} />
      </PartyCtx.Provider>
    );
    const { rerender } = render(view(state));
    expect(screen.getByText('Gast 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alle gehört – sortieren' })).not.toBeInTheDocument();
    expect(tun(state, { type: 'startSorting', by: 'p2' }, present)).toBe(state);
    fireEvent.click(screen.getByRole('button', { name: 'Gast 1 überspringen' }));
    const transferred = tun(state, dispatch.mock.calls[0][0], present);
    let rescued = tun(transferred, { type: 'startSorting', by: 'p2' }, present);
    expect(rescued.phase).toBe('revealing');
    rerender(view(rescued, present[1]));
    expect(screen.queryByRole('button', { name: 'Gast 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paul' })).toBeEnabled();
    for (const id of [...present.map((p) => p.id)].sort((a, b) => rescued.numbers[a] - rescued.numbers[b])) {
      rescued = tun(rescued, { type: 'reveal', by: 'p2', id }, present);
    }
    expect(rescued.phase).toBe('results');
    expect(tun(rescued, { type: 'next' }, roster).perfect).toEqual({ p2: 1 });
  });

  it.each([
    { reason: 'entfernt', players: roster.filter((p) => p.id !== 'p1') },
    { reason: 'offline', players: roster.map((p) => p.id === 'p1' ? { ...p, online: false } : p) },
  ])('erklärt Gästen die Übergabe beim Vorlesen, wenn der Kapitän $reason ist', ({ players }) => {
    const state: State = { ...topTen.createState(roster), phase: 'reading', captainIndex: 1 };
    const viewer = roster[3];
    const view = (s: State) => (
      <PartyCtx.Provider value={{ me: viewer, players } as unknown as PartyValue}>
        <topTen.Component state={s} players={players} me={viewer} isHost={false} online dispatch={vi.fn()} quit={vi.fn()} />
      </PartyCtx.Provider>
    );
    const { rerender } = render(view(state));
    expect(screen.getByText('Gast 1 ist nicht da – Paul kann überspringen.')).toBeVisible();
    expect(screen.getByText('Danach startet die nächste anwesende Person das Sortieren.')).toBeVisible();
    expect(screen.queryByText('Der Host startet das Sortieren.')).not.toBeInTheDocument();
    const transferred = tun(state, { type: 'skipAbsent', by: 'p0', who: 'p1' }, players);
    rerender(view(transferred));
    expect(screen.getByText('Gast 2 startet das Sortieren.')).toBeVisible();
    expect(screen.queryByText(/Danach startet/)).not.toBeInTheDocument();
  });

  it('bietet den Abschluss an, wenn die letzte verdeckte Person geht', () => {
    const answers = Object.fromEntries(roster.map((p) => [p.id, p.name]));
    let state: State = { ...topTen.createState(roster), phase: 'revealing', captainIndex: 3, answers };
    const remaining = roster.slice(0, -1);
    for (const p of remaining) state = tun(state, { type: 'reveal', by: 'p3', id: p.id }, roster);
    expect(tun(state, { type: 'finishSorting', by: 'p3' }, roster)).toBe(state);
    expect(tun(state, { type: 'finishSorting', by: 'p1' }, remaining)).toBe(state);
    const Game = topTen.Component;
    const dispatch = vi.fn();
    render(
      <PartyCtx.Provider value={{ me: remaining[0], players: remaining } as unknown as PartyValue}>
        <Game state={state} players={remaining} me={remaining[0]} isHost online dispatch={dispatch} quit={vi.fn()} />
      </PartyCtx.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gast 3 überspringen' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'skipAbsent', who: 'p3' });
    const results = tun(state, dispatch.mock.calls[0][0], remaining);
    expect(results.phase).toBe('results');
    expect(tun(results, { type: 'next' }, remaining).perfect).toEqual({});
  });

  it('rechnet eine fertige Sortierung auch nach Ausfall der richtigen Person zu', () => {
    const answers = Object.fromEntries(roster.map((p) => [p.id, p.name]));
    let state: State = { ...topTen.createState(roster), captainIndex: 1, phase: 'revealing', answers };
    for (const id of [...state.order].sort((a, b) => state.numbers[a] - state.numbers[b])) {
      state = tun(state, { type: 'reveal', by: 'p1', id }, roster);
    }
    expect(state.phase).toBe('results');
    const remaining = roster.filter((p) => p.id !== 'p1');
    const Game = topTen.Component;
    render(
      <PartyCtx.Provider value={{ me: remaining[0], players: remaining } as unknown as PartyValue}>
        <Game state={state} players={remaining} me={remaining[0]} isHost online dispatch={vi.fn()} quit={vi.fn()} />
      </PartyCtx.Provider>,
    );
    expect(screen.getByText('Gast 1 hat alles richtig aufgedeckt. Alle anderen trinken.')).toBeInTheDocument();
    expect(tun(state, { type: 'next' }, remaining).perfect).toEqual({ p1: 1 });
  });

  it('behält beim Neustart mit nur dem Host den Online-Ablauf', () => {
    const initial = topTen.createState(roster);
    const alone = roster.slice(0, 1);
    const restarted = tun(initial, { type: 'restart' }, alone);
    expect(tun(restarted, { type: 'startReveal' }, alone)).toBe(restarted);
    expect(tun(restarted, { type: 'submit', text: 'Meine Antwort' }, alone).phase).toBe('reading');
  });
});
