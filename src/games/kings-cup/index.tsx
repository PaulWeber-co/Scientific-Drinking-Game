import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { cardFromIndex, fullDeck } from '../shared/deck';
import { PlayingCard } from '../shared/PlayingCard';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { useApp } from '../../store/app';
import { DrinkCall, DrinkCallList } from '../shared/DrinkCall';
import { BigCard, PlayerChip } from '../shared/pieces';
import { Avatar } from '../../components/ui/Avatar';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { meta } from './meta';

export interface Rule {
  title: string;
  text: string;
  /**
   * Wer beim Aufdecken trinkt:
   *  - 'all'    alle gleichzeitig (Wasserfall)
   *  - 'actor'  wer gezogen hat (Ich)
   *  - 'pick'   der Ziehende zeigt auf eine ANDERE Person, die trinkt
   *             (Du, Partner)
   *  - 'loser'  irgendwer benennt, wer das Mini-Duell verloren hat – das
   *             kann auch der Ziehende selbst sein (Boden, Himmel)
   *  - 'left' | 'right'  die feste Sitzordnung (state.order) entscheidet,
   *             kein Antippen nötig (Links, Rechts)
   *  - 'none'   niemand trinkt gerade – entweder nie (König) oder erst
   *             später am Tisch, ohne dass die App das sehen kann (Reim,
   *             Kategorie, Regel, Fragemeister)
   */
  drink: 'all' | 'actor' | 'pick' | 'loser' | 'left' | 'right' | 'none';
  sips: number;
}

export const RULES: Rule[] = [
  { title: 'Wasserfall', text: 'Alle trinken gleichzeitig. Du fängst an, erst wenn du absetzt, darf die Person links absetzen – und so weiter.', drink: 'all', sips: 4 },
  { title: 'Du', text: 'Du bestimmst, wer trinkt. Zeig auf eine Person.', drink: 'pick', sips: 3 },
  { title: 'Ich', text: 'Du trinkst. Ohne Diskussion.', drink: 'actor', sips: 3 },
  { title: 'Boden', text: 'Alle fassen den Boden an. Die letzte Hand trinkt.', drink: 'loser', sips: 3 },
  { title: 'Links', text: 'Alle links von dir trinken.', drink: 'left', sips: 3 },
  { title: 'Rechts', text: 'Alle rechts von dir trinken.', drink: 'right', sips: 3 },
  { title: 'Himmel', text: 'Alle Hände hoch. Die letzte Hand trinkt.', drink: 'loser', sips: 3 },
  { title: 'Partner', text: 'Wähle eine Person. Ab jetzt trinkt sie immer mit dir mit – bis zum nächsten Partner.', drink: 'pick', sips: 2 },
  // Reim/Kategorie/Regel/Fragemeister treffen niemanden beim Aufdecken,
  // sondern erst irgendwann später im Gespräch (wer im Reim hängt, die
  // Regel bricht oder eine Frage beantwortet). Die App sieht das nicht –
  // eine Ansage jetzt ginge an die falsche Person, genau wie bisher an den
  // Handybesitzer. sips: 0 zeigt bewusst nur den Kartentext; getrunken wird
  // am Tisch, wenn es tatsächlich so weit ist.
  { title: 'Reim', text: 'Sag ein Wort. Reihum wird gereimt. Wer hängt oder wiederholt, trinkt.', drink: 'none', sips: 0 },
  { title: 'Kategorie', text: 'Nenne eine Kategorie. Reihum ein Beispiel. Wer hängt, trinkt.', drink: 'none', sips: 0 },
  { title: 'Regel', text: 'Erfinde eine Regel, die ab jetzt für alle gilt. Wer sie bricht, trinkt.', drink: 'none', sips: 0 },
  { title: 'Fragemeister', text: 'Du bist Fragemeister. Wer dir bis zur nächsten Dame auf eine Frage antwortet, trinkt.', drink: 'none', sips: 0 },
  { title: 'König', text: 'Gieß einen Schluck deines Getränks in den Becher der Mitte.', drink: 'none', sips: 0 },
];

