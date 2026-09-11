import { describe, expect, it } from 'vitest';
import { busfahrer } from './index';
import { cardFromIndex } from '../shared/deck';
import type { GameAction, GamePlayer } from '../types';

type State = ReturnType<typeof busfahrer.createState>;

const act = (type: string, by = 'p0', extra: Record<string, unknown> = {}): GameAction => ({
  type,
  by,
  at: Date.now(),
  ...extra,
});

const roster: GamePlayer[] = [
  { id: 'p0', name: 'Mira', color: 'blue', online: true },
  { id: 'p1', name: 'Ben', color: 'pink', online: true },
  { id: 'p2', name: 'Cem', color: 'green', online: true },
];

/** Kartenindex aus Wert und Farbe. 0 = Ass Pik, 12 = König Pik. */
const karte = (rank: number, suit = 0) => suit * 13 + rank;

/**
 * Ein Zustand mit FESTER Ziehung. `createState` mischt, und an einem
 * Mischergebnis hängend würde jede Zusicherung hier nur manchmal gelten:
 * „passt" und „Bluff" wären dasselbe Testergebnis.
 *
 * Gelegt wird: Pyramide aus zehn Karten, deren unterste eine Dame ist, und
 * drei Hände, von denen nur Ben eine Dame hält.
 */
function gestellt(over: Partial<State> = {}): State {
  const s = busfahrer.createState(roster);
  return {
    ...s,
    phase: 'pyramid',
    pyStep: 'flip',
    pyUp: 0,
    // Index 0 ist die unterste Reihe und wird zuerst aufgedeckt.
    pyramid: [
      karte(11, 0), // Dame Pik
      karte(2, 1),
      karte(3, 1),
      karte(4, 1),
      karte(5, 1),
      karte(6, 1),
      karte(7, 1),
      karte(8, 1),
      karte(9, 1),
      karte(10, 1),
    ],
    hands: {
      p0: [karte(2, 2), karte(3, 2)],
      p1: [karte(11, 3), karte(4, 2)], // Dame Kreuz – passt auf die Dame Pik
      p2: [karte(5, 2)],
    },
    mistakes: { p0: 0, p1: 0, p2: 0 },
    ...over,
  };
}

const run = (s: State, ...actions: GameAction[]) =>
  actions.reduce((acc, a) => busfahrer.reduce(acc, a, roster), s);

describe('Busfahrer: Fragerunde', () => {
  it('behaelt die geratenen Karten auf der Hand statt sie wegzuwerfen', () => {
    let s = busfahrer.createState(roster);
    const ersterSpieler = s.order[0];
    for (let q = 0; q < 4; q++) {
      s = run(s, act('answer', ersterSpieler, { answer: 'rot' }), act('continue', ersterSpieler));
    }
    expect(s.hands[ersterSpieler]).toHaveLength(4);
    expect(s.hand, 'die naechste Person faengt bei null an').toHaveLength(0);
    expect(s.playerIndex).toBe(1);
  });

  it('geht nach der letzten Person in die Pyramide, nicht auf den Bus', () => {
    let s = busfahrer.createState(roster);
    for (const pid of s.order) {
      for (let q = 0; q < 4; q++) {
        s = run(s, act('answer', pid, { answer: 'rot' }), act('continue', pid));
      }
    }
    expect(s.phase).toBe('pyramid');
    expect(s.pyStep).toBe('flip');
    for (const pid of roster.map((p) => p.id)) {
      expect(s.hands[pid], pid).toHaveLength(4);
    }
  });

  it('legt Pyramide und Fragerunde aus EINEM Stapel, ohne eine Karte doppelt', () => {
    // Sonst koennte jemand eine Zehn ablegen, die oben in der Pyramide
    // noch einmal auftaucht – und die App haette zwei Wahrheiten.
    const s = busfahrer.createState(roster);
    const alle = [...s.pyramid, ...s.deck];
    expect(new Set(alle).size).toBe(alle.length);
    expect(s.pyramid).toHaveLength(10);
  });

  it('haelt die Pyramide auch dann sauber, wenn der Stapel NACHGEMISCHT wird', () => {
    // Der Test darueber sieht nur den Startzustand und ist dort trivial wahr.
    // Erst waehrend der Fragerunde geht der Vorrat zur Neige: zehn Karten
    // liegen in der Pyramide, 42 bleiben, und zwoelf Personen ziehen 48.
    // Wird dann ein volles Deck nachgemischt, liegt dieselbe Karte offen in
    // der Pyramide und verdeckt auf einer Hand.
    const grosseRunde: GamePlayer[] = Array.from({ length: 12 }, (_, i) => ({
      id: `q${i}`,
      name: `Q${i}`,
      color: 'blue',
      online: true,
    }));
    // Mehrfach, weil die Ziehung gemischt ist: ein einzelner Lauf trifft den
    // Fall nicht zuverlaessig.
    for (let versuch = 0; versuch < 20; versuch++) {
      let s = busfahrer.createState(grosseRunde);
      for (const pid of s.order) {
        for (let q = 0; q < 4; q++) {
          s = busfahrer.reduce(s, act('answer', pid, { answer: 'rot' }), grosseRunde);
          s = busfahrer.reduce(s, act('continue', pid), grosseRunde);
        }
      }
      expect(s.phase, `Versuch ${versuch}`).toBe('pyramid');
      const aufHaenden = Object.values(s.hands).flat();
      const doppelt = aufHaenden.filter((c) => s.pyramid.includes(c));
      expect(doppelt, `Versuch ${versuch}: liegt in Pyramide UND Hand`).toEqual([]);
    }
  });
});

