import { shuffle } from '../../lib/format';
import { isSpicyOn } from '../../store/app';
import { customCardsFor } from '../../store/cards';
import { fitsGroup, spicyDeck } from '../shared/prompts';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import type { GameAction, GamePlayer } from '../types';
import { CATEGORIES } from './categories';

/**
 * Wer bin ich – die Regeln, ohne Oberfläche.
 *
 * Ablauf einer Runde:
 *   pick   Reihum bestimmt eine Person die Kategorie: würfeln, aus der Liste
 *          nehmen oder frei eintippen – dazu die Schwierigkeit der Ideen.
 *   write  Die App lost einen Kreis – jede Person schreibt für genau eine
 *          andere einen Begriff aus der Kategorie.
 *   guess  Jedes Handy zeigt die Begriffe der anderen, der eigene bleibt
 *          verdeckt. Gefragt wird frei am Tisch; wer richtig liegt, dem tippt
 *          irgendwer auf „Richtig" – auch man selbst.
 *   done   Die erste Person verteilt Schlucke, die letzte trinkt.
 *
 * Ein „Richtig" lässt sich ein paar Sekunden zurücknehmen und gilt erst danach.
 * Erst dann darf die erste Person verteilen und erst dann endet die Runde –
 * sonst müsste „Rückgängig" etwas zurückholen, das schon getrunken ist.
 */

export type Phase = 'pick' | 'write' | 'guess' | 'done' | 'over';
/** Wie bekannt die Vorschläge hinter „Idee" sind. Wirkt nur auf die Ideen. */
export type Level = 'leicht' | 'normal' | 'schwer';
export const LEVELS: readonly Level[] = ['leicht', 'normal', 'schwer'];

export interface Term {
  text: string;
  /** Wer ihn geschrieben hat – steht unter dem Begriff („von Ben"). */
  by: string;
}

export interface Mark {
  /** Wessen Begriff erraten ist. */
  id: string;
  at: number;
}

export interface State {
  phase: Phase;
  round: number;
  /** Rundenzahl, nach der Schluss ist. `null` = ohne Ende. */
  goal: number | null;
  /** Kategorien-Stapel: `>= 0` zeigt in CATEGORIES, `< 0` in `customCats`. */
  catDeck: number[];
  customCats: string[];
  cat: number;
  /** Ob Spicy-Kategorien erlaubt sind – der Schalter steht beim Host, die Liste zeigt jedes Gerät. */
  spicy: boolean;
  /** Wer diese Runde die Kategorie bestimmt. */
  chooser: string;
  /** Wer in diesem Durchgang schon gewählt hat – sind alle durch, beginnt er neu. */
  chose: string[];
  /** Seit wann gewählt wird – danach darf der Host für eine hängende Person würfeln. */
  pickSince: number;
  level: Level;
  /** Kreis der Runde: jede Person schreibt für die nächste Anwesende. */
  ring: string[];
  /** Begriffe, nach der Person, die ihn erraten muss. */
  terms: Record<string, Term>;
  /** Erratene Begriffe in der Reihenfolge, in der sie fielen. */
  marks: Mark[];
  /** Was die erste Person verteilt hat. */
  dealt: Record<string, number> | null;
  /** Wer diese Runde als Letztes übrig blieb. */
  last: string | null;
  /** Wie oft jede Person Letzte war – für den Endstand. */
  losses: Record<string, number>;
  names: Record<string, string>;
}

/** So lange lässt sich ein „Richtig" zurücknehmen. */
export const UNDO_MS = 5_000;
/** Die erste Person verteilt so viel – normale Härte. */
export const DEAL_SIPS = 3;
/** Pro Runde verliert nur eine Person, deshalb etwas mehr. */
export const LAST_SIPS = 5;
export const MAX_TERM = 40;
/** So lange hat die wählende Person Zeit, bevor der Host für sie würfeln darf. */
export const PICK_WAIT_MS = 10_000;

const GAME_ID = 'wer-bin-ich';
const ROUND_BASE = baseFor(GAME_ID);

const present = (players: GamePlayer[]) =>
  players.filter((p) => p.online !== false).map((p) => p.id);

