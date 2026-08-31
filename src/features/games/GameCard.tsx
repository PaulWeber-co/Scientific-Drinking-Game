import { TAG_ICON, TAG_LABEL, type GameDefinition } from '../../games/types';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';

export function GameCard({
  game,
  onClick,
  disabledReason,
}: {
  game: GameDefinition;
  onClick: () => void;
  disabledReason?: string;
}) {
  return (
    <button
      className={`gamecard pressable ${disabledReason ? 'gamecard--off' : ''}`}
      style={{ ['--accent' as string]: game.accent }}
      onClick={() => {
        if (disabledReason) return;
        haptic('select');
        onClick();
      }}
      aria-disabled={!!disabledReason}
    >
      <div className="gamecard__glow" />
      <div className="gamecard__icon">
        <Icon name={game.icon} size={24} />
      </div>
      <div className="grow">
        <div className="t-headline">{game.name}</div>
        <div className="t-caption">{disabledReason ?? game.tagline}</div>
        <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
          <span className="chip chip--outline">
            <Icon name="people" size={13} />
            {game.minPlayers}–{game.maxPlayers}
          </span>
          <span className="chip chip--outline">{game.duration}</span>
          {game.tags.slice(0, 2).map((t) => (
            <span key={t} className="chip chip--outline">
              <Icon name={TAG_ICON[t]} size={13} />
              {TAG_LABEL[t]}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