describe('Busfahrer: Pyramide', () => {
  it('deckt von unten auf und fragt dann, wer ablegt', () => {
    const s = run(gestellt(), act('pyFlip'));
    expect(s.pyUp).toBe(1);
    expect(s.pyStep).toBe('claim');
    expect(cardFromIndex(s.pyramid[0]).rank, 'unterste Karte ist die Dame').toBe(11);
  });

  it('haelt das Ergebnis des Bluffs NICHT im geteilten Zustand', () => {
    // Der Zustand geht ueber Firebase an alle Geraete. Stuende dort ein Feld
    // "passt die Karte", koennte jeder Mitlesende den Zweifel ausrechnen,
    // um den das ganze Spiel geht. Es wird deshalb erst beim Aufdecken
    // berechnet.
    const s = run(
      gestellt(),
      act('pyFlip'),
      act('pyClaim', 'p1', { who: 'p1' }),
      act('pyPick', 'p1', { card: karte(11, 3) }),
    );
    expect(s.pyStep).toBe('doubt');
    expect(Object.keys(s)).not.toContain('pyClaimHit');
  });

  it('sagt an, wer trinkt – und nimmt die Karte erst danach weg', () => {
    // Ohne den Schritt "gave" verpufften die Schlucke im haeufigsten Fall
    // des Spiels: eine Auswahl allein ist keine Aufforderung.
    const gewaehlt = run(
      gestellt(),
      act('pyFlip'),
      act('pyClaim', 'p0', { who: 'p0' }),
      act('pyPick', 'p0', { card: karte(2, 2) }),
      act('pyAccept'),
      act('pyGive', 'p0', { to: 'p1' }),
    );
    expect(gewaehlt.pyStep, 'erst die Ansage').toBe('gave');
    expect(gewaehlt.pyGiveTo).toBe('p1');
    expect(gewaehlt.hands.p0, 'Karte noch da, bis die Ansage steht').toHaveLength(2);

    const s = run(gewaehlt, act('pyDone'));
    expect(s.hands.p0, 'der Bluff hat sich gelohnt').toEqual([karte(3, 2)]);
    expect(s.pyStep).toBe('flip');
    expect(s.pyClaimBy).toBeNull();
    expect(s.pyGiveTo).toBeNull();
  });

  it('laesst niemanden die Schlucke an sich selbst verteilen', () => {
    const s = run(
      gestellt(),
      act('pyFlip'),
      act('pyClaim', 'p0', { who: 'p0' }),
      act('pyPick', 'p0', { card: karte(2, 2) }),
      act('pyAccept'),
      act('pyGive', 'p0', { to: 'p0' }),
    );
    expect(s.pyStep, 'bleibt bei der Auswahl').toBe('give');
    expect(s.pyGiveTo).toBeNull();
  });

  it('gibt einem aufgedeckten Bluff die Karte zurueck', () => {
    const s = run(
      gestellt(),
      act('pyFlip'),
      act('pyClaim', 'p0', { who: 'p0' }),
      act('pyPick', 'p0', { card: karte(2, 2) }),
      act('pyDoubt', 'p1', { who: 'p1' }),
    );
    expect(s.pyStep, 'erst die Strafe zeigen').toBe('penalty');
    const nach = run(s, act('pyDone'));
    expect(nach.hands.p0, 'Karte bleibt bei der Luegnerin').toHaveLength(2);
    expect(nach.pyStep).toBe('flip');
  });

  it('nimmt die Karte weg, wenn der Zweifel danebenlag', () => {
    const s = run(
      gestellt(),
      act('pyFlip'),
      act('pyClaim', 'p1', { who: 'p1' }),
      act('pyPick', 'p1', { card: karte(11, 3) }),
      act('pyDoubt', 'p0', { who: 'p0' }),
      act('pyDone'),
    );
    expect(s.hands.p1).toEqual([karte(4, 2)]);
  });

  it('laesst niemanden ohne Karten ablegen', () => {
    const s = gestellt({ hands: { p0: [], p1: [karte(11, 3)], p2: [] } });
    const nach = run(s, act('pyFlip'), act('pyClaim', 'p0', { who: 'p0' }));
    expect(nach.pyStep, 'bleibt bei der Frage').toBe('claim');
    expect(nach.pyClaimBy).toBeNull();
  });

  it('laesst niemanden an seinem eigenen Ablegen zweifeln', () => {
    const s = run(
      gestellt(),
      act('pyFlip'),
      act('pyClaim', 'p1', { who: 'p1' }),
      act('pyPick', 'p1', { card: karte(11, 3) }),
      act('pyDoubt', 'p1', { who: 'p1' }),
    );
    expect(s.pyStep).toBe('doubt');
    expect(s.pyDoubtBy).toBeNull();
  });

  it('laesst aus der Kartenwahl wieder heraus', () => {
    // Ohne diesen Weg klebt das Spiel in `pick`, sobald jemand seinen Chip
    // aus Versehen trifft. Der Sackgassen-Test in `games.test.ts` sieht das
    // nicht: er probiert jede Handkarte durch und kommt darum immer weiter.
    const s = run(gestellt(), act('pyFlip'), act('pyClaim', 'p1', { who: 'p1' }));
    expect(s.pyStep).toBe('pick');
    const zurueck = run(s, act('pyCancel'));
    expect(zurueck.pyStep).toBe('claim');
    expect(zurueck.pyClaimBy).toBeNull();
    expect(zurueck.hands.p1, 'die Hand bleibt unangetastet').toHaveLength(2);
  });

  it('nimmt nur Karten an, die wirklich auf der Hand liegen', () => {
    const s = run(
      gestellt(),
      act('pyFlip'),
      act('pyClaim', 'p1', { who: 'p1' }),
      act('pyPick', 'p1', { card: karte(12, 3) }),
    );
    expect(s.pyStep, 'eine fremde Karte schiebt nichts weiter').toBe('pick');
    expect(s.pyClaimCard).toBeNull();
  });

  it('schickt nach zehn Karten den mit den meisten Karten auf den Bus', () => {
    let s = gestellt({ pyUp: 9, pyStep: 'flip' });
    s = run(s, act('pyFlip'), act('pyPass'));
    expect(s.phase).toBe('bus');
    // p1 und p0 halten je zwei, p2 nur eine – der Gleichstand oben faellt
    // ueber die Fehler aus der Fragerunde.
    expect(['p0', 'p1']).toContain(s.driverId);
    expect(s.drives[s.driverId!]).toBe(1);
    expect(s.busRow).toHaveLength(5);
  });

  it('entscheidet den Gleichstand ueber die Fehler der Fragerunde', () => {
    let s = gestellt({
      pyUp: 9,
      hands: { p0: [karte(2, 2)], p1: [karte(3, 2)], p2: [karte(4, 2)] },
      mistakes: { p0: 1, p1: 4, p2: 0 },
    });
    s = run(s, act('pyFlip'), act('pyPass'));
    expect(s.driverId).toBe('p1');
  });
});

