import { useState } from 'react';
import { haptic } from '../../lib/haptics';
import { pick, shuffle } from '../../lib/format';
import { Icon } from '../../components/icons';
import { GameFrame } from '../shared/GameFrame';
import { DrinkCall, DrinkCallList } from '../shared/DrinkCall';
import { BigCard, PlayerChip, VoteGrid, VoteResult, WaitingFor } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { WORD_PAIRS } from './words';

interface State {
  phase: 'reveal' | 'describe' | 'vote' | 'result' | 'over';
  words: [string, string];
  undercoverId: string;
  seen: string[];
  order: string[];
  turnIndex: number;
  votes: Record<string, string>;
  eliminated: string[];
  lastOut: string | null;
  round: number;
  /** Gesetzt, wenn das Spiel entschieden ist. */
  winner: 'gruppe' | 'undercover' | null;
}

function newRound(players: GamePlayer[], round: number): State {
  const alive = players.map((p) => p.id);
  const [a, b] = pick(WORD_PAIRS);
  const flip = Math.random() < 0.5;
  return {
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
  id: 'undercover',
  name: 'Undercover',
  tagline: 'Alle kennen dasselbe Wort. Eine Person nicht.',
  icon: 'eyeOff',
  accent: 'var(--indigo)',
  minPlayers: 4,
  maxPlayers: 12,
  duration: '15-30 Min',
  intensity: 2,
  tags: ['geheim', 'reden', 'handy-weg'],
  requiresOwnDevice: true,
  howTo: [
    'Jede Person sieht ihr Wort nur auf dem eigenen Handy. Eine Person bekommt ein anderes.',
    'Reihum beschreibt jede Person ihr Wort mit genau einem Satz – ohne es zu nennen.',
    'Danach wird abgestimmt. Wer rausfliegt, trinkt. Bleibt Undercover übrig, trinkt die ganze Runde.',
  ],

  createState: (players) => newRound(players, 1),

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
        };
      }
      case 'continue':
        return { ...state, phase: 'describe', votes: {}, turnIndex: 0, round: state.round };
      case 'newRound':
        return newRound(players, state.round + 1);
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

  if (state.phase === 'reveal') {
    const mine = state.seen.includes(me.id);
    const waiting = alive.filter((p) => !state.seen.includes(p.id)).map((p) => p.name);
    return (
      <GameFrame
        title={undercover.name}
        accent={undercover.accent}
        subtitle={`Runde ${state.round}`}
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
        <DrinkCall player={out} baseSips={5} source="undercover" label="aufgeflogen" />
      )}
      {state.winner === 'undercover' && (
        <DrinkCallList
          players={players.filter((p) => p.id !== state.undercoverId)}
          baseSips={4}
          source="undercover"
          label="durchgerutscht"
        />
      )}
      {!state.winner && out && (
        <DrinkCall player={out} baseSips={3} source="undercover" label="rausgewählt" />
      )}

      <button
        className="btn btn--brand btn--block btn--lg"
        onClick={() => send({ type: state.phase === 'over' ? 'newRound' : 'continue' })}
      >
        {state.phase === 'over' ? 'Neue Runde' : 'Weiter beschreiben'}
      </button>
    </GameFrame>
  );
}
