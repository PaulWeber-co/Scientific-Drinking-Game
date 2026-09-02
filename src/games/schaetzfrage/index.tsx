import { useState } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { GameFrame } from '../shared/GameFrame';
import { DrinkCallList } from '../shared/DrinkCall';
import { BigCard, WaitingFor } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';

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
  phase: 'guess' | 'result';
  q: number;
  deck: number[];
  guesses: Record<string, number>;
  round: number;
}

export const schaetzfrage: GameDefinition<State> = {
  id: 'schaetzfrage',
  name: 'Schätzfrage',
  tagline: 'Alle tippen eine Zahl. Am weitesten daneben trinkt.',
  icon: 'target',
  accent: 'var(--teal)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '10-20 Min',
  intensity: 1,
  tags: ['geheim', 'schnell'],
  requiresOwnDevice: true,
  howTo: [
    'Jede Person tippt ihre Schätzung auf dem eigenen Handy ein.',
    'Erst wenn alle abgegeben haben, wird aufgelöst.',
    'Wer am weitesten daneben liegt, trinkt. Wer am nächsten dran ist, geht frei aus.',
  ],

  createState: () => {
    const deck = shuffle(QUESTIONS.map((_, i) => i));
    return { phase: 'guess', q: deck[0], deck: deck.slice(1), guesses: {}, round: 1 };
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
        const deck = state.deck.length ? state.deck : shuffle(QUESTIONS.map((_, i) => i));
        return {
          phase: 'guess',
          q: deck[0],
          deck: deck.slice(1),
          guesses: {},
          round: state.round + 1,
        };
      }
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

  if (state.phase === 'guess') {
    const submitted = state.guesses[me.id] !== undefined;
    const waiting = players
      .filter((p) => p.online !== false && state.guesses[p.id] === undefined)
      .map((p) => p.name);
    return (
      <GameFrame
        title={schaetzfrage.name}
        accent={schaetzfrage.accent}
        subtitle={`Runde ${state.round}`}
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
      subtitle="Auflösung"
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
        Nächste Frage
      </button>
    </GameFrame>
  );
}
