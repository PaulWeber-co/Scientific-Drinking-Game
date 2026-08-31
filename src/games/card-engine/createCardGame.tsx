import { HeatIcons, Icon, type IconName } from '../../components/icons';
import { useMemo } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { DrinkCall, DrinkCallList } from '../shared/DrinkCall';
import { BigCard, Choice, PlayerChip } from '../shared/pieces';
import { GameFrame } from '../shared/GameFrame';
import type { GameAction, GameActionInput, GameDefinition, GamePlayer, GameRuntime, GameTag } from '../types';

export type Heat = 1 | 2 | 3;

export interface CardDef {
  text: string;
  /** Zu welchem Modus die Karte gehört (z. B. "wahrheit" / "pflicht"). */
  mode?: string;
  /** 1 = harmlos, 2 = mittel, 3 = eskaliert. */
  heat?: Heat;
  /** Wer trinkt: der Spieler am Zug oder alle. Default: aus der Config. */
  target?: 'actor' | 'all';
  /** Ueberschreibt die Basis-Härte für diese Karte. */
  sips?: number;
  kicker?: string;
}

export interface CardGameConfig {
  id: string;
  name: string;
  tagline: string;
  icon: IconName;
  accent: string;
  minPlayers: number;
  maxPlayers: number;
  duration: string;
  intensity: 1 | 2 | 3;
  tags: GameTag[];
  howTo: string[];
  /** 'turn' = es gibt einen Spieler am Zug, 'none' = die Karte gilt für die Runde. */
  actor: 'turn' | 'none';
  /** Auswahl vor dem Ziehen, z. B. Wahrheit oder Pflicht. */
  modes?: { id: string; label: string; icon?: IconName; tone?: string }[];
  /** Standard-Härte der Trinkansage. */
  baseSips: number;
  /** Wer trinkt, wenn die Karte einfach erledigt wird. */
  drink: 'actor' | 'all' | 'none' | 'self-declare';
  resolveLabel?: string;
  /** Wenn gesetzt: der Spieler darf kneifen und trinkt stattdessen. */
  refuseLabel?: string;
  refuseSips?: number;
  cards: CardDef[];
  /** Blendet den Härtegrad-Regler ein. */
  heatSelectable?: boolean;
}

export interface CardGameState {
  order: string[];
  turnIndex: number;
  round: number;
  heat: Heat;
  deck: number[];
  drawn: number | null;
  mode: string | null;
  phase: 'choose' | 'card' | 'resolved';
  outcome: 'done' | 'refused' | null;
}

/**
 * Baut aus einer Konfiguration ein fertiges Spiel.
 *
 * Ein neues kartenbasiertes Spiel besteht damit nur noch aus einer Datei mit
 * Metadaten und Kartentexten – keine React-Komponente, kein Reducer.
 */
