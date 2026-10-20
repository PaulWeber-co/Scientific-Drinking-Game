import { useMemo } from 'react';
import { estimateBac } from '../../engine/bac';
import type { BacEstimate } from '../../engine/types';
import { useBacEvents, usePlayer } from '../../store/player';
import { useNow } from '../../lib/useNow';

/** Aktueller Pegel, der sich von selbst aktualisiert. */
export function useLiveBac(intervalMs = 20_000): { estimate: BacEstimate | null; now: number } {
  const profile = usePlayer((s) => s.profile);
  const log = useBacEvents();
  const now = useNow(intervalMs);

  const estimate = useMemo(
    () => (profile ? estimateBac(log, profile, now) : null),
    [log, profile, now],
  );
  return { estimate, now };
}
