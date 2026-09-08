import type { GameMeta } from '../../games/types';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';

/**
 * Eine Kachel im Spieleraster: Bild, Titel, Spielerzahl. Mehr nicht –
 * was das Spiel ist, erzählt das Motiv, nicht ein Erklärsatz.
 *
 * Solange kein Bild hinterlegt ist, trägt die Kachel den Verlauf der
 * Akzentfarbe und das Spiel-Icon als Wasserzeichen. Das ist der Zustand,
 * in dem die App ausgeliefert wird – er soll fertig aussehen, nicht leer.
 */
export function GameCard({
  game,
  onClick,
  dimReason,
}: {
  game: GameMeta;
  onClick: () => void;
  /** Zu wenige Leute für dieses Spiel. Die Kachel bleibt tippbar – warum,
      erklärt die Spielseite; eine gesperrte Kachel erklärt gar nichts. */
  dimReason?: string;
}) {
  return (
    <button
      className={`gametile pressable ${dimReason ? 'gametile--dim' : ''}`}
      style={{ ['--accent' as string]: game.accent }}
      onClick={() => {
        haptic('select');
        onClick();
      }}
    >
      {game.image ? (
        <img className="gametile__img" src={game.image} alt="" loading="lazy" />
      ) : (
        <Icon className="gametile__mark" name={game.icon} size={96} strokeWidth={1.2} />
      )}
      <span className="gametile__badge">
        {dimReason ? `ab ${game.minPlayers}` : `${game.minPlayers}–${game.maxPlayers}`}
      </span>
      <span className="gametile__title t-display">{game.name}</span>
    </button>
  );
}
