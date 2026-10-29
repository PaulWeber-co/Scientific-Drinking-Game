import { useEffect, useState } from 'react';
import { useApp } from '../store/app';

/**
 * Ob Bewegung gerade ruhen soll.
 *
 * Zwei Quellen mit demselben Gewicht: die Systemeinstellung des Geräts und
 * der Schalter in der App. Den Schalter gibt es, weil kaum jemand die
 * Systemeinstellung findet und sie das ganze Handy beruhigt statt nur Pegel.
 * Das CSS liest beides selbst (Media-Query und `data-motion`); diese Funktion
 * ist für Code, der ohne CSS animiert (Canvas, Zähler).
 */
export function motionReduced(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Wie `motionReduced`, aber neu ausgewertet, sobald eine der Quellen kippt. */
export function useReducedMotion(): boolean {
  const calm = useApp((s) => s.calmMotion);
  const [system, setSystem] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setSystem(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return calm || system;
}
