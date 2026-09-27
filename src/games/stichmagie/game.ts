import { shuffle } from '../../lib/format';
import { useApp } from '../../store/app';
import type { AvatarColor } from '../../components/ui/Avatar';
import type { GameAction, GamePlayer } from '../types';
import {
  BASE_DECK,
  JUBILAEUM,
  PRESETS,
  SPECIALS,
  SPECIAL_ID,
  choiceFor,
  effective,
  forbiddenBid,
  isCard,
  isSuit,
  kindOf,
  ledSuit,
  legalCards,
  planFor,
  resolveTrick,
  roundScore,
  suitOf,
  trumpFrom,
  vampirCopy,
  type Length,
  type Played,
  type Preset,
  type Special,
  type TrickResult,
} from './rules';
import { botMove } from './bot';

/**
 * Stichmagie – der Spielablauf als Reducer.
 *
 * Läuft nur beim Host (online) bzw. direkt im Gerät (Pass & Play). Jede
 * Aktion prüft ihre Phase selbst: online wendet der Host die Inbox
 * nacheinander an, und zwei fast gleichzeitige Taps sind auf einer Party der
 * Normalfall, nicht die Ausnahme.
 *
 * Wer eine Aktion ausführt, steht NICHT in `action.by` – im Pass & Play trägt
 * jede Aktion die Kennung des Gerätebesitzers. Stattdessen gilt:
 *  - Karten sind eindeutig. Wer eine Karte legt, ist, wer sie in der Hand hat.
 *  - Ansagen und Wolken-Entscheidungen tragen `who`. Ein doppelter Tap landet
 *    so nicht bei der nächsten Person.
 */

export interface Seat {
  id: string;
  name: string;
  color: AvatarColor;
}

export interface Options {
  specials: Special[];
  /** Die Summe der Ansagen darf nicht der Zahl der Stiche entsprechen. */
  noEvenBids: boolean;
  /** Runden mit einer Karte: die eigene sieht man nicht, die der anderen schon. */
  forehead: boolean;
  length: Length;
}

export type Phase =
  | 'setup'
  | 'trump'
  | 'werwolf'
  | 'bid'
  | 'play'
  | 'trick'
  | 'wolke'
  | 'pass'
  | 'hexe'
  | 'score'
  | 'over';

/** Was nach einem Stich noch zu erledigen ist, in dieser Reihenfolge. */
export type Effect = { t: 'wolke'; who: string } | { t: 'pass' } | { t: 'hexe'; who: string };

export interface RoundLog {
  cards: number;
  trump: number | null;
  bids: Record<string, number>;
  won: Record<string, number>;
  delta: Record<string, number>;
}

export interface State {
  phase: Phase;
  options: Options;
  seats: Seat[];
  /** Kartenzahl je Runde. */
  plan: number[];
  /** Index in `plan` – die angezeigte Runde ist `round + 1`. */
  round: number;
  /** Sitzplatz (Index in `seats`) der Person, die gibt. */
  dealer: number;
  hands: Record<string, number[]>;
  /** Die aufgedeckte Trumpfkarte. */
  indicator: number | null;
  /** Die Karte darunter – nur für Vampir + Werwolf. */
  spare: number | null;
  trump: number | null;
  /** Welche Karte der Vampir diese Runde ist. */
  vampirAs: number | null;
  werwolfBy: string | null;
  bids: Record<string, number>;
  /** Änderungen der Ansage durch die Wolke, je Person. */
  shifts: Record<string, number>;
  won: Record<string, number>;
  /** Wer gerade entscheidet. Leer, wenn alle (Weitergeben) oder niemand dran sind. */
  turn: string;
  trick: Played[];
  result: TrickResult | null;
  queue: Effect[];
  /** Jongleur: die Karte, die jede Person nach links gibt. */
  passes: Record<string, number>;
  /** Der letzte Tausch – zur Anzeige, bis der nächste Stich beginnt. */
  lastPass: Record<string, number> | null;
  swap: { by: string; gave: number; took: number } | null;
  trickNo: number;
  scores: Record<string, number>;
  log: RoundLog[];
  /** Für wen die App gerade spielt, weil die Person weg ist. */
  auto: Record<string, boolean>;
  /** Zählt jede angenommene Aktion – Schlüssel für Animationen und Wecker. */
  seq: number;
}

