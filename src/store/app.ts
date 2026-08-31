import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setHapticsEnabled } from '../lib/haptics';

type Theme = 'dark' | 'light';

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

  setTheme: (t: Theme) => void;
  toggleHaptics: () => void;
  toggleWaterReminder: () => void;
  acceptDisclaimer: () => void;
  setLastLobbyCode: (c: string | null) => void;
  markGamePlayed: (id: string) => void;
  toggleSpicy: (id: string) => void;
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
    }),
    {
      name: 'sdg.app',
      version: 2,
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
