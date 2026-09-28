import { shuffle } from '../../lib/format';
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
 * die Hälfte eines Minus.
 */

export type Mode = 'klassisch' | 'gleich' | 'themen' | 'entspannt';
export const MODES: Mode[] = ['klassisch', 'gleich', 'themen', 'entspannt'];

export type Vote = -1 | 0 | 1;

/** Ein fertiges Meme: Vorlage plus ein Text je Feld. */
export interface Meme {
  t: string;
  x: string[];
}

export interface HallEntry {
  round: number;
  by: string;
  /** Der Name reist mit – wer bis zum Finale gegangen ist, fehlt in `players`. */
  name: string;
  meme: Meme;
  points: number;
  topic: string | null;
}

export interface Options {
  mode: Mode;
  /** Sekunden zum Basteln. */
  seconds: number;
  /** Trittbrett (Mitfahren auf einem fremden Meme) an oder aus. */
  trittbrett: boolean;
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
  scores: Record<string, number>;
  hall: HallEntry[];
}

/** Würfe für die ganze Partie – wie im Vorbild fünf. */
export const REROLLS = 5;
export const TIMER_OPTIONS = [45, 60, 90, 120] as const;
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

/** Frisch gemischte Vorlagen, Ungesehenes zuerst. */
function freshDeck(): string[] {
  return orderByFreshness(shuffle(TEMPLATES.map((t) => t.id)), (id) => `meme:${id}`);
}

function topicDeckOf(custom: string[], playerCount: number): number[] {
  const builtIn = spicyDeck(TOPICS, 'meme-battle', (t) => t.text, playerCount);
  return [...builtIn, ...shuffle(custom.map((_, i) => -i - 1))];
}

/** Zieht eine Vorlage, die gerade niemand vor sich hat. */
function draw(deck: string[], taken: Set<string>): [string, string[]] {
  let rest = deck;
  for (let pass = 0; pass < 2; pass++) {
    const i = rest.findIndex((id) => !taken.has(id));
    if (i >= 0) return [rest[i], [...rest.slice(0, i), ...rest.slice(i + 1)]];
    rest = freshDeck();
  }
  // Mehr Leute als Vorlagen – dann eben doppelt.
  return [rest[0], rest.slice(1)];
}

function newRound(state: State, players: GamePlayer[], round: number): State {
  let deck = state.deck;
  const drawn: Record<string, string> = {};
  const rerolls = { ...state.rerolls };
  const who = present(players);
  if (state.options.mode === 'gleich') {
    const [t, rest] = draw(deck, new Set());
    deck = rest;
    for (const p of who) drawn[p.id] = t;
  } else {
    for (const p of who) {
      const [t, rest] = draw(deck, new Set(Object.values(drawn)));
      deck = rest;
      drawn[p.id] = t;
    }
  }
  for (const p of who) rerolls[p.id] ??= REROLLS;

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
  if (!relaxed && state.options.trittbrett) {
    for (const [rider, author] of Object.entries(state.riders)) {
      if (points[author] !== undefined) bonus[rider] = Math.round(points[author] / 2);
    }
  }
  const scores = { ...state.scores };
  if (!relaxed) {
    for (const [id, p] of Object.entries(points)) scores[id] = (scores[id] ?? 0) + p;
    for (const [id, b] of Object.entries(bonus)) scores[id] = (scores[id] ?? 0) + b;
  }

  // Das Meme der Runde. Bei Gleichstand gewinnt, wer früher gezeigt wurde –
  // die Reihenfolge war Zufall, also ist es der Entscheid auch.
  let best: string | null = null;
  for (const author of state.order) {
    if (best === null || points[author] > points[best]) best = author;
  }
  const hall =
    best !== null && state.memes[best]
      ? [
          ...state.hall,
          {
            round: state.round,
            by: best,
            name: players.find((p) => p.id === best)?.name ?? '',
            meme: state.memes[best],
            points: points[best],
            topic: topicText(state),
          },
        ]
      : state.hall;

  return { ...state, phase: 'results', points, bonus, scores, hall, deadline: null };
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
    options: options ?? { mode: 'klassisch', seconds: DEFAULT_SECONDS, trittbrett: true },
    round: 1,
    goal: roundGoal(ROUND_BASE),
    deck: freshDeck(),
    topicDeck: topicDeckOf(customTopics, players.length),
    customTopics,
    topic: null,
    drawn: {},
    rerolls: Object.fromEntries(players.map((p) => [p.id, REROLLS])),
    memes: {},
    deadline: null,
    order: [],
    showing: 0,
    shownAt: 0,
    votes: {},
    riders: {},
    points: {},
    bonus: {},
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    hall: [],
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
    case 'trittbrett': {
      if (state.phase !== 'setup' || typeof action.on !== 'boolean') return state;
      if (state.options.trittbrett === action.on) return state;
      return { ...state, options: { ...state.options, trittbrett: action.on } };
    }
    case 'start': {
      if (state.phase !== 'setup' || present(players).length < 2) return state;
      return newRound(state, players, 1);
    }

    // ---------- Basteln ----------
    case 'claim': {
      // Wer später dazukommt, holt sich hier seine Vorlage.
      if (state.phase !== 'create' || state.drawn[action.by]) return state;
      const shared = state.options.mode === 'gleich' ? Object.values(state.drawn)[0] : undefined;
      const [t, deck] = shared
        ? [shared, state.deck]
        : draw(state.deck, new Set(Object.values(state.drawn)));
      return {
        ...state,
        deck,
        drawn: { ...state.drawn, [action.by]: t },
        rerolls: { ...state.rerolls, [action.by]: state.rerolls[action.by] ?? REROLLS },
      };
    }
    case 'reroll': {
      if (state.phase !== 'create' || state.options.mode === 'gleich') return state;
      const left = state.rerolls[action.by] ?? 0;
      if (!state.drawn[action.by] || state.memes[action.by] || left <= 0) return state;
      const [t, deck] = draw(state.deck, new Set(Object.values(state.drawn)));
      return {
        ...state,
        deck,
        drawn: { ...state.drawn, [action.by]: t },
        rerolls: { ...state.rerolls, [action.by]: left - 1 },
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
      return { ...fresh, deck: state.deck.length > 40 ? state.deck : fresh.deck };
    }
    default:
      return state;
  }
}
