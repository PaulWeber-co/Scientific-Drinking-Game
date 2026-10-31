import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { useEffect, useLayoutEffect } from 'react';
import { useApp } from '../store/app';
import { WaterReminder } from '../features/bac/WaterReminder';
import { GameInvite } from '../features/party/GameInvite';
import { NativeAwareTabBar } from './NativeAwareTabBar';

export function Layout() {
  const theme = useApp((s) => s.theme);
  useMotionSwitch();
  useScrollMemory();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#efe7da' : '#0d0a08');
  }, [theme]);

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
  const theme = useApp((s) => s.theme);
  useMotionSwitch();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
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