export const DEFAULT_OPTIONS: Options = {
  specials: [...JUBILAEUM],
  noEvenBids: false,
  forehead: false,
  length: 'voll',
};

const toSeats = (players: GamePlayer[]): Seat[] =>
  players.map((p) => ({ id: p.id, name: p.name, color: p.color }));

/** Wer mitspielt: alle, die gerade da sind – zur Not alle. */
function rosterOf(players: GamePlayer[]): GamePlayer[] {
  const da = players.filter((p) => p.online !== false);
  return da.length ? da : players;
}

export function cardsThisRound(s: Pick<State, 'plan' | 'round'>): number {
  return s.plan[s.round] ?? 0;
}

export function seatIndex(s: Pick<State, 'seats'>, id: string): number {
  return s.seats.findIndex((x) => x.id === id);
}

export function nextSeatId(s: Pick<State, 'seats'>, id: string): string {
  const i = seatIndex(s, id);
  const n = s.seats.length;
  return n ? s.seats[(i + 1 + n) % n].id : '';
}

export function prevSeatId(s: Pick<State, 'seats'>, id: string): string {
  const i = seatIndex(s, id);
  const n = s.seats.length;
  return n ? s.seats[(i - 1 + n) % n].id : '';
}

export function dealerId(s: Pick<State, 'seats' | 'dealer'>): string {
  return s.seats[s.dealer]?.id ?? '';
}

/** Wer die Runde eröffnet: links vom Geber. */
export function firstId(s: Pick<State, 'seats' | 'dealer'>): string {
  const n = s.seats.length;
  return n ? s.seats[(s.dealer + 1) % n].id : '';
}

function lengthDefault(): Length {
  try {
    return useApp.getState().gameLength === 'kurz' ? 'kurz' : 'voll';
  } catch {
    return 'voll';
  }
}

export function createState(players: GamePlayer[]): State {
  const seats = toSeats(rosterOf(players));
  const options: Options = {
    ...DEFAULT_OPTIONS,
    specials: [...JUBILAEUM],
    length: lengthDefault(),
  };
  return {
    phase: 'setup',
    options,
    seats,
    plan: planFor(seats.length, options.length),
    round: 0,
    dealer: Math.max(0, seats.length - 1),
    hands: {},
    indicator: null,
    spare: null,
    trump: null,
    vampirAs: null,
    werwolfBy: null,
    bids: {},
    shifts: {},
    won: {},
    turn: '',
    trick: [],
    result: null,
    queue: [],
    passes: {},
    lastPass: null,
    swap: null,
    trickNo: 0,
    scores: Object.fromEntries(seats.map((x) => [x.id, 0])),
    log: [],
    auto: {},
    seq: 0,
  };
}

/** Karten geben, Trumpf aufdecken, Werwolf suchen. */
export function startRound(s: State, round: number, dealer: number): State {
  const n = s.seats.length;
  const cards = s.plan[round] ?? 1;
  const deck = shuffle([
    ...Array.from({ length: BASE_DECK }, (_, i) => i),
    ...s.options.specials.map((x) => SPECIAL_ID[x]),
  ]);
  const hands: Record<string, number[]> = {};
  for (let k = 0; k < n; k++) {
    const seat = s.seats[(dealer + 1 + k) % n];
    hands[seat.id] = deck.slice(k * cards, (k + 1) * cards);
  }
  const indicator = deck[n * cards] ?? null;
  const spare = deck[n * cards + 1] ?? null;
  const { trump, dealerChooses } = trumpFrom(indicator);
  const base: State = {
    ...s,
    round,
    dealer,
    hands,
    indicator,
    spare,
    trump,
    vampirAs: null,
    werwolfBy: null,
    bids: {},
    shifts: {},
    won: Object.fromEntries(s.seats.map((x) => [x.id, 0])),
    trick: [],
    result: null,
    queue: [],
    passes: {},
    lastPass: null,
    swap: null,
    trickNo: 0,
  };
  const wolf = s.seats.find((x) => hands[x.id].includes(SPECIAL_ID.werwolf));
  if (wolf) return { ...base, phase: 'werwolf', turn: wolf.id };
  if (dealerChooses) return { ...base, phase: 'trump', turn: s.seats[dealer].id };
  return beginBidding(base);
}

