import type { GameDefinition, GameMeta } from './types';
import { meta as truthOrDare } from './truth-or-dare/meta';
import { meta as neverHaveIEver } from './never-have-i-ever/meta';
import { meta as mostLikely } from './most-likely/meta';
import { meta as undercover } from './undercover/meta';
import { meta as kingsCup } from './kings-cup/meta';
import { meta as chaosRoulette } from './chaos-roulette/meta';
import { meta as wortbombe } from './wortbombe/meta';
import { meta as duell } from './duell/meta';
import { meta as tabu } from './tabu/meta';
import { meta as memeBattle } from './meme-battle/meta';
import { meta as schaetzfrage } from './schaetzfrage/meta';
import { meta as zweiWahrheiten } from './zwei-wahrheiten/meta';
import { meta as topTen } from './top-ten/meta';
import { meta as maexchen } from './maexchen/meta';
import { meta as busfahrer } from './busfahrer/meta';
import { meta as kategorien } from './kategorien/meta';
import { meta as ersteZeile } from './erste-zeile/meta';

/**
 * Zentrale Spiele-Registry.
 *
 * Die Metadaten (`meta.ts` je Spiel) liegen statisch im Haupt-Bundle:
 * Übersicht, Filter und Lobby brauchen nur die. Logik und Komponente
 * kommen erst per `loadGame()` – jedes Spiel ist ein eigener Chunk, und
 * der Erststart lädt nicht 17 Spiele, von denen man eines spielt.
 *
 * Neues Spiel hinzufügen:
 *   1. Ordner unter src/games/<id>/ anlegen.
 *   2. `meta.ts` mit den Stammdaten (GameMeta) und daneben die
 *      GameDefinition – entweder komplett selbst gebaut (siehe kings-cup)
 *      oder per createCardGame() aus einer Kartenliste (siehe
 *      truth-or-dare). Für reine Kartenspiele sind das zwei kleine Dateien.
 *   3. Hier die `meta` importieren, in GAMES eintragen und den Lader in
 *      LOADERS ergänzen. Fertig – Übersicht, Filter, Lobby und
 *      Spielbildschirm ziehen sich alles Weitere aus der Definition.
 */
export const GAMES: GameMeta[] = [
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

/** Ein literaler import() je Spiel, damit Vite je Spiel einen Chunk baut. */
const LOADERS: Record<string, () => Promise<GameDefinition>> = {
  'truth-or-dare': () => import('./truth-or-dare').then((m) => m.truthOrDare),
  'never-have-i-ever': () => import('./never-have-i-ever').then((m) => m.neverHaveIEver),
  'most-likely': () => import('./most-likely').then((m) => m.mostLikely),
  'undercover': () => import('./undercover').then((m) => m.undercover),
  'kings-cup': () => import('./kings-cup').then((m) => m.kingsCup),
  'chaos-roulette': () => import('./chaos-roulette').then((m) => m.chaosRoulette),
  'wortbombe': () => import('./wortbombe').then((m) => m.wortbombe),
  'duell': () => import('./duell').then((m) => m.duell),
  'tabu': () => import('./tabu').then((m) => m.tabu),
  'meme-battle': () => import('./meme-battle').then((m) => m.memeBattle),
  'schaetzfrage': () => import('./schaetzfrage').then((m) => m.schaetzfrage),
  'zwei-wahrheiten': () => import('./zwei-wahrheiten').then((m) => m.zweiWahrheiten),
  'top-ten': () => import('./top-ten').then((m) => m.topTen),
  'maexchen': () => import('./maexchen').then((m) => m.maexchen),
  'busfahrer': () => import('./busfahrer').then((m) => m.busfahrer),
  'kategorien': () => import('./kategorien').then((m) => m.kategorien),
  'erste-zeile': () => import('./erste-zeile').then((m) => m.ersteZeile),
};

const INDEX = new Map(GAMES.map((g) => [g.id, g]));
const loaded = new Map<string, GameDefinition>();
const pending = new Map<string, Promise<GameDefinition>>();

/** Stammdaten eines Spiels – synchron, immer verfügbar. */
export function getGame(id: string): GameMeta | null {
  return INDEX.get(id) ?? null;
}

/**
 * Die vollständige Definition, falls das Modul schon geladen ist. Für die
 * synchronen Pfade (Host-Reducer): `startGame` lädt vorher, und der
 * PartyProvider lädt nach, sobald eine Runde einen Spiel-Slug zeigt.
 */
export function getLoadedGame(id: string): GameDefinition | null {
  return loaded.get(id) ?? null;
}

/** Lädt das Spielmodul nach – idempotent, ein Chunk pro Spiel. */
export function loadGame(id: string): Promise<GameDefinition> {
  const done = loaded.get(id);
  if (done) return Promise.resolve(done);
  const running = pending.get(id);
  if (running) return running;
  const loader = LOADERS[id];
  if (!loader) return Promise.reject(new Error(`Unbekanntes Spiel: ${id}`));
  const promise = loader()
    .then((def) => {
      loaded.set(id, def);
      return def;
    })
    .finally(() => pending.delete(id));
  pending.set(id, promise);
  return promise;
}

/** Spiele, die zur aktuellen Runde passen. */
export function gamesForGroup(playerCount: number, ownDevices: boolean): GameMeta[] {
  return GAMES.filter(
    (g) =>
      playerCount >= g.minPlayers &&
      playerCount <= g.maxPlayers &&
      (ownDevices || !g.requiresOwnDevice),
  );
}
