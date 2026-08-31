import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_TARGET_BAC } from '../engine/constants';
import { findDrink } from '../engine/drinks';
import { makeDrinkEvent } from '../engine/sips';
import { colorFor } from '../components/ui/Avatar';
import type { DrinkDefinition, DrinkEvent, Profile } from '../engine/types';

interface PlayerState {
  profile: Profile | null;
  onboarded: boolean;
  currentDrinkId: string;
  customDrinks: DrinkDefinition[];
  log: DrinkEvent[];
  /** Beginn des aktuellen Abends – danach wird das Log automatisch geleert. */
  nightStartedAt: number | null;
  /** Gläser Wasser heute Abend – zählt nur, wer will. */
  waterCount: number;

  setProfile: (p: Profile) => void;
  patchProfile: (p: Partial<Profile>) => void;
  completeOnboarding: (p: Profile, drinkId: string) => void;
  setDrink: (id: string) => void;
  addCustomDrink: (d: DrinkDefinition) => void;
  removeCustomDrink: (id: string) => void;
  logSips: (sips: number, source?: string, drink?: DrinkDefinition) => void;
  logEvent: (e: DrinkEvent) => void;
  undoLast: () => void;
  addWater: () => void;
  endNight: () => void;
  resetAll: () => void;
}

/** Ein Abend ist nach 14 Stunden vorbei – danach startet das Log frisch. */
const NIGHT_MS = 14 * 60 * 60 * 1000;

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      profile: null,
      onboarded: false,
      currentDrinkId: 'beer-pils',
      customDrinks: [],
      log: [],
      nightStartedAt: null,
      waterCount: 0,

      setProfile: (profile) => set({ profile }),
      patchProfile: (patch) =>
        set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : s)),
      completeOnboarding: (profile, drinkId) =>
        set({ profile, currentDrinkId: drinkId, onboarded: true }),
      setDrink: (currentDrinkId) => set({ currentDrinkId }),
      addCustomDrink: (d) =>
        set((s) => ({ customDrinks: [...s.customDrinks, d], currentDrinkId: d.id })),
      removeCustomDrink: (id) =>
        set((s) => ({
          customDrinks: s.customDrinks.filter((d) => d.id !== id),
          currentDrinkId: s.currentDrinkId === id ? 'beer-pils' : s.currentDrinkId,
        })),

      logSips: (sips, source, drink) => {
        if (sips <= 0) return;
        const s = get();
        const d = drink ?? findDrink(s.currentDrinkId, s.customDrinks);
        get().logEvent(makeDrinkEvent(d, sips, source));
      },
      logEvent: (e) =>
        set((s) => ({
          log: [...s.log, e],
          nightStartedAt: s.nightStartedAt ?? e.at,
        })),
      undoLast: () => set((s) => ({ log: s.log.slice(0, -1) })),
      addWater: () => set((s) => ({ waterCount: s.waterCount + 1 })),
      endNight: () => set({ log: [], nightStartedAt: null, waterCount: 0 }),
      resetAll: () =>
        set({
          profile: null,
          onboarded: false,
          log: [],
          nightStartedAt: null,
          waterCount: 0,
          customDrinks: [],
          currentDrinkId: 'beer-pils',
        }),
    }),
    {
      name: 'sdg.player',
      version: 3,
      // v1 speicherte ein Emoji als Avatar. Ab v2 sind es Initialen auf einer
      // Farbe – bestehende Profile bekommen eine aus dem Namen abgeleitete.
      migrate: (persisted, version) => {
        const state = persisted as { profile?: (Profile & { emoji?: string }) | null };
        if (version < 2 && state?.profile) {
          const { emoji: _emoji, ...rest } = state.profile;
          state.profile = { ...rest, color: rest.color ?? colorFor(rest.name || 'x') };
        }
        if (version < 3 && state?.profile) {
          state.profile = { ...state.profile, designatedDriver: false };
        }
        return state;
      },
      onRehydrateStorage: () => (state) => {
        // Abgelaufene Nächte automatisch schließen, damit der Restalkohol-
        // Rechner nicht mit Daten von vorletzter Woche rechnet.
        if (!state?.nightStartedAt) return;
        if (Date.now() - state.nightStartedAt > NIGHT_MS) state.endNight();
      },
    },
  ),
);

/** Bequemer Zugriff auf das aktuell gewählte Getränk. */
export function useCurrentDrink(): DrinkDefinition {
  const id = usePlayer((s) => s.currentDrinkId);
  const customs = usePlayer((s) => s.customDrinks);
  return findDrink(id, customs);
}

export function defaultProfile(): Profile {
  return {
    name: '',
    color: 'indigo',
    age: 25,
    weightKg: 75,
    sex: 'male',
    stomach: 'light',
    targetBac: DEFAULT_TARGET_BAC,
    alcoholFree: false,
    designatedDriver: false,
  };
}
