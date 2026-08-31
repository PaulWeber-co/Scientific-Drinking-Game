import { useEffect } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { Icon } from '../../components/icons';
import { GameFrame } from '../shared/GameFrame';
import { DrinkCall } from '../shared/DrinkCall';
import { BigCard, PlayerChip } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';

interface State {
  phase: 'ready' | 'armed' | 'go' | 'result';
  order: string[];
  pairIndex: number;
  goAt: number;
  winner: string | null;
  loser: string | null;
  falseStart: boolean;
  round: number;
}

function pairFor(order: string[], i: number): [string, string] {
  const n = Math.max(2, order.length);
  return [order[i % n], order[(i + 1) % n]];
}

export const duell: GameDefinition<State> = {
  id: 'duell',
  name: 'Reaktions-Duell',
  tagline: 'Handy in die Mitte. Wer zu langsam tippt, trinkt.',
  icon: 'bolt',
  accent: 'var(--red)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '5-15 Min',
  intensity: 2,
  tags: ['handy-weg', 'schnell', 'bewegung'],
  requiresOwnDevice: false,
  howTo: [
    'Ein Handy liegt zwischen zwei Personen – jede bekommt eine Bildschirmhälfte.',
    'Sobald der Bildschirm grün wird, so schnell wie möglich auf die eigene Seite tippen.',
    'Zu früh getippt heisst sofort verloren. Die langsamere Person trinkt.',
  ],

  createState: (players) => ({
    phase: 'ready',
    order: shuffle(players.map((p) => p.id)),
    pairIndex: 0,
    goAt: 0,
    winner: null,
    loser: null,
    falseStart: false,
    round: 1,
  }),

  reduce: (state, action, players) => {
    switch (action.type) {
      case 'arm':
        return {
          ...state,
          phase: 'armed',
          // Zwischen 1,8 und 6 Sekunden – kurz genug für Spannung, lang genug
          // dass niemand den Moment vorhersagen kann.
          goAt: Date.now() + 1800 + Math.random() * 4200,
          winner: null,
          loser: null,
          falseStart: false,
        };
      case 'go':
        if (state.phase !== 'armed') return state;
        return { ...state, phase: 'go' };
      case 'tap': {
        const side = Number(action.side);
        const [left, right] = pairFor(state.order, state.pairIndex);
        const tapper = side === 0 ? left : right;
        const other = side === 0 ? right : left;
        if (state.phase === 'armed') {
          return { ...state, phase: 'result', falseStart: true, loser: tapper, winner: other };
        }
        if (state.phase !== 'go') return state;
        return { ...state, phase: 'result', winner: tapper, loser: other, falseStart: false };
      }
      case 'next': {
        const ids = new Set(players.map((p) => p.id));
        const order = [
          ...state.order.filter((id) => ids.has(id)),
          ...players.filter((p) => !state.order.includes(p.id)).map((p) => p.id),
        ];
        return {
          ...state,
          order,
          pairIndex: (state.pairIndex + 1) % Math.max(1, order.length),
          phase: 'ready',
          winner: null,
          loser: null,
          falseStart: false,
          round: state.round + 1,
        };
      }
      default:
        return state;
    }
  },

  Component: DuellGame,
};

function DuellGame({ state, players, isHost, dispatch, quit }: GameRuntime<State>) {
  const send = (a: GameActionInput) => dispatch(a);
  const byId = (id: string | null) => players.find((p) => p.id === id) ?? null;
  const [leftId, rightId] = pairFor(state.order, state.pairIndex);
  const left = byId(leftId);
  const right = byId(rightId);

  useEffect(() => {
    if (state.phase !== 'armed' || !isHost) return;
    const t = setInterval(() => {
      if (Date.now() >= state.goAt) {
        haptic('heavy');
        send({ type: 'go' });
      }
    }, 30);
    return () => clearInterval(t);
  }, [state.phase, state.goAt, isHost, send]);

  if (state.phase === 'armed' || state.phase === 'go') {
    const live = state.phase === 'go';
    return (
      <div className={`duel ${live ? 'duel--go' : 'duel--wait'}`}>
        {[left, right].map((p, i) => (
          <button
            key={p?.id ?? i}
            className={`duel__half duel__half--${i === 0 ? 'top' : 'bottom'}`}
            onPointerDown={() => {
              haptic(live ? 'success' : 'error');
              send({ type: 'tap', side: i });
            }}
          >
            <span className="duel__name">{p?.name}</span>
          </button>
        ))}
        <div className="duel__center">{live ? 'JETZT' : 'warten …'}</div>
      </div>
    );
  }

  return (
    <GameFrame
      title={duell.name}
      accent={duell.accent}
      subtitle={`Runde ${state.round}`}
      onQuit={quit}
    >
      {state.phase === 'ready' && (
        <>
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            {left && <PlayerChip player={left} note="oben" />}
            {right && <PlayerChip player={right} note="unten" />}
          </div>
          <BigCard kicker="Legt das Handy zwischen euch">
            Sobald es grün wird: tippen. Vorher tippen heisst verloren.
          </BigCard>
          <button
            className="btn btn--brand btn--block btn--lg"
            onClick={() => {
              haptic('warn');
              send({ type: 'arm' });
            }}
          >
            <Icon name="bolt" size={20} /> Bereit
          </button>
        </>
      )}

      {state.phase === 'result' && (
        <div className="stack-3">
          <BigCard tone={state.falseStart ? 'danger' : 'default'} kicker={state.falseStart ? 'Fehlstart' : 'Schneller'}>
            {state.falseStart
              ? `${byId(state.loser)?.name} war zu früh dran.`
              : `${byId(state.winner)?.name} war schneller.`}
          </BigCard>
          {byId(state.loser) && (
            <DrinkCall
              player={byId(state.loser) as GamePlayer}
              baseSips={state.falseStart ? 4 : 3}
              source="duell"
            />
          )}
          <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
            Nächstes Duell
          </button>
        </div>
      )}
    </GameFrame>
  );
}
