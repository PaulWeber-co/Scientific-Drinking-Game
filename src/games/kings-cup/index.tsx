import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { cardFromIndex, cardLabel, fullDeck } from '../shared/deck';
import { Becher, Kranz } from './Kranz';
import { nearestFilled } from './geometrie';
import { PlayingCard } from '../shared/PlayingCard';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { useApp } from '../../store/app';
import { DrinkCall, DrinkCallList } from '../shared/DrinkCall';
import { BigCard, PlayerChip } from '../shared/pieces';
import { Avatar } from '../../components/ui/Avatar';
import { Icon } from '../../components/icons';
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
 * Aus der Regelliste abgeleitet statt hart geschrieben: wer die Liste
 * umsortiert, soll nicht still die falsche Karte treffen.
 */
const RULE_RANK = RULES.findIndex((r) => r.title === 'Regel');
const MASTER_RANK = RULES.findIndex((r) => r.title === 'Fragemeister');
/** Mehr passt nicht auf den Schirm, ohne die Karte zu verdraengen. */
const MAX_RULES = 4;
const MAX_RULE_CHARS = 60;

/**
 * Antippbare Vorschlaege. Um ein Uhr nachts tippt niemand gern einen Satz,
 * und eine Tastatur, die den halben Bildschirm verdeckt, haelt den Tisch auf.
 */
