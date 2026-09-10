import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { kingsCup, RULES, seatSplit } from './index';
import { slotAngle } from './geometrie';
import { cardFromIndex, fullDeck } from '../shared/deck';
import { shuffle } from '../../lib/format';
import { PartyCtx, decodeState, encodeState, type PartyValue } from '../../features/party/PartyContext';
import { useApp } from '../../store/app';
import { useSeen } from '../../store/seen';
import { usePlayer, defaultProfile } from '../../store/player';
import type { GameAction, GameActionInput, GamePlayer } from '../types';

type State = ReturnType<typeof kingsCup.createState>;

/** Karten, die noch im Kranz liegen. `deck` hat feste Plaetze mit Loechern. */
const uebrig = (s: State) => s.deck.filter((c) => c != null).length;

/**
 * Vier Personen an einem Gerät (Pass & Play) – genau das Szenario aus dem
 * Fehlerbericht. Jede Mitperson hat ein eigenes lokales Profil, sonst kann
 * `useSipsForPlayer` für sie keine Schluckzahl berechnen und jede Ansage
 * würde als "sieht seine Menge auf dem eigenen Handy" enden, egal an wen
 * sie eigentlich adressiert ist.
 */
const me: GamePlayer = { id: 'p0', name: 'Mira', color: 'blue', online: true };
const lokal = (id: string, name: string): GamePlayer => ({
  id,
  name,
  color: 'pink',
  online: true,
  local: { profile: { ...defaultProfile(), name }, drinkId: 'beer-pils', log: [] },
});
const ben = lokal('p1', 'Ben');
const cem = lokal('p2', 'Cem');
const dana = lokal('p3', 'Dana');
const roster: GamePlayer[] = [me, ben, cem, dana];

// Feste Sitzordnung fürs ganze Testfile: Ben zieht (turnIndex 0), Mira
// sitzt ihm gegenüber auf der rechten Seite, Dana links. Das ergibt sich
// aus seatSplit selbst (siehe eigener Test unten) und macht Rechts (Ben
// betrachtet) zum einzigen der 13 Fälle, in dem Mira legitim mittrinkt.
const ORDER = ['p1', 'p0', 'p2', 'p3'];

function party(logSipsFor: PartyValue['logSipsFor']): PartyValue {
  return {
    mode: 'local',
    code: null,
    status: 'playing',
    connection: 'online',
    error: null,
    players: roster,
    me,
    isHost: true,
    gameId: 'kings-cup',
    gameState: {},
    startedBy: 'p1',
    startedAt: 1000,
    createOnline: async () => '',
    joinOnline: async () => {},
    startLocal: () => {},
    leave: () => {},
    addLocalPlayer: () => {},
    updateLocalPlayer: () => {},
    removeLocalPlayer: () => {},
    startGame: async () => {},
    endGame: () => {},
    dispatch: () => {},
    logSipsFor,
  } as unknown as PartyValue;
}

/** Rendert eine bestimmte Karte (Rang = Kartenwert) mit fester Sitzordnung. */
function Harness({
  rank,
  logSipsFor,
  online = false,
}: {
  rank: number;
  logSipsFor: PartyValue['logSipsFor'];
  online?: boolean;
}) {
  const [state, setState] = useState<State>(() => ({
    ...kingsCup.createState(roster),
    order: ORDER,
    turnIndex: 0,
    drawn: rank,
    target: null,
  }));
  const dispatch = (a: GameActionInput) =>
    setState((s) => kingsCup.reduce(s, { ...a, by: me.id, at: Date.now() } as GameAction, roster));
  const Game = kingsCup.Component;
  return (
    <PartyCtx.Provider value={party(logSipsFor)}>
      <Game state={state} players={roster} me={me} isHost online={online} dispatch={dispatch} quit={() => {}} />
    </PartyCtx.Provider>
  );
}

beforeEach(() => {
  // Alle geteilten Stores zuruecksetzen, nicht nur eine Teilmenge: sonst
  // haengt das Ergebnis an der Reihenfolge der Tests.
  useSeen.setState({ seen: {}, cursor: 0 });
  useApp.setState({ gameLength: 'mittel', spicy: {}, taskOnSkip: 'aus' });
  usePlayer.setState({
    profile: { ...defaultProfile(), name: me.name },
    currentDrinkId: 'beer-pils',
    customDrinks: [],
    log: [],
  });
});

/** Alle sichtbaren, aktiven Trinken-bestätigen-Knöpfe antippen (volle und kompakte Form). */
function drinkAllVisible() {
  const buttons = [
    ...screen.queryAllByRole('button', { name: 'Getrunken' }),
    ...screen.queryAllByRole('button', { name: /hat getrunken$/ }),
  ];
  for (const b of buttons) fireEvent.click(b);
}

