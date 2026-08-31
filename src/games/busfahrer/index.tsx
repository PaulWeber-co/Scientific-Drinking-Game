import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { cardFromIndex, cardValue, fullDeck, isRed, RANKS, SUITS } from '../shared/deck';
import { PlayingCard } from '../shared/PlayingCard';
import { GameFrame } from '../shared/GameFrame';
import { DrinkCall } from '../shared/DrinkCall';
import { BigCard, PlayerChip } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GameRuntime } from '../types';

const QUESTIONS = [
  { q: 'Rot oder Schwarz?', options: [{ id: 'rot', label: '🟥 Rot' }, { id: 'schwarz', label: '⬛️ Schwarz' }] },
  { q: 'Höher oder tiefer?', options: [{ id: 'hoch', label: '⬆️ Höher' }, { id: 'tief', label: '⬇️ Tiefer' }] },
  { q: 'Dazwischen oder außerhalb?', options: [{ id: 'innen', label: '↔️ Dazwischen' }, { id: 'außen', label: '↕️ Außerhalb' }] },
  { q: 'Welche Farbe?', options: SUITS.map((s, i) => ({ id: String(i), label: s })) },
];

/** Strafschlucke für aufgedeckte Bildkarten auf der Busfahrt. */
const BUS_PENALTY: Record<number, number> = { 10: 2, 11: 3, 12: 4, 0: 5 }; // Bube, Dame, König, Ass

interface State {
  order: string[];
  phase: 'questions' | 'bus' | 'done';
  playerIndex: number;
  qIndex: number;
  hand: number[];
  deck: number[];
  mistakes: Record<string, number>;
  lastResult: { correct: boolean; card: number; sips: number } | null;
  driverId: string | null;
  busDeck: number[];
  busPos: number;
  busRow: (number | null)[];
  busPenalty: number;
  busAttempts: number;
}

const BUS_LENGTH = 5;

export const busfahrer: GameDefinition<State> = {
  id: 'busfahrer',
  name: 'Busfahrer',
  tagline: 'Vier Fragen. Ein Verlierer. Eine lange Fahrt.',
  emoji: '🚌',
  accent: 'var(--yellow)',
  minPlayers: 3,
  maxPlayers: 12,
  duration: '15-30 Min',
  intensity: 3,
  tags: ['karten', 'schnell'],
  requiresOwnDevice: false,
  howTo: [
    'Jede Person beantwortet vier Fragen zu ihren Karten. Falsch = trinken.',
    'Wer am meisten falsch lag, wird Busfahrer.',
    'Der Busfahrer deckt fünf Karten auf. Jede Bildkarte schickt ihn zurück an den Anfang.',
  ],

  createState: (players) => ({
    order: shuffle(players.map((p) => p.id)),
    phase: 'questions',
    playerIndex: 0,
    qIndex: 0,
    hand: [],
    deck: shuffle(fullDeck()),
    mistakes: Object.fromEntries(players.map((p) => [p.id, 0])),
    lastResult: null,
    driverId: null,
    busDeck: [],
    busPos: 0,
    busRow: Array(BUS_LENGTH).fill(null),
    busPenalty: 0,
    busAttempts: 0,
  }),

  reduce: (state, action, players) => {
    switch (action.type) {
      case 'answer': {
        const deck = state.deck.length >= 5 ? state.deck : shuffle(fullDeck());
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
        const nextQ = state.qIndex + 1;
        if (nextQ < QUESTIONS.length) {
          return { ...state, qIndex: nextQ, lastResult: null };
        }
        const nextPlayer = state.playerIndex + 1;
        if (nextPlayer < state.order.length) {
          return { ...state, playerIndex: nextPlayer, qIndex: 0, hand: [], lastResult: null };
        }
        // Alle durch – der mit den meisten Fehlern fährt.
        const driverId = [...state.order].sort(
          (a, b) => (state.mistakes[b] ?? 0) - (state.mistakes[a] ?? 0),
        )[0];
        return {
          ...state,
          phase: 'bus',
          driverId,
          busDeck: shuffle(fullDeck()),
          busPos: 0,
          busRow: Array(BUS_LENGTH).fill(null),
          busPenalty: 0,
          busAttempts: 1,
          lastResult: null,
        };
      }
      case 'flip': {
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
        return {
          ...state,
          busPos: 0,
          busRow: Array(BUS_LENGTH).fill(null),
          busPenalty: 0,
          busAttempts: state.busAttempts + 1,
        };
      case 'again':
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
  const findP = (id: string | null) => players.find((p) => p.id === id) ?? players[0];

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
            <PlayingCard key={i} index={c} />
          ))}
          {state.hand.length < 4 && <PlayingCard index={null} hidden />}
        </div>

        {state.lastResult ? (
          <div className="stack-3">
            <BigCard tone={state.lastResult.correct ? 'default' : 'danger'} kicker={state.lastResult.correct ? 'Richtig' : 'Daneben'}>
              {RANKS[cardFromIndex(state.lastResult.card).rank]}
              {SUITS[cardFromIndex(state.lastResult.card).suit]}
              {state.lastResult.correct ? ' – sauber.' : ' – das war nichts.'}
            </BigCard>
            {!state.lastResult.correct && (
              <DrinkCall player={actor} baseSips={state.lastResult.sips} source="busfahrer" />
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
                  onClick={() => send({ type: 'answer', answer: o.id })}
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

  const driver = findP(state.driverId);
  const isDriver = driver?.id === me.id;

  if (state.phase === 'done') {
    return (
      <GameFrame title={busfahrer.name} accent={busfahrer.accent} subtitle="Angekommen" onQuit={quit}>
        <BigCard kicker="🚌 Endstation">
          {driver?.name} hat es geschafft – nach {state.busAttempts}{' '}
          {state.busAttempts === 1 ? 'Versuch' : 'Versuchen'}.
        </BigCard>
        <div className="cardrow">
          {state.busRow.map((c, i) => (
            <PlayingCard key={i} index={c} />
          ))}
        </div>
        <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'again' })}>
          Neue Runde
        </button>
      </GameFrame>
    );
  }

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
      <div className="cardrow">
        {state.busRow.map((c, i) => (
          <div key={i} style={{ opacity: i === state.busPos ? 1 : 0.75, transform: i === state.busPos ? 'scale(1.04)' : undefined }}>
            <PlayingCard index={c} hidden={c == null} />
          </div>
        ))}
      </div>

      {state.busPenalty > 0 ? (
        <div className="stack-3">
          <BigCard tone="danger" kicker="Bildkarte">
            Zurück an den Anfang. Und trinken.
          </BigCard>
          <DrinkCall player={driver} baseSips={state.busPenalty} source="busfahrer" />
          <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'restartBus' })}>
            Nochmal von vorn
          </button>
        </div>
      ) : (
        <>
          <BigCard kicker={`Platz ${state.busPos + 1} von ${BUS_LENGTH}`}>
            {isDriver ? 'Deck die nächste Karte auf.' : `${driver?.name} deckt auf.`}
          </BigCard>
          <button
            className="btn btn--brand btn--block btn--lg"
            disabled={online && !isDriver}
            onClick={() => send({ type: 'flip' })}
          >
            Karte aufdecken
          </button>
        </>
      )}
    </GameFrame>
  );
}
