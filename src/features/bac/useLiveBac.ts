import { useEffect, useMemo, useState } from 'react';
import { estimateBac } from '../../engine/bac';
import type { BacEstimate } from '../../engine/types';
import { usePlayer } from '../../store/player';

/** Aktueller Pegel, der sich von selbst aktualisiert. */
export function useLiveBac(intervalMs = 20_000): { estimate: BacEstimate | null; now: number } {
  const profile = usePlayer((s) => s.profile);
  const log = usePlayer((s) => s.log);
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

  const estimate = useMemo(
    () => (profile ? estimateBac(log, profile, now) : null),
    [log, profile, now],
  );
  return { estimate, now };
}
