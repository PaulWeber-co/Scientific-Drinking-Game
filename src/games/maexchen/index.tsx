import { haptic } from '../../lib/haptics';
import { sound } from '../../lib/sound';
import { shuffle } from '../../lib/format';
import { Icon } from '../../components/icons';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { DrinkCall } from '../shared/DrinkCall';
import { BigCard, PlayerChip } from '../shared/pieces';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { fromHost } from '../shared/host';
import { hasOnlineGuests } from '../shared/partyMode';
import { AbsentAction, canSkipAbsent, extendOrder, nextPresentId, playerNames, presentPlayer } from '../shared/presence';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { meta } from './meta';

/**
 * Rangfolge von niedrig nach hoch: gemischte Würfe, dann Pasch, dann Mäxchen.
 * Die App prüft keine Ansage mehr (User-Entscheid 2026-10-14: angesagt wird
 * laut, wie mit echtem Becher). Die Rangfolge braucht sie nur noch, um den
 * Wurf zu benennen und das Mäxchen zu erkennen.
 */
const RANKS: string[] = [
  '31', '32', '41', '42', '43', '51', '52', '53', '54', '61', '62', '63', '64', '65',
  '11', '22', '33', '44', '55', '66',
  '21',
];

/** Mäxchen (21) ist der höchste Wurf – nichts schlägt es. */
const MAEXCHEN = RANKS.length - 1;

const rankLabel = (i: number) => {
  const r = RANKS[i];
  if (r === '21') return 'Mäxchen';
  return r[0] === r[1] ? `${r[0]}er Pasch` : `${r[0]}-${r[1]}`;
};

function rankOf(dice: [number, number]): number {
  const [hi, lo] = [...dice].sort((a, b) => b - a);
  return RANKS.indexOf(`${hi}${lo}`);
}

interface State {
  /** `look`: der Würfelnde sieht in den Becher und sagt laut an. `decide`:
   *  der Nächste glaubt oder deckt auf. `reveal`: aufgedeckt bzw. Mäxchen
   *  geglaubt – ohne `loserId` wartet die Runde noch auf das Urteil. */
  phase: 'roll' | 'look' | 'decide' | 'reveal' | 'over';
  order: string[];
  names?: Record<string, string>;
  turnIndex: number;
  dice: [number, number] | null;
  reveal: {
    /** `null`, wenn ein Mäxchen geglaubt wurde – der Becher bleibt zu. */
    dice: [number, number] | null;
    loserId: string | null;
    /** Wer glaubt, muss überbieten. Ein Mäxchen lässt sich nicht
     *  überbieten, also verliert, wer es glaubt (Wikipedia: die Runde endet,
     *  wenn keine Steigerung mehr möglich ist). */
    believedMaexchen: boolean;
  } | null;
  round: number;
  /** Ziellinie in Runden. `null` heißt: ohne Ende. */
  goal: number | null;
  /** Wie oft wer eine Runde verloren hat – die einzige Wertung, die das Spiel führt. */
  losses: Record<string, number>;
}

/** Rund um Mäxchen wird doppelt getrunken – darin sind sich alle
 *  Regelquellen einig. Die Engine deckelt die Härte ohnehin. */
function sipsFor(reveal: NonNullable<State['reveal']>): number {
  const maexchen = reveal.believedMaexchen || (reveal.dice !== null && rankOf(reveal.dice) === MAEXCHEN);
  return maexchen ? 8 : 4;
}

function absentTurn(state: State, players: GamePlayer[]) {
  const announcer = state.order[state.turnIndex];
  const decider = state.order[(state.turnIndex + 1) % state.order.length];
  if (state.phase === 'roll' || state.phase === 'look') return announcer;
  if (state.phase === 'decide' || (state.phase === 'reveal' && state.reveal && !state.reveal.loserId)) {
    return presentPlayer(players, announcer) ? decider : announcer;
  }
}