function beginBidding(s: State): State {
  return {
    ...s,
    phase: 'bid',
    turn: firstId(s),
    vampirAs: vampirCopy(s.indicator, s.spare),
  };
}

/** Wer bei „Weitergeben" noch keine Karte gewählt hat. */
export function pendingPassers(s: State): string[] {
  return s.seats
    .filter((x) => (s.hands[x.id]?.length ?? 0) > 0 && s.passes[x.id] === undefined)
    .map((x) => x.id);
}

/** Wer gerade am Zug ist – bei „Weitergeben" alle, die noch fehlen. */
export function actorsOf(s: State): string[] {
  if (s.phase === 'pass') return pendingPassers(s);
  if (['trump', 'werwolf', 'bid', 'play', 'wolke', 'hexe'].includes(s.phase) && s.turn) {
    return [s.turn];
  }
  return [];
}

/** Die Nachwirkungen eines vollständigen Stichs, in Regelreihenfolge. */
function effectsOf(trick: Played[], result: TrickResult, vampirAs: number | null): Effect[] {
  const out: Effect[] = [];
  const effs = trick.map((p) => ({ p, e: effective(p, vampirAs) }));
  // Die Wolke zuerst: sie betrifft den Gewinner, und die Hexe handelt laut
  // Regel erst, wenn alle anderen Effekte abgehandelt sind.
  for (const { e } of effs) {
    if (e.t === 'num' && e.effect === 'wolke' && result.winner) {
      out.push({ t: 'wolke', who: result.winner });
    }
  }
  for (const { e } of effs) {
    if (e.t === 'num' && e.effect === 'jongleur') out.push({ t: 'pass' });
  }
  for (const { p, e } of effs) {
    if (e.t === 'hexe') out.push({ t: 'hexe', who: p.by });
  }
  return out;
}

/** Arbeitet die Warteschlange ab, bis eine Entscheidung nötig ist. */
function advance(s: State): State {
  let st = s;
  while (st.queue.length) {
    const [next, ...rest] = st.queue;
    st = { ...st, queue: rest };
    if (next.t === 'wolke') {
      const cards = cardsThisRound(st);
      const bid = st.bids[next.who] ?? 0;
      const up = bid + 1 <= cards;
      const down = bid - 1 >= 0;
      if (up && down) return { ...st, phase: 'wolke', turn: next.who };
      const shift = up ? 1 : down ? -1 : 0;
      st = shiftBid(st, next.who, shift);
      continue;
    }
    if (next.t === 'pass') {
      if (st.seats.every((x) => !st.hands[x.id]?.length)) continue;
      return { ...st, phase: 'pass', turn: '', passes: {} };
    }
    if (next.t === 'hexe') {
      if (!st.hands[next.who]?.length) continue;
      return { ...st, phase: 'hexe', turn: next.who };
    }
  }
  return finishTrick(st);
}

function shiftBid(s: State, who: string, shift: number): State {
  if (!shift) return s;
  return {
    ...s,
    bids: { ...s.bids, [who]: (s.bids[who] ?? 0) + shift },
    shifts: { ...s.shifts, [who]: (s.shifts[who] ?? 0) + shift },
  };
}

function finishTrick(s: State): State {
  const empty = s.seats.every((x) => !s.hands[x.id]?.length);
  if (empty) return endRound(s);
  return {
    ...s,
    phase: 'play',
    turn: s.result?.lead || firstId(s),
    trick: [],
    result: null,
    queue: [],
    passes: {},
    trickNo: s.trickNo + 1,
  };
}