describe('Busfahrer: zu zweit und am Rand', () => {
  const zwei: GamePlayer[] = roster.slice(0, 2);
  const lauf = (s: State, ...actions: GameAction[]) =>
    actions.reduce((acc, a) => busfahrer.reduce(acc, a, zwei), s);

  it('laeuft zu zweit von der ersten Frage bis zur Endstation', () => {
    let s = busfahrer.createState(zwei);
    for (const pid of s.order) {
      for (let q = 0; q < 4; q++) {
        s = lauf(s, act('answer', pid, { answer: 'rot' }), act('continue', pid));
      }
    }
    expect(s.phase).toBe('pyramid');
    for (let i = 0; i < 10; i++) s = lauf(s, act('pyFlip'), act('pyPass'));
    expect(s.phase).toBe('bus');
    // Und die Fahrt zu Ende. 60 Schritte sind reichlich: fuenf Plaetze, und
    // gut ein Drittel des Stapels wirft zurueck.
    for (let i = 0; i < 60 && s.phase === 'bus'; i++) {
      s = s.busPenalty > 0 ? lauf(s, act('restartBus')) : lauf(s, act('flip'));
    }
    expect(s.phase, 'die Fahrt kommt an').toBe('done');
  });

  it('verteilt auch dann, wenn nur EIN Gegner am Tisch sitzt', () => {
    let s = busfahrer.createState(zwei);
    s = { ...s, phase: 'pyramid', pyStep: 'flip', pyUp: 0, hands: { p0: [5, 6], p1: [7] } };
    s = lauf(s, act('pyFlip'), act('pyClaim', 'p0', { who: 'p0' }), act('pyPick', 'p0', { card: 5 }));
    s = lauf(s, act('pyAccept'));
    expect(s.pyStep).toBe('give');
    s = lauf(s, act('pyGive', 'p0', { to: 'p1' }));
    expect(s.pyGiveTo, 'der einzige Gegner').toBe('p1');
    s = lauf(s, act('pyDone'));
    expect(s.hands.p0).toEqual([6]);
    expect(s.pyStep).toBe('flip');
  });

  it('laeuft die Pyramide auch durch, wenn NIEMAND mehr Karten hat', () => {
    let s = busfahrer.createState(roster);
    s = { ...s, phase: 'pyramid', pyStep: 'flip', pyUp: 0, hands: { p0: [], p1: [], p2: [] } };
    for (let i = 0; i < 10; i++) {
      s = run(s, act('pyFlip'));
      expect(s.pyStep, `Karte ${i + 1}`).toBe('claim');
      s = run(s, act('pyPass'));
    }
    expect(s.phase).toBe('bus');
    expect(s.driverId, 'auch ohne Karten faehrt jemand').toBeTruthy();
  });
});

