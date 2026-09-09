import { useEffect, useState } from 'react';

/**
 * Der Knall.
 *
 * Reihenfolge wie in echt, und genau daran haengt, ob es nach Explosion oder
 * nach Konfetti aussieht: erst der Blitz (schneller als alles andere), dann
 * der Feuerball, dann die Druckwellen, dann Splitter — und zuletzt der Rauch,
 * der als Einziges laenger stehen bleibt.
 *
 * Reines CSS – kein Canvas, keine Bibliothek, und der Screenreader bekommt
 * davon nichts ab.
 */
export function Explosion({ shards = 14 }: { shards?: number }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1400);
    return () => clearTimeout(t);
  }, []);
  if (done) return null;

  return (
    <div className="boom" aria-hidden="true">
      <span className="boom__flash" />
      <span className="boom__ball" />
      <span className="boom__ring" />
      <span className="boom__ring boom__ring--late" />
      {Array.from({ length: shards }, (_, i) => (
        <span
          key={i}
          className="boom__shard"
          style={{
            ['--a' as string]: `${(360 / shards) * i + (i % 3) * 7}deg`,
            ['--d' as string]: `${90 + ((i * 37) % 70)}px`,
            ['--delay' as string]: `${(i % 5) * 18}ms`,
          }}
        />
      ))}
      {/* Rauch: ungerade Winkel und Groessen, sonst sieht die Wolke gebaut aus. */}
      {RAUCH.map((r, i) => (
        <span
          key={`r${i}`}
          className="boom__rauch"
          style={{
            ['--x' as string]: `${r.x}px`,
            ['--s' as string]: r.s,
            ['--delay' as string]: `${r.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

const RAUCH = [
  { x: -46, s: 1.1, delay: 40 },
  { x: -14, s: 1.5, delay: 0 },
  { x: 22, s: 1.25, delay: 90 },
  { x: 54, s: 0.95, delay: 140 },
];
