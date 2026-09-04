import { useEffect, useMemo, useState } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { customCardsFor } from '../../store/cards';
import { isSpicyOn } from '../../store/app';
import { HeatIcons, Icon } from '../../components/icons';
import { DrinkCall, DrinkCallList } from '../shared/DrinkCall';
import { BigCard, Choice, PlayerChip } from '../shared/pieces';
import { Avatar } from '../../components/ui/Avatar';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import type { GameAction, GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import type { CardDef, CardGameConfig, CardGameState, Heat } from './types';

export type { CardDef, CardGameConfig, CardGameState, Heat } from './types';

/**
 * Baut aus einer Konfiguration ein fertiges Spiel.
 *
 * Ein neues kartenbasiertes Spiel besteht damit nur noch aus einer Datei mit
 * Metadaten und Kartentexten – keine React-Komponente, kein Reducer.
 */
export function createCardGame(config: CardGameConfig): GameDefinition<CardGameState> {
  /** Alle Karten inklusive der selbst angelegten, gefiltert nach Härte, Modus
   *  und Spicy-Einstellung. */
  const pool = (heat: Heat, mode: string | null): CardDef[] => {
    const all = config.allowCustomCards
      ? [...config.cards, ...customCardsFor(config.id)]
      : config.cards;
    const spicyOn = config.allowSpicy && isSpicyOn(config.id);
    return all
      .filter((c) => spicyOn || !c.spicy)
      // Spicy ist eine Frage des Inhalts, nicht der Menge: wer den Schalter
      // umlegt, will diese Karten sehen – und zwar auf jeder Härtestufe. Ohne
      // die Ausnahme fielen sie durch den Härtefilter, weil sie alle heat 3
      // tragen, und der Schalter täte sichtbar nichts.
      .filter((c) => c.spicy || (c.heat ?? 1) <= heat)
      .filter((c) => !mode || !c.mode || c.mode === mode);
  };

  const startsWithChoice = Boolean(config.modes) && config.actor === 'turn';

  /** Eine Runde ist ein voller Durchlauf durch die Gruppe. Der Wert steht in
   *  der gemeinsamen Tabelle, damit er neben den anderen Spielen sichtbar ist. */
  const ROUND_BASE = baseFor(config.id);

  const createState = (players: GamePlayer[]): CardGameState => {
    const deck = shuffle(pool(config.intensity, null));
    return {
      order: shuffle(players.map((p) => p.id)),
      turnIndex: 0,
      round: 1,
      goal: roundGoal(ROUND_BASE),
      heat: config.intensity,
      // Ohne Moduswahl liegt die erste Karte sofort auf dem Tisch – sonst
      // startet das Spiel mit einer leeren Flaeche.
      deck: startsWithChoice ? deck : deck.slice(1),
      drawn: startsWithChoice ? null : (deck[0] ?? null),
      mode: null,
      phase: startsWithChoice ? 'choose' : 'card',
      outcome: null,
      winner: null,
    };
  };

  const reduce = (
    state: CardGameState,
    action: GameAction,
    players: GamePlayer[],
  ): CardGameState => {
    switch (action.type) {
      case 'setHeat': {
        const heat = Number(action.heat) as Heat;
        const deck = shuffle(pool(heat, state.mode));
        // Solange die Karte nur daliegt, wird sie mitgetauscht: sonst wirkt
        // der Regler tot, weil die neue Härte erst eine Karte später sichtbar
        // wird. Ist die Karte schon aufgelöst, bleibt sie stehen – dort hängt
        // eine Trinkansage dran, die niemand unter den Fingern wegziehen darf.
        if (state.phase === 'resolved') return { ...state, heat, deck };
        return { ...state, heat, deck: deck.slice(1), drawn: deck[0] ?? null };
      }
      case 'pickMode': {
        const mode = String(action.mode);
        const deck = shuffle(pool(state.heat, mode));
        return {
          ...state,
          mode,
          drawn: deck[0] ?? null,
          deck: deck.slice(1),
          phase: 'card',
        };
      }
      case 'draw': {
        const deck = state.deck.length ? state.deck : shuffle(pool(state.heat, state.mode));
        return { ...state, drawn: deck[0] ?? null, deck: deck.slice(1), phase: 'card' };
      }
      case 'resolve':
        return {
          ...state,
          phase: 'resolved',
          outcome: action.outcome === 'refused' ? 'refused' : 'done',
          winner: null,
        };
      case 'pickWinner':
        return { ...state, winner: String(action.winner) };
      case 'next': {
        // Nur von einer liegenden oder aufgelösten Karte aus. Zwei fast
        // gleichzeitige Taps würden sonst zwei Runden zählen und eine Karte
        // überspringen; die Inbox wendet Aktionen nacheinander an.
        if (state.phase !== 'card' && state.phase !== 'resolved') return state;
        const order = syncOrder(state.order, players);
        const turnIndex = (state.turnIndex + 1) % Math.max(1, order.length);
        const round = turnIndex === 0 ? state.round + 1 : state.round;
        // Die Ziellinie liegt am Ende eines vollen Durchlaufs, damit niemand
        // mittendrin aussteigt, während andere schon dran waren.
        if (isOver(round, state.goal)) return { ...state, order, round, phase: 'over' };
        const deck = state.deck.length ? state.deck : shuffle(pool(state.heat, null));
        return {
          ...state,
          order,
          turnIndex,
          round,
          mode: null,
          outcome: null,
          winner: null,
          drawn: startsWithChoice ? null : (deck[0] ?? null),
          deck: startsWithChoice ? deck : deck.slice(1),
          phase: startsWithChoice ? 'choose' : 'card',
        };
      }
      case 'restart':
        return createState(players);
      default:
        return state;
    }
  };

  function Component({ state, players, me, dispatch, quit, online, isHost }: GameRuntime<CardGameState>) {
    // Bei "Ich hab noch nie" entscheidet jede Person für sich – das bleibt
    // lokal, es muss niemand erfahren, wer was angetippt hat.
    const [declared, setDeclared] = useState<'yes' | 'no' | null>(null);
    const actor = useMemo(() => {
      if (config.actor === 'none') return null;
      const id = state.order[state.turnIndex % Math.max(1, state.order.length)];
      return players.find((p) => p.id === id) ?? players[0] ?? null;
    }, [state.order, state.turnIndex, players]);

    const card = state.drawn;
    // Wechselt die Karte unter einer schon getroffenen Entscheidung weg (etwa
    // weil jemand den Härtegrad verstellt), gilt die Entscheidung nicht mehr.
    useEffect(() => setDeclared(null), [card?.text]);
    const isMyTurn = !actor || actor.id === me.id;
    // Pass & Play: ein Gerät, also darf es auch für den Spieler am Zug tippen.
    const canAct = !online || isMyTurn;
    const target = card?.target ?? (config.drink === 'all' ? 'all' : 'actor');
    const sips = card?.sips ?? config.baseSips;
    // Eindeutig pro Karte: sonst bliebe der "Getrunken"-Button der letzten
    // Karte auch auf der naechsten noch gesperrt.
    const callKey = `${state.round}-${state.turnIndex}-${card?.text ?? ''}`;

    const send = (action: GameActionInput) => {
      haptic('select');
      dispatch(action);
    };

    return (
      <GameFrame
        title={config.name}
        accent={config.accent}
        subtitle={
          <span className="row" style={{ justifyContent: 'center', gap: 6 }}>
            Runde {state.goal ? `${Math.min(state.round, state.goal)}/${state.goal}` : state.round}
            {config.allowSpicy && isSpicyOn(config.id) && (
              <span className="chip chip--sm" style={{ ['--tint' as string]: 'var(--pink)' }}>
                Spicy
              </span>
            )}
          </span>
        }
        onQuit={quit}
        heat={
          config.heatSelectable
            ? { value: state.heat, onChange: (h) => send({ type: 'setHeat', heat: h }) }
            : undefined
        }
        spicy={
          // Der Stapel entsteht beim Host. Online würde der Schalter beim Gast
          // nichts bewirken, deshalb bekommt er dort statt des Schalters einen
          // Satz, der das sagt – stilles Weglassen sieht aus wie ein Fehler.
          config.allowSpicy
            ? {
                gameId: config.id,
                hostOnly: online && !isHost,
                // Baut den Stapel mit derselben Härte neu, damit die neuen
                // Karten sofort und nicht erst eine Runde später auftauchen.
                onChange: () => dispatch({ type: 'setHeat', heat: state.heat }),
              }
            : undefined
        }
      >
        {actor && state.phase !== 'over' && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <PlayerChip player={actor} note={isMyTurn ? 'du bist dran' : 'ist dran'} />
          </div>
        )}

        {state.phase === 'over' && (
          <GameOver
            headline={`${state.round - 1} Runden durch. Das war's für diese Partie.`}
            onAgain={() => send({ type: 'restart' })}
            onQuit={quit}
          />
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

        {state.phase !== 'choose' && state.phase !== 'over' && card && (
          <BigCard
            animateKey={`${card.text}-${state.round}-${state.turnIndex}`}
            kicker={
              card.kicker ??
              config.modes?.find((m) => m.id === state.mode)?.label ??
              config.cardKicker ??
              config.name
            }
            footer={
              <span className="row" style={{ justifyContent: 'center', gap: 8 }}>
                {(card.heat ?? 1) > 1 && <HeatIcons level={card.heat ?? 1} />}
                {card.custom && <span className="chip chip--outline">eigene Karte</span>}
            {card.spicy && (
              <span className="chip" style={{ ['--tint' as string]: 'var(--pink)' }}>
                Spicy
              </span>
            )}
              </span>
            }
          >
            {card.text}
          </BigCard>
        )}

        {state.phase === 'card' && config.drink === 'self-declare' && online && (
          <div className="stack-3">
            {declared === null ? (
              <Choice
                options={[
                  {
                    id: 'yes',
                    tone: 'var(--red)',
                    label: (
                      <>
                        <Icon name="check" size={20} /> {config.declare?.yes ?? 'Hab ich'}
                      </>
                    ),
                  },
                  {
                    id: 'no',
                    tone: 'var(--green)',
                    label: (
                      <>
                        <Icon name="close" size={20} /> {config.declare?.no ?? 'Nie gemacht'}
                      </>
                    ),
                  },
                ]}
                onPick={(id) => {
                  haptic(id === 'yes' ? 'warn' : 'success');
                  setDeclared(id as 'yes' | 'no');
                }}
              />
            ) : declared === 'yes' ? (
              <DrinkCall
                player={me}
                baseSips={sips}
                source={config.id}
                label={config.declare?.label ?? 'ertappt'}
                resetKey={callKey}
              />
            ) : (
              <div className="t-center t-sub">
                {config.declare?.clean ?? 'Sauber geblieben. Diese Runde kostet dich nichts.'}
              </div>
            )}
            <button
              className="btn btn--brand btn--block btn--lg"
              disabled={declared === null}
              onClick={() => {
                setDeclared(null);
                send({ type: 'next' });
              }}
            >
              {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächste Karte'}
            </button>
          </div>
        )}

        {state.phase === 'card' && !(config.drink === 'self-declare' && online) && (
          <div className="stack-3">
            {config.drink === 'self-declare' && (
              <>
                <div className="t-upper t-center">{config.declare?.heading ?? 'Wen es trifft, trinkt'}</div>
                <DrinkCallList
                  players={players}
                  baseSips={sips}
                  source={config.id}
                  resetKey={callKey}
                />
              </>
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
              actor && (
                <DrinkCall
                  player={actor}
                  baseSips={config.refuseSips ?? sips + 2}
                  source={config.id}
                  label="gekniffen"
                  resetKey={callKey}
                />
              )
            ) : config.pickWinner ? (
              // Wer die Runde geholt hat, ist raus – alle anderen trinken.
              // Ohne diese Auswahl bliebe das Versprechen aus der Anleitung
              // („wer zuerst errät, ist raus") ohne Wirkung im Spiel.
              state.winner === null ? (
                <div className="stack-3">
                  <div className="t-upper t-center">{config.pickWinner.prompt}</div>
                  <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
                    {players
                      .filter((p) => p.id !== actor?.id && p.online !== false)
                      .map((p) => (
                        <button
                          key={p.id}
                          className="pchip pchip--pick pressable"
                          onClick={() => send({ type: 'pickWinner', winner: p.id })}
                        >
                          <Avatar name={p.name} color={p.color} size="sm" />
                          <span className="pchip__name">{p.name}</span>
                        </button>
                      ))}
                  </div>
                  <button
                    className="btn btn--glass btn--block"
                    onClick={() => send({ type: 'pickWinner', winner: '' })}
                  >
                    Niemand von uns
                  </button>
                </div>
              ) : (
                <DrinkCallList
                  players={players.filter((p) => p.id !== state.winner)}
                  baseSips={config.pickWinner.sips}
                  label={config.pickWinner.label}
                  source={config.id}
                  resetKey={`${callKey}-${state.winner}`}
                />
              )
            ) : config.drink === 'none' ? (
              <div className="t-center t-sub">Sauber. Weiter geht's.</div>
            ) : config.drink === 'self-declare' ? (
              <div className="t-center t-sub">Alle ehrlich? Weiter.</div>
            ) : target === 'all' ? (
              <DrinkCallList
                players={players}
                baseSips={sips}
                source={config.id}
                resetKey={callKey}
              />
            ) : (
              actor && (
                <DrinkCall
                  player={actor}
                  baseSips={sips}
                  source={config.id}
                  resetKey={callKey}
                />
              )
            )}
            <button
              className="btn btn--brand btn--block btn--lg"
              disabled={Boolean(config.pickWinner) && state.winner === null}
              onClick={() => {
                setDeclared(null);
                send({ type: 'next' });
              }}
            >
              {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächster'}
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
    allowCustomCards: config.allowCustomCards,
    allowSpicy: config.allowSpicy,
    modes: config.modes?.map((m) => ({ id: m.id, label: m.label })),
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
