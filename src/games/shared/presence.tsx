import type { GameAction, GameActionInput, GamePlayer } from '../types';
import { fromHost } from './host';

export function presentPlayer(players: GamePlayer[], id: string | null | undefined) {
  return players.find((player) => player.id === id && player.online !== false);
}

export function extendOrder(order: string[], players: GamePlayer[]) {
  return [...order, ...players.filter((player) => !order.includes(player.id)).map((player) => player.id)];
}

export function nextPresentId(order: string[], after: string, players: GamePlayer[], wrap = true) {
  const index = order.indexOf(after);
  return order.slice(index + 1).find((id) => presentPlayer(players, id))
    ?? (wrap ? order.slice(0, index).find((id) => presentPlayer(players, id)) : undefined);
}

export function lastAbsentId(order: string[], players: GamePlayer[], pending: (id: string) => boolean) {
  const waiting = order.filter(pending);
  return waiting.every((id) => !presentPlayer(players, id)) ? waiting[0] : undefined;
}

export function playerNames(players: GamePlayer[]) {
  return Object.fromEntries(players.map((player) => [player.id, player.name]));
}

export function waitingNames(ids: string[], players: GamePlayer[], names?: Record<string, string>) {
  return ids.map((id) => {
    const player = players.find((p) => p.id === id);
    const name = player?.name ?? names?.[id] ?? 'Fehlende Person';
    return player && player.online !== false ? name : `${name} (nicht da)`;
  });
}

export function canSkipAbsent(action: GameAction, players: GamePlayer[], id: string | null | undefined) {
  return Boolean(id) && (action.who === undefined || action.who === id)
    && !presentPlayer(players, id)
    && players.some((player) => player.isHost === true)
    && fromHost(action, players);
}

export function AbsentAction({
  id, players, names, isHost, dispatch, continueWithout,
}: {
  id: string | null | undefined;
  players: GamePlayer[];
  names?: Record<string, string>;
  isHost: boolean;
  dispatch: (action: GameActionInput) => void;
  continueWithout?: boolean;
}) {
  if (!id || presentPlayer(players, id)) return null;
  const name = players.find((player) => player.id === id)?.name ?? names?.[id];
  const host = players.find((player) => player.isHost)?.name ?? 'Der Host';
  return isHost ? (
    <button className="btn btn--gray btn--block" onClick={() => dispatch({ type: 'skipAbsent', who: id })}>
      {continueWithout
        ? name ? `Ohne ${name} weiter` : 'Ohne fehlende Person weiter'
        : `${name ?? 'Fehlende Person'} überspringen`}
    </button>
  ) : (
    <p className="t-caption t-center">
      {name ?? 'Eine Person'} ist nicht da – {host} kann {continueWithout
        ? `ohne ${name ?? 'die fehlende Person'} weiter.`
        : 'überspringen.'}
    </p>
  );
}
