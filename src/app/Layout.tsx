import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { haptic } from '../lib/haptics';
import { useApp } from '../store/app';
import { WaterReminder } from '../features/bac/WaterReminder';

const TABS = [
  { to: '/', icon: '🏠', label: 'Start' },
  { to: '/spiele', icon: '🎲', label: 'Spiele' },
  { to: '/lobby', icon: '👥', label: 'Runde' },
  { to: '/pegel', icon: '📈', label: 'Pegel' },
];

export function Layout() {
  const theme = useApp((s) => s.theme);
  const { pathname } = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#f2f2f7' : '#08080b');
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="app">
      <div className="aurora" aria-hidden />
      <Outlet />
      <WaterReminder />
      <nav className="tabbar" aria-label="Hauptnavigation">
        <div className="tabbar__inner">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'} className="tabbar__item" onClick={() => haptic('tap')}>
              <span className="tabbar__icon">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Vollbild-Layout ohne Tab-Leiste – für Onboarding und laufende Spiele. */
export function FullLayout() {
  const theme = useApp((s) => s.theme);
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
