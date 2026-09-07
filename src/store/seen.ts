import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { freshestFirst, seenKey } from '../lib/seen';

/**
 * Gedächtnis für alles, was einmal auf dem Bildschirm stand: Karten und
 * Aufgaben.
 *
 * Es merkt sich nicht *ob*, sondern *wann zuletzt* – als laufende Nummer.
 * Damit lässt sich ein Stapel so ordnen, dass zuerst alles Ungesehene kommt
 * und danach das, was am längsten zurückliegt. Ein reines "schon gesehen"-
 * Flag liefe in eine Sackgasse, sobald der Stapel durch ist; so rotiert er
 * stattdessen weiter.
 *
 * Bewusst NICHT an den Abend gekoppelt: wer zum zweiten Mal spielt, soll mit
 * neuem Stoff anfangen und nicht wieder bei Karte eins.
 */

/** Ab so vielen Einträgen wird aufgeräumt. */
export const SEEN_CAPACITY = 1500;
/** So viele bleiben danach übrig – die zuletzt gesehenen. */
export const SEEN_KEEP = 1000;

interface SeenState {
  /** Schlüssel -> laufende Nummer des letzten Auftritts. Größer = neuer. */
  seen: Record<string, number>;
  /** Vergibt die Nummern, steigt monoton. */
  cursor: number;
  markSeen: (keys: readonly string[]) => void;
  forgetAll: () => void;
}

export const useSeen = create<SeenState>()(
  persist(
    (set) => ({
      seen: {},
      cursor: 0,

      markSeen: (keys) =>
        set((s) => {
          if (!keys.length) return s;
          let cursor = s.cursor;
          const seen = { ...s.seen };
          for (const key of keys) seen[key] = ++cursor;
          return { seen: prune(seen), cursor };
        }),

      forgetAll: () => set({ seen: {}, cursor: 0 }),
    }),
    { name: 'sdg.seen', version: 1 },
  ),
);

/**
 * Deckel gegen unbegrenztes Wachstum im localStorage. Vergessen wird das am
 * längsten Zurückliegende – genau das, was ohnehin als Nächstes wieder an der
 * Reihe wäre. Exportiert, damit der Test die Grenze ohne 1500 Schreibvorgänge
 * prüfen kann.
 */
export function prune(seen: Record<string, number>): Record<string, number> {
  const keys = Object.keys(seen);
  if (keys.length <= SEEN_CAPACITY) return seen;
  const kept = keys.sort((a, b) => seen[b] - seen[a]).slice(0, SEEN_KEEP);
  const next: Record<string, number> = {};
  for (const key of kept) next[key] = seen[key];
  return next;
}

/**
 * `freshestFirst` gegen den aktuellen Stand – auch außerhalb von React.
 *
 * Nimmt den TEXT eines Eintrags, nicht den Schlüssel: gespeichert wird unter
 * dem Hash, und wer hier den rohen Text nachschlüge, bekäme lautlos für alles
 * „noch nie gesehen" zurück. Das Hashen gehört deshalb hier hinein und nicht
 * in den Aufrufer.
 */
export function orderByFreshness<T>(items: readonly T[], textOf: (item: T) => string): T[] {
  return freshestFirst(items, (item) => seenKey(textOf(item)), useSeen.getState().seen);
}

/** Merkt sich Texte als gesehen. Auch außerhalb von React aufrufbar. */
export function markTextsSeen(texts: readonly string[]): void {
  useSeen.getState().markSeen(texts.map(seenKey));
}
