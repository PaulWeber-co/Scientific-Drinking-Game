import { useState } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { Icon } from '../../components/icons';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { DrinkCall, DrinkCallList } from '../shared/DrinkCall';
import { BigCard, PlayerChip, WaitingFor } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { meta } from './meta';

interface State {
  phase: 'write' | 'guess' | 'result' | 'over';
  authorIndex: number;
  order: string[];
  statements: string[];
  /** Index der Lüge in der angezeigten (gemischten) Reihenfolge. */
  lie: number;
  guesses: Record<string, number>;
  round: number;
  goal: number | null;
  /** Wie oft jemand die Lüge erkannt hat. */
  hits: Record<string, number>;
}

/** Eine Runde ist eine Person mit ihren drei Aussagen. Fünf sind „mittel". */
const ROUND_BASE = baseFor('zwei-wahrheiten');

/** Ein Punkt für jede erkannte Lüge. */
function scoreGuesses(state: State): Record<string, number> {
  const hits = { ...state.hits };
  for (const [id, index] of Object.entries(state.guesses)) {
    if (index === state.lie) hits[id] = (hits[id] ?? 0) + 1;
  }
  return hits;
}

export const zweiWahrheiten: GameDefinition<State> = {
  ...meta,

  createState: (players) => ({
    phase: 'write',
    authorIndex: 0,
    order: shuffle(players.map((p) => p.id)),
    statements: [],
    lie: 0,
    guesses: {},
    round: 1,
    goal: roundGoal(ROUND_BASE),
    hits: {},
  }),

  reduce: (state, action, players) => {
    switch (action.type) {
      case 'submit': {
        if (state.phase !== 'write') return state;
        const raw = (action.statements as string[]) ?? [];
        const lieIndex = Number(action.lie);
        if (raw.length !== 3 || raw.some((t) => !t.trim())) return state;
        // Reihenfolge mischen, damit die Lüge nicht immer an derselben Stelle steht.
        const withFlag = raw.map((text, i) => ({ text: text.trim(), lie: i === lieIndex }));
        const mixed = shuffle(withFlag);
        return {
          ...state,
          statements: mixed.map((m) => m.text),
          lie: mixed.findIndex((m) => m.lie),
          phase: 'guess',
          guesses: {},
        };
      }
      case 'guess': {
        if (state.phase !== 'guess') return state;
        const authorId = state.order[state.authorIndex % Math.max(1, state.order.length)];
        if (action.by === authorId) return state;
        const guesses = { ...state.guesses, [action.by]: Number(action.index) };
        const others = players.filter((p) => p.id !== authorId && p.online !== false);
        const done = others.every((p) => guesses[p.id] !== undefined);
        return { ...state, guesses, phase: done ? 'result' : 'guess' };
      }
      case 'next': {
        // Nur aus der Auflösung heraus: zwei fast gleichzeitige Taps auf
        // „Weiter" würden sonst zwei Runden zählen, und die letzte Runde
        // fiele still aus. Die Inbox wendet Aktionen nacheinander an.
        if (state.phase !== 'result') return state;
        const order = state.order.filter((id) => players.some((p) => p.id === id));
        const added = players.filter((p) => !order.includes(p.id)).map((p) => p.id);
        const full = [...order, ...added];
        const round = state.round + 1;
        // Gezählt wird nur, was auch aufgelöst wurde.
        const hits = state.phase === 'result' ? scoreGuesses(state) : state.hits;
        if (isOver(round, state.goal)) {
          return { ...state, order: full, round, hits, phase: 'over' };
        }
        return {
          ...state,
          order: full,
          authorIndex: (state.authorIndex + 1) % Math.max(1, full.length),
          phase: 'write',
          statements: [],
          lie: 0,
          guesses: {},
          round,
          hits,
        };
      }
      case 'restart':
        return zweiWahrheiten.createState(players);
      default:
        return state;
    }
  },

  Component: ZweiWahrheitenGame,
};

function ZweiWahrheitenGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  const [texts, setTexts] = useState(['', '', '']);
  const [lie, setLie] = useState(0);
  const send = (a: GameActionInput) => dispatch(a);
  const author = players.find((p) => p.id === state.order[state.authorIndex % Math.max(1, state.order.length)]) ?? players[0];
  const isAuthor = author?.id === me.id;

  if (!online) {
    return (
      <GameFrame title={zweiWahrheiten.name} accent={zweiWahrheiten.accent} onQuit={quit}>
        <BigCard kicker="Eigene Handys nötig">
          Die Aussagen dürfen beim Schreiben niemand sehen. Startet dafür eine Online-Lobby.
        </BigCard>
        <button className="btn btn--brand btn--block btn--lg" onClick={quit}>
          Zurück
        </button>
      </GameFrame>
    );
  }

  const progress = state.goal ? `${Math.min(state.round, state.goal)}/${state.goal}` : `${state.round}`;

  if (state.phase === 'over') {
    const guessers = players.filter((p) => p.online !== false);
    const ranking = guessers.map((p) => ({
      player: p,
      value: state.hits[p.id] ?? 0,
      unit: 'Lüge',
    }));
    const fewest = Math.min(...ranking.map((r) => r.value));
    const trailing = ranking.filter((r) => r.value === fewest).map((r) => r.player);
    const played = state.goal ?? state.round - 1;
    return (
      <GameFrame
        title={zweiWahrheiten.name}
        accent={zweiWahrheiten.accent}
        subtitle="Vorbei"
        onQuit={quit}
      >
        <GameOver
          headline={`${played} Runden, ${played} Lügen. Oben steht, wer sie am häufigsten erkannt hat.`}
          ranking={ranking}
          rankingTitle="Wer die meisten Lügen erkannt hat"
          finalCall={{
            // Liegen alle gleichauf, gibt es kein Schlusslicht – dann trinkt niemand.
            players: trailing.length < ranking.length ? trailing : [],
            baseSips: 3,
            label: 'am seltensten durchschaut',
            source: 'zwei-wahrheiten',
          }}
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  if (state.phase === 'write') {
    return (
      <GameFrame
        title={zweiWahrheiten.name}
        accent={zweiWahrheiten.accent}
        subtitle={`Runde ${progress}`}
        onQuit={quit}
      >
        {author && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <PlayerChip player={author} note={isAuthor ? 'du schreibst' : 'schreibt'} />
          </div>
        )}
        {isAuthor ? (
          <div className="stack-3">
            <p className="t-sub t-balance t-center">
              Zwei wahre Aussagen, eine erfundene. Markiere die Lüge – sie wird gemischt angezeigt.
            </p>
            {texts.map((t, i) => (
              <div key={i} className="lierow">
                <input
                  className="input"
                  placeholder={`Aussage ${i + 1}`}
                  maxLength={120}
                  value={t}
                  onChange={(e) => setTexts(texts.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button
                  className={`liemark ${lie === i ? 'liemark--on' : ''}`}
                  aria-label={`Aussage ${i + 1} ist die Lüge`}
                  aria-pressed={lie === i}
                  onClick={() => {
                    haptic('select');
                    setLie(i);
                  }}
                >
                  <Icon name="ban" size={17} />
                </button>
              </div>
            ))}
            <button
              className="btn btn--brand btn--block btn--lg"
              disabled={texts.some((t) => !t.trim())}
              onClick={() => {
                haptic('success');
                send({ type: 'submit', statements: texts, lie });
                setTexts(['', '', '']);
                setLie(0);
              }}
            >
              Abschicken
            </button>
          </div>
        ) : (
          <>
            <BigCard kicker="Gleich geht's los">{author?.name} denkt sich gerade etwas aus.</BigCard>
            <WaitingFor names={[author?.name ?? '']} what="Warten auf" />
          </>
        )}
      </GameFrame>
    );
  }

  const myGuess = state.guesses[me.id];

  if (state.phase === 'guess') {
    const waiting = players
      .filter((p) => p.id !== author?.id && p.online !== false && state.guesses[p.id] === undefined)
      .map((p) => p.name);
    return (
      <GameFrame
        title={zweiWahrheiten.name}
        accent={zweiWahrheiten.accent}
        subtitle={`Runde ${progress} · Welche ist gelogen?`}
        onQuit={quit}
      >
        {author && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <PlayerChip player={author} note="behauptet" />
          </div>
        )}
        <div className="stack-3">
          {state.statements.map((t, i) => (
            <button
              key={i}
              className={`answer-card ${myGuess === i ? 'answer-card--picked' : ''}`}
              style={{ ['--i' as string]: i }}
              disabled={isAuthor || myGuess !== undefined}
              onClick={() => {
                haptic('select');
                send({ type: 'guess', index: i });
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {(isAuthor || myGuess !== undefined) && <WaitingFor names={waiting} what="Warten auf" />}
      </GameFrame>
    );
  }

  // Wer offline gegangen ist, hat nicht danebengetippt – er war gar nicht da.
  const others = players.filter((p) => p.id !== author?.id && p.online !== false);
  const wrong = others.filter((p) => state.guesses[p.id] !== state.lie);
  const allRight = wrong.length === 0 && others.length > 0;

  return (
    <GameFrame
      title={zweiWahrheiten.name}
      accent={zweiWahrheiten.accent}
      subtitle={`Runde ${progress} · Aufgelöst`}
      onQuit={quit}
    >
      <div className="stack-3">
        {state.statements.map((t, i) => (
          <div
            key={i}
            className={`answer-card ${i === state.lie ? 'answer-card--lie' : 'answer-card--true'}`}
            style={{ ['--i' as string]: i }}
          >
            <span className="row" style={{ justifyContent: 'center', gap: 8 }}>
              <Icon name={i === state.lie ? 'ban' : 'check'} size={17} />
              {t}
            </span>
            <div className="t-caption">
              {others.filter((p) => state.guesses[p.id] === i).map((p) => p.name).join(', ') || '–'}
            </div>
          </div>
        ))}
      </div>
      {allRight && author ? (
        <DrinkCall
          player={author}
          baseSips={4}
          source="zwei-wahrheiten"
          label="alle durchschaut"
          resetKey={state.round}
        />
      ) : (
        <DrinkCallList
          players={wrong as GamePlayer[]}
          baseSips={3}
          source="zwei-wahrheiten"
          label="danebengetippt"
          resetKey={state.round}
        />
      )}
      <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
        {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächste Person'}
      </button>
    </GameFrame>
  );
}
