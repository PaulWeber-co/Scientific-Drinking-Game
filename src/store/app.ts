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

  setTheme: (t: Theme) => void;
  toggleHaptics: () => void;
  toggleWaterReminder: () => void;
  acceptDisclaimer: () => void;
  setLastLobbyCode: (c: string | null) => void;
  markGamePlayed: (id: string) => void;
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
    }),
    {
      name: 'sdg.app',
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) setHapticsEnabled(state.haptics);
      },
    },
  ),
);
