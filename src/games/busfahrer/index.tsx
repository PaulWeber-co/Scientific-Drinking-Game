import type { ReactNode } from 'react';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import { sound } from '../../lib/sound';
import { shuffle } from '../../lib/format';
import { cardFromIndex, cardValue, fullDeck, isRed, RANKS, SUIT_ICONS, SUIT_NAMES } from '../shared/deck';
import { PlayingCard } from '../shared/PlayingCard';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { DrinkCall } from '../shared/DrinkCall';
import { BigCard, PlayerChip, VoteGrid } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { meta } from './meta';

const QUESTIONS: { q: string; options: { id: string; label: ReactNode }[] }[] = [
  {
    q: 'Rot oder Schwarz?',
    options: [
      { id: 'rot', label: <><span className="suitdot suitdot--red" /> Rot</> },
      { id: 'schwarz', label: <><span className="suitdot suitdot--black" /> Schwarz</> },
    ],
  },
  {
    q: 'Höher oder tiefer?',
    options: [
      { id: 'hoch', label: <><Icon name="arrowUp" size={19} /> Höher</> },
      { id: 'tief', label: <><Icon name="arrowDown" size={19} /> Tiefer</> },
    ],
  },
  {
    q: 'Dazwischen oder außerhalb?',
    options: [
      { id: 'innen', label: <><Icon name="brackets" size={19} /> Dazwischen</> },
      { id: 'außen', label: <><Icon name="outward" size={19} /> Außerhalb</> },
    ],
  },
  {
    q: 'Welche Farbe?',
    options: SUIT_ICONS.map((icon, i) => ({
      id: String(i),
      label: (
        <span className={i === 1 || i === 2 ? 'suit-red' : undefined}>
          <Icon name={icon} size={22} title={SUIT_NAMES[i]} />
        </span>
      ),
    })),
  },
];

/** Strafschlucke für aufgedeckte Bildkarten auf der Busfahrt. */
const BUS_PENALTY: Record<number, number> = { 10: 2, 11: 3, 12: 4, 0: 5 }; // Bube, Dame, König, Ass

/**
 * Die Pyramide, deutsche Fassung: vier Reihen von unten nach oben, die
 * unterste ist einen Schluck wert, die Spitze vier. Belege und die
 * amerikanische Variante mit fünf Reihen:
 * `shared/spiele-vorbilder/recherche-spiele-busfahrer.md`, Abschnitt 3.
 */
const PYRAMID_ROWS = [4, 3, 2, 1];
const PYRAMID_SIZE = PYRAMID_ROWS.reduce((a, b) => a + b, 0);

/** Reihe einer Pyramidenkarte: 0 = unterste (1 Schluck), 3 = Spitze (4). */
function rowOf(i: number): number {
  let bis = 0;
  for (let r = 0; r < PYRAMID_ROWS.length; r++) {
    bis += PYRAMID_ROWS[r];
    if (i < bis) return r;
  }
  return PYRAMID_ROWS.length - 1;
}

/** Was eine Reihe wert ist. Unten eins, oben vier. */
const rowSips = (row: number) => row + 1;

/** Die Indizes einer Reihe, von unten gezählt. */
function rowIndices(row: number): number[] {
  const von = PYRAMID_ROWS.slice(0, row).reduce((a, b) => a + b, 0);
  return Array.from({ length: PYRAMID_ROWS[row] }, (_, k) => von + k);
}

/** Fragerunde, Pyramide und Busfahrt dauern; drei Durchgänge sind genug. */
const ROUND_BASE = baseFor('busfahrer');

/**
 * Ein Zug in der Pyramide, Schritt für Schritt:
 *
 * `flip`    – die unterste noch verdeckte Karte wird aufgedeckt.
 * `claim`   – wer eine passende Karte hat (oder so tut), meldet sich.
 * `pick`    – der Meldende sieht seine Hand und legt eine Karte verdeckt ab.
 * `doubt`   – die anderen entscheiden: glauben oder aufdecken lassen.
 * `give`    – geglaubt: der Meldende bestimmt, wer die Schlucke trinkt.
 * `gave`    – und die Ansage dazu. Ohne diesen Schritt tränke im häufigsten
 *             Fall des Spiels niemand: eine Auswahl ist keine Aufforderung.
 * `penalty` – gezweifelt: der Lügner oder der Zweifler trinkt doppelt.
 */
