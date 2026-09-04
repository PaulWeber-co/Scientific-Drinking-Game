import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { GAMES, gamesForGroup, getGame, getLoadedGame, loadGame } from './registry';
import { useApp } from '../store/app';
import { encodeState, decodeState } from '../features/party/PartyContext';
import type { GameAction, GamePlayer } from './types';
import type { CardGameState } from './card-engine/createCardGame';
import { cardFromIndex } from './shared/deck';

// Die Module kommen als eigene Chunks – für die Verhaltenstests alle laden.
const DEFS = await Promise.all(GAMES.map((g) => loadGame(g.id)));

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

/**
 * Alle Aktionstypen, die in den Spielen vorkommen – aus dem Quelltext gelesen,
 * nicht von Hand gepflegt.
 *
 * Eine Handliste war der blinde Fleck der ersten Fassung: die Maexchen-
 * Aktionen fehlten darin, und genau dort lag eine Sackgasse. Spaeter fielen
 * `arm`, `go`, `nextSpeaker` und `seen` auf, waehrend `reveal` gelistet war,
 * obwohl es die Aktion gar nicht gibt.
 *
 * BLINDER FLECK, der bleibt: erkannt wird nur das Muster `case '<name>'` in
 * den Reducern. Ein Reducer, der Aktionen anders verzweigt, faellt durch.
 */
function readActionTypes(): string[] {
  const root = `${process.cwd()}/src/games`;
  const namen = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) continue;
      for (const m of readFileSync(full, 'utf8').matchAll(/case '([a-zA-Z]+)'/g)) {
        namen.add(m[1]);
      }
    }
  };
  walk(root);
  return [...namen].sort();
}

const ACTION_TYPES = readActionTypes();

/**
 * Parametervarianten. Eine Aktion kann mit dem einen Wert abgelehnt und mit
 * dem anderen angenommen werden – ohne Varianten haette der Test die
 * Maexchen-Sackgasse nicht gesehen, weil `announce` nur mit einem einzigen
 * Rang probiert worden waere.
 *
 * Abgedeckt sind alle Felder, die die Reducer lesen (Stand: `action.answer`,
 * `heat`, `index`, `lie`, `mode`, `order`, `outcome`, `rank`, `side`,
 * `statements`, `target`, `text`, `value`, `winner`).
 *
 * BLINDER FLECK: die Werte sind geraten, nicht aus dem Code abgeleitet. Ein
 * Reducer, der einen Wert ausserhalb dieser Auswahl verlangt, wird nur
 * unvollstaendig geprueft. Ein leerer Ausweg faellt dann als Sackgasse auf –
 * dann gehoert der Wert hierher, nicht die Pruefung entschaerft.
 */
const VARIANTS: Record<string, unknown>[] = [
  {
    text: 'Antwort', target: 'p1', mode: 'wahrheit', heat: 1, answer: 'rot',
    order: ['p1', 'p0'], winner: 'p1', value: 42, index: 0, side: 'left',
    lie: 0, statements: ['a', 'b', 'c'],
  },
  {
    text: 'Zweite', target: 'p2', mode: 'pflicht', heat: 3, answer: 'hoch',
    order: ['p0', 'p1'], winner: 'p2', value: 7, index: 1, side: 'right',
    lie: 1, statements: ['x', 'y', 'z'],
  },
  { rank: 0, value: 1, index: 2, answer: 'innen' },
  { rank: 14, value: 100, answer: 'tief' },
  { rank: 20, answer: '1' },
  { outcome: 'refused' },
  { heat: 2, answer: 'aussen', value: 0 },
];

/**
 * Gibt es aus diesem Zustand einen Weg WEITERZUSPIELEN?
 *
 * `restart` zaehlt bewusst nicht: es kann jeden Zustand verlassen und wuerde
 * jede Sackgasse zudecken. Genau daran ist eine erste Fassung dieses Tests
 * gescheitert – sie blieb gruen, obwohl die Maexchen-Sackgasse offen war.
 */
const ESCAPE_HATCHES = new Set(['restart']);

function hasEscape(
  game: { reduce: (s: unknown, a: GameAction, p: GamePlayer[]) => unknown },
  state: unknown,
  roster: GamePlayer[],
): boolean {
  for (const type of ACTION_TYPES) {
    if (ESCAPE_HATCHES.has(type)) continue;
    for (const extra of VARIANTS) {
      for (const by of roster) {
        if (game.reduce(state, act(type, by.id, extra), roster) !== state) return true;
      }
    }
  }
  return false;
}

