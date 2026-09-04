import { useState } from 'react';
import { haptic } from '../../lib/haptics';
import { pick, shuffle } from '../../lib/format';
import { Icon } from '../../components/icons';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { DrinkCall, DrinkCallList } from '../shared/DrinkCall';
import { BigCard, PlayerChip, VoteGrid, VoteResult, WaitingFor } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { WORD_PAIRS } from './words';
import { meta } from './meta';

/** Vier entschiedene Runden sind bei „mittel" eine Partie – jede dauert ein paar Minuten. */
const ROUND_BASE = baseFor('undercover');

interface State {
  /** `over` beendet die Runde, `final` die Partie. */
  phase: 'reveal' | 'describe' | 'vote' | 'result' | 'over' | 'final';
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
}

/** Was eine neue Runde aus der alten mitnimmt: Ziellinie und Punktestand. */
type Carry = Pick<State, 'goal' | 'groupWins' | 'agentWins'>;

function newRound(players: GamePlayer[], round: number, carry: Carry): State {
  const alive = players.map((p) => p.id);
  const [a, b] = pick(WORD_PAIRS);
  const flip = Math.random() < 0.5;
  return {
    ...carry,
    phase: 'reveal',
    words: flip ? [b, a] : [a, b],
    undercoverId: pick(alive),
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
    newRound(players, 1, { goal: roundGoal(ROUND_BASE), groupWins: 0, agentWins: 0 }),

  reduce: (state, action, players) => {
    const alive = players.filter((p) => !state.eliminated.includes(p.id));
    switch (action.type) {
      case 'seen': {
        if (state.phase !== 'reveal') return state;
        const seen = state.seen.includes(action.by) ? state.seen : [...state.seen, action.by];
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
        const out = Object.keys(counts).find((id) => counts[id] === max) ?? null;
        const eliminated = out ? [...state.eliminated, out] : state.eliminated;
        const remaining = players.filter((p) => !eliminated.includes(p.id));
        const undercoverOut = out === state.undercoverId;
        const undercoverWins = !undercoverOut && remaining.length <= 2;
        return {
          ...state,
          votes,
          eliminated,
          lastOut: out,
          phase: undercoverOut || undercoverWins ? 'over' : 'result',
          winner: undercoverOut ? 'gruppe' : undercoverWins ? 'undercover' : null,
          groupWins: state.groupWins + (undercoverOut ? 1 : 0),
          agentWins: state.agentWins + (undercoverWins ? 1 : 0),
        };
      }
      case 'continue':
        return { ...state, phase: 'describe', votes: {}, turnIndex: 0, round: state.round };
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
  const [peek, setPeek] = useState(false);
  const send = (a: GameActionInput) => dispatch(a);
  const byId = (id: string | null) => players.find((p) => p.id === id) ?? null;
  const alive = players.filter((p) => !state.eliminated.includes(p.id));
  const myWord = me.id === state.undercoverId ? state.words[1] : state.words[0];

  if (!online) {
    return (
      <GameFrame title={undercover.name} accent={undercover.accent} onQuit={quit}>
        <BigCard kicker="Eigene Handys nötig">
          Bei Undercover darf niemand das Wort der anderen sehen. Startet dafür eine Online-Lobby.
        </BigCard>
        <button className="btn btn--brand btn--block btn--lg" onClick={quit}>
          Zurück
        </button>
      </GameFrame>
    );
  }

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
    const mine = state.seen.includes(me.id);
    const waiting = alive.filter((p) => !state.seen.includes(p.id)).map((p) => p.name);
    return (
      <GameFrame
        title={undercover.name}
        accent={undercover.accent}
        subtitle={state.goal ? `Runde ${state.round}/${state.goal}` : `Runde ${state.round}`}
        onQuit={quit}
      >
        {mine ? (
          <>
            <BigCard kicker="Merk es dir">Wort gesehen. Jetzt heißt es beschreiben.</BigCard>
            <WaitingFor names={waiting} what="Warten auf" />
          </>
        ) : (
          <>
            <div
              className={`peek ${peek ? 'peek--open' : ''}`}
              onPointerDown={() => setPeek(true)}
              onPointerUp={() => setPeek(false)}
              onPointerLeave={() => setPeek(false)}
              role="button"
              tabIndex={0}
            >
              {peek ? (
                <span className="peek__word">{myWord}</span>
              ) : (
                <span className="peek__hint">
                  <Icon name="lock" size={28} />
                  Gedrückt halten
                </span>
              )}
            </div>
            <p className="t-sub t-center t-balance">
              Halte den Finger drauf, damit niemand mitliest. Danach bestätigen.
            </p>
            <button
              className="btn btn--brand btn--block btn--lg"
              onClick={() => {
                haptic('success');
                send({ type: 'seen' });
              }}
            >
              Habe ich gesehen
            </button>
          </>
        )}
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
        {state.phase === 'over' && (
          <>
            {' '}
            Die Wörter waren „{state.words[0]}" und „{state.words[1]}".
          </>
        )}
      </BigCard>
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
