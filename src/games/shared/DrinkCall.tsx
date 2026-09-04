import { Icon } from '../../components/icons';
import { CountUp } from './pieces';
import { Avatar } from '../../components/ui/Avatar';
import { useState } from 'react';
import { haptic } from '../../lib/haptics';
import { useParty } from '../../features/party/PartyContext';
import { useSipsForPlayer } from '../../features/party/sips';
import type { GamePlayer } from '../types';
import type { OverSeverity } from '../../engine/types';

/** Schlagwort je Stufe über dem Ziel – statt immer nur „Aussetzen". */
const OVER_LABEL: Record<OverSeverity, string> = {
  water: 'Wasser',
  pause: 'Pause',
  stop: 'Stopp',
  danger: 'Gefahr',
};

interface Props {
  player: GamePlayer;
  baseSips: number;
  label?: string;
  source?: string;
  compact?: boolean;
  /**
   * Kennung der aktuellen Ansage (Karte, Runde, Wurf ...). Wechselt sie, wird
   * der "Eingetragen"-Zustand zurueckgesetzt. Ohne sie bliebe der Button nach
   * dem ersten Tippen fuer den Rest des Spiels gesperrt, weil React die
   * Komponente ueber Kartenwechsel hinweg wiederverwendet.
   */
  resetKey?: string | number;
}

/**
 * Zeigt die persönliche Trinkansage. Jeder Spieler sieht nur seine eigene
 * Zahl – auf dem eigenen Gerät berechnet, aus den eigenen Körperdaten.
 */
export function DrinkCall({ player, baseSips, label, source, compact, resetKey }: Props) {
  const { logSipsFor, me } = useParty();
  const res = useSipsForPlayer(player, baseSips);
  // Nach dem Eintragen wird die Zahl eingefroren. Sonst rechnet
  // useSipsForPlayer sofort mit dem frischen Log neu und die Karte zeigt
  // plötzlich eine andere Menge an, als der Spieler gerade getrunken hat.
  const [confirmed, setConfirmed] = useState<{
    key: string | number;
    sips: number;
    unit: string;
  } | null>(null);
  const round = resetKey ?? '';
  const done = confirmed !== null && confirmed.key === round;
  const mine = player.id === me.id;

  const confirm = () => {
    if (!res) return;
    haptic('success');
    logSipsFor(player.id, res.sips, source);
    setConfirmed({ key: round, sips: res.sips, unit: res.unit });
  };

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

  const shownSips = done ? confirmed.sips : res.sips;
  const shownUnit = done ? confirmed.unit : res.unit;

  if (shownSips === 0) {
    const severity = res.phase === 'over' ? res.severity : undefined;
    return (
      <div
        className={`call call--skip ${severity ? `call--${severity}` : ''} ${compact ? 'call--compact' : ''}`}
      >
        <div className="call__who">
          <Avatar name={player.name} color={player.color} size="sm" /> {mine ? 'Du' : player.name}
        </div>
        <div className="call__big">
          {res.phase === 'blocked' ? 'Aufgabe' : severity ? OVER_LABEL[severity] : 'Aussetzen'}
        </div>
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
          <CountUp value={shownSips} />
          <span className="callrow__unit">{shownUnit}</span>
        </span>
        <button
          className={`btn btn--sm ${done ? 'btn--gray' : 'btn--tinted'}`}
          style={{ ['--tint' as string]: 'var(--accent, var(--green))' }}
          disabled={done}
          aria-label={`${player.name} hat getrunken`}
          onClick={confirm}
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
        <CountUp value={shownSips} /> <span className="call__unit">{shownUnit}</span>
      </div>
      <div className="t-caption">{res.hint}</div>
      <button
        className={`btn btn--sm ${done ? 'btn--gray' : 'btn--tinted'}`}
        style={{ ['--tint' as string]: 'var(--accent, var(--green))' }}
        disabled={done}
        onClick={confirm}
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
  resetKey,
}: {
  players: GamePlayer[];
  baseSips: number;
  source?: string;
  label?: string;
  resetKey?: string | number;
}) {
  const { me } = useParty();
  const known = players.filter((p) => p.id === me.id || p.local);
  const unknown = players.filter((p) => p.id !== me.id && !p.local);
  return (
    <div className="stack-3">
      {known.map((p) => (
        <DrinkCall
          key={p.id}
          player={p}
          baseSips={baseSips}
          source={source}
          label={label}
          resetKey={resetKey}
          compact
        />
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