/** Eine beendete Partie DARF stillstehen – dort ist „Noch eine Runde" der Weg. */
function isFinished(state: unknown): boolean {
  const s = state as { phase?: string; over?: boolean };
  return s.over === true || s.phase === 'over' || s.phase === 'final';
}

describe('Modulgrenzen', () => {
  /**
   * Aus `src/games/` darf statisch nur `features/party/` importiert werden.
   *
   * `features/party` haengt am App-Root und ist ausgewertet, lange bevor ein
   * Spiel-Chunk laedt – diese Kante traegt seit jeher. Jede andere Kante nach
   * `features/` ist eine Falle: `features/bac` etwa zieht ueber
   * `nightSummary` die Spiele-Registry, und die laedt ihrerseits die
   * Spiel-Chunks. Als statischer Import entsteht daraus ein Zyklus, in dem
   * `PartyCtx` noch nicht ausgewertet ist – jedes Kartenspiel stirbt dann
   * beim Start mit „useParty muss innerhalb von PartyProvider benutzt
   * werden", und zwar in einer Datei, die niemand angefasst hat.
   *
   * Erlaubt bleibt der dynamische Import (`import(...)` in `lazy`), denn der
   * erzeugt keine statische Abhaengigkeit.
   */
  const ERLAUBT = ['features/party/'];

  it('greift aus games/ nur nach features/party/', () => {
    // process.cwd() ist unter vitest das Projektwurzelverzeichnis.
    const root = `${process.cwd()}/src/games`;
    const treffer: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith('.test.tsx')) continue;
        if (entry.name.endsWith('.test.ts')) continue;
        for (const line of readFileSync(full, 'utf8').split('\n')) {
          // Statisch heisst: eine import-Anweisung am Zeilenanfang. `lazy(() =>
          // import('...'))` steht nie am Zeilenanfang und ist erlaubt.
          const m = line.match(/^\s*import\s[^(]*from\s+['"][^'"]*(features\/[\w-]+\/)/);
          if (m && !ERLAUBT.includes(m[1])) {
            treffer.push(`${full.replace(`${process.cwd()}/`, '')}: ${line.trim()}`);
          }
        }
      }
    };
    walk(root);
    expect(
      treffer,
      `verbotene statische Importe (erlaubt: ${ERLAUBT.join(', ')}):\n${treffer.join('\n')}`,
    ).toEqual([]);
  });
});