describe('Busfahrer: Phasen halten dicht', () => {
  // Die UI blendet die Knoepfe aus. Eine verspaetete Aktion aus der Inbox
  // sieht diese UI nicht – deshalb prueft jeder Zweig die Phase selbst.
  it('ignoriert Pyramiden-Aktionen aus der Fragerunde', () => {
    const s = busfahrer.createState(roster);
    for (const t of ['pyFlip', 'pyPass', 'pyAccept', 'pyDone']) {
      expect(busfahrer.reduce(s, act(t), roster), t).toBe(s);
    }
    expect(busfahrer.reduce(s, act('pyClaim', 'p0', { who: 'p0' }), roster)).toBe(s);
  });

  it('ignoriert Busfahrt-Aktionen aus der Pyramide', () => {
    const s = gestellt();
    for (const t of ['flip', 'restartBus', 'again']) {
      expect(busfahrer.reduce(s, act(t), roster), t).toBe(s);
    }
  });

  it('deckt waehrend einer offenen Strafe keine weitere Buskarte auf', () => {
    const s: State = {
      ...gestellt(),
      phase: 'bus',
      busPenalty: 3,
      busPos: 1,
      driverId: 'p0',
      busDeck: [karte(5, 0), karte(6, 0)],
    };
    expect(busfahrer.reduce(s, act('flip'), roster)).toBe(s);
  });

  it('beantwortet keine Frage zweimal, solange die Aufloesung steht', () => {
    let s = busfahrer.createState(roster);
    s = busfahrer.reduce(s, act('answer', s.order[0], { answer: 'rot' }), roster);
    const nochmal = busfahrer.reduce(s, act('answer', s.order[0], { answer: 'schwarz' }), roster);
    expect(nochmal, 'zwei schnelle Taps ziehen nicht zwei Karten').toBe(s);
    expect(s.hand).toHaveLength(1);
  });
});
