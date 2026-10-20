import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  for (const p of players) next = tun(next, { type: 'seen', who: p.id }, players);
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
    const start = { ...bisVote(players), undercoverId: 'p4' };
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
    const s = tun(start, { type: 'countVotes', counts: { [start.undercoverId]: 4 } }, players);
    expect(s.phase).toBe('guess');
    expect(s.lastOut).toBe(start.undercoverId);
  });

  it('wertet ohne einen einzigen Finger nichts aus', () => {
    const players = runde(4);
    const start = bisVote(players);
    expect(tun(start, { type: 'countVotes', counts: {} }, players)).toBe(start);
  });

  it('zählt keine Finger für bereits Ausgeschiedene und deckelt je Person', () => {
    const players = runde(5);
    const start = { ...bisVote(players), eliminated: ['p3'], undercoverId: 'p4' };
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
    const stimmen = Object.fromEntries(players.map((p) => [p.id, s.undercoverId]));
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
    const state = { ...enttarnt(players), undercoverId: 'p1', lastOut: 'p1' };
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
      const vorher = s.undercoverId;
      let n = bisVote(players, s);
      const stimmen = Object.fromEntries(players.map((p) => [p.id, n.undercoverId]));
      n = abstimmen(n, players, stimmen);
      n = tun(n, { type: 'guess', word: 'daneben' }, players);
      n = tun(n, { type: 'newRound' }, players);
      expect(n.phase, 'Partie vorzeitig zu Ende').toBe('reveal');
      if (n.undercoverId === vorher) wiederholt++;
      s = n;
    }
    expect(wiederholt).toBeGreaterThan(0);
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
      const stimmen = Object.fromEntries(players.map((p) => [p.id, s.undercoverId]));
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
      if (s.order[0] === s.undercoverId) erste++;
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
    const unschuldig = players.find((p) => p.id !== vote.undercoverId)!.id;
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
    const counts = { [vote.undercoverId]: 3, [players.find((p) => p.id !== vote.undercoverId)!.id]: 1 };
    expect(tun(vote, { type: 'countVotes', counts, by: 'p1' }, players)).toBe(vote);
    const out = tun(vote, { type: 'countVotes', counts }, players);
    expect(out.lastOut).toBe(vote.undercoverId);
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