/** Ohne markierten Host (ein Gerät, Tests) darf jede Person weiterschalten. */
function mayLead(players: GamePlayer[], by: string): boolean {
  const host = players.find((p) => p.isHost);
  return !host || host.id === by;
}

/**
 * Wer als Nächstes wählt: die erste Anwesende in Lobby-Reihenfolge, die in
 * diesem Durchgang noch nicht dran war. Wer später dazukommt, ist im selben
 * Durchgang noch an der Reihe; wer geht, wird übersprungen.
 */
function nextChooser(chose: string[], players: GamePlayer[]): { chooser: string; chose: string[] } {
  const here = present(players);
  const open = here.filter((id) => !chose.includes(id));
  if (open.length) return { chooser: open[0], chose };
  return { chooser: here[0] ?? '', chose: [] };
}

/** Darf `by` gerade für die wählende Person würfeln? Sie selbst immer, der Host nur, wenn sie weg ist oder hängt. */
export function mayPickRandom(state: State, players: GamePlayer[], by: string, now: number): boolean {
  if (present(players).length < 2) return false;
  if (by === state.chooser) return true;
  if (!mayLead(players, by) || !present(players).includes(by)) return false;
  return !present(players).includes(state.chooser) || now >= state.pickSince + PICK_WAIT_MS;
}

/** Kategorien, die diese Runde zur Wahl stehen – eingebaute als Index, eigene als negative Zahl. */
export function choosableCats(state: Pick<State, 'spicy' | 'customCats'>, playerCount: number): number[] {
  const builtIn = CATEGORIES.map((_, i) => i).filter(
    (i) => (state.spicy || !CATEGORIES[i].spicy) && fitsGroup(CATEGORIES[i], playerCount),
  );
  return [...builtIn, ...state.customCats.map((_, i) => -i - 1)];
}

export function categoryText(state: Pick<State, 'cat' | 'customCats'>): string {
  const c = state.cat;
  return c >= 0 ? (CATEGORIES[c]?.text ?? '') : (state.customCats[-c - 1] ?? '');
}

/** Der Kreis ohne die, die gerade weg sind – er schließt sich von selbst. */
export function activeRing(state: Pick<State, 'ring'>, players: GamePlayer[]): string[] {
  const here = new Set(present(players));
  return state.ring.filter((id) => here.has(id));
}

/** Für wen diese Person schreibt, oder `null`, wenn sie diese Runde nicht dabei ist. */
export function targetOf(state: Pick<State, 'ring'>, players: GamePlayer[], writer: string): string | null {
  const ring = activeRing(state, players);
  const i = ring.indexOf(writer);
  if (i < 0 || ring.length < 2) return null;
  return ring[(i + 1) % ring.length];
}

/** Wer noch einen Begriff schreiben muss. */
export function missingWriters(state: State, players: GamePlayer[]): string[] {
  return activeRing(state, players).filter((w) => {
    const t = targetOf(state, players, w);
    return t !== null && !state.terms[t];
  });
}

export function isGuessed(state: Pick<State, 'marks'>, id: string): boolean {
  return state.marks.some((m) => m.id === id);
}

export function isFinal(mark: Mark, now: number): boolean {
  return now >= mark.at + UNDO_MS;
}

/** Wer als Erstes richtig lag – erst, wenn es nicht mehr zurückgenommen werden kann. */
export function firstFinal(state: Pick<State, 'marks'>, now: number): string | null {
  const first = state.marks[0];
  return first && isFinal(first, now) ? first.id : null;
}

/** Wessen Begriff noch offen ist. */
export function openIds(state: State, players: GamePlayer[]): string[] {
  return activeRing(state, players).filter((id) => !isGuessed(state, id));
}

/**
 * Kann der Host die Phase gerade abschließen? Gefragt wird das, weil eine
 * Person auch durch Weggehen fertig werden kann – dann kommt keine Aktion,
 * die den Zustand von selbst weiterschiebt.
 */
export function canSettle(state: State, players: GamePlayer[], now: number): boolean {
  if (state.phase === 'write') {
    return activeRing(state, players).length < 2 || missingWriters(state, players).length === 0;
  }
  if (state.phase === 'guess') {
    return openIds(state, players).length <= 1 && state.marks.every((m) => isFinal(m, now));
  }
  return false;
}

