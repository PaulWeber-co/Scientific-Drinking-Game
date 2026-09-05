import { Icon } from '../../components/icons';
import { useEffect, useState } from 'react';
import { haptic } from '../../lib/haptics';
import { pick, shuffle } from '../../lib/format';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { DrinkCall } from '../shared/DrinkCall';
import { BigCard, PlayerChip } from '../shared/pieces';
import { Explosion } from '../shared/Explosion';
import type { GameActionInput, GameDefinition, GameRuntime } from '../types';
import { meta } from './meta';

const CATEGORIES = [
  'Dinge, die im Kühlschrank stehen',
  'Automarken',
  'Serien, die alle kennen',
  'Dinge, die man auf einem Festival braucht',
  'Hauptstädte',
  'Cocktails',
  'Ausreden fürs Zuspätkommen',
  'Dinge, die weh tun',
  'Berühmte Paare',
  'Sportarten ohne Ball',
  'Dinge in einer Handtasche',
  'Flüsse und Seen',
  'Tiere mit mehr als vier Beinen',
  'Gründe, ein Date abzusagen',
  'Deutsche Städte mit mehr als 200.000 Einwohnern',
  'Dinge, die man nicht googeln sollte',
  'Pizzabeläge',
  'Superkräfte',
  'Dinge, die im Büro nerven',
  'Songs, die jeder mitsingen kann',
  'Marken, die es seit deiner Kindheit gibt',
  'Dinge im Weltall',
  'Berufe ohne Büro',
  'Was man auf einer Insel braucht',
  'Ausreden, um früher zu gehen',
  'Filme mit einem Wort im Titel',
  'Dinge, die man teilt',
  'Etwas, das man nie zurückbekommt',
];

/** Acht Explosionen sind bei „mittel" eine Partie – jede Runde dauert unter einer Minute. */
const ROUND_BASE = baseFor('wortbombe');

interface State {
  order: string[];
  holderIndex: number;
  phase: 'ready' | 'running' | 'boom' | 'over';
  category: string;
  explodesAt: number;
  round: number;
  /** Rundenzahl, nach der Schluss ist. `null` = ohne Ende. */
  goal: number | null;
  losses: Record<string, number>;
}

export const wortbombe: GameDefinition<State> = {
  ...meta,

  createState: (players) => ({
    order: shuffle(players.map((p) => p.id)),
    holderIndex: 0,
    phase: 'ready',
    category: pick(CATEGORIES),
    explodesAt: 0,
    round: 1,
    goal: roundGoal(ROUND_BASE),
    losses: {},
  }),

  reduce: (state, action, players) => {
    switch (action.type) {
      case 'start':
        return {
          ...state,
          phase: 'running',
          category: pick(CATEGORIES),
          // Zwischen 22 und 75 Sekunden – niemand kann mitzählen.
          explodesAt: Date.now() + 22_000 + Math.random() * 53_000,
        };
      case 'pass': {
        if (state.phase !== 'running') return state;
        const ids = new Set(players.map((p) => p.id));
        const order = [
          ...state.order.filter((id) => ids.has(id)),
          ...players.filter((p) => !state.order.includes(p.id)).map((p) => p.id),
        ];
        return { ...state, order, holderIndex: (state.holderIndex + 1) % Math.max(1, order.length) };
      }
      case 'boom': {
        if (state.phase !== 'running') return state;
        const loser = state.order[state.holderIndex];
        return {
          ...state,
          phase: 'boom',
          losses: { ...state.losses, [loser]: (state.losses[loser] ?? 0) + 1 },
        };
      }
      case 'next': {
        // Nur aus der Auflösung heraus: zwei fast gleichzeitige Taps auf
        // „Weiter" würden sonst zwei Runden zählen, und die letzte Runde
        // fiele still aus. Die Inbox wendet Aktionen nacheinander an.
        if (state.phase !== 'boom') return state;
        const round = state.round + 1;
        if (isOver(round, state.goal)) return { ...state, round, phase: 'over' };
        return {
          ...state,
          phase: 'ready',
          round,
          holderIndex: (state.holderIndex + 1) % Math.max(1, state.order.length),
        };
      }
      case 'restart':
        return wortbombe.createState(players);
      default:
        return state;
    }
  },

  Component: WortbombeGame,
};

