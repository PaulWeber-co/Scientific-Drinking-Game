import { beforeEach, describe, expect, it } from 'vitest';
import { lueckenfueller, fill, type State } from './index';
import { BLACK } from './cards';
import { useApp } from '../../store/app';
import { useSeen } from '../../store/seen';
import { useCustomCards } from '../../store/cards';
import type { GameAction, GamePlayer } from '../types';

/**
 * Lückenfüller ist das erste Spiel mit einem RICHTER. Damit gibt es drei neue
 * Wege, auf denen eine Runde hängen bleiben kann: der Richter geht, ein
 * Mitspieler geht, jemand kommt mitten in der Runde dazu. Genau das ist laut
 * Recherche die häufigste Beschwerde über solche Apps.
 */

const spieler = (n: number): GamePlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Spieler ${i}`,
    color: 'blue' as const,
    online: true,
  }));

const tun = (state: State, players: GamePlayer[], action: Partial<GameAction> & { by: string }) =>
  lueckenfueller.reduce(state, { type: 'noop', ...action } as GameAction, players);

/**
 * Startzustand mit einer Lückenkarte, die genau EINE Karte verlangt.
 *
 * Ohne das hängt fast jeder Test am Zufall: 11 von 135 Lückenkarten verlangen
 * zwei Karten. Zieht der Test eine davon, wird eine Abgabe mit einer Karte
 * abgewiesen – und Zusicherungen wie „nichts gelegt" werden dann still trivial
 * wahr, statt rot zu werden. Für `pick: 2` gibt es eigene Tests, die es
 * ausdrücklich setzen.
 */
function starte(n: number): { p: GamePlayer[]; s: State } {
  const p = spieler(n);
  const roh = lueckenfueller.createState(p);
  const einfach = BLACK.findIndex((c) => c.pick !== 2);
  return { p, s: { ...roh, black: einfach, pick: 1 } };
}

/** Alle bis auf `aus` legen ihre erste Handkarte. */
function alleLegen(state: State, players: GamePlayer[], aus: string[] = []): State {
  let s = state;
  for (const p of players) {
    if (p.id === s.judgeId || aus.includes(p.id)) continue;
    s = tun(s, players, { type: 'submit', by: p.id, cards: (s.hands[p.id] ?? []).slice(0, s.pick) });
  }
  return s;
}

beforeEach(() => {
  useApp.setState({ gameLength: 'mittel', spicy: {} });
  useSeen.setState({ seen: {}, cursor: 0 });
  useCustomCards.setState({ byGame: {} });
});

describe('Spielaufbau', () => {
  it('gibt jedem zehn Karten, auch dem Richter', () => {
    // Der Richter spielt diese Runde nicht, ist aber in der nächsten dran.
    // Ohne Hand stünde er dann ohne Karten da.
    const p = spieler(5);
    const s = lueckenfueller.createState(p);
    for (const x of p) expect(s.hands[x.id]).toHaveLength(10);
  });

  it('macht den ersten Spieler zum ersten Richter', () => {
    const p = spieler(4);
    expect(lueckenfueller.createState(p).judgeId).toBe('p0');
  });

  it('teilt keine Karte zweimal aus', () => {
    const p = spieler(6);
    const s = lueckenfueller.createState(p);
    const alle = p.flatMap((x) => s.hands[x.id]);
    expect(new Set(alle).size).toBe(alle.length);
  });

  it('merkt sich, wie viele Karten die Lücke braucht', () => {
    const p = spieler(4);
    const s = lueckenfueller.createState(p);
    expect(s.pick).toBe(BLACK[s.black].pick ?? 1);
  });
});

describe('Legen', () => {
  it('nimmt die Karte von der Hand', () => {
    const { p, s: s0 } = starte(4);
    const karte = s0.hands.p1[0];
    const s1 = tun(s0, p, { type: 'submit', by: 'p1', cards: [karte] });

    expect(s1.played.p1).toEqual([karte]);
    expect(s1.hands.p1).toHaveLength(10 - s0.pick);
    expect(s1.hands.p1).not.toContain(karte);
  });

  it('lässt den Richter nicht mitspielen', () => {
    const { p, s: s0 } = starte(4);
    const s1 = tun(s0, p, { type: 'submit', by: s0.judgeId, cards: [s0.hands[s0.judgeId][0]] });
    expect(s1.played[s0.judgeId]).toBeUndefined();
  });

  it('zählt zwei fast gleichzeitige Taps als eine Abgabe', () => {
    // Online wendet die Inbox nacheinander an. Ohne die Prüfung im Reducer
    // legt der zweite Tap eine zweite Karte nach.
    const { p, s: s0 } = starte(4);
    const s1 = tun(s0, p, { type: 'submit', by: 'p1', cards: [s0.hands.p1[0]] });
    expect(s1.played.p1).toBeDefined();
    const s2 = tun(s1, p, { type: 'submit', by: 'p1', cards: [s1.hands.p1[0]] });

    expect(s2.played.p1).toEqual(s1.played.p1);
    expect(s2.hands.p1).toEqual(s1.hands.p1);
  });

  it('weist eine Karte ab, die nicht auf der Hand liegt', () => {
    const { p, s: s0 } = starte(4);
    const fremd = s0.hands.p2[0];
    expect(tun(s0, p, { type: 'submit', by: 'p1', cards: [fremd] }).played.p1).toBeUndefined();
  });

  it('weist die falsche Kartenzahl ab', () => {
    const p = spieler(4);
    const s0 = { ...lueckenfueller.createState(p), pick: 2 as const };
    const eine = tun(s0, p, { type: 'submit', by: 'p1', cards: [s0.hands.p1[0]] });
    const drei = tun(s0, p, { type: 'submit', by: 'p1', cards: s0.hands.p1.slice(0, 3) });
    expect(eine.played.p1).toBeUndefined();
    expect(drei.played.p1).toBeUndefined();
  });

  it('weist dieselbe Karte zweimal ab', () => {
    const p = spieler(4);
    const s0 = { ...lueckenfueller.createState(p), pick: 2 as const };
    const k = s0.hands.p1[0];
    expect(tun(s0, p, { type: 'submit', by: 'p1', cards: [k, k] }).played.p1).toBeUndefined();
  });
});

describe('Countdown', () => {
  it('läuft nicht, solange die Mehrheit noch überlegt', () => {
    // Vier Mitspieler: nach einer Abgabe ist die Mehrheit nicht erreicht.
    const { p, s: s0 } = starte(5);
    const s1 = tun(s0, p, { type: 'submit', by: 'p1', cards: [s0.hands.p1[0]] });
    expect(s1.played.p1).toBeDefined();
    expect(s1.deadline).toBeNull();
  });

  it('startet, sobald die Hälfte gelegt hat', () => {
    const { p, s: s0 } = starte(5);
    let s = s0;
    for (const id of ['p1', 'p2', 'p3']) {
      s = tun(s, p, { type: 'submit', by: id, cards: [s.hands[id][0]], at: 1_000 });
    }
    expect(s.deadline).toBe(1_000 + 20_000);
  });

  it('läuft auch in der kleinsten erlaubten Runde', () => {
    // Drei Spieler heißt ein Richter und ZWEI Mitspieler. Mit der Regel
    // „mehr als die Hälfte" wäre der Countdown hier nie gelaufen, und wer sein
    // Handy weglegt, hätte die Runde für die anderen beiden eingefroren.
    const { p, s: s0 } = starte(3);
    const dabei = p.filter((x) => x.id !== s0.judgeId);
    expect(dabei).toHaveLength(2);

    const s1 = tun(s0, p, {
      type: 'submit',
      by: dabei[0].id,
      cards: s0.hands[dabei[0].id].slice(0, s0.pick),
      at: 1_000,
    });
    expect(s1.phase).toBe('submit');
    expect(s1.deadline).toBe(1_000 + 20_000);
  });

  it('rettet die kleinste Runde, wenn der zweite nie legt', () => {
    const { p, s: s0 } = starte(3);
    const dabei = p.filter((x) => x.id !== s0.judgeId);
    let s = tun(s0, p, {
      type: 'submit',
      by: dabei[0].id,
      cards: s0.hands[dabei[0].id].slice(0, s0.pick),
      at: 1_000,
    });
    s = tun(s, p, { type: 'timeout', by: s0.judgeId, at: 99_000 });

    expect(s.phase).toBe('reveal');
    expect(s.order).toEqual([dabei[0].id]);
  });

  it('deckt sofort auf, wenn alle gelegt haben', () => {
    const p = spieler(4);
    const s = alleLegen(lueckenfueller.createState(p), p);
    expect(s.phase).toBe('reveal');
    expect(s.order).toHaveLength(3);
    expect(s.deadline).toBeNull();
  });

  it('läuft nicht ab, bevor die Frist um ist', () => {
    const { p, s: s0 } = starte(5);
    let s = s0;
    for (const id of ['p1', 'p2', 'p3']) {
      s = tun(s, p, { type: 'submit', by: id, cards: [s.hands[id][0]], at: 1_000 });
    }
    expect(s.deadline).not.toBeNull();
    expect(tun(s, p, { type: 'timeout', by: 'p0', at: 5_000 }).phase).toBe('submit');
  });

  it('deckt nach der Frist ohne die Fehlenden auf', () => {
    const { p, s: s0 } = starte(5);
    let s = s0;
    for (const id of ['p1', 'p2', 'p3']) {
      s = tun(s, p, { type: 'submit', by: id, cards: [s.hands[id][0]], at: 1_000 });
    }
    const nach = tun(s, p, { type: 'timeout', by: 'p0', at: 99_000 });
    expect(nach.phase).toBe('reveal');
    expect(nach.order).toHaveLength(3);
    expect(nach.order).not.toContain('p4');
  });

  it('deckt nichts auf, wenn niemand gelegt hat', () => {
    // Sonst stünde der Richter vor null Karten und könnte nichts küren.
    const p = spieler(4);
    const s = { ...lueckenfueller.createState(p), deadline: 1_000 };
    const nach = tun(s, p, { type: 'timeout', by: 'p0', at: 99_000 });
    expect(nach.phase).toBe('submit');
    expect(nach.deadline).toBeNull();
  });
});

describe('Aufdecken und Küren', () => {
  it('lässt nur den Richter aufdecken', () => {
    const p = spieler(4);
    const s = alleLegen(lueckenfueller.createState(p), p);
    expect(tun(s, p, { type: 'flip', by: 'p1' }).revealed).toBe(0);
    expect(tun(s, p, { type: 'flip', by: s.judgeId }).revealed).toBe(1);
  });

  it('lässt erst küren, wenn alles offen liegt', () => {
    const p = spieler(4);
    let s = alleLegen(lueckenfueller.createState(p), p);
    expect(tun(s, p, { type: 'pick-winner', by: s.judgeId, target: 'p1' }).phase).toBe('reveal');
    for (let i = 0; i < s.order.length; i++) s = tun(s, p, { type: 'flip', by: s.judgeId });
    expect(tun(s, p, { type: 'pick-winner', by: s.judgeId, target: 'p1' }).phase).toBe('score');
  });

  it('zählt dem Gewinner genau einen Punkt zu', () => {
    const p = spieler(4);
    let s = alleLegen(lueckenfueller.createState(p), p);
    for (let i = 0; i < s.order.length; i++) s = tun(s, p, { type: 'flip', by: s.judgeId });
    const nach = tun(s, p, { type: 'pick-winner', by: s.judgeId, target: 'p2' });
    expect(nach.scores.p2).toBe(1);
    expect(nach.winnerId).toBe('p2');
    expect(nach.scores.p1).toBe(0);
  });

  it('kürt niemanden, der nichts gelegt hat', () => {
    const p = spieler(5);
    let s = alleLegen(lueckenfueller.createState(p), p, ['p4']);
    s = { ...s, phase: 'reveal', order: Object.keys(s.played), revealed: 3 };
    expect(tun(s, p, { type: 'pick-winner', by: s.judgeId, target: 'p4' }).phase).toBe('reveal');
  });
});

describe('Nächste Runde', () => {
  it('rotiert den Richter und füllt die Hände wieder auf', () => {
    const p = spieler(4);
    let s = alleLegen(lueckenfueller.createState(p), p);
    for (let i = 0; i < s.order.length; i++) s = tun(s, p, { type: 'flip', by: s.judgeId });
    s = tun(s, p, { type: 'pick-winner', by: s.judgeId, target: 'p1' });
    const alterRichter = s.judgeId;
    const nach = tun(s, p, { type: 'next', by: 'p1' });

    expect(nach.judgeId).not.toBe(alterRichter);
    expect(nach.round).toBe(2);
    expect(nach.phase).toBe('submit');
    for (const x of p) expect(nach.hands[x.id]).toHaveLength(10);
    expect(nach.played).toEqual({});
  });

  it('darf von jedem gestartet werden, nicht nur vom Richter', () => {
    // Sonst hängt die Runde an einer Person, die vielleicht nicht hinschaut.
    const p = spieler(4);
    let s = alleLegen(lueckenfueller.createState(p), p);
    for (let i = 0; i < s.order.length; i++) s = tun(s, p, { type: 'flip', by: s.judgeId });
    s = tun(s, p, { type: 'pick-winner', by: s.judgeId, target: 'p1' });
    expect(tun(s, p, { type: 'next', by: 'p3' }).round).toBe(2);
  });

  it('zählt eine beendete Partie nicht weiter', () => {
    const p = spieler(4);
    const s = { ...lueckenfueller.createState(p), phase: 'over' as const, round: 9 };
    expect(tun(s, p, { type: 'next', by: 'p1' }).round).toBe(9);
  });
});

describe('Ausfall und Nachzügler', () => {
  it('wartet nicht auf jemanden, der offline ist', () => {
    const { p, s: s0 } = starte(4);
    const weg = p.map((x) => (x.id === 'p3' ? { ...x, online: false } : x));
    let s = s0;
    for (const id of ['p1', 'p2']) {
      s = tun(s, weg, { type: 'submit', by: id, cards: [s.hands[id][0]] });
    }
    expect(s.phase).toBe('reveal');
  });

  it('lässt einen Nachzügler die Runde nicht einfrieren', () => {
    // Der Fehler steckt heute in `meme-battle`: dort wird `active` aus
    // `players` gerechnet, und wer keine Hand hat, blockiert trotzdem.
    const p = spieler(4);
    const s0 = lueckenfueller.createState(p);
    const spaeter = [...p, { id: 'p9', name: 'Neu', color: 'pink' as const, online: true }];
    const s = alleLegen(s0, spaeter);
    expect(s.phase).toBe('reveal');
    expect(s.order).not.toContain('p9');
  });

  it('gibt dem Nachzügler in der nächsten Runde eine Hand', () => {
    const p = spieler(4);
    const spaeter = [...p, { id: 'p9', name: 'Neu', color: 'pink' as const, online: true }];
    let s = alleLegen(lueckenfueller.createState(p), spaeter);
    for (let i = 0; i < s.order.length; i++) s = tun(s, spaeter, { type: 'flip', by: s.judgeId });
    s = tun(s, spaeter, { type: 'pick-winner', by: s.judgeId, target: 'p1' });
    expect(tun(s, spaeter, { type: 'next', by: 'p1' }).hands.p9).toHaveLength(10);
  });

  it('verwirft die Runde, wenn der Richter verschwindet', () => {
    const { p, s: s0 } = starte(4);
    const weg = p.map((x) => (x.id === s0.judgeId ? { ...x, online: false } : x));
    const s1 = tun(s0, weg, { type: 'submit', by: 'p1', cards: [s0.hands.p1[0]] });
    // Ohne das ist der Rest trivial wahr: eine abgewiesene Abgabe laesst die
    // Hand ohnehin unveraendert.
    expect(s1.played.p1).toBeDefined();
    const nach = tun(s1, weg, { type: 'judge-left', by: 'p1' });

    expect(nach.round).toBe(1);
    expect(nach.judgeId).not.toBe(s0.judgeId);
    expect(nach.played).toEqual({});
    // Die gelegte Karte darf nicht verloren gehen.
    expect(nach.hands.p1).toHaveLength(10);
    expect(nach.hands.p1).toContain(s0.hands.p1[0]);
  });

  it('verwirft nichts, wenn der Richter noch da ist', () => {
    // Gegenprobe: ohne diese Prüfung könnte ein verspäteter Wecker eine
    // laufende Runde grundlos wegwerfen.
    const { p, s: s0 } = starte(4);
    const s1 = tun(s0, p, { type: 'submit', by: 'p1', cards: [s0.hands.p1[0]] });
    expect(s1.played.p1).toBeDefined();
    expect(tun(s1, p, { type: 'judge-left', by: 'p1' })).toBe(s1);
  });
});

describe('Einsetzen in den Lückentext', () => {
  it('ersetzt eine Lücke', () => {
    expect(fill('Mein Tiefpunkt war ____.', ['zwei Promille'])).toBe(
      'Mein Tiefpunkt war zwei Promille.',
    );
  });

  it('ersetzt zwei Lücken in der gelegten Reihenfolge', () => {
    // Die Reihenfolge ist die Pointe: vertauscht ergibt sie etwas anderes.
    expect(fill('Erst kam ____, dann kam ____.', ['der Kater', 'die Reue'])).toBe(
      'Erst kam der Kater, dann kam die Reue.',
    );
  });

  it('lässt die Marke stehen, wenn eine Karte fehlt', () => {
    expect(fill('____ und ____', ['nur eine'])).toBe('nur eine und ____');
  });
});
