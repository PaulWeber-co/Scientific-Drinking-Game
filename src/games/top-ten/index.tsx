import { useEffect, useRef, useState } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { spicyDeck } from '../shared/prompts';
import { markTextsSeen } from '../../store/seen';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { DrinkCallList } from '../shared/DrinkCall';
import { PassDevice } from '../shared/PassDevice';
import { PeekCard } from '../shared/PeekCard';
import { BigCard, Choice, PlayerChip, Ring, WaitingFor } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { meta } from './meta';

interface Category {
  title: string;
  low: string;
  high: string;
  spicy?: boolean;
}

const CATEGORIES: Category[] = [
  { title: 'Ein Ort zum Uebernachten', low: '1 = Alptraum', high: '10 = Traum' },
  { title: 'Eine Ausrede für Zuspätkommen', low: '1 = erbärmlich', high: '10 = wasserdicht' },
  { title: 'Etwas, das man zum Frühstück isst', low: '1 = traurig', high: '10 = Königsfrühstück' },
  { title: 'Ein Superheld', low: '1 = nutzlos', high: '10 = allmächtig' },
  { title: 'Ein Geschenk für die Schwiegereltern', low: '1 = Beziehungsende', high: '10 = Lieblingskind' },
  { title: 'Ein Grund, das Handy wegzulegen', low: '1 = schwach', high: '10 = unumstößlich' },
  { title: 'Ein Beruf', low: '1 = ich wäre sofort raus', high: '10 = Traumjob' },
  { title: 'Ein Tier als Mitbewohner', low: '1 = Katastrophe', high: '10 = perfekt' },
  { title: 'Ein Satz im ersten Date', low: '1 = sofort weglaufen', high: '10 = Herz erobert' },
  { title: 'Ein Urlaubsziel', low: '1 = nie wieder', high: '10 = jedes Jahr' },
  { title: 'Ein Song auf einer Hochzeit', low: '1 = Stimmung tot', high: '10 = alle tanzen' },
  { title: 'Eine Sache im Kühlschrank', low: '1 = wegwerfen', high: '10 = Schatz' },
  { title: 'Ein Passwort', low: '1 = sofort gehackt', high: '10 = unknackbar' },
  { title: 'Eine Fähigkeit im Lebenslauf', low: '1 = peinlich', high: '10 = sofort eingestellt' },
  { title: 'Ein Getränk um 3 Uhr nachts', low: '1 = Fehler', high: '10 = Rettung' },
  { title: 'Ein Grund, eine Party zu verlassen', low: '1 = schwach', high: '10 = voll verständlich' },
  { title: 'Ein Film für einen verregneten Sonntag', low: '1 = schlimm', high: '10 = perfekt' },
  { title: 'Ein Name für eine Band', low: '1 = sofort auflösen', high: '10 = Welttournee' },
  { title: 'Etwas, das man nie teilen sollte', low: '1 = kein Problem', high: '10 = niemals' },
  { title: 'Eine Regel in einer WG', low: '1 = sinnlos', high: '10 = rettet den Frieden' },
  { title: 'Ein Ort für ein erstes Date', low: '1 = Desaster', high: '10 = Volltreffer' },
  { title: 'Ein Kompliment', low: '1 = beleidigend', high: '10 = schmilzt dahin' },
  { title: 'Etwas, das man an einem freien Tag macht', low: '1 = Verschwendung', high: '10 = perfekt' },
  { title: 'Eine Superkraft', low: '1 = völlig nutzlos', high: '10 = Weltherrschaft' },
  { title: 'Ein Gegenstand auf einer einsamen Insel', low: '1 = sinnlos', high: '10 = überlebenswichtig' },
  { title: 'Eine Nachricht um 2 Uhr nachts', low: '1 = sofort blockieren', high: '10 = sofort antworten' },

  // Spicy – nur im Stapel, wenn der Schalter an ist.
  { title: 'Ein Anmachspruch', low: '1 = sofort weglaufen', high: '10 = funktioniert immer', spicy: true },
  { title: 'Eine rote Flagge beim Dating', low: '1 = geschenkt', high: '10 = sofort Schluss', spicy: true },
  { title: 'Ein Geständnis an den Schwarm', low: '1 = peinlich', high: '10 = mutig', spicy: true },
  { title: 'Ein Ort für den ersten Kuss', low: '1 = Katastrophe', high: '10 = filmreif', spicy: true },
  { title: 'Eine Ausrede nach einem schlechten Date', low: '1 = durchschaubar', high: '10 = wasserdicht', spicy: true },
];

