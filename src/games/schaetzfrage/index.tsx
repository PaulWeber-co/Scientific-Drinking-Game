import { useState } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { DrinkCallList } from '../shared/DrinkCall';
import { BigCard, WaitingFor } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { meta } from './meta';

interface Question {
  q: string;
  answer: number;
  unit: string;
}

const QUESTIONS: Question[] = [
  { q: 'Wie viele Liter Bier trinkt Deutschland pro Kopf und Jahr?', answer: 88, unit: 'Liter' },
  { q: 'Wie viele Knochen hat ein erwachsener Mensch?', answer: 206, unit: 'Knochen' },
  { q: 'Wie viele Inseln gehören zu Griechenland (bewohnt und unbewohnt)?', answer: 6000, unit: 'Inseln' },
  { q: 'Wie viele Minuten dauert ein Fußballspiel inklusive Halbzeitpause?', answer: 105, unit: 'Minuten' },
  { q: 'Wie hoch ist der Eiffelturm?', answer: 330, unit: 'Meter' },
  { q: 'Wie viele Zähne hat ein erwachsener Mensch mit Weisheitszähnen?', answer: 32, unit: 'Zähne' },
  { q: 'Wie viele Tasten hat ein Standard-Klavier?', answer: 88, unit: 'Tasten' },
  { q: 'Wie viele Einwohner hat Berlin (in Tausend)?', answer: 3800, unit: 'Tausend' },
  { q: 'Wie viele Sekunden hat ein Tag?', answer: 86400, unit: 'Sekunden' },
  { q: 'Wie tief ist der Marianengraben?', answer: 11000, unit: 'Meter' },
  { q: 'Wie viele Bundesländer hat Österreich?', answer: 9, unit: 'Bundesländer' },
  { q: 'Wie viele Kilometer ist der Mond von der Erde entfernt (in Tausend)?', answer: 384, unit: 'Tausend km' },
  { q: 'Wie viele Kalorien hat ein halber Liter Bier ungefähr?', answer: 210, unit: 'kcal' },
  { q: 'Wie viele Sprachen werden weltweit gesprochen?', answer: 7000, unit: 'Sprachen' },
  { q: 'Wie alt wurde der älteste dokumentierte Mensch?', answer: 122, unit: 'Jahre' },
  { q: 'Wie viele Herzschläge hat ein Mensch pro Tag ungefähr?', answer: 100000, unit: 'Schläge' },
  { q: 'Wie viele Länder gibt es in Afrika?', answer: 54, unit: 'Länder' },
  { q: 'Wie schnell fährt ein ICE maximal?', answer: 300, unit: 'km/h' },
  { q: 'Wie viele Stufen hat der Kölner Dom bis zur Aussichtsplattform?', answer: 533, unit: 'Stufen' },
  { q: 'Wie viele Muskeln hat der menschliche Körper ungefähr?', answer: 650, unit: 'Muskeln' },
  { q: 'Wie viele Folgen hat die Serie Simpsons ungefähr?', answer: 780, unit: 'Folgen' },
  { q: 'Wie viele Grad hat die Sonnenoberfläche?', answer: 5500, unit: 'Grad' },
  { q: 'Wie viele Liter Wasser passen in eine normale Badewanne?', answer: 150, unit: 'Liter' },
  { q: 'Wie viele Buchstaben hat das deutsche Alphabet inklusive Umlauten und ß?', answer: 30, unit: 'Buchstaben' },
  { q: 'Wie viele Minuten braucht Licht von der Sonne zur Erde?', answer: 8, unit: 'Minuten' },
  { q: 'Wie viele Kilometer hat der Rhein?', answer: 1230, unit: 'Kilometer' },
];

interface State {
  phase: 'guess' | 'result' | 'over';
  q: number;
  deck: number[];
  guesses: Record<string, number>;
  round: number;
  goal: number | null;
  /** Wie oft jemand am nächsten an der Wahrheit lag. */
  wins: Record<string, number>;
}

/** Eine Runde ist eine Frage. Sechs davon sind eine „mittlere" Partie. */
const ROUND_BASE = baseFor('schaetzfrage');

/** Wer am nächsten dran lag, bekommt den Punkt – bei Gleichstand alle. */
function scoreRound(state: State): Record<string, number> {
  const ids = Object.keys(state.guesses);
  if (!ids.length) return state.wins;
  const answer = QUESTIONS[state.q].answer;
  const off = (id: string) => Math.abs(state.guesses[id] - answer);
  const best = Math.min(...ids.map(off));
  const wins = { ...state.wins };
  for (const id of ids) if (off(id) === best) wins[id] = (wins[id] ?? 0) + 1;
  return wins;
}

