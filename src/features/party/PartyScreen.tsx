import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGame } from '../../games/registry';
import { useLoadedGame } from '../../games/useLoadedGame';
import { useParty } from './PartyContext';

/** Rendert das gerade laufende Spiel aus der Registry. */
export function PartyScreen() {
  const nav = useNavigate();
  const party = useParty();
  const known = party.gameId ? getGame(party.gameId) : null;
  // Das Modul kommt als eigener Chunk – bis dahin dreht der Spinner.
  const { def, error } = useLoadedGame(known ? known.id : null);
  // Dreht er zu lange (kein Netz, Chunk fehlt), gibt es einen Ausweg.
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!known || party.status !== 'playing') nav('/lobby', { replace: true });
  }, [known, party.status, nav]);

  useEffect(() => {
    if (def) return;
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [def]);

  if (!def || party.status !== 'playing' || party.gameState == null) {
    const stuck = !def && (error || slow);
    return (
      <div className="screen center" style={{ minHeight: '60vh' }}>
        {stuck ? (
          <div className="stack-3" style={{ textAlign: 'center' }}>
            <div className="t-headline">Spiel lädt nicht.</div>
            <div className="t-sub t-balance">
              Kein Netz? Die Runde wartet in der Lobby, versuch es von dort noch einmal.
            </div>
            <button
              className="btn btn--glass"
              onClick={() => {
                if (party.isHost) party.endGame();
                nav('/lobby', { replace: true });
              }}
            >
              Zurück zur Lobby
            </button>
          </div>
        ) : (
          <div className="spinner" />
        )}
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
