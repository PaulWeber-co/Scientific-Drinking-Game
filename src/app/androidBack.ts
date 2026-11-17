import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { topScreenBack } from '../lib/backHandler';

/**
 * Zurück-Taste bzw. Zurück-Geste unter Android.
 *
 * Ohne eigene Behandlung ruft Capacitor nur `history.back()` auf und beendet
 * am ersten Eintrag die App – auch dann, wenn gerade nur ein Sheet offen war.
 * Reihenfolge wie bei nativen Android-Apps:
 *
 * 1. Offenes Sheet, Menü oder Einladung schließen. Alle hören bereits auf
 *    Escape (nur die oberste Ebene reagiert, siehe `lib/modal.ts`) – die Taste
 *    schickt darum ein Escape, statt jede Ebene einzeln zu kennen.
 * 2. Das „Zurück" des Bildschirms, falls er eins angemeldet hat
 *    (`useBackHandler`, steckt in `useSwipeBack`).
 * 3. Eine Seite zurück, solange es in der App eine gibt.
 * 4. Kein Verlauf, aber nicht auf der Startseite: zur Spielewand.
 * 5. Auf der Spielewand: App in den Hintergrund. Nicht beenden – eine laufende
 *    Runde soll beim Zurückkommen noch da sein.
 */
export type BackStep = 'closed-overlay' | 'screen' | 'back' | 'home' | 'minimize';

export function handleBack(opts: {
  /** Position im Verlauf (React Router legt sie als `history.state.idx` ab). */
  historyIndex: number;
  pathname: string;
  navigate: (to: string | number, options?: { replace?: boolean; state?: unknown }) => void;
  minimize: () => void;
}): BackStep {
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  (document.activeElement ?? document.body).dispatchEvent(escape);
  if (escape.defaultPrevented) return 'closed-overlay';

  const screen = topScreenBack();
  if (screen) {
    screen();
    return 'screen';
  }
  if (opts.historyIndex > 0) {
    opts.navigate(-1);
    return 'back';
  }
  if (opts.pathname !== '/') {
    opts.navigate('/', { replace: true, state: { back: true } });
    return 'home';
  }
  opts.minimize();
  return 'minimize';
}

/** Hängt die Zurück-Taste an – nur in der Android-Hülle, sonst ein No-op. */
export function useAndroidBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();
  // Der Listener bleibt bestehen; er liest immer den aktuellen Stand.
  const latest = useRef({ navigate, location });
  latest.current = { navigate, location };

  useEffect(() => {
    if (window.Capacitor?.isNativePlatform?.() !== true) return;
    let remove: (() => void) | undefined;
    let active = true;
    void (async () => {
      const [{ Capacitor }, { App }] = await Promise.all([
        import('@capacitor/core'),
        import('@capacitor/app'),
      ]);
      if (!active || Capacitor.getPlatform() !== 'android') return;
      const handle = await App.addListener('backButton', () => {
        const { navigate: nav, location: loc } = latest.current;
        handleBack({
          historyIndex: (window.history.state as { idx?: number } | null)?.idx ?? 0,
          pathname: loc.pathname,
          navigate: (to, options) => (typeof to === 'number' ? nav(to) : nav(to, options)),
          minimize: () => void App.minimizeApp(),
        });
      });
      if (active) remove = () => void handle.remove();
      else void handle.remove();
    })();
    return () => {
      active = false;
      remove?.();
    };
  }, []);
}
