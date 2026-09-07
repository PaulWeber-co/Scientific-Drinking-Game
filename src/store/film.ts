import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../lib/id';

/**
 * Der Film des Abends.
 *
 * Eine Einwegkamera hat 27 Bilder, und die sind alle. Genau diese Knappheit
 * ist der Sinn – deshalb gibt es kein stilles Nachfüllen, sondern nur den
 * bewussten zweiten Film.
 *
 * Was hier liegt, sind nur Metadaten: Bilder gehören ins Dateisystem, der
 * localStorage ist bei etwa fünf Megabyte zu Ende. Die Datei wird über
 * `Photo.file` verknüpft.
 */

/** Bilder auf einem Film – wie bei einer echten Wegwerfkamera. */
export const ROLL_SIZE = 27;

/**
 * Auswahl für die Entwicklungszeit, in Stunden ab Abendbeginn.
 * Die 0 ist der Sonderwert „am nächsten Morgen um neun" – und die
 * Voreinstellung, weil ein Abend mit offenem Ende sonst mitten in der Nacht
 * entwickelt.
 */
export const DEVELOP_CHOICES = [4, 8, 12, 0] as const;

export interface Photo {
  id: string;
  /**
   * Der Abend, zu dem das Bild gehört – `null`, solange er noch läuft.
   * Beim Abschluss wird die Kennung des archivierten Abends nachgetragen.
   */
  nightId: string | null;
  at: number;
  /**
   * Wann dieses Bild sichtbar wird. Steht beim Auslösen fest, damit eine
   * später geänderte Einstellung nicht rückwirkend Bilder aufsperrt oder
   * wieder wegschließt.
   */
  developAt: number;
  /** Dateiname im Foto-Verzeichnis. */
  file: string;
}

interface FilmState {
  /** Auf DIESEM Gerät verbrauchte Bilder des laufenden Abends. */
  mine: number;
  /** Eingelegte Filme des laufenden Abends. 1 = der erste. */
  rolls: number;
  /** Entwicklungszeit in Stunden ab Abendbeginn, 0 = am nächsten Morgen. */
  developAfterH: number;
  photos: Photo[];
  /**
   * Dateien, deren Metadaten schon weg sind und die noch gelöscht werden
   * müssen. Ohne diese Liste fände der Aufräumer sie nie wieder – er
   * vergleicht Bilder gegen Abende, und beide sind dann verschwunden.
   */
  pendingDeletes: string[];
  /** Wie oft eine Partie zu Ende ging – steuert, wie oft gefragt wird. */
  endings: number;
  /**
   * Höchststand des Gesamtverbrauchs im laufenden Abend.
   *
   * Der Verbrauch darf nie sinken. Aus der Runde kommt er als Summe über
   * die anwesenden Geräte – und die schrumpft, sobald der Host jemanden als
   * inaktiv entfernt oder die Verbindung wegbricht. Ohne diesen Merker
   * bekäme der Film die schon belichteten Bilder zurück.
   */
  usedHigh: number;
  /** Meldet einen Verbrauchsstand; übernommen wird nur ein höherer. */
  noteUsed: (used: number) => void;

  /** Zählt ein Spielende und gibt die neue Nummer zurück. */
  countEnding: () => number;
  addPhoto: (file: string, developAt: number) => void;
  /** Legt einen neuen Film ein – nur nach ausdrücklicher Ansage. */
  loadRoll: () => void;
  setDevelopAfterH: (h: number) => void;
  /** Spiegelt die Filmzahl der Runde, damit sie einen Verbindungsverlust überlebt. */
  setRolls: (rolls: number) => void;
  /** Schreibt die Abend-Kennung in alle Bilder, die noch keine haben. */
  assignNight: (nightId: string) => void;
  /** Nach dem Abschluss beginnt der nächste Abend mit frischem Film. */
  resetRoll: () => void;
  removeNight: (nightId: string) => string[];
  clearAll: () => void;
  /** Quittiert erledigte Löschungen. */
  clearPending: (files: readonly string[]) => void;
}

