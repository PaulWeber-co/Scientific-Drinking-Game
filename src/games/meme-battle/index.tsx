import { useState } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { spicyDeck } from '../shared/prompts';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { DrinkCallList } from '../shared/DrinkCall';
import { BigCard, WaitingFor } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { meta } from './meta';

interface Prompt {
  text: string;
  spicy?: boolean;
}

const PROMPTS: Prompt[] = [
  { text: 'Der Titel des Films über diese Party wäre …' },
  { text: 'Die schlechteste Antwort auf „Wir müssen reden" ist …' },
  { text: 'Was steht auf dem Grabstein von diesem Abend?' },
  { text: 'Eine App, die niemand braucht, aber alle installieren würden: …' },
  { text: 'Die ehrlichste Bewertung dieser Wohnung wäre …' },
  { text: 'Der Werbeslogan für Montagmorgen: …' },
  { text: 'Was denkt der Kühlschrank um 3 Uhr nachts?' },
  { text: 'Ein Satz, den man nie zu seinem Chef sagen sollte: …' },
  { text: 'Die peinlichste Art, eine Party zu verlassen: …' },
  { text: 'Was flüstert dein Handy, wenn es auf 1 % fällt?' },
  { text: 'Der neue Pflichtkurs an jeder Schule sollte heißen: …' },
  { text: 'Eine Sportart, die es geben sollte: …' },
  { text: 'Der schlechteste Name für eine Bar: …' },
  { text: 'Was wäre die Superkraft, die niemand will?' },
  { text: 'Die Autokorrektur macht aus „Ich liebe dich" …' },
  { text: 'Die letzte Nachricht der Menschheit lautet: …' },
  { text: 'Was ruft man beim Bungee-Sprung statt „Aaaah"?' },
  { text: 'Ein Feiertag, den Deutschland dringend braucht: …' },
  { text: 'Der ehrlichste Untertitel für dein LinkedIn-Profil: …' },
  { text: 'Ein Getränk, das es nie geben sollte: …' },
  { text: 'Die schlimmste Belohnung für gute Arbeit ist …' },
  { text: 'Was steht in der Bedienungsanleitung für diese Runde?' },
  { text: 'Ein Podcast, den nur eine Person hören würde, heißt: …' },
  { text: 'Der Grund, warum Aliens uns bisher meiden: …' },
  { text: 'Was sagt dein Wecker wirklich, wenn er klingelt?' },
  { text: 'Die neue Geschmacksrichtung, die scheitern wird: …' },
  { text: 'Ein Warnschild, das an jeder Haustür hängen sollte: …' },
  { text: 'Die schlechteste Ausrede für Verspätung ist …' },
  { text: 'Ein Buchtitel, der sich nie verkauft: …' },
  { text: 'Was würde dein Haustier über dich posten?' },

  // Spicy – nur im Stapel, wenn der Schalter an ist.
  { text: 'Die schlimmste Nachricht nach einem ersten Date: …', spicy: true },
  { text: 'Ein Anmachspruch, der garantiert nach hinten losgeht: …', spicy: true },
  { text: 'Die rote Flagge, über die du trotzdem hinwegsiehst: …', spicy: true },
  { text: 'Was in deiner Dating-Bio stünde, wenn du komplett ehrlich wärst: …', spicy: true },
  { text: 'Der schlechteste Ort für ein erstes Date: …', spicy: true },
  { text: 'Was denkt dein Ex gerade über dich?', spicy: true },
  { text: 'Der Satz, nach dem jedes Date sofort vorbei ist: …', spicy: true },
  { text: 'Die ehrlichste Antwort auf „Wie war ich?": …', spicy: true },
];

/** Fünf Prompts sind bei „mittel" eine runde Partie – danach wiederholen sich die Pointen. */
const ROUND_BASE = baseFor('meme-battle');

interface State {
  phase: 'writing' | 'voting' | 'results' | 'over';
  prompt: number;
  deck: number[];
  answers: Record<string, string>;
  votes: Record<string, string>;
  scores: Record<string, number>;
  round: number;
  /** Rundenzahl, nach der Schluss ist. `null` = ohne Ende. */
  goal: number | null;
  /** Reihenfolge, in der die Antworten gezeigt werden (anonym). */
  reveal: string[];
}