describe('Trinkansage trifft die richtige Person (alle 13 Regeln)', () => {
  it('schickt die Ansage nie an den Handybesitzer, wenn die Regel jemand anderen meint', () => {
    // Aus RULES erzeugt statt handgepflegt: eine feste Liste von Titeln wäre
    // selbst der blinde Fleck, den der Fehlerbericht schon einmal aufgedeckt
    // hat. Die Erwartung hängt an rule.drink (einer festen, kleinen Menge),
    // nicht an einzelnen Kartentiteln.
    expect(RULES.length, 'Ring of Fire hat 13 Karten je Farbe').toBe(13);

    for (let rank = 0; rank < RULES.length; rank++) {
      const rule = RULES[rank];
      const logSipsFor = vi.fn();
      const { unmount } = render(<Harness rank={rank} logSipsFor={logSipsFor} />);

      // 'pick'/'loser' brauchen erst eine Auswahl. Angetippt wird bewusst
      // weder der Handybesitzer (Mira) noch der Ziehende (Ben) – genau der
      // Fall "die Regel meint eine andere Person".
      if (rule.drink === 'pick' || rule.drink === 'loser') {
        fireEvent.click(screen.getByRole('button', { name: /Cem/ }));
      }
      drinkAllVisible();

      const angesagt = logSipsFor.mock.calls.map((call) => call[0]);
      const mirasSchluckeSindLegitim = rule.drink === 'all' || rule.drink === 'right';

      if (!mirasSchluckeSindLegitim) {
        expect(angesagt, `${rule.title}: Ansage ging an den Handybesitzer`).not.toContain('p0');
      }

      switch (rule.drink) {
        case 'all':
          expect(new Set(angesagt), rule.title).toEqual(new Set(['p0', 'p1', 'p2', 'p3']));
          break;
        case 'actor':
          // Ben hat gezogen – die Ansage muss ihn treffen, sonst wäre "nicht
          // an Mira" nur ein Nullsummenspiel, bei dem niemand mehr trinkt.
          expect(angesagt, rule.title).toEqual(['p1']);
          break;
        case 'pick':
        case 'loser':
          expect(angesagt, rule.title).toEqual(['p2']);
          break;
        case 'left':
          expect(angesagt, rule.title).toEqual(['p3']);
          break;
        case 'right':
          expect(new Set(angesagt), rule.title).toEqual(new Set(['p0', 'p2']));
          break;
        case 'none':
          // Reim/Kategorie/Regel/Fragemeister/König: niemand trinkt jetzt.
          expect(angesagt, rule.title).toEqual([]);
          break;
      }
      unmount();
    }
  });
});

describe('Zielauswahl (Du, Partner, Boden, Himmel)', () => {
  it('zeigt vor der Auswahl eine Personenauswahl statt einer Ansage', () => {
    render(<Harness rank={1} logSipsFor={vi.fn()} />); // Du
    expect(screen.queryByRole('button', { name: 'Getrunken' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Mira|Cem|Dana/ }).length).toBeGreaterThan(0);
    // Ben zieht selbst – "Du" zeigt auf eine ANDERE Person, er steht nicht zur Wahl.
    expect(screen.queryAllByRole('button', { name: /Ben/ })).toHaveLength(0);
  });

  it('sperrt "Nächster", bis eine Person benannt ist, und gibt danach frei', () => {
    render(<Harness rank={3} logSipsFor={vi.fn()} />); // Boden
    const weiter = () => screen.getByRole('button', { name: 'Nächster' });
    expect(weiter()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Cem/ }));
    expect(weiter()).toBeEnabled();
  });

  it('online darf nur das Gerät des Ziehenden für "Du" antippen', () => {
    // Mira ist nicht am Zug (Ben zieht) – online muss ihr Antippen wirkungslos bleiben.
    render(<Harness rank={1} logSipsFor={vi.fn()} online />); // Du
    const cemBtn = screen.getByRole('button', { name: /Cem/ }) as HTMLButtonElement;
    expect(cemBtn.disabled).toBe(true);
  });

  it('lässt bei "Boden" jedes Gerät antippen (offene Tatsache, kein Vorrecht)', () => {
    render(<Harness rank={3} logSipsFor={vi.fn()} online />); // Boden
    const cemBtn = screen.getByRole('button', { name: /Cem/ }) as HTMLButtonElement;
    expect(cemBtn.disabled).toBe(false);
  });

  it('ignoriert eine verspätete Auswahl, sobald die nächste Karte liegt', () => {
    // Phasenschutz wie bei den anderen Spielen: eine pickTarget-Aktion für
    // eine Karte, die nicht mehr liegt, darf nichts mehr anfassen.
    let s: State = { ...kingsCup.createState(roster), order: ORDER, turnIndex: 0, drawn: 1, target: null };
    const act = (type: string, extra: Record<string, unknown> = {}): GameAction =>
      ({ type, by: 'p0', at: Date.now(), ...extra }) as GameAction;
    s = kingsCup.reduce(s, act('next'), roster); // Karte weitergelegt, drawn/target zurückgesetzt
    const nachher = kingsCup.reduce(s, act('pickTarget', { target: 'p2' }), roster);
    expect(nachher.target).toBeNull();
  });
});