export function createCardGame(config: CardGameConfig): GameDefinition<CardGameState> {
  const pool = (heat: Heat, mode: string | null) =>
    config.cards
      .map((c, i) => [c, i] as const)
      .filter(([c]) => (c.heat ?? 1) <= heat)
      .filter(([c]) => !mode || !c.mode || c.mode === mode)
      .map(([, i]) => i);

  const createState = (players: GamePlayer[]): CardGameState => ({
    order: shuffle(players.map((p) => p.id)),
    turnIndex: 0,
    round: 1,
    heat: config.intensity,
    deck: shuffle(pool(config.intensity, null)),
    drawn: null,
    mode: null,
    phase: config.modes && config.actor === 'turn' ? 'choose' : 'card',
    outcome: null,
  });

  const reduce = (state: CardGameState, action: GameAction, players: GamePlayer[]): CardGameState => {
    switch (action.type) {
      case 'setHeat': {
        const heat = Number(action.heat) as Heat;
        return { ...state, heat, deck: shuffle(pool(heat, state.mode)) };
      }
      case 'pickMode': {
        const mode = String(action.mode);
        const deck = shuffle(pool(state.heat, mode));
        return { ...state, mode, deck: deck.slice(1), drawn: deck[0] ?? null, phase: 'card' };
      }
      case 'draw': {
        const deck = state.deck.length ? state.deck : shuffle(pool(state.heat, state.mode));
        return { ...state, drawn: deck[0] ?? null, deck: deck.slice(1), phase: 'card' };
      }
      case 'resolve':
        return { ...state, phase: 'resolved', outcome: action.outcome === 'refused' ? 'refused' : 'done' };
      case 'next': {
        const order = syncOrder(state.order, players);
        const turnIndex = (state.turnIndex + 1) % Math.max(1, order.length);
        const deck = state.deck.length ? state.deck : shuffle(pool(state.heat, null));
        return {
          ...state,
          order,
          turnIndex,
          round: turnIndex === 0 ? state.round + 1 : state.round,
          mode: null,
          outcome: null,
          drawn: config.modes && config.actor === 'turn' ? null : (deck[0] ?? null),
          deck: config.modes && config.actor === 'turn' ? deck : deck.slice(1),
          phase: config.modes && config.actor === 'turn' ? 'choose' : 'card',
        };
      }
      default:
        return state;
    }
  };

  function Component({ state, players, me, dispatch, quit, online }: GameRuntime<CardGameState>) {
    const actor = useMemo(() => {
      if (config.actor === 'none') return null;
      const id = state.order[state.turnIndex % Math.max(1, state.order.length)];
      return players.find((p) => p.id === id) ?? players[0] ?? null;
    }, [state.order, state.turnIndex, players]);

    const card = state.drawn != null ? config.cards[state.drawn] : null;
    const isMyTurn = !actor || actor.id === me.id;
    // Pass & Play: ein Gerät, also darf es auch für den Spieler am Zug tippen.
    const canAct = !online || isMyTurn;
    const target = card?.target ?? (config.drink === 'all' ? 'all' : 'actor');
    const sips = card?.sips ?? config.baseSips;

    const send = (action: GameActionInput) => {
      haptic('select');
      dispatch(action);
    };

    return (
      <GameFrame
        title={config.name}
        accent={config.accent}
        subtitle={`Runde ${state.round}`}
        onQuit={quit}
        action={
          config.heatSelectable ? (
            <div className="segmented segmented--tight" role="group" aria-label="Härtegrad">
              {([1, 2, 3] as Heat[]).map((h) => (
                <button
                  key={h}
                  className="segmented__opt segmented__opt--icon"
                  aria-pressed={state.heat === h}
                  aria-label={`Härtegrad ${h}`}
                  onClick={() => send({ type: 'setHeat', heat: h })}
                >
                  {Array.from({ length: h }, (_, i) => (
                    <Icon key={i} name="flame" size={13} />
                  ))}
                </button>
              ))}
            </div>
          ) : null
        }
      >
        {actor && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <PlayerChip player={actor} note={isMyTurn ? 'du bist dran' : 'ist dran'} />
          </div>
        )}

        {state.phase === 'choose' && config.modes && (
          <>
            <BigCard kicker="Entscheide dich">
              {isMyTurn ? 'Was wird es?' : `${actor?.name} entscheidet …`}
            </BigCard>
            <Choice
              disabled={!canAct}
              options={config.modes.map((m) => ({
                id: m.id,
                tone: m.tone,
                label: (
                  <>
                    {m.icon && <Icon name={m.icon} size={20} />}
                    {m.label}
                  </>
                ),
              }))}
              onPick={(mode) => send({ type: 'pickMode', mode })}
            />
          </>
        )}

        {state.phase !== 'choose' && card && (
          <BigCard
            animateKey={`${state.drawn}-${state.round}-${state.turnIndex}`}
            kicker={card.kicker ?? config.modes?.find((m) => m.id === state.mode)?.label ?? config.name}
            footer={
              (card.heat ?? 1) > 1 ? <HeatIcons level={card.heat ?? 1} /> : undefined
            }
          >
            {card.text}
          </BigCard>
        )}

        {state.phase === 'card' && (
          <div className="stack-3">
            {config.drink === 'self-declare' && (
              <DrinkCall
                player={me}
                baseSips={sips}
                source={config.id}
                label="wenn du das kennst"
              />
            )}
            <button
              className="btn btn--brand btn--block btn--lg"
              onClick={() => send({ type: 'resolve', outcome: 'done' })}
            >
              {config.resolveLabel ?? 'Erledigt'}
            </button>
            {config.refuseLabel && (
              <button
                className="btn btn--glass btn--block"
                onClick={() => send({ type: 'resolve', outcome: 'refused' })}
              >
                {config.refuseLabel}
              </button>
            )}
          </div>
        )}

        {state.phase === 'resolved' && (
          <div className="stack-3">
            {state.outcome === 'refused' ? (
              actor && <DrinkCall player={actor} baseSips={config.refuseSips ?? sips + 2} source={config.id} label="gekniffen" />
            ) : config.drink === 'none' ? (
              <div className="t-center t-sub">Sauber. Weiter geht's.</div>
            ) : config.drink === 'self-declare' ? (
              <div className="t-center t-sub">Alle ehrlich? Weiter.</div>
            ) : target === 'all' ? (
              <DrinkCallList players={players} baseSips={sips} source={config.id} />
            ) : (
              actor && <DrinkCall player={actor} baseSips={sips} source={config.id} />
            )}
            <button
              className="btn btn--brand btn--block btn--lg"
              onClick={() => send({ type: 'next' })}
            >
              Nächster
            </button>
          </div>
        )}
      </GameFrame>
    );
  }

  return {
    id: config.id,
    name: config.name,
    tagline: config.tagline,
    icon: config.icon,
    accent: config.accent,
    minPlayers: config.minPlayers,
    maxPlayers: config.maxPlayers,
    duration: config.duration,
    intensity: config.intensity,
    tags: config.tags,
    requiresOwnDevice: false,
    howTo: config.howTo,
    createState,
    reduce,
    Component,
  };
}

/** Spielerliste im State mit der echten Lobby abgleichen (Joins/Leaves). */
function syncOrder(order: string[], players: GamePlayer[]): string[] {
  const ids = new Set(players.map((p) => p.id));
  const kept = order.filter((id) => ids.has(id));
  const added = players.filter((p) => !order.includes(p.id)).map((p) => p.id);
  return kept.length + added.length ? [...kept, ...added] : order;
}
