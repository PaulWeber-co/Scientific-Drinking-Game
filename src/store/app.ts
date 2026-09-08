import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setHapticsEnabled } from '../lib/haptics';
import type { TaskFrequency } from '../engine/tasks';

type Theme = 'dark' | 'light';

/** Wie lang eine Partie laufen soll. 'endlos' = kein Abschluss. */
export type GameLength = 'kurz' | 'mittel' | 'lang' | 'endlos';

interface AppState {
  theme: Theme;
  haptics: boolean;
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
      version: 4,
      migrate: migrateApp,
      onRehydrateStorage: () => (state) => {
        if (state) setHapticsEnabled(state.haptics);
      },
    },
  ),
);

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
  return state as AppState;
}

/**
 * Ob die Spicy-Karten eines Spiels im Stapel liegen. Auch ausserhalb von React
 * nutzbar – der Reducer läuft beim Host und braucht denselben Wert.
 */
export function isSpicyOn(gameId: string): boolean {
  return useApp.getState().spicy[gameId] === true;
}