type PyStep = 'flip' | 'claim' | 'pick' | 'doubt' | 'give' | 'gave' | 'penalty';

interface State {
  order: string[];
  /** `done` beendet die Busfahrt, `over` die Partie. */
  phase: 'questions' | 'pyramid' | 'bus' | 'done' | 'over';
  playerIndex: number;
  qIndex: number;
  /** Die Karten der Person, die gerade rät. */
  hand: number[];
  /** Nach der Fragerunde: was jede Person auf der Hand behält. */
  hands: Record<string, number[]>;
  deck: number[];
  mistakes: Record<string, number>;
  lastResult: { correct: boolean; card: number; sips: number } | null;

  /** Die zehn Pyramidenkarten, Index 0 = unten links, 9 = Spitze. */
  pyramid: number[];
  /** Wie viele davon offen liegen. */
  pyUp: number;
  pyStep: PyStep;
  pyClaimBy: string | null;
  /** Welche Handkarte abgelegt wurde – erst beim Zweifeln aufgedeckt. */
  pyClaimCard: number | null;
  pyDoubtBy: string | null;
  /** Wem der Meldende die Schlucke der Reihe zugeteilt hat. */
  pyGiveTo: string | null;

  driverId: string | null;
  busDeck: number[];
  busPos: number;
  busRow: (number | null)[];
  busPenalty: number;
  busAttempts: number;
  round: number;
  /** Rundenzahl, nach der Schluss ist. `null` = ohne Ende. */
  goal: number | null;
  /** Wie oft jemand den Bus fahren musste – die Bilanz am Ende. */
  drives: Record<string, number>;
}

const BUS_LENGTH = 5;

/**
 * Passt die abgelegte Karte wirklich auf die offene Pyramidenkarte?
 *
 * Wird BERECHNET und nicht im Zustand gehalten. Als Feld stand die Antwort
 * im geteilten Zustand, sobald jemand ablegte – und der Zweifel, um den das
 * ganze Spiel geht, wäre für jeden ablesbar gewesen, der mitliest.
 */
function claimPasst(state: State): boolean {
  if (state.pyClaimCard === null || state.pyUp < 1) return false;
  const offen = state.pyramid[state.pyUp - 1];
  return cardFromIndex(state.pyClaimCard).rank === cardFromIndex(offen).rank;
}

/** Wer die meisten Karten hält, fährt. Gleichstand entscheidet die
 *  Fragerunde: mehr Fehler, mehr Pech. */
function pickDriver(state: State): string | null {
  const sorted = [...state.order].sort((a, b) => {
    const karten = (state.hands[b]?.length ?? 0) - (state.hands[a]?.length ?? 0);
    if (karten !== 0) return karten;
    return (state.mistakes[b] ?? 0) - (state.mistakes[a] ?? 0);
  });
  return sorted[0] ?? null;
}

/** Nach einer abgehandelten Pyramidenkarte: weiter oder ab auf den Bus. */
function afterPyramidCard(state: State): State {
  const basis = {
    ...state,
    pyStep: 'flip' as PyStep,
    pyClaimBy: null,
    pyClaimCard: null,
    pyDoubtBy: null,
    pyGiveTo: null,
  };
  if (state.pyUp < PYRAMID_SIZE) return basis;
  const driverId = pickDriver(basis);
  return {
    ...basis,
    phase: 'bus',
    driverId,
    drives: driverId
      ? { ...basis.drives, [driverId]: (basis.drives[driverId] ?? 0) + 1 }
      : basis.drives,
    busDeck: shuffle(fullDeck()),
    busPos: 0,
    busRow: Array(BUS_LENGTH).fill(null),
    busPenalty: 0,
    busAttempts: 1,
  };
}