function endRound(s: State): State {
  const delta: Record<string, number> = {};
  const scores = { ...s.scores };
  for (const seat of s.seats) {
    const d = roundScore(s.bids[seat.id] ?? 0, s.won[seat.id] ?? 0);
    delta[seat.id] = d;
    scores[seat.id] = (scores[seat.id] ?? 0) + d;
  }
  return {
    ...s,
    phase: 'score',
    turn: '',
    queue: [],
    passes: {},
    scores,
    log: [
      ...s.log,
      {
        cards: cardsThisRound(s),
        trump: s.trump,
        bids: { ...s.bids },
        won: { ...s.won },
        delta,
      },
    ],
  };
}

/** Die Farbe, die ein Jongleur ohne Angabe bekommt: die geforderte, sonst Trumpf. */
function defaultSuit(s: State): number {
  return ledSuit(s.trick, s.vampirAs) ?? s.trump ?? 0;
}

function isPreset(v: unknown): v is Preset {
  return v === 'klassisch' || v === 'jubilaeum' || v === 'alle';
}

function isLength(v: unknown): v is Length {
  return v === 'kurz' || v === 'voll' || v === 'rauf-runter';
}

/** Der eigentliche Reducer – ohne Zähler, damit der Autopilot ihn nutzen kann. */
function core(state: State, action: GameAction, players: GamePlayer[]): State {
  switch (action.type) {
    // ----- Tisch einrichten -----
    case 'toggleSpecial': {
      if (state.phase !== 'setup') return state;
      const special = action.special as Special;
      if (!SPECIALS.includes(special)) return state;
      const on = state.options.specials.includes(special);
      const specials = SPECIALS.filter((x) =>
        x === special ? !on : state.options.specials.includes(x),
      );
      return { ...state, options: { ...state.options, specials } };
    }

    case 'preset': {
      if (state.phase !== 'setup' || !isPreset(action.preset)) return state;
      const specials = [...PRESETS[action.preset]];
      const same =
        specials.length === state.options.specials.length &&
        specials.every((x) => state.options.specials.includes(x));
      if (same) return state;
      return { ...state, options: { ...state.options, specials } };
    }

    case 'rule': {
      if (state.phase !== 'setup') return state;
      const rule = action.rule;
      if (rule !== 'noEvenBids' && rule !== 'forehead') return state;
      const on = action.on === true;
      if (state.options[rule] === on) return state;
      return { ...state, options: { ...state.options, [rule]: on } };
    }

    case 'length': {
      if (state.phase !== 'setup' || !isLength(action.length)) return state;
      if (state.options.length === action.length) return state;
      return {
        ...state,
        options: { ...state.options, length: action.length },
        plan: planFor(state.seats.length, action.length),
      };
    }

    case 'deal': {
      if (state.phase !== 'setup') return state;
      const seats = toSeats(rosterOf(players));
      if (seats.length < 2) return state;
      const plan = planFor(seats.length, state.options.length);
      const fresh: State = {
        ...state,
        seats,
        plan,
        scores: Object.fromEntries(seats.map((x) => [x.id, 0])),
        log: [],
        auto: {},
      };
      // Der erste Geber wird gelost, danach wandert das Geben nach links.
      return startRound(fresh, 0, Math.floor(Math.random() * seats.length));
    }

    // ----- Trumpf -----
    case 'chooseTrump': {
      const suit = action.suit;
      if (state.phase === 'trump') {
        if (!isSuit(suit)) return state;
        return beginBidding({ ...state, trump: suit });
      }
      if (state.phase === 'werwolf') {
        if (!isSuit(suit) && suit !== -1) return state;
        const who = state.turn;
        const hand = state.hands[who] ?? [];
        if (!hand.includes(SPECIAL_ID.werwolf)) return state;
        // Der Werwolf wandert auf den Platz der Trumpfkarte, die Trumpfkarte
        // auf die Hand. Die Hand behält ihre Größe.
        const rest = hand.filter((c) => c !== SPECIAL_ID.werwolf);
        const next = state.indicator == null ? rest : [...rest, state.indicator];
        return beginBidding({
          ...state,
          hands: { ...state.hands, [who]: next },
          indicator: SPECIAL_ID.werwolf,
          trump: suit === -1 ? null : (suit as number),
          werwolfBy: who,
        });
      }
      return state;
    }

    // ----- Ansage -----
    case 'bid': {
      if (state.phase !== 'bid') return state;
      const who = String(action.who ?? '');
      if (!who || who !== state.turn) return state;
      const value = action.value;
      const cards = cardsThisRound(state);
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > cards) {
        return state;
      }
      const last = who === dealerId(state);
      const sum = Object.values(state.bids).reduce((a, b) => a + b, 0);
      if (forbiddenBid(cards, sum, last, state.options.noEvenBids) === value) return state;
      const bids = { ...state.bids, [who]: value };
      if (last) {
        return { ...state, bids, phase: 'play', turn: firstId(state), trick: [], trickNo: 0 };
      }
      return { ...state, bids, turn: nextSeatId(state, who) };
    }

    // ----- Stich -----
    case 'play': {
      if (state.phase !== 'play') return state;
      const card = action.card;
      const who = state.turn;
      const hand = state.hands[who];
      if (!isCard(card) || !hand?.includes(card)) return state;
      if (!legalCards(hand, state.trick, state.vampirAs).includes(card)) return state;

      const played: Played = { card, by: who };
      const choice = choiceFor(card, state.vampirAs);
      if (choice === 'suit') played.suit = isSuit(action.suit) ? action.suit : defaultSuit(state);
      if (choice === 'shape') played.shape = action.shape === 'magier' ? 'magier' : 'narr';

      const trick = [...state.trick, played];
      const hands = { ...state.hands, [who]: hand.filter((c) => c !== card) };
      // Der Tausch vom letzten Stich bleibt stehen, bis hier jemand legt.
      const base = { ...state, hands, trick, lastPass: null, swap: null };
      if (trick.length < state.seats.length) {
        return { ...base, turn: nextSeatId(state, who) };
      }
      const result = resolveTrick(trick, state.trump, state.vampirAs);
      const won = result.winner
        ? { ...state.won, [result.winner]: (state.won[result.winner] ?? 0) + 1 }
        : state.won;
      return {
        ...base,
        won,
        result,
        queue: effectsOf(trick, result, state.vampirAs),
        phase: 'trick',
        turn: '',
      };
    }

    case 'collect': {
      if (state.phase !== 'trick') return state;
      return advance(state);
    }

    // ----- Nachwirkungen -----
    case 'cloud': {
      if (state.phase !== 'wolke') return state;
      const who = String(action.who ?? '');
      if (who !== state.turn) return state;
      const shift = action.value;
      if (shift !== 1 && shift !== -1) return state;
      const bid = (state.bids[who] ?? 0) + shift;
      if (bid < 0 || bid > cardsThisRound(state)) return state;
      return advance(shiftBid(state, who, shift));
    }

    case 'pass': {
      if (state.phase !== 'pass') return state;
      const card = action.card;
      if (!isCard(card)) return state;
      const owner = state.seats.find((x) => state.hands[x.id]?.includes(card))?.id;
      if (!owner || state.passes[owner] !== undefined) return state;
      const passes = { ...state.passes, [owner]: card };
      const st = { ...state, passes };
      if (pendingPassers(st).length) return st;
      // Alle haben gewählt: gleichzeitig nach links (im Uhrzeigersinn weiter).
      const hands: Record<string, number[]> = {};
      for (const seat of state.seats) {
        const own = state.hands[seat.id] ?? [];
        const gives = passes[seat.id];
        const from = passes[prevSeatId(state, seat.id)];
        hands[seat.id] = [...own.filter((c) => c !== gives), ...(from !== undefined ? [from] : [])];
      }
      return advance({ ...st, hands, passes: {}, lastPass: passes });
    }

    case 'hexe': {
      if (state.phase !== 'hexe') return state;
      const who = state.turn;
      const hand = state.hands[who] ?? [];
      const give = action.card;
      const take = action.take;
      if (!isCard(give) || !hand.includes(give) || !isCard(take)) return state;
      const slot = state.trick.findIndex((p) => p.card === take);
      if (slot < 0) return state;
      // „Jedoch nicht die Hexe" – auch keinen Vampir, der gerade eine ist.
      if (effective(state.trick[slot], state.vampirAs).t === 'hexe') return state;
      const trick = state.trick.map((p, i) =>
        i === slot ? { card: give, by: p.by, swapped: true } : p,
      );
      return advance({
        ...state,
        trick,
        hands: { ...state.hands, [who]: [...hand.filter((c) => c !== give), take] },
        swap: { by: who, gave: give, took: take },
      });
    }

    // ----- Rundenende -----
    case 'next': {
      if (state.phase !== 'score') return state;
      const round = state.round + 1;
      if (round >= state.plan.length) return { ...state, phase: 'over', turn: '' };
      return startRound(state, round, (state.dealer + 1) % state.seats.length);
    }

    case 'restart': {
      const fresh = createState(players);
      return {
        ...fresh,
        options: state.options,
        plan: planFor(fresh.seats.length, state.options.length),
        seq: state.seq,
      };
    }

    default:
      return state;
  }
}

