import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setHapticsEnabled } from '../lib/haptics';

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

  setTheme: (t: Theme) => void;
  toggleHaptics: () => void;
  toggleWaterReminder: () => void;
  acceptDisclaimer: () => void;
  setLastLobbyCode: (c: string | null) => void;
  markGamePlayed: (id: string) => void;
  toggleSpicy: (id: string) => void;
  setGameLength: (l: GameLength) => void;
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
      setGameLength: (gameLength) => set({ gameLength }),
    }),
    {
      name: 'sdg.app',
      version: 3,
      // v2 kannte noch keine Spiellänge – bestehende Installationen bekommen
      // die Voreinstellung, statt mit undefined in die Rundenrechnung zu gehen.
      migrate: (persisted, version) => {
        const state = persisted as Partial<AppState>;
        if (version < 3) state.gameLength = 'mittel';
        return state as AppState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) setHapticsEnabled(state.haptics);
      },
    },
  ),
);

/**
 * Ob die Spicy-Karten eines Spiels im Stapel liegen. Auch ausserhalb von React
 * nutzbar – der Reducer läuft beim Host und braucht denselben Wert.
 */
export function isSpicyOn(gameId: string): boolean {
  return useApp.getState().spicy[gameId] === true;
}