interface State {
  phase: 'writing' | 'revealing' | 'results' | 'over';
  category: number;
  deck: number[];
  numbers: Record<string, number>;
  /** Getippte Antworten – nur online befüllt. Am geteilten Handy werden
   *  Antworten laut gesagt, nicht getippt. */
  answers: Record<string, string>;
  order: string[];
  captainIndex: number;
  /** Vom Kapitän aufgedeckte Spieler-IDs, in Aufdeck-Reihenfolge. Wächst
   *  einzeln – daran hängt der Fehler-Moment und die spätere Auflösung. */
  revealed: string[];
  round: number;
  goal: number | null;
  /** Geteilter Vorrat über die ganze Partie, nie pro Runde zurückgesetzt.
   *  Jeder Fehler beim Aufdecken kostet eins. */
  tokens: number;
  /** true = der Plättchenvorrat ist leer, die Partie endete als Niederlage –
   *  nicht weil die Rundenzahl erreicht wurde. */
  lostGame: boolean;
  /**
   * Perfekt sortierte Runden je Kapitän. Wer einmal sortiert hat, steht hier
   * drin – auch mit 0. Nur so bleibt die Rangliste am Ende unter denen, die
   * überhaupt an der Reihe waren.
   */
  perfect: Record<string, number>;
}

/** Eine Runde ist eine Kategorie. Sechs davon sind eine „mittlere" Partie. */
const ROUND_BASE = baseFor('top-ten');

/** Plättchen zu Rundenbeginn: eins je Person, aber höchstens acht – so viele
 *  druckte das Original. Bleiben über die ganze Partie erhalten. */
const TOKENS_MAX = 8;
function initialTokens(players: GamePlayer[]): number {
  return Math.min(players.length, TOKENS_MAX);
}

/** Zählt die Fehlstellen in der Reihenfolge, die der Kapitän aufgedeckt hat. */
function wrongPairsIn(order: string[], numbers: Record<string, number>): number {
  let wrong = 0;
  for (let i = 0; i < order.length - 1; i++) {
    if ((numbers[order[i]] ?? 0) > (numbers[order[i + 1]] ?? 0)) wrong++;
  }
  return wrong;
}

function scoreCaptain(state: State, players: GamePlayer[]): Record<string, number> {
  const captain = players[state.captainIndex % Math.max(1, players.length)];
  if (!captain) return state.perfect;
  const hit = wrongPairsIn(state.revealed, state.numbers) === 0 ? 1 : 0;
  return { ...state.perfect, [captain.id]: (state.perfect[captain.id] ?? 0) + hit };
}

