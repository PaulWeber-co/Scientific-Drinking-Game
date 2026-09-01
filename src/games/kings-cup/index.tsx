import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { cardFromIndex, fullDeck } from '../shared/deck';
import { PlayingCard } from '../shared/PlayingCard';
import { GameFrame } from '../shared/GameFrame';
import { DrinkCall, DrinkCallList } from '../shared/DrinkCall';
import { BigCard, PlayerChip } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GameRuntime } from '../types';

interface Rule {
  title: string;
  text: string;
  /** Wer trinkt: der Ziehende, alle – oder niemand automatisch. */
  drink: 'actor' | 'all' | 'none';
  sips: number;
}

const RULES: Rule[] = [
  { title: 'Wasserfall', text: 'Alle trinken gleichzeitig. Du fängst an, erst wenn du absetzt, darf die Person links absetzen – und so weiter.', drink: 'all', sips: 4 },
  { title: 'Du', text: 'Du bestimmst, wer trinkt. Zeig auf eine Person.', drink: 'none', sips: 3 },
  { title: 'Ich', text: 'Du trinkst. Ohne Diskussion.', drink: 'actor', sips: 3 },
  { title: 'Boden', text: 'Alle fassen den Boden an. Die letzte Hand trinkt.', drink: 'none', sips: 3 },
  { title: 'Links', text: 'Alle links von dir trinken.', drink: 'none', sips: 3 },
  { title: 'Rechts', text: 'Alle rechts von dir trinken.', drink: 'none', sips: 3 },
  { title: 'Himmel', text: 'Alle Hände hoch. Die letzte Hand trinkt.', drink: 'none', sips: 3 },
  { title: 'Partner', text: 'Wähle eine Person. Ab jetzt trinkt sie immer mit dir mit – bis zum nächsten Partner.', drink: 'none', sips: 2 },
  { title: 'Reim', text: 'Sag ein Wort. Reihum wird gereimt. Wer hängt oder wiederholt, trinkt.', drink: 'none', sips: 3 },
  { title: 'Kategorie', text: 'Nenne eine Kategorie. Reihum ein Beispiel. Wer hängt, trinkt.', drink: 'none', sips: 3 },
  { title: 'Regel', text: 'Erfinde eine Regel, die ab jetzt für alle gilt. Wer sie bricht, trinkt.', drink: 'none', sips: 2 },
  { title: 'Fragemeister', text: 'Du bist Fragemeister. Wer dir bis zur nächsten Dame auf eine Frage antwortet, trinkt.', drink: 'none', sips: 2 },
  { title: 'König', text: 'Gieß einen Schluck deines Getränks in den Becher der Mitte.', drink: 'none', sips: 0 },
];

interface State {
  order: string[];
  turnIndex: number;
  deck: number[];
  drawn: number | null;
  kings: number;
  round: number;
  /** true, sobald der vierte König gezogen wurde. */
  finalKing: boolean;
}

export const kingsCup: GameDefinition<State> = {
  id: 'kings-cup',
  name: 'Ring of Fire',
  tagline: 'Kings Cup. 52 Karten, 13 Regeln, ein Becher.',
  icon: 'crown',
  accent: 'var(--red)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '20-45 Min',
  intensity: 3,
  tags: ['karten', 'handy-weg', 'reden'],
  requiresOwnDevice: false,
  howTo: [
    'Ein leeres Glas steht in der Mitte – das ist der Becher.',
    'Reihum zieht jede Person eine Karte. Der Kartenwert bestimmt die Regel.',
    'Wer den vierten König zieht, trinkt den Becher.',
  ],

  createState: (players) => ({
    order: shuffle(players.map((p) => p.id)),
    turnIndex: 0,
    deck: shuffle(fullDeck()),
    drawn: null,
    kings: 0,
    round: 1,
    finalKing: false,
  }),

  reduce: (state, action, players) => {
    switch (action.type) {
      case 'draw': {
        if (!state.deck.length) return { ...state, deck: shuffle(fullDeck()), drawn: null };
        const [next, ...rest] = state.deck;
        const isKing = cardFromIndex(next).rank === 12;
        const kings = state.kings + (isKing ? 1 : 0);
        return { ...state, drawn: next, deck: rest, kings, finalKing: isKing && kings >= 4 };
      }
      case 'next': {
        const ids = new Set(players.map((p) => p.id));
        const order = [
          ...state.order.filter((id) => ids.has(id)),
          ...players.filter((p) => !state.order.includes(p.id)).map((p) => p.id),
        ];
        const turnIndex = (state.turnIndex + 1) % Math.max(1, order.length);
        return {
          ...state,
          order,
          turnIndex,
          drawn: null,
          round: turnIndex === 0 ? state.round + 1 : state.round,
          kings: state.finalKing ? 0 : state.kings,
          finalKing: false,
        };
      }
      default:
        return state;
    }
  },

  Component: KingsCupGame,
};

function KingsCupGame({ state, players, me, dispatch, quit }: GameRuntime<State>) {
  const actorId = state.order[state.turnIndex % Math.max(1, state.order.length)];
  const actor = players.find((p) => p.id === actorId) ?? players[0];
  const isMyTurn = actor?.id === me.id;
  const card = state.drawn != null ? cardFromIndex(state.drawn) : null;
  const rule = card ? RULES[card.rank] : null;

  const send = (a: GameActionInput) => {
    haptic(a.type === 'draw' ? 'heavy' : 'select');
    dispatch(a);
  };

  return (
    <GameFrame
      title={kingsCup.name}
      accent={kingsCup.accent}
      subtitle={`${state.deck.length} Karten · ${state.kings}/4 Könige`}
      onQuit={quit}
    >
      <div className="row" style={{ justifyContent: 'center' }}>
        <PlayerChip player={actor} note={isMyTurn ? 'du ziehst' : 'zieht'} />
      </div>

      <div className="cardrow">
        <PlayingCard index={state.drawn} hidden={state.drawn == null} />
      </div>

      {rule && card ? (
        <BigCard kicker={state.finalKing ? 'Vierter König' : rule.title} animateKey={state.drawn ?? 0}>
          {state.finalKing ? 'Du trinkst den Becher. Alles. Viel Erfolg.' : rule.text}
        </BigCard>
      ) : (
        <BigCard kicker="Ring of Fire">
          {isMyTurn ? 'Du bist dran. Zieh eine Karte.' : `${actor?.name} zieht gleich.`}
        </BigCard>
      )}

      {state.drawn == null ? (
        <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'draw' })}>
          Karte ziehen
        </button>
      ) : (
        <div className="stack-3">
          {state.finalKing ? (
            <DrinkCall player={actor} baseSips={8} source="kings-cup" label="der Becher" />
          ) : rule?.drink === 'all' ? (
            <DrinkCallList players={players} baseSips={rule.sips} source="kings-cup" />
          ) : rule?.drink === 'actor' ? (
            <DrinkCall player={actor} baseSips={rule.sips} source="kings-cup" />
          ) : rule && rule.sips > 0 ? (
            <DrinkCall
              player={me}
              baseSips={rule.sips}
              source="kings-cup"
              label="wenn die Regel dich trifft"
            />
          ) : (
            <div className="t-center t-sub t-balance">
              Diese Karte kostet gerade niemanden einen Schluck.
            </div>
          )}
          <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
            Nächster
          </button>
        </div>
      )}
    </GameFrame>
  );
}
