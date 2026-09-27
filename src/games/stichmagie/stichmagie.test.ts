import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../../store/app';
import { decodeState, encodeState } from '../../features/party/PartyContext';
import type { GameAction, GamePlayer } from '../types';
import {
  actorsOf,
  cardsThisRound,
  createState,
  dealerId,
  firstId,
  hexeTakeable,
  reduce,
  startRound,
  type State,
} from './game';
import { botMove } from './bot';
import {
  MAGIER,
  NARREN,
  SPECIALS,
  SPECIAL_ID,
  choiceFor,
  legalCards,
  maxRounds,
  planFor,
  resolveTrick,
  roundScore,
  strongestIndex,
  trumpFrom,
  vampirCopy,
  type Played,
} from './rules';

const spieler = (n: number): GamePlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Spieler ${i}`,
    color: 'blue' as const,
    online: true,
  }));

const tun = (s: State, p: GamePlayer[], action: Record<string, unknown>, by = 'p0') =>
  reduce(s, { by, at: Date.now(), ...action } as GameAction, p);

/** Farbkarte bauen: Farbe 0–3, Wert 1–13. */
const num = (suit: number, value: number) => suit * 13 + value - 1;
const [M1, M2] = MAGIER;
const [N1, N2, N3] = NARREN;
const { drache, fee, bombe, werwolf, jongleur, wolke, wandler, hexe, vampir } = SPECIAL_ID;

const lay = (...cards: (number | [number, Partial<Played>])[]): Played[] =>
  cards.map((c, i) =>
    Array.isArray(c) ? { card: c[0], by: `p${i}`, ...c[1] } : { card: c, by: `p${i}` },
  );

/** Reproduzierbarer Zufall, damit ein roter Lauf nachstellbar ist. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

beforeEach(() => {
  useApp.setState({ gameLength: 'mittel' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Rundenplan', () => {
  it('gibt so viele Runden wie das Grundspiel', () => {
    expect(maxRounds(3)).toBe(20);
    expect(maxRounds(4)).toBe(15);
    expect(maxRounds(5)).toBe(12);
    expect(maxRounds(6)).toBe(10);
    expect(maxRounds(8)).toBe(7);
    expect(maxRounds(10)).toBe(6);
  });

  it('kennt kurz, voll und rauf-runter', () => {
    expect(planFor(6, 'voll')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(planFor(6, 'kurz')).toEqual([1, 2, 3, 4, 5]);
    expect(planFor(4, 'rauf-runter')).toEqual([
      ...Array.from({ length: 15 }, (_, i) => i + 1),
      ...Array.from({ length: 14 }, (_, i) => 14 - i),
    ]);
  });
});

describe('Trumpf', () => {
  it('nimmt die Farbe der aufgedeckten Karte', () => {
    expect(trumpFrom(num(2, 7))).toEqual({ trump: 2, dealerChooses: false });
  });
  it('lässt beim Magier den Geber wählen, beim Narren gibt es keinen', () => {
    expect(trumpFrom(M1).dealerChooses).toBe(true);
    expect(trumpFrom(N1)).toEqual({ trump: null, dealerChooses: false });
    expect(trumpFrom(null)).toEqual({ trump: null, dealerChooses: false });
  });
  it('lässt bei Drache, Wolke und Werwolf den Geber wählen, bei Hexe, Fee und Bombe nicht', () => {
    for (const c of [drache, wolke, werwolf, jongleur, wandler, vampir]) {
      expect(trumpFrom(c).dealerChooses, String(c)).toBe(true);
    }
    for (const c of [hexe, fee, bombe]) expect(trumpFrom(c).trump, String(c)).toBeNull();
  });
});

describe('Bedienen', () => {
  const hand = [num(0, 3), num(1, 9), M1, N1, drache, jongleur, vampir];

  it('zwingt zur ausgespielten Farbe, Sonderkarten gehen immer', () => {
    const legal = legalCards(hand, lay(num(0, 10)), null);
    expect(legal.sort()).toEqual([num(0, 3), M1, N1, drache, jongleur, vampir].sort());
  });

  it('gibt alles frei, wenn man die Farbe nicht hat', () => {
    expect(legalCards(hand, lay(num(2, 10)), null)).toHaveLength(hand.length);
  });

  it('lässt nach einem Narren die nächste Farbkarte bestimmen', () => {
    const legal = legalCards(hand, lay(N2, num(1, 2)), null);
    expect(legal).not.toContain(num(0, 3));
    expect(legal).toContain(num(1, 9));
  });

  it('gibt den Stich frei, wenn ein Magier oder der Drache vorne liegt', () => {
    expect(legalCards(hand, lay(M2, num(1, 2)), null)).toHaveLength(hand.length);
    expect(legalCards(hand, lay(N2, drache), null)).toHaveLength(hand.length);
  });

  it('macht Jongleur und Wolke zur angesagten Farbe', () => {
    const legal = legalCards(hand, lay([wolke, { suit: 1 }]), null);
    expect(legal).toContain(num(1, 9));
    expect(legal).not.toContain(num(0, 3));
  });

  it('verlangt keinen Vampir zum Bedienen, auch wenn er die Farbe kopiert', () => {
    // Nur Vampir (als Rot 5) und eine grüne Karte: Rot wird ausgespielt.
    const legal = legalCards([vampir, num(2, 4)], lay(num(0, 10)), num(0, 5));
    expect(legal.sort()).toEqual([vampir, num(2, 4)].sort());
  });
});

describe('Wer den Stich bekommt', () => {
  const win = (trick: Played[], trump: number | null = null, vampirAs: number | null = null) =>
    resolveTrick(trick, trump, vampirAs);

  it('gibt ihn dem ersten Magier', () => {
    expect(win(lay(num(0, 13), M1, M2)).winner).toBe('p1');
  });

  it('gibt ihn der höchsten Trumpfkarte, sonst der höchsten der Farbe', () => {
    expect(win(lay(num(0, 13), num(1, 2), num(0, 1)), 1).winner).toBe('p1');
    expect(win(lay(num(0, 5), num(1, 13), num(0, 9)), 3).winner).toBe('p2');
  });

  it('gibt ihn dem ersten Narren, wenn nur Narren liegen', () => {
    expect(win(lay(N1, N2, N3)).winner).toBe('p0');
  });

  it('lässt den Drachen alles schlagen, auch Magier', () => {
    expect(win(lay(M1, drache, num(0, 13)), 0).winner).toBe('p1');
  });

  it('lässt die Fee den Drachen bezwingen – sonst verliert sie', () => {
    const r = win(lay(drache, num(0, 2), fee));
    expect(r.winner).toBe('p2');
    expect(r.fairyBeatsDragon).toBe(true);
    expect(win(lay(fee, N1, num(1, 2))).winner).toBe('p2');
    expect(win(lay(fee, N1, N2)).winner).toBe('p1');
  });

  it('lässt bei der Bombe niemanden gewinnen, die höchste Karte spielt aus', () => {
    const r = win(lay(num(0, 5), bombe, num(0, 11)), null);
    expect(r.winner).toBeNull();
    expect(r.bomb).toBe(true);
    expect(r.lead).toBe('p2');
  });

  it('wertet den Jongleur als 7½ und die Wolke als 9¾', () => {
    expect(win(lay(num(1, 7), [jongleur, { suit: 1 }])).winner).toBe('p1');
    expect(win(lay(num(1, 8), [jongleur, { suit: 1 }])).winner).toBe('p0');
    expect(win(lay(num(2, 9), [wolke, { suit: 2 }], num(2, 10))).winner).toBe('p2');
    expect(win(lay(num(2, 9), [wolke, { suit: 2 }])).winner).toBe('p1');
    // Als Trumpf gewählt sticht die Wolke eine Dreizehn.
    expect(win(lay(num(2, 13), [wolke, { suit: 0 }]), 0).winner).toBe('p1');
  });

  it('lässt den Gestaltwandler Magier oder Narr sein', () => {
    expect(win(lay(num(0, 13), [wandler, { shape: 'magier' }])).winner).toBe('p1');
    expect(win(lay(num(0, 2), [wandler, { shape: 'narr' }])).winner).toBe('p0');
  });

  it('lässt den Vampir die Trumpfkarte kopieren', () => {
    expect(win(lay(num(0, 13), vampir), null, M1).winner).toBe('p1');
    expect(win(lay(M1, vampir), null, drache).winner).toBe('p1');
    expect(win(lay(num(1, 12), vampir), 1, num(1, 13)).winner).toBe('p1');
    expect(win(lay(num(1, 2), vampir), null, N1).winner).toBe('p0');
    expect(choiceFor(vampir, wolke)).toBe('suit');
    expect(choiceFor(vampir, num(0, 3))).toBeNull();
  });

  it('kopiert beim Werwolf die Karte darunter', () => {
    expect(vampirCopy(werwolf, num(3, 4))).toBe(num(3, 4));
    expect(vampirCopy(M1, num(3, 4))).toBe(M1);
    expect(vampirCopy(null, null)).toBeNull();
  });

  it('bleibt bei der Hexe die schwächste Karte', () => {
    expect(strongestIndex(lay(hexe, N1, fee), null, null)).toBe(1);
    expect(strongestIndex(lay(hexe, fee, bombe), null, null)).toBe(1);
  });
});

describe('Wertung', () => {
  it('gibt 20 plus 10 je Stich für eine Punktlandung, sonst minus 10 je Stich', () => {
    expect(roundScore(0, 0)).toBe(20);
    expect(roundScore(3, 3)).toBe(50);
    expect(roundScore(2, 5)).toBe(-30);
    expect(roundScore(4, 1)).toBe(-30);
  });
});

/** Eine Runde mit festen Händen – ohne Zufall beim Geben. */
function fixed(p: GamePlayer[], hands: number[][], opts: Partial<State> = {}): State {
  let s = createState(p);
  s = { ...s, plan: [hands[0].length], seats: s.seats };
  s = startRound(s, 0, p.length - 1);
  const handsById = Object.fromEntries(p.map((x, i) => [x.id, hands[i]]));
  return {
    ...s,
    hands: handsById,
    phase: 'bid',
    turn: firstId(s),
    trump: null,
    vampirAs: null,
    ...opts,
  };
}

describe('Ablauf', () => {
  it('startet im Einrichten und gibt beim Austeilen jeder Person die Rundenkarten', () => {
    const p = spieler(4);
    let s = createState(p);
    expect(s.phase).toBe('setup');
    s = tun(s, p, { type: 'deal' });
    expect(s.round).toBe(0);
    for (const x of p) expect(s.hands[x.id]).toHaveLength(1);
    expect(['bid', 'trump', 'werwolf']).toContain(s.phase);
  });

  it('nimmt beim Austeilen nur Leute, die gerade da sind', () => {
    const p = spieler(4);
    const s = tun(createState(p), [...p.slice(0, 3), { ...p[3], online: false }], { type: 'deal' });
    expect(s.seats.map((x) => x.id)).toEqual(['p0', 'p1', 'p2']);
  });

  it('prüft beim Ansagen, wer dran ist – ein doppelter Tap landet nicht beim Nächsten', () => {
    const p = spieler(3);
    let s = fixed(p, [[num(0, 1)], [num(0, 2)], [num(0, 3)]]);
    const erster = s.turn;
    s = tun(s, p, { type: 'bid', who: erster, value: 1 });
    const doppelt = tun(s, p, { type: 'bid', who: erster, value: 0 });
    expect(doppelt).toBe(s);
    expect(s.bids[erster]).toBe(1);
  });

  it('verbietet der letzten Person die Ansage, die aufgeht, wenn die Regel an ist', () => {
    const p = spieler(3);
    let s = fixed(p, [[num(0, 1)], [num(0, 2)], [num(0, 3)]]);
    s = { ...s, options: { ...s.options, noEvenBids: true } };
    s = tun(s, p, { type: 'bid', who: s.turn, value: 0 });
    s = tun(s, p, { type: 'bid', who: s.turn, value: 0 });
    expect(s.turn).toBe(dealerId(s));
    expect(tun(s, p, { type: 'bid', who: s.turn, value: 1 })).toBe(s);
    s = tun(s, p, { type: 'bid', who: s.turn, value: 0 });
    expect(s.phase).toBe('play');
  });

  it('lässt nur legale Karten zu und wertet den Stich', () => {
    const p = spieler(3);
    // p0 gibt, p1 spielt aus.
    let s = fixed(p, [
      [num(1, 13), num(0, 2)],
      [num(0, 10), num(3, 3)],
      [num(0, 5), M1],
    ]);
    s = { ...s, dealer: 0, turn: 'p1' };
    s = tun(s, p, { type: 'bid', who: 'p1', value: 0 });
    s = tun(s, p, { type: 'bid', who: 'p2', value: 1 });
    s = tun(s, p, { type: 'bid', who: 'p0', value: 1 });
    expect(s.phase).toBe('play');
    expect(s.turn).toBe('p1');
    s = tun(s, p, { type: 'play', card: num(0, 10) });
    // p2 muss Rot bedienen oder den Magier spielen – beides geht.
    s = tun(s, p, { type: 'play', card: M1 });
    // p0 hat Rot 2 und muss bedienen: Blau 13 ist verboten.
    expect(tun(s, p, { type: 'play', card: num(1, 13) })).toBe(s);
    s = tun(s, p, { type: 'play', card: num(0, 2) });
    expect(s.phase).toBe('trick');
    expect(s.result?.winner).toBe('p2');
    expect(s.won.p2).toBe(1);
    s = tun(s, p, { type: 'collect' });
    expect(s.phase).toBe('play');
    expect(s.turn).toBe('p2');
  });

  it('wertet am Rundenende und geht nach der letzten Runde ins Ende', () => {
    const p = spieler(3);
    let s = fixed(p, [[num(1, 13)], [num(0, 10)], [num(0, 5)]]);
    s = { ...s, dealer: 0, turn: 'p1' };
    s = tun(s, p, { type: 'bid', who: 'p1', value: 1 });
    s = tun(s, p, { type: 'bid', who: 'p2', value: 0 });
    s = tun(s, p, { type: 'bid', who: 'p0', value: 1 });
    s = tun(s, p, { type: 'play', card: num(0, 10) });
    s = tun(s, p, { type: 'play', card: num(0, 5) });
    s = tun(s, p, { type: 'play', card: num(1, 13) });
    s = tun(s, p, { type: 'collect' });
    expect(s.phase).toBe('score');
    expect(s.scores).toEqual({ p0: -10, p1: 30, p2: 20 });
    s = tun(s, p, { type: 'next' });
    expect(s.phase).toBe('over');
    // Zweites „Weiter" von einem anderen Gerät ändert nichts.
    expect(tun(s, p, { type: 'next' }, 'p1')).toBe(s);
  });
});

describe('Sonderkarten im Ablauf', () => {
  it('Werwolf: tauscht mit der Trumpfkarte und bestimmt den Trumpf', () => {
    const p = spieler(3);
    let s = fixed(p, [
      [werwolf, num(0, 2)],
      [num(1, 3), num(1, 4)],
      [num(2, 5), num(2, 6)],
    ]);
    s = { ...s, phase: 'werwolf', turn: 'p0', indicator: M1 };
    expect(tun(s, p, { type: 'chooseTrump', suit: 7 })).toBe(s);
    s = tun(s, p, { type: 'chooseTrump', suit: -1 });
    expect(s.trump).toBeNull();
    expect(s.indicator).toBe(werwolf);
    expect(s.hands.p0.sort()).toEqual([num(0, 2), M1].sort());
    expect(s.werwolfBy).toBe('p0');
    expect(s.phase).toBe('bid');
  });

  it('Magier als Trumpfkarte: der Geber wählt eine Farbe', () => {
    const p = spieler(3);
    let s = fixed(p, [[num(0, 1)], [num(0, 2)], [num(0, 3)]]);
    s = { ...s, phase: 'trump', turn: dealerId(s), indicator: M1 };
    expect(tun(s, p, { type: 'chooseTrump', suit: -1 })).toBe(s);
    s = tun(s, p, { type: 'chooseTrump', suit: 3 });
    expect(s.trump).toBe(3);
    expect(s.phase).toBe('bid');
  });

  function spiele(s0: State, p: GamePlayer[], karten: [number, Record<string, unknown>?][]): State {
    let s = s0;
    for (const [card, extra] of karten) {
      const vorher = s;
      s = tun(s, p, { type: 'play', card, ...(extra ?? {}) });
      expect(s, `Karte ${card} wurde abgelehnt`).not.toBe(vorher);
    }
    return s;
  }

  function ansagen(s0: State, p: GamePlayer[], werte: number[]): State {
    let s = s0;
    for (const value of werte) s = tun(s, p, { type: 'bid', who: s.turn, value });
    expect(s.phase).toBe('play');
    return s;
  }

  it('Wolke: der Gewinner ändert die Ansage um eins', () => {
    const p = spieler(3);
    let s = fixed(p, [
      [num(0, 2), num(0, 3), num(0, 4)],
      [wolke, num(1, 1), num(1, 2)],
      [num(0, 5), num(2, 1), num(2, 2)],
    ]);
    s = { ...s, dealer: 2, turn: 'p0' };
    s = ansagen(s, p, [1, 1, 1]);
    s = spiele(s, p, [[num(0, 2)], [wolke, { suit: 0 }], [num(0, 5)]]);
    expect(s.result?.winner).toBe('p1');
    s = tun(s, p, { type: 'collect' });
    expect(s.phase).toBe('wolke');
    expect(s.turn).toBe('p1');
    expect(tun(s, p, { type: 'cloud', who: 'p0', value: 1 })).toBe(s);
    s = tun(s, p, { type: 'cloud', who: 'p1', value: 1 });
    expect(s.bids.p1).toBe(2);
    expect(s.shifts.p1).toBe(1);
    expect(s.phase).toBe('play');
  });

  it('Wolke: ist nur eine Richtung möglich, entscheidet die App', () => {
    const p = spieler(3);
    let s = fixed(p, [
      [num(0, 2), num(0, 3)],
      [wolke, num(1, 1)],
      [num(0, 5), num(2, 1)],
    ]);
    s = { ...s, dealer: 2, turn: 'p0' };
    s = ansagen(s, p, [0, 0, 1]);
    s = spiele(s, p, [[num(0, 2)], [wolke, { suit: 0 }], [num(0, 5)]]);
    s = tun(s, p, { type: 'collect' });
    expect(s.bids.p1).toBe(1);
    expect(s.phase).toBe('play');
  });

  it('Jongleur: nach dem Stich gibt jede Person eine Karte nach links', () => {
    const p = spieler(3);
    let s = fixed(p, [
      [num(0, 2), num(0, 3)],
      [jongleur, num(1, 1)],
      [num(0, 5), num(2, 1)],
    ]);
    s = { ...s, dealer: 2, turn: 'p0' };
    s = ansagen(s, p, [0, 0, 0]);
    s = spiele(s, p, [[num(0, 2)], [jongleur, { suit: 0 }], [num(0, 5)]]);
    s = tun(s, p, { type: 'collect' });
    expect(s.phase).toBe('pass');
    expect(actorsOf(s).sort()).toEqual(['p0', 'p1', 'p2']);
    s = tun(s, p, { type: 'pass', card: num(0, 3) });
    // Zweimal abgeben geht nicht.
    expect(tun(s, p, { type: 'pass', card: num(0, 3) })).toBe(s);
    s = tun(s, p, { type: 'pass', card: num(1, 1) });
    s = tun(s, p, { type: 'pass', card: num(2, 1) });
    expect(s.hands).toEqual({ p0: [num(2, 1)], p1: [num(0, 3)], p2: [num(1, 1)] });
    expect(s.phase).toBe('play');
    expect(s.lastPass).toEqual({ p0: num(0, 3), p1: num(1, 1), p2: num(2, 1) });
  });

  it('Hexe: tauscht eine Handkarte gegen eine Karte aus dem Stich', () => {
    const p = spieler(3);
    let s = fixed(p, [
      [num(0, 2), num(0, 3)],
      [hexe, num(1, 1)],
      [M1, num(2, 1)],
    ]);
    s = { ...s, dealer: 2, turn: 'p0' };
    s = ansagen(s, p, [0, 0, 1]);
    s = spiele(s, p, [[num(0, 2)], [hexe], [M1]]);
    expect(s.result?.winner).toBe('p2');
    s = tun(s, p, { type: 'collect' });
    expect(s.phase).toBe('hexe');
    expect(s.turn).toBe('p1');
    expect(hexeTakeable(s).sort()).toEqual([num(0, 2), M1].sort());
    // Die Hexe selbst darf sie nicht nehmen.
    expect(tun(s, p, { type: 'hexe', card: num(1, 1), take: hexe })).toBe(s);
    s = tun(s, p, { type: 'hexe', card: num(1, 1), take: M1 });
    expect(s.hands.p1).toEqual([M1]);
    expect(s.won.p2).toBe(1);
    expect(s.swap).toEqual({ by: 'p1', gave: num(1, 1), took: M1 });
    expect(s.phase).toBe('play');
  });

  it('Bombe: niemand bekommt den Stich, die höchste Karte spielt aus', () => {
    const p = spieler(3);
    let s = fixed(p, [
      [num(0, 2), num(0, 3)],
      [bombe, num(1, 1)],
      [num(0, 12), num(2, 1)],
    ]);
    s = { ...s, dealer: 2, turn: 'p0' };
    s = ansagen(s, p, [0, 0, 0]);
    s = spiele(s, p, [[num(0, 2)], [bombe], [num(0, 12)]]);
    expect(s.result?.winner).toBeNull();
    expect(Object.values(s.won).reduce((a, b) => a + b, 0)).toBe(0);
    s = tun(s, p, { type: 'collect' });
    expect(s.turn).toBe('p2');
  });

  it('Gestaltwandler: ohne Angabe wird er zum Narren', () => {
    const p = spieler(3);
    let s = fixed(p, [[num(0, 2)], [wandler], [num(0, 5)]]);
    s = { ...s, dealer: 2, turn: 'p0' };
    s = ansagen(s, p, [0, 0, 0]);
    s = spiele(s, p, [[num(0, 2)], [wandler], [num(0, 5)]]);
    expect(s.trick[1].shape).toBe('narr');
    expect(s.result?.winner).toBe('p2');
  });
});

describe('Autopilot', () => {
  it('übernimmt nur für Leute, die weg sind', () => {
    const p = spieler(3);
    let s = tun(createState(p), p, { type: 'deal' });
    // Trumpfwahl oder Werwolf zuerst erledigen, falls nötig.
    while (s.phase === 'trump' || s.phase === 'werwolf') {
      s = reduce(s, { type: 'chooseTrump', suit: 0, by: 'p0' } as GameAction, p);
    }
    const dran = s.turn;
    expect(tun(s, p, { type: 'autopilot', who: dran })).toBe(s);
    const weg = p.map((x) => (x.id === dran ? { ...x, online: false } : x));
    const next = tun(s, weg, { type: 'autopilot', who: dran });
    expect(next).not.toBe(s);
    expect(next.bids[dran]).toBeGreaterThanOrEqual(0);
    expect(next.auto[dran]).toBe(true);
  });

  it('gibt die Kontrolle zurück, wenn die Person wieder da ist', () => {
    const p = spieler(3);
    let s = createState(p);
    s = { ...s, auto: { p1: true } };
    s = tun(s, p, { type: 'manual' }, 'p1');
    expect(s.auto.p1).toBe(false);
  });
});

/**
 * Ganze Partien mit Zufallszügen – jede Sonderkarte, jede Tischgröße.
 *
 * Nach jeder Aktion gelten die Invarianten des Kartenspiels: keine Karte
 * doppelt, gleich große Hände, Stiche zählen richtig, und es gibt immer
 * jemanden, der etwas tun kann (keine Sackgasse).
 */
function randomMove(
  s: State,
  rng: () => number,
): { action: Record<string, unknown>; by: string } | null {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  switch (s.phase) {
    case 'setup':
      return { action: { type: 'deal' }, by: 'p0' };
    case 'trump':
      return { action: { type: 'chooseTrump', suit: Math.floor(rng() * 4) }, by: s.turn };
    case 'werwolf':
      return { action: { type: 'chooseTrump', suit: Math.floor(rng() * 5) - 1 }, by: s.turn };
    case 'bid': {
      const cards = cardsThisRound(s);
      const options = Array.from({ length: cards + 1 }, (_, i) => i).filter(
        (v) =>
          reduce(s, { type: 'bid', who: s.turn, value: v, by: s.turn } as GameAction, []) !== s,
      );
      return { action: { type: 'bid', who: s.turn, value: pick(options) }, by: s.turn };
    }
    case 'play': {
      const legal = legalCards(s.hands[s.turn], s.trick, s.vampirAs);
      const card = pick(legal);
      return {
        action: {
          type: 'play',
          card,
          suit: Math.floor(rng() * 4),
          shape: rng() < 0.5 ? 'magier' : 'narr',
        },
        by: s.turn,
      };
    }
    case 'trick':
      return { action: { type: 'collect' }, by: 'p1' };
    case 'wolke':
      return { action: { type: 'cloud', who: s.turn, value: rng() < 0.5 ? 1 : -1 }, by: s.turn };
    case 'pass': {
      const who = pick(actorsOf(s));
      return { action: { type: 'pass', card: pick(s.hands[who]) }, by: who };
    }
    case 'hexe':
      return {
        action: { type: 'hexe', card: pick(s.hands[s.turn]), take: pick(hexeTakeable(s)) },
        by: s.turn,
      };
    case 'score':
      return { action: { type: 'next' }, by: 'p2' };
    default:
      return null;
  }
}

function checkInvariants(s: State, label: string) {
  if (s.phase === 'setup' || s.phase === 'over') return;
  const n = s.seats.length;
  const cards = cardsThisRound(s);
  const inHands = s.seats.flatMap((x) => s.hands[x.id] ?? []);
  const onTable = s.trick.map((t) => t.card);
  const all = [...inHands, ...onTable, ...(s.indicator != null ? [s.indicator] : [])];
  expect(new Set(all).size, `${label}: doppelte Karte`).toBe(all.length);
  // Gleich große Hände, bis auf die, die im laufenden Stich schon gelegt haben.
  const played = new Set(s.phase === 'play' ? s.trick.map((t) => t.by) : []);
  const sizes = s.seats.map((x) => (s.hands[x.id]?.length ?? 0) + (played.has(x.id) ? 1 : 0));
  expect(new Set(sizes).size, `${label}: ungleiche Hände ${sizes}`).toBe(1);
  const expected = ['bid', 'trump', 'werwolf'].includes(s.phase)
    ? cards
    : s.phase === 'play'
      ? cards - s.trickNo
      : s.phase === 'score'
        ? 0
        : cards - s.trickNo - 1;
  expect(sizes[0], `${label}: Handgröße`).toBe(expected);
  const won = Object.values(s.won).reduce((a, b) => a + b, 0);
  expect(won, `${label}: mehr Stiche als gespielt`).toBeLessThanOrEqual(cards);
  expect(n).toBeGreaterThanOrEqual(2);
  // Keine Sackgasse: jemand ist dran, oder der Stich/die Wertung wartet auf „weiter".
  if (!['trick', 'score'].includes(s.phase)) {
    expect(actorsOf(s).length, `${label}: niemand am Zug in ${s.phase}`).toBeGreaterThan(0);
  }
}

describe('Ganze Partien', () => {
  it('laufen mit allen Sonderkarten und jeder Tischgröße sauber durch', () => {
    const presets = ['klassisch', 'jubilaeum', 'alle'] as const;
    let partien = 0;
    // Sonst prüft der Lauf womöglich nur Farbkarten: jede Phase und jeder
    // Sonderfall muss mindestens einmal vorgekommen sein.
    const gesehen = new Set<string>();
    for (let n = 3; n <= 10; n++) {
      for (const preset of presets) {
        for (let seed = 1; seed <= 4; seed++) {
          const rng = seeded(n * 1000 + seed * 17 + preset.length);
          vi.spyOn(Math, 'random').mockImplementation(rng);
          const p = spieler(n);
          let s = createState(p);
          s = tun(s, p, { type: 'preset', preset });
          s = tun(s, p, { type: 'rule', rule: 'noEvenBids', on: seed % 2 === 0 });
          s = tun(s, p, { type: 'length', length: seed === 3 ? 'rauf-runter' : 'voll' });
          const label = `${n} Leute / ${preset} / Lauf ${seed}`;
          let steps = 0;
          while (s.phase !== 'over') {
            const move = randomMove(s, rng);
            expect(move, `${label}: kein Zug in ${s.phase}`).not.toBeNull();
            const next = reduce(s, { ...move!.action, by: move!.by, at: 0 } as GameAction, p);
            expect(next, `${label}: Zug abgelehnt in ${s.phase} ${JSON.stringify(move)}`).not.toBe(
              s,
            );
            s = next;
            gesehen.add(s.phase);
            if (s.result?.bomb) gesehen.add('bombe');
            if (s.result?.fairyBeatsDragon) gesehen.add('fee-schlaegt-drache');
            if (s.phase === 'trick' && s.trick.some((t) => t.card === SPECIAL_ID.vampir)) {
              gesehen.add('vampir');
            }
            checkInvariants(s, `${label} / Runde ${s.round + 1} / ${s.phase}`);
            if (s.phase === 'score') {
              const log = s.log[s.log.length - 1];
              const summe = Object.values(log.won).reduce((a, b) => a + b, 0);
              expect(summe, `${label}: Stiche`).toBeLessThanOrEqual(log.cards);
              for (const x of s.seats) {
                expect(log.delta[x.id]).toBe(roundScore(log.bids[x.id], log.won[x.id]));
              }
            }
            if (++steps > 20000) throw new Error(`${label}: endet nicht`);
          }
          // Punktestand = Summe der Rundenergebnisse.
          for (const x of s.seats) {
            const summe = s.log.reduce((a, r) => a + r.delta[x.id], 0);
            expect(s.scores[x.id]).toBe(summe);
          }
          expect(s.log).toHaveLength(s.plan.length);
          expect(decodeState(encodeState(s))).toEqual(s);
          vi.restoreAllMocks();
          partien++;
        }
      }
    }
    expect(partien).toBe(8 * 3 * 4);
    expect([...gesehen].sort()).toEqual(
      [
        'bid',
        'bombe',
        'fee-schlaegt-drache',
        'hexe',
        'over',
        'pass',
        'play',
        'score',
        'trick',
        'trump',
        'vampir',
        'werwolf',
        'wolke',
      ].sort(),
    );
  }, 60_000);

  it('hat mit Sonderkarten auch in der letzten Runde eine Trumpfkarte', () => {
    for (let n = 3; n <= 10; n++) {
      const p = spieler(n);
      let s = createState(p);
      s = tun(s, p, { type: 'preset', preset: 'alle' });
      s = tun(s, p, { type: 'deal' });
      const last = startRound(s, s.plan.length - 1, 0);
      expect(last.indicator, `${n} Leute`).not.toBeNull();
    }
  });

  it('spielt eine ganze Partie nur mit dem Autopilot zu Ende', () => {
    for (let n = 3; n <= 7; n++) {
      vi.spyOn(Math, 'random').mockImplementation(seeded(n * 7));
      const p = spieler(n);
      const weg = p.map((x) => ({ ...x, online: false }));
      let s = createState(p);
      s = tun(s, p, { type: 'preset', preset: 'alle' });
      s = tun(s, p, { type: 'deal' });
      let steps = 0;
      while (s.phase !== 'over') {
        if (s.phase === 'trick') s = tun(s, p, { type: 'collect' });
        else if (s.phase === 'score') s = tun(s, p, { type: 'next' });
        else {
          const who = actorsOf(s)[0];
          expect(botMove(s, who), `${n}: Bot weiß nichts in ${s.phase}`).not.toBeNull();
          const next = tun(s, weg, { type: 'autopilot', who });
          expect(next, `${n}: Autopilot hängt in ${s.phase}`).not.toBe(s);
          s = next;
        }
        checkInvariants(s, `Autopilot ${n}`);
        if (++steps > 20000) throw new Error('endet nicht');
      }
      vi.restoreAllMocks();
    }
  }, 30_000);
});

describe('Einrichten', () => {
  it('schaltet Sonderkarten einzeln und per Voreinstellung', () => {
    const p = spieler(4);
    let s = createState(p);
    expect(s.options.specials).toHaveLength(7);
    s = tun(s, p, { type: 'preset', preset: 'alle' });
    expect(s.options.specials).toEqual([...SPECIALS]);
    s = tun(s, p, { type: 'toggleSpecial', special: 'bombe' });
    expect(s.options.specials).not.toContain('bombe');
    s = tun(s, p, { type: 'toggleSpecial', special: 'bombe' });
    expect(s.options.specials).toContain('bombe');
    expect(tun(s, p, { type: 'toggleSpecial', special: 'quatsch' })).toBe(s);
    s = tun(s, p, { type: 'preset', preset: 'klassisch' });
    expect(s.options.specials).toEqual([]);
  });

  it('nimmt „kurz" aus der App-Einstellung als Vorgabe', () => {
    useApp.setState({ gameLength: 'kurz' });
    expect(createState(spieler(6)).options.length).toBe('kurz');
    useApp.setState({ gameLength: 'lang' });
    expect(createState(spieler(6)).options.length).toBe('voll');
  });

  it('behält bei „Noch eine Runde" die Einstellungen', () => {
    const p = spieler(4);
    let s = createState(p);
    s = tun(s, p, { type: 'preset', preset: 'alle' });
    s = tun(s, p, { type: 'length', length: 'kurz' });
    s = tun(s, p, { type: 'deal' });
    s = tun(s, p, { type: 'restart' });
    expect(s.phase).toBe('setup');
    expect(s.options.specials).toHaveLength(9);
    expect(s.plan).toEqual(planFor(4, 'kurz'));
  });
});
