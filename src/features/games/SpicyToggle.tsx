import { Icon } from '../../components/icons';
import { Toggle } from '../../components/ui';
import { MIN_AGE_ALCOHOL } from '../../engine/constants';
import { haptic } from '../../lib/haptics';
import type { GameDefinition } from '../../games/types';
import { useApp } from '../../store/app';
import { usePlayer } from '../../store/player';

/**
 * Zusätzliche, deutlich freizügigere Karten – bewusst als eigener Schalter und
 * nicht als vierter Härtegrad: das ist eine Frage des Inhalts, nicht der Menge.
 */
export function SpicyToggle({ game }: { game: GameDefinition }) {
  const on = useApp((s) => s.spicy[game.id] === true);
  const toggle = useApp((s) => s.toggleSpicy);
  const age = usePlayer((s) => s.profile?.age ?? 0);

  if (!game.allowSpicy) return null;

  if (age < MIN_AGE_ALCOHOL) {
    return (
      <section className="card row">
        <span className="listicon">
          <Icon name="lock" size={18} />
        </span>
        <span className="grow">
          <span className="t-headline" style={{ display: 'block' }}>
            Spicy
          </span>
          <span className="t-caption">Ab {MIN_AGE_ALCOHOL} verfügbar.</span>
        </span>
      </section>
    );
  }

  return (
    <section className={`card row spicycard ${on ? 'spicycard--on' : ''}`}>
      <span className="spicycard__icon">
        <Icon name="flame" size={18} />
      </span>
      <span className="grow">
        <span className="t-headline" style={{ display: 'block' }}>
          Spicy
        </span>
        <span className="t-caption">
          {on
            ? 'Freizügige Karten sind im Stapel. Kneifen geht immer.'
            : 'Schaltet deutlich freizügigere Karten frei.'}
        </span>
      </span>
      <Toggle
        checked={on}
        onChange={() => {
          haptic('select');
          toggle(game.id);
        }}
        label="Spicy-Karten"
      />
    </section>
  );
}