export const maexchen: GameDefinition<State> = {
  ...meta,

  createState: (players) => ({
    phase: 'roll',
    order: shuffle(players.map((p) => p.id)),
    ...(hasOnlineGuests(players) && { names: playerNames(players) }),
    turnIndex: 0,
    dice: null,
    reveal: null,
    round: 1,
    // Eine Runde ist ein Aufdecken. Acht davon reichen, damit jeder ein paar
    // Mal gelogen hat, ohne dass es zäh wird.
    goal: roundGoal(baseFor('maexchen')),
    losses: {},
  }),

  reduce: (state, action, players) => {
    const n = Math.max(1, state.order.length);
    const announcerId = state.order[state.turnIndex % n];
    const deciderId = state.order[(state.turnIndex + 1) % n];
    const online = Boolean(state.names) || hasOnlineGuests(players);
    const absent = absentTurn(state, players);
    const blocked = online && Boolean(absent) && !presentPlayer(players, absent);
    const canAnnounce = !online || (!blocked && action.by === announcerId);
    const canDecide = !online || (!blocked && action.by === deciderId);
    switch (action.type) {
      case 'skipAbsent': {
        if (!absent || !canSkipAbsent(action, players, absent)) return state;
        const order = extendOrder(state.order, players);
        const next = nextPresentId(order, absent, players);
        if (!next) return state;
        return {
          ...state, order, names: { ...state.names, ...playerNames(players) },
          turnIndex: order.indexOf(next), phase: 'roll', dice: null, reveal: null,
        };
      }
      case 'roll': {
        if (state.phase !== 'roll' || !canAnnounce) return state;
        const dice: [number, number] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
        return { ...state, dice, phase: 'look' };
      }
      case 'pass': {
        // Angesagt wird laut; die App merkt sich nur, dass der Becher weiter ist.
        if (state.phase !== 'look' || !canAnnounce) return state;
        return { ...state, phase: 'decide' };
      }
      case 'believe': {
        if (state.phase !== 'decide' || !canDecide) return state;
        return { ...state, turnIndex: (state.turnIndex + 1) % n, dice: null, phase: 'roll' };
      }
      case 'doubt': {
        if (state.phase !== 'decide' || !state.dice || !canDecide) return state;
        return {
          ...state,
          phase: 'reveal',
          reveal: { dice: state.dice, loserId: null, believedMaexchen: false },
        };
      }
      case 'believeMaexchen': {
        if (state.phase !== 'decide' || !canDecide) return state;
        return {
          ...state,
          phase: 'reveal',
          losses: { ...state.losses, [deciderId]: (state.losses[deciderId] ?? 0) + 1 },
          reveal: { dice: null, loserId: deciderId, believedMaexchen: true },
        };
      }
      case 'judge': {
        // Nur einmal je Aufdecken: ein zweiter Tap würde die Niederlage
        // doppelt zählen oder dem anderen zuschieben.
        if (state.phase !== 'reveal' || !state.reveal || state.reveal.loserId || blocked) return state;
        if (!canDecide && !fromHost(action, players)) return state;
        const loserId = action.lied ? announcerId : deciderId;
        return {
          ...state,
          losses: { ...state.losses, [loserId]: (state.losses[loserId] ?? 0) + 1 },
          reveal: { ...state.reveal, loserId },
        };
      }
      case 'nextRound': {
        // Nur aus einer entschiedenen Auflösung heraus: zwei fast gleichzeitige
        // Taps auf „Neue Runde" würden sonst zwei Runden zählen, und eine Runde
        // fiele still aus. Die Inbox wendet Aktionen nacheinander an.
        if (state.phase !== 'reveal' || !state.reveal?.loserId) return state;
        const ids = new Set(players.map((p) => p.id));
        const order = [
          ...state.order.filter((id) => ids.has(id)),
          ...players.filter((p) => !state.order.includes(p.id)).map((p) => p.id),
        ];
        const loser = state.reveal.loserId;
        const next = online && !presentPlayer(players, loser)
          ? nextPresentId(extendOrder(state.order, players), loser, players)
          : loser;
        const idx = next ? Math.max(0, order.indexOf(next)) : 0;
        const round = state.round + 1;
        if (isOver(round, state.goal)) return { ...state, order, round, phase: 'over' };
        return {
          ...state,
          order,
          turnIndex: idx,
          phase: 'roll',
          dice: null,
          reveal: null,
          round,
          ...(state.names && { names: { ...state.names, ...playerNames(players) } }),
        };
      }
      case 'restart':
        return maexchen.createState(players);
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

/** Der höhere Würfel zuerst – in derselben Reihenfolge, wie der Wurf heißt („3-1"). */
function Dice({ dice }: { dice: [number, number] }) {
  const [hi, lo] = [...dice].sort((a, b) => b - a);
  return (
    <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
      <Die value={hi} />
      <Die value={lo} />
    </div>
  );
}

function MaexchenGame({ state, players, me, dispatch, quit, online, isHost }: GameRuntime<State>) {
  const send = (a: GameActionInput) => dispatch(a);
  const n = Math.max(1, state.order.length);
  const byId = (id: string) => players.find((p) => p.id === id);
  const announcer = byId(state.order[state.turnIndex % n]) ?? (online ? undefined : players[0]);
  const decider = byId(state.order[(state.turnIndex + 1) % n]) ?? (online ? undefined : players[0]);
  const absent = absentTurn(state, players);
  const blocked = online && Boolean(absent) && !presentPlayer(players, absent);
  const canAnnounce = !online || (!blocked && announcer?.id === me.id);
  const canDecide = !online || (!blocked && decider?.id === me.id);
  const active = state.phase === 'decide' ? decider : announcer;
  const announcerName = announcer?.name ?? state.names?.[state.order[state.turnIndex]] ?? 'Die Person am Zug';

  if (state.phase === 'over') {
    const ranking = players.map((p) => ({
      player: p,
      value: state.losses[p.id] ?? 0,
      unit: 'Niederlage',
    }));
    const worst = Math.max(0, ...ranking.map((r) => r.value));
    const losers = ranking.filter((r) => r.value === worst).map((r) => r.player);
    return (
      <GameFrame
        title={maexchen.name}
        accent={maexchen.accent}
        subtitle="Ausgewürfelt"
        onQuit={quit}
      >
        <GameOver
          headline={
            worst > 0
              ? `${state.round - 1} Runden Mäxchen. Ganz oben steht, wer am häufigsten danebenlag.`
              : `${state.round - 1} Runden Mäxchen – und niemand hat sich erwischen lassen.`
          }
          ranking={worst > 0 ? ranking : undefined}
          rankingTitle="Wer am häufigsten danebenlag"
          rankHighIsBad
          finalCall={
            worst > 0
              ? {
                  players: losers,
                  baseSips: 4,
                  label: 'die meisten Niederlagen',
                  source: 'maexchen',
                }
              : undefined
          }
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  const loserId = state.reveal?.loserId;
  const judged = loserId ? byId(loserId) : undefined;

  return (
    <GameFrame
      title={maexchen.name}
      accent={maexchen.accent}
      subtitle={state.goal ? `Runde ${Math.min(state.round, state.goal)}/${state.goal}` : `Runde ${state.round}`}
      onQuit={quit}
    >
      {state.phase !== 'reveal' && active && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <PlayerChip
            player={active}
            note={
              state.phase === 'decide'
                ? decider?.id === me.id
                  ? 'du entscheidest'
                  : 'entscheidet'
                : active.id === me.id
                  ? 'du bist dran'
                  : 'ist dran'
            }
          />
        </div>
      )}

      {state.phase === 'roll' && (
        <>
          <BigCard kicker="Verdeckt würfeln">
            {canAnnounce ? 'Nimm das Handy und würfle.' : `${announcerName} würfelt.`}
          </BigCard>
          <button
            className="btn btn--brand btn--block btn--lg"
            disabled={!canAnnounce}
            onClick={() => {
              haptic('heavy');
              sound('dice');
              send({ type: 'roll' });
            }}
          >
            <Icon name="games" size={20} /> Würfeln
          </button>
        </>
      )}

      {state.phase === 'look' && state.dice && (
        <>
          {canAnnounce ? (
            <div className="stack-3">
              {/* Der Blick unter den Becher: zwei echte Würfel statt einer
                  markierten Zeile in einer Tabelle. */}
              <Dice dice={state.dice} />
              <div className="t-title2 t-center">{rankLabel(rankOf(state.dice))}</div>
              <p className="t-sub t-center t-balance">
                Sag laut an – die Wahrheit oder mehr. Dann gib das Handy verdeckt weiter.
              </p>
              <p className="t-caption t-center">
                Reihenfolge: gemischte Würfe (3-1 bis 6-5), dann Pasch, dann Mäxchen (2-1).
              </p>
            </div>
          ) : (
            <BigCard kicker="Unter dem Becher">{announcer?.name} schaut nach und sagt gleich an.</BigCard>
          )}
          <button
            className="btn btn--brand btn--block btn--lg"
            disabled={!canAnnounce}
            onClick={() => {
              haptic('select');
              send({ type: 'pass' });
            }}
          >
            Angesagt – weitergeben
          </button>
        </>
      )}

      {state.phase === 'decide' && (
        <>
          <BigCard kicker={`${announcerName} hat angesagt`}>Glaubst du es?</BigCard>
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
                sound('cup');
                send({ type: 'doubt' });
              }}
            >
              <Icon name="eyeOff" size={20} /> Aufdecken
            </button>
          </div>
          <p className="t-caption t-center t-balance">
            Glauben heißt: du würfelst als Nächstes und musst höher ansagen.
          </p>
          <button
            className="btn btn--plain btn--block"
            disabled={!canDecide}
            onClick={() => {
              haptic('warn');
              send({ type: 'believeMaexchen' });
            }}
          >
            Mäxchen geglaubt – ich trinke
          </button>
        </>
      )}

      {state.phase === 'reveal' && state.reveal && (
        <div className="stack-3">
          {state.reveal.dice ? (
            <>
              <Dice dice={state.reveal.dice} />
              <BigCard kicker="Aufgedeckt">
                Gewürfelt: {rankLabel(rankOf(state.reveal.dice))}.
                {!loserId && !blocked && ` War die Ansage von ${announcerName} höher?`}
              </BigCard>
            </>
          ) : (
            <BigCard kicker="Mäxchen geglaubt">
              Mäxchen lässt sich nicht überbieten. Der Becher bleibt zu.
            </BigCard>
          )}
          {!loserId && !blocked && (
            <div className="choice choice--2">
              <button
                className="choice__btn pressable"
                style={{ ['--tint' as string]: 'var(--red)' }}
                disabled={!canDecide && !isHost}
                onClick={() => {
                  haptic('heavy');
                  send({ type: 'judge', lied: true });
                }}
              >
                Gelogen – {announcer?.name} trinkt
              </button>
              <button
                className="choice__btn pressable"
                style={{ ['--tint' as string]: 'var(--green)' }}
                disabled={!canDecide && !isHost}
                onClick={() => {
                  haptic('heavy');
                  send({ type: 'judge', lied: false });
                }}
              >
                Stimmt – {decider?.name} trinkt
              </button>
            </div>
          )}
          {loserId && (
            <>
              {judged && (
                <DrinkCall
                  player={judged}
                  baseSips={sipsFor(state.reveal)}
                  source="maexchen"
                  label={
                    state.reveal.believedMaexchen
                      ? 'Mäxchen geglaubt'
                      : loserId === announcer?.id
                        ? 'beim Lügen erwischt'
                        : 'zu Unrecht gezweifelt'
                  }
                  resetKey={state.round}
                />
              )}
              <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'nextRound' })}>
                {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Neue Runde'}
              </button>
            </>
          )}
        </div>
      )}
      {online && (
        <AbsentAction id={absent} players={players} names={state.names} isHost={isHost} dispatch={send} />
      )}
    </GameFrame>
  );
}
