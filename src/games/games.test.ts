import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { GAMES, gamesForGroup, getGame, getLoadedGame, loadGame } from './registry';
import { pairFor } from './duell/index';
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
 * Welche Felder es geben MUSS, prueft der Test „deckt jedes Feld ab" weiter
 * unten – er liest sie aus den Reducern und meldet jede Luecke. Vorher war
 * diese Liste handgepflegt und damit selbst der blinde Fleck: als Top Ten
 * `action.id` zu lesen begann, fand der Sackgassen-Test keinen Ausweg mehr
 * und meldete einen Fehler, den es nicht gab.
 *
 * BLINDER FLECK, der bleibt: die WERTE sind geraten, nur die NAMEN sind
 * abgeleitet. Ein
 * Reducer, der einen Wert ausserhalb dieser Auswahl verlangt, wird nur
 * unvollstaendig geprueft. Ein leerer Ausweg faellt dann als Sackgasse auf –
 * dann gehoert der Wert hierher, nicht die Pruefung entschaerft.
 */
const VARIANTS: Record<string, unknown>[] = [
  {
    text: 'Antwort', target: 'p1', mode: 'wahrheit', heat: 1, answer: 'rot',
    order: ['p1', 'p0'], winner: 'p1', value: 42, index: 0, side: 'left',
    lie: 0, statements: ['a', 'b', 'c'], id: 'p1', word: 'a', who: 'p1',
    counts: { p1: 1 }, guesses: { p1: 0 }, slot: 0,
  },
  {
    text: 'Zweite', target: 'p2', mode: 'pflicht', heat: 3, answer: 'hoch',
    order: ['p0', 'p1'], winner: 'p2', value: 7, index: 1, side: 'right',
    lie: 1, statements: ['x', 'y', 'z'], id: 'p2', word: 'b', who: 'p2',
    counts: { p2: 2 }, guesses: { p2: 1 }, slot: 31,
  },
  // Spielerbezuege ueber den GANZEN Kader, nicht nur p1/p2: Top Ten deckt
  // nacheinander jede Person auf und blieb mit zwei IDs nach zwei Schritten
  // stehen – der Sackgassen-Test meldete dann ein Spiel als kaputt, das es
  // nicht war.
  { id: 'p0', target: 'p0', winner: 'p0', who: 'p0', index: 0 },
  { id: 'p3', target: 'p3', winner: 'p3', who: 'p3', index: 3 },
  { id: 'p4', target: 'p4', winner: 'p4', who: 'p4', index: 4 },
  { rank: 0, value: 1, index: 2, answer: 'innen' },
  { rank: 14, value: 100, answer: 'tief' },
  { rank: 20, answer: '1' },
  { outcome: 'refused' },
  // Ring of Fire: der Finger waehlt einen Platz im Kranz. 51 prueft den Rand,
  // 200 einen Platz, den es gar nicht gibt.
  { slot: 51 },
  { slot: 200 },
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

/**
 * Welche Felder die Reducer aus `action` lesen – aus der Quelle, nicht
 * gepflegt. `by`, `at` und `type` traegt jede Aktion ohnehin.
 */
function readActionFields(): string[] {
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
      for (const m of readFileSync(full, 'utf8').matchAll(/action\.([a-zA-Z]+)/g)) {
        if (!['by', 'at', 'type'].includes(m[1])) namen.add(m[1]);
      }
    }
  };
  walk(root);
  return [...namen].sort();
}

/**
 * Personenbezuege aus dem KADER erzeugt, nicht geraten: ein Spiel mit neun
 * Personen braucht neun IDs. Eine feste Liste `p0`–`p4` liess den
 * Sackgassen-Test bei groesseren Runden ein gesundes Spiel als kaputt melden.
 */
function personVariants(roster: GamePlayer[]): Record<string, unknown>[] {
  return roster.map((p) => ({ id: p.id, target: p.id, winner: p.id, who: p.id }));
}

const variantsFor = (roster: GamePlayer[]) => [...VARIANTS, ...personVariants(roster)];

