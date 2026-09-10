import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setHapticsEnabled } from '../lib/haptics';
import { setSoundEnabled } from '../lib/sound';
import type { TaskFrequency } from '../engine/tasks';

type Theme = 'dark' | 'light';

/** Wie lang eine Partie laufen soll. 'endlos' = kein Abschluss. */
export type GameLength = 'kurz' | 'mittel' | 'lang' | 'endlos';

export interface AppState {
  theme: Theme;
  haptics: boolean;
  /** Kurze Klaenge. Getrennt von der Vibration: die beiden Kanaele bedienen
   *  verschiedene Leute. */
  sound: boolean;
  waterReminder: boolean;
  disclaimerAccepted: boolean;
  lastLobbyCode: string | null;
  /** Zuletzt gespielte Spiele-IDs, neueste zuerst. */
  recentGames: string[];
  /** Spicy-Inhalte je Spiel. Standardmäßig aus. */
  spicy: Record<string, boolean>;
  /** Wie lang eine Partie laufen soll. Gilt für alle Spiele. */
  gameLength: GameLength;
  /**
   * Wie oft es beim Aussetzen eine Aufgabe gibt. Wer gesperrt ist (Fahrer,
   * unter 18, alkoholfrei), bekommt unabhängig davon immer eine.
   */
  taskOnSkip: TaskFrequency;

  setTheme: (t: Theme) => void;
  toggleHaptics: () => void;
  toggleSound: () => void;
  toggleWaterReminder: () => void;
  acceptDisclaimer: () => void;
  setLastLobbyCode: (c: string | null) => void;
  markGamePlayed: (id: string) => void;
  toggleSpicy: (id: string) => void;
  clearSpicy: () => void;
  setGameLength: (l: GameLength) => void;
  setTaskOnSkip: (f: TaskFrequency) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      haptics: true,
      sound: true,
      waterReminder: true,
      disclaimerAccepted: false,
      lastLobbyCode: null,
      recentGames: [],
      spicy: {},
      gameLength: 'mittel',
      taskOnSkip: 'manchmal',

      setTheme: (theme) => set({ theme }),
      toggleHaptics: () =>
        set((s) => {
          setHapticsEnabled(!s.haptics);
          return { haptics: !s.haptics };
        }),
      toggleSound: () =>
        set((s) => {
          setSoundEnabled(!s.sound);
          return { sound: !s.sound };
        }),
      toggleWaterReminder: () => set((s) => ({ waterReminder: !s.waterReminder })),
      acceptDisclaimer: () => set({ disclaimerAccepted: true }),
      setLastLobbyCode: (lastLobbyCode) => set({ lastLobbyCode }),
      markGamePlayed: (id) =>
        set((s) => ({ recentGames: [id, ...s.recentGames.filter((g) => g !== id)].slice(0, 8) })),
      toggleSpicy: (id) => set((s) => ({ spicy: { ...s.spicy, [id]: !s.spicy[id] } })),
      // Spicy ist eine Einwilligung der Runde, keine Vorliebe: Am nächsten
      // Abend sitzen andere Leute am Tisch. Wird von `endNight` gerufen.
      clearSpicy: () => set({ spicy: {} }),
      setGameLength: (gameLength) => set({ gameLength }),
      setTaskOnSkip: (taskOnSkip) => set({ taskOnSkip }),
    }),
    {
      name: 'sdg.app',
      version: 5,
      migrate: migrateApp,
      onRehydrateStorage: () => rehydrateApp,
    },
  ),
);

/**
 * Schaltet Ton und Vibration auf das, was gespeichert war.
 *
 * Beide Schalter leben ausserhalb von React – in `lib/haptics.ts` und
 * `lib/sound.ts` –, und ohne diesen Schritt stünden sie nach jedem Start
 * wieder auf ihrer Voreinstellung.
 *
 * Ein unvollständiger Eintrag darf dabei nichts abschalten, was niemand
 * abgeschaltet hat. `migrateApp` fängt den Normalfall ab, aber nur beim
 * Versionswechsel: ein halb geschriebener oder von Hand beschnittener Eintrag
 * trägt die Felder trotzdem nicht. Ohne die beiden `??` käme `undefined` an,
 * und die App wäre still, ohne dass der Schalter das anzeigt.
 *
 * Exportiert, damit ein Test diesen Weg prüfen kann, ohne den Store neu zu
 * laden – wie `closeStaleNight` im Spieler-Store.
 */
export function rehydrateApp(state: AppState | undefined): void {
  if (!state) return;
  state.haptics = state.haptics ?? true;
  state.sound = state.sound ?? true;
  setHapticsEnabled(state.haptics);
  setSoundEnabled(state.sound);
}

/**
 * Ältere Installationen kennen die neuen Felder nicht – ohne Voreinstellung
 * gingen sie mit `undefined` in Rundenrechnung und Aufgabenauswahl.
 *
 * Exportiert, damit ein Test die Migration ohne localStorage prüfen kann: es
 * ist genau das Feld, an dem die neue Aufgaben-Funktion hängt.
 */
export function migrateApp(persisted: unknown, version: number): AppState {
  const state = persisted as Partial<AppState>;
  if (version < 3) state.gameLength = 'mittel';
  if (version < 4) state.taskOnSkip = 'manchmal';
  // Ohne diese Zeile stuende bei jedem Bestandsnutzer `undefined`, und
  // `onRehydrateStorage` schaltete den Ton stumm, ohne dass jemand ihn
  // ausgeschaltet hat.
  if (version < 5) state.sound = true;
  return state as AppState;
}

/**
 * Ob die Spicy-Karten eines Spiels im Stapel liegen. Auch ausserhalb von React
 * nutzbar – der Reducer läuft beim Host und braucht denselben Wert.
 */
export function isSpicyOn(gameId: string): boolean {
  return useApp.getState().spicy[gameId] === true;
}
