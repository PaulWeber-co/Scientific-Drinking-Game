import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_TARGET_BAC } from '../engine/constants';
import { findDrink } from '../engine/drinks';
import { nightPeak, soberAt } from '../engine/bac';
import { makeDrinkEvent } from '../engine/sips';
import { useNights } from './nights';
import { useFilm } from './film';
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
  /**
   * Wann zuletzt gefragt wurde, was vor dem Start schon getrunken war.
   * `null` heißt: diesen Abend noch nicht gefragt. Ohne diesen Startwert
   * rechnet die Promille-Schätzung mit einem Nullpunkt, den es nie gab.
   */
  preloadAskedAt: number | null;

  setProfile: (p: Profile) => void;
  patchProfile: (p: Partial<Profile>) => void;
  completeOnboarding: (p: Profile, drinkId: string) => void;
  setDrink: (id: string) => void;
  addCustomDrink: (d: DrinkDefinition) => void;
  removeCustomDrink: (id: string) => void;
  logSips: (sips: number, source?: string, drink?: DrinkDefinition) => void;
  logEvent: (e: DrinkEvent) => void;
  undoLast: () => void;
  /** Nimmt einen bestimmten Eintrag heraus – nicht nur den letzten. */
  removeEvent: (id: string) => void;
  addWater: () => void;
  /** Merkt, dass die Frage nach dem Vorglühen gestellt wurde. */
  markPreloadAsked: () => void;
  /** Startet den Abend ohne Trink-Ereignis – etwa wenn ein Spiel losgeht. */
  beginNight: () => void;
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
      preloadAskedAt: null,

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
      removeEvent: (id) => set((s) => ({ log: s.log.filter((e) => e.id !== id) })),
      addWater: () => set((s) => ({ waterCount: s.waterCount + 1 })),
      markPreloadAsked: () => set({ preloadAskedAt: Date.now() }),
      beginNight: () =>
        set((s) => (s.nightStartedAt ? s : { nightStartedAt: Date.now() })),

      // Der Abend wird archiviert, nicht weggeworfen. Diese eine Stelle
      // deckt ALLE drei Wege ab, auf denen ein Abend endet: der Knopf im
      // Rückblick, die 14-Stunden-Automatik unten, und `resetAll`.
      endNight: () => {
        const s = get();
        if (s.nightStartedAt) {
          const at = Date.now();
          const peak = s.profile
            ? nightPeak(s.log, s.profile, at)
            : { peakBac: 0, peakAt: s.nightStartedAt };
          const nightId = useNights.getState().archive({
            startedAt: s.nightStartedAt,
            endedAt: at,
            log: s.log,
            waterCount: s.waterCount,
            ...peak,
            soberAt: s.profile ? soberAt(s.log, s.profile, at) : at,
          });
          // Die Bilder des Abends bekommen jetzt ihre Zuordnung, und der
          // nächste Abend fängt mit frischem Film an.
          useFilm.getState().assignNight(nightId);
          useFilm.getState().resetRoll();
        }
        set({ log: [], nightStartedAt: null, waterCount: 0, preloadAskedAt: null });
      },
      resetAll: () => {
        useNights.getState().clearAll();
        useFilm.getState().clearAll();
        set({
          profile: null,
          onboarded: false,
          log: [],
          nightStartedAt: null,
          waterCount: 0,
          preloadAskedAt: null,
          customDrinks: [],
          currentDrinkId: 'beer-pils',
        });
      },
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
      onRehydrateStorage: () => (state) => closeStaleNight(state),
    },
  ),
);

/**
 * Schließt eine abgelaufene Nacht beim Start der App.
 *
 * Sonst rechnet der Restalkohol-Rechner mit Daten von vorletzter Woche.
 * Der Abend geht dabei nicht verloren – `endNight` archiviert ihn.
 *
 * Exportiert, damit ein Test diesen Weg prüfen kann, ohne den Store neu
 * zu laden: es ist der einzige der drei Abschluss-Wege ohne Knopf.
 */
export function closeStaleNight(state: PlayerState | undefined, now = Date.now()): void {
  if (!state?.nightStartedAt) return;
  if (now - state.nightStartedAt > NIGHT_MS) state.endNight();
}

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
