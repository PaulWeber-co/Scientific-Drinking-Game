import type { GameTag } from '../types';
import type { IconName } from '../../components/icons';

export type Heat = 1 | 2 | 3;

export interface CardDef {
  text: string;
  /** Zu welchem Modus die Karte gehört (z. B. "wahrheit" / "pflicht"). */
  mode?: string;
  /** 1 = harmlos, 2 = mittel, 3 = eskaliert. */
  heat?: Heat;
  /** Wer trinkt: der Spieler am Zug oder alle. Default: aus der Config. */
  target?: 'actor' | 'all';
  /** Überschreibt die Basis-Härte für diese Karte. */
  sips?: number;
  kicker?: string;
  /** Vom Nutzer selbst angelegt. */
  custom?: boolean;
}

export interface CardGameConfig {
  id: string;
  name: string;
  tagline: string;
  icon: IconName;
  accent: string;
  minPlayers: number;
  maxPlayers: number;
  duration: string;
  intensity: Heat;
  tags: GameTag[];
  howTo: string[];
  /** 'turn' = es gibt einen Spieler am Zug, 'none' = die Karte gilt für die Runde. */
  actor: 'turn' | 'none';
  /** Auswahl vor dem Ziehen, z. B. Wahrheit oder Pflicht. */
  modes?: { id: string; label: string; icon?: IconName; tone?: string }[];
  /** Standard-Härte der Trinkansage. */
  baseSips: number;
  /** Wer trinkt, wenn die Karte einfach erledigt wird. */
  drink: 'actor' | 'all' | 'none' | 'self-declare';
  resolveLabel?: string;
  /** Wenn gesetzt: der Spieler darf kneifen und trinkt stattdessen. */
  refuseLabel?: string;
  refuseSips?: number;
  cards: CardDef[];
  /** Blendet den Härtegrad-Regler ein. */
  heatSelectable?: boolean;
  /** Erlaubt eigene Karten über das Spieldetail. */
  allowCustomCards?: boolean;
}

export interface CardGameState {
  order: string[];
  turnIndex: number;
  round: number;
  heat: Heat;
  /** Der Stapel liegt als Inhalt im Zustand, nicht als Index – sonst würden
   *  eigene Karten die Nummerierung zwischen den Geräten verschieben. */
  deck: CardDef[];
  drawn: CardDef | null;
  mode: string | null;
  phase: 'choose' | 'card' | 'resolved';
  outcome: 'done' | 'refused' | null;
}
