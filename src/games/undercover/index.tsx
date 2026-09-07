import { useState, type ReactNode } from 'react';
import { haptic } from '../../lib/haptics';
import { pick, shuffle } from '../../lib/format';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { DrinkCall, DrinkCallList } from '../shared/DrinkCall';
import { BigCard, Choice, PlayerChip, VoteGrid, VoteResult, WaitingFor } from '../shared/pieces';
import { PeekCard } from '../shared/PeekCard';
import { PassDevice } from '../shared/PassDevice';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { WORD_PAIRS } from './words';
import { meta } from './meta';

/** Vier entschiedene Runden sind bei „mittel" eine Partie – jede dauert ein paar Minuten. */
const ROUND_BASE = baseFor('undercover');

interface State {
  /** `guess` ist der letzte Rateversuch des Enttarnten, `over` beendet die
   *  Runde, `final` die Partie. */
  phase: 'reveal' | 'describe' | 'vote' | 'result' | 'guess' | 'over' | 'final';
  words: [string, string];
  undercoverId: string;
  seen: string[];
  order: string[];
  turnIndex: number;
  votes: Record<string, string>;
  eliminated: string[];
  lastOut: string | null;
  round: number;
  /** Rundenzahl, nach der Schluss ist. `null` = ohne Ende. */
  goal: number | null;
  /** Wie oft die Gruppe enttarnt hat. */
  groupWins: number;
  /** Wie oft Undercover durchgekommen ist. */
  agentWins: number;
  /** Gesetzt, wenn die Runde entschieden ist. */
  winner: 'gruppe' | 'undercover' | null;
  /** Bei Stimmengleichstand hat das Los entschieden. Die Runde soll das sehen –
   *  vorher entschied still die Reihenfolge der Stimmabgabe. */
  tie: boolean;
  /** Wer zuletzt Undercover war, damit es nicht zweimal dieselbe Person wird. */
  lastUndercoverId: string | null;
  /** Nur in `guess`: die Wörter, unter denen der Enttarnte wählen darf. */
  guessOptions: string[];
  /** Was er geraten hat. */
  guessed: string | null;
}

/**
 * Drei Wörter zur Auswahl für den letzten Rateversuch: das echte Wort der
 * Gruppe und zwei Ablenkungen aus anderen Paaren. Läuft im Reducer, darf also
 * mischen.
 */
function guessChoices(civilian: string): string[] {
  const andere = WORD_PAIRS.flat().filter((w) => w !== civilian);
  return shuffle([civilian, ...shuffle(andere).slice(0, 2)]);
}

/** Was eine neue Runde aus der alten mitnimmt: Ziellinie und Punktestand. */
type Carry = Pick<State, 'goal' | 'groupWins' | 'agentWins' | 'lastUndercoverId'>;

function newRound(players: GamePlayer[], round: number, carry: Carry): State {
  const alive = players.map((p) => p.id);
  const [a, b] = pick(WORD_PAIRS);
  const flip = Math.random() < 0.5;
  // „Oft ist die gleiche Person der Imposter" ist die haeufigste Beschwerde bei
  // den Vertretern dieses Genres. Wer zuletzt dran war, faellt raus - solange
  // ueberhaupt jemand anders da ist.
  const wahl = alive.filter((id) => id !== carry.lastUndercoverId);
  const undercoverId = pick(wahl.length ? wahl : alive);
  return {
    ...carry,
    phase: 'reveal',
    words: flip ? [b, a] : [a, b],
    undercoverId,
    lastUndercoverId: undercoverId,
    tie: false,
    guessOptions: [],
    guessed: null,
    seen: [],
    order: shuffle(alive),
    turnIndex: 0,
    votes: {},
    eliminated: [],
    lastOut: null,
    round,
    winner: null,
  };
}

