import { shuffle } from '../../lib/format';
import { isSpicyOn } from '../../store/app';
import { orderByFreshness } from '../../store/seen';

export interface SpicyItem {
  /** Kommt nur in den Stapel, wenn der Spicy-Modus dieses Spiels an ist. */
  spicy?: boolean;
}

/**
 * Gemischter Stapel aus Indizes – die Inhaltsliste selbst ist auf allen Geräten
 * identisch, deshalb reisen hier Indizes und keine Texte.
 *
 * Danach nach Gedächtnis geordnet: Ungesehenes zuerst, dann das am längsten
 * Zurückliegende. Ohne das fängt jede neue Partie wieder bei null an — zweite
 * Runde am selben Abend, dieselben Fragen.
 *
 * `textOf` ist Pflicht und hat bewusst keinen Standardwert: die Spiele nennen
 * ihr Textfeld verschieden (`text`, `title`), und ein stiller Fehlgriff würde
 * das Gedächtnis lautlos leerlaufen lassen, ohne dass etwas rot wird.
 */
export function spicyDeck<T extends SpicyItem>(
  items: readonly T[],
  gameId: string,
  textOf: (item: T) => string,
): number[] {
  const on = isSpicyOn(gameId);
  const indices = items.map((_, i) => i).filter((i) => on || !items[i].spicy);
  return orderByFreshness(shuffle(indices), (i) => textOf(items[i]));
}