export const useFilm = create<FilmState>()(
  persist(
    (set, get) => ({
      mine: 0,
      rolls: 1,
      developAfterH: 0,
      photos: [],
      endings: 0,
      usedHigh: 0,
      pendingDeletes: [],

      noteUsed: (used) => set((s) => (used > s.usedHigh ? { usedHigh: used } : s)),

      countEnding: () => {
        const next = get().endings + 1;
        set({ endings: next });
        return next;
      },

      addPhoto: (file, developAt) =>
        set((s) => ({
          mine: s.mine + 1,
          photos: [
            { id: uid('p_'), nightId: null, at: Date.now(), developAt, file },
            ...s.photos,
          ],
        })),

      loadRoll: () => set((s) => ({ rolls: s.rolls + 1 })),
      setDevelopAfterH: (developAfterH) => set({ developAfterH }),
      setRolls: (rolls) => set({ rolls }),

      assignNight: (nightId) =>
        set((s) => ({
          photos: s.photos.map((p) => (p.nightId === null ? { ...p, nightId } : p)),
        })),

      resetRoll: () => set({ mine: 0, rolls: 1, usedHigh: 0 }),

      removeNight: (nightId) => {
        const gone = get().photos.filter((p) => p.nightId === nightId).map((p) => p.file);
        set((s) => ({
          photos: s.photos.filter((p) => p.nightId !== nightId),
          pendingDeletes: [...s.pendingDeletes, ...gone],
        }));
        return gone;
      },

      clearPending: (files) =>
        set((s) => ({ pendingDeletes: s.pendingDeletes.filter((f) => !files.includes(f)) })),

      clearAll: () => {
        const gone = get().photos.map((p) => p.file);
        set({
          mine: 0,
          rolls: 1,
          usedHigh: 0,
          photos: [],
          pendingDeletes: [...get().pendingDeletes, ...gone],
        });
      },
    }),
    { name: 'sdg.film', version: 1 },
  ),
);

/**
 * Wie viele Bilder ICH noch machen darf.
 *
 * Gerechnet gegen den EIGENEN Verbrauch, nicht nur gegen den Rest: würde
 * nur der Rest geteilt, dürfte man nach jedem eigenen Bild wieder ein
 * Stück davon haben und könnte den Film allein leerschießen, während die
 * Anzeige die ganze Zeit einen fairen Anteil behauptet.
 *
 * Geteilt wird durch die Zahl der GERÄTE, nicht der Spieler: auf einem
 * geteilten Handy wandert die Kamera herum wie eine echte, da ist nichts
 * aufzuteilen. Aufgerundet, damit bei fünf Leuten und 27 Bildern niemand
 * mit fünf statt sechs dasteht und zwei Bilder liegenbleiben — den harten
 * Deckel setzt ohnehin der Rest.
 *
 * Die letzten Bilder gehören dem, der zuerst zugreift: sonst dürfte bei
 * drei verbleibenden Bildern und fünf Geräten niemand mehr auslösen und
 * der Film bliebe für immer halbleer.
 */
export function myShotsLeft(input: {
  total: number;
  remaining: number;
  mine: number;
  devices: number;
}): number {
  if (input.remaining <= 0) return 0;
  const devices = Math.max(1, input.devices);
  if (input.remaining <= devices) return input.remaining;
  const kontingent = Math.ceil(input.total / devices);
  return Math.min(input.remaining, Math.max(0, kontingent - input.mine));
}

/**
 * Stand des gemeinsamen Films aus den Rohdaten.
 *
 * Als reine Funktion, weil zwei Stellen sie brauchen: das Album und die
 * Nachfrage nach dem Spiel. Die darf nicht aus `src/games/` in die
 * Kamera-Ansicht greifen – das zöge einen Importzyklus über die
 * Spiele-Registry.
 */
export function filmStand(input: {
  online: boolean;
  /** Verbrauch der ANDEREN Geräte, aus der Runde. Ohne das eigene. */
  othersShots: readonly number[];
  /** Eigener Verbrauch – zählt immer lokal mit, nicht erst nach dem
   *  nächsten Herzschlag. Sonst belichtet ein Gerät in einem
   *  20-Sekunden-Fenster den halben Film, ohne dass der Rest sinkt. */
  mine: number;
  rolls: number;
  /** Bisher höchster bekannter Verbrauch; der Stand fällt nie zurück. */
  usedHigh: number;
}): { total: number; remaining: number; mineLeft: number; used: number } {
  const devices = input.online ? input.othersShots.length + 1 : 1;
  const gemeldet = input.mine + (input.online ? input.othersShots.reduce((n, x) => n + x, 0) : 0);
  const used = Math.max(gemeldet, input.usedHigh);
  const total = ROLL_SIZE * input.rolls;
  const remaining = Math.max(0, total - used);
  return { total, remaining, used, mineLeft: myShotsLeft({ total, remaining, mine: input.mine, devices }) };
}

/**
 * Ist dieses Bild schon entwickelt?
 *
 * Eine eigene Funktion, damit die Sperre an genau EINER Stelle steht: eine
 * zweite Abfrage irgendwo im Album, die den Vergleich anders herum schreibt,
 * würde das ganze Feature aushebeln.
 */
export function isDeveloped(photo: Photo, now: number = Date.now()): boolean {
  return photo.developAt <= now;
}

/** Wann die Bilder sichtbar werden. */
export function developAt(nightStartedAt: number, afterH: number): number {
  if (afterH > 0) return nightStartedAt + afterH * 3_600_000;
  // Am nächsten Morgen um neun – gerechnet vom Kalendertag des Abendbeginns.
  // Wer um 2 Uhr nachts anfängt, wartet deshalb bis zum selben Vormittag und
  // nicht 31 Stunden.
  const d = new Date(nightStartedAt);
  const nine = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0, 0).getTime();
  return nine > nightStartedAt ? nine : nine + 86_400_000;
}