const RULE_IDEAS = [
  'Keine Vornamen',
  'Nur mit links trinken',
  'Kein Fluchen',
  'Vor dem Trinken anstoßen',
  'Niemand sagt „ich"',
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
  /**
   * Der Kranz, nicht ein Stapel: 52 FESTE Plätze, `null` heißt „hier wurde
   * gezogen". Platz `i` liegt bei `i * 360/52` Grad.
   *
   * Die verbleibenden Karten neu zu verteilen wäre einfacher, ließe aber den
   * ganzen Kranz bei jedem Zug wandern — und die Lücke stünde nicht dort, wo
   * der Finger war. Genau das ist der Punkt des Kranzes.
   *
   * Firebase wirft `null` aus Arrays; der Zustand geht aber als JSON-String
   * raus (`encodeState`), deshalb überleben die Löcher.
   */
  deck: (number | null)[];
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
  /**
   * Erfundene Regeln, älteste zuerst.
   *
   * Der Grund, warum sie überhaupt im Zustand stehen: Ein Kartenstapel
   * vergisst die Regel in dem Moment, in dem die Karte weiterwandert, und am
   * Tisch erinnert sich nach drei Runden niemand mehr. Ein Handy kann das.
   */
  rules: { by: string; text: string }[];
  /**
   * Gehört die oberste Regel zur gerade liegenden Karte? Dann überschreibt
   * ein zweiter Eintrag sie, statt eine zweite anzulegen — zwei Taps auf
   * „Regel merken" legten sonst dieselbe Regel doppelt an.
   */
  ruleOpen: boolean;
  /** Wer Fragemeister ist. Löst sich mit der nächsten Dame ab. */
  questionMaster: string | null;
  /**
   * Wer in den Becher gegossen hat, älteste zuerst, höchstens drei. König
   * 1–3 gießen, der vierte trinkt — deshalb drei und nicht vier.
   *
   * Der Becher zeigt damit WER, nie wie viel. Ein simulierter Füllstand
   * widerspräche dem echten Becher auf dem Tisch.
   */
  pours: string[];
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
    rules: [],
    ruleOpen: false,
    questionMaster: null,
    pours: [],
  }),

  reduce: (state, action, players) => {
    switch (action.type) {
      case 'draw': {
        // Zwei fast gleichzeitige Taps, bevor der Re-Render den Knopf entfernt:
        // die zweite Karte ueberschriebe die erste UND berechnete `finalKing`
        // neu aus sich selbst - war die erste der vierte Koenig, waere der
        // Becher-Moment lautlos weg.
        if (state.drawn != null) return state;
        // Leerer Kranz: neu mischen UND sofort ziehen – sonst bleibt
        // `drawn` null und der Tap wirkt folgenlos. Ein frischer Kranz ist
        // auch ein frischer Becher: der alte Königsstand darf nicht mit
        // hinüberlaufen (52 Karten enthalten immer genau 4 Könige neu).
        const fresh = state.deck.every((c) => c == null);
        const deck = fresh ? shuffle(fullDeck()) : state.deck;
        // Der Finger waehlt einen PLATZ. Eine verspaetete Aktion kann auf ein
        // Loch zeigen – dann faellt sie auf den naechsten belegten Platz
        // zurueck, statt still nichts zu tun. Ohne diese Pruefung zoege ein
        // zweiter Tap aus einem gerade geleerten Platz `undefined`.
        const platz = nearestFilled(deck, Number(action.slot));
        if (platz < 0) return state;
        const next = deck[platz] as number;
        const gezogen = cardFromIndex(next);
        const isKing = gezogen.rank === 12;
        const kings = (fresh ? 0 : state.kings) + (isKing ? 1 : 0);
        const finalKing = isKing && kings >= 4;
        // Frischer Kranz = frischer Becher: die Schichten der vorigen Runde
        // laufen nicht hinueber.
        const basisPours = fresh ? [] : state.pours;
        const rest = deck.slice();
        rest[platz] = null;
        return {
          ...state,
          drawn: next,
          deck: rest,
          kings,
          finalKing,
          target: null,
          // König 1–3 giessen, der vierte trinkt. Deshalb hier `!finalKing`.
          // Das Leeren beim frischen Kranz steht bewusst in EINEM Ausdruck:
          // stand es in beiden Zweigen, traf eine Aenderung nur den Koenigs-
          // Zweig, und der kommt in 4 von 52 Zuegen - eine Pruefung darauf
          // haenge am Mischglueck statt am Verhalten.
          pours: isKing && !finalKing ? [...basisPours, state.order[state.turnIndex]] : basisPours,
          // Die Dame loest den Fragemeister ab. Regeln ueberleben ein neues
          // Blatt: sie sind eine Abmachung am Tisch, kein Stapelzustand.
          questionMaster:
            gezogen.rank === MASTER_RANK
              ? state.order[state.turnIndex]
              : state.questionMaster,
        };
      }
      case 'pickTarget': {
        // Nur gueltig, solange die Karte noch liegt – sonst haengt eine
        // verspaetete Auswahl an der naechsten Karte.
        if (state.drawn == null) return state;
        return { ...state, target: String(action.target) };
      }
      case 'setRule': {
        // Nur solange die Regel-Karte liegt. Ohne diese Pruefung haengt eine
        // verspaetete Eingabe an der naechsten Karte.
        if (state.drawn == null) return state;
        if (cardFromIndex(state.drawn).rank !== RULE_RANK) return state;
        // Nach ZEICHEN kuerzen, nicht nach Code-Einheiten: `slice` zerlegt
        // ein Emoji an der Grenze in ein halbes Zeichen. Und Umbrueche raus -
        // ueber die Lobby kommt beliebiger Text, nicht nur was unser Feld
        // zulaesst.
        const roh = String(action.text ?? '').replace(/\s+/g, ' ').trim();
        const text = Array.from(roh).slice(0, MAX_RULE_CHARS).join('');
        if (!text) return state;
        const eintrag = { by: state.order[state.turnIndex], text };
        const rules = state.ruleOpen
          ? [...state.rules.slice(0, -1), eintrag]
          : [...state.rules, eintrag];
        return { ...state, rules: rules.slice(-MAX_RULES), ruleOpen: true };
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
        // `ruleOpen` auch hier: es ist der einzige Ausgang, der die
        // Invariante sonst nicht haelt.
        const master = state.questionMaster && ids.has(state.questionMaster)
          ? state.questionMaster
          : null;
        if (state.finalKing && !state.endless) {
          return { ...state, order, over: true, ruleOpen: false, questionMaster: master };
        }
        return {
          ...state,
          order,
          turnIndex,
          drawn: null,
          target: null,
          round: turnIndex === 0 ? state.round + 1 : state.round,
          kings: state.finalKing ? 0 : state.kings,
          // Der Becher ist ausgetrunken – die Schichten gehen mit.
          pours: state.finalKing ? [] : state.pours,
          finalKing: false,
          ruleOpen: false,
          // Wer die Runde verlaesst, bleibt sonst als tote Kennung stehen:
          // die Oberflaeche blendet den Streifen still aus, der Zustand luegt.
          questionMaster: master,
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
  const [entwurf, setEntwurf] = useState('');
  // Der Entwurf gehoert zur liegenden Karte. Ohne das hier findet die naechste
  // Person den halben Satz ihres Vorgaengers im Feld, mit aktivem Knopf.
  useEffect(() => setEntwurf(''), [state.drawn]);
  const actorId = state.order[state.turnIndex % Math.max(1, state.order.length)];
  const actor = players.find((p) => p.id === actorId) ?? players[0];
  const isMyTurn = actor?.id === me.id;
  const card = state.drawn != null ? cardFromIndex(state.drawn) : null;
  const rule = card ? RULES[card.rank] : null;
  // `deck` ist jetzt der Kranz und immer 52 Plaetze lang – gezaehlt wird, was
  // noch liegt.
  const uebrig = state.deck.reduce<number>((n, c) => n + (c == null ? 0 : 1), 0);
  // Jede gezogene Karte ist eine eigene Ansage – der Kranzstand macht sie eindeutig.
  const key = `${uebrig}-${state.drawn}`;

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
  const fragemeister = players.find((p) => p.id === state.questionMaster) ?? null;
  const nameVon = (id: string) => players.find((p) => p.id === id)?.name ?? '';

  const send = (a: GameActionInput) => {
    haptic(a.type === 'draw' ? 'heavy' : 'select');
    dispatch(a);
  };

  // Wo die Karte im Kranz lag. Die Einblendung startet dort, damit der Blick
  // ihr folgt statt sie in der Mitte zu suchen. Eine Ref, keine State: sie
  // darf keinen Re-Render ausloesen, der Zustand kommt ohnehin gleich.
  const zugVon = useRef<DOMRect | null>(null);
  const flugRef = useRef<HTMLDivElement>(null);
  const ziehen = (slot: number, von?: DOMRect) => {
    zugVon.current = von ?? null;
    send({ type: 'draw', slot });
  };

  /**
   * Der Flug wird GEMESSEN, nicht geraten (FLIP): erst steht die Karte an
   * ihrem Zielort, dann rechnen wir den Weg von ihrem alten Platz dorthin und
   * lassen die Animation ihn ruecklaeufig fahren.
   *
   * Eine geratene Weite lag rund 90 px daneben, weil der Kranzmittelpunkt und
   * die Mitte der Kartenzeile nicht uebereinanderliegen. Ohne Messwert - also
   * auf jedem Geraet, das nicht selbst gezogen hat - fliegt bewusst nichts:
   * ein Flug aus einem fremden Platz waere schlechter als keiner.
   */
  useLayoutEffect(() => {
    const von = zugVon.current;
    zugVon.current = null;
    const feld = flugRef.current;
    const karte = feld?.querySelector('.playcard');
    if (!von || !feld || !karte) return;
    const bis = karte.getBoundingClientRect();
    if (!bis.width || !von.width) return;
    feld.style.setProperty('--zug-x', `${von.left + von.width / 2 - (bis.left + bis.width / 2)}px`);
    feld.style.setProperty('--zug-y', `${von.top + von.height / 2 - (bis.top + bis.height / 2)}px`);
    feld.style.setProperty('--zug-s', `${von.width / bis.width}`);
    feld.classList.add('kings-zug--los');
  }, [state.drawn]);

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
      // Der Tisch zeigt Kranz und Becher - dann sind die Zahlen daneben
      // Doppelung. Erst wenn er eingeklappt ist, treten sie an seine Stelle.
      subtitle={state.drawn == null ? undefined : `${uebrig} Karten · ${state.kings}/4 Könige`}
      onQuit={quit}
    >
      {/* Was ein Kartenstapel vergisst, sobald die Karte weiterwandert. Steht
          deshalb ueber der Karte und bleibt stehen, nicht als Ansage, die
          nach einem Zug verschwindet. */}
      {(state.rules.length > 0 || fragemeister) && (
        <div className="merkzettel" role="list" aria-label="Merkzettel" aria-live="polite">
          {fragemeister && (
            <span className="merkzettel__item merkzettel__item--rolle" role="listitem">
              <Icon name="chat" size={13} />
              {fragemeister.name} fragt – wer antwortet, trinkt
            </span>
          )}
          {state.rules.map((r, i) => (
            <span key={`${i}-${r.text}`} className="merkzettel__item" role="listitem">
              {r.text}
              {nameVon(r.by) && <span className="merkzettel__von">· {nameVon(r.by)}</span>}
            </span>
          ))}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center' }}>
        <PlayerChip player={actor} note={isMyTurn ? 'du ziehst' : 'zieht'} />
      </div>

      {/* Zwei Zustaende, ein Bildschirm (User-Entscheid 2026-09-10): ohne
          liegende Karte IST der Bildschirm der Tisch, danach gehoert er der
          Karte. Beides gleichzeitig macht beides halb so gross. */}
      {state.drawn == null ? (
        <>
          <Kranz
            deck={state.deck}
            pours={state.pours}
            players={players}
            canDraw={!online || isMyTurn}
            onDraw={ziehen}
          />
          {/* Vorher stand hier ein grosser Markenknopf. `t-caption` waere mit
              2,0:1 unter der Grenze von 1.4.3 - die einzige Anweisung auf dem
              Bildschirm darf nicht die leiseste Zeile darauf sein. */}
          <div className="t-center t-body">
            {isMyTurn
              ? 'Zieh dir eine Karte aus dem Kranz.'
              : `${actor?.name} zieht gleich.`}
          </div>
        </>
      ) : (
        <>
          <div className="cardrow kings-zug" key={key} ref={flugRef}>
            <PlayingCard index={state.drawn} />
            {/* Die echte Rueckseite liegt waehrend der Fahrt darueber und wird
                erst in der Mitte abgeloest. Eine gestauchte Vorderseite waere
                schon unterwegs lesbar gewesen. */}
            <span className="kings-zug__ruecken" aria-hidden="true">
              <PlayingCard index={null} />
            </span>
          </div>

          {rule && card && (
            <BigCard
              kicker={state.finalKing ? 'Vierter König' : rule.title}
              animateKey={state.drawn}
            >
              {state.finalKing ? 'Du trinkst den Becher. Alles. Viel Erfolg.' : rule.text}
            </BigCard>
          )}

          {/* Beim Zustandswechsel wird der Kranz-Knopf ausgehaengt, der Fokus
              faellt an den Dokumentanfang und ohne Sicht erfaehrt niemand,
              dass ueberhaupt gezogen wurde. Diese Zeile sagt beides an:
              welche Karte, und was sie bedeutet. */}
          <p className="sr-only" role="status">
            {card ? cardLabel(card) : ''}
            {rule ? `. ${state.finalKing ? 'Vierter König' : rule.title}. ` : '. '}
            {state.finalKing ? 'Du trinkst den Becher.' : (rule?.text ?? '')}
          </p>

          {/* Der Becher gehoert neben die Koenigskarte. Vorher klappte der
              Tisch samt Becher weg, und „Du trinkst den Becher" stand auf
              einem Bildschirm ohne Becher - der einzige Moment, fuer den er
              gebaut ist, fand ohne ihn statt. */}
          {card?.rank === 12 && (
            <div className="bechertisch">
              <Becher pours={state.pours} players={players} />
            </div>
          )}
        </>
      )}

      {state.drawn == null ? null : (
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
          ) : rule?.title === 'Regel' ? (
            canPick ? (
              <div className="stack-3">
                <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
                  {RULE_IDEAS.map((idee) => (
                    <button
                      key={idee}
                      className="chip pressable"
                      onClick={() => send({ type: 'setRule', text: idee })}
                    >
                      {idee}
                    </button>
                  ))}
                </div>
                <input
                  className="input"
                  value={entwurf}
                  maxLength={MAX_RULE_CHARS}
                  aria-label="Eigene Regel"
                  placeholder="Oder eigene Regel eintippen"
                  onChange={(e) => setEntwurf(e.target.value)}
                />
                <button
                  className="btn btn--glass btn--block"
                  disabled={!entwurf.trim()}
                  onClick={() => send({ type: 'setRule', text: entwurf })}
                >
                  Regel merken
                </button>
                <div className="t-center t-caption">Ohne Regel geht es auch weiter.</div>
              </div>
            ) : (
              <div className="t-center t-sub t-balance">
                {actor?.name} erfindet gerade die Regel.
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
