import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGame } from '../../games/registry';
import { useParty } from './PartyContext';

/** Rendert das gerade laufende Spiel aus der Registry. */
export function PartyScreen() {
  const nav = useNavigate();
  const party = useParty();
  const def = party.gameId ? getGame(party.gameId) : null;

  useEffect(() => {
    if (!def || party.status !== 'playing') nav('/lobby', { replace: true });
  }, [def, party.status, nav]);

  if (!def || party.status !== 'playing' || party.gameState == null) {
    return (
      <div className="screen center" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const Game = def.Component;
  return (
    <Game
      state={party.gameState}
      players={party.players}
      me={party.me}
      isHost={party.isHost}
      online={party.mode === 'online'}
      dispatch={party.dispatch}
      quit={() => {
        party.endGame();
        nav('/lobby', { replace: true });
      }}
    />
  );
}
