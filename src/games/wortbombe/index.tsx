import { Icon } from '../../components/icons';
import { useEffect } from 'react';
import { haptic } from '../../lib/haptics';
import { pick, shuffle } from '../../lib/format';
import { GameFrame } from '../shared/GameFrame';
import { DrinkCall } from '../shared/DrinkCall';
import { BigCard, PlayerChip } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GameRuntime } from '../types';

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

interface State {
  order: string[];
  holderIndex: number;
  phase: 'ready' | 'running' | 'boom';
  category: string;
  explodesAt: number;
  round: number;
  losses: Record<string, number>;
}

export const wortbombe: GameDefinition<State> = {
  id: 'wortbombe',
  name: 'Wortbombe',
  tagline: 'Ein Wort sagen, weitergeben, nicht explodieren.',
  icon: 'bomb',
  accent: 'var(--pink)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '5-20 Min',
  intensity: 2,
  tags: ['handy-weg', 'schnell', 'bewegung'],
  requiresOwnDevice: false,
  howTo: [
    'Auf einem Handy: die Bombe wird herumgereicht. Mit eigenen Handys: sie springt von selbst weiter.',
    'Wer die Bombe hat, nennt ein passendes Wort und gibt sofort weiter.',
    'Wer sie in der Hand hält, wenn sie hochgeht, trinkt.',
  ],

  createState: (players) => ({
    order: shuffle(players.map((p) => p.id)),
    holderIndex: 0,
    phase: 'ready',
    category: pick(CATEGORIES),
    explodesAt: 0,
    round: 1,
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
      case 'next':
        return {
          ...state,
          phase: 'ready',
          round: state.round + 1,
          holderIndex: (state.holderIndex + 1) % Math.max(1, state.order.length),
        };
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

  // Leises Ticken über Vibration, damit die Spannung spürbar ist.
  useEffect(() => {
    if (state.phase !== 'running' || (online && !isHolder)) return;
    const t = setInterval(() => haptic('tap'), 900);
    return () => clearInterval(t);
  }, [state.phase, isHolder, online]);

  return (
    <GameFrame
      title={wortbombe.name}
      accent={wortbombe.accent}
      subtitle={`Runde ${state.round}`}
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
          <div className="bomb-pulse">
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
        <div className="stack-3">
          <BigCard tone="danger" kicker="Boom">
            {holder?.name} hatte die Bombe.
          </BigCard>
          <DrinkCall player={holder} baseSips={5} source="wortbombe" />
          <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
            Nächste Runde
          </button>
        </div>
      )}
    </GameFrame>
  );
}