function isAway(players: GamePlayer[], id: string): boolean {
  const p = players.find((x) => x.id === id);
  return !p || p.online === false;
}

export function reduce(state: State, action: GameAction, players: GamePlayer[]): State {
  if (!state || typeof state !== 'object') return state;
  let next: State;
  switch (action.type) {
    case 'autopilot': {
      // Nur für Leute, die gerade weg sind – oder für die schon einmal
      // übernommen wurde. Sonst könnte ein Tap jemandem den Zug wegnehmen.
      const who = String(action.who ?? '');
      if (!actorsOf(state).includes(who)) return state;
      if (!state.auto[who] && !isAway(players, who)) return state;
      const move = botMove(state, who);
      if (!move) return state;
      const moved = core(state, { ...move, by: who, at: action.at }, players);
      if (moved === state) return state;
      next = { ...moved, auto: { ...moved.auto, [who]: true } };
      break;
    }
    case 'manual': {
      if (!state.auto[action.by]) return state;
      next = { ...state, auto: { ...state.auto, [action.by]: false } };
      break;
    }
    default:
      next = core(state, action, players);
  }
  return next === state ? state : { ...next, seq: (state.seq ?? 0) + 1 };
}

// ---------------------------------------------------------------------------
// Für die Anzeige
// ---------------------------------------------------------------------------

