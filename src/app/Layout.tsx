import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { haptic } from '../lib/haptics';
import { Icon, type IconName } from '../components/icons';
import { useApp } from '../store/app';
import { WaterReminder } from '../features/bac/WaterReminder';
import { GameInvite } from '../features/party/GameInvite';

const TABS: { to: string; icon: IconName; label: string }[] = [
  { to: '/', icon: 'home', label: 'Start' },
  { to: '/spiele', icon: 'games', label: 'Spiele' },
  { to: '/lobby', icon: 'people', label: 'Runde' },
  { to: '/pegel', icon: 'chart', label: 'Pegel' },
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
      <GameInvite />
      <nav className="tabbar" aria-label="Hauptnavigation">
        <div className="tabbar__inner">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'} className="tabbar__item" onClick={() => haptic('tap')}>
              <Icon name={t.icon} size={23} className="tabbar__icon" />
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