describe('Kein Spiel laeuft in eine Sackgasse', () => {
  /**
   * Stichprobe, kein Beweis: der Lauf nimmt in jedem Schritt die erste
   * Aktion mit dem ersten Parametersatz, die den Zustand wirklich veraendert,
   * und kommt so tief ins Spiel statt an abgelehnten Aktionen haengenzubleiben.
   * Mehrere Startrotationen fahren unterschiedliche Wege ab.
   *
   * Verifiziert: nimmt man den Maexchen-Fix zurueck, meldet dieser Test
   * „maexchen / Lauf 0, Schritt 13". Ohne die Parameterrotation tat er das
   * NICHT – er lief an dem Zustand vorbei, in dem die Sackgasse lag.
   *
   * BLINDER FLECK: Was die Aktionsliste oder die Parametervarianten nicht
   * hergeben, sieht auch dieser Test nicht. Der gezielte Maexchen-Test
   * darunter deckt den bekannten Fall unabhaengig davon ab.
   */
  it('laesst aus jedem erreichbaren Zustand mindestens eine Aktion zu', () => {
    for (const g of DEFS) {
      for (let rot = 0; rot < VARIANTS.length; rot++) {
        const roster = players(5);
        let state: unknown = g.createState(roster);
        expect(hasEscape(g, state, roster), `${g.id} / Startzustand`).toBe(true);
        for (let i = 0; i < 120; i++) {
          let moved = false;
          for (let k = 0; k < ACTION_TYPES.length && !moved; k++) {
            const type = ACTION_TYPES[(i + k + rot) % ACTION_TYPES.length];
            if (ESCAPE_HATCHES.has(type)) continue;
            // Auch die Parameter durchrotieren: sonst wird `announce` immer
            // mit demselben Rang probiert und der Lauf erreicht nie den
            // Zustand „Maexchen steht", in dem die Sackgasse lag.
            for (let v = 0; v < VARIANTS.length && !moved; v++) {
              const extra = VARIANTS[(i + rot + v) % VARIANTS.length];
              const by = roster[(i + k) % roster.length].id;
              const next = g.reduce(state, act(type, by, extra), roster);
              if (next !== state) {
                state = next;
                moved = true;
              }
            }
          }
          if (!moved || isFinished(state)) break;
          expect(hasEscape(g, state, roster), `${g.id} / Lauf ${rot}, Schritt ${i}`).toBe(true);
        }
      }
    }
  });

  it('bleibt bei Maexchen ansagbar, wenn Maexchen steht', () => {
    // Der konkrete Fall, an dem die Runde vorher starb: Maexchen angesagt,
    // der Naechste glaubt – dann hatte niemand mehr einen Knopf.
    const g = getLoadedGame('maexchen')!;
    const roster = players(3);
    let s = g.createState(roster);
    s = g.reduce(s, act('roll', 'p0'), roster);
    s = g.reduce(s, act('announce', 'p0', { rank: 20 }), roster);
    s = g.reduce(s, act('believe', 'p1'), roster);
    s = g.reduce(s, act('roll', 'p1'), roster);
    expect(s.phase).toBe('announce');
    expect(hasEscape(g, s, roster), 'maexchen nach angesagtem Maexchen').toBe(true);
    const weiter = g.reduce(s, act('announce', 'p1', { rank: 20 }), roster);
    expect(weiter.phase).toBe('decide');
  });
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
      expect(g.icon.length).toBeGreaterThan(2);
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
    for (const g of DEFS) {
      const state = g.createState(players(6));
      const roundTrip = decodeState(encodeState(state));
      expect(roundTrip, g.id).toEqual(state);
    }
  });

  it('ignorieren unbekannte Aktionen, statt zu crashen', () => {
    for (const g of DEFS) {
      const state = g.createState(players(5));
      expect(() => g.reduce(state, act('quatsch'), players(5)), g.id).not.toThrow();
    }
  });

  it('ueberstehen zufaellige Aktionsfolgen ohne Ausnahme', () => {
    const types = ACTION_TYPES;
    for (const g of DEFS) {
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
  const game = getLoadedGame('truth-or-dare')!;

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
    s = game.reduce(s, act('pickMode', 'p0', { mode: 'wahrheit' }), roster);
    s = game.reduce(s, act('resolve'), roster);
    s = game.reduce(s, act('next'), players(5));
    expect(s.order).toHaveLength(5);
  });

  it('entfernt Spieler, die gegangen sind', () => {
    const roster = players(5);
    let s = game.createState(roster) as CardGameState;
    s = game.reduce(s, act('pickMode', 'p0', { mode: 'wahrheit' }), roster);
    s = game.reduce(s, act('resolve'), roster);
    s = game.reduce(s, act('next'), players(3));
    expect(s.order).toHaveLength(3);
  });

  it('zaehlt nicht zweimal, wenn zwei Geraete gleichzeitig weiterklicken', () => {
    // Online wendet die Inbox Aktionen nacheinander an. Ohne Phasenpruefung
    // sprang der Zaehler um zwei und eine Karte fiel still aus.
    const roster = players(4);
    let s = game.createState(roster) as CardGameState;
    s = game.reduce(s, act('pickMode', 'p0', { mode: 'wahrheit' }), roster);
    s = game.reduce(s, act('resolve'), roster);
    const eins = game.reduce(s, act('next', 'p0'), roster);
    const zwei = game.reduce(eins, act('next', 'p1'), roster);
    expect(zwei.turnIndex).toBe(eins.turnIndex);
    expect(zwei.round).toBe(eins.round);
  });

  it('filtert Karten nach Haertegrad', () => {
    let s = game.createState(players(4)) as CardGameState;
    s = game.reduce(s, act('setHeat', 'p0', { heat: 1 }), players(4));
    expect(s.heat).toBe(1);
    expect(s.deck.length).toBeGreaterThan(0);
  });
});

