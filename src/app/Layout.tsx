import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { useEffect, useLayoutEffect } from 'react';
import { useApp } from '../store/app';
import { useResolvedTheme } from '../lib/theme';
import { WaterReminder } from '../features/bac/WaterReminder';
import { GameInvite } from '../features/party/GameInvite';
import { NativeAwareTabBar } from './NativeAwareTabBar';

export function Layout() {
  useTheme();
  usePageFocus();
  useMotionSwitch();
  useScrollMemory();

  return (
    <div className="app">
      <div className="aurora" aria-hidden />
      <Outlet />
      <WaterReminder />
      <GameInvite />
      <NativeAwareTabBar />
    </div>
  );
}

/** Vollbild-Layout ohne Tab-Leiste – für Onboarding und laufende Spiele. */
export function FullLayout() {
  useTheme();
  usePageFocus();
  useMotionSwitch();
  return (
    <div className="app">
      <div className="aurora" aria-hidden />
      <Outlet />
    </div>
  );
}

/** Der App-Schalter "Bewegung reduzieren" als Attribut, das das CSS liest. */
function useMotionSwitch() {
  const calm = useApp((s) => s.calmMotion);
  useEffect(() => {
    if (calm) document.documentElement.dataset.motion = 'reduced';
    else delete document.documentElement.dataset.motion;
  }, [calm]);
}

/** Scrollstand je Verlaufseintrag – nur für diese Sitzung. */
const scrollMemory = new Map<string, number>();

/**
 * Neue Seiten beginnen oben, beim Zurück steht man wieder dort, wo man war.
 *
 * Vorher sprang die Spielewand nach jedem Blick in ein Spiel an den Anfang,
 * und man musste das nächste Spiel erneut suchen. Wie unter iOS behält die
 * darunterliegende Ebene ihren Stand.
 */
function useScrollMemory() {
  const { key } = useLocation();
  const type = useNavigationType();
  useLayoutEffect(() => {
    const saved = type === 'POP' ? scrollMemory.get(key) : undefined;
    window.scrollTo({ top: saved ?? 0 });
    const remember = () => scrollMemory.set(key, window.scrollY);
    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, [key, type]);
}

function useTheme() {
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#efe7da' : '#0d0a08');
  }, [theme]);
}

function usePageFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Ein Eingabefeld mit autoFocus auf der neuen Seite behält den Fokus,
    // sonst ginge auf dem Handy die Tastatur gleich wieder zu.
    if (document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
    const heading = document.querySelector<HTMLElement>('.app h1')
      ?? document.querySelector<HTMLElement>('.app .navbar__title');
    if (!heading) return;
    if (heading.tagName !== 'H1') {
      heading.setAttribute('role', 'heading');
      heading.setAttribute('aria-level', '1');
    }
    heading.tabIndex = -1;
    heading.dataset.pageHeading = '';
    heading.focus({ preventScroll: true });
  }, [pathname]);
}
