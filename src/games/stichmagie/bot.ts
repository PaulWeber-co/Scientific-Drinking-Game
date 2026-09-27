import type { GameActionInput } from '../types';
import type { State } from './game';
import {
  SPECIAL_ID,
  choiceFor,
  effective,
  forbiddenBid,
  kindOf,
  ledSuit,
  legalCards,
  resolveTrick,
  strongestIndex,
  suitOf,
  valueOf,
  type Played,
  type Shape,
} from './rules';

/**
 * Der Autopilot: spielt für Leute, deren Handy aus ist oder die gegangen sind.
 *
 * Er soll keine Partie gewinnen, sondern eine Runde nicht stehen lassen – und
 * dabei nichts Dummes tun: Wer noch Stiche braucht, versucht zu stechen; wer
 * genug hat, wirft ab. Er rechnet nur mit dem, was auf dem Tisch liegt, und
 * mit der eigenen Hand. Deterministisch, damit Tests reproduzierbar bleiben.
 */

/** Grobe Siegchance einer Karte, für die Ansage. */
function winChance(
  card: number,
  trump: number | null,
  vampirAs: number | null,
  players: number,
): number {
  const kind = kindOf(card);
  const crowd = Math.min(1, 4 / Math.max(3, players));
  switch (kind) {
    case 'drache':
      return 0.95;
    case 'magier':
      return 0.85;
    case 'wandler':
      return 0.75;
    case 'wolke':
      return trump == null ? 0.35 : 0.5;
    case 'jongleur':
      return 0.2;
    case 'fee':
      return 0.08;
    case 'vampir':
      return vampirAs == null || vampirAs === SPECIAL_ID.vampir || vampirAs === SPECIAL_ID.werwolf
        ? 0
        : winChance(vampirAs, trump, null, players);
    case 'num': {
      const v = valueOf(card)!;
      if (trump !== null && suitOf(card) === trump) {
        return v >= 11 ? 0.85 : v >= 8 ? 0.6 * crowd + 0.1 : v >= 5 ? 0.3 * crowd : 0.12 * crowd;
      }
      if (trump === null)
        return v === 13 ? 0.75 : v === 12 ? 0.5 * crowd : v === 11 ? 0.3 * crowd : 0.05;
      return v === 13 ? 0.55 * crowd : v === 12 ? 0.3 * crowd : v === 11 ? 0.12 * crowd : 0.02;
    }
    default:
      return 0;
  }
}

/** Wie „stark" eine gespielte Karte ist – zum Sortieren von Kandidaten. */
function power(
  p: Played,
  trump: number | null,
  vampirAs: number | null,
  led: number | null,
): number {
  const e = effective(p, vampirAs);
  switch (e.t) {
    case 'drache':
      return 100;
    case 'magier':
      return 90;
    case 'num':
      if (trump !== null && e.suit === trump) return 50 + e.value * 3;
      if (led !== null && e.suit === led) return 20 + e.value;
      return e.value;
    case 'fee':
      return 0.5;
    default:
      return 0;
  }
}

/** Die Farbe, von der die Hand am meisten (und am höchsten) hat. */
function bestSuit(hand: readonly number[]): number | null {
  const score = [0, 0, 0, 0];
  let any = false;
  for (const c of hand) {
    const s = suitOf(c);
    if (s === null) continue;
    any = true;
    score[s] += 10 + (valueOf(c) ?? 0);
  }
  if (!any) return null;
  return score.indexOf(Math.max(...score));
}

function weakest(hand: readonly number[], s: State): number {
  const led = ledSuit(s.trick, s.vampirAs);
  return [...hand].sort(
    (a, b) =>
      power({ card: a, by: '' }, s.trump, s.vampirAs, led) -
        power({ card: b, by: '' }, s.trump, s.vampirAs, led) || a - b,
  )[0];
}

/** Alle Arten, eine Karte zu legen – mit jeder sinnvollen Wahl. */
function candidates(card: number, s: State, who: string): Played[] {
  const choice = choiceFor(card, s.vampirAs);
  if (choice === 'shape') {
    return (['magier', 'narr'] as Shape[]).map((shape) => ({ card, by: who, shape }));
  }
  if (choice === 'suit') {
    return [0, 1, 2, 3].map((suit) => ({ card, by: who, suit }));
  }
  return [{ card, by: who }];
}