function WortbombeGame({ state, players, me, isHost, dispatch, quit, online }: GameRuntime<State>) {
  const holder = players.find((p) => p.id === state.order[state.holderIndex]) ?? players[0];
  const isHolder = holder?.id === me.id;
  const send = (a: GameActionInput) => dispatch(a);
  // 0 = gerade scharf gemacht, 1 = gleich knallt es. Treibt Puls und Vibration.
  const [tension, setTension] = useState(0);

  useEffect(() => {
    if (state.phase !== 'running') {
      setTension(0);
      return;
    }
    const total = Math.max(1, state.explodesAt - Date.now());
    const t = setInterval(() => {
      const left = Math.max(0, state.explodesAt - Date.now());
      setTension(1 - left / total);
    }, 120);
    return () => clearInterval(t);
  }, [state.phase, state.explodesAt]);

  // Die Bombe zündet auf dem Gerät des Halters (und beim Host als Rückfall).
  useEffect(() => {
    if (state.phase !== 'running') return;
    if (online && !isHolder && !isHost) return;
    const check = () => {
      if (Date.now() >= state.explodesAt) {
        haptic('error');
        send({ type: 'boom' });
      }
    };
    const t = setInterval(check, 250);
    return () => clearInterval(t);
  }, [state.phase, state.explodesAt, isHolder, isHost, online]);

  // Ticken über Vibration – wird schneller, je näher der Knall kommt.
  useEffect(() => {
    if (state.phase !== 'running' || (online && !isHolder)) return;
    const interval = Math.max(160, 900 - tension * 700);
    const t = setInterval(() => haptic('tap'), interval);
    return () => clearInterval(t);
  }, [state.phase, isHolder, online, tension]);

  if (state.phase === 'over') {
    const rows = players.map((p) => ({
      player: p,
      value: state.losses[p.id] ?? 0,
      unit: 'Verlust',
      unitPlural: 'Verluste',
    }));
    const values = rows.map((r) => r.value);
    const most = values.length ? Math.max(...values) : 0;
    const fewest = values.length ? Math.min(...values) : 0;
    const top = rows.filter((r) => r.value === most).map((r) => r.player);
    return (
      <GameFrame title={wortbombe.name} accent={wortbombe.accent} subtitle="Ausgezählt" onQuit={quit}>
        <GameOver
          headline={`${state.round - 1} Runden. Ganz oben steht, wem die Bombe am häufigsten in der Hand hochging.`}
          ranking={rows}
          rankingTitle="Wem die Bombe am häufigsten hochging"
          rankHighIsBad
          finalCall={
            // Nur wenn es wirklich ein Schlusslicht gibt – bei Gleichstand
            // träfe die Ansage die ganze Runde und sagte damit nichts.
            most > fewest
              ? { players: top, baseSips: 4, label: 'die meisten Bomben', source: 'wortbombe' }
              : undefined
          }
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  return (
    <GameFrame
      title={wortbombe.name}
      accent={wortbombe.accent}
      subtitle={state.goal ? `Runde ${state.round}/${state.goal}` : `Runde ${state.round}`}
      onQuit={quit}
    >
      <BigCard kicker="Kategorie" tone={state.phase === 'boom' ? 'danger' : 'default'}>
        {state.category}
      </BigCard>

      <div className="row" style={{ justifyContent: 'center' }}>
        <PlayerChip player={holder} note={isHolder ? 'du hast die Bombe' : 'hat die Bombe'} />
      </div>

      {state.phase === 'ready' && (
        <>
          <div className="t-center t-sub t-balance">
            {online
              ? 'Die Bombe springt von Handy zu Handy. Wer sie hat, sagt ein Wort und tippt weiter.'
              : 'Legt das Handy in die Mitte. Es wird reihum weitergereicht.'}
          </div>
          <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'start' })}>
            <Icon name="bomb" size={20} /> Bombe scharf machen
          </button>
        </>
      )}

      {state.phase === 'running' && (
        <>
          <div
            className={`bomb-pulse ${tension > 0.7 ? 'bomb-pulse--hot' : ''}`}
            style={{ ['--tension' as string]: tension.toFixed(2) }}
          >
            <Icon name="bomb" size={84} strokeWidth={1.2} />
          </div>
          <button
            className="btn btn--brand btn--block btn--lg"
            disabled={online && !isHolder}
            onClick={() => {
              haptic('heavy');
              send({ type: 'pass' });
            }}
          >
            {online && !isHolder ? `${holder?.name} ist dran` : 'Wort gesagt – weitergeben'}
          </button>
        </>
      )}

      {state.phase === 'boom' && (
        <div className="stack-3 shake">
          <Explosion />
          <BigCard tone="danger" kicker="Boom">
            {holder?.name} hatte die Bombe.
          </BigCard>
          <DrinkCall player={holder} baseSips={5} source="wortbombe" resetKey={state.round} />
          <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
            {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächste Runde'}
          </button>
        </div>
      )}
    </GameFrame>
  );
}
