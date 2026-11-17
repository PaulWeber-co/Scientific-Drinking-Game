import { useEffect, useRef } from 'react';

/**
 * Bildschirme mit eigenem „Zurück" (Wisch vom Rand, Schritt im Onboarding,
 * Rückkehr in ein laufendes Spiel) melden es hier an. Die Android-Taste nimmt
 * dann denselben Weg wie die Geste – nicht bloß den Browser-Verlauf.
 * Der zuletzt angemeldete Bildschirm liegt oben.
 */
const screenBacks: { current: () => void }[] = [];

export function useBackHandler(onBack: () => void, enabled = true): void {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  useEffect(() => {
    if (!enabled) return;
    const entry = { current: () => latest.current() };
    screenBacks.push(entry);
    return () => {
      const i = screenBacks.indexOf(entry);
      if (i >= 0) screenBacks.splice(i, 1);
    };
  }, [enabled]);
}

/** Das „Zurück" des obersten Bildschirms, falls einer eins angemeldet hat. */
export function topScreenBack(): (() => void) | undefined {
  return screenBacks[screenBacks.length - 1]?.current;
}