function playMove(s: State, who: string): GameActionInput | null {
  const hand = s.hands[who] ?? [];
  const legal = legalCards(hand, s.trick, s.vampirAs);
  if (!legal.length) return null;
  const need = (s.bids[who] ?? 0) - (s.won[who] ?? 0);
  const led = ledSuit(s.trick, s.vampirAs);
  const options = legal.flatMap((c) => candidates(c, s, who));
  const pw = (p: Played) => power(p, s.trump, s.vampirAs, led ?? p.suit ?? null);
  const byPower = [...options].sort((a, b) => pw(a) - pw(b) || a.card - b.card);

  let pick: Played;
  if (!s.trick.length) {
    // Ausspielen: wer Stiche braucht, kommt stark, sonst schwach.
    pick = need > 0 ? byPower[byPower.length - 1] : byPower[0];
  } else {
    const wins = (p: Played) => {
      const trick = [...s.trick, p];
      if (resolveTrick(trick, s.trump, s.vampirAs).bomb) return false;
      return strongestIndex(trick, s.trump, s.vampirAs) === trick.length - 1;
    };
    const winning = byPower.filter(wins);
    const losing = byPower.filter((p) => !wins(p));
    if (need > 0) pick = winning[0] ?? byPower[0];
    else pick = losing[losing.length - 1] ?? byPower[0];
  }
  const out: GameActionInput = { type: 'play', card: pick.card };
  if (pick.suit !== undefined) out.suit = pick.suit;
  if (pick.shape !== undefined) out.shape = pick.shape;
  return out;
}

function bidMove(s: State, who: string): GameActionInput {
  const hand = s.hands[who] ?? [];
  const cards = hand.length;
  const guess = hand.reduce((sum, c) => sum + winChance(c, s.trump, s.vampirAs, s.seats.length), 0);
  let value = Math.max(0, Math.min(cards, Math.round(guess)));
  const sum = Object.values(s.bids).reduce((a, b) => a + b, 0);
  const last = s.seats[s.dealer]?.id === who;
  const forbidden = forbiddenBid(cards, sum, last, s.options.noEvenBids);
  if (forbidden === value) value = value > 0 ? value - 1 : value + 1;
  return { type: 'bid', who, value };
}

export function botMove(s: State, who: string): GameActionInput | null {
  switch (s.phase) {
    case 'trump':
      return { type: 'chooseTrump', suit: bestSuit(s.hands[who] ?? []) ?? 0 };
    case 'werwolf': {
      const hand = (s.hands[who] ?? []).filter((c) => c !== SPECIAL_ID.werwolf);
      const after = s.indicator == null ? hand : [...hand, s.indicator];
      return { type: 'chooseTrump', suit: bestSuit(after) ?? -1 };
    }
    case 'bid':
      return bidMove(s, who);
    case 'play':
      return playMove(s, who);
    case 'wolke': {
      // Schon genug? Dann die Ansage hoch, sonst runter.
      const up = (s.won[who] ?? 0) >= (s.bids[who] ?? 0);
      return { type: 'cloud', who, value: up ? 1 : -1 };
    }
    case 'pass': {
      const hand = s.hands[who] ?? [];
      if (!hand.length || s.passes[who] !== undefined) return null;
      return { type: 'pass', card: weakest(hand, s) };
    }
    case 'hexe': {
      const hand = s.hands[who] ?? [];
      if (!hand.length) return null;
      const led = ledSuit(s.trick, s.vampirAs);
      const takeable = s.trick.filter((p) => effective(p, s.vampirAs).t !== 'hexe');
      if (!takeable.length) return null;
      const best = [...takeable].sort(
        (a, b) =>
          power({ card: b.card, by: '' }, s.trump, s.vampirAs, led) -
          power({ card: a.card, by: '' }, s.trump, s.vampirAs, led),
      )[0];
      return { type: 'hexe', card: weakest(hand, s), take: best.card };
    }
    default:
      return null;
  }
}
