import { shuffle } from '../../lib/format';
import { isSpicyOn } from '../../store/app';
import { customCardsFor } from '../../store/cards';
import { orderByFreshness } from '../../store/seen';
import { spicyDeck } from '../shared/prompts';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import type { GameAction, GamePlayer } from '../types';
import { MAX_CHARS, TEMPLATES, templateOf } from './templates';
import { TOPICS } from './topics';

/**
 * Meme-Duell – die Regeln, ohne Oberfläche.
 *
 * Ablauf einer Runde:
 *   create  Jede Person bekommt eine Vorlage, darf sie ein paar Mal neu
 *           würfeln und schreibt ihre Texte hinein. Die Uhr läuft.
 *   vote    Die Memes kommen einzeln und anonym auf alle Handys. Jede Person
 *           gibt hoch, meh oder runter – und darf einmal pro Runde aufs
 *           Trittbrett eines fremden Memes springen.
 *   results Punkte, Autorinnen und Autoren, das Meme der Runde.
 *
 * Punkte: Einstimmig hoch sind 1000, jede Stimme runter zieht im selben Maß
 * ab. Meh zählt null. Ein Meme kann also ins Minus rutschen. Wer auf dem
 * Trittbrett mitfährt, bekommt die Hälfte der Punkte des Memes dazu – auch
 * die Hälfte eines Minus. Das Meme selbst bekommt je Mitfahrer +10: wer
 * andere überzeugt, verdient daran mit.
 */

export type Mode = 'klassisch' | 'gleich' | 'themen' | 'entspannt';
export const MODES: Mode[] = ['klassisch', 'gleich', 'themen', 'entspannt'];

export type Vote = -1 | 0 | 1;

/** Ein fertiges Meme: Vorlage plus ein Text je Feld. */
export interface Meme {
  t: string;
  x: string[];
}

/**
 * Jedes Meme der Partie – fürs Finale „Von Fire bis Lame". Kurze Schlüssel,
 * weil die Liste mit jedem Spielzug über die Leitung geht.
 */
export interface Played extends Meme {
  /** Runde */
  r: number;
  by: string;
  /** Punkte aus der Abstimmung */
  p: number;
}

/** Woher die Punkte einer Person kommen – wie im Endstand aufgeschlüsselt. */
export interface Tally {
  /** Punkte der eigenen Memes. */
  meme: number;
  /** Hälfte der Memes, auf denen man mitgefahren ist. */
  ride: number;
  /** +10 je Person, die auf den eigenen Memes mitgefahren ist. */
  riders: number;
}

export type Reaction = 'lachen' | 'tot' | 'herz' | 'cringe';
export const REACTIONS: Reaction[] = ['lachen', 'tot', 'herz', 'cringe'];

export interface Options {
  mode: Mode;
  /** Sekunden zum Basteln. */
  seconds: number;
  /** Trittbrett (Mitfahren auf einem fremden Meme) an oder aus. */
  trittbrett: boolean;
  /** Würfe je Person für die ganze Partie. */
  rerolls: number;
}

