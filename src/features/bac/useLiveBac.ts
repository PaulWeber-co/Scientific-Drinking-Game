import { useMemo } from 'react';
import { estimateBac } from '../../engine/bac';
import type { BacEstimate } from '../../engine/types';
import { useBacEvents, usePlayer } from '../../store/player';
import { useNow } from '../../lib/useNow';

/**
 * Aktueller Pegel, der sich von selbst aktualisiert.
 *
 * Gerechnet wird bis zum neuesten Eintrag, höchstens aber einen Takt voraus:
 * `now` tickt nur alle 20 s, und ein gerade eingetragenes Getränk läge sonst
 * bis dahin in der Zukunft – das Glas bliebe nach dem Tipp stehen. Weiter
 * voraus liegt nur, was die Uhr verstellt hat; das bleibt außen vor wie bisher.
 */
export function useLiveBac(intervalMs = 20_000): { estimate: BacEstimate | null; now: number } {
  const profile = usePlayer((s) => s.profile);
  const log = useBacEvents();
  const now = useNow(intervalMs);

  const estimate = useMemo(() => {
    if (!profile) return null;
    let at = now;
    for (const e of log) if (e.at > at && e.at <= now + intervalMs) at = e.at;
    return estimateBac(log, profile, at);
  }, [log, profile, now, intervalMs]);
  return { estimate, now };
}
