import { useEffect, useState } from 'react';

/**
 * Kurze, harte Explosion: Blitz, zwei Druckwellen und Splitter.
 * Reines CSS – kein Canvas, keine Bibliothek, und der Screenreader
 * bekommt davon nichts ab.
 */
export function Explosion({ shards = 14 }: { shards?: number }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1100);
    return () => clearTimeout(t);
  }, []);
  if (done) return null;

  return (
    <div className="boom" aria-hidden="true">
      <span className="boom__flash" />
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
    </div>
  );
}