export interface State {
  phase: 'setup' | 'create' | 'vote' | 'results' | 'over';
  options: Options;
  round: number;
  /** Rundenzahl, nach der Schluss ist. `null` = ohne Ende. */
  goal: number | null;
  /** Vorlagen, die noch niemand gezogen hat. */
  deck: string[];
  /** Themen-Stapel: `>= 0` zeigt in TOPICS, `< 0` in `customTopics`. */
  topicDeck: number[];
  customTopics: string[];
  topic: number | null;
  /** Welche Vorlage vor wem liegt. */
  drawn: Record<string, string>;
  /** Übrige Würfe je Person – für die ganze Partie, nicht je Runde. */
  rerolls: Record<string, number>;
  /** Die Vorlage vor dem letzten Würfeln – „Zurück" holt sie wieder. */
  prev: Record<string, string>;
  memes: Record<string, Meme>;
  /** Frist der laufenden Phase (Basteln oder aktuelles Meme). */
  deadline: number | null;
  /** Reihenfolge der Abstimmung, gemischt – so bleibt sie anonym. */
  order: string[];
  showing: number;
  /** Seit wann das aktuelle Meme auf den Handys steht. */
  shownAt: number;
  /** votes[autor][wähler] */
  votes: Record<string, Record<string, Vote>>;
  /** Trittbrett: wer auf wessen Meme mitfährt. */
  riders: Record<string, string>;
  /** Punkte der Runde je Meme und Bonus je Mitfahrer – ab `results` gesetzt. */
  points: Record<string, number>;
  bonus: Record<string, number>;
  /** +10 je Mitfahrer, für die Person, die das Meme gebaut hat. */
  riderPts: Record<string, number>;
  scores: Record<string, number>;
  totals: Record<string, Tally>;
  history: Played[];
  /** Namen der Autorinnen und Autoren – wer bis zum Finale geht, fehlt in `players`. */
  names: Record<string, string>;
  /** Die letzten Reaktionen, fliegen auf allen Handys übers Bild. */
  reactions: { n: number; by: string; k: Reaction }[];
  reactSeq: number;
}

/** Würfe für die ganze Partie – wie im Vorbild fünf, einstellbar. */
export const REROLLS = 5;
export const REROLL_OPTIONS = [0, 3, 5, 8] as const;
/** Rundenzahl; 0 heißt ohne Ende. */
export const ROUND_OPTIONS = [3, 5, 8, 0] as const;
export const TIMER_OPTIONS = [45, 60, 90, 120] as const;
/** Bonus fürs eigene Meme je Person, die darauf mitfährt. */
export const RIDER_BONUS = 10;
/** So viele Reaktionen hält der Spielstand vor – ältere sind längst verflogen. */
const MAX_REACTIONS = 8;
const DEFAULT_SECONDS = 90;
/** Höchstens so lange steht ein Meme zur Abstimmung. */
export const VOTE_MS = 15_000;
/** Mindestens so lange – auch wenn alle schon abgestimmt haben. Lachen dauert. */
export const MIN_SHOW_MS = 4_000;
/**
 * Nach Ablauf der Uhr schicken die Handys noch ab, was getippt ist. So lange
 * wartet der Host, bevor er die Abstimmung startet.
 */
export const SUBMIT_GRACE_MS = 2_500;
/** Voller Zuspruch. */
export const MAX_POINTS = 1000;

const ROUND_BASE = baseFor('meme-battle');

const isMode = (v: unknown): v is Mode => MODES.includes(v as Mode);
const isReaction = (v: unknown): v is Reaction => REACTIONS.includes(v as Reaction);
const NO_TALLY: Tally = { meme: 0, ride: 0, riders: 0 };

/** Das beste Meme jeder Runde (für Auswertungen und Tests). */
export function bestPerRound(history: Played[]): Played[] {
  const best = new Map<number, Played>();
  for (const h of history) {
    const cur = best.get(h.r);
    if (!cur || h.p > cur.p) best.set(h.r, h);
  }
  return [...best.values()].sort((a, b) => a.r - b.r);
}
const present = (players: GamePlayer[]) => players.filter((p) => p.online !== false);

/**
 * Wer in dieser Runde bastelt: anwesend UND mit Vorlage. Wer mitten in der
 * Runde dazukommt, hat noch keine und darf das Weiterkommen nicht blockieren.
 */
export function creators(state: State, players: GamePlayer[]): string[] {
  return present(players)
    .filter((p) => state.drawn[p.id])
    .map((p) => p.id);
}

/** Wer über ein Meme abstimmt: alle Anwesenden außer der Person, die es gebaut hat. */
export function votersFor(players: GamePlayer[], author: string): string[] {
  return present(players)
    .filter((p) => p.id !== author)
    .map((p) => p.id);
}

export function currentAuthor(state: State): string | null {
  return state.phase === 'vote' ? (state.order[state.showing] ?? null) : null;
}

