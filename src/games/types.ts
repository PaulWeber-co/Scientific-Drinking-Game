import type { ComponentType } from 'react';
import type { DrinkEvent, Profile } from '../engine/types';

export interface GamePlayer {
  id: string;
  name: string;
  emoji: string;
  drinkEmoji?: string;
  online?: boolean;
  isHost?: boolean;
  /**
   * Nur im Pass-&-Play-Modus gesetzt: Körperdaten der Mitspieler, die auf
   * diesem einen Gerät mitgeführt werden. Online bleiben diese Daten
   * ausschließlich auf dem jeweils eigenen Gerät.
   */
  local?: { profile: Profile; drinkId: string; log: DrinkEvent[] };
}

/** Was eine Komponente absetzt – der Absender wird von der Runtime ergänzt. */
export interface GameActionInput {
  type: string;
  at?: number;
  [key: string]: unknown;
}

export interface GameAction extends GameActionInput {
  by: string;
}

/** Was ein Spiel an die Trinklogik meldet – nie fertige Schluckzahlen. */
export interface DrinkOrder {
  targets: string[] | 'all';
  /** Härte des Spielzugs. 3 = normal, 1 = mild, 6 = Strafe. */
  baseSips: number;
  label: string;
}

export interface GameRuntime<S = unknown> {
  state: S;
  players: GamePlayer[];
  me: GamePlayer;
  isHost: boolean;
  /** true, wenn jeder Spieler ein eigenes Gerät hat. */
  online: boolean;
  dispatch: (action: GameActionInput) => void;
  /** Spiel beenden und zurück in die Lobby. */
  quit: () => void;
}

export type GameTag =
  | 'handy-weg'
  | 'karten'
  | 'reden'
  | 'kreativ'
  | 'schnell'
  | 'team'
  | 'bewegung'
  | 'geheim';

export const TAG_LABEL: Record<GameTag, string> = {
  'handy-weg': '📵 Handy weg',
  karten: '🃏 Karten',
  reden: '💬 Reden',
  kreativ: '🎨 Kreativ',
  schnell: '⚡️ Schnell',
  team: '🤝 Teams',
  bewegung: '🕺 Bewegung',
  geheim: '🤫 Geheim',
};

/**
 * Ein Spiel = ein Objekt. Neues Spiel hinzufügen heißt:
 * Ordner anlegen, GameDefinition exportieren, eine Zeile in registry.ts.
 */
// Die Registry hält Spiele mit ganz unterschiedlichen State-Typen nebeneinander;
// `unknown` würde jede einzelne Definition unbrauchbar machen.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GameDefinition<S = any> {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  /** CSS-Custom-Property, färbt Karte und Spielbildschirm. */
  accent: string;
  minPlayers: number;
  maxPlayers: number;
  duration: string;
  /** 1 = gemütlich, 2 = normal, 3 = eskaliert. */
  intensity: 1 | 2 | 3;
  tags: GameTag[];
  /** true = jeder braucht sein eigenes Handy (Online-Lobby nötig). */
  requiresOwnDevice: boolean;
  howTo: string[];
  createState: (players: GamePlayer[]) => S;
  /** Läuft nur beim Host. Darf Math.random verwenden. */
  reduce: (state: S, action: GameAction, players: GamePlayer[]) => S;
  Component: ComponentType<GameRuntime<S>>;
}

/** Hilfs-Typ für Spiele, deren State eine Rundenzählung führt. */
export interface TurnState {
  turnIndex: number;
  round: number;
}

export function nextPlayer(players: GamePlayer[], currentId: string | null): string {
  if (!players.length) return '';
  const i = players.findIndex((p) => p.id === currentId);
  return players[(i + 1) % players.length].id;
}