/**
 * Feste Sitzordnung (state.order) in zwei Hälften teilen: wer vom Ziehenden
 * aus links bzw. rechts sitzt. `order` wird nur beim Start gemischt und bei
 * Beitritt/Verlassen synchronisiert (siehe 'next') – sonst bleibt die
 * Reihenfolge die ganze Partie stabil und bildet damit den Sitzkreis ab.
 * Eine Auswahl braucht es hier deshalb nicht: „links"/„rechts" ist ohnehin
 * nur die geschlechtsfreie Ersetzung von „Jungs"/„Mädels" (zwei konsistente
 * Hälften, keine geometrische Tatsache, die erst wer bestätigen müsste).
 * Bei einer ungeraden Anzahl an Mitspielern bekommt „rechts" die Person
 * genau gegenüber mit dazu – eine Deutung, keine Regel aus einer Quelle.
 */
export function seatSplit(order: string[], actorId: string): { left: string[]; right: string[] } {
  const i = order.indexOf(actorId);
  const others = order.filter((id) => id !== actorId);
  if (i === -1 || !others.length) return { left: [], right: [] };
  const n = order.length;
  const rightCount = Math.ceil(others.length / 2);
  const right = Array.from({ length: rightCount }, (_, k) => order[(i + k + 1) % n]);
  const left = others.filter((id) => !right.includes(id));
  return { left, right };
}

interface State {
  order: string[];
  turnIndex: number;
  deck: number[];
  drawn: number | null;
  kings: number;
  round: number;
  /**
   * Für Regeln mit Zielauswahl (Du, Partner, Boden, Himmel): wer für die
   * aktuell gezogene Karte benannt wurde. Wird mit jeder neuen Karte
   * zurückgesetzt.
   */
  target: string | null;
  /** true, sobald der vierte König gezogen wurde. */
  finalKing: boolean;
  /** true, sobald der Becher getrunken ist – dann ist die Partie vorbei. */
  over: boolean;
  /** Bei „ohne Ende" läuft das Spiel über den vierten König hinaus weiter. */
  endless: boolean;
}

export const kingsCup: GameDefinition<State> = {
  ...meta,

  createState: (players) => ({
    order: shuffle(players.map((p) => p.id)),
    turnIndex: 0,
    deck: shuffle(fullDeck()),
    drawn: null,
    kings: 0,
    round: 1,
    target: null,
    finalKing: false,
    over: false,
    endless: useApp.getState().gameLength === 'endlos',
  }),

  reduce: (state, action, players) => {
    switch (action.type) {
      case 'draw': {
        // Zwei fast gleichzeitige Taps, bevor der Re-Render den Knopf entfernt:
        // die zweite Karte ueberschriebe die erste UND berechnete `finalKing`
        // neu aus sich selbst - war die erste der vierte Koenig, waere der
        // Becher-Moment lautlos weg.
        if (state.drawn != null) return state;
        // Leerer Stapel: neu mischen UND sofort ziehen – sonst bleibt
        // `drawn` null und der Tap wirkt folgenlos. Ein frischer Stapel ist
        // auch ein frischer Becher: der alte Königsstand darf nicht mit
        // hinüberlaufen (52 Karten enthalten immer genau 4 Könige neu).
        const fresh = !state.deck.length;
        const deck = fresh ? shuffle(fullDeck()) : state.deck;
        const [next, ...rest] = deck;
        const isKing = cardFromIndex(next).rank === 12;
        const kings = (fresh ? 0 : state.kings) + (isKing ? 1 : 0);
        return {
          ...state,
          drawn: next,
          deck: rest,
          kings,
          finalKing: isKing && kings >= 4,
          target: null,
        };
      }
      case 'pickTarget': {
        // Nur gueltig, solange die Karte noch liegt – sonst haengt eine
        // verspaetete Auswahl an der naechsten Karte.
        if (state.drawn == null) return state;
        return { ...state, target: String(action.target) };
      }
      case 'next': {
        // Ebenso: zwei Taps wuerden `turnIndex` zweimal erhoehen und eine
        // Person still ueberspringen. Die Inbox wendet Aktionen nacheinander an.
        if (state.drawn == null) return state;
        const ids = new Set(players.map((p) => p.id));
        const order = [
          ...state.order.filter((id) => ids.has(id)),
          ...players.filter((p) => !state.order.includes(p.id)).map((p) => p.id),
        ];
        const turnIndex = (state.turnIndex + 1) % Math.max(1, order.length);
        // Der vierte König ist das Ende des Spiels, nicht bloß eine harte
        // Karte. Nur „ohne Ende" mischt danach weiter.
        if (state.finalKing && !state.endless) return { ...state, order, over: true };
        return {
          ...state,
          order,
          turnIndex,
          drawn: null,
          target: null,
          round: turnIndex === 0 ? state.round + 1 : state.round,
          kings: state.finalKing ? 0 : state.kings,
          finalKing: false,
        };
      }
      case 'restart':
        return kingsCup.createState(players);
      default:
        return state;
    }
  },

  Component: KingsCupGame,
};