describe('Becher in der Mitte (vierter König)', () => {
  it('rechnet die Trinkansage beim vierten König dem Ziehenden zu', () => {
    let s: State = {
      ...kingsCup.createState(roster),
      order: ORDER,
      turnIndex: 0,
      kings: 3,
      drawn: null,
    };
    const act = (type: string, extra: Record<string, unknown> = {}): GameAction =>
      ({ type, by: 'p0', at: Date.now(), ...extra }) as GameAction;
    // Einen Stapel bauen, dessen naechste Karte sicher ein Koenig ist.
    s = { ...s, deck: [12, ...fullDeck().filter((i) => cardFromIndex(i).rank !== 12)] };
    s = kingsCup.reduce(s, act('draw'), roster);
    expect(s.finalKing).toBe(true);
    const logSipsFor = vi.fn();
    render(
      <PartyCtx.Provider value={party(logSipsFor)}>
        <kingsCup.Component
          state={s}
          players={roster}
          me={me}
          isHost
          online={false}
          dispatch={() => {}}
          quit={() => {}}
        />
      </PartyCtx.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Getrunken' }));
    // Die genaue Schluckzahl haengt an der Pegel-Berechnung (Koerperdaten,
    // Zielpromille) – hier zaehlt nur, WEM die Ansage gehoert: Ben, der den
    // vierten Koenig gezogen hat, nicht dem Handybesitzer Mira.
    expect(logSipsFor).toHaveBeenCalledTimes(1);
    expect(logSipsFor.mock.calls[0][0]).toBe('p1');
    expect(logSipsFor.mock.calls[0][2]).toBe('kings-cup');
  });

  it('mischt bei leerem Stapel sofort eine neue Karte, statt folgenlos zu bleiben', () => {
    let s: State = { ...kingsCup.createState(roster), deck: [], drawn: null };
    const act = (type: string): GameAction => ({ type, by: 'p0', at: Date.now() }) as GameAction;
    s = kingsCup.reduce(s, act('draw'), roster);
    // Vorher blieb `drawn` nach dem Reshuffle null – der Tap wirkte folgenlos.
    expect(s.drawn).not.toBeNull();
    // `deck` ist der Kranz und bleibt 52 Plaetze lang; gezaehlt wird, was noch
    // liegt.
    expect(uebrig(s)).toBe(51);
  });

  it('nimmt einen alten Königsstand nicht mit in einen frisch gemischten Stapel', () => {
    // Fester Zufall, damit die Pruefung beide Faelle sicher trifft statt am
    // Mischglueck zu haengen.
    const w = vi.spyOn(Math, 'random').mockReturnValue(0.42);
    try {
      const gemischt = shuffle(fullDeck(), () => 0.42);
      const basis: State = {
        ...kingsCup.createState(roster),
        deck: Array.from({ length: 52 }, () => null),
        drawn: null,
        kings: 3,
      };
      const act = (slot: number): GameAction =>
        ({ type: 'draw', slot, by: 'p0', at: Date.now() }) as GameAction;
      // Frischer Stapel = frischer Becher: der Stand von der vorigen Runde
      // darf nicht in den neuen Stapel hinüberlaufen.
      const koenig = gemischt.findIndex((i) => cardFromIndex(i).rank === 12);
      expect(kingsCup.reduce(basis, act(koenig), roster).kings).toBe(1);
      const rest = gemischt.findIndex((i) => cardFromIndex(i).rank !== 12);
      expect(kingsCup.reduce(basis, act(rest), roster).kings).toBe(0);
    } finally {
      w.mockRestore();
    }
  });
});

describe('seatSplit', () => {
  it('teilt alle anderen Spieler auf, niemand fehlt und niemand kommt doppelt vor', () => {
    for (const n of [3, 4, 5, 6, 7]) {
      const order = Array.from({ length: n }, (_, i) => `s${i}`);
      const { left, right } = seatSplit(order, 's0');
      const alle = [...left, ...right];
      expect(alle, `n=${n}`).not.toContain('s0');
      expect(new Set(alle).size, `n=${n}: Duplikat`).toBe(n - 1);
      expect(alle.length, `n=${n}: jemand fehlt`).toBe(n - 1);
    }
  });

  it('gibt bei drei Spielern je einen linken und einen rechten Nachbarn', () => {
    // Realer Dreierkreis: jede Person hat genau einen Nachbarn je Seite.
    expect(seatSplit(['a', 'b', 'c'], 'a')).toEqual({ left: ['c'], right: ['b'] });
  });
});

describe('Zwei fast gleichzeitige Taps', () => {
  /** Aktion direkt in den Reducer, wie die Inbox sie nacheinander anwendet. */
  type KcState = ReturnType<typeof kingsCup.createState>;
  const tun = (state: KcState, type: string, extra: Record<string, unknown> = {}) =>
    kingsCup.reduce(state, { type, by: me.id, at: Date.now(), ...extra } as never, roster);

  it('zieht nicht zweimal, bevor die Karte weggelegt ist', () => {
    // Der Knopf „Karte ziehen" verschwindet erst mit dem naechsten Rendern.
    // Ohne Phasenschutz ueberschriebe der zweite Tap die erste Karte – und
    // berechnete `finalKing` neu aus sich selbst. War die erste der vierte
    // Koenig, waere der Becher-Moment lautlos verschwunden.
    let s = kingsCup.createState(roster);
    s = tun(s, 'draw');
    const ersteKarte = s.drawn;
    const nachZweitem = tun(s, 'draw');
    expect(nachZweitem).toBe(s);
    expect(nachZweitem.drawn).toBe(ersteKarte);
  });

  it('zieht auch bei zwei Taps auf VERSCHIEDENE Plaetze nur einmal', () => {
    // Neu mit dem Kranz: der zweite Tap traegt einen anderen Platz. Ohne
    // Phasenschutz zoege er eine zweite Karte aus einem anderen Loch.
    let s = kingsCup.createState(roster);
    s = tun(s, 'draw', { slot: 4 });
    const nachZweitem = tun(s, 'draw', { slot: 31 });
    expect(nachZweitem).toBe(s);
    expect(uebrig(nachZweitem)).toBe(51);
  });

  it('zieht aus dem Platz, den der Finger gewaehlt hat', () => {
    const s = kingsCup.createState(roster);
    const erwartet = s.deck[31];
    const nachher = tun(s, 'draw', { slot: 31 });
    expect(nachher.drawn).toBe(erwartet);
    expect(nachher.deck[31]).toBeNull();
    // Die Luecke steht dort und NUR dort.
    expect(uebrig(nachher)).toBe(51);
  });

  it('faellt auf den naechsten belegten Platz, wenn die Aktion auf ein Loch zeigt', () => {
    // Online kann eine verspaetete Aktion einen Platz nennen, der schon leer
    // ist. Ohne Rueckfall zoege sie `undefined`.
    let s = kingsCup.createState(roster);
    s = tun(s, 'draw', { slot: 12 });
    s = tun(s, 'next');
    const nachher = tun(s, 'draw', { slot: 12 });
    expect(nachher.drawn).not.toBeNull();
    expect(uebrig(nachher)).toBe(50);
  });

  it('überspringt niemanden, wenn zweimal weitergetippt wird', () => {
    let s = kingsCup.createState(roster);
    s = tun(s, 'draw');
    const vorher = s.turnIndex;
    s = tun(s, 'next');
    const nachEinem = s.turnIndex;
    const nachZweitem = tun(s, 'next');
    expect(nachEinem, 'ein Tap muss weiterzaehlen').toBe((vorher + 1) % roster.length);
    expect(nachZweitem.turnIndex, 'zwei Taps zaehlten zwei Runden').toBe(nachEinem);
  });
});

/**
 * Zwei Zustaende, ein Bildschirm. BEIDE werden hier gezeichnet: ein Test, der
 * nur eine Phase rendert, fuehrt die Effekte der anderen nie aus - genau so
 * blieben in der Wortbombe zwei echte Fehler gruen.
 */
describe('Zwei Zustaende: Tisch und Karte', () => {
  const FELD = 340;
  beforeEach(() => {
    HTMLElement.prototype.setPointerCapture = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0, y: 0, left: 0, top: 0, right: FELD, bottom: FELD,
        width: FELD, height: FELD, toJSON: () => ({}),
      }),
    });
  });
  afterEach(() => Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect'));

  const zeichne = (s: State, dispatch = vi.fn()) => {
    render(
      <PartyCtx.Provider value={party(vi.fn())}>
        <kingsCup.Component
          state={s}
          players={roster}
          me={me}
          isHost
          online={false}
          dispatch={dispatch}
          quit={() => {}}
        />
      </PartyCtx.Provider>,
    );
    return dispatch;
  };

  it('zeigt ohne liegende Karte den Tisch und keine Karte', () => {
    zeichne({ ...kingsCup.createState(roster), order: ORDER, turnIndex: 0, drawn: null });
    expect(document.querySelector('.kranz')).not.toBeNull();
    expect(document.querySelectorAll('.kranz__karte').length).toBe(52);
    expect(document.querySelector('.playcard')).toBeNull();
  });

  it('klappt den Tisch weg, sobald eine Karte liegt', () => {
    const s = kingsCup.reduce(
      { ...kingsCup.createState(roster), order: ORDER, turnIndex: 0 },
      { type: 'draw', slot: 9, by: 'p1', at: Date.now() } as GameAction,
      roster,
    );
    zeichne(s);
    expect(document.querySelector('.kranz')).toBeNull();
    expect(document.querySelector('.playcard')).not.toBeNull();
  });

  it('schickt beim Ziehen den Platz mit, aus dem der Finger gezogen hat', () => {
    const dispatch = zeichne({
      ...kingsCup.createState(roster), order: ORDER, turnIndex: 0, drawn: null,
    });
    const feld = document.querySelector('.kranz') as HTMLElement;
    const bogen = (slotAngle(21) * Math.PI) / 180;
    const pos = {
      clientX: FELD / 2 + Math.sin(bogen) * 149,
      clientY: FELD / 2 - Math.cos(bogen) * 149,
    };
    fireEvent.pointerDown(feld, { pointerId: 1, ...pos });
    fireEvent.pointerUp(feld, { pointerId: 1, ...pos });
    expect(dispatch).toHaveBeenCalledWith({ type: 'draw', slot: 21 });
  });

  it('misst den Flug, statt ihn zu raten', () => {
    // Der Flug startet dort, wo die Karte im Kranz lag. Gemessen wird beim
    // Zustandswechsel, weil Kranzmitte und Kartenzeile rund 90 px
    // auseinanderliegen - eine geratene Weite laesst die Karte daneben landen.
    const dispatch = vi.fn();
    const props = (s2: State) => (
      <PartyCtx.Provider value={party(vi.fn())}>
        <kingsCup.Component
          state={s2}
          players={roster} me={me} isHost online={false} dispatch={dispatch} quit={() => {}}
        />
      </PartyCtx.Provider>
    );
    const tisch: State = {
      ...kingsCup.createState(roster), order: ORDER, turnIndex: 0, drawn: null,
    };
    const { rerender } = render(props(tisch));
    const feld = document.querySelector('.kranz') as HTMLElement;
    const bogen = (slotAngle(13, 52) * Math.PI) / 180;
    const pos = {
      clientX: FELD / 2 + Math.sin(bogen) * 149,
      clientY: FELD / 2 - Math.cos(bogen) * 149,
    };
    fireEvent.pointerDown(feld, { pointerId: 1, ...pos });
    fireEvent.pointerUp(feld, { pointerId: 1, ...pos });
    expect(dispatch).toHaveBeenCalledWith({ type: 'draw', slot: 13 });

    // MIT DERSELBEN Requisite erneut zeichnen, nicht abbauen: `rerender(<div/>)`
    // waere kein zweiter Durchlauf, sondern das Ende.
    const gezogen = kingsCup.reduce(
      tisch,
      { type: 'draw', slot: 13, by: 'p1', at: Date.now() } as GameAction,
      roster,
    );
    rerender(props(gezogen));
    const flug = document.querySelector('.kings-zug') as HTMLElement;
    expect(flug).not.toBeNull();
    expect(flug.classList.contains('kings-zug--los')).toBe(true);
    expect(flug.style.getPropertyValue('--zug-s')).not.toBe('');
    // Die echte Rueckseite liegt waehrend der Fahrt darueber.
    expect(flug.querySelector('.kings-zug__ruecken .playcard--back')).not.toBeNull();
  });

  it('laesst gar nichts fliegen, wenn niemand hier gezogen hat', () => {
    // Der Fall auf fremden Geraeten: ohne Messwert waere jeder Startpunkt
    // geraten, und die Karte kaeme aus einem Platz, den dieser Finger nie
    // beruehrt hat.
    const gezogen = kingsCup.reduce(
      { ...kingsCup.createState(roster), order: ORDER, turnIndex: 0 },
      { type: 'draw', slot: 44, by: 'p1', at: Date.now() } as GameAction,
      roster,
    );
    zeichne(gezogen);
    const flug = document.querySelector('.kings-zug') as HTMLElement;
    expect(flug.classList.contains('kings-zug--los')).toBe(false);
  });

  it('stellt den Becher neben die Koenigskarte', () => {
    // Vorher klappte der Tisch samt Becher weg - „Du trinkst den Becher"
    // stand auf einem Bildschirm ohne Becher.
    const koenig = fullDeck().find((i) => cardFromIndex(i).rank === 12)!;
    const s2: State = {
      ...kingsCup.createState(roster), order: ORDER, turnIndex: 0,
      drawn: koenig, kings: 3, pours: ['p1', 'p0'],
    };
    zeichne(s2);
    expect(document.querySelector('.bechertisch')).not.toBeNull();
    expect(document.querySelectorAll('.bechertisch .becher__guss').length).toBe(2);
  });

  it('zeigt die Zahlen erst, wenn Kranz und Becher weg sind', () => {
    const tisch: State = {
      ...kingsCup.createState(roster), order: ORDER, turnIndex: 0, drawn: null,
    };
    const { unmount } = render(
      <PartyCtx.Provider value={party(vi.fn())}>
        <kingsCup.Component
          state={tisch} players={roster} me={me} isHost online={false}
          dispatch={vi.fn()} quit={() => {}}
        />
      </PartyCtx.Provider>,
    );
    expect(document.body.textContent).not.toMatch(/\d+ Karten/);
    unmount();
    const gezogen = kingsCup.reduce(
      tisch,
      { type: 'draw', slot: 3, by: 'p1', at: Date.now() } as GameAction,
      roster,
    );
    zeichne(gezogen);
    expect(document.body.textContent).toMatch(/51 Karten/);
  });
});

