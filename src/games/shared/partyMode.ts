import type { GamePlayer } from '../types';

/** Online-Gäste haben auch ohne Host-Eintrag ein ausdrückliches false. */
export function hasOnlineGuests(players: readonly GamePlayer[]): boolean {
  return players.some((player) => player.isHost === false);
}