function KingsCupGame({ state, players, me, online, dispatch, quit }: GameRuntime<State>) {
  const actorId = state.order[state.turnIndex % Math.max(1, state.order.length)];
  const actor = players.find((p) => p.id === actorId) ?? players[0];
  const isMyTurn = actor?.id === me.id;
  const card = state.drawn != null ? cardFromIndex(state.drawn) : null;
  const rule = card ? RULES[card.rank] : null;
  // Jede gezogene Karte ist eine eigene Ansage – der Stapelstand macht sie eindeutig.
  const key = `${state.deck.length}-${state.drawn}`;

  // 'pick' (Du, Partner): der Ziehende zeigt auf eine ANDERE Person – online
  // darf deshalb nur sein eigenes Gerät antippen. 'loser' (Boden, Himmel)
  // benennt, wer ein Mini-Duell verloren hat; das ist eine für alle
  // sichtbare Tatsache, kein Vorrecht des Ziehenden, und bleibt offen –
  // genau wie die Sieger-Auswahl im Karten-Baukasten (pickWinner).
  const pickable = players.filter(
    (p) => p.online !== false && (rule?.drink !== 'pick' || p.id !== actorId),
  );
  const canPick = !online || isMyTurn;
  const target = state.target ? (players.find((p) => p.id === state.target) ?? null) : null;

  const seat = rule?.drink === 'left' || rule?.drink === 'right' ? seatSplit(state.order, actorId) : null;
  const sideIds = rule?.drink === 'left' ? seat?.left : rule?.drink === 'right' ? seat?.right : undefined;
  const sideTargets = (sideIds ?? [])
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is GamePlayer => Boolean(p));

  // Ohne benannte Zielperson gibt es niemanden, dem die Ansage gehört –
  // "Nächster" bleibt dann gesperrt, bis wer getippt hat (wie pickWinner).
  const needsTarget = !state.finalKing && (rule?.drink === 'pick' || rule?.drink === 'loser');

  const send = (a: GameActionInput) => {
    haptic(a.type === 'draw' ? 'heavy' : 'select');
    dispatch(a);
  };

  if (state.over) {
    return (
      <GameFrame
        title={kingsCup.name}
        accent={kingsCup.accent}
        subtitle="Der Becher ist leer"
        onQuit={quit}
      >
        <GameOver
          headline={`Vier Könige, ${state.round} Runden. ${actor?.name ?? 'Wer zuletzt zog'} hat den Becher getrunken.`}
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

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
            <DrinkCall player={actor} baseSips={8} source="kings-cup" label="der Becher" resetKey={key} />
          ) : rule?.drink === 'all' ? (
            <DrinkCallList players={players} baseSips={rule.sips} source="kings-cup" resetKey={key} />
          ) : rule?.drink === 'actor' ? (
            <DrinkCall player={actor} baseSips={rule.sips} source="kings-cup" resetKey={key} />
          ) : rule?.drink === 'left' || rule?.drink === 'right' ? (
            <DrinkCallList players={sideTargets} baseSips={rule.sips} source="kings-cup" resetKey={key} />
          ) : rule?.drink === 'pick' || rule?.drink === 'loser' ? (
            target ? (
              <DrinkCall player={target} baseSips={rule.sips} source="kings-cup" resetKey={key} />
            ) : (
              <div className="stack-3">
                <div className="t-upper t-center">
                  {rule.drink === 'pick' ? 'Wer ist gemeint?' : 'Wer hat verloren?'}
                </div>
                <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
                  {pickable.map((p) => (
                    <button
                      key={p.id}
                      className="pchip pchip--pick pressable"
                      disabled={rule.drink === 'pick' && !canPick}
                      onClick={() => send({ type: 'pickTarget', target: p.id })}
                    >
                      <Avatar name={p.name} color={p.color} size="sm" />
                      <span className="pchip__name">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="t-center t-sub t-balance">
              Diese Karte kostet gerade niemanden einen Schluck.
            </div>
          )}
          <button
            className="btn btn--brand btn--block btn--lg"
            disabled={needsTarget && !target}
            onClick={() => send({ type: 'next' })}
          >
            {state.finalKing && !state.endless ? 'Becher leeren und Schluss' : 'Nächster'}
          </button>
        </div>
      )}
    </GameFrame>
  );
}