describe('Ring of Fire', () => {
  const game = getLoadedGame('kings-cup')!;

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
  const game = getLoadedGame('busfahrer')!;

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
  const game = getLoadedGame('meme-battle')!;

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
  const game = getLoadedGame('top-ten')!;

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
    // Bis zur Auflösung spielen – vorher nimmt der Reducer kein 'next' an.
    for (const p of roster) s = game.reduce(s, act('submit', p.id, { text: 'x' }), roster);
    s = game.reduce(s, act('lockOrder', roster[first].id, { order: roster.map((p) => p.id) }), roster);
    expect(s.phase).toBe('results');
    s = game.reduce(s, act('next'), roster);
    expect(s.captainIndex).toBe((first + 1) % 4);
  });
});

describe('Tabu Rush', () => {
  const game = getLoadedGame('tabu')!;

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
  const game = getLoadedGame('wortbombe')!;

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

describe('Wer aus der Runde', () => {
  const game = getLoadedGame('most-likely')!;

  it('deckt erst auf, wenn alle gewählt haben', () => {
    const roster = players(4);
    let s = game.createState(roster);
    s = game.reduce(s, act('vote', 'p0', { target: 'p1' }), roster);
    s = game.reduce(s, act('vote', 'p1', { target: 'p1' }), roster);
    expect(s.phase).toBe('vote');
    s = game.reduce(s, act('vote', 'p2', { target: 'p3' }), roster);
    s = game.reduce(s, act('vote', 'p3', { target: 'p1' }), roster);
    expect(s.phase).toBe('result');
    expect(Object.keys(s.votes)).toHaveLength(4);
  });

  it('zieht für die nächste Runde eine neue Frage', () => {
    const roster = players(4);
    let s = game.createState(roster);
    // Erst abstimmen, dann weiter – 'next' aus der Abstimmung heraus lehnt
    // der Reducer ab, sonst zaehlen zwei gleichzeitige Taps zwei Runden.
    for (const p of roster) s = game.reduce(s, act('vote', p.id, { target: 'p0' }), roster);
    expect(s.phase).toBe('result');
    const next = game.reduce(s, act('next'), roster);
    expect(next.votes).toEqual({});
    expect(next.round).toBe(2);
  });
});

describe('Undercover', () => {
  const game = getLoadedGame('undercover')!;

  it('gibt genau einer Person das abweichende Wort', () => {
    const roster = players(6);
    const s = game.createState(roster);
    expect(roster.map((p) => p.id)).toContain(s.undercoverId);
    expect(s.words[0]).not.toBe(s.words[1]);
  });

  it('startet die Beschreibungsrunde, wenn alle ihr Wort gesehen haben', () => {
    const roster = players(4);
    let s = game.createState(roster);
    for (const p of roster) s = game.reduce(s, act('seen', p.id), roster);
    expect(s.phase).toBe('describe');
  });

  it('beendet das Spiel, sobald Undercover rausgewählt wird', () => {
    const roster = players(5);
    let s = game.createState(roster);
    for (const p of roster) s = game.reduce(s, act('seen', p.id), roster);
    s = { ...s, phase: 'vote' };
    for (const p of roster) s = game.reduce(s, act('vote', p.id, { target: s.undercoverId }), roster);
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('gruppe');
    expect(s.eliminated).toContain(s.undercoverId);
  });

  it('lässt Undercover gewinnen, wenn nur noch zwei übrig sind', () => {
    const roster = players(3);
    let s = game.createState(roster);
    const innocent = roster.find((p) => p.id !== s.undercoverId)!;
    for (const p of roster) s = game.reduce(s, act('seen', p.id), roster);
    s = { ...s, phase: 'vote' };
    for (const p of roster) s = game.reduce(s, act('vote', p.id, { target: innocent.id }), roster);
    expect(s.winner).toBe('undercover');
  });
});

describe('Schätzfrage', () => {
  const game = getLoadedGame('schaetzfrage')!;

  it('nimmt auch die Null als Schätzung an', () => {
    const roster = players(3);
    let s = game.createState(roster);
    s = game.reduce(s, act('guess', 'p0', { value: 0 }), roster);
    expect(s.guesses.p0).toBe(0);
  });

  it('löst erst auf, wenn alle geschätzt haben', () => {
    const roster = players(3);
    let s = game.createState(roster);
    s = game.reduce(s, act('guess', 'p0', { value: 10 }), roster);
    s = game.reduce(s, act('guess', 'p1', { value: 20 }), roster);
    expect(s.phase).toBe('guess');
    s = game.reduce(s, act('guess', 'p2', { value: 30 }), roster);
    expect(s.phase).toBe('result');
  });

  it('ignoriert unsinnige Eingaben', () => {
    const roster = players(3);
    const s = game.createState(roster);
    expect(game.reduce(s, act('guess', 'p0', { value: 'viele' }), roster).guesses).toEqual({});
  });
});

describe('Zwei Wahrheiten, eine Lüge', () => {
  const game = getLoadedGame('zwei-wahrheiten')!;

  it('mischt die Aussagen und merkt sich die Lüge korrekt', () => {
    const roster = players(3);
    let s = game.createState(roster);
    const author = s.order[0];
    s = game.reduce(
      s,
      act('submit', author, { statements: ['wahr A', 'LUEGE', 'wahr B'], lie: 1 }),
      roster,
    );
    expect(s.phase).toBe('guess');
    expect(s.statements).toHaveLength(3);
    expect(s.statements[s.lie]).toBe('LUEGE');
  });

  it('nimmt keine unvollständigen Aussagen an', () => {
    const roster = players(3);
    const s = game.createState(roster);
    const out = game.reduce(s, act('submit', s.order[0], { statements: ['a', '', 'c'], lie: 0 }), roster);
    expect(out.phase).toBe('write');
  });

  it('lässt den Autor nicht mitraten', () => {
    const roster = players(3);
    let s = game.createState(roster);
    const author = s.order[0];
    s = game.reduce(s, act('submit', author, { statements: ['a', 'b', 'c'], lie: 0 }), roster);
    s = game.reduce(s, act('guess', author, { index: 1 }), roster);
    expect(s.guesses[author]).toBeUndefined();
  });
});

describe('Mäxchen', () => {
  const game = getLoadedGame('maexchen')!;

  it('lässt nur höhere Ansagen zu', () => {
    const roster = players(3);
    let s = game.createState(roster);
    s = game.reduce(s, act('roll'), roster);
    s = game.reduce(s, act('announce', 'p0', { rank: 5 }), roster);
    expect(s.announced).toBe(5);
    s = game.reduce(s, act('believe'), roster);
    s = game.reduce(s, act('roll'), roster);
    const tooLow = game.reduce(s, act('announce', 'p1', { rank: 3 }), roster);
    expect(tooLow.announced).toBeNull();
    const ok = game.reduce(s, act('announce', 'p1', { rank: 9 }), roster);
    expect(ok.announced).toBe(9);
  });

  it('bestraft beim Aufdecken die richtige Person', () => {
    const roster = players(3);
    let s = game.createState(roster);
    // Gelogen: 1+1 ist der niedrigste Pasch, angesagt wird Mäxchen.
    s = { ...s, phase: 'announce', dice: [1, 1] };
    s = game.reduce(s, act('announce', 'p0', { rank: 20 }), roster);
    s = game.reduce(s, act('doubt'), roster);
    expect(s.reveal?.truthful).toBe(false);
    expect(s.reveal?.loserId).toBe(s.order[0]);
  });

  it('bestraft den Zweifler, wenn die Ansage stimmte', () => {
    const roster = players(3);
    let s = game.createState(roster);
    s = { ...s, phase: 'announce', dice: [2, 1] }; // Mäxchen
    s = game.reduce(s, act('announce', 'p0', { rank: 20 }), roster);
    s = game.reduce(s, act('doubt'), roster);
    expect(s.reveal?.truthful).toBe(true);
    expect(s.reveal?.loserId).toBe(s.order[1]);
  });
});

describe('Reaktions-Duell', () => {
  const game = getLoadedGame('duell')!;

  it('wertet einen Fehlstart sofort als Niederlage', () => {
    const roster = players(4);
    let s = game.createState(roster);
    s = game.reduce(s, act('arm'), roster);
    s = game.reduce(s, act('tap', 'p0', { side: 0 }), roster);
    expect(s.falseStart).toBe(true);
    expect(s.loser).toBe(s.order[0]);
  });

  it('kürt beim ersten Tippen nach dem Signal einen Sieger', () => {
    const roster = players(4);
    let s = game.createState(roster);
    s = game.reduce(s, act('arm'), roster);
    s = game.reduce(s, act('go'), roster);
    s = game.reduce(s, act('tap', 'p1', { side: 1 }), roster);
    expect(s.phase).toBe('result');
    expect(s.winner).toBe(s.order[1]);
    expect(s.loser).toBe(s.order[0]);
  });
});

describe('Kartenspiele mit eigenen Karten', () => {
  it('legen den Stapel als Inhalt ab, nicht als Index', () => {
    const game = getLoadedGame('truth-or-dare')!;
    const s = game.createState(players(4));
    expect(Array.isArray(s.deck)).toBe(true);
    expect(typeof s.deck[0].text).toBe('string');
  });

  it('erlauben eigene Karten dort, wo es Sinn ergibt', () => {
    for (const id of ['truth-or-dare', 'never-have-i-ever', 'chaos-roulette', 'kategorien']) {
      expect(getGame(id)?.allowCustomCards, id).toBe(true);
    }
  });
});


describe('Kartenspiele ohne Zugreihenfolge', () => {
  it('legen die erste Karte sofort auf den Tisch', () => {
    for (const id of ['never-have-i-ever', 'kategorien']) {
      const s = getLoadedGame(id)!.createState(players(4));
      expect(s.phase, id).toBe('card');
      expect(s.drawn, id).not.toBeNull();
      expect(typeof s.drawn.text, id).toBe('string');
    }
  });

  it('tauschen die liegende Karte, wenn der Härtegrad wechselt', () => {
    const game = getLoadedGame('never-have-i-ever')!;
    const s = game.createState(players(4));
    const next = game.reduce(s, act('setHeat', 'p0', { heat: 1 }), players(4));
    expect(next.heat).toBe(1);
    expect(next.drawn.heat ?? 1).toBeLessThanOrEqual(1);
  });

  it('lassen eine aufgelöste Karte stehen, an der eine Ansage hängt', () => {
    const game = getLoadedGame('never-have-i-ever')!;
    const s = game.createState(players(4));
    const resolved = game.reduce(s, act('resolve', 'p0', {}), players(4));
    const next = game.reduce(resolved, act('setHeat', 'p0', { heat: 1 }), players(4));
    expect(next.drawn).toEqual(resolved.drawn);
    expect(next.heat).toBe(1);
  });
});

describe('Spicy-Modus', () => {
  const SPICY_GAMES = ['truth-or-dare', 'never-have-i-ever', 'chaos-roulette', 'kategorien'];

  afterEach(() => {
    useApp.setState({ spicy: {} });
  });

  it('ist genau bei den Spielen verfügbar, die dafür Inhalte haben', () => {
    for (const id of SPICY_GAMES) expect(getGame(id)?.allowSpicy, id).toBe(true);
    for (const id of ['kings-cup', 'busfahrer', 'duell', 'maexchen', 'tabu']) {
      expect(getGame(id)?.allowSpicy, id).toBeFalsy();
    }
  });

  it('lässt Spicy-Karten standardmäßig aus dem Stapel', () => {
    for (const id of SPICY_GAMES) {
      const game = getLoadedGame(id)!;
      const s = game.createState(players(4));
      const deck = [...s.deck, s.drawn].filter(Boolean);
      expect(deck.some((c: { spicy?: boolean }) => c.spicy), id).toBe(false);
    }
  });

  it('mischt sie ein, sobald der Schalter an ist – auf jeder Härtestufe', () => {
    // Alle Spicy-Karten tragen heat 3. Haengt Spicy am Haertefilter, sieht
    // niemand sie auf der Start-Haerte, und der Schalter tut sichtbar nichts.
    for (const id of SPICY_GAMES) {
      const game = getLoadedGame(id)!;
      useApp.setState({ spicy: { [id]: true } });
      for (const heat of [1, 2, 3]) {
        const s = game.createState(players(4));
        const withHeat = game.reduce(s, act('setHeat', 'p0', { heat }), players(4));
        const deck = [...withHeat.deck, withHeat.drawn].filter(Boolean);
        expect(deck.some((c: { spicy?: boolean }) => c.spicy), `${id} @ ${heat}`).toBe(true);
      }
      useApp.setState({ spicy: {} });
    }
  });

  it('gilt auch für Spiele mit eigenen Prompt-Listen', () => {
    for (const id of ['most-likely', 'meme-battle', 'top-ten']) {
      expect(getGame(id)?.allowSpicy, id).toBe(true);
      const game = getLoadedGame(id)!;
      const plain = game.createState(players(4));
      useApp.setState({ spicy: { [id]: true } });
      const withSpicy = game.createState(players(4));
      // Mit Spicy stehen mehr Karten im Stapel als ohne.
      expect(withSpicy.deck.length, id).toBeGreaterThan(plain.deck.length);
      useApp.setState({ spicy: {} });
    }
  });
});
