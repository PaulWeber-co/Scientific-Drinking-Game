import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardDef, Heat } from '../games/card-engine/types';

export interface CustomCard extends CardDef {
  id: string;
}

interface CardsState {
  /** Eigene Karten je Spiel-ID. */
  byGame: Record<string, CustomCard[]>;
  add: (gameId: string, card: Omit<CustomCard, 'id'>) => void;
  remove: (gameId: string, id: string) => void;
  clear: (gameId: string) => void;
}

export const useCustomCards = create<CardsState>()(
  persist(
    (set) => ({
      byGame: {},
      add: (gameId, card) =>
        set((s) => ({
          byGame: {
            ...s.byGame,
            [gameId]: [
              ...(s.byGame[gameId] ?? []),
              { ...card, id: `c_${Date.now().toString(36)}` },
            ],
          },
        })),
      remove: (gameId, id) =>
        set((s) => ({
          byGame: { ...s.byGame, [gameId]: (s.byGame[gameId] ?? []).filter((c) => c.id !== id) },
        })),
      clear: (gameId) => set((s) => ({ byGame: { ...s.byGame, [gameId]: [] } })),
    }),
    { name: 'sdg.cards', version: 1 },
  ),
);

/** Eigene Karten eines Spiels – auch ausserhalb von React nutzbar (Host-Reducer). */
export function customCardsFor(gameId: string): CardDef[] {
  return (useCustomCards.getState().byGame[gameId] ?? []).map(({ id: _id, ...card }) => ({
    ...card,
    custom: true,
  }));
}

export function heatLabel(heat: Heat): string {
  return heat === 1 ? 'harmlos' : heat === 2 ? 'mittel' : 'eskaliert';
}
