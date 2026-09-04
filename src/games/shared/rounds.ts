import { useApp, type GameLength } from '../../store/app';

/**
 * Wie viele Runden ein Spiel laufen soll.
 *
 * Jedes Spiel nennt seine eigene Basis – das ist die Rundenzahl, bei der es
 * sich bei „mittel" rund anfühlt. Ein Reaktionsduell braucht mehr Durchgänge
 * als Tabu. Die Einstellung skaliert diese Basis, statt allen Spielen dieselbe
 * Zahl aufzuzwingen.
 *
 * `null` heißt: kein Abschluss, das Spiel läuft, bis jemand es beendet.
 */
const FACTOR: Record<Exclude<GameLength, 'endlos'>, number> = {
  kurz: 0.6,
  mittel: 1,
  lang: 1.6,
};

/**
 * Basis-Rundenzahl je Spiel: so viele Runden fuehlen sich auf Stufe „mittel"
 * rund an. Hier zusammen, damit die Werte vergleichbar bleiben und die
 * Spieldetail-Seite die konkrete Zahl nennen kann, bevor gestartet wird.
 * Eine Runde heisst je Spiel etwas anderes – bei Tabu sind es Runden PRO TEAM,
 * bei den Kartenspielen ein voller Durchlauf durch die Gruppe.
 */
export const ROUND_BASES: Record<string, number> = {
  busfahrer: 3,
  // Beide Teams zusammen: sechs Runden sind drei pro Team. Die Zahl meint
  // immer die ganze Partie, sonst zeigt die Vorschau im Spieldetail die
  // Haelfte dessen, was die Partie dann wirklich laeuft.
  tabu: 6,
  undercover: 4,
  'truth-or-dare': 4,
  'never-have-i-ever': 4,
  'chaos-roulette': 4,
  kategorien: 4,
  'erste-zeile': 4,
  'zwei-wahrheiten': 5,
  'meme-battle': 5,
  duell: 6,
  'most-likely': 6,
  schaetzfrage: 6,
  'top-ten': 6,
  maexchen: 8,
  wortbombe: 8,
  'kings-cup': 0,
};

/** Basis eines Spiels; 0 heisst: das Spiel endet nicht ueber Runden. */
export function baseFor(gameId: string): number {
  return ROUND_BASES[gameId] ?? 5;
}

export const LENGTH_LABEL: Record<GameLength, string> = {
  kurz: 'Kurz',
  mittel: 'Mittel',
  lang: 'Lang',
  endlos: 'Ohne Ende',
};

/**
 * Läuft im Reducer beim Host, deshalb Store-Zugriff außerhalb von React –
 * dasselbe Muster wie `isSpicyOn`. Das Ergebnis wandert in den Spielstand,
 * damit alle Geräte dieselbe Ziellinie sehen.
 */
export function roundGoal(base: number, length = useApp.getState().gameLength): number | null {
  if (length === 'endlos') return null;
  return Math.max(2, Math.round(base * FACTOR[length]));
}

/** Ist die Ziellinie erreicht? `goal === null` heißt: nie. */
export function isOver(round: number, goal: number | null | undefined): boolean {
  return typeof goal === 'number' && round > goal;
}