export const undercover: GameDefinition<State> = {
  ...meta,

  createState: (players) =>
    newRound(players, 1, {
      goal: roundGoal(ROUND_BASE),
      groupWins: 0,
      agentWins: 0,
      lastUndercoverId: null,
    }),

  reduce: (state, action, players) => {
    const alive = players.filter((p) => !state.eliminated.includes(p.id));
    switch (action.type) {
      case 'seen': {
        if (state.phase !== 'reveal') return state;
        // Wer geschaut hat, steht in der Aktion und nicht in `by`. Auf einem
        // geteilten Handy traegt JEDE Aktion die ID des Geraetebesitzers – ueber
        // `by` haette `seen` nie mehr als einen Eintrag bekommen und das Spiel
        // haenge fuer immer in dieser Phase.
        const who = String(action.who ?? action.by);
        if (!alive.some((p) => p.id === who)) return state;
        const seen = state.seen.includes(who) ? state.seen : [...state.seen, who];
        const done = alive.every((p) => seen.includes(p.id));
        return { ...state, seen, phase: done ? 'describe' : 'reveal' };
      }
      case 'nextSpeaker': {
        if (state.phase !== 'describe') return state;
        const next = state.turnIndex + 1;
        const speakers = state.order.filter((id) => !state.eliminated.includes(id));
        if (next >= speakers.length) return { ...state, phase: 'vote', turnIndex: 0 };
        return { ...state, turnIndex: next };
      }
      case 'vote': {
        if (state.phase !== 'vote') return state;
        const votes = { ...state.votes, [action.by]: String(action.target) };
        const done = alive.every((p) => votes[p.id]);
        if (!done) return { ...state, votes };
        const counts: Record<string, number> = {};
        for (const t of Object.values(votes)) counts[t] = (counts[t] ?? 0) + 1;
        const max = Math.max(...Object.values(counts));
        // Bei Gleichstand entschied vorher `Object.keys(...).find(...)`, also
        // die Reihenfolge der Stimmabgabe. Fuer die Runde sah das wie Zufall
        // aus, war aber die Eingangsreihenfolge der Inbox. Jetzt entscheidet
        // wirklich das Los – und die Runde erfaehrt es.
        const tied = Object.keys(counts).filter((id) => counts[id] === max);
        const tie = tied.length > 1;
        const out = tied.length ? pick(tied) : null;
        const eliminated = out ? [...state.eliminated, out] : state.eliminated;
        const remaining = players.filter((p) => !eliminated.includes(p.id));
        const undercoverOut = out === state.undercoverId;
        // Der Enttarnte bekommt einen letzten Rateversuch auf das Wort der
        // Gruppe. Trifft er, dreht die Runde noch. Das ist der dramatischste
        // Moment des Vorbilds und fehlte hier ganz.
        if (undercoverOut) {
          return {
            ...state,
            votes,
            eliminated,
            lastOut: out,
            tie,
            phase: 'guess',
            guessOptions: guessChoices(state.words[0]),
          };
        }
        const undercoverWins = remaining.length <= 2;
        return {
          ...state,
          votes,
          eliminated,
          lastOut: out,
          tie,
          phase: undercoverWins ? 'over' : 'result',
          winner: undercoverWins ? 'undercover' : null,
          agentWins: state.agentWins + (undercoverWins ? 1 : 0),
        };
      }
      case 'guess': {
        if (state.phase !== 'guess') return state;
        const word = String(action.word);
        const richtig = word === state.words[0];
        return {
          ...state,
          guessed: word,
          phase: 'over',
          winner: richtig ? 'undercover' : 'gruppe',
          groupWins: state.groupWins + (richtig ? 0 : 1),
          agentWins: state.agentWins + (richtig ? 1 : 0),
        };
      }
      case 'continue': {
        if (state.phase !== 'result') return state;
        // Die Reihenfolge wandert um eine Person weiter, damit nicht immer
        // dieselbe anfaengt – auch das eine belegte Beschwerde bei
        // vergleichbaren Apps.
        const order = state.order.length ? [...state.order.slice(1), state.order[0]] : state.order;
        return { ...state, phase: 'describe', votes: {}, turnIndex: 0, order };
      }
      case 'newRound': {
        // Nur aus einer entschiedenen Runde heraus. Zwei fast gleichzeitige
        // Taps würden sonst zwei Runden zählen und eine still überspringen.
        if (state.phase !== 'over') return state;
        const round = state.round + 1;
        // Die Ziellinie liegt zwischen zwei Runden – eine angefangene Runde
        // wird immer zu Ende gespielt.
        if (isOver(round, state.goal)) return { ...state, round, phase: 'final' };
        return newRound(players, round, {
          goal: state.goal,
          groupWins: state.groupWins,
          agentWins: state.agentWins,
          lastUndercoverId: state.undercoverId,
        });
      }
      case 'restart':
        return undercover.createState(players);
      default:
        return state;
    }
  },

  Component: UndercoverGame,
};

function UndercoverGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  // Auf einem geteilten Handy muss bestaetigt werden, dass wirklich die
  // richtige Person schaut. Das ist bewusst lokal: es geht niemanden sonst an.
  const [handedOver, setHandedOver] = useState(false);
  const send = (a: GameActionInput) => dispatch(a);
  const byId = (id: string | null) => players.find((p) => p.id === id) ?? null;
  const alive = players.filter((p) => !state.eliminated.includes(p.id));
  const wordFor = (id: string) => (id === state.undercoverId ? state.words[1] : state.words[0]);

  if (state.phase === 'final') {
    return (
      <GameFrame
        title={undercover.name}
        accent={undercover.accent}
        subtitle="Endstand"
        onQuit={quit}
      >
        <GameOver
          headline={`${state.round - 1} Runden. Die Gruppe hat ${state.groupWins} mal enttarnt, Undercover ist ${state.agentWins} mal durchgekommen.`}
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  if (state.phase === 'reveal') {
    const waiting = alive.filter((p) => !state.seen.includes(p.id)).map((p) => p.name);
    // Online schaut jeder auf seinem eigenen Geraet. Auf einem geteilten Handy
    // ist immer der Naechste dran, der noch nicht geschaut hat – in der
    // gemischten Reihenfolge, damit die Sitzordnung nichts verraet.
    const next = byId(state.order.find((id) => !state.seen.includes(id)) ?? null);
    const current = online ? me : next;
    const meDone = online && state.seen.includes(me.id);
    const frame = (inner: ReactNode) => (
      <GameFrame
        title={undercover.name}
        accent={undercover.accent}
        subtitle={state.goal ? `Runde ${state.round}/${state.goal}` : `Runde ${state.round}`}
        onQuit={quit}
      >
        {inner}
      </GameFrame>
    );

    if (meDone) {
      return frame(
        <>
          <BigCard kicker="Merk es dir">Wort gesehen. Jetzt heißt es beschreiben.</BigCard>
          <WaitingFor names={waiting} what="Warten auf" />
        </>,
      );
    }
    if (!current) return frame(<BigCard kicker="Moment">Runde wird vorbereitet.</BigCard>);
    if (!online && !handedOver) {
      return frame(
        <PassDevice
          player={current}
          step={state.seen.length + 1}
          total={alive.length}
          onConfirm={() => setHandedOver(true)}
        />,
      );
    }
    return frame(
      <>
        {!online && <div className="t-upper t-center">Hallo {current.name}</div>}
        <PeekCard label="Karte hochschieben">
          <span className="peekcard__word">{wordFor(current.id)}</span>
        </PeekCard>
        <p className="t-sub t-center t-balance">
          Schieb die Karte nach oben und halt sie fest, damit niemand mitliest.
        </p>
        <button
          className="btn btn--brand btn--block btn--lg"
          onClick={() => {
            haptic('success');
            setHandedOver(false);
            send({ type: 'seen', who: current.id });
          }}
        >
          Habe ich gesehen
        </button>
      </>,
    );
  }

  if (state.phase === 'guess') {
    const out = byId(state.lastOut);
    return (
      <GameFrame
        title={undercover.name}
        accent={undercover.accent}
        subtitle="Letzter Versuch"
        onQuit={quit}
      >
        <BigCard kicker="Erwischt">
          {out?.name} war Undercover. Ein Rateversuch bleibt: Welches Wort hatte die Gruppe?
        </BigCard>
        <Choice
          options={state.guessOptions.map((w) => ({ id: w, label: w }))}
          onPick={(word) => {
            haptic('heavy');
            send({ type: 'guess', word });
          }}
        />
        <p className="t-sub t-center t-balance">
          Trifft {out?.name} das Wort, dreht die Runde noch.
        </p>
      </GameFrame>
    );
  }

  if (state.phase === 'describe') {
    const speakers = state.order.filter((id) => !state.eliminated.includes(id));
    const speaker = byId(speakers[state.turnIndex % Math.max(1, speakers.length)]);
    return (
      <GameFrame
        title={undercover.name}
        accent={undercover.accent}
        subtitle={`Runde ${state.round} · ${state.turnIndex + 1}/${speakers.length}`}
        onQuit={quit}
      >
        {speaker && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <PlayerChip player={speaker} note={speaker.id === me.id ? 'du bist dran' : 'beschreibt'} />
          </div>
        )}
        <BigCard kicker="Ein Satz">
          {speaker?.id === me.id
            ? 'Beschreibe dein Wort – ohne es zu sagen.'
            : `${speaker?.name} beschreibt gerade.`}
        </BigCard>
        <button
          className="btn btn--brand btn--block btn--lg"
          onClick={() => send({ type: 'nextSpeaker' })}
        >
          Gesagt – weiter
        </button>
      </GameFrame>
    );
  }

  if (state.phase === 'vote') {
    const waiting = alive.filter((p) => !state.votes[p.id]).map((p) => p.name);
    return (
      <GameFrame title={undercover.name} accent={undercover.accent} subtitle="Abstimmen" onQuit={quit}>
        <BigCard kicker="Wer ist Undercover?">Alle stimmen gleichzeitig ab.</BigCard>
        <VoteGrid
          players={alive}
          myVote={state.votes[me.id]}
          onVote={(id) => {
            haptic('select');
            send({ type: 'vote', target: id });
          }}
          disabled={state.eliminated.includes(me.id)}
        />
        {state.votes[me.id] && <WaitingFor names={waiting} what="Warten auf" />}
      </GameFrame>
    );
  }

  const counts: Record<string, number> = {};
  for (const t of Object.values(state.votes)) counts[t] = (counts[t] ?? 0) + 1;
  const out = byId(state.lastOut);
  const wasUndercover = state.lastOut === state.undercoverId;

  return (
    <GameFrame
      title={undercover.name}
      accent={undercover.accent}
      subtitle={state.phase === 'over' ? 'Entschieden' : 'Aufgedeckt'}
      onQuit={quit}
    >
      <BigCard
        tone={wasUndercover ? 'default' : 'danger'}
        kicker={wasUndercover ? 'Erwischt' : 'Daneben'}
      >
        {out?.name} war {wasUndercover ? 'Undercover' : 'unschuldig'}.
        {state.guessed && (
          <>
            {' '}
            {state.winner === 'undercover'
              ? `Und hat das Wort erraten: „${state.guessed}". Runde gedreht.`
              : `Geraten wurde „${state.guessed}" – daneben.`}
          </>
        )}
        {state.phase === 'over' && (
          <>
            {' '}
            Die Wörter waren „{state.words[0]}" und „{state.words[1]}".
          </>
        )}
      </BigCard>
      {state.tie && (
        <div className="notice notice--neutral">
          Stimmengleichstand – das Los hat entschieden.
        </div>
      )}
      <VoteResult players={players} counts={counts} highlight={state.lastOut} />

      {state.winner === 'gruppe' && out && (
        <DrinkCall
          player={out}
          baseSips={5}
          source="undercover"
          label="aufgeflogen"
          resetKey={`${state.round}-${state.lastOut}`}
        />
      )}
      {state.winner === 'undercover' && (
        <DrinkCallList
          players={players.filter((p) => p.id !== state.undercoverId)}
          baseSips={4}
          source="undercover"
          label="durchgerutscht"
          resetKey={`${state.round}-${state.lastOut}`}
        />
      )}
      {!state.winner && out && (
        <DrinkCall
          player={out}
          baseSips={3}
          source="undercover"
          label="rausgewählt"
          resetKey={`${state.round}-${state.lastOut}`}
        />
      )}

      <button
        className="btn btn--brand btn--block btn--lg"
        onClick={() => send({ type: state.phase === 'over' ? 'newRound' : 'continue' })}
      >
        {state.phase !== 'over'
          ? 'Weiter beschreiben'
          : isOver(state.round + 1, state.goal)
            ? 'Endstand'
            : 'Neue Runde'}
      </button>
    </GameFrame>
  );
}