export const busfahrer: GameDefinition<State> = {
  ...meta,

  createState: (players) => {
    const deck = shuffle(fullDeck());
    return {
      order: shuffle(players.map((p) => p.id)),
      phase: 'questions',
      playerIndex: 0,
      qIndex: 0,
      hand: [],
      hands: Object.fromEntries(players.map((p) => [p.id, []])),
      // Die Pyramide wird aus demselben Stapel gelegt wie die Fragerunde,
      // damit keine Karte doppelt im Spiel ist: sonst könnte jemand eine
      // Zehn ablegen, die oben in der Pyramide noch einmal auftaucht.
      deck: deck.slice(PYRAMID_SIZE),
      pyramid: deck.slice(0, PYRAMID_SIZE),
      pyUp: 0,
      pyStep: 'flip',
      pyClaimBy: null,
      pyClaimCard: null,
      pyDoubtBy: null,
      pyGiveTo: null,
      mistakes: Object.fromEntries(players.map((p) => [p.id, 0])),
      lastResult: null,
      driverId: null,
      busDeck: [],
      busPos: 0,
      busRow: Array(BUS_LENGTH).fill(null),
      busPenalty: 0,
      busAttempts: 1,
      round: 1,
      goal: roundGoal(ROUND_BASE),
      drives: Object.fromEntries(players.map((p) => [p.id, 0])),
    };
  },

  reduce: (state, action, players) => {
    switch (action.type) {
      case 'answer': {
        // Die Frage braucht so viele Handkarten, wie schon beantwortet wurden.
        // Eine verspaetete Antwort aus der Inbox traf sonst auf eine leere Hand
        // und riss den Host-Reducer mit einem Zugriff auf undefined ab.
        if (state.phase !== 'questions' || state.hand.length < state.qIndex) return state;
        if (state.lastResult) return state;
        // Nachschub OHNE die Pyramidenkarten. Ein volles Deck nachzumischen
        // legte dieselbe Karte offen in die Pyramide und verdeckt auf eine
        // Hand – ab zehn Personen (4 Züge je Person, 42 Karten Vorrat) ist
        // das der Regelfall, nicht der Randfall.
        const deck =
          state.deck.length >= 5
            ? state.deck
            : shuffle(fullDeck().filter((c) => !state.pyramid.includes(c)));
        const [next, ...rest] = deck;
        const card = cardFromIndex(next);
        const correct = checkAnswer(state, card, String(action.answer));
        const pid = state.order[state.playerIndex];
        const sips = correct ? 0 : 2 + state.qIndex;
        return {
          ...state,
          deck: rest,
          hand: [...state.hand, next],
          lastResult: { correct, card: next, sips },
          mistakes: correct ? state.mistakes : { ...state.mistakes, [pid]: (state.mistakes[pid] ?? 0) + 1 },
        };
      }
      case 'continue': {
        if (state.phase !== 'questions' || !state.lastResult) return state;
        const nextQ = state.qIndex + 1;
        if (nextQ < QUESTIONS.length) {
          return { ...state, qIndex: nextQ, lastResult: null };
        }
        // Die vier Karten bleiben liegen – in der Pyramide sind sie die Waffe.
        const pid = state.order[state.playerIndex];
        const hands = { ...state.hands, [pid]: state.hand };
        const nextPlayer = state.playerIndex + 1;
        if (nextPlayer < state.order.length) {
          return { ...state, hands, playerIndex: nextPlayer, qIndex: 0, hand: [], lastResult: null };
        }
        return { ...state, hands, hand: [], lastResult: null, phase: 'pyramid', pyStep: 'flip' };
      }

      case 'pyFlip': {
        if (state.phase !== 'pyramid' || state.pyStep !== 'flip') return state;
        if (state.pyUp >= PYRAMID_SIZE) return state;
        return { ...state, pyUp: state.pyUp + 1, pyStep: 'claim' };
      }
      case 'pyClaim': {
        if (state.phase !== 'pyramid' || state.pyStep !== 'claim') return state;
        // NICHT `action.by`: das setzt die Runtime auf das sendende Geraet
        // (`PartyContext`), und auf einem geteilten Handy waere damit immer
        // dieselbe Person die Ablegende, egal wen die Runde antippt.
        const by = String(action.who);
        // Ohne Karten kann niemand ablegen – auch nicht bluffend.
        if (!state.hands[by]?.length) return state;
        return { ...state, pyClaimBy: by, pyStep: 'pick' };
      }
      case 'pyPick': {
        if (state.phase !== 'pyramid' || state.pyStep !== 'pick' || !state.pyClaimBy) return state;
        const card = Number(action.card);
        const hand = state.hands[state.pyClaimBy] ?? [];
        if (!hand.includes(card)) return state;
        return { ...state, pyClaimCard: card, pyStep: 'doubt' };
      }
      case 'pyCancel': {
        // Zurueck aus der Kartenwahl. Ohne diesen Weg klebt das Spiel in
        // `pick`, sobald jemand seinen Chip aus Versehen trifft oder online
        // wegbricht – eine echte Sackgasse.
        if (state.phase !== 'pyramid' || state.pyStep !== 'pick') return state;
        return { ...state, pyClaimBy: null, pyClaimCard: null, pyStep: 'claim' };
      }
      case 'pyPass': {
        // Niemand legt ab: die Karte bleibt liegen, es geht weiter.
        if (state.phase !== 'pyramid' || state.pyStep !== 'claim') return state;
        return afterPyramidCard(state);
      }
      case 'pyAccept': {
        if (state.phase !== 'pyramid' || state.pyStep !== 'doubt') return state;
        return { ...state, pyStep: 'give' };
      }
      case 'pyDoubt': {
        if (state.phase !== 'pyramid' || state.pyStep !== 'doubt') return state;
        const by = String(action.who);
        if (by === state.pyClaimBy) return state;
        return { ...state, pyDoubtBy: by, pyStep: 'penalty' };
      }
      case 'pyGive': {
        // Nur merken, wer trinkt – die Ansage folgt im Schritt `gave`.
        if (state.phase !== 'pyramid' || state.pyStep !== 'give') return state;
        if (!state.pyClaimBy || state.pyClaimCard === null) return state;
        const to = String(action.to);
        if (to === state.pyClaimBy || !state.order.includes(to)) return state;
        return { ...state, pyGiveTo: to, pyStep: 'gave' };
      }
      case 'pyDone': {
        // Geglaubt: die Karte ist weg, egal ob sie gepasst hat – genau das
        // macht den Bluff lohnend. Aufgedeckt: hat sie gepasst, ist sie weg
        // und der Zweifler hat umsonst getrunken; war es Bluff, kommt sie
        // zurück auf die Hand.
        if (state.phase !== 'pyramid') return state;
        if (state.pyStep !== 'penalty' && state.pyStep !== 'gave') return state;
        if (!state.pyClaimBy || state.pyClaimCard === null) return state;
        if (state.pyStep === 'penalty' && !claimPasst(state)) return afterPyramidCard(state);
        const hand = state.hands[state.pyClaimBy] ?? [];
        return afterPyramidCard({
          ...state,
          hands: { ...state.hands, [state.pyClaimBy]: hand.filter((c) => c !== state.pyClaimCard) },
        });
      }

      case 'flip': {
        if (state.phase !== 'bus' || state.busPenalty > 0) return state;
        const deck = state.busDeck.length ? state.busDeck : shuffle(fullDeck());
        const [next, ...rest] = deck;
        const rank = cardFromIndex(next).rank;
        const penalty = BUS_PENALTY[rank] ?? 0;
        const row = [...state.busRow];
        row[state.busPos] = next;
        if (penalty > 0) {
          return { ...state, busDeck: rest, busRow: row, busPenalty: penalty };
        }
        const pos = state.busPos + 1;
        return {
          ...state,
          busDeck: rest,
          busRow: row,
          busPos: pos,
          busPenalty: 0,
          phase: pos >= BUS_LENGTH ? 'done' : 'bus',
        };
      }
      case 'restartBus':
        if (state.phase !== 'bus') return state;
        return {
          ...state,
          busPos: 0,
          busRow: Array(BUS_LENGTH).fill(null),
          busPenalty: 0,
          busAttempts: state.busAttempts + 1,
        };
      case 'again': {
        // Nur aus einer gefahrenen Runde heraus. Zwei fast gleichzeitige Taps
        // würden sonst zwei Runden zählen und eine still überspringen.
        if (state.phase !== 'done') return state;
        const round = state.round + 1;
        if (isOver(round, state.goal)) return { ...state, round, phase: 'over' };
        // Neue Karten, neue Fragen – Ziellinie und Bilanz bleiben stehen.
        return { ...busfahrer.createState(players), round, goal: state.goal, drives: state.drives };
      }
      case 'restart':
        return busfahrer.createState(players);
      default:
        return state;
    }
  },

  Component: BusfahrerGame,
};

