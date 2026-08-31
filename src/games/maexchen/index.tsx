import { useState } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { Icon } from '../../components/icons';
import { GameFrame } from '../shared/GameFrame';
import { DrinkCall } from '../shared/DrinkCall';
import { BigCard, PlayerChip } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GameRuntime } from '../types';

/**
 * Rangfolge von niedrig nach hoch: gemischte Würfe, dann Pasch, dann Mäxchen.
 * Der Index in diesem Array ist der Rang, mit dem gerechnet wird.
 */
const RANKS: string[] = [
  '31', '32', '41', '42', '43', '51', '52', '53', '54', '61', '62', '63', '64', '65',
  '11', '22', '33', '44', '55', '66',
  '21',
];

const LABEL: Record<string, string> = { '21': 'Mäxchen' };
const rankLabel = (i: number) => LABEL[RANKS[i]] ?? RANKS[i];

function rankOf(dice: [number, number]): number {
  const [hi, lo] = [...dice].sort((a, b) => b - a);
  return RANKS.indexOf(`${hi}${lo}`);
}

interface State {
  phase: 'roll' | 'announce' | 'decide' | 'reveal';
  order: string[];
  turnIndex: number;
  dice: [number, number] | null;
  announced: number | null;
  previous: number | null;
  reveal: { dice: [number, number]; announced: number; truthful: boolean; loserId: string } | null;
  round: number;
}

export const maexchen: GameDefinition<State> = {
  id: 'maexchen',
  name: 'Mäxchen',
  tagline: 'Würfeln, ansagen, lügen. Oder aufdecken.',
  icon: 'games',
  accent: 'var(--yellow)',
  minPlayers: 3,
  maxPlayers: 12,
  duration: '15-30 Min',
  intensity: 3,
  tags: ['handy-weg', 'geheim', 'reden'],
  requiresOwnDevice: false,
  howTo: [
    'Ein Handy wandert reihum. Wer dran ist, würfelt verdeckt und schaut allein hin.',
    'Dann wird angesagt – höher als die Ansage davor. Lügen ist ausdrücklich erlaubt.',
    'Die nächste Person glaubt oder deckt auf. Wer falsch liegt, trinkt.',
  ],

  createState: (players) => ({
    phase: 'roll',
    order: shuffle(players.map((p) => p.id)),
    turnIndex: 0,
    dice: null,
    announced: null,
    previous: null,
    reveal: null,
    round: 1,
  }),

  reduce: (state, action, players) => {
    const n = Math.max(1, state.order.length);
    switch (action.type) {
      case 'roll': {
        if (state.phase !== 'roll') return state;
        const dice: [number, number] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
        return { ...state, dice, phase: 'announce' };
      }
      case 'announce': {
        if (state.phase !== 'announce') return state;
        const rank = Number(action.rank);
        if (!Number.isInteger(rank) || rank < 0 || rank >= RANKS.length) return state;
        if (state.previous !== null && rank <= state.previous) return state;
        return { ...state, announced: rank, phase: 'decide' };
      }
      case 'believe': {
        if (state.phase !== 'decide' || state.announced === null) return state;
        return {
          ...state,
          turnIndex: (state.turnIndex + 1) % n,
          previous: state.announced,
          announced: null,
          dice: null,
          phase: 'roll',
        };
      }
      case 'doubt': {
        if (state.phase !== 'decide' || state.announced === null || !state.dice) return state;
        const actual = rankOf(state.dice);
        const truthful = actual >= state.announced;
        const announcerId = state.order[state.turnIndex % n];
        const doubterId = state.order[(state.turnIndex + 1) % n];
        return {
          ...state,
          phase: 'reveal',
          reveal: {
            dice: state.dice,
            announced: state.announced,
            truthful,
            loserId: truthful ? doubterId : announcerId,
          },
        };
      }
      case 'nextRound': {
        const ids = new Set(players.map((p) => p.id));
        const order = [
          ...state.order.filter((id) => ids.has(id)),
          ...players.filter((p) => !state.order.includes(p.id)).map((p) => p.id),
        ];
        const loser = state.reveal?.loserId;
        const idx = loser ? Math.max(0, order.indexOf(loser)) : 0;
        return {
          ...state,
          order,
          turnIndex: idx,
          phase: 'roll',
          dice: null,
          announced: null,
          previous: null,
          reveal: null,
          round: state.round + 1,
        };
      }
      default:
        return state;
    }
  },

  Component: MaexchenGame,
};

function Die({ value }: { value: number }) {
  const dots: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };
  return (
    <span className="die" aria-label={`Würfel ${value}`}>
      {dots[value].map(([x, y], i) => (
        <span key={i} className="die__dot" style={{ gridColumn: x + 1, gridRow: y + 1 }} />
      ))}
    </span>
  );
}

function MaexchenGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  const [peek, setPeek] = useState(false);
  const send = (a: GameActionInput) => dispatch(a);
  const n = Math.max(1, state.order.length);
  const byId = (id: string) => players.find((p) => p.id === id);
  const announcer = byId(state.order[state.turnIndex % n]) ?? players[0];
  const decider = byId(state.order[(state.turnIndex + 1) % n]) ?? players[0];
  const canAnnounce = !online || announcer?.id === me.id;
  const canDecide = !online || decider?.id === me.id;

  const options = RANKS.map((_, i) => i).filter((i) => state.previous === null || i > state.previous);

  return (
    <GameFrame
      title={maexchen.name}
      accent={maexchen.accent}
      subtitle={
        state.previous !== null ? `Zu schlagen: ${rankLabel(state.previous)}` : `Runde ${state.round}`
      }
      onQuit={quit}
    >
      {state.phase !== 'reveal' && announcer && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <PlayerChip
            player={state.phase === 'decide' ? decider! : announcer}
            note={
              state.phase === 'decide'
                ? decider?.id === me.id
                  ? 'du entscheidest'
                  : 'entscheidet'
                : announcer.id === me.id
                  ? 'du bist dran'
                  : 'ist dran'
            }
          />
        </div>
      )}

      {state.phase === 'roll' && (
        <>
          <BigCard kicker="Verdeckt würfeln">
            {canAnnounce ? 'Nimm das Handy und würfle.' : `${announcer?.name} würfelt.`}
          </BigCard>
          <button
            className="btn btn--brand btn--block btn--lg"
            disabled={!canAnnounce}
            onClick={() => {
              haptic('heavy');
              send({ type: 'roll' });
            }}
          >
            <Icon name="games" size={20} /> Würfeln
          </button>
        </>
      )}

      {state.phase === 'announce' && (
        <>
          <div
            className={`peek ${peek ? 'peek--open' : ''}`}
            onPointerDown={() => canAnnounce && setPeek(true)}
            onPointerUp={() => setPeek(false)}
            onPointerLeave={() => setPeek(false)}
            role="button"
            tabIndex={0}
          >
            {peek && state.dice ? (
              <span className="row" style={{ gap: 14 }}>
                <Die value={state.dice[0]} />
                <Die value={state.dice[1]} />
              </span>
            ) : (
              <span className="peek__hint">
                <Icon name="lock" size={28} />
                Gedrückt halten
              </span>
            )}
          </div>
          <p className="t-sub t-center t-balance">
            Sag jetzt an – die Wahrheit oder etwas Höheres. Niemand sieht deinen Wurf.
          </p>
          <div className="rankgrid">
            {options.map((i) => (
              <button
                key={i}
                className={`rankchip pressable ${RANKS[i] === '21' ? 'rankchip--max' : ''}`}
                disabled={!canAnnounce}
                onClick={() => {
                  haptic('select');
                  send({ type: 'announce', rank: i });
                }}
              >
                {rankLabel(i)}
              </button>
            ))}
          </div>
        </>
      )}

      {state.phase === 'decide' && state.announced !== null && (
        <>
          <BigCard kicker={`${announcer?.name} sagt an`}>{rankLabel(state.announced)}</BigCard>
          <div className="choice choice--2">
            <button
              className="choice__btn pressable"
              style={{ ['--tint' as string]: 'var(--green)' }}
              disabled={!canDecide}
              onClick={() => send({ type: 'believe' })}
            >
              <Icon name="check" size={20} /> Glauben
            </button>
            <button
              className="choice__btn pressable"
              style={{ ['--tint' as string]: 'var(--red)' }}
              disabled={!canDecide}
              onClick={() => {
                haptic('warn');
                send({ type: 'doubt' });
              }}
            >
              <Icon name="eyeOff" size={20} /> Aufdecken
            </button>
          </div>
          <p className="t-caption t-center t-balance">
            Glauben heisst: du würfelst als Nächstes und musst höher ansagen.
          </p>
        </>
      )}

      {state.phase === 'reveal' && state.reveal && (
        <div className="stack-3">
          <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
            <Die value={state.reveal.dice[0]} />
            <Die value={state.reveal.dice[1]} />
          </div>
          <BigCard tone={state.reveal.truthful ? 'default' : 'danger'} kicker={state.reveal.truthful ? 'Gesagt und gehalten' : 'Erwischt'}>
            Angesagt war {rankLabel(state.reveal.announced)}, gewürfelt {rankLabel(rankOf(state.reveal.dice))}.
          </BigCard>
          {byId(state.reveal.loserId) && (
            <DrinkCall
              player={byId(state.reveal.loserId)!}
              baseSips={4}
              source="maexchen"
              label={state.reveal.truthful ? 'zu Unrecht gezweifelt' : 'beim Lügen erwischt'}
            />
          )}
          <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'nextRound' })}>
            Neue Runde
          </button>
        </div>
      )}
    </GameFrame>
  );
}
