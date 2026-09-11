import { Icon } from '../../components/icons';
import { cardFromIndex, cardLabel, isRed, RANKS, SUIT_ICONS } from './deck';

/**
 * Drei Größen, weil eine Karte je nach Lage etwas anderes ist:
 *
 * - `lg` (108×152) ist die EINE gezogene Karte, die den Bildschirm trägt.
 * - `md` (76×106) ist eine Hand: vier passen bei 390 px nebeneinander.
 * - `sm` (60×84) ist eine Reihe oder ein Feld: fünf passen nebeneinander.
 *
 * Alle liegen auf 5:7, dem Maß einer echten Spielkarte. Vorher gab es nur
 * `lg`, und fünf davon brauchten 594 px auf einem 390-px-Schirm — die
 * Busstrecke brach in drei Zeilen um.
 *
 * Die Klasse `.playcard` bleibt auf jeder Größe: `kings-cup` sucht sie per
 * `querySelector`, um die gezogene Karte fliegen zu lassen.
 */
export type CardSize = 'lg' | 'md' | 'sm';

export function PlayingCard({
  index,
  hidden,
  size = 'lg',
  glow,
  className,
}: {
  index: number | null;
  hidden?: boolean;
  size?: CardSize;
  /** Hebt den Platz hervor, der als Nächstes dran ist. */
  glow?: boolean;
  className?: string;
}) {
  const box = [
    'playcard',
    size !== 'lg' && `playcard--${size}`,
    glow && 'playcard--glow',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (index == null || hidden) {
    return (
      <div className={`${box} playcard--back`} aria-label="verdeckte Karte">
        <span className="playcard__pattern" />
      </div>
    );
  }
  const card = cardFromIndex(index);
  const suit = SUIT_ICONS[card.suit];
  // Die Mitte trägt das Bild, die Ecken tragen den Wert – beide schrumpfen
  // mit, sonst steht auf einer 60-px-Karte eine 34-px-Farbe.
  const mid = size === 'lg' ? 34 : size === 'md' ? 24 : 19;
  const corner = size === 'lg' ? 13 : size === 'md' ? 10 : 8;
  return (
    <div className={`${box} ${isRed(card) ? 'playcard--red' : ''}`} aria-label={cardLabel(card)}>
      <div className="playcard__corner">
        <span className="playcard__rank">{RANKS[card.rank]}</span>
        <Icon name={suit} size={corner} />
      </div>
      <Icon name={suit} size={mid} className="playcard__mid" />
      <div className="playcard__corner playcard__corner--end">
        <span className="playcard__rank">{RANKS[card.rank]}</span>
        <Icon name={suit} size={corner} />
      </div>
    </div>
  );
}
