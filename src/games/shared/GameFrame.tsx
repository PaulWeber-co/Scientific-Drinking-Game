import type { ReactNode } from 'react';
import { haptic } from '../../lib/haptics';

interface Props {
  title: string;
  accent: string;
  subtitle?: ReactNode;
  onQuit: () => void;
  action?: ReactNode;
  children: ReactNode;
}

/** Einheitlicher Rahmen für alle Spiele – Kopfzeile, Farbe, Beenden-Knopf. */
export function GameFrame({ title, accent, subtitle, onQuit, action, children }: Props) {
  return (
    <div className="game" style={{ ['--accent' as string]: accent }}>
      <header className="game__bar">
        <button
          className="game__close"
          aria-label="Spiel beenden"
          onClick={() => {
            haptic('tap');
            onQuit();
          }}
        >
          ✕
        </button>
        <div className="game__titles">
          <div className="t-headline">{title}</div>
          {subtitle && <div className="t-caption">{subtitle}</div>}
        </div>
        <div className="game__action">{action}</div>
      </header>
      <div className="game__body">{children}</div>
    </div>
  );
}
