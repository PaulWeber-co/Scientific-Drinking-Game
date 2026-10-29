import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../../components/icons';
import { Sheet } from '../../components/ui';
import { useParty } from '../../features/party/PartyContext';
import { haptic } from '../../lib/haptics';
import { useCurrentDrink } from '../../store/player';
import { GAMES } from '../registry';
import { GameSettings, type HeatControl, type SpicyControl } from './GameSettings';

/**
 * Das „•••" im Spielkopf: alles, was man mitten im Spiel nur ab und zu
 * braucht. Im Kopf bleiben nur Beenden und das Glas, damit das Spiel selbst
 * den Bildschirm hat.
 */
export function GameMenu({
  heat,
  spicy,
  onLogDrink,
}: {
  heat?: HeatControl;
  spicy?: SpicyControl;
  onLogDrink: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<'rules' | 'settings' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const nav = useNavigate();
  const { gameId } = useParty();
  const game = GAMES.find((entry) => entry.id === gameId);
  const drink = useCurrentDrink();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const items = Array.from(
          root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
        );
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
      }
      if (event.key === 'Tab') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
    };
  }, [open]);

  const item = (label: string, icon: IconName, activate: () => void, detail?: string) => (
    <button
      className="game-menu__item"
      role="menuitem"
      onClick={() => {
        haptic('tap');
        setOpen(false);
        trigger.current?.focus();
        activate();
      }}
    >
      <span>
        {label}
        {detail && <span className="game-menu__detail">{detail}</span>}
      </span>
      <Icon name={icon} size={19} />
    </button>
  );

  return (
    <>
      <div className="game-menu" ref={root}>
        <button
          ref={trigger}
          className="game__settings"
          aria-label="Mehr"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            haptic('tap');
            setOpen(!open);
          }}
        >
          <Icon name="more" size={19} />
        </button>
        {open && (
          <div className="game-menu__items" role="menu" aria-label="Mehr">
            {item('Anderes Getränk eintragen', drink.icon, onLogDrink)}
            {item('Einwegkamera', 'camera', () => nav('/kamera'))}
            {game && item('Regeln', 'info', () => setSheet('rules'))}
            {item(
              'Einstellungen',
              'settings',
              () => setSheet('settings'),
              [heat && 'Härte', spicy && 'Spicy', drink.name].filter(Boolean).join(' · '),
            )}
          </div>
        )}
      </div>
      <Sheet open={sheet === 'rules'} onClose={() => setSheet(null)} title="Regeln">
        <ol className="howto">
          {game?.howTo.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
      </Sheet>
      <GameSettings
        heat={heat}
        spicy={spicy}
        open={sheet === 'settings'}
        onClose={() => setSheet(null)}
      />
    </>
  );
}
