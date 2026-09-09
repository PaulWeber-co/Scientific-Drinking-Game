import { useState } from 'react';
import { Icon } from '../../components/icons';
import { Sheet } from '../../components/ui';
import { MIN_AGE_ALCOHOL } from '../../engine/constants';
import { haptic } from '../../lib/haptics';
import type { GameMeta } from '../../games/types';
import { useApp } from '../../store/app';
import { usePlayer } from '../../store/player';

/**
 * Zusätzliche, deutlich freizügigere Karten – bewusst als eigener Schalter und
 * nicht als vierter Härtegrad: das ist eine Frage des Inhalts, nicht der Menge.
 *
 * Auf der Spielseite steht der Zustand als Chip. Angeschaltet wird nur im
 * Sheet, mit dem Erklärtext davor: Spicy ist eine Einwilligung der ganzen
 * Runde, keine Vorliebe, die man beiläufig umlegt.
 */
export function SpicyToggle({ game }: { game: GameMeta }) {
  const on = useApp((s) => s.spicy[game.id] === true);
  const toggle = useApp((s) => s.toggleSpicy);
  const age = usePlayer((s) => s.profile?.age ?? 0);
  const [open, setOpen] = useState(false);

  if (!game.allowSpicy) return null;

  if (age < MIN_AGE_ALCOHOL) {
    return (
      <span className="chip chip--outline">
        <Icon name="lock" size={13} /> Ab {MIN_AGE_ALCOHOL}
      </span>
    );
  }

  return (
    <>
      <button
        className={`chip pressable ${on ? 'chip--hot' : ''}`}
        onClick={() => {
          haptic('tap');
          setOpen(true);
        }}
      >
        <Icon name="flame" size={13} /> {on ? 'Spicy' : 'Zahm'}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Spicy-Karten">
        <div className="stack-3">
          <p className="t-sub">
            Schaltet deutlich freizügigere Karten frei. Kneifen geht immer – wer nicht will,
            trinkt stattdessen.
          </p>
          <p className="t-caption">
            Fragt einmal in die Runde, bevor ihr das anschaltet. Nach dem Abendabschluss steht es
            wieder auf zahm.
          </p>
          <button
            className={`btn btn--block btn--lg ${on ? 'btn--gray' : 'btn--brand'}`}
            onClick={() => {
              haptic('select');
              toggle(game.id);
              setOpen(false);
            }}
          >
            {on ? 'Zurück auf zahm' : 'Spicy anschalten'}
          </button>
        </div>
      </Sheet>
    </>
  );
}