function checkAnswer(state: State, card: ReturnType<typeof cardFromIndex>, answer: string): boolean {
  const [first, second] = state.hand.map(cardFromIndex);
  switch (state.qIndex) {
    case 0:
      return (answer === 'rot') === isRed(card);
    case 1: {
      const v = cardValue(card);
      const p = cardValue(first);
      if (v === p) return false;
      return answer === 'hoch' ? v > p : v < p;
    }
    case 2: {
      const v = cardValue(card);
      const lo = Math.min(cardValue(first), cardValue(second));
      const hi = Math.max(cardValue(first), cardValue(second));
      const inside = v > lo && v < hi;
      return answer === 'innen' ? inside : !inside;
    }
    case 3:
      return Number(answer) === card.suit;
    default:
      return false;
  }
}

function BusfahrerGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  const send = (a: GameActionInput) => {
    haptic('select');
    dispatch(a);
  };
  /** Eine Karte aufdecken ist ein eigener Moment: Ton und ein satterer Schlag. */
  const reveal = (a: GameActionInput) => {
    haptic('press');
    sound('tick');
    dispatch(a);
  };
  const findP = (id: string | null) => players.find((p) => p.id === id) ?? players[0];

  if (state.phase === 'over') {
    const rows = players.map((p) => ({
      player: p,
      value: state.drives[p.id] ?? 0,
      unit: 'Busfahrt',
      unitPlural: 'Busfahrten',
    }));
    const values = rows.map((r) => r.value);
    const most = values.length ? Math.max(...values) : 0;
    const fewest = values.length ? Math.min(...values) : 0;
    const top = rows.filter((r) => r.value === most).map((r) => r.player);
    return (
      <GameFrame title={busfahrer.name} accent={busfahrer.accent} subtitle="Endstation" onQuit={quit}>
        <GameOver
          headline={
            top.length === 1
              ? `${state.round - 1} Runden. ${top[0].name} saß am häufigsten am Steuer.`
              : `${state.round - 1} Runden. Ganz oben steht, wer am häufigsten fahren musste.`
          }
          ranking={rows}
          rankingTitle="Wer am häufigsten fahren musste"
          rankHighIsBad
          finalCall={
            // Nur wenn jemand wirklich heraussticht – bei Gleichstand träfe
            // die Ansage die ganze Runde und sagte damit nichts.
            most > fewest
              ? { players: top, baseSips: 4, label: 'die meisten Busfahrten', source: 'busfahrer' }
              : undefined
          }
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  if (state.phase === 'questions') {
    const actor = findP(state.order[state.playerIndex]);
    const isMyTurn = actor?.id === me.id;
    const canAct = !online || isMyTurn;
    const q = QUESTIONS[state.qIndex];
    return (
      <GameFrame
        title={busfahrer.name}
        accent={busfahrer.accent}
        subtitle={`Frage ${state.qIndex + 1}/4 · Spieler ${state.playerIndex + 1}/${state.order.length}`}
        onQuit={quit}
      >
        <div className="row" style={{ justifyContent: 'center' }}>
          <PlayerChip player={actor} note={isMyTurn ? 'du bist dran' : 'ist dran'} />
        </div>
        <div className="cardrow">
          {state.hand.map((c, i) => (
            <PlayingCard key={i} index={c} size="md" />
          ))}
          {state.hand.length < 4 && (
            <PlayingCard index={null} hidden size="md" glow={!state.lastResult} />
          )}
        </div>

        {state.lastResult ? (
          <div className="stack-3">
            <BigCard tone={state.lastResult.correct ? 'default' : 'danger'} kicker={state.lastResult.correct ? 'Richtig' : 'Daneben'}>
              {RANKS[cardFromIndex(state.lastResult.card).rank]}{' '}
              {SUIT_NAMES[cardFromIndex(state.lastResult.card).suit]}
              {state.lastResult.correct ? ' – sauber.' : ' – das war nichts.'}
            </BigCard>
            {!state.lastResult.correct && (
              <DrinkCall
                player={actor}
                baseSips={state.lastResult.sips}
                source="busfahrer"
                resetKey={`${state.playerIndex}-${state.qIndex}`}
              />
            )}
            <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'continue' })}>
              Weiter
            </button>
          </div>
        ) : (
          <>
            <BigCard kicker="Frage">{q.q}</BigCard>
            <div className={q.options.length > 2 ? 'choice choice--2' : 'choice'}>
              {q.options.map((o) => (
                <button
                  key={o.id}
                  className="choice__btn pressable"
                  disabled={!canAct}
                  onClick={() => reveal({ type: 'answer', answer: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {!isMyTurn && <div className="t-center t-sub">{actor?.name} ist dran.</div>}
          </>
        )}
      </GameFrame>
    );
  }

  if (state.phase === 'pyramid') {
    return (
      <Pyramid
        state={state}
        players={players}
        me={me}
        online={online}
        send={send}
        reveal={reveal}
        quit={quit}
      />
    );
  }

  const driver = findP(state.driverId);
  const isDriver = driver?.id === me.id;

  if (state.phase === 'done') {
    return (
      <GameFrame
        title={busfahrer.name}
        accent={busfahrer.accent}
        subtitle={state.goal ? `Angekommen · Runde ${state.round}/${state.goal}` : 'Angekommen'}
        onQuit={quit}
      >
        <BigCard kicker="Endstation">
          {driver?.name} hat es geschafft – nach {state.busAttempts}{' '}
          {state.busAttempts === 1 ? 'Versuch' : 'Versuchen'}.
        </BigCard>
        <div className="cardrow">
          {state.busRow.map((c, i) => (
            <PlayingCard key={i} index={c} size="sm" />
          ))}
        </div>
        <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'again' })}>
          {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Neue Runde'}
        </button>
      </GameFrame>
    );
  }

  const kannFahren = !online || isDriver;
  return (
    <GameFrame
      title={busfahrer.name}
      accent={busfahrer.accent}
      subtitle={`Busfahrt · Versuch ${state.busAttempts}`}
      onQuit={quit}
    >
      <div className="row" style={{ justifyContent: 'center' }}>
        <PlayerChip player={driver} note="fährt" />
      </div>
      {/* Die Strecke: fünf Plätze in EINER Reihe. Der Fortschritt ist die
          Reihe selbst, kein Zähler daneben. */}
      <div className="cardrow">
        {state.busRow.map((c, i) =>
          i === state.busPos && state.busPenalty === 0 ? (
            <button
              key={i}
              className="cardbtn pressable"
              disabled={!kannFahren}
              aria-label={`Platz ${i + 1} aufdecken`}
              onClick={() => reveal({ type: 'flip' })}
            >
              <PlayingCard index={null} hidden size="sm" glow />
            </button>
          ) : (
            <PlayingCard key={i} index={c} hidden={c == null} size="sm" />
          ),
        )}
      </div>

      {state.busPenalty > 0 ? (
        <div className="stack-3">
          <BigCard tone="danger" kicker="Bildkarte">
            Zurück an den Anfang. Und trinken.
          </BigCard>
          <DrinkCall
            player={driver}
            baseSips={state.busPenalty}
            source="busfahrer"
            resetKey={`bus-${state.busAttempts}-${state.busPos}`}
          />
          <button
            className="btn btn--brand btn--block btn--lg"
            onClick={() => {
              sound('boom');
              send({ type: 'restartBus' });
            }}
          >
            Nochmal von vorn
          </button>
        </div>
      ) : (
        <BigCard kicker={`Platz ${state.busPos + 1} von ${BUS_LENGTH}`}>
          {isDriver || !online
            ? 'Tipp auf die leuchtende Karte.'
            : `${driver?.name} deckt auf.`}
        </BigCard>
      )}
    </GameFrame>
  );
}

/**
 * Die Pyramide. Zehn verdeckte Karten, von unten aufgedeckt. Wer eine Karte
 * mit demselben Wert hat, legt ab und verteilt die Schlucke der Reihe – oder
 * behauptet es nur. Wer zweifelt und danebenliegt, trinkt doppelt.
 *
 * Die Hand liegt verdeckt: die App weiß, wer passt, verrät es aber erst beim
 * Aufdecken. Ohne das gäbe es nichts zu bluffen.
 */
function Pyramid({
  state,
  players,
  me,
  online,
  send,
  reveal,
  quit,
}: {
  state: State;
  players: GamePlayer[];
  me: GamePlayer;
  online?: boolean;
  send: (a: GameActionInput) => void;
  reveal: (a: GameActionInput) => void;
  quit: () => void;
}) {
  const findP = (id: string | null) => players.find((p) => p.id === id) ?? players[0];
  const offenIdx = state.pyUp - 1;
  const offeneKarte = offenIdx >= 0 ? state.pyramid[offenIdx] : null;
  const reihe = offenIdx >= 0 ? rowOf(offenIdx) : 0;
  const sips = rowSips(reihe);
  const claimer = state.pyClaimBy ? findP(state.pyClaimBy) : null;
  const doubter = state.pyDoubtBy ? findP(state.pyDoubtBy) : null;
  const empfaenger = state.pyGiveTo ? findP(state.pyGiveTo) : null;
  // Erst hier ausgerechnet, nicht im Zustand gehalten – siehe `claimPasst`.
  const passt = claimPasst(state);
  /** Wer noch Karten hat, kann ablegen. */
  const mitKarten = players.filter((p) => (state.hands[p.id]?.length ?? 0) > 0);
  const darfIch = !online || state.pyClaimBy === me.id;

  return (
    <GameFrame
      title={busfahrer.name}
      accent={busfahrer.accent}
      subtitle={`Pyramide · ${state.pyUp}/${PYRAMID_SIZE} · Reihe ${reihe + 1} zählt ${sips}`}
      onQuit={quit}
    >
      {/* Von oben nach unten gezeichnet, aufgedeckt wird von unten. Die
          Spitze steht also oben und kommt zuletzt. */}
      <div className="pyramide">
        {[...PYRAMID_ROWS.keys()].reverse().map((r) => (
          <div key={r} className="pyramide__reihe">
            {rowIndices(r).map((i) => {
              const dran = i === state.pyUp && state.pyStep === 'flip';
              return dran ? (
                <button
                  key={i}
                  className="cardbtn pressable"
                  aria-label={`Nächste Pyramidenkarte aufdecken, Reihe ${r + 1}`}
                  onClick={() => reveal({ type: 'pyFlip' })}
                >
                  <PlayingCard index={null} hidden size="sm" glow />
                </button>
              ) : (
                <PlayingCard
                  key={i}
                  index={state.pyramid[i]}
                  hidden={i >= state.pyUp}
                  size="sm"
                  glow={i === offenIdx && state.pyStep !== 'flip'}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Wer wie viele Karten hält – verdeckt, sonst wäre jeder Bluff sofort
          durchschaut. */}
      <div className="pyhands">
        {players.map((p) => (
          <div key={p.id} className="pyhands__row">
            <span className="pyhands__name">{p.name}</span>
            <span className="pyhands__cards" aria-label={`${state.hands[p.id]?.length ?? 0} Karten`}>
              {Array.from({ length: state.hands[p.id]?.length ?? 0 }, (_, k) => (
                <i key={k} className="pyhands__pip" />
              ))}
            </span>
          </div>
        ))}
      </div>

      {state.pyStep === 'flip' && (
        <BigCard kicker={`Karte ${state.pyUp + 1} von ${PYRAMID_SIZE}`}>
          Tipp auf die leuchtende Karte.
        </BigCard>
      )}

      {state.pyStep === 'claim' && offeneKarte !== null && (
        <div className="stack-3">
          <BigCard kicker={`${sips} ${sips === 1 ? 'Schluck' : 'Schlucke'}`}>
            {RANKS[cardFromIndex(offeneKarte).rank]} {SUIT_NAMES[cardFromIndex(offeneKarte).suit]} –
            wer legt ab?
          </BigCard>
          <VoteGrid
            players={mitKarten}
            onVote={(id) => send({ type: 'pyClaim', who: id })}
            disabled={online && !mitKarten.some((p) => p.id === me.id)}
          />
          <button
            className="btn btn--glass btn--block"
            onClick={() => send({ type: 'pyPass' })}
          >
            Keiner von uns
          </button>
        </div>
      )}

      {state.pyStep === 'pick' && claimer && (
        <div className="stack-3">
          <BigCard kicker={`${claimer.name} legt ab`}>
            {darfIch ? 'Nur du schaust: welche Karte legst du?' : `${claimer.name} sucht eine Karte.`}
          </BigCard>
          {darfIch && (
            <>
              <div className="cardrow">
                {(state.hands[claimer.id] ?? []).map((c) => (
                  <button
                    key={c}
                    className="cardbtn pressable"
                    aria-label={`${RANKS[cardFromIndex(c).rank]} ${SUIT_NAMES[cardFromIndex(c).suit]} ablegen`}
                    onClick={() => send({ type: 'pyPick', card: c })}
                  >
                    <PlayingCard index={c} size="md" />
                  </button>
                ))}
              </div>
              <button className="btn btn--glass btn--block" onClick={() => send({ type: 'pyCancel' })}>
                Doch nicht
              </button>
            </>
          )}
        </div>
      )}

      {state.pyStep === 'doubt' && claimer && (
        <div className="stack-3">
          <BigCard kicker="Verdeckt abgelegt">
            {claimer.name} behauptet, {RANKS[cardFromIndex(offeneKarte ?? 0).rank]} zu haben. Glaubt
            ihr das?
          </BigCard>
          <button
            className="btn btn--brand btn--block btn--lg"
            onClick={() => send({ type: 'pyAccept' })}
          >
            Glauben – {claimer.name} verteilt {sips}
          </button>
          <div className="t-center t-sub">oder aufdecken lassen:</div>
          <VoteGrid
            players={players.filter((p) => p.id !== claimer.id)}
            onVote={(id) => reveal({ type: 'pyDoubt', who: id })}
            disabled={online && me.id === claimer.id}
          />
        </div>
      )}

      {state.pyStep === 'give' && claimer && (
        <div className="stack-3">
          <BigCard kicker={`${sips} ${sips === 1 ? 'Schluck' : 'Schlucke'} verteilen`}>
            {claimer.name} bestimmt, wer trinkt.
          </BigCard>
          <VoteGrid
            players={players.filter((p) => p.id !== claimer.id)}
            onVote={(id) => send({ type: 'pyGive', to: id })}
            disabled={online && me.id !== claimer.id}
          />
        </div>
      )}

      {state.pyStep === 'gave' && claimer && empfaenger && (
        <div className="stack-3">
          <BigCard kicker="Geglaubt">
            {claimer.name} legt ab. {empfaenger.name} trinkt.
          </BigCard>
          <DrinkCall
            player={empfaenger}
            baseSips={sips}
            source="busfahrer"
            resetKey={`py-gave-${state.pyUp}-${empfaenger.id}`}
          />
          <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'pyDone' })}>
            Weiter
          </button>
        </div>
      )}

      {state.pyStep === 'penalty' && claimer && doubter && state.pyClaimCard !== null && (
        <div className="stack-3">
          <BigCard tone={passt ? 'default' : 'danger'} kicker="Aufgedeckt">
            {RANKS[cardFromIndex(state.pyClaimCard).rank]}{' '}
            {SUIT_NAMES[cardFromIndex(state.pyClaimCard).suit]}
            {passt
              ? ` – gepasst. ${doubter.name} hat umsonst gezweifelt.`
              : ` – gelogen. ${claimer.name} behält die Karte.`}
          </BigCard>
          <DrinkCall
            player={passt ? doubter : claimer}
            baseSips={sips * 2}
            source="busfahrer"
            resetKey={`py-${state.pyUp}-${state.pyClaimCard}`}
          />
          <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'pyDone' })}>
            Weiter
          </button>
        </div>
      )}
    </GameFrame>
  );
}
