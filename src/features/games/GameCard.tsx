import type { GameMeta } from '../../games/types';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';

/**
 * Eine Kachel im Spieleraster: ein Abzug. Motiv im Papier, Titel als Tinte
 * im unteren Rand, Spielerzahl als Stempel daneben.
 *
 * Der Titel liegt bewusst auf dem Papier und nicht auf dem Foto. Weiße
 * Schrift blieb auf allen zehn Akzentfarben unter dem Kontrastminimum und
 * brauchte einen Schleier – und ein Motiv, dessen untere Hälfte ruhig
 * bleiben muss, ist ein halbes Motiv.
 *
 * Solange kein Bild hinterlegt ist, trägt das Foto den Verlauf der
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
      <span className="gametile__foto">
        {game.image ? (
          <img className="gametile__img" src={game.image} alt="" loading="lazy" />
        ) : (
          <Icon className="gametile__mark" name={game.icon} size={96} strokeWidth={1.2} />
        )}
      </span>
      <span className="gametile__rand">
        <span className="gametile__title t-display">{game.name}</span>
        <span className="gametile__stempel">
          {dimReason ? `ab ${game.minPlayers}` : `${game.minPlayers}–${game.maxPlayers}`}
        </span>
      </span>
    </button>
  );
}
