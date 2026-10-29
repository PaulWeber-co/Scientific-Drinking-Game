import { Icon } from '../../components/icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Sheet } from '../../components/ui';
import { haptic } from '../../lib/haptics';
import { keepScreenAwake } from '../../lib/wakelock';
import type { HeatControl, SpicyControl } from './GameSettings';
import { GlassButton } from './GlassButton';
import { GameMenu } from './GameMenu';
import { useParty } from '../../features/party/PartyContext';

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
  const [moreOpen, setMoreOpen] = useState(false);
  const { otherBuild, mode, isHost } = useParty();
  const nurIch = mode === 'online' && !isHost;
  // Jedes Spiel läuft in diesem Rahmen – hier gilt die Sperre für alle 17 und
  // fällt beim Verlassen von selbst wieder weg.
  useEffect(() => keepScreenAwake(), []);

  return (
    <div className="game" style={{ ['--accent' as string]: accent }}>
      <header className="game__bar">
        <div className="game__bar-content">
          <button
            className="game__close game__quit"
            aria-label={nurIch ? 'Spiel verlassen' : 'Spiel beenden'}
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
            <GlassButton moreOpen={moreOpen} onMoreClose={() => setMoreOpen(false)} />
            <GameMenu heat={heat} spicy={spicy} onLogDrink={() => setMoreOpen(true)} />
          </div>
        </div>
      </header>
      <div className="game__body">
        {otherBuild && (
          <div className="notice notice--neutral" role="status">
            Ihr spielt mit verschiedenen App-Versionen. Wenn etwas komisch aussieht:
            alle auf die neueste Version aktualisieren.
          </div>
        )}
        {children}
      </div>

      {/* Der Knopf sitzt am Daumen und beendet beim Host die Runde für alle.
          Ohne Rückfrage kostet ein Fehlgriff der ganzen Gruppe das Spiel. */}
      <Sheet
        open={askQuit}
        onClose={() => setAskQuit(false)}
        title={nurIch ? 'Spiel verlassen?' : 'Spiel beenden?'}
      >
        <div className="stack-3">
          <div className="notice notice--orange">
            {nurIch
              ? 'Die anderen spielen weiter. Über die Leiste unten steigst du wieder ein.'
              : `Damit endet ${title} für die ganze Runde. Der Trink-Log bleibt erhalten.`}
          </div>
          <button
            className="btn btn--danger btn--block btn--lg"
            onClick={() => {
              haptic('warn');
              setAskQuit(false);
              onQuit();
            }}
          >
            {nurIch ? 'Verlassen' : 'Beenden'}
          </button>
          <button
            className="btn btn--glass btn--block"
            onClick={() => {
              haptic('tap');
              setAskQuit(false);
            }}
          >
            Weiterspielen
          </button>
        </div>
      </Sheet>
    </div>
  );
}
