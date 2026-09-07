import { useEffect } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { Icon } from '../../components/icons';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { DrinkCall } from '../shared/DrinkCall';
import { BigCard, PlayerChip } from '../shared/pieces';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import type { GameActionInput, GameDefinition, GameRuntime } from '../types';
import { meta } from './meta';

interface State {
  phase: 'ready' | 'armed' | 'go' | 'result' | 'over';
  order: string[];
  pairIndex: number;
  goAt: number;
  winner: string | null;
  loser: string | null;
  falseStart: boolean;
  round: number;
  /** Ziellinie in Duellen. `null` heißt: ohne Ende. */
  goal: number | null;
  /** Gewonnene Duelle pro Person – die Wertung am Schluss. */
  wins: Record<string, number>;
}

/**
 * Rundlauf-Verfahren (circle method), wie Turniere ihre Runden auslosen: eine
 * Person bleibt fix, der Rest rotiert – jede Runde ergibt so viele Paare, wie
 * Platz ist, bis nach `n - 1` Runden jede Person gegen jede andere genau
 * einmal antrat. Bei ungerader Personenzahl bekommt reihum eine Person ein
 * Freilos (Bye) und wird für diese Runde übersprungen.
 *
 * Hier duelliert immer nur ein Paar aufs Mal statt aller Paare einer Runde
 * gleichzeitig – deshalb werden die Runden zu einer einzigen Kette aus Paaren
 * aneinandergereiht, statt sie parallel zu vergeben.
 */
function roundRobinSchedule(n: number): [number, number][] {
  const bye = -1;
  const size = n % 2 === 0 ? n : n + 1;
  let ring = Array.from({ length: size }, (_, i) => (i < n ? i : bye));
  const half = size / 2;
  const schedule: [number, number][] = [];
  for (let round = 0; round < size - 1; round++) {
    for (let i = 0; i < half; i++) {
      const a = ring[i];
      const b = ring[size - 1 - i];
      if (a !== bye && b !== bye) schedule.push([a, b]);
    }
    // Position 0 bleibt fix, der Rest rückt eine Stelle weiter.
    ring = [ring[0], ring[size - 1], ...ring.slice(1, size - 1)];
  }
  return schedule;
}

/**
 * Welches Paar in Runde `i` antritt. Vorher liefen hier nur aufeinanderfolgende
 * Nachbarn (0,1)‑(1,2)‑(2,3)…, wodurch bei 8 Personen und 6 Runden die achte
 * Person nie drankam. Der Rundlauf-Spielplan wiederholt sich erst, wenn jede
 * Person gegen jede andere einmal angetreten ist.
 */
export function pairFor(order: string[], i: number): [string, string] {
  if (order.length < 2) {
    const id = order[0] ?? '';
    return [id, id];
  }
  const schedule = roundRobinSchedule(order.length);
  const [a, b] = schedule[i % schedule.length];
  return [order[a], order[b]];
}

export const duell: GameDefinition<State> = {
  ...meta,

  createState: (players) => ({
    phase: 'ready',
    order: shuffle(players.map((p) => p.id)),
    pairIndex: 0,
    goAt: 0,
    winner: null,
    loser: null,
    falseStart: false,
    round: 1,
    // Eine Runde ist ein Duell. Sechs davon geben jedem Paar seinen Auftritt,
    // ohne dass die Gruppe drumherum einschläft.
    goal: roundGoal(baseFor('duell')),
    wins: {},
  }),

  reduce: (state, action, players) => {
    switch (action.type) {
      case 'arm':
        // Ein zweiter Tap auf „Bereit" wuerfelt sonst nur den Startzeitpunkt
        // neu aus - harmlos, aber es hat hier nichts verloren.
        if (state.phase !== 'ready') return state;
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
        // Auch ein Fehlstart des Gegenübers ist ein gewonnenes Duell.
        const won = (id: string) => ({ ...state.wins, [id]: (state.wins[id] ?? 0) + 1 });
        if (state.phase === 'armed') {
          return {
            ...state,
            phase: 'result',
            falseStart: true,
            loser: tapper,
            winner: other,
            wins: won(other),
          };
        }
        if (state.phase !== 'go') return state;
        return {
          ...state,
          phase: 'result',
          winner: tapper,
          loser: other,
          falseStart: false,
          wins: won(tapper),
        };
      }
      case 'next': {
        // Nur aus der Auflösung heraus: zwei fast gleichzeitige Taps auf
        // „Weiter" würden sonst zwei Runden zählen, und die letzte Runde
        // fiele still aus. Die Inbox wendet Aktionen nacheinander an.
        if (state.phase !== 'result') return state;
        const ids = new Set(players.map((p) => p.id));
        const order = [
          ...state.order.filter((id) => ids.has(id)),
          ...players.filter((p) => !state.order.includes(p.id)).map((p) => p.id),
        ];
        const round = state.round + 1;
        if (isOver(round, state.goal)) return { ...state, order, round, phase: 'over' };
        return {
          ...state,
          order,
          // Nicht auf `order.length` begrenzen: `pairFor` wickelt den vollen
          // Rundlauf-Spielplan ab (n·(n-1)/2 Paare), der bei mehr als zwei
          // Personen länger ist als die Spielerliste selbst. Ein Modulo hier
          // hätte den Spielplan nach `order.length` Paaren vorzeitig
          // zurückgesetzt und immer dieselbe kleine Auswahl wiederholt.
          pairIndex: state.pairIndex + 1,
          phase: 'ready',
          winner: null,
          loser: null,
          falseStart: false,
          round,
        };
      }
      case 'restart':
        return duell.createState(players);
      default:
        return state;
    }
  },

  Component: DuellGame,
};

function DuellGame({ state, players, isHost, dispatch, quit }: GameRuntime<State>) {
  const send = (a: GameActionInput) => dispatch(a);
  const byId = (id: string | null) => players.find((p) => p.id === id) ?? null;
  // Einmal nachschlagen statt zweimal – der Cast unterdrueckte sonst genau
  // die Pruefung, dass der zweite Aufruf ebenfalls `null` liefern koennte.
  const verlierer = byId(state.loser) ?? null;
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

  if (state.phase === 'over') {
    const ranking = players.map((p) => ({
      player: p,
      value: state.wins[p.id] ?? 0,
      unit: 'gewonnene Runde',
    }));
    const best = Math.max(0, ...ranking.map((r) => r.value));
    return (
      <GameFrame title={duell.name} accent={duell.accent} subtitle="Ausgeduellt" onQuit={quit}>
        <GameOver
          headline={
            best > 0
              ? `${state.round - 1} Duelle sind durch. Ganz oben steht die schnellste Hand.`
              : `${state.round - 1} Duelle sind durch. Das war's für diese Partie.`
          }
          ranking={best > 0 ? ranking : undefined}
          rankingTitle="Die schnellsten Hände"
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

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
      subtitle={
        state.goal
          ? `Runde ${Math.min(state.round, state.goal)}/${state.goal}`
          : `Runde ${state.round}`
      }
      onQuit={quit}
    >
      {state.phase === 'ready' && (
        <>
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            {left && <PlayerChip player={left} note="oben" />}
            {right && <PlayerChip player={right} note="unten" />}
          </div>
          <BigCard kicker="Legt das Handy zwischen euch">
            Sobald es grün wird: tippen. Vorher tippen heißt verloren.
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
          {verlierer && (
            <DrinkCall
              player={verlierer}
              baseSips={state.falseStart ? 4 : 3}
              source="duell"
              resetKey={state.round}
            />
          )}
          <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
            {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächstes Duell'}
          </button>
        </div>
      )}
    </GameFrame>
  );
}
