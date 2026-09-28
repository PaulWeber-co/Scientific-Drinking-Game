import { describe, expect, it } from 'vitest';
import { decodeState, encodeState } from '../../features/party/PartyContext';
import { useApp } from '../../store/app';
import { useCustomCards } from '../../store/cards';
import type { GameAction, GamePlayer } from '../types';
import {
  bestPerRound,
  createState,
  MIN_SHOW_MS,
  pointsFor,
  reduce,
  REROLLS,
  RIDER_BONUS,
  SUBMIT_GRACE_MS,
  topicText,
  VOTE_MS,
  type State,
} from './game';
import { fitText, wrapLines } from './render';
import { MAX_CHARS, maxCharsFor, TEMPLATES, templateOf } from './templates';
import { TOPICS } from './topics';

const players = (n: number): GamePlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Spieler ${i}`,
    color: 'indigo',
    online: true,
  }));

const act = (type: string, by = 'p0', extra: Record<string, unknown> = {}): GameAction => ({
  type,
  by,
  at: Date.now(),
  ...extra,
});

/** Viel später – für alles, was an einer Frist hängt. */
const later = () => Date.now() + 60 * 60_000;

function started(n = 3, mode?: State['options']['mode']) {
  const roster = players(n);
  let s = createState(roster);
  if (mode) s = reduce(s, act('mode', 'p0', { mode }), roster);
  s = reduce(s, act('start'), roster);
  return { roster, s };
}

/** Alle geben ab; der Text sagt, von wem das Meme ist. */
function allSubmit(s: State, roster: GamePlayer[]): State {
  for (const p of roster) s = reduce(s, act('submit', p.id, { texts: [p.id, 'unten'] }), roster);
  return s;
}

/** Stimmt über das laufende Meme ab: `plan[wähler] = Wert`, dann weiter. */
function voteAndAdvance(
  s: State,
  roster: GamePlayer[],
  plan: (voter: string, author: string) => number,
) {
  const author = s.order[s.showing];
  for (const p of roster) {
    if (p.id === author) continue;
    s = reduce(s, act('vote', p.id, { target: author, value: plan(p.id, author) }), roster);
  }
  return reduce(s, act('advance', 'p0', { target: author, at: s.shownAt + MIN_SHOW_MS }), roster);
}

describe('Meme-Duell: Katalog', () => {
  it('hat genug Vorlagen und jede mit gültigen Textfeldern', () => {
    expect(TEMPLATES.length).toBeGreaterThan(300);
    const ids = new Set<string>();
    for (const t of TEMPLATES) {
      expect(ids.has(t.id), t.id).toBe(false);
      ids.add(t.id);
      expect(t.w, t.id).toBeGreaterThan(0);
      expect(t.boxes.length, t.id).toBeGreaterThanOrEqual(1);
      expect(t.boxes.length, t.id).toBeLessThanOrEqual(8);
      expect(t.id, 'nur, was der Service-Worker-Cache erkennt').toMatch(/^[a-z0-9-]+$/);
      for (const b of t.boxes) {
        expect(b.w, t.id).toBeGreaterThan(0);
        expect(b.h, t.id).toBeGreaterThan(0);
        expect(b.x + b.w, t.id).toBeLessThanOrEqual(1.01);
        expect(b.y + b.h, t.id).toBeLessThanOrEqual(1.01);
      }
    }
  });

  it('filtert nichts aus – Drogen-Memes gibt es aber nur mit Spicy', () => {
    for (const id of ['trump', 'sad-obama', 'ugandanknuck', 'surprised-pikachu', 'me-gusta']) {
      expect(templateOf(id), id).not.toBeNull();
    }
    const roster = players(3);
    const ohne = new Set<string>();
    for (let i = 0; i < 30; i++) createState(roster).deck.forEach((id) => ohne.add(id));
    expect(ohne.has('elmo')).toBe(false);
    useApp.setState({ spicy: { 'meme-battle': true } });
    const mit = new Set<string>();
    for (let i = 0; i < 60; i++) createState(roster).deck.forEach((id) => mit.add(id));
    useApp.setState({ spicy: {} });
    expect(templateOf('elmo')?.sp).toBe(1);
    expect([...mit].some((id) => templateOf(id)?.sp)).toBe(true);
  });

  it('begrenzt winzige Felder, damit kein Text herausquillt', () => {
    for (const t of TEMPLATES) {
      t.boxes.forEach((_, i) => {
        const n = maxCharsFor(t, i);
        expect(n, `${t.id}[${i}]`).toBeGreaterThanOrEqual(14);
        expect(n, `${t.id}[${i}]`).toBeLessThanOrEqual(MAX_CHARS);
      });
    }
    // Die kleinen Schilder im Boardroom tragen keinen ganzen Absatz …
    expect(maxCharsFor(templateOf('boardroom')!, 1)).toBeLessThan(40);
    // … die allermeisten Felder dagegen die vollen 90 Zeichen.
    const big = TEMPLATES.flatMap((t) => t.boxes.map((_, i) => maxCharsFor(t, i)));
    expect(big.filter((n) => n === MAX_CHARS).length / big.length).toBeGreaterThan(0.7);
  });
});

describe('Meme-Duell: Einrichten', () => {
  it('startet am Tisch mit Standardwerten und überlebt die Datenbank', () => {
    const s = createState(players(4));
    expect(s.phase).toBe('setup');
    expect(s.options).toEqual({ mode: 'klassisch', seconds: 90, trittbrett: true, rerolls: 5 });
    expect(decodeState(encodeState(s))).toEqual(s);
  });

  it('nimmt nur gültige Einstellungen an', () => {
    const roster = players(3);
    let s = createState(roster);
    s = reduce(s, act('mode', 'p0', { mode: 'gleich' }), roster);
    s = reduce(s, act('timer', 'p0', { seconds: 60 }), roster);
    s = reduce(s, act('trittbrett', 'p0', { on: false }), roster);
    expect(s.options).toEqual({ mode: 'gleich', seconds: 60, trittbrett: false, rerolls: 5 });
    const vorher = s;
    expect(reduce(s, act('mode', 'p0', { mode: 'wahrheit' }), roster)).toBe(vorher);
    expect(reduce(s, act('timer', 'p0', { seconds: 7 }), roster)).toBe(vorher);
  });

  it('teilt jeder Person eine eigene Vorlage aus', () => {
    const { s } = started(6);
    expect(s.phase).toBe('create');
    const vorlagen = Object.values(s.drawn);
    expect(vorlagen).toHaveLength(6);
    expect(new Set(vorlagen).size).toBe(6);
    expect(s.deadline).toBeGreaterThan(Date.now());
  });

  it('gibt bei „Gleiches Meme" allen dieselbe Vorlage', () => {
    const { s } = started(5, 'gleich');
    expect(new Set(Object.values(s.drawn)).size).toBe(1);
  });

  it('zieht bei „Themen" ein Thema', () => {
    const { s } = started(3, 'themen');
    expect(topicText(s)).toBeTruthy();
  });

  it('mischt eigene Karten als Themen ein', () => {
    useCustomCards.setState({
      byGame: { 'meme-battle': [{ id: 'c1', text: 'Unser Insider', heat: 1 }] },
    });
    const s = createState(players(3));
    expect(s.customTopics).toEqual(['Unser Insider']);
    expect(s.topicDeck).toContain(-1);
    expect(s.topicDeck.filter((i) => i >= 0).every((i) => TOPICS[i] && !TOPICS[i].spicy)).toBe(
      true,
    );
    useCustomCards.setState({ byGame: {} });
  });
});

describe('Meme-Duell: Basteln', () => {
  it('würfelt neu, bis die Würfe alle sind', () => {
    const { roster, s: s0 } = started(3);
    let s = s0;
    const gesehen = new Set([s.drawn.p0]);
    for (let i = 0; i < REROLLS; i++) {
      s = reduce(s, act('reroll', 'p0'), roster);
      gesehen.add(s.drawn.p0);
    }
    expect(s.rerolls.p0).toBe(0);
    expect(gesehen.size).toBe(REROLLS + 1);
    expect(reduce(s, act('reroll', 'p0'), roster)).toBe(s);
  });

  it('holt mit „Zurück" die vorige Vorlage, ohne einen Wurf zu kosten', () => {
    const { roster, s: s0 } = started(3);
    const erste = s0.drawn.p0;
    expect(reduce(s0, act('back', 'p0'), roster)).toBe(s0);
    const s1 = reduce(s0, act('reroll', 'p0'), roster);
    const zweite = s1.drawn.p0;
    const s2 = reduce(s1, act('back', 'p0'), roster);
    expect(s2.drawn.p0).toBe(erste);
    expect(s2.rerolls.p0).toBe(REROLLS - 1);
    // Noch einmal: zurück zur gewürfelten.
    expect(reduce(s2, act('back', 'p0'), roster).drawn.p0).toBe(zweite);
  });

  it('gibt niemandem die Vorlage, zu der jemand zurück kann', () => {
    const roster = players(3);
    let s = createState(roster);
    s = reduce(s, act('rerolls', 'p0', { count: 8 }), roster);
    s = reduce(s, act('start'), roster);
    const vorher = s.drawn.p0;
    s = reduce(s, act('reroll', 'p0'), roster);
    for (let i = 0; i < 8; i++) {
      s = reduce(s, act('reroll', 'p1'), roster);
      expect(s.drawn.p1).not.toBe(vorher);
    }
  });

  it('lässt bei „Gleiches Meme" nicht würfeln', () => {
    const { roster, s } = started(3, 'gleich');
    expect(reduce(s, act('reroll', 'p1'), roster)).toBe(s);
  });

  it('kürzt Texte auf die Felder der Vorlage und lehnt leere ab', () => {
    const { roster, s } = started(3);
    const felder = templateOf(s.drawn.p0)!.boxes.length;
    const leer = reduce(s, act('submit', 'p0', { texts: ['  ', ''] }), roster);
    expect(leer).toBe(s);
    const zuviel = Array.from({ length: 9 }, (_, i) => `Text ${i}  mit   Luft`);
    const t = reduce(s, act('submit', 'p0', { texts: zuviel }), roster);
    expect(t.memes.p0.x).toHaveLength(felder);
    expect(t.memes.p0.x[0]).toBe('Text 0 mit Luft');
  });

  it('startet die Abstimmung, sobald alle fertig sind', () => {
    const { roster, s: s0 } = started(3);
    const s = allSubmit(s0, roster);
    expect(s.phase).toBe('vote');
    expect([...s.order].sort()).toEqual(['p0', 'p1', 'p2']);
    expect(s.deadline).toBeGreaterThan(Date.now());
  });

  it('lässt nach dem Abgeben noch ändern', () => {
    const { roster, s: s0 } = started(3);
    let s = reduce(s0, act('submit', 'p0', { texts: ['A'] }), roster);
    s = reduce(s, act('edit', 'p0'), roster);
    expect(s.memes.p0).toBeUndefined();
    expect(reduce(s, act('reroll', 'p0'), roster).drawn.p0).not.toBe(s.drawn.p0);
  });

  it('wartet nicht auf Nachzügler ohne Vorlage und gibt ihnen eine', () => {
    const { roster, s: s0 } = started(3);
    const mitNeu = [...roster, { id: 'p9', name: 'Neu', color: 'pink' as const, online: true }];
    const s1 = reduce(s0, act('claim', 'p9'), mitNeu);
    expect(s1.drawn.p9).toBeTruthy();
    expect(s1.rerolls.p9).toBe(REROLLS);
    // Ohne Claim blockiert p9 die Runde nicht.
    expect(allSubmit(s0, roster).phase).toBe('vote');
  });

  it('wartet nicht auf jemanden, der offline gegangen ist', () => {
    const { roster, s: s0 } = started(3);
    const weg = roster.map((p) => (p.id === 'p2' ? { ...p, online: false } : p));
    let s = reduce(s0, act('submit', 'p0', { texts: ['A'] }), weg);
    s = reduce(s, act('submit', 'p1', { texts: ['B'] }), weg);
    expect(s.phase).toBe('vote');
  });

  it('beendet das Basteln erst nach Frist und Gnadenfrist', () => {
    const { roster, s: s0 } = started(3);
    const s = reduce(s0, act('submit', 'p0', { texts: ['A'] }), roster);
    expect(reduce(s, act('timeout', 'p1', { at: s.deadline! }), roster)).toBe(s);
    const t = reduce(s, act('timeout', 'p1', { at: s.deadline! + SUBMIT_GRACE_MS }), roster);
    expect(t.phase).toBe('vote');
    expect(t.order).toEqual(['p0']);
  });

  it('geht ohne ein einziges Meme direkt zur Auflösung', () => {
    const { roster, s } = started(3);
    const t = reduce(s, act('timeout', 'p0', { at: later() }), roster);
    expect(t.phase).toBe('results');
    expect(t.order).toEqual([]);
  });
});

describe('Meme-Duell: Abstimmen', () => {
  const inVote = () => {
    const { roster, s } = started(4);
    return { roster, s: allSubmit(s, roster) };
  };

  it('lässt niemanden fürs eigene Meme stimmen', () => {
    const { roster, s } = inVote();
    const autor = s.order[0];
    expect(reduce(s, act('vote', autor, { target: autor, value: 1 }), roster)).toBe(s);
  });

  it('verwirft Stimmen für ein Meme, das schon vorbei ist', () => {
    const { roster, s } = inVote();
    const [erstes, zweites] = s.order;
    const waehler = [s.order[2], s.order[3]].find((id) => id !== erstes)!;
    expect(reduce(s, act('vote', waehler, { target: zweites, value: 1 }), roster)).toBe(s);
  });

  it('nimmt nur hoch, meh und runter an und lässt umentscheiden', () => {
    const { roster, s: s0 } = inVote();
    const autor = s0.order[0];
    const w = roster.find((p) => p.id !== autor)!.id;
    expect(reduce(s0, act('vote', w, { target: autor, value: 5 }), roster)).toBe(s0);
    let s = reduce(s0, act('vote', w, { target: autor, value: 1 }), roster);
    s = reduce(s, act('vote', w, { target: autor, value: -1 }), roster);
    expect(s.votes[autor][w]).toBe(-1);
  });

  it('geht erst weiter, wenn die Zeit um ist oder alle abgestimmt haben', () => {
    const { roster, s: s0 } = inVote();
    const autor = s0.order[0];
    expect(reduce(s0, act('advance', 'p0', { target: autor }), roster)).toBe(s0);
    const zeitUm = reduce(
      s0,
      act('advance', 'p0', { target: autor, at: s0.shownAt + VOTE_MS }),
      roster,
    );
    expect(zeitUm.showing).toBe(1);

    let s = s0;
    for (const p of roster) {
      if (p.id !== autor) s = reduce(s, act('vote', p.id, { target: autor, value: 0 }), roster);
    }
    // Alle haben gestimmt – trotzdem steht das Meme ein paar Sekunden.
    expect(reduce(s, act('advance', 'p0', { target: autor, at: s.shownAt + 100 }), roster)).toBe(s);
    expect(
      reduce(s, act('advance', 'p0', { target: autor, at: s.shownAt + MIN_SHOW_MS }), roster)
        .showing,
    ).toBe(1);
  });

  it('springt bei zwei gleichzeitigen „weiter" nur um ein Meme', () => {
    const { roster, s: s0 } = inVote();
    const autor = s0.order[0];
    const a = act('advance', 'p0', { target: autor, at: later() });
    const s1 = reduce(s0, a, roster);
    const s2 = reduce(s1, { ...a, by: 'p1' }, roster);
    expect(s2.showing).toBe(1);
  });

  it('erlaubt das Trittbrett einmal je Runde und nie aufs eigene Meme', () => {
    const { roster, s: s0 } = inVote();
    const autor = s0.order[0];
    const w = roster.find((p) => p.id !== autor)!.id;
    expect(reduce(s0, act('ride', autor, { target: autor }), roster)).toBe(s0);
    const s1 = reduce(s0, act('ride', w, { target: autor }), roster);
    expect(s1.riders[w]).toBe(autor);
    const s2 = reduce(s1, act('advance', 'p0', { target: autor, at: later() }), roster);
    const naechster = s2.order[s2.showing];
    expect(reduce(s2, act('ride', w, { target: naechster }), roster)).toBe(s2);
  });
});

describe('Meme-Duell: Reaktionen', () => {
  it('nimmt Reaktionen nur beim Abstimmen an und hält nur die letzten', () => {
    const { roster, s: s0 } = started(3);
    expect(reduce(s0, act('react', 'p0', { kind: 'lachen' }), roster)).toBe(s0);
    let s = allSubmit(s0, roster);
    expect(reduce(s, act('react', 'p0', { kind: 'kotzen' }), roster)).toBe(s);
    for (let i = 0; i < 12; i++) s = reduce(s, act('react', 'p1', { kind: 'herz' }), roster);
    expect(s.reactions).toHaveLength(8);
    expect(s.reactions.at(-1)).toMatchObject({ n: 12, k: 'herz' });
  });
});

describe('Meme-Duell: Punkte', () => {
  it('rechnet auf 1000 bei einstimmig hoch, anteilig bis ins Minus', () => {
    expect(pointsFor({ a: 1, b: 1, c: 1 }, 3)).toBe(1000);
    expect(pointsFor({ a: 1, b: 0, c: -1 }, 3)).toBe(0);
    expect(pointsFor({ a: 1, b: 1 }, 4)).toBe(500);
    expect(pointsFor({ a: -1, b: -1, c: 0 }, 3)).toBe(-667);
    expect(pointsFor({}, 0)).toBe(0);
    // Wer mitten in der Abstimmung gegangen ist, hat trotzdem gezählt.
    expect(pointsFor({ a: 1, b: 1, c: 1 }, 2)).toBe(1000);
  });

  it('verteilt Punkte, Trittbrett- und Mitfahrer-Bonus', () => {
    const { roster, s: s0 } = started(3);
    let s = allSubmit(s0, roster);
    // p0s Meme bekommt Fire von allen, alle anderen Memes Lame.
    const plan = (_voter: string, author: string) => (author === 'p0' ? 1 : -1);
    // p1 springt auf p0s Meme auf, p2 auf das von p1.
    for (let i = 0; i < 3; i++) {
      const autor = s.order[s.showing];
      if (autor === 'p0') s = reduce(s, act('ride', 'p1', { target: 'p0' }), roster);
      if (autor === 'p1') s = reduce(s, act('ride', 'p2', { target: 'p1' }), roster);
      s = voteAndAdvance(s, roster, plan);
    }
    expect(s.phase).toBe('results');
    expect(s.points).toEqual({ p0: 1000, p1: -1000, p2: -1000 });
    // Wer mitfährt, bekommt die Hälfte …
    expect(s.bonus).toEqual({ p1: 500, p2: -500 });
    // … und das Meme je Mitfahrer +10.
    expect(s.riderPts).toEqual({ p0: RIDER_BONUS, p1: RIDER_BONUS });
    expect(s.scores).toEqual({ p0: 1010, p1: -490, p2: -1500 });
    expect(s.totals.p1).toEqual({ meme: -1000, ride: 500, riders: RIDER_BONUS });
    expect(s.history).toHaveLength(3);
    expect(s.names.p0).toBe('Spieler 0');
    expect(bestPerRound(s.history)[0]).toMatchObject({ r: 1, by: 'p0', p: 1000 });
  });

  it('zählt im Modus „Entspannt" keine Punkte', () => {
    const { roster, s: s0 } = started(3, 'entspannt');
    let s = allSubmit(s0, roster);
    expect(reduce(s, act('ride', 'p1', { target: s.order[0] }), roster)).toBe(s);
    for (let i = 0; i < 3; i++) s = voteAndAdvance(s, roster, () => 1);
    expect(s.phase).toBe('results');
    expect(s.scores).toEqual({ p0: 0, p1: 0, p2: 0 });
    expect(s.history).toHaveLength(3);
  });
});

describe('Meme-Duell: Runden', () => {
  function playRound(s: State, roster: GamePlayer[]): State {
    s = allSubmit(s, roster);
    while (s.phase === 'vote') s = voteAndAdvance(s, roster, () => 1);
    return s;
  }

  it('behält die Würfe über Runden und endet nach dem Ziel', () => {
    const { roster, s: s0 } = started(3);
    let s = reduce(s0, act('reroll', 'p0'), roster);
    s = { ...s, goal: 2 };
    s = playRound(s, roster);
    s = reduce(s, act('next'), roster);
    expect(s.phase).toBe('create');
    expect(s.round).toBe(2);
    expect(s.rerolls.p0).toBe(REROLLS - 1);
    // Ein doppeltes „Weiter" überspringt keine Runde.
    expect(reduce(s, act('next'), roster)).toBe(s);
    s = playRound(s, roster);
    s = reduce(s, act('next'), roster);
    expect(s.phase).toBe('over');
    expect(s.history).toHaveLength(6);
    expect(bestPerRound(s.history).map((h) => h.r)).toEqual([1, 2]);
  });

  it('zeigt in einer Partie keine Vorlage zweimal', () => {
    const roster = players(8);
    let s = createState(roster);
    s = reduce(s, act('rounds', 'p0', { rounds: 8 }), roster);
    s = reduce(s, act('start'), roster);
    for (let r = 0; r < 8; r++) {
      for (const p of roster) s = reduce(s, act('reroll', p.id), roster);
      s = playRound(s, roster);
      s = reduce(s, act('next'), roster);
    }
    const vorlagen = s.history.map((h) => h.t);
    expect(vorlagen).toHaveLength(64);
    expect(new Set(vorlagen).size).toBe(64);
    // Der Spielstand trägt nie den ganzen Katalog mit sich herum.
    expect(s.deck.length).toBeLessThanOrEqual(24);
  });

  it('startet mit denselben Einstellungen neu', () => {
    const roster = players(3);
    let s = createState(roster);
    s = reduce(s, act('mode', 'p0', { mode: 'themen' }), roster);
    s = reduce(s, act('rounds', 'p0', { rounds: 8 }), roster);
    s = reduce(s, act('start'), roster);
    s = reduce(s, act('restart'), roster);
    expect(s.phase).toBe('setup');
    expect(s.options.mode).toBe('themen');
    expect(s.goal).toBe(8);
    expect(s.history).toEqual([]);
  });

  it('lässt Rundenzahl und Würfe einstellen', () => {
    const roster = players(3);
    let s = createState(roster);
    s = reduce(s, act('rounds', 'p0', { rounds: 0 }), roster);
    expect(s.goal).toBeNull();
    s = reduce(s, act('rounds', 'p0', { rounds: 3 }), roster);
    expect(s.goal).toBe(3);
    expect(reduce(s, act('rounds', 'p0', { rounds: 7 }), roster)).toBe(s);
    s = reduce(s, act('rerolls', 'p0', { count: 8 }), roster);
    expect(reduce(s, act('rerolls', 'p0', { count: 2 }), roster)).toBe(s);
    s = reduce(s, act('start'), roster);
    expect(s.rerolls).toEqual({ p0: 8, p1: 8, p2: 8 });
  });
});

describe('Meme-Duell: Text einpassen', () => {
  // 10 px je Zeichen und Punkt Schriftgröße / 10 – grob wie eine schmale Schrift.
  const measureAt = (s: string, size: number) => s.length * size * 0.5;

  it('bricht an Wortgrenzen um', () => {
    expect(wrapLines('eins zwei drei', 50, (s) => s.length * 10)).toEqual(['eins', 'zwei', 'drei']);
    expect(wrapLines('eins zwei', 200, (s) => s.length * 10)).toEqual(['eins zwei']);
  });

  it('wählt die größte Schrift, die ins Feld passt', () => {
    const kurz = fitText('JA', 200, 60, measureAt);
    const lang = fitText('DAS IST EIN SEHR VIEL LÄNGERER TEXT FÜR DAS FELD', 200, 60, measureAt);
    expect(kurz.size).toBeGreaterThan(lang.size);
    expect(lang.lines.length * lang.size * 1.12).toBeLessThanOrEqual(60);
    for (const l of lang.lines) expect(measureAt(l, lang.size)).toBeLessThanOrEqual(200);
  });
});

describe('Meme-Duell: Update mitten in der Runde', () => {
  it('fängt einen Spielstand der alten Fassung mit „restart" wieder ein', () => {
    const roster = players(3);
    const alt = {
      phase: 'writing',
      prompt: 3,
      deck: [1, 2],
      answers: {},
      votes: {},
    } as unknown as State;
    const s = reduce(alt, act('restart'), roster);
    expect(s.phase).toBe('setup');
    expect(s.options.mode).toBe('klassisch');
  });
});