export function allVoted(state: State, players: GamePlayer[]): boolean {
  const author = currentAuthor(state);
  if (!author) return false;
  const cast = state.votes[author] ?? {};
  return votersFor(players, author).every((id) => cast[id] !== undefined);
}

/** Punkte eines Memes: +1000 bei einstimmig hoch, anteilig abwärts, auch ins Minus. */
export function pointsFor(votes: Record<string, Vote> | undefined, voterCount: number): number {
  const all = Object.values(votes ?? {});
  const up = all.filter((v) => v === 1).length;
  const down = all.filter((v) => v === -1).length;
  // Wer gegangen ist, hat trotzdem abgestimmt – der Nenner darf nie kleiner
  // sein als die abgegebenen Stimmen, sonst gäbe es mehr als 1000.
  const n = Math.max(1, voterCount, all.length);
  return Math.round((MAX_POINTS * (up - down)) / n);
}

export function topicText(state: Pick<State, 'topic' | 'customTopics'>): string | null {
  const t = state.topic;
  if (t === null || t === undefined) return null;
  return t >= 0 ? (TOPICS[t]?.text ?? null) : (state.customTopics[-t - 1] ?? null);
}

/**
 * So viele Vorlagen trägt der Spielstand im Voraus. Alle 308 wären gut 3 KB
 * mehr bei JEDER Aktion – und jede Stimme geht an alle Handys.
 */
const DECK_WINDOW = 24;

/** Frisch gemischte Vorlagen, Ungesehenes zuerst. */
function freshDeck(exclude: Set<string> = new Set()): string[] {
  // Die wenigen Spicy-Vorlagen nur mit Schalter – wie die Spicy-Themen.
  const spicy = isSpicyOn('meme-battle');
  const all = TEMPLATES.filter((t) => spicy || !t.sp).map((t) => t.id);
  let ids = all.filter((id) => !exclude.has(id));
  // Alles schon gespielt (sehr lange Partie): dann eben wieder von vorn.
  if (ids.length < DECK_WINDOW) ids = all;
  return orderByFreshness(shuffle(ids), (id) => `meme:${id}`).slice(0, DECK_WINDOW);
}

/** Was in dieser Partie schon als Meme gespielt wurde – kommt nicht wieder. */
function usedIds(state: Pick<State, 'history' | 'memes'>): Set<string> {
  return new Set([...state.history.map((h) => h.t), ...Object.values(state.memes).map((m) => m.t)]);
}

function topicDeckOf(custom: string[], playerCount: number): number[] {
  const builtIn = spicyDeck(TOPICS, 'meme-battle', (t) => t.text, playerCount);
  return [...builtIn, ...shuffle(custom.map((_, i) => -i - 1))];
}

/** Zieht eine Vorlage, die gerade niemand vor sich hat. */
function draw(deck: string[], taken: Set<string>, used: Set<string>): [string, string[]] {
  let rest = deck;
  for (let pass = 0; pass < 2; pass++) {
    const i = rest.findIndex((id) => !taken.has(id));
    if (i >= 0) return [rest[i], [...rest.slice(0, i), ...rest.slice(i + 1)]];
    rest = freshDeck(new Set([...taken, ...used]));
  }
  // Mehr Leute als Vorlagen – dann eben doppelt.
  return [rest[0], rest.slice(1)];
}

/** Was gerade vergeben ist – auch die Vorlagen, zu denen jemand zurück kann. */
function taken(state: Pick<State, 'drawn' | 'prev'>): Set<string> {
  return new Set([...Object.values(state.drawn), ...Object.values(state.prev)]);
}

