import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/icons';
import { Avatar } from '../../components/ui/Avatar';
import { haptic } from '../../lib/haptics';
import { getGame } from '../../games/registry';
import { TAG_ICON, TAG_LABEL } from '../../games/types';
import { useParty } from './PartyContext';

/**
 * Wenn jemand in der Lobby eine Runde startet, sollen die anderen nicht selbst
 * suchen müssen: Einladung rein, annehmen, drin. Wer ablehnt, bekommt unten
 * eine schmale Leiste und kann jederzeit nachrücken.
 */
export function GameInvite() {
  const party = useParty();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const buzzed = useRef<string | null>(null);

  const running = party.mode === 'online' && party.status === 'playing' && party.gameId;
  const game = running ? getGame(party.gameId!) : null;
  const startedByMe = party.startedBy === party.me.id;
  const host = party.players.find((p) => p.id === party.startedBy);
  // Eine Einladung pro Runde: der Zeitstempel macht sie eindeutig.
  const key = running ? `${party.gameId}-${party.startedAt}` : null;

  useEffect(() => {
    if (!key || startedByMe) return;
    if (buzzed.current === key) return;
    buzzed.current = key;
    haptic('success');
  }, [key, startedByMe]);

  if (!game || !key || startedByMe || pathname === '/spiel') return null;

  const join = () => {
    haptic('select');
    nav('/spiel');
  };

  if (dismissed === key) {
    return (
      <button className="joinbar" onClick={join}>
        <span className="joinbar__dot" />
        <span className="grow">{game.name} läuft</span>
        <span className="joinbar__cta">
          Mitspielen <Icon name="chevronRight" size={15} />
        </span>
      </button>
    );
  }

  return (
    <div className="invite-backdrop" role="dialog" aria-modal="true" aria-label="Spieleinladung">
      <div className="invite" style={{ ['--accent' as string]: game.accent }}>
        <div className="invite__icon">
          <Icon name={game.icon} size={30} strokeWidth={1.5} />
        </div>
        <div className="invite__who">
          {host && <Avatar name={host.name} color={host.color} size="sm" />}
          <span>{host ? `${host.name} hat gestartet` : 'Die Runde hat gestartet'}</span>
        </div>
        <h2 className="t-title t-balance">{game.name}</h2>
        <p className="t-sub t-balance">{game.tagline}</p>
        <div className="row wrap" style={{ justifyContent: 'center', gap: 6 }}>
          <span className="chip chip--outline">
            <Icon name="clock" size={13} />
            {game.duration}
          </span>
          {game.tags.slice(0, 2).map((t) => (
            <span key={t} className="chip chip--outline">
              <Icon name={TAG_ICON[t]} size={13} />
              {TAG_LABEL[t]}
            </span>
          ))}
        </div>
        <div className="stack-2" style={{ width: '100%' }}>
          <button className="btn btn--brand btn--block btn--lg" onClick={join}>
            Mitspielen
          </button>
          <button className="btn btn--plain btn--block" onClick={() => setDismissed(key)}>
            Später
          </button>
        </div>
      </div>
    </div>
  );
}
