import { shuffle } from '../../lib/format';
import { isSpicyOn } from '../../store/app';

export interface SpicyItem {
  /** Kommt nur in den Stapel, wenn der Spicy-Modus dieses Spiels an ist. */
  spicy?: boolean;
}

/**
 * Gemischter Stapel aus Indizes – die Inhaltsliste selbst ist auf allen Geräten
 * identisch, deshalb reisen hier Indizes und keine Texte.
 */
export function spicyDeck<T extends SpicyItem>(items: readonly T[], gameId: string): number[] {
  const on = isSpicyOn(gameId);
  return shuffle(items.map((_, i) => i).filter((i) => on || !items[i].spicy));
}