export const memeBattle: GameDefinition<State> = {
  ...meta,

  createState: (players) => {
    const deck = spicyDeck(PROMPTS, 'meme-battle');
    return {
      phase: 'writing',
      prompt: deck[0],
      deck: deck.slice(1),
      answers: {},
      votes: {},
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      round: 1,
      goal: roundGoal(ROUND_BASE),
      reveal: [],
    };
  },

  reduce: (state, action, players) => {
    const active = players.filter((p) => p.online !== false).map((p) => p.id);
    switch (action.type) {
      case 'submit': {
        if (state.phase !== 'writing') return state;
        const text = String(action.text ?? '').slice(0, 140).trim();
        if (!text) return state;
        const answers = { ...state.answers, [action.by]: text };
        const done = active.every((id) => answers[id]);
        return {
          ...state,
          answers,
          phase: done ? 'voting' : 'writing',
          reveal: done ? shuffle(Object.keys(answers)) : state.reveal,
        };
      }
      case 'vote': {
        if (state.phase !== 'voting') return state;
        const target = String(action.target);
        if (target === action.by) return state;
        const votes = { ...state.votes, [action.by]: target };
        const voters = active.filter((id) => state.answers[id]);
        const done = voters.every((id) => votes[id]);
        if (!done) return { ...state, votes };
        const scores = { ...state.scores };
        for (const t of Object.values(votes)) scores[t] = (scores[t] ?? 0) + 1;
        return { ...state, votes, scores, phase: 'results' };
      }
      case 'next': {
        // Ein zurückgebliebenes Gerät darf die beendete Partie nicht weiterzählen.
        if (state.phase === 'over') return state;
        const round = state.round + 1;
        if (isOver(round, state.goal)) return { ...state, round, phase: 'over' };
        const deck = state.deck.length ? state.deck : spicyDeck(PROMPTS, 'meme-battle');
        return {
          ...state,
          phase: 'writing',
          prompt: deck[0],
          deck: deck.slice(1),
          answers: {},
          votes: {},
          reveal: [],
          round,
        };
      }
      case 'restart':
        return memeBattle.createState(players);
      default:
        return state;
    }
  },

  Component: MemeBattleGame,
};

function MemeBattleGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  const [draft, setDraft] = useState('');
  const send = (a: GameActionInput) => dispatch(a);
  const byId = (id: string) => players.find((p) => p.id === id);
  const prompt = PROMPTS[state.prompt]?.text ?? '';

  if (!online) {
    return (
      <GameFrame title={memeBattle.name} accent={memeBattle.accent} onQuit={quit}>
        <BigCard kicker="Eigene Handys nötig">
          Meme Battle lebt davon, dass niemand die Antworten der anderen sieht. Startet dafür eine
          Online-Lobby – dann schreibt jede Person auf ihrem eigenen Handy.
        </BigCard>
        <button className="btn btn--brand btn--block btn--lg" onClick={quit}>
          Zurück
        </button>
      </GameFrame>
    );
  }

  if (state.phase === 'over') {
    const rows = players.map((p) => ({ player: p, value: state.scores[p.id] ?? 0, unit: 'Stimme' }));
    const values = rows.map((r) => r.value);
    const best = values.length ? Math.max(...values) : 0;
    const worst = values.length ? Math.min(...values) : 0;
    const champions = rows.filter((r) => r.value === best);
    const last = rows.filter((r) => r.value === worst).map((r) => r.player);
    return (
      <GameFrame
        title={memeBattle.name}
        accent={memeBattle.accent}
        subtitle="Ausgespielt"
        onQuit={quit}
      >
        <GameOver
          headline={
            champions.length === 1
              ? `${state.round - 1} Prompts. ${champions[0].player.name} hat die meisten Stimmen geholt.`
              : `${state.round - 1} Prompts. An der Spitze bleibt es unentschieden.`
          }
          ranking={rows}
          rankingTitle="Die meisten Stimmen"
          finalCall={
            // Nur wenn es wirklich ein Schlusslicht gibt – sonst trinkt die
            // ganze Runde für ein Ergebnis, das keins ist.
            best > worst
              ? { players: last, baseSips: 4, label: 'am wenigsten Stimmen', source: 'meme-battle' }
              : undefined
          }
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  if (state.phase === 'writing') {
    const submitted = !!state.answers[me.id];
    const waiting = players.filter((p) => p.online !== false && !state.answers[p.id]).map((p) => p.name);
    return (
      <GameFrame
        title={memeBattle.name}
        accent={memeBattle.accent}
        subtitle={state.goal ? `Runde ${state.round}/${state.goal}` : `Runde ${state.round}`}
        onQuit={quit}
      >
        <BigCard kicker="Prompt">{prompt}</BigCard>
        {submitted ? (
          <WaitingFor names={waiting} what="Warten auf" />
        ) : (
          <div className="stack-3">
            <textarea
              className="input"
              placeholder="Deine Pointe …"
              maxLength={140}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="row-between">
              <span className="t-caption">{draft.length}/140</span>
              <button
                className="btn btn--brand"
                disabled={!draft.trim()}
                onClick={() => {
                  haptic('success');
                  send({ type: 'submit', text: draft });
                  setDraft('');
                }}
              >
                Abschicken
              </button>
            </div>
          </div>
        )}
      </GameFrame>
    );
  }

  if (state.phase === 'voting') {
    const myVote = state.votes[me.id];
    const waiting = players
      .filter((p) => p.online !== false && state.answers[p.id] && !state.votes[p.id])
      .map((p) => p.name);
    return (
      <GameFrame title={memeBattle.name} accent={memeBattle.accent} subtitle="Abstimmen" onQuit={quit}>
        <BigCard kicker="Prompt">{prompt}</BigCard>
        <div className="stack-3">
          {state.reveal.map((authorId) => (
            <button
              key={authorId}
              className={`answer-card ${myVote === authorId ? 'answer-card--picked' : ''}`}
              disabled={!!myVote || authorId === me.id}
              onClick={() => {
                haptic('select');
                send({ type: 'vote', target: authorId });
              }}
            >
              {state.answers[authorId]}
              {authorId === me.id && <div className="t-caption">deine Antwort</div>}
            </button>
          ))}
        </div>
        {myVote && <WaitingFor names={waiting} what="Warten auf" />}
      </GameFrame>
    );
  }

  const counts: Record<string, number> = {};
  for (const t of Object.values(state.votes)) counts[t] = (counts[t] ?? 0) + 1;
  const ranked = state.reveal
    .map((id) => ({ id, votes: counts[id] ?? 0 }))
    .sort((a, b) => b.votes - a.votes);
  const minVotes = ranked.length ? ranked[ranked.length - 1].votes : 0;
  const losers = ranked.filter((r) => r.votes === minVotes).map((r) => byId(r.id)).filter(Boolean) as GamePlayer[];

  return (
    <GameFrame title={memeBattle.name} accent={memeBattle.accent} subtitle="Ergebnis" onQuit={quit}>
      <BigCard kicker="Prompt">{prompt}</BigCard>
      <div className="stack-2">
        {ranked.map((r, i) => (
          <div key={r.id} className="result-row">
            <div className="result-row__rank">{i + 1}</div>
            <div className="grow">
              <div className="t-headline">{state.answers[r.id]}</div>
              <div className="t-caption">
                {byId(r.id)?.name} · {r.votes}{' '}
                {r.votes === 1 ? 'Stimme' : 'Stimmen'}
              </div>
            </div>
          </div>
        ))}
      </div>
      <DrinkCallList
        players={losers}
        // Gar keine Stimme ist mehr als nur wenige – das darf man spüren.
        baseSips={minVotes === 0 ? 5 : 3}
        source="meme-battle"
        label={minVotes === 0 ? 'keine einzige Stimme' : 'wenig Stimmen'}
        resetKey={state.round}
      />
      <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
        {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächster Prompt'}
      </button>
    </GameFrame>
  );
}
