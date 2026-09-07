/**
 * Reine Bausteine des Gedächtnisses: Schlüssel und Reihenfolge. Ohne Store
 * und ohne Browser, damit `engine/` sie benutzen darf und Tests sie ohne
 * localStorage prüfen können. Der Zustand liegt in `store/seen.ts`.
 */

/**
 * Kurzer, stabiler Schlüssel für einen Text (FNV-1a, 32 Bit, base36).
 *
 * Gespeichert wird der Hash statt des Textes: rund 600 Karten kosten so etwa
 * 4 KB statt 40 KB im localStorage. Ändert sich ein Text, gilt er wieder als
 * ungesehen – richtig so, es ist dann eine andere Karte.
 */
export function seenKey(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Ordnet eine Liste nach Frische: Ungesehenes zuerst in der übergebenen
 * Reihenfolge, danach das am längsten Zurückliegende.
 *
 * Die Eingabe wird nicht gemischt. Wer Zufall unter den ungesehenen Einträgen
 * will, mischt vorher – so bleibt die einzige Zufallsquelle beim Aufrufer,
 * und der ist im Kartenspiel der Host.
 *
 * Läuft nie leer: ist alles gesehen, steht die älteste Karte wieder vorn.
 */
export function freshestFirst<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  seen: Readonly<Record<string, number>>,
): T[] {
  return items
    .map((item, index) => ({ item, index, at: seen[keyOf(item)] ?? -1 }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map((entry) => entry.item);
}