/**
 * Der Becher in der Mitte: drei Guesse, nicht vier. Koenig 1 bis 3 giessen,
 * der vierte trinkt.
 */
describe('Becher: die Schichten', () => {
  const KOENIG = 12;
  const tun = (s: State, type: string, extra: Record<string, unknown> = {}) =>
    kingsCup.reduce(s, { type, by: 'p1', at: Date.now(), ...extra } as GameAction, roster);
  /** Kranz, dessen Platz 0 sicher ein Koenig ist. */
  const mitKoenig = (s: State): State => ({
    ...s,
    deck: [
      fullDeck().find((i) => cardFromIndex(i).rank === KOENIG)!,
      ...fullDeck().filter((i) => cardFromIndex(i).rank !== KOENIG).slice(0, 51),
    ],
  });

  it('legt bei Koenig 1 bis 3 je eine Schicht, beim vierten keine mehr', () => {
    let s: State = { ...kingsCup.createState(roster), order: ORDER, turnIndex: 0 };
    // Aus der Quelle gezaehlt: vier Koenige, drei davon giessen.
    for (const nr of [1, 2, 3, 4]) {
      s = tun(mitKoenig(s), 'draw', { slot: 0 });
      expect(s.kings, `Koenig ${nr}`).toBe(nr);
      expect(s.pours.length, `nach Koenig ${nr}`).toBe(Math.min(nr, 3));
      if (nr === 4) expect(s.finalKing).toBe(true);
      s = tun({ ...s, endless: true }, 'next');
    }
  });

  it('merkt sich, WER gegossen hat, nicht wie viel', () => {
    let s: State = { ...kingsCup.createState(roster), order: ORDER, turnIndex: 0 };
    s = tun(mitKoenig(s), 'draw', { slot: 0 });
    expect(s.pours).toEqual(['p1']);
    s = tun(s, 'next');
    // Jetzt ist p0 dran (ORDER = p1, p0, ...).
    s = tun(mitKoenig(s), 'draw', { slot: 0 });
    expect(s.pours).toEqual(['p1', 'p0']);
  });

  it('leert den Becher, wenn der vierte Koenig ihn ausgetrunken hat', () => {
    let s: State = {
      ...kingsCup.createState(roster),
      order: ORDER,
      turnIndex: 0,
      kings: 3,
      pours: ['p1', 'p0', 'p2'],
      endless: true,
    };
    s = tun(mitKoenig(s), 'draw', { slot: 0 });
    expect(s.finalKing).toBe(true);
    // Erst beim Weitergehen ist er ausgetrunken – vorher steht er noch voll da.
    expect(s.pours.length).toBe(3);
    s = tun(s, 'next');
    expect(s.pours).toEqual([]);
    expect(s.kings).toBe(0);
  });

  it('nimmt alte Schichten nicht in einen frisch gemischten Kranz mit', () => {
    // Deterministisch: mit festem Zufall mischt der Reducer denselben Kranz,
    // den der Test selbst berechnet. Sonst haengt die Pruefung am Mischglueck
    // – ein Koenig liegt nur in 4 von 52 Zuegen oben, und der Fehler waere in
    // den meisten Laeufen gruen durchgerutscht.
    const w = vi.spyOn(Math, 'random').mockReturnValue(0.42);
    try {
      const gemischt = shuffle(fullDeck(), () => 0.42);
      const koenigsPlatz = gemischt.findIndex((i) => cardFromIndex(i).rank === KOENIG);
      const s: State = {
        ...kingsCup.createState(roster),
        // Sitzordnung festnageln: `createState` mischt sie, und wer giesst,
        // steht auf `turnIndex`.
        order: ORDER,
        turnIndex: 0,
        deck: Array.from({ length: 52 }, () => null),
        drawn: null,
        kings: 3,
        pours: ['p1', 'p0', 'p2'],
      };
      // Erst der Koenig: giesst er, darf trotzdem nur SEINE Schicht dastehen.
      const mitKoenigGezogen = tun(s, 'draw', { slot: koenigsPlatz });
      expect(cardFromIndex(mitKoenigGezogen.drawn!).rank).toBe(KOENIG);
      expect(mitKoenigGezogen.pours).toEqual([ORDER[0]]);
      // Und ohne Koenig bleibt der Becher leer.
      const andererPlatz = gemischt.findIndex((i) => cardFromIndex(i).rank !== KOENIG);
      expect(tun(s, 'draw', { slot: andererPlatz }).pours).toEqual([]);
    } finally {
      w.mockRestore();
    }
  });

  it('vergisst die Schichten beim Neustart', () => {
    const s: State = { ...kingsCup.createState(roster), pours: ['p1', 'p0'] };
    expect(tun(s, 'restart').pours).toEqual([]);
  });
});

