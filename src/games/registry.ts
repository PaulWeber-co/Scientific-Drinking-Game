import type { GameDefinition } from './types';
import { truthOrDare } from './truth-or-dare';
import { neverHaveIEver } from './never-have-i-ever';
import { chaosRoulette } from './chaos-roulette';
import { kingsCup } from './kings-cup';
import { busfahrer } from './busfahrer';
import { wortbombe } from './wortbombe';
import { tabu } from './tabu';
import { memeBattle } from './meme-battle';
import { topTen } from './top-ten';
import { undercover } from './undercover';
import { mostLikely } from './most-likely';
import { schaetzfrage } from './schaetzfrage';
import { zweiWahrheiten } from './zwei-wahrheiten';
import { maexchen } from './maexchen';
import { duell } from './duell';
import { kategorien } from './kategorien';
import { ersteZeile } from './erste-zeile';

/**
 * Zentrale Spiele-Registry.
 *
 * Neues Spiel hinzufügen:
 *   1. Ordner unter src/games/<id>/ anlegen.
 *   2. Eine GameDefinition exportieren – entweder komplett selbst gebaut
 *      (siehe kings-cup) oder per createCardGame() aus einer Kartenliste
 *      (siehe truth-or-dare). Für reine Kartenspiele ist das eine Datei.
 *   3. Hier importieren und in GAMES eintragen. Fertig – die Übersicht,
 *      die Filter, die Lobby und der Spielbildschirm ziehen sich alles
 *      Weitere aus der Definition.
 */
export const GAMES: GameDefinition[] = [
  truthOrDare,
  neverHaveIEver,
  mostLikely,
  undercover,
  kingsCup,
  chaosRoulette,
  wortbombe,
  duell,
  tabu,
  memeBattle,
  schaetzfrage,
  zweiWahrheiten,
  topTen,
  maexchen,
  busfahrer,
  kategorien,
  ersteZeile,
];

const INDEX = new Map(GAMES.map((g) => [g.id, g]));

export function getGame(id: string): GameDefinition | null {
  return INDEX.get(id) ?? null;
}

/** Spiele, die zur aktuellen Runde passen. */
export function gamesForGroup(playerCount: number, ownDevices: boolean): GameDefinition[] {
  return GAMES.filter(
    (g) =>
      playerCount >= g.minPlayers &&
      playerCount <= g.maxPlayers &&
      (ownDevices || !g.requiresOwnDevice),
  );
}
