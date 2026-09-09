import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AvatarColor } from '../components/ui/Avatar';
import type { DrinkEvent } from '../engine/types';
import { uid } from '../lib/id';

/**
 * Archiv der vergangenen Abende.
 *
 * Bis hierher war ein Abend flüchtig: `endNight()` warf das Log weg und
 * damit den ganzen Abend. Gespeichert wird jetzt das ROHE Log – daraus
 * lassen sich alle Zahlen jederzeit neu rechnen, ohne dass eine später
 * geänderte Auswertung alte Abende falsch aussehen lässt.
 *
 * Was NICHT hier liegt: Körperdaten. Gewicht, Größe, Alter und
 * Geschlecht bräuchte nur die Promille-Rechnung, und die drei Zahlen, die
 * daraus entstehen, sind eingefroren mit dabei. So bleibt der Abend-
 * Datensatz frei von Gesundheitsdaten – und ein später korrigiertes
 * Gewicht verschiebt nicht rückwirkend den Pegel von letztem Samstag.
 */

/** Wer dabei war. Die `id` ist die Geräte-Kennung aus `lib/id.ts`. */
export interface NightParticipant {
  id: string;
  name: string;
  color: AvatarColor;
}

export interface Night {
  id: string;
  startedAt: number;
  endedAt: number;
  /** Frei eintragbar, z.B. "Bei Paul im Garten". Leer ist der Normalfall. */
  place?: string;
  /** Alle, die im Lauf des Abends dabei waren – auch wer zwischendurch ging. */
  participants: NightParticipant[];
  log: DrinkEvent[];
  waterCount: number;
  /** Eingefroren, weil die Rechnung Körperdaten braucht (s. oben). */
  peakBac: number;
  peakAt: number;
  soberAt: number;
}

/** Ab so vielen Abenden wird aufgeräumt. */
export const NIGHTS_CAPACITY = 60;
/** So viele bleiben danach übrig – die jüngsten. */
export const NIGHTS_KEEP = 50;

interface NightsState {
  /** Neueste zuerst. */
  nights: Night[];
  /** Teilnehmer des LAUFENDEN Abends, kumulativ gesammelt. */
  current: NightParticipant[];
  noteParticipants: (players: readonly NightParticipant[]) => void;
  /** Legt den Abend ab und liefert seine Kennung – daran hängt der Film. */
  archive: (night: Omit<Night, 'id' | 'participants'>) => string;
  setPlace: (id: string, place: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
}

export const useNights = create<NightsState>()(
  persist(
    (set) => ({
      nights: [],
      current: [],

      noteParticipants: (players) =>
        set((s) => {
          const merged = mergeParticipants(s.current, players);
          // Referenz nur wechseln, wenn sich wirklich etwas geändert hat –
          // sonst schreibt jeder Herzschlag der Lobby in den localStorage.
          // Verglichen wird der INHALT: ein Längenvergleich würde jede
          // Umbenennung verschlucken, und wer als „Spieler" beitritt, stünde
          // für immer als „Spieler" im Rückblick.
          return unveraendert(s.current, merged) ? s : { current: merged };
        }),

      archive: (night) => {
        const id = uid('n_');
        set((s) => ({
          nights: prune([{ ...night, id, participants: s.current }, ...s.nights]),
          current: [],
        }));
        return id;
      },

      setPlace: (id, place) =>
        set((s) => ({
          nights: s.nights.map((n) =>
            n.id === id ? { ...n, place: place.trim() || undefined } : n,
          ),
        })),

      remove: (id) => set((s) => ({ nights: s.nights.filter((n) => n.id !== id) })),
      clearAll: () => set({ nights: [], current: [] }),
    }),
    { name: 'sdg.nights', version: 1 },
  ),
);

/**
 * Fügt neue Teilnehmer hinzu, ohne bestehende zu verlieren.
 *
 * Entdoppelt AUSSCHLIESSLICH über die Geräte-Kennung, nie über den Namen:
 * zwei echte Gäste dürfen beide "Max" heißen, und einer davon aus der
 * Liste zu werfen wäre der schlimmere Fehler. Wer die Lobby verlässt und
 * neu beitritt, kommt mit derselben Kennung zurück und bleibt einer.
 *
 * Der Name wird beim Wiedersehen aktualisiert – wer sich umbenennt, soll
 * unter dem letzten Namen im Rückblick stehen.
 */
export function mergeParticipants(
  current: readonly NightParticipant[],
  players: readonly NightParticipant[],
): NightParticipant[] {
  const byId = new Map(current.map((p) => [p.id, p]));
  for (const p of players) byId.set(p.id, p);
  return [...byId.values()];
}

function unveraendert(a: readonly NightParticipant[], b: readonly NightParticipant[]): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => p.id === b[i].id && p.name === b[i].name && p.color === b[i].color)
  );
}

/** Deckel gegen unbegrenztes Wachstum im localStorage. */
export function prune(nights: readonly Night[]): Night[] {
  return nights.length <= NIGHTS_CAPACITY ? [...nights] : nights.slice(0, NIGHTS_KEEP);
}
