import { cardFromIndex, cardLabel, isRed, RANKS, SUITS } from './deck';

export function PlayingCard({ index, hidden }: { index: number | null; hidden?: boolean }) {
  if (index == null || hidden) {
    return (
      <div className="playcard playcard--back" aria-label="verdeckte Karte">
        🎴
      </div>
    );
  }
  const card = cardFromIndex(index);
  return (
    <div
      className={`playcard ${isRed(card) ? 'playcard--red' : ''}`}
      aria-label={cardLabel(card)}
    >
      <div className="playcard__rank">{RANKS[card.rank]}</div>
      <div className="playcard__mid">{SUITS[card.suit]}</div>
      <div className="playcard__suit">{SUITS[card.suit]}</div>
    </div>
  );
}