function newRound(state: State, players: GamePlayer[], round: number): State {
  let deck = state.deck;
  const drawn: Record<string, string> = {};
  const rerolls = { ...state.rerolls };
  const who = present(players);
  if (state.options.mode === 'gleich') {
    const [t, rest] = draw(deck, new Set(), usedIds(state));
    deck = rest;
    for (const p of who) drawn[p.id] = t;
  } else {
    for (const p of who) {
      const [t, rest] = draw(deck, new Set(Object.values(drawn)), usedIds(state));
      deck = rest;
      drawn[p.id] = t;
    }
  }
  for (const p of who) rerolls[p.id] ??= state.options.rerolls;

  let topic: number | null = null;
  let topicDeck = state.topicDeck;
  if (state.options.mode === 'themen') {
    if (!topicDeck.length) topicDeck = topicDeckOf(state.customTopics, players.length);
    topic = topicDeck[0] ?? null;
    topicDeck = topicDeck.slice(1);
  }

  return {
    ...state,
    phase: 'create',
    round,
    deck,
    drawn,
    rerolls,
    prev: {},
    topic,
    topicDeck,
    memes: {},
    order: [],
    showing: 0,
    shownAt: 0,
    votes: {},
    riders: {},
    points: {},
    bonus: {},
    riderPts: {},
    reactions: [],
    // Die Uhr läuft auf dem Host – er ist es auch, der sie prüft.
    deadline: Date.now() + state.options.seconds * 1000,
  };
}

function startVoting(state: State, players: GamePlayer[]): State {
  const order = shuffle(Object.keys(state.memes));
  if (!order.length) return finishRound({ ...state, order }, players);
  const now = Date.now();
  return {
    ...state,
    phase: 'vote',
    order,
    showing: 0,
    shownAt: now,
    deadline: now + VOTE_MS,
    votes: {},
    riders: {},
  };
}

function finishRound(state: State, players: GamePlayer[]): State {
  const points: Record<string, number> = {};
  for (const author of state.order) {
    points[author] = pointsFor(state.votes[author], votersFor(players, author).length);
  }
  const relaxed = state.options.mode === 'entspannt';
  const bonus: Record<string, number> = {};
  const riderPts: Record<string, number> = {};
  if (!relaxed && state.options.trittbrett) {
    for (const [rider, author] of Object.entries(state.riders)) {
      if (points[author] === undefined) continue;
      bonus[rider] = Math.round(points[author] / 2);
      riderPts[author] = (riderPts[author] ?? 0) + RIDER_BONUS;
    }
  }
  const totals = { ...state.totals };
  const scores = { ...state.scores };
  if (!relaxed) {
    const add = (id: string, key: keyof Tally, n: number) => {
      const t = { ...(totals[id] ?? NO_TALLY) };
      t[key] += n;
      totals[id] = t;
      scores[id] = t.meme + t.ride + t.riders;
    };
    for (const [id, n] of Object.entries(points)) add(id, 'meme', n);
    for (const [id, n] of Object.entries(bonus)) add(id, 'ride', n);
    for (const [id, n] of Object.entries(riderPts)) add(id, 'riders', n);
  }

  const names = { ...state.names };
  for (const author of state.order) {
    const name = players.find((p) => p.id === author)?.name;
    if (name) names[author] = name;
  }
  const history = [
    ...state.history,
    ...state.order
      .filter((author) => state.memes[author])
      .map((author) => ({ r: state.round, by: author, p: points[author], ...state.memes[author] })),
  ];

  return {
    ...state,
    phase: 'results',
    points,
    bonus,
    riderPts,
    scores,
    totals,
    names,
    history,
    deadline: null,
  };
}

/** Texte aus einer Aktion – nie mehr Felder, als die Vorlage hat, nie zu lang. */
function cleanTexts(raw: unknown, templateId: string): string[] | null {
  if (!Array.isArray(raw)) return null;
  const boxes = templateOf(templateId)?.boxes.length ?? raw.length;
  const texts = Array.from({ length: boxes }, (_, i) =>
    typeof raw[i] === 'string' ? raw[i].replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS) : '',
  );
  return texts.some(Boolean) ? texts : null;
}

