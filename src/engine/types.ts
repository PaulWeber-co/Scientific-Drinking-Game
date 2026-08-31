import type { AvatarColor } from '../components/ui/Avatar';
import type { IconName } from '../components/icons';

export type Sex = 'male' | 'female' | 'diverse';

/** Wie voll der Magen ist – steuert die Resorptionsgeschwindigkeit. */
export type StomachState = 'empty' | 'light' | 'full';

export type DrinkCategory = 'beer' | 'wine' | 'sparkling' | 'cocktail' | 'longdrink' | 'spirit' | 'soft';

export interface DrinkDefinition {
  id: string;
  name: string;
  category: DrinkCategory;
  icon: IconName;
  /** Uebliche Gebindegröße in ml (nur für die Anzeige "1 Glas = x Schluck"). */
  defaultVolumeMl: number;
  abvPercent: number;
  /** Realistische Schluckgröße in ml. Bei Shots = ganzes Glas. */
  sipSizeMl: number;
  /** true = "Schluck" heißt hier "Shot" / ganzes Glas. */
  sipIsUnit?: boolean;
  custom?: boolean;
}

export interface Profile {
  name: string;
  /** Avatarfarbe – die Initialen kommen aus dem Namen. */
  color: AvatarColor;
  age: number;
  weightKg: number;
  /** Optional – schaltet die präzisere Watson-Schätzung frei. */
  heightCm?: number;
  sex: Sex;
  stomach: StomachState;
  /** Ziel-Blutalkohol in Promille. Default 0.4. */
  targetBac: number;
  /** Spieler trinkt bewusst keinen Alkohol (U18, Pause, eigener Wunsch). */
  alcoholFree: boolean;
  /** Übernimmt heute den Heimweg – impliziert alkoholfrei und ist für die
   *  Runde sichtbar, damit niemand nachschenkt. */
  designatedDriver: boolean;
}

export interface DrinkEvent {
  id: string;
  /** Zeitstempel in ms (Date.now()). */
  at: number;
  drinkId: string;
  drinkName: string;
  sips: number;
  /** Reiner Alkohol in Gramm, der zu diesem Zeitpunkt konsumiert wurde. */
  alcoholGrams: number;
  /** Optional: welches Spiel den Schluck ausgelöst hat. */
  source?: string;
}

export interface BacEstimate {
  /** Aktuell im Blut wirksame Promille. */
  bac: number;
  /** Promille, die noch im Magen "warten" und sicher noch kommen. */
  pending: number;
  /** bac + pending – die Größe, gegen die dosiert wird. */
  effective: number;
  /** Gesamter konsumierter reiner Alkohol in Gramm. */
  totalAlcoholGrams: number;
  /** Widmark-Verteilungsfaktor r, der verwendet wurde. */
  r: number;
  /** Wie r bestimmt wurde. */
  rSource: 'watson' | 'standard';
}

export type BacZone = 'sober' | 'warmup' | 'sweet' | 'edge' | 'over';

export type SipPhase = 'reaching' | 'maintaining' | 'over' | 'blocked';

export interface SipResult {
  /** Wie viele Schlucke dieser Spieler jetzt wirklich trinken soll. */
  sips: number;
  phase: SipPhase;
  /** Kurzer Erklärtext für die UI. */
  hint: string;
  /** "Schluck"/"Schlucke" oder "Shot"/"Shots". */
  unit: string;
  /** Alkohol in g, den diese Ansage bedeutet. */
  alcoholGrams: number;
}
