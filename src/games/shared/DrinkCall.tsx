import { Icon } from '../../components/icons';
import { CountUp } from './pieces';
import { Avatar } from '../../components/ui/Avatar';
import { useState } from 'react';
import { haptic } from '../../lib/haptics';
import { useParty } from '../../features/party/PartyContext';
import { useSipsForPlayer } from '../../features/party/sips';
import type { GamePlayer } from '../types';

interface Props {
  player: GamePlayer;
  baseSips: number;
  label?: string;
  source?: string;
  compact?: boolean;
}

/**
 * Zeigt die persönliche Trinkansage. Jeder Spieler sieht nur seine eigene
 * Zahl – auf dem eigenen Gerät berechnet, aus den eigenen Körperdaten.
 */
export function DrinkCall({ player, baseSips, label, source, compact }: Props) {
  const { logSipsFor, me } = useParty();
  const res = useSipsForPlayer(player, baseSips);
  const [done, setDone] = useState(false);
  const mine = player.id === me.id;

  if (!res) {
    return (
      <div className={`call call--muted ${compact ? 'call--compact' : ''}`}>
        <div className="call__who">
          <Avatar name={player.name} color={player.color} size="sm" /> {player.name}
        </div>
        <div className="t-sub">sieht seine Menge auf dem eigenen Handy</div>
      </div>
    );
  }

  if (res.sips === 0) {
    return (
      <div className={`call call--skip ${compact ? 'call--compact' : ''}`}>
        <div className="call__who">
          <Avatar name={player.name} color={player.color} size="sm" /> {mine ? 'Du' : player.name}
        </div>
        <div className="call__big">{res.phase === 'blocked' ? 'Aufgabe' : 'Aussetzen'}</div>
        <div className="t-sub t-balance">{res.hint}</div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`callrow ${done ? 'call--done' : ''}`}>
        <Avatar name={player.name} color={player.color} size="sm" />
        <span className="grow">
          <span className="callrow__name">{mine ? 'Du' : player.name}</span>
          {label && <span className="t-caption"> · {label}</span>}
        </span>
        <span className="callrow__num t-mono-num">
          <CountUp value={res.sips} />
          <span className="callrow__unit">{res.unit}</span>
        </span>
        <button
          className={`btn btn--sm ${done ? 'btn--gray' : 'btn--tinted'}`}
          style={{ ['--tint' as string]: 'var(--accent, var(--green))' }}
          disabled={done}
          aria-label={`${player.name} hat getrunken`}
          onClick={() => {
            haptic('success');
            logSipsFor(player.id, res.sips, source);
            setDone(true);
          }}
        >
          <Icon name="check" size={16} strokeWidth={2.2} />
        </button>
      </div>
    );
  }

  return (
    <div className={`call ${done ? 'call--done' : ''}`}>
      <div className="call__who">
        <Avatar name={player.name} color={player.color} size="sm" /> {mine ? 'Du' : player.name}
        {label && <span className="t-caption"> · {label}</span>}
      </div>
      <div className="call__big t-mono-num">
        <CountUp value={res.sips} /> <span className="call__unit">{res.unit}</span>
      </div>
      <div className="t-caption">{res.hint}</div>
      <button
        className={`btn btn--sm ${done ? 'btn--gray' : 'btn--tinted'}`}
        style={{ ['--tint' as string]: 'var(--accent, var(--green))' }}
        disabled={done}
        onClick={() => {
          haptic('success');
          logSipsFor(player.id, res.sips, source);
          setDone(true);
        }}
      >
        {done ? (
          <>
            <Icon name="check" size={16} strokeWidth={2.2} /> Eingetragen
          </>
        ) : (
          'Getrunken'
        )}
      </button>
    </div>
  );
}

/** Trinkansage für eine Gruppe von Spielern. */
export function DrinkCallList({
  players,
  baseSips,
  source,
  label,
}: {
  players: GamePlayer[];
  baseSips: number;
  source?: string;
  label?: string;
}) {
  const { me } = useParty();
  const known = players.filter((p) => p.id === me.id || p.local);
  const unknown = players.filter((p) => p.id !== me.id && !p.local);
  return (
    <div className="stack-3">
      {known.map((p) => (
        <DrinkCall key={p.id} player={p} baseSips={baseSips} source={source} label={label} compact />
      ))}
      {unknown.length > 0 && (
        <div className="t-caption t-center">
          {unknown.map((p) => p.name).join(', ')} {unknown.length === 1 ? 'sieht' : 'sehen'} die
          eigene Menge auf dem eigenen Handy.
        </div>
      )}
    </div>
  );
}
