import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { kingsCup, RULES, seatSplit } from './index';
import { cardFromIndex, fullDeck } from '../shared/deck';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { useApp } from '../../store/app';
import { useSeen } from '../../store/seen';
import { usePlayer, defaultProfile } from '../../store/player';
import type { GameAction, GameActionInput, GamePlayer } from '../types';

type State = ReturnType<typeof kingsCup.createState>;

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
    expect(s.deck.length).toBe(51);
  });

  it('nimmt einen alten Königsstand nicht mit in einen frisch gemischten Stapel', () => {
    let s: State = { ...kingsCup.createState(roster), deck: [], drawn: null, kings: 3 };
    const act = (type: string): GameAction => ({ type, by: 'p0', at: Date.now() }) as GameAction;
    s = kingsCup.reduce(s, act('draw'), roster);
    // Frischer Stapel = frischer Becher: der Stand von der vorigen Runde
    // darf nicht in den neuen Stapel hinüberlaufen.
    const istKoenig = cardFromIndex(s.drawn!).rank === 12;
    expect(s.kings).toBe(istKoenig ? 1 : 0);
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
