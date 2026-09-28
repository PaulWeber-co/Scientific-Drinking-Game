import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import type { GameActionInput } from '../types';
import { REACTIONS, type Reaction, type State } from './game';

const LOOK: Record<Reaction, { icon: IconName; label: string }> = {
  lachen: { icon: 'laugh', label: 'Lachen' },
  tot: { icon: 'skull', label: 'Tot gelacht' },
  herz: { icon: 'heart', label: 'Liebe' },
  cringe: { icon: 'cringe', label: 'Cringe' },
};

/** Mehr als eine Reaktion pro Handy in dieser Zeit geht nicht über die Leitung. */
const COOLDOWN_MS = 600;
/** So lange fliegt eine Reaktion übers Bild. */
const FLIGHT_MS = 2_400;

/** Die vier Reaktionsknöpfe unter der Abstimmung. */
export function ReactionBar({ dispatch }: { dispatch: (a: GameActionInput) => void }) {
  const last = useRef(0);
  return (
    <div className="md-reactbar" role="group" aria-label="Reagieren">
      {REACTIONS.map((k) => (
        <button
          key={k}
          className={`md-reactbtn md-reactbtn--${k}`}
          aria-label={LOOK[k].label}
          onClick={() => {
            const now = Date.now();
            if (now - last.current < COOLDOWN_MS) return;
            last.current = now;
            haptic('tap');
            dispatch({ type: 'react', kind: k });
          }}
        >
          <Icon name={LOOK[k].icon} size={24} />
        </button>
      ))}
    </div>
  );
}

interface Flight {
  n: number;
  k: Reaction;
  x: number;
  drift: number;
}

/**
 * Lässt neue Reaktionen übers Meme steigen – auf allen Handys dieselben,
 * ohne Namen. Was schon im Spielstand stand, als das Bild aufging, fliegt
 * nicht noch einmal los.
 */
export function ReactionLayer({
  reactions,
  feel,
}: {
  reactions: State['reactions'];
  /** Jede ankommende Reaktion als leises Tippen spüren – auf dem eigenen Meme. */
  feel?: boolean;
}) {
  const seen = useRef(reactions.reduce((m, r) => Math.max(m, r.n), 0));
  const [flights, setFlights] = useState<Flight[]>([]);
  // Jede Welle räumt sich selbst weg. Die Wecker hängen NICHT am Effekt: der
  // läuft bei jeder neuen Reaktion neu, und ein weggeräumter Wecker ließe die
  // Welle davor für immer stehen.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const fresh = reactions.filter((r) => r.n > seen.current);
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map((r) => r.n));
    if (feel) haptic('tick');
    setFlights((cur) => [
      ...cur,
      ...fresh.map((r) => ({
        n: r.n,
        k: r.k,
        x: 12 + Math.random() * 76,
        drift: (Math.random() - 0.5) * 60,
      })),
    ]);
    const ids = new Set(fresh.map((r) => r.n));
    const t = setTimeout(() => {
      timers.current.delete(t);
      setFlights((cur) => cur.filter((f) => !ids.has(f.n)));
    }, FLIGHT_MS);
    timers.current.add(t);
    // `feel` wechselt nicht, solange dasselbe Meme steht (die Ebene ist je Meme
    // neu verschlüsselt) – nur neue Reaktionen sollen den Effekt auslösen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactions]);

  return (
    <div className="md-flights" aria-hidden>
      {flights.map((f) => (
        <span
          key={f.n}
          className={`md-flight md-flight--${f.k}`}
          style={{ left: `${f.x}%`, ['--drift' as string]: `${f.drift}px` }}
        >
          <Icon name={LOOK[f.k].icon} size={34} strokeWidth={1.9} />
        </span>
      ))}
    </div>
  );
}
