import { describe, expect, it } from 'vitest';
import { gamePlayersForRound } from './roundPlayers';

describe('Spieler einer Runde', () => {
  it('berücksichtigt Teilnahme und Verbindung getrennt von der Lobby', () => {
    const players = [
      { id: 'a', name: 'A', color: 'blue' as const, online: true },
      { id: 'b', name: 'B', color: 'blue' as const, online: true },
      { id: 'c', name: 'C', color: 'blue' as const, online: true },
      { id: 'd', name: 'D', color: 'blue' as const, online: false },
    ];
    const result = gamePlayersForRound(players, {
      b: { ready: false },
      c: { ready: true },
      d: { ready: true },
    });
    expect(result.map((p) => p.online)).toEqual([true, false, true, false]);
    expect(players[1].online).toBe(true);
  });
});
