import { useEffect } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { GameFrame } from '../shared/GameFrame';
import { DrinkCallList } from '../shared/DrinkCall';
import { BigCard, Countdown, PlayerChip } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { TABU_WORDS } from './words';

const ROUND_MS = 60_000;
const ROUNDS_PER_TEAM = 3;

type Team = 'A' | 'B';

interface State {
  teams: Record<Team, string[]>;
  turn: Team;
  explainer: Record<Team, number>;
  phase: 'ready' | 'playing' | 'result' | 'final';
  deck: number[];
  wordIndex: number | null;
  endsAt: number;
  hits: number;
  fouls: number;
  score: Record<Team, number>;
  round: number;
}

export const tabu: GameDefinition<State> = {
  id: 'tabu',
  name: 'Tabu Rush',
  tagline: 'Erklären ohne die verbotenen Wörter. Zwei Teams, 60 Sekunden.',
  emoji: '🚫',
  accent: 'var(--indigo)',
  minPlayers: 4,
  maxPlayers: 16,
  duration: '15-25 Min',
  intensity: 2,
  tags: ['team', 'schnell', 'reden'],
  requiresOwnDevice: false,
  howTo: [
    'Zwei Teams. Reihum erklärt eine Person Begriffe, ohne die verbotenen Wörter zu benutzen.',
    'Nur die erklärende Person schaut aufs Handy – alle anderen: Bildschirm tabu.',
    'Am Ende trinkt das Verliererteam die Punktedifferenz.',
  ],

  createState: (players) => {
    const ids = shuffle(players.map((p) => p.id));
    const teams: Record<Team, string[]> = { A: [], B: [] };
    ids.forEach((id, i) => teams[i % 2 === 0 ? 'A' : 'B'].push(id));
    return {
      teams,
      turn: 'A',
      explainer: { A: 0, B: 0 },
      phase: 'ready',
      deck: shuffle(TABU_WORDS.map((_, i) => i)),
      wordIndex: null,
      endsAt: 0,
      hits: 0,
      fouls: 0,
      score: { A: 0, B: 0 },
      round: 1,
    };
  },

  reduce: (state, action) => {
    const draw = (deck: number[]) => {
      const d = deck.length ? deck : shuffle(TABU_WORDS.map((_, i) => i));
      return { word: d[0], deck: d.slice(1) };
    };
    switch (action.type) {
      case 'start': {
        const { word, deck } = draw(state.deck);
        return {
          ...state,
          phase: 'playing',
          wordIndex: word,
          deck,
          endsAt: Date.now() + ROUND_MS,
          hits: 0,
          fouls: 0,
        };
      }
      case 'hit':
      case 'skip':
      case 'foul': {
        if (state.phase !== 'playing') return state;
        const { word, deck } = draw(state.deck);
        return {
          ...state,
          wordIndex: word,
          deck,
          hits: state.hits + (action.type === 'hit' ? 1 : 0),
          fouls: state.fouls + (action.type === 'foul' ? 1 : 0),
        };
      }
      case 'timeUp': {
        if (state.phase !== 'playing') return state;
        return {
          ...state,
          phase: 'result',
          score: { ...state.score, [state.turn]: state.score[state.turn] + state.hits },
        };
      }
      case 'next': {
        const done = state.round >= ROUNDS_PER_TEAM * 2;
        const turn: Team = state.turn === 'A' ? 'B' : 'A';
        return {
          ...state,
          phase: done ? 'final' : 'ready',
          round: state.round + 1,
          turn,
          explainer: {
            ...state.explainer,
            [state.turn]: state.explainer[state.turn] + 1,
          },
          wordIndex: null,
        };
      }
      default:
        return state;
    }
  },

  Component: TabuGame,
};

