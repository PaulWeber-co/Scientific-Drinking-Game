import { useCallback, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

/**
 * Zurück, aber nie ins Leere.
 *
 * `nav(-1)` allein verlässt die App, wenn die Seite der Einstieg war – etwa
 * über einen geteilten Link direkt auf ein Spiel oder nach einem Neuladen.
 * React Router kennzeichnet den ersten Eintrag mit dem Schlüssel `default`;
 * dann geht es stattdessen zur nächsthöheren Seite.
 */
export function useGoBack(fallback: string): () => void {
  const nav = useNavigate();
  const { key } = useLocation();
  return useCallback(() => {
    if (key !== 'default') nav(-1);
    else nav(fallback, { replace: true, state: { back: true } });
  }, [key, nav, fallback]);
}

/**
 * Richtung der letzten Navigation als `data-nav` am Wurzelelement.
 *
 * Damit gleitet eine Seite nach „Zurück" von links herein, wie unter iOS die
 * darunterliegende Ebene – und nicht von unten wie eine neu geöffnete. Im
 * Layout-Effekt gesetzt, damit die neue Seite schon mit der richtigen
 * Animation ins erste Bild kommt.
 */
export function useNavDirection(): void {
  const type = useNavigationType();
  const location = useLocation();
  const asBack = (location.state as { back?: boolean } | null)?.back === true;
  // Auch der Start ist ein POP – und der erste Eintrag behält seinen
  // Schlüssel `default`, wenn man später zu ihm zurückkehrt. Unterscheiden
  // lässt sich das Zurück darum nur daran, dass schon navigiert wurde.
  // Derselbe Schlüssel zweimal ist keine Navigation (StrictMode, Neu-Rendern).
  const seen = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (seen.current === location.key) return;
    const back = seen.current !== null && (type === 'POP' || asBack);
    seen.current = location.key;
    if (back) document.documentElement.dataset.nav = 'back';
    else delete document.documentElement.dataset.nav;
  }, [type, asBack, location.key]);
}
