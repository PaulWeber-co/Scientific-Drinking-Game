import type { GamePlayer } from '../../games/types';

export function gamePlayersForRound(
  players: GamePlayer[],
  remote: Record<string, { ready?: boolean }>,
): GamePlayer[] {
  return players.map((player) => ({
    ...player,
    online: player.online !== false && remote[player.id]?.ready !== false,
  }));
}