function hasEscape(
  game: { reduce: (s: unknown, a: GameAction, p: GamePlayer[]) => unknown },
  state: unknown,
  roster: GamePlayer[],
): boolean {
  for (const type of ACTION_TYPES) {
    if (ESCAPE_HATCHES.has(type)) continue;
    for (const extra of variantsFor(roster)) {
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
    // Auch am Minimum und bei grosser Runde: eine Sackgasse, die nur bei genau
    // drei Personen oder erst ab neun entsteht (etwa ein Modulo ueber
    // `order.length`), saehe ein Lauf mit fester Funferbesetzung strukturell nie.
    for (const g of DEFS) {
      for (const groesse of [3, 5, 9]) {
        const rot = groesse % VARIANTS.length;
        const roster = players(groesse);
        let state: unknown = g.createState(roster);
        expect(hasEscape(g, state, roster), `${g.id} / Start mit ${groesse}`).toBe(true);
        for (let i = 0; i < 120; i++) {
          let moved = false;
          for (let k = 0; k < ACTION_TYPES.length && !moved; k++) {
            const type = ACTION_TYPES[(i + k + rot) % ACTION_TYPES.length];
            if (ESCAPE_HATCHES.has(type)) continue;
            // Auch die Parameter durchrotieren: sonst wird `announce` immer
            // mit demselben Rang probiert und der Lauf erreicht nie den
            // Zustand „Maexchen steht", in dem die Sackgasse lag.
            const alle = variantsFor(roster);
            for (let v = 0; v < alle.length && !moved; v++) {
              const extra = alle[(i + rot + v) % alle.length];
              const by = roster[(i + k) % roster.length].id;
              const next = g.reduce(state, act(type, by, extra), roster);
              if (next !== state) {
                state = next;
                moved = true;
              }
            }
          }
          if (!moved || isFinished(state)) break;
          expect(hasEscape(g, state, roster), `${g.id} / ${groesse} Spieler, Schritt ${i}`).toBe(true);
        }
      }
    }
  });

  it('deckt jedes Feld ab, das ein Reducer aus der Aktion liest', () => {
    // Ohne diesen Test faellt eine fehlende Parametervariante als
    // „Sackgasse" auf – an einem Spiel, das gar keine hat. Genau das ist bei
    // Top Ten passiert, als es `action.id` zu lesen begann.
    const gelesen = readActionFields();
    // Nahe an der echten Zahl (heute 18): eine Regression, die die Haelfte der
    // Felder verliert - etwa weil ein Reducer kuenftig destrukturiert statt
    // `action.feld` zu schreiben -, bliebe bei einer Schranke von 8 gruen.
    expect(gelesen.length, 'zu wenige Aktionsfelder gefunden').toBeGreaterThan(15);
    const abgedeckt = new Set(VARIANTS.flatMap((v) => Object.keys(v)));
    const fehlend = gelesen.filter((f) => !abgedeckt.has(f));
    expect(fehlend, `Parametervarianten kennen diese Felder nicht: ${fehlend.join(', ')}`).toEqual(
      [],
    );
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
    // Nur „ohne Ende" zieht ueber den vierten Koenig hinaus weiter. Mit
    // Ziellinie ist dort Schluss, die Karte bleibt liegen und es wird bewusst
    // nicht mehr gezogen - der Test war ohne diese Unterscheidung flakig und
    // fiel genau dann, wenn der vierte Koenig spaet kam.
    const vorher = useApp.getState().gameLength;
    useApp.setState({ gameLength: 'endlos' });
    const roster = players(4);
    let s = game.createState(roster);
    useApp.setState({ gameLength: vorher });
    expect(s.endless, 'Partie laeuft nicht ohne Ende').toBe(true);
    for (let i = 0; i < 60; i++) {
      s = game.reduce(s, act('draw'), roster);
      s = game.reduce(s, act('next'), roster);
    }
    // NICHT `deck.length`: der Kranz hat fest 52 Plaetze, die
    // Laenge ist konstant und die Zusicherung waere trivial wahr - sie haette
    // den Neumisch-Pfad nicht mehr geprueft, egal was der Reducer tut.
    expect(s.deck.some((c: number | null) => c != null), 'Kranz leer statt neu gemischt').toBe(
      true,
    );
  });

  it('hört mit Ziellinie beim vierten König auf zu ziehen', () => {
    // Gegenstueck zum Test darueber: hier MUSS es stehenbleiben.
    const vorher = useApp.getState().gameLength;
    useApp.setState({ gameLength: 'mittel' });
    const roster = players(4);
    let s = game.createState(roster);
    useApp.setState({ gameLength: vorher });
    for (let i = 0; i < 60; i++) {
      s = game.reduce(s, act('draw'), roster);
      s = game.reduce(s, act('next'), roster);
    }
    expect(s.over, 'Partie endete nicht am vierten Koenig').toBe(true);
    expect(s.kings).toBe(4);
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

  it('geht nach allen Antworten ins Aufdecken', () => {
    // Frueher wurde still sortiert und am Ende alles auf einmal gezeigt. Jetzt
    // benennt der Kapitaen Person fuer Person, und ein Fehler wird in dem
    // Moment sichtbar, in dem er passiert – wie im Vorbild.
    const roster = players(4);
    let s = game.createState(roster);
    for (const p of roster) s = game.reduce(s, act('submit', p.id, { text: 'x' }), roster);
    expect(s.phase).toBe('revealing');
    expect(s.revealed).toEqual([]);
  });

  it('wechselt den Kapitaen in der naechsten Runde', () => {
    const roster = players(4);
    let s = game.createState(roster);
    const first = s.captainIndex;
    // Bis zur Auflösung spielen – vorher nimmt der Reducer kein 'next' an.
    for (const p of roster) s = game.reduce(s, act('submit', p.id, { text: 'x' }), roster);
    for (const p of roster) s = game.reduce(s, act('reveal', roster[first].id, { id: p.id }), roster);
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

  it('gibt dem enttarnten Undercover einen letzten Rateversuch', () => {
    // Frueher war mit dem Rauswurf sofort Schluss. Trifft er jetzt das Wort
    // der Gruppe, dreht die Runde noch – der Moment, den das Vorbild hat.
    const roster = players(5);
    let s = game.createState(roster);
    for (const p of roster) s = game.reduce(s, act('seen', p.id, { who: p.id }), roster);
    s = { ...s, phase: 'vote' };
    for (const p of roster) s = game.reduce(s, act('vote', p.id, { target: s.undercoverId }), roster);
    expect(s.phase).toBe('guess');
    expect(s.eliminated).toContain(s.undercoverId);
    expect(s.guessOptions).toContain(s.words[0]);

    const daneben = s.guessOptions.find((w: string) => w !== s.words[0])!;
    s = game.reduce(s, act('guess', s.undercoverId, { word: daneben }), roster);
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('gruppe');
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

  it('geht nach den Aussagen erst ins Verhör, nicht sofort ins Raten', () => {
    // Die Luege wird nicht mehr beim Schreiben markiert, sondern erst nach dem
    // Raten vom Autor aufgedeckt. Dadurch muss die App nie ein Geheimnis vor
    // der Runde verbergen – und das Spiel laeuft auf einem Handy.
    const roster = players(3);
    let s = game.createState(roster);
    const author = s.order[0];
    s = game.reduce(s, act('submit', author, { statements: ['wahr A', 'LUEGE', 'wahr B'] }), roster);
    // Zuerst legt sich der Autor unter vier Augen fest – erst danach das
    // Verhoer. Ohne diese Festlegung koennte er die Luege spaeter an die
    // Tipps anpassen und nie verlieren.
    expect(s.phase).toBe('commit');
    s = game.reduce(s, act('markLie', author, { index: 1 }), roster);
    expect(s.phase).toBe('interrogate');
    expect(s.statements).toHaveLength(3);
    for (let i = 0; i < roster.length - 1; i++) {
      s = game.reduce(s, act('nextQuestion', roster[i].id), roster);
    }
    expect(s.phase).toBe('guess');
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
    // Wer antritt, sagt der Spielplan – frueher waren es immer die Nachbarn
    // in `order`, weshalb bei 8 Personen jemand nie drankam.
    const [links, rechts] = pairFor(s.order, s.pairIndex);
    s = game.reduce(s, act('tap', 'p1', { side: 1 }), roster);
    expect(s.phase).toBe('result');
    expect(s.winner).toBe(rechts);
    expect(s.loser).toBe(links);
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