function catDeckOf(custom: string[], playerCount: number): number[] {
  const builtIn = spicyDeck(CATEGORIES, GAME_ID, (c) => c.text, playerCount);
  return [...builtIn, ...shuffle(custom.map((_, i) => -i - 1))];
}

function drawCategory(state: State, players: GamePlayer[]): State {
  let deck = state.catDeck.length ? state.catDeck : catDeckOf(state.customCats, players.length);
  // Nicht zweimal dieselbe hintereinander, wenn der Stapel neu gemischt wurde.
  if (deck.length > 1 && deck[0] === state.cat) deck = [...deck.slice(1), deck[0]];
  return { ...state, cat: deck[0], catDeck: deck.slice(1) };
}

function newRound(state: State, players: GamePlayer[], round: number, at: number): State {
  return {
    ...state,
    ...nextChooser(state.chose, players),
    phase: 'pick',
    round,
    pickSince: at,
    ring: [],
    terms: {},
    marks: [],
    dealt: null,
    last: null,
  };
}

/**
 * Freitext wird zur eigenen Kategorie dieser Partie. Heißt er wie eine
 * eingebaute, gilt die eingebaute – dann gibt es auch Ideen dazu.
 */
function catFromText(state: State, text: string): { cat: number; customCats: string[] } {
  const key = text.toLocaleLowerCase('de');
  const builtIn = CATEGORIES.findIndex((c) => c.text.toLocaleLowerCase('de') === key);
  if (builtIn >= 0) return { cat: builtIn, customCats: state.customCats };
  const own = state.customCats.findIndex((c) => c.toLocaleLowerCase('de') === key);
  if (own >= 0) return { cat: -own - 1, customCats: state.customCats };
  return { cat: -state.customCats.length - 1, customCats: [...state.customCats, text] };
}

/** Kategorie steht – der Kreis wird gelost, alle schreiben. */
function startWrite(state: State, players: GamePlayer[]): State {
  return {
    ...state,
    phase: 'write',
    // Gewählt ist gewählt – der Würfel bietet sie in dieser Partie nicht noch einmal an.
    catDeck: state.catDeck.filter((c) => c !== state.cat),
    chose: state.chose.includes(state.chooser) ? state.chose : [...state.chose, state.chooser],
    ring: shuffle(present(players)),
  };
}

/**
 * Ab dem Raten zählt nur, wer einen Begriff hat. Wer beim Schreiben kurz weg
 * war (Handy gesperrt) und für den niemand geschrieben hat, schaut diese
 * Runde zu – sonst stünde er ohne Begriff im Kreis und bliebe sicher übrig.
 */
function startGuess(state: State): State {
  return { ...state, phase: 'guess', ring: state.ring.filter((id) => state.terms[id]) };
}

function finishRound(state: State, players: GamePlayer[]): State {
  const ring = activeRing(state, players);
  const open = openIds(state, players);
  const last = ring.length >= 2 && open.length === 1 ? open[0] : null;
  const names = { ...state.names };
  for (const p of players) names[p.id] = p.name;
  return {
    ...state,
    phase: 'done',
    last,
    names,
    losses: last ? { ...state.losses, [last]: (state.losses[last] ?? 0) + 1 } : state.losses,
  };
}

function cleanTerm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TERM);
  return text || null;
}

/** Verteilte Schlucke: an Anwesende außer sich selbst, ganze Zahlen, genau DEAL_SIPS. */
function cleanDeal(raw: unknown, by: string, players: GamePlayer[]): Record<string, number> | null {
  if (!raw || typeof raw !== 'object') return null;
  const here = new Set(present(players));
  const out: Record<string, number> = {};
  let sum = 0;
  for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
    if (id === by || !here.has(id) || !Number.isInteger(n) || (n as number) < 1) return null;
    out[id] = n as number;
    sum += n as number;
  }
  return sum === DEAL_SIPS ? out : null;
}

export function createState(players: GamePlayer[]): State {
  const customCats = customCardsFor(GAME_ID).map((c) => c.text);
  const catDeck = catDeckOf(customCats, players.length);
  return {
    phase: 'pick',
    round: 1,
    goal: roundGoal(ROUND_BASE),
    catDeck: catDeck.slice(1),
    customCats,
    cat: catDeck[0] ?? 0,
    spicy: isSpicyOn(GAME_ID),
    ...nextChooser([], players),
    pickSince: Date.now(),
    level: 'normal',
    ring: [],
    terms: {},
    marks: [],
    dealt: null,
    last: null,
    losses: {},
    names: {},
  };
}

