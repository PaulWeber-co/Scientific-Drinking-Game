import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../components/icons';
import { haptic } from '../lib/haptics';
import { TABS, activeIndex } from './TabBar';

/**
 * Navigationsleiste für Android im Stil von Material 3 Expressive.
 *
 * Unter iOS schwebt eine Glaskapsel (TabBar.tsx). Android-Apps haben eine
 * Fläche am unteren Rand, die bis unter die Gestenleiste reicht. Der aktive
 * Tab trägt eine Pille hinter dem Symbol, das Label steht fett darunter –
 * nicht in der Pille: So sieht es in Googles eigenen Apps aus, und das Label
 * bleibt bei jeder Schriftgröße lesbar.
 */
export function MaterialNavBar() {
  const { pathname } = useLocation();
  const active = activeIndex(pathname);

  return (
    <nav className="m3nav" aria-label="Hauptnavigation">
      {TABS.map((t, i) => {
        const selected = i === active;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`m3nav__item${selected ? ' is-active' : ''}`}
            aria-current={selected ? 'page' : undefined}
            onClick={(e) => {
              if (selected) {
                // Erneut antippen: nach oben, wie in jeder Android-App.
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
              }
              haptic('tap');
            }}
          >
            <span className="m3nav__indicator">
              <Icon name={t.icon} size={24} strokeWidth={selected ? 2 : 1.7} />
            </span>
            <span className="m3nav__label">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
