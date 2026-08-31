import { describe, expect, it } from 'vitest';
import { GAMES, gamesForGroup, getGame } from './registry';
import { encodeState, decodeState } from '../features/party/PartyContext';
import type { GameAction, GamePlayer } from './types';
import type { CardGameState } from './card-engine/createCardGame';
import { cardFromIndex } from './shared/deck';

const players = (n: number): GamePlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Spieler ${i}`,
    emoji: '🦊',
    online: true,
  }));

const act = (type: string, by = 'p0', extra: Record<string, unknown> = {}): GameAction => ({
  type,
  by,
  at: Date.now(),
  ...extra,
});

describe('Registry', () => {
  it('hat eindeutige IDs', () => {
    const ids = GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('beschreibt jedes Spiel vollstaendig', () => {
    for (const g of GAMES) {
      expect(g.name.length).toBeGreaterThan(2);
      expect(g.tagline.length).toBeGreaterThan(5);
      expect(g.howTo.length).toBeGreaterThanOrEqual(2);
      expect(g.minPlayers).toBeGreaterThanOrEqual(3);
      expect(g.maxPlayers).toBeGreaterThan(g.minPlayers);
      expect(g.tags.length).toBeGreaterThan(0);
      expect(g.accent).toMatch(/^var\(--/);
    }
  });

  it('deckt die Zielgruppe von 4 bis 16 Spielern ab', () => {
    for (let n = 4; n <= 16; n++) {
      expect(gamesForGroup(n, true).length, `${n} Spieler`).toBeGreaterThan(0);
      expect(gamesForGroup(n, false).length, `${n} Spieler ohne Lobby`).toBeGreaterThan(0);
    }
  });

  it('findet Spiele ueber getGame', () => {
    expect(getGame('kings-cup')?.name).toBe('Ring of Fire');
    expect(getGame('gibt-es-nicht')).toBeNull();
  });
});

describe('Alle Spiele: Grundverhalten', () => {
  it('erzeugen einen Startzustand, der die Firebase-Runde ueberlebt', () => {
    for (const g of GAMES) {
      const state = g.createState(players(6));
      const roundTrip = decodeState(encodeState(state));
      expect(roundTrip, g.id).toEqual(state);
    }
  });

  it('ignorieren unbekannte Aktionen, statt zu crashen', () => {
    for (const g of GAMES) {
      const state = g.createState(players(5));
      expect(() => g.reduce(state, act('quatsch'), players(5)), g.id).not.toThrow();
    }
  });

  it('ueberstehen zufaellige Aktionsfolgen ohne Ausnahme', () => {
    const types = ['draw', 'next', 'resolve', 'pickMode', 'answer', 'continue', 'flip', 'start',
      'pass', 'boom', 'hit', 'skip', 'foul', 'timeUp', 'submit', 'vote', 'lockOrder', 'setOrder',
      'restartBus', 'again', 'setHeat'];
    for (const g of GAMES) {
      const roster = players(5);
      let state = g.createState(roster);
      for (let i = 0; i < 120; i++) {
        const type = types[i % types.length];
        const by = roster[i % roster.length].id;
        expect(() => {
          state = g.reduce(
            state,
            act(type, by, { text: 'Antwort', target: 'p1', mode: 'wahrheit', heat: 2, answer: 'rot', order: ['p1', 'p0'] }),
            roster,
          );
        }, `${g.id} / ${type}`).not.toThrow();
        expect(state, `${g.id} / ${type}`).toBeTruthy();
      }
    }
  });
});

describe('Wahrheit oder Pflicht', () => {
  const game = getGame('truth-or-dare')!;

  it('startet mit der Modusauswahl', () => {
    const s = game.createState(players(4)) as CardGameState;
    expect(s.phase).toBe('choose');
    expect(s.order).toHaveLength(4);
  });

  it('zieht nach der Modusauswahl eine passende Karte', () => {
    let s = game.createState(players(4)) as CardGameState;
    s = game.reduce(s, act('pickMode', 'p0', { mode: 'pflicht' }), players(4));
    expect(s.phase).toBe('card');
    expect(s.drawn).not.toBeNull();
  });

  it('gibt den Zug nach next weiter und zaehlt Runden', () => {
    const roster = players(3);
    let s = game.createState(roster) as CardGameState;
    for (let i = 0; i < 3; i++) {
      s = game.reduce(s, act('pickMode', 'p0', { mode: 'wahrheit' }), roster);
      s = game.reduce(s, act('resolve', 'p0', { outcome: 'done' }), roster);
      s = game.reduce(s, act('next'), roster);
    }
    expect(s.turnIndex).toBe(0);
    expect(s.round).toBe(2);
  });

  it('nimmt Spieler auf, die spaeter dazukommen', () => {
    const roster = players(3);
    let s = game.createState(roster) as CardGameState;
    s = game.reduce(s, act('next'), players(5));
    expect(s.order).toHaveLength(5);
  });

  it('entfernt Spieler, die gegangen sind', () => {
    const roster = players(5);
    let s = game.createState(roster) as CardGameState;
    s = game.reduce(s, act('next'), players(3));
    expect(s.order).toHaveLength(3);
  });

  it('filtert Karten nach Haertegrad', () => {
    let s = game.createState(players(4)) as CardGameState;
    s = game.reduce(s, act('setHeat', 'p0', { heat: 1 }), players(4));
    expect(s.heat).toBe(1);
    expect(s.deck.length).toBeGreaterThan(0);
  });
});

describe('Ring of Fire', () => {
  const game = getGame('kings-cup')!;

  it('zaehlt Koenige und meldet den vierten', () => {
    const roster = players(4);
    let s = game.createState(roster);
    let kingsSeen = 0;
    for (let i = 0; i < 60 && kingsSeen < 4; i++) {
      s = game.reduce(s, act('draw'), roster);
      if (s.drawn != null && cardFromIndex(s.drawn).rank === 12) kingsSeen++;
      if (kingsSeen < 4) s = game.reduce(s, act('next'), roster);
    }
    expect(kingsSeen).toBe(4);
    expect(s.finalKing).toBe(true);
    expect(s.kings).toBe(4);
  });

  it('mischt neu, wenn das Deck leer ist', () => {
    const roster = players(4);
    let s = game.createState(roster);
    for (let i = 0; i < 60; i++) {
      s = game.reduce(s, act('draw'), roster);
      s = game.reduce(s, act('next'), roster);
    }
    expect(s.deck.length).toBeGreaterThan(0);
  });
});

describe('Busfahrer', () => {
  const game = getGame('busfahrer')!;

  it('durchlaeuft vier Fragen pro Spieler und bestimmt dann den Fahrer', () => {
    const roster = players(3);
    let s = game.createState(roster);
    for (let p = 0; p < 3; p++) {
      for (let q = 0; q < 4; q++) {
        s = game.reduce(s, act('answer', 'p0', { answer: 'rot' }), roster);
        expect(s.lastResult).not.toBeNull();
        s = game.reduce(s, act('continue'), roster);
      }
    }
    expect(s.phase).toBe('bus');
    expect(s.driverId).toBeTruthy();
    expect(roster.map((r) => r.id)).toContain(s.driverId);
  });

  it('schickt den Fahrer bei Bildkarten zurueck an den Start', () => {
    const roster = players(3);
    let s = game.createState(roster);
    s = { ...s, phase: 'bus', driverId: 'p0', busDeck: [12], busPos: 0, busAttempts: 1 }; // Koenig Pik
    s = game.reduce(s, act('flip'), roster);
    expect(s.busPenalty).toBeGreaterThan(0);
    s = game.reduce(s, act('restartBus'), roster);
    expect(s.busPos).toBe(0);
    expect(s.busAttempts).toBe(2);
  });

  it('beendet die Fahrt nach fuenf harmlosen Karten', () => {
    const roster = players(3);
    let s = game.createState(roster);
    s = { ...s, phase: 'bus', driverId: 'p0', busDeck: [1, 2, 3, 4, 5], busPos: 0 };
    for (let i = 0; i < 5; i++) s = game.reduce(s, act('flip'), roster);
    expect(s.phase).toBe('done');
  });
});

describe('Meme Battle', () => {
  const game = getGame('meme-battle')!;

  it('wechselt erst zur Abstimmung, wenn alle geschrieben haben', () => {
    const roster = players(3);
    let s = game.createState(roster);
    s = game.reduce(s, act('submit', 'p0', { text: 'A' }), roster);
    expect(s.phase).toBe('writing');
    s = game.reduce(s, act('submit', 'p1', { text: 'B' }), roster);
    s = game.reduce(s, act('submit', 'p2', { text: 'C' }), roster);
    expect(s.phase).toBe('voting');
    expect(s.reveal).toHaveLength(3);
  });

  it('verhindert Stimmen fuer die eigene Antwort', () => {
    const roster = players(3);
    let s = game.createState(roster);
    for (const p of roster) s = game.reduce(s, act('submit', p.id, { text: p.id }), roster);
    const before = { ...s.votes };
    s = game.reduce(s, act('vote', 'p0', { target: 'p0' }), roster);
    expect(s.votes).toEqual(before);
  });

  it('zaehlt Stimmen und geht ins Ergebnis', () => {
    const roster = players(3);
    let s = game.createState(roster);
    for (const p of roster) s = game.reduce(s, act('submit', p.id, { text: p.id }), roster);
    s = game.reduce(s, act('vote', 'p0', { target: 'p1' }), roster);
    s = game.reduce(s, act('vote', 'p1', { target: 'p2' }), roster);
    s = game.reduce(s, act('vote', 'p2', { target: 'p1' }), roster);
    expect(s.phase).toBe('results');
    expect(s.scores.p1).toBe(2);
  });

  it('ignoriert leere Antworten', () => {
    const roster = players(3);
    let s = game.createState(roster);
    s = game.reduce(s, act('submit', 'p0', { text: '   ' }), roster);
    expect(Object.keys(s.answers)).toHaveLength(0);
  });
});

describe('Top Ten', () => {
  const game = getGame('top-ten')!;

  it('vergibt eindeutige Zahlen zwischen 1 und 10', () => {
    const roster = players(8);
    const s = game.createState(roster);
    const nums = roster.map((p) => s.numbers[p.id]);
    expect(new Set(nums).size).toBe(8);
    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(10);
    }
  });

  it('geht nach allen Antworten ins Sortieren', () => {
    const roster = players(4);
    let s = game.createState(roster);
    for (const p of roster) s = game.reduce(s, act('submit', p.id, { text: 'x' }), roster);
    expect(s.phase).toBe('ordering');
    expect(s.captainOrder).toHaveLength(4);
  });

  it('wechselt den Kapitaen in der naechsten Runde', () => {
    const roster = players(4);
    let s = game.createState(roster);
    const first = s.captainIndex;
    s = game.reduce(s, act('next'), roster);
    expect(s.captainIndex).toBe((first + 1) % 4);
  });
});

describe('Tabu Rush', () => {
  const game = getGame('tabu')!;

  it('teilt die Spieler in zwei Teams', () => {
    const s = game.createState(players(6));
    expect(s.teams.A.length + s.teams.B.length).toBe(6);
    expect(Math.abs(s.teams.A.length - s.teams.B.length)).toBeLessThanOrEqual(1);
  });

  it('zaehlt Treffer und schreibt sie dem Team gut', () => {
    const roster = players(4);
    let s = game.createState(roster);
    s = game.reduce(s, act('start'), roster);
    s = game.reduce(s, act('hit'), roster);
    s = game.reduce(s, act('hit'), roster);
    s = game.reduce(s, act('foul'), roster);
    expect(s.hits).toBe(2);
    expect(s.fouls).toBe(1);
    s = game.reduce(s, act('timeUp'), roster);
    expect(s.score.A).toBe(2);
    expect(s.phase).toBe('result');
  });

  it('endet nach sechs Runden', () => {
    const roster = players(4);
    let s = game.createState(roster);
    for (let i = 0; i < 6; i++) {
      s = game.reduce(s, act('start'), roster);
      s = game.reduce(s, act('timeUp'), roster);
      s = game.reduce(s, act('next'), roster);
    }
    expect(s.phase).toBe('final');
  });
});

describe('Wortbombe', () => {
  const game = getGame('wortbombe')!;

  it('zuendet zwischen 22 und 75 Sekunden', () => {
    const roster = players(4);
    const s = game.reduce(game.createState(roster), act('start'), roster);
    const left = s.explodesAt - Date.now();
    expect(left).toBeGreaterThan(21_000);
    expect(left).toBeLessThan(76_000);
  });

  it('reicht die Bombe reihum weiter', () => {
    const roster = players(4);
    let s = game.reduce(game.createState(roster), act('start'), roster);
    s = game.reduce(s, act('pass'), roster);
    expect(s.holderIndex).toBe(1);
  });

  it('trifft beim Boom genau den Halter', () => {
    const roster = players(4);
    let s = game.reduce(game.createState(roster), act('start'), roster);
    s = game.reduce(s, act('pass'), roster);
    const holder = s.order[s.holderIndex];
    s = game.reduce(s, act('boom'), roster);
    expect(s.phase).toBe('boom');
    expect(s.losses[holder]).toBe(1);
  });

  it('reagiert nicht auf pass, solange die Bombe nicht scharf ist', () => {
    const roster = players(4);
    const s = game.createState(roster);
    expect(game.reduce(s, act('pass'), roster).holderIndex).toBe(0);
  });
});