export function reduce(state: State, action: GameAction, players: GamePlayer[]): State {
  const at = typeof action.at === 'number' ? action.at : Date.now();
  switch (action.type) {
    // ---------- Kategorie ----------
    case 'pick': {
      // Genau eins von drei: `random`, `cat` (aus der Liste) oder `text` (frei).
      if (state.phase !== 'pick' || present(players).length < 2) return state;
      const level = LEVELS.includes(action.level as Level) ? (action.level as Level) : state.level;
      if (action.random === true) {
        if (!mayPickRandom(state, players, action.by, at)) return state;
        return startWrite({ ...drawCategory(state, players), level }, players);
      }
      if (action.by !== state.chooser) return state;
      if (typeof action.cat === 'number') {
        if (!choosableCats(state, players.length).includes(action.cat)) return state;
        return startWrite({ ...state, cat: action.cat, level }, players);
      }
      const text = cleanTerm(action.text);
      if (!text) return state;
      return startWrite({ ...state, ...catFromText(state, text), level }, players);
    }

    // ---------- Schreiben ----------
    case 'write': {
      if (state.phase !== 'write') return state;
      const target = targetOf(state, players, action.by);
      const text = cleanTerm(action.text);
      if (!target || !text) return state;
      // Hat schon jemand anderes für diese Person geschrieben (der Kreis hat
      // sich geschlossen, weil jemand ging), bleibt dessen Begriff.
      const before = state.terms[target];
      if (before && before.by !== action.by) return state;
      if (before?.text === text) return state;
      const next = { ...state, terms: { ...state.terms, [target]: { text, by: action.by } } };
      return canSettle(next, players, at) ? startGuess(next) : next;
    }
    case 'unwrite': {
      if (state.phase !== 'write') return state;
      const target = targetOf(state, players, action.by);
      if (!target || state.terms[target]?.by !== action.by) return state;
      const terms = { ...state.terms };
      delete terms[target];
      return { ...state, terms };
    }

    // ---------- Raten ----------
    case 'mark': {
      // Jede Person am Tisch darf bestätigen – auch für sich selbst. Wessen
      // Begriff gemeint ist, steht in `target`; `by` ist nur das Gerät.
      const id = action.target;
      if (state.phase !== 'guess' || typeof id !== 'string') return state;
      if (!activeRing(state, players).includes(id) || isGuessed(state, id)) return state;
      // Wer als Letztes übrig ist, verliert die Runde – den Begriff rät niemand mehr.
      if (openIds(state, players).length <= 1) return state;
      return { ...state, marks: [...state.marks, { id, at }] };
    }
    case 'undo': {
      if (state.phase !== 'guess') return state;
      const mark = state.marks.find((m) => m.id === action.target);
      if (!mark || isFinal(mark, at)) return state;
      return { ...state, marks: state.marks.filter((m) => m !== mark) };
    }
    case 'deal': {
      if (state.phase !== 'guess' && state.phase !== 'done') return state;
      if (state.dealt || firstFinal(state, at) !== action.by) return state;
      const dealt = cleanDeal(action.counts, action.by, players);
      return dealt ? { ...state, dealt } : state;
    }

    // ---------- Weiter ----------
    case 'settle': {
      if (!canSettle(state, players, at)) return state;
      if (state.phase === 'write') {
        // Alle bis auf eine Person sind gegangen – dann neu wählen.
        if (activeRing(state, players).length < 2) return newRound(state, players, state.round, at);
        return startGuess(state);
      }
      return finishRound(state, players);
    }
    case 'next': {
      if (state.phase !== 'done' || !mayLead(players, action.by)) return state;
      const round = state.round + 1;
      if (isOver(round, state.goal)) return { ...state, round, phase: 'over' };
      return newRound(state, players, round, at);
    }
    case 'restart': {
      if (state.phase !== 'over') return state;
      return createState(players);
    }
    default:
      return state;
  }
}
