import { useEffect, useState } from 'react';
import { haptic } from '../../lib/haptics';
import { usePlayer } from '../../store/player';
import { useApp } from '../../store/app';

const EVERY_MS = 45 * 60_000;
/** Ab so viel Gramm Alkohol seit dem letzten Wasser wird erinnert. */
const GRAMS_TRIGGER = 24;

/**
 * Dezenter Hinweis, ein Glas Wasser zu trinken. Erscheint erst, wenn wirklich
 * etwas getrunken wurde – nicht als Dauer-Popup.
 */
export function WaterReminder() {
  const enabled = useApp((s) => s.waterReminder);
  const log = usePlayer((s) => s.log);
  const [dismissedAt, setDismissedAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!enabled) return null;
  const since = Math.max(dismissedAt, now - EVERY_MS);
  const grams = log.filter((e) => e.at > since).reduce((s, e) => s + e.alcoholGrams, 0);
  if (grams < GRAMS_TRIGGER || now - dismissedAt < EVERY_MS) return null;

  return (
    <div className="watertip pop-in" role="status">
      <span style={{ fontSize: 22 }}>💧</span>
      <span className="grow t-foot">
        Ein Glas Wasser jetzt spart dir morgen die halbe Kopfschmerztablette.
      </span>
      <button
        className="btn btn--sm btn--gray"
        onClick={() => {
          haptic('success');
          setDismissedAt(Date.now());
        }}
      >
        Erledigt
      </button>
    </div>
  );
}