export const schaetzfrage: GameDefinition<State> = {
  ...meta,

  createState: () => {
    const deck = shuffle(QUESTIONS.map((_, i) => i));
    return {
      phase: 'guess',
      q: deck[0],
      deck: deck.slice(1),
      guesses: {},
      round: 1,
      goal: roundGoal(ROUND_BASE),
      wins: {},
    };
  },

  reduce: (state, action, players) => {
    const active = players.filter((p) => p.online !== false).map((p) => p.id);
    switch (action.type) {
      case 'guess': {
        if (state.phase !== 'guess') return state;
        const value = Number(action.value);
        if (!Number.isFinite(value)) return state;
        const guesses = { ...state.guesses, [action.by]: value };
        const done = active.every((id) => guesses[id] !== undefined);
        return { ...state, guesses, phase: done ? 'result' : 'guess' };
      }
      case 'next': {
        // Nur aus der Auflösung heraus: zwei fast gleichzeitige Taps auf
        // „Weiter" würden sonst zwei Runden zählen, und die letzte Runde
        // fiele still aus. Die Inbox wendet Aktionen nacheinander an.
        if (state.phase !== 'result') return state;
        const deck = state.deck.length ? state.deck : shuffle(QUESTIONS.map((_, i) => i));
        const round = state.round + 1;
        // Gezählt wird nur, was auch aufgelöst wurde.
        const wins = state.phase === 'result' ? scoreRound(state) : state.wins;
        if (isOver(round, state.goal)) return { ...state, round, wins, phase: 'over' };
        return {
          ...state,
          phase: 'guess',
          q: deck[0],
          deck: deck.slice(1),
          guesses: {},
          round,
          wins,
        };
      }
      case 'restart':
        return schaetzfrage.createState(players);
      default:
        return state;
    }
  },

  Component: SchaetzfrageGame,
};

const de = (n: number) => n.toLocaleString('de-DE');

function SchaetzfrageGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  const [draft, setDraft] = useState('');
  const send = (a: GameActionInput) => dispatch(a);
  const question = QUESTIONS[state.q];

  if (!online) {
    return (
      <GameFrame title={schaetzfrage.name} accent={schaetzfrage.accent} onQuit={quit}>
        <BigCard kicker="Eigene Handys nötig">
          Alle müssen gleichzeitig und geheim schätzen. Startet dafür eine Online-Lobby.
        </BigCard>
        <button className="btn btn--brand btn--block btn--lg" onClick={quit}>
          Zurück
        </button>
      </GameFrame>
    );
  }

  const progress = state.goal ? `${Math.min(state.round, state.goal)}/${state.goal}` : `${state.round}`;

  if (state.phase === 'over') {
    const contenders = players.filter((p) => p.online !== false);
    const ranking = contenders.map((p) => ({
      player: p,
      value: state.wins[p.id] ?? 0,
      unit: 'Runde',
    }));
    const fewest = Math.min(...ranking.map((r) => r.value));
    const trailing = ranking.filter((r) => r.value === fewest).map((r) => r.player);
    return (
      <GameFrame
        title={schaetzfrage.name}
        accent={schaetzfrage.accent}
        subtitle="Vorbei"
        onQuit={quit}
      >
        <GameOver
          headline={`${state.goal ?? state.round - 1} Fragen geschätzt. Oben steht, wer am häufigsten am nächsten dran war.`}
          ranking={ranking}
          rankingTitle="Wer am häufigsten am nächsten dran war"
          finalCall={{
            // Liegen alle gleichauf, gibt es kein Schlusslicht – dann trinkt niemand.
            players: trailing.length < ranking.length ? trailing : [],
            baseSips: 4,
            label: 'am seltensten nah dran',
            source: 'schaetzfrage',
          }}
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  if (state.phase === 'guess') {
    const submitted = state.guesses[me.id] !== undefined;
    const waiting = players
      .filter((p) => p.online !== false && state.guesses[p.id] === undefined)
      .map((p) => p.name);
    return (
      <GameFrame
        title={schaetzfrage.name}
        accent={schaetzfrage.accent}
        subtitle={`Runde ${progress}`}
        onQuit={quit}
      >
        <BigCard kicker={`Antwort in ${question.unit}`}>{question.q}</BigCard>
        {submitted ? (
          <WaitingFor names={waiting} what="Warten auf" />
        ) : (
          <div className="stack-3">
            <input
              className="input input--center"
              type="number"
              inputMode="numeric"
              placeholder="Deine Schätzung"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              className="btn btn--brand btn--block btn--lg"
              disabled={draft.trim() === ''}
              onClick={() => {
                haptic('success');
                send({ type: 'guess', value: Number(draft) });
                setDraft('');
              }}
            >
              Abgeben
            </button>
          </div>
        )}
      </GameFrame>
    );
  }

  const ranked = players
    .filter((p) => state.guesses[p.id] !== undefined)
    .map((p) => ({ p, guess: state.guesses[p.id], off: Math.abs(state.guesses[p.id] - question.answer) }))
    .sort((a, b) => a.off - b.off);
  const worstOff = ranked.length ? ranked[ranked.length - 1].off : 0;
  const losers = ranked.filter((r) => r.off === worstOff).map((r) => r.p) as GamePlayer[];

  return (
    <GameFrame
      title={schaetzfrage.name}
      accent={schaetzfrage.accent}
      subtitle={`Runde ${progress} · Auflösung`}
      onQuit={quit}
    >
      <BigCard kicker={question.q}>
        {de(question.answer)} {question.unit}
      </BigCard>
      <div className="stack-2">
        {ranked.map((r, i) => (
          <div key={r.p.id} className="result-row" style={{ ['--i' as string]: i }}>
            <div className="result-row__rank">{i + 1}</div>
            <div className="grow">
              <div className="t-headline">{r.p.name}</div>
              <div className="t-caption">
                {de(r.guess)} · {r.off === 0 ? 'exakt' : `${de(r.off)} daneben`}
              </div>
            </div>
          </div>
        ))}
      </div>
      <DrinkCallList
        players={losers}
        baseSips={4}
        source="schaetzfrage"
        label="am weitesten weg"
        resetKey={state.round}
      />
      <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
        {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächste Frage'}
      </button>
    </GameFrame>
  );
}
