import type { GameAction, GamePlayer } from '../types';

/**
 * Kommt die Aktion vom Host? Ohne Host-Markierung in der Liste (Reducer-Tests,
 * ältere Aufrufer) gilt jede Aktion als erlaubt – am geteilten Handy ist der
 * Absender ohnehin immer der Host.
 */
export function fromHost(action: GameAction, players: GamePlayer[]): boolean {
  if (!players.some((p) => p.isHost)) return true;
  return players.find((p) => p.id === action.by)?.isHost === true;
}