function TabuGame({ state, players, me, isHost, dispatch, quit, online }: GameRuntime<State>) {
  const byId = (id: string) => players.find((p) => p.id === id);
  const teamPlayers = (t: Team) => state.teams[t].map(byId).filter(Boolean) as GamePlayer[];
  const list = teamPlayers(state.turn);
  const explainer = list[state.explainer[state.turn] % Math.max(1, list.length)];
  const isExplainer = explainer?.id === me.id;
  // Auf einem Gerät wandert das Handy zur erklärenden Person.
  const canExplain = !online || isExplainer;
  const word = state.wordIndex != null ? TABU_WORDS[state.wordIndex] : null;
  const send = (a: GameActionInput) => dispatch(a);

  useEffect(() => {
    if (state.phase !== 'playing' || (!canExplain && !isHost)) return;
    const t = setInterval(() => {
      if (Date.now() >= state.endsAt) {
        haptic('warn');
        send({ type: 'timeUp' });
      }
    }, 250);
    return () => clearInterval(t);
  }, [state.phase, state.endsAt, canExplain, isHost]);

  const scoreLine = `Team A ${state.score.A} : ${state.score.B} Team B`;

  if (state.phase === 'final') {
    const diff = Math.abs(state.score.A - state.score.B);
    const loser: Team | null = state.score.A === state.score.B ? null : state.score.A < state.score.B ? 'A' : 'B';
    return (
      <GameFrame title={tabu.name} accent={tabu.accent} subtitle={scoreLine} onQuit={quit}>
        <BigCard kicker="Endstand">
          {loser ? `Team ${loser} verliert mit ${diff} Punkten Rückstand.` : 'Unentschieden. Alle trinken.'}
        </BigCard>
        <DrinkCallList
          players={loser ? teamPlayers(loser) : players}
          baseSips={Math.min(6, Math.max(2, diff))}
          source="tabu"
        />
        <button className="btn btn--brand btn--block btn--lg" onClick={quit}>
          Fertig
        </button>
      </GameFrame>
    );
  }

  return (
    <GameFrame
      title={tabu.name}
      accent={tabu.accent}
      subtitle={`${scoreLine} · Runde ${Math.min(state.round, ROUNDS_PER_TEAM * 2)}/${ROUNDS_PER_TEAM * 2}`}
      onQuit={quit}
    >
      <div className="row wrap" style={{ justifyContent: 'center' }}>
        <span className="chip" style={{ ['--tint' as string]: 'var(--indigo)' }}>
          Team {state.turn} ist dran
        </span>
        {explainer && <PlayerChip player={explainer} note={isExplainer ? 'du erklärst' : 'erklärt'} />}
      </div>

      {state.phase === 'ready' && (
        <>
          <BigCard kicker="Gleich geht's los">
            {isExplainer
              ? 'Nur du schaust aufs Handy. Alle anderen: wegschauen.'
              : `${explainer?.name} erklärt. Ihr ratet.`}
          </BigCard>
          <div className="grid-2">
            {(['A', 'B'] as Team[]).map((t) => (
              <div key={t} className="card">
                <div className="t-upper">Team {t}</div>
                <div className="stack-2" style={{ marginTop: 8 }}>
                  {teamPlayers(t).map((p) => (
                    <PlayerChip key={p.id} player={p} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn btn--brand btn--block btn--lg"
            disabled={online && !isExplainer}
            onClick={() => send({ type: 'start' })}
          >
            60 Sekunden starten
          </button>
        </>
      )}

      {state.phase === 'playing' && (
        <>
          <Countdown until={state.endsAt} />
          {canExplain && word ? (
            <>
              <BigCard kicker="Erkläre" footer={`${state.hits} Treffer · ${state.fouls} Tabu`}>
                {word.word}
              </BigCard>
              <div className="card">
                <div className="t-upper">Verboten</div>
                <div className="row wrap" style={{ marginTop: 8 }}>
                  {word.taboo.map((t) => (
                    <span key={t} className="chip" style={{ ['--tint' as string]: 'var(--red)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="stack-3">
                <button
                  className="btn btn--block btn--lg"
                  style={{ ['--btn-bg' as string]: 'var(--green)' }}
                  onClick={() => {
                    haptic('success');
                    send({ type: 'hit' });
                  }}
                >
                  Erraten ✓
                </button>
                <div className="grid-2">
                  <button className="btn btn--gray" onClick={() => send({ type: 'skip' })}>
                    Weiter
                  </button>
                  <button className="btn btn--danger" onClick={() => {
                    haptic('error');
                    send({ type: 'foul' });
                  }}>
                    Tabu!
                  </button>
                </div>
              </div>
            </>
          ) : (
            <BigCard kicker="Nicht schummeln">
              {explainer?.name} erklärt gerade. Handy weg und raten.
            </BigCard>
          )}
        </>
      )}

      {state.phase === 'result' && (
        <div className="stack-3">
          <BigCard kicker={`Team ${state.turn}`} footer={scoreLine}>
            {state.hits} {state.hits === 1 ? 'Treffer' : 'Treffer'} · {state.fouls} mal Tabu
          </BigCard>
          {state.fouls > 0 && explainer && (
            <DrinkCallList players={[explainer]} baseSips={Math.min(6, state.fouls * 2)} source="tabu" label="Tabu-Wörter" />
          )}
          <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
            Team wechseln
          </button>
        </div>
      )}
    </GameFrame>
  );
}