export const topTen: GameDefinition<State> = {
  ...meta,

  createState: (players) => {
    const deck = spicyDeck(CATEGORIES, 'top-ten', (c) => c.title);
    const ids = players.map((p) => p.id);
    return {
      phase: 'writing',
      category: deck[0],
      deck: deck.slice(1),
      numbers: dealNumbers(ids),
      answers: {},
      order: ids,
      captainIndex: 0,
      revealed: [],
      round: 1,
      goal: roundGoal(ROUND_BASE),
      tokens: initialTokens(players),
      lostGame: false,
      perfect: {},
    };
  },

  reduce: (state, action, players) => {
    const active = players.filter((p) => p.online !== false).map((p) => p.id);
    switch (action.type) {
      case 'submit': {
        if (state.phase !== 'writing') return state;
        const text = String(action.text ?? '').slice(0, 120).trim();
        if (!text) return state;
        const answers = { ...state.answers, [action.by]: text };
        const done = active.every((id) => answers[id]);
        return { ...state, answers, phase: done ? 'revealing' : 'writing' };
      }
      case 'startReveal':
        // Nur am geteilten Handy: alle haben ihre Zahl gesehen, der Kapitän
        // kann anfangen aufzudecken. Online kommt der Wechsel über `submit`.
        if (state.phase !== 'writing') return state;
        return { ...state, phase: 'revealing' };
      case 'reveal': {
        if (state.phase !== 'revealing') return state;
        const id = String(action.id ?? '');
        if (!id || !state.order.includes(id) || state.revealed.includes(id)) return state;
        const revealed = [...state.revealed, id];
        const prevId = revealed[revealed.length - 2];
        const mistake =
          prevId !== undefined && (state.numbers[id] ?? 0) < (state.numbers[prevId] ?? 0);
        const tokens = mistake ? Math.max(0, state.tokens - 1) : state.tokens;
        if (mistake && tokens <= 0) {
          // Sofort verloren – auch mitten in der Runde, wie im Original.
          return { ...state, revealed, tokens, phase: 'over', lostGame: true };
        }
        const done = revealed.length >= state.order.length;
        return { ...state, revealed, tokens, phase: done ? 'results' : 'revealing' };
      }
      case 'next': {
        // Nur aus der Auflösung heraus: zwei fast gleichzeitige Taps auf
        // „Weiter" würden sonst zwei Runden zählen, und die letzte Runde
        // fiele still aus. Die Inbox wendet Aktionen nacheinander an.
        if (state.phase !== 'results') return state;
        const deck = state.deck.length ? state.deck : spicyDeck(CATEGORIES, 'top-ten', (c) => c.title);
        const ids = players.map((p) => p.id);
        const round = state.round + 1;
        const perfect = scoreCaptain(state, players);
        if (isOver(round, state.goal)) return { ...state, round, perfect, phase: 'over' };
        return {
          ...state,
          phase: 'writing',
          category: deck[0],
          deck: deck.slice(1),
          numbers: dealNumbers(ids),
          answers: {},
          order: ids,
          revealed: [],
          captainIndex: (state.captainIndex + 1) % Math.max(1, ids.length),
          round,
          perfect,
        };
      }
      case 'restart':
        return topTen.createState(players);
      default:
        return state;
    }
  },

  Component: TopTenGame,
};

/** Zieht für jede Person eine eindeutige Zahl aus 1..10. */
function dealNumbers(ids: string[]): Record<string, number> {
  const pool = shuffle(Array.from({ length: 10 }, (_, i) => i + 1));
  return Object.fromEntries(ids.map((id, i) => [id, pool[i % 10]]));
}

function TopTenGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  const [draft, setDraft] = useState('');
  const send = (a: GameActionInput) => dispatch(a);
  const byId = (id: string) => players.find((p) => p.id === id);
  const cat = CATEGORIES[state.category];
  // Gemerkt, damit die naechste Partie am selben Abend andere Kategorien zieht.
  useEffect(() => {
    if (cat) markTextsSeen([cat.title]);
  }, [cat]);

  // Haptik im Moment des Fehlers, nicht erst in der Auflösung – und auf
  // jedem Gerät, nicht nur dem tippenden: online sehen die anderen den
  // Fehler nur über den Sync, nie über den eigenen Klick.
  const revealedCount = useRef(state.revealed.length);
  useEffect(() => {
    const grew = state.revealed.length > revealedCount.current;
    revealedCount.current = state.revealed.length;
    if (!grew) return;
    const lastId = state.revealed[state.revealed.length - 1];
    const prevId = state.revealed[state.revealed.length - 2];
    const mistake =
      prevId !== undefined && (state.numbers[lastId] ?? 0) < (state.numbers[prevId] ?? 0);
    if (!mistake) {
      haptic('tap');
      return;
    }
    haptic(state.lostGame ? 'error' : 'warn');
  }, [state.revealed, state.numbers, state.lostGame]);

  const captain = players[state.captainIndex % Math.max(1, players.length)];
  const isCaptain = captain?.id === me.id;

  const progress = state.goal ? `${Math.min(state.round, state.goal)}/${state.goal}` : `${state.round}`;

  if (state.phase === 'over') {
    const captains = players.filter((p) => state.perfect[p.id] !== undefined);
    const ranking = captains.map((p) => ({ player: p, value: state.perfect[p.id], unit: 'Runde' }));
    // Ohne eine einzige perfekte Sortierung wäre die Reihenfolge der Liste Zufall.
    const anyPerfect = ranking.some((r) => r.value > 0);
    const startTokens = initialTokens(players);
    let headline: string;
    if (state.lostGame) {
      headline = `Verloren in Runde ${state.round}: alle ${startTokens} Plättchen liegen in der Häufchenzone.`;
    } else {
      const played = state.goal ?? state.round - 1;
      const tokenNote = ` ${state.tokens} von ${startTokens} Plättchen übrig.`;
      headline = anyPerfect
        ? `${played} Runden sortiert. Oben steht, wer als Kapitän am häufigsten alles richtig gelegt hat.${tokenNote}`
        : `${played} Runden sortiert – und kein einziges Mal saß die Reihenfolge perfekt.${tokenNote}`;
    }
    return (
      <GameFrame title={topTen.name} accent={topTen.accent} subtitle="Vorbei" onQuit={quit}>
        <GameOver
          headline={headline}
          ranking={anyPerfect ? ranking : undefined}
          rankingTitle="Wer als Kapitän am häufigsten alles richtig legte"
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  if (state.phase === 'writing') {
    if (!online) {
      const roundPlayers = state.order.map(byId).filter((p): p is GamePlayer => !!p);
      return (
        <GameFrame title={topTen.name} accent={topTen.accent} subtitle={`Runde ${progress}`} onQuit={quit}>
          <BigCard kicker={cat.low + ' → ' + cat.high}>{cat.title}</BigCard>
          <TopTenNumberHandoff
            key={state.round}
            order={roundPlayers}
            numbers={state.numbers}
            onDone={() => send({ type: 'startReveal' })}
          />
        </GameFrame>
      );
    }

    const myNumber = state.numbers[me.id];
    const submitted = !!state.answers[me.id];
    const waiting = players.filter((p) => p.online !== false && !state.answers[p.id]).map((p) => p.name);
    return (
      <GameFrame title={topTen.name} accent={topTen.accent} subtitle={`Runde ${progress}`} onQuit={quit}>
        <BigCard kicker={cat.low + ' → ' + cat.high}>{cat.title}</BigCard>
        <div className="secret">
          <div className="t-upper">Deine geheime Zahl</div>
          <div className="secret__num t-mono-num">{myNumber ?? '–'}</div>
          <div className="t-caption">Zeig sie niemandem.</div>
        </div>
        {submitted ? (
          <WaitingFor names={waiting} what="Warten auf" />
        ) : (
          <div className="stack-3">
            <textarea
              className="input"
              placeholder="Antwort, die genau zu deiner Zahl passt …"
              maxLength={120}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              className="btn btn--brand btn--block"
              disabled={!draft.trim()}
              onClick={() => {
                haptic('success');
                send({ type: 'submit', text: draft });
                setDraft('');
              }}
            >
              Abschicken
            </button>
          </div>
        )}
      </GameFrame>
    );
  }

  if (state.phase === 'revealing') {
    const remaining = state.order.filter((id) => !state.revealed.includes(id));
    const startTokens = initialTokens(players);
    return (
      <GameFrame
        title={topTen.name}
        accent={topTen.accent}
        subtitle={`Runde ${progress} · Aufdecken`}
        onQuit={quit}
      >
        <div className="row" style={{ justifyContent: 'center' }}>
          {captain && <PlayerChip player={captain} note={isCaptain ? 'du deckst auf' : 'deckt auf'} />}
        </div>
        <BigCard kicker={cat.low + ' → ' + cat.high}>{cat.title}</BigCard>
        <Ring value={state.tokens / startTokens} label={`${state.tokens}`} />
        {state.revealed.length > 0 && (
          <div className="stack-2">
            {state.revealed.map((id) => (
              <div key={id} className="result-row">
                <div className="result-row__rank">{state.numbers[id]}</div>
                <div className="grow t-headline">{byId(id)?.name}</div>
              </div>
            ))}
          </div>
        )}
        {isCaptain ? (
          <div className="stack-2">
            <div className="t-caption t-center">Wer hat die nächsthöhere Zahl?</div>
            <Choice
              options={remaining.map((id) => ({ id, label: byId(id)?.name ?? '' }))}
              onPick={(id) => send({ type: 'reveal', id })}
            />
          </div>
        ) : (
          <div className="t-center t-sub">Nur {captain?.name} deckt gerade auf.</div>
        )}
      </GameFrame>
    );
  }

  const wrongPairs = wrongPairsIn(state.revealed, state.numbers);
  const perfect = wrongPairs === 0;
  const others = players.filter((p) => p.id !== captain?.id);

  return (
    <GameFrame
      title={topTen.name}
      accent={topTen.accent}
      subtitle={`Runde ${progress} · Auflösung`}
      onQuit={quit}
    >
      <BigCard kicker={perfect ? 'Perfekt' : `${wrongPairs} ${wrongPairs === 1 ? 'Fehler' : 'Fehler'}`}>
        {perfect
          ? `${captain?.name} hat alles richtig aufgedeckt. Alle anderen trinken.`
          : 'Nicht ganz. Die Runde zahlt drauf.'}
      </BigCard>
      <div className="stack-2">
        {state.revealed.map((id) => (
          <div key={id} className="result-row">
            <div className="result-row__rank">{state.numbers[id]}</div>
            <div className="grow">
              <div className="t-headline">{byId(id)?.name}</div>
              {state.answers[id] && <div className="t-caption">{state.answers[id]}</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="t-caption t-center">
        {state.tokens} von {initialTokens(players)} Plättchen übrig.
      </div>
      <DrinkCallList
        players={perfect ? others : players}
        baseSips={perfect ? 3 : Math.min(6, wrongPairs + 1)}
        source="top-ten"
        resetKey={state.round}
      />
      <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
        {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächste Runde'}
      </button>
    </GameFrame>
  );
}

/**
 * Am geteilten Handy: jede Person sieht ihre Zahl per Aufdeck-Karte, sagt
 * ihre Antwort dann laut und gibt weiter. Läuft als eigener Rundgang statt
 * über Reducer-Aktionen; erst wenn alle durch sind, meldet `onDone` das an
 * den Spielstand.
 */
function TopTenNumberHandoff({
  order,
  numbers,
  onDone,
}: {
  order: GamePlayer[];
  numbers: Record<string, number>;
  onDone: () => void;
}) {
  const [step, setStep] = useState({ index: 0, peeking: false, seen: false });
  const current = order[step.index];
  if (!current) return null;

  if (!step.peeking) {
    return (
      <PassDevice
        player={current}
        step={step.index + 1}
        total={order.length}
        onConfirm={() => setStep((s) => ({ ...s, peeking: true }))}
      />
    );
  }

  return (
    <>
      <PeekCard label="Zahl aufdecken" onRevealed={() => setStep((s) => ({ ...s, seen: true }))}>
        <div className="secret">
          <div className="t-upper">Deine geheime Zahl</div>
          <div className="secret__num t-mono-num">{numbers[current.id]}</div>
        </div>
      </PeekCard>
      <p className="t-sub t-center t-balance">
        Sag jetzt laut eine Antwort, die zu deiner Zahl passt. Die Zahl bleibt geheim.
      </p>
      <button
        className="btn btn--brand btn--block btn--lg"
        disabled={!step.seen}
        onClick={() => {
          // Gleiche Handlung wie in Undercover, gleiche Rueckmeldung.
          haptic('success');
          const next = step.index + 1;
          if (next >= order.length) onDone();
          else setStep({ index: next, peeking: false, seen: false });
        }}
      >
        Habe ich gesehen
      </button>
    </>
  );
}
