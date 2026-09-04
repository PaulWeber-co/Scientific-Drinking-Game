import { Icon } from '../../components/icons';
import { useState, type ReactNode } from 'react';
import { Sheet } from '../../components/ui';
import { haptic } from '../../lib/haptics';
import { GameSettings, type HeatControl, type SpicyControl } from './GameSettings';

interface Props {
  title: string;
  accent: string;
  subtitle?: ReactNode;
  onQuit: () => void;
  action?: ReactNode;
  /** Härtegrad und Spicy wandern ins Einstellungs-Sheet, wenn gesetzt. */
  heat?: HeatControl;
  spicy?: SpicyControl;
  children: ReactNode;
}

/** Einheitlicher Rahmen für alle Spiele – Kopfzeile, Farbe, Beenden-Knopf. */
export function GameFrame({
  title,
  accent,
  subtitle,
  onQuit,
  action,
  heat,
  spicy,
  children,
}: Props) {
  const [askQuit, setAskQuit] = useState(false);

  return (
    <div className="game" style={{ ['--accent' as string]: accent }}>
      <header className="game__bar">
        <button
          className="game__close"
          aria-label="Spiel beenden"
          onClick={() => {
            haptic('tap');
            setAskQuit(true);
          }}
        >
          <Icon name="close" size={16} strokeWidth={2.1} />
        </button>
        <div className="game__titles">
          <div className="t-headline">{title}</div>
          {subtitle && <div className="t-caption">{subtitle}</div>}
        </div>
        <div className="game__action">
          {action}
          <GameSettings heat={heat} spicy={spicy} />
        </div>
      </header>
      <div className="game__body">{children}</div>

      {/* Der Knopf sitzt am Daumen und beendet die Runde für alle. Ohne
          Rückfrage kostet ein Fehlgriff der ganzen Gruppe das Spiel. */}
      <Sheet open={askQuit} onClose={() => setAskQuit(false)} title="Spiel beenden?">
        <div className="stack-3">
          <div className="notice notice--orange">
            Damit endet {title} für die ganze Runde. Der Trink-Log bleibt erhalten.
          </div>
          <button
            className="btn btn--danger btn--block btn--lg"
            onClick={() => {
              haptic('warn');
              setAskQuit(false);
              onQuit();
            }}
          >
            Beenden
          </button>
          <button className="btn btn--glass btn--block" onClick={() => setAskQuit(false)}>
            Weiterspielen
          </button>
        </div>
      </Sheet>
    </div>
  );
}