/** Welche Karten die Hexe aus dem Stich nehmen darf. */
export function hexeTakeable(s: State): number[] {
  return s.trick.filter((p) => effective(p, s.vampirAs).t !== 'hexe').map((p) => p.card);
}

/** Welche Ansage gerade verboten ist (nur für die Person am Zug). */
export function forbiddenNow(s: State): number | null {
  if (s.phase !== 'bid') return null;
  const sum = Object.values(s.bids).reduce((a, b) => a + b, 0);
  return forbiddenBid(cardsThisRound(s), sum, s.turn === dealerId(s), s.options.noEvenBids);
}

/** Sortiert eine Hand: Sonderkarten links, dann Trumpf, dann die übrigen Farben. */
export function sortHand(hand: readonly number[], trump: number | null): number[] {
  const rank = (c: number) => {
    const k = kindOf(c);
    if (k === 'num') {
      const suit = suitOf(c)!;
      const block = trump === suit ? 1 : 2 + ((suit - (trump ?? 0) + 4) % 4);
      return block * 100 + (c % 13);
    }
    const order = [
      'drache',
      'magier',
      'wandler',
      'vampir',
      'wolke',
      'jongleur',
      'fee',
      'narr',
      'hexe',
      'bombe',
      'werwolf',
    ];
    return -100 + order.indexOf(k);
  };
  return [...hand].sort((a, b) => rank(a) - rank(b));
}
