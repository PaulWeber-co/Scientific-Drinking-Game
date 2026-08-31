export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K'] as const;

export interface Card {
  /** 0 = Ass, 12 = König */
  rank: number;
  /** 0 = Pik, 1 = Herz, 2 = Karo, 3 = Kreuz */
  suit: number;
}

export function cardFromIndex(i: number): Card {
  return { rank: i % 13, suit: Math.floor(i / 13) };
}

export function isRed(card: Card): boolean {
  return card.suit === 1 || card.suit === 2;
}

export function cardLabel(card: Card): string {
  return `${RANKS[card.rank]}${SUITS[card.suit]}`;
}

/** Kartenwert für Höher/Tiefer: Ass zählt hoch (14). */
export function cardValue(card: Card): number {
  return card.rank === 0 ? 14 : card.rank + 1;
}

export function fullDeck(): number[] {
  return Array.from({ length: 52 }, (_, i) => i);
}
