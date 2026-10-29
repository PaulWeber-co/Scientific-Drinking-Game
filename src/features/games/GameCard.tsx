import { useEffect, useRef, useState, type RefObject } from 'react';
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
 *
 * Im Motiv lebt etwas (`ambient`: Lampe, Glanz, Funke, Schatten), aber nur,
 * solange die Kachel zu sehen ist. Zwanzig gleichzeitig laufende Kacheln
 * kosteten auf alten Handys Akku, ohne dass jemand hinsieht.
 */
export function GameCard({
  game,
  onClick,
  dimReason,
}: {
  game: GameMeta;
  onClick: () => void;
  /** Gruppengröße passt nicht zu diesem Spiel. Die Kachel bleibt tippbar – warum,
      erklärt die Spielseite; eine gesperrte Kachel erklärt gar nichts. */
  dimReason?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const live = useInView(ref);
  return (
    <button
      ref={ref}
      className={`gametile pressable ${dimReason ? 'gametile--dim' : ''} ${live ? 'lebt' : ''}`}
      style={{
        ['--accent' as string]: game.accent,
        ['--ax' as string]: `${(game.ambient?.x ?? 0.5) * 100}%`,
        ['--ay' as string]: `${(game.ambient?.y ?? 0.5) * 100}%`,
      }}
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
        {game.ambient && (
          <span className={`licht licht--${game.ambient.kind}`} aria-hidden />
        )}
      </span>
      <span className="gametile__rand">
        <span className="gametile__title">{game.name}</span>
        <span className="gametile__stempel">
          {dimReason ?? `${game.minPlayers}–${game.maxPlayers}`}
        </span>
      </span>
    </button>
  );
}

/** Ob das Element gerade im Bild ist (mit etwas Vorlauf). Ohne Observer
 *  (Testumgebung) bleibt es aus, dann läuft eben nichts. */
function useInView(ref: RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '40px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}