export function createState(players: GamePlayer[], options?: Options): State {
  const customTopics = customCardsFor('meme-battle').map((c) => c.text);
  return {
    phase: 'setup',
    options: options ?? {
      mode: 'klassisch',
      seconds: DEFAULT_SECONDS,
      trittbrett: true,
      rerolls: REROLLS,
    },
    round: 1,
    goal: roundGoal(ROUND_BASE),
    deck: freshDeck(),
    topicDeck: topicDeckOf(customTopics, players.length),
    customTopics,
    topic: null,
    drawn: {},
    // Gesetzt wird beim Austeilen – erst dann steht die Zahl der Würfe fest.
    rerolls: {},
    prev: {},
    memes: {},
    deadline: null,
    order: [],
    showing: 0,
    shownAt: 0,
    votes: {},
    riders: {},
    points: {},
    bonus: {},
    riderPts: {},
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    totals: {},
    history: [],
    names: {},
    reactions: [],
    reactSeq: 0,
  };
}

export function reduce(state: State, action: GameAction, players: GamePlayer[]): State {
  const at = typeof action.at === 'number' ? action.at : Date.now();
  switch (action.type) {
    // ---------- Einrichten ----------
    case 'mode': {
      if (state.phase !== 'setup' || !isMode(action.mode)) return state;
      if (state.options.mode === action.mode) return state;
      return { ...state, options: { ...state.options, mode: action.mode } };
    }
    case 'timer': {
      const seconds = Number(action.seconds);
      if (state.phase !== 'setup' || !TIMER_OPTIONS.includes(seconds as never)) return state;
      if (state.options.seconds === seconds) return state;
      return { ...state, options: { ...state.options, seconds } };
    }
    case 'rounds': {
      const rounds = Number(action.rounds);
      if (state.phase !== 'setup' || !ROUND_OPTIONS.includes(rounds as never)) return state;
      const goal = rounds === 0 ? null : rounds;
      return state.goal === goal ? state : { ...state, goal };
    }
    case 'rerolls': {
      const count = Number(action.count);
      if (state.phase !== 'setup' || !REROLL_OPTIONS.includes(count as never)) return state;
      if (state.options.rerolls === count) return state;
      return { ...state, options: { ...state.options, rerolls: count } };
    }
    case 'trittbrett': {
      if (state.phase !== 'setup' || typeof action.on !== 'boolean') return state;
      if (state.options.trittbrett === action.on) return state;
      return { ...state, options: { ...state.options, trittbrett: action.on } };
    }
    case 'start': {
      if (state.phase !== 'setup' || present(players).length < 2) return state;
      const rerolls = Object.fromEntries(
        present(players).map((p) => [p.id, state.options.rerolls]),
      );
      return newRound({ ...state, rerolls }, players, 1);
    }

    // ---------- Basteln ----------
    case 'claim': {
      // Wer später dazukommt, holt sich hier seine Vorlage.
      if (state.phase !== 'create' || state.drawn[action.by]) return state;
      const shared = state.options.mode === 'gleich' ? Object.values(state.drawn)[0] : undefined;
      const [t, deck] = shared
        ? [shared, state.deck]
        : draw(state.deck, taken(state), usedIds(state));
      return {
        ...state,
        deck,
        drawn: { ...state.drawn, [action.by]: t },
        rerolls: {
          ...state.rerolls,
          [action.by]: state.rerolls[action.by] ?? state.options.rerolls,
        },
      };
    }
    case 'reroll': {
      if (state.phase !== 'create' || state.options.mode === 'gleich') return state;
      const left = state.rerolls[action.by] ?? 0;
      if (!state.drawn[action.by] || state.memes[action.by] || left <= 0) return state;
      const [t, deck] = draw(state.deck, taken(state), usedIds(state));
      return {
        ...state,
        deck,
        drawn: { ...state.drawn, [action.by]: t },
        prev: { ...state.prev, [action.by]: state.drawn[action.by] },
        rerolls: { ...state.rerolls, [action.by]: left - 1 },
      };
    }
    case 'back': {
      // Die vorige Vorlage zurückholen, ohne einen Wurf zu kosten. Zweimal
      // „Zurück" pendelt zwischen den beiden letzten.
      if (state.phase !== 'create') return state;
      const before = state.prev[action.by];
      const now = state.drawn[action.by];
      if (!before || !now || state.memes[action.by]) return state;
      return {
        ...state,
        drawn: { ...state.drawn, [action.by]: before },
        prev: { ...state.prev, [action.by]: now },
      };
    }
    case 'submit': {
      if (state.phase !== 'create') return state;
      const t = state.drawn[action.by];
      if (!t) return state;
      const x = cleanTexts(action.texts, t);
      if (!x) return state;
      const memes = { ...state.memes, [action.by]: { t, x } };
      const next = { ...state, memes };
      const done = creators(next, players).every((id) => memes[id]);
      return done ? startVoting(next, players) : next;
    }
    case 'edit': {
      if (state.phase !== 'create' || !state.memes[action.by]) return state;
      const memes = { ...state.memes };
      delete memes[action.by];
      return { ...state, memes };
    }
    case 'timeout': {
      if (state.phase !== 'create' || state.deadline === null) return state;
      if (at < state.deadline + SUBMIT_GRACE_MS) return state;
      return startVoting(state, players);
    }

    // ---------- Abstimmen ----------
    case 'vote': {
      const author = currentAuthor(state);
      // `target` hält die Stimme an genau diesem Meme fest. Kommt sie erst an,
      // wenn schon das nächste läuft, verfällt sie – statt dort zu landen.
      if (!author || action.target !== author || action.by === author) return state;
      const value = Number(action.value);
      if (value !== 1 && value !== 0 && value !== -1) return state;
      if (state.votes[author]?.[action.by] === value) return state;
      return {
        ...state,
        votes: { ...state.votes, [author]: { ...state.votes[author], [action.by]: value as Vote } },
      };
    }
    case 'ride': {
      const author = currentAuthor(state);
      if (!author || action.target !== author || action.by === author) return state;
      if (!state.options.trittbrett || state.options.mode === 'entspannt') return state;
      if (state.riders[action.by]) return state;
      return { ...state, riders: { ...state.riders, [action.by]: author } };
    }
    case 'react': {
      if (state.phase !== 'vote' || !isReaction(action.kind)) return state;
      const reactSeq = state.reactSeq + 1;
      return {
        ...state,
        reactSeq,
        reactions: [
          ...state.reactions.slice(-(MAX_REACTIONS - 1)),
          { n: reactSeq, by: action.by, k: action.kind },
        ],
      };
    }
    case 'advance': {
      const author = currentAuthor(state);
      // Auch hier die Kennung des Memes: schicken zwei Geräte gleichzeitig
      // „weiter", springt die Runde trotzdem nur um eins.
      if (!author || action.target !== author) return state;
      const timeUp = state.deadline !== null && at >= state.deadline;
      const settled = allVoted(state, players) && at >= state.shownAt + MIN_SHOW_MS;
      if (!timeUp && !settled) return state;
      const showing = state.showing + 1;
      if (showing >= state.order.length) return finishRound({ ...state, showing }, players);
      const now = Date.now();
      return { ...state, showing, shownAt: now, deadline: now + VOTE_MS };
    }

    // ---------- Weiter ----------
    case 'next': {
      if (state.phase !== 'results') return state;
      const round = state.round + 1;
      if (isOver(round, state.goal)) return { ...state, round, phase: 'over' };
      return newRound(state, players, round);
    }
    case 'restart': {
      // Zurück an den Tisch – mit denselben Einstellungen, aber frischem Stand.
      const fresh = createState(players, state.options);
      return {
        ...fresh,
        // Nur Stände dieser Fassung tragen eine Ziellinie; eine Runde aus der
        // alten Fassung bekommt die aus der Einstellung.
        goal: state.options ? state.goal : fresh.goal,
      };
    }
    default:
      return state;
  }
}
