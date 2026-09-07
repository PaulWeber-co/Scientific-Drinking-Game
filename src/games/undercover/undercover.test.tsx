import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { undercover } from './index';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn(), setHapticsEnabled: vi.fn() }));
import { meta } from './meta';
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
  for (const p of players) next = tun(next, { type: 'seen', who: p.id }, players);
  return next;
}

/** Von `reveal` bis zur Abstimmung: alle schauen, dann beschreiben alle. */
function bisVote(players: GamePlayer[], start?: State): State {
  let s = alleGesehen(start ?? undercover.createState(players), players);
  const lebende = players.filter((p) => !s.eliminated.includes(p.id)).length;
  for (let i = 0; i < lebende; i++) s = tun(s, { type: 'nextSpeaker' }, players);
  return s;
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
  useApp.setState({ gameLength: 'endlos', spicy: {}, taskOnSkip: 'aus' });
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    currentDrinkId: 'beer-pils',
    log: [],
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

  it('läuft am Gerät von der Übergabe bis zum Beschreiben durch', () => {
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
    for (let i = 0; i < players.length; i++) {
      const knopf = screen.getByRole('button', { name: /^Ich bin / });
      gesehen.push(knopf.textContent!.replace('Ich bin ', '').trim());
      fireEvent.click(knopf);
      fireEvent.click(screen.getByRole('button', { name: 'Habe ich gesehen' }));
    }
    expect(new Set(gesehen).size, `dieselbe Person mehrfach: ${gesehen.join(', ')}`).toBe(
      players.length,
    );
    expect(screen.getByRole('button', { name: /Gesagt/ })).toBeTruthy();
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
    const stimmen = Object.fromEntries(players.map((p) => [p.id, s.undercoverId]));
    return abstimmen(s, players, stimmen);
  }

  it('gibt dem Enttarnten drei Wörter zur Wahl, darunter das richtige', () => {
    const players = runde(4);
    const s = enttarnt(players);
    expect(s.phase).toBe('guess');
    expect(s.guessOptions).toHaveLength(3);
    expect(s.guessOptions).toContain(s.words[0]);
    expect(new Set(s.guessOptions).size, 'ein Wort stand doppelt').toBe(3);
  });

  it('dreht die Runde, wenn er trifft', () => {
    const players = runde(4);
    let s = enttarnt(players);
    const punkteVorher = s.agentWins;
    s = tun(s, { type: 'guess', word: s.words[0] }, players);
    expect(s.winner).toBe('undercover');
    expect(s.agentWins).toBe(punkteVorher + 1);
    expect(s.phase).toBe('over');
  });

  it('gibt der Gruppe den Punkt, wenn er danebenliegt', () => {
    const players = runde(4);
    let s = enttarnt(players);
    const falsch = s.guessOptions.find((w) => w !== s.words[0])!;
    const punkteVorher = s.groupWins;
    s = tun(s, { type: 'guess', word: falsch }, players);
    expect(s.winner).toBe('gruppe');
    expect(s.groupWins).toBe(punkteVorher + 1);
  });
});

describe('Undercover: Abwechslung', () => {
  it('macht nicht zweimal hintereinander dieselbe Person zum Undercover', () => {
    // „Oft ist die gleiche Person der Imposter" ist die haeufigste Beschwerde
    // bei den Vertretern dieses Genres.
    const players = runde(4);
    let s = undercover.createState(players);
    for (let i = 0; i < 40; i++) {
      const vorher = s.undercoverId;
      let n = bisVote(players, s);
      const stimmen = Object.fromEntries(players.map((p) => [p.id, n.undercoverId]));
      n = abstimmen(n, players, stimmen);
      n = tun(n, { type: 'guess', word: 'daneben' }, players);
      n = tun(n, { type: 'newRound' }, players);
      expect(n.undercoverId, `Runde ${i}: zweimal dieselbe Person`).not.toBe(vorher);
      s = n;
    }
  });

  it('lässt nicht immer dieselbe Person anfangen', () => {
    const players = runde(5);
    // Der Undercover wird festgelegt, damit der Rauswurf sicher NICHT in den
    // Rateversuch fuehrt. Ein `if (phase === 'result')` waere ein Notausgang,
    // der den Test bei jeder Aenderung stillschweigend leer laufen liesse.
    const start = { ...bisVote(players), undercoverId: 'p4' };
    const ersterVorher = start.order[0];
    let s = abstimmen(start, players, { p0: 'p1', p1: 'p1', p2: 'p1', p3: 'p2', p4: 'p2' });
    expect(s.phase, 'unerwarteter Pfad').toBe('result');
    s = tun(s, { type: 'continue' }, players);
    expect(s.order[0]).not.toBe(ersterVorher);
    expect(s.turnIndex).toBe(0);
  });
});