/**
 * Was ein Kartenstapel vergisst, sobald die Karte weiterwandert: die
 * erfundene Regel und wer Fragemeister ist. Beides steht deshalb im
 * Zustand und nicht nur im Kartentext.
 */
describe('Merkzettel: Regel und Fragemeister', () => {
  const RULE_RANK = RULES.findIndex((r) => r.title === 'Regel');
  const MASTER_RANK = RULES.findIndex((r) => r.title === 'Fragemeister');
  const karte = (rank: number) => fullDeck().find((i) => cardFromIndex(i).rank === rank)!;
  const tun = (s: State, type: string, extra: Record<string, unknown> = {}) =>
    kingsCup.reduce(s, { type, by: 'p1', at: Date.now(), ...extra } as GameAction, roster);
  // Ben (p1) zieht: turnIndex 0 auf der festen Sitzordnung dieses Files.
  const basis = (): State => ({ ...kingsCup.createState(roster), order: ORDER, turnIndex: 0 });

  it('findet beide Karten in der Regelliste', () => {
    // Die Raenge werden aus RULES abgeleitet. Fände `findIndex` nichts, wäre
    // es -1 und jede folgende Prüfung liefe ins Leere, ohne rot zu werden.
    expect(RULE_RANK).toBeGreaterThanOrEqual(0);
    expect(MASTER_RANK).toBeGreaterThanOrEqual(0);
  });

  it('merkt sich die erfundene Regel samt Urheber', () => {
    const s = tun({ ...basis(), drawn: karte(RULE_RANK) }, 'setRule', { text: 'Keine Namen' });
    expect(s.rules).toEqual([{ by: 'p1', text: 'Keine Namen' }]);
  });

  it('behält sie über die nächsten Züge', () => {
    let s = tun({ ...basis(), drawn: karte(RULE_RANK) }, 'setRule', { text: 'Keine Namen' });
    s = tun(s, 'next');
    s = tun(s, 'draw');
    expect(s.rules).toHaveLength(1);
  });

  it('überschreibt statt zu doppeln, wenn zweimal getippt wird', () => {
    // Die Inbox wendet Aktionen nacheinander an: zwei fast gleichzeitige Taps
    // legten sonst zweimal eine Regel zur selben Karte an.
    let s = tun({ ...basis(), drawn: karte(RULE_RANK) }, 'setRule', { text: 'Erst so' });
    s = tun(s, 'setRule', { text: 'Doch anders' });
    expect(s.rules).toEqual([{ by: 'p1', text: 'Doch anders' }]);
  });

  it('legt zur nächsten Regel-Karte eine zweite an', () => {
    let s = tun({ ...basis(), drawn: karte(RULE_RANK) }, 'setRule', { text: 'Keine Namen' });
    s = tun(s, 'next');
    s = tun({ ...s, drawn: karte(RULE_RANK) }, 'setRule', { text: 'Links trinken' });
    expect(s.rules.map((r) => r.text)).toEqual(['Keine Namen', 'Links trinken']);
  });

  it('nimmt keine Regel an, wenn gar keine Karte liegt', () => {
    const s = tun(basis(), 'setRule', { text: 'Zu spät' });
    expect(s.rules).toEqual([]);
  });

  it('nimmt keine Regel an, wenn eine andere Karte liegt', () => {
    const andere = karte(RULE_RANK === 0 ? 1 : 0);
    const s = tun({ ...basis(), drawn: andere }, 'setRule', { text: 'Falsche Karte' });
    expect(s.rules).toEqual([]);
  });

  it('ignoriert leeren Text', () => {
    const s = tun({ ...basis(), drawn: karte(RULE_RANK) }, 'setRule', { text: '   ' });
    expect(s.rules).toEqual([]);
  });

  it('behält höchstens vier Regeln', () => {
    // Mehr verdrängen die Karte vom Schirm.
    // Ueber `next` statt `ruleOpen` von Hand: sonst bliebe dieser Test gruen,
    // wenn `next` den Ruecksetzer verloere.
    let s = basis();
    for (const text of ['eins', 'zwei', 'drei', 'vier', 'fünf']) {
      s = tun({ ...s, drawn: karte(RULE_RANK) }, 'setRule', { text });
      s = tun(s, 'next');
    }
    expect(s.rules.map((r) => r.text)).toEqual(['zwei', 'drei', 'vier', 'fünf']);
  });

  it('kürzt zu langen Text nach Zeichen, nicht nach Code-Einheiten', () => {
    // Ueber die Lobby kommt beliebiger Text, das Eingabefeld schuetzt nur das
    // eigene Geraet. `slice` wuerde ein Emoji an der Grenze halbieren.
    const lang = 'a'.repeat(58) + '🍺🍺';
    const s = tun({ ...basis(), drawn: karte(RULE_RANK) }, 'setRule', { text: lang });
    expect(Array.from(s.rules[0].text)).toHaveLength(60);
    expect(s.rules[0].text.endsWith('🍺')).toBe(true);
  });

  it('macht aus Zeilenumbrüchen einfache Leerzeichen', () => {
    // Ein Umbruch bricht den Chip auf; `trim` entfernt nur aussen.
    const s = tun({ ...basis(), drawn: karte(RULE_RANK) }, 'setRule', {
      text: 'Erste\n\nZeile   zwei',
    });
    expect(s.rules[0].text).toBe('Erste Zeile zwei');
  });

  it('räumt den Fragemeister weg, wenn die Person die Runde verlässt', () => {
    // Sonst bleibt eine tote Kennung im Zustand: die Oberflaeche blendet den
    // Streifen still aus, der Zustand luegt.
    let s = tun({ ...basis(), deck: [karte(MASTER_RANK), ...fullDeck()] }, 'draw');
    expect(s.questionMaster).toBe('p1');
    const ohneBen = roster.filter((p) => p.id !== 'p1');
    s = kingsCup.reduce(s, { type: 'next', by: 'p0', at: Date.now() } as GameAction, ohneBen);
    expect(s.questionMaster).toBeNull();
  });

  it('vergisst Merkzettel und Fragemeister beim Neustart', () => {
    let s = tun({ ...basis(), drawn: karte(RULE_RANK) }, 'setRule', { text: 'Keine Namen' });
    s = { ...s, questionMaster: 'p1' };
    s = tun(s, 'restart');
    expect(s.rules).toEqual([]);
    expect(s.questionMaster).toBeNull();
  });

  it('übersteht den Weg durch die Lobby mit gefülltem Merkzettel', () => {
    // Der Rundlauf-Test in games.test.ts schickt nur den FRISCHEN Zustand
    // durch - ein gefuellter Merkzettel war nie geprueft.
    let s = tun({ ...basis(), drawn: karte(RULE_RANK) }, 'setRule', { text: 'Keine Namen' });
    s = { ...s, questionMaster: 'p1' };
    const zurueck = decodeState(encodeState(s)) as State;
    expect(zurueck.rules).toEqual(s.rules);
    expect(zurueck.questionMaster).toBe('p1');
  });

  it('macht den Ziehenden zum Fragemeister und löst ihn mit der nächsten Dame ab', () => {
    let s = tun({ ...basis(), deck: [karte(MASTER_RANK), ...fullDeck()] }, 'draw');
    expect(s.questionMaster).toBe('p1');
    s = tun(s, 'next');
    // Weiter im Kreis: jetzt zieht Mira (p0).
    s = tun({ ...s, deck: [karte(MASTER_RANK), ...s.deck] }, 'draw');
    expect(s.questionMaster).toBe('p0');
  });

  it('lässt den Fragemeister stehen, solange keine Dame kommt', () => {
    let s = tun({ ...basis(), deck: [karte(MASTER_RANK), ...fullDeck()] }, 'draw');
    s = tun(s, 'next');
    const andere = karte(MASTER_RANK === 0 ? 1 : 0);
    s = tun({ ...s, deck: [andere, ...s.deck] }, 'draw');
    expect(s.questionMaster).toBe('p1');
  });
});
