import { useEffect, useState } from 'react';

/** Laufende Uhr für Pegel und Dosierung, auch nach gesperrtem Bildschirm. */
export function useNow(intervalMs = 20_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    const onVis = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs]);

  return now;
}
