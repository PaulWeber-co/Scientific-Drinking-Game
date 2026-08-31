import { Icon } from '../../components/icons';
import { cardFromIndex, cardLabel, isRed, RANKS, SUIT_ICONS } from './deck';

export function PlayingCard({ index, hidden }: { index: number | null; hidden?: boolean }) {
  if (index == null || hidden) {
    return (
      <div className="playcard playcard--back" aria-label="verdeckte Karte">
        <span className="playcard__pattern" />
      </div>
    );
  }
  const card = cardFromIndex(index);
  const suit = SUIT_ICONS[card.suit];
  return (
    <div className={`playcard ${isRed(card) ? 'playcard--red' : ''}`} aria-label={cardLabel(card)}>
      <div className="playcard__corner">
        <span className="playcard__rank">{RANKS[card.rank]}</span>
        <Icon name={suit} size={13} />
      </div>
      <Icon name={suit} size={34} className="playcard__mid" />
      <div className="playcard__corner playcard__corner--end">
        <span className="playcard__rank">{RANKS[card.rank]}</span>
        <Icon name={suit} size={13} />
      </div>
    </div>
  );
}
