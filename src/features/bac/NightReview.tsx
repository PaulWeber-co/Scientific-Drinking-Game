import { useMemo } from 'react';
import { formatBac, formatTime } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { Icon } from '../../components/icons';
import { Sheet } from '../../components/ui';
import { usePlayer } from '../../store/player';
import { buildNightSummary } from './nightSummary';
import { shareNightCard } from './shareCard';

/** Rückblick beim Abendende – erst schauen, dann löschen. */
export function NightReview({
  open,
  onClose,
  onEnd,
}: {
  open: boolean;
  onClose: () => void;
  onEnd: () => void;
}) {
  const profile = usePlayer((s) => s.profile);
  const log = usePlayer((s) => s.log);
  const water = usePlayer((s) => s.waterCount);

  const summary = useMemo(
    () => (profile && open ? buildNightSummary(log, profile, water) : null),
    [profile, log, water, open],
  );

  if (!summary || !profile) {
    return (
      <Sheet open={open} onClose={onClose} title="Rückblick">
        <p className="t-sub">Für heute Abend ist noch nichts eingetragen.</p>
      </Sheet>
    );
  }

  const tiles: [string, string][] = [
    [formatBac(summary.peakBac), 'Höchster Pegel'],
    [summary.standardDrinks.toFixed(1).replace('.', ','), 'Standardgläser'],
    [`${Math.round(summary.totalGrams)} g`, 'Reiner Alkohol'],
    [String(summary.calls), 'Trinkansagen'],
    [String(summary.water), 'Gläser Wasser'],
    [formatTime(summary.soberAt), 'Nüchtern gegen'],
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Der Abend in Zahlen">
      <div className="stack">
        <div className="review">
          <div className="t-upper">
            {formatTime(summary.from)} – {formatTime(summary.to)} Uhr
          </div>
          <div className="review__grid">
            {tiles.map(([value, label], i) => (
              <div key={label} className="review__tile" style={{ ['--i' as string]: i }}>
                <div className="review__value t-mono-num">{value}</div>
                <div className="t-caption">{label}</div>
              </div>
            ))}
          </div>
          <div className="stack-2">
            {summary.topGame && (
              <div className="row t-sub">
                <Icon name="games" size={16} /> Meistgespielt: {summary.topGame}
              </div>
            )}
            {summary.topDrink && (
              <div className="row t-sub">
                <Icon name="cocktail" size={16} /> Getrunken: {summary.topDrink}
              </div>
            )}
            <div className="row t-sub">
              <Icon name="clock" size={16} /> Höchster Pegel um {formatTime(summary.peakAt)} Uhr
            </div>
          </div>
        </div>

        <button
          className="btn btn--glass btn--block"
          onClick={() => {
            haptic('select');
            void shareNightCard(summary, profile.name);
          }}
        >
          <Icon name="share" size={18} /> Als Bild teilen
        </button>

        <div className="notice notice--neutral">
          Alle Werte sind Schätzungen. Der Rückblick liegt nur auf diesem Gerät – geteilt wird
          ausschliesslich das Bild, das du selbst versendest.
        </div>

        <button
          className="btn btn--danger btn--block"
          onClick={() => {
            haptic('warn');
            onEnd();
            onClose();
          }}
        >
          Abend beenden und Log löschen
        </button>
      </div>
    </Sheet>
  );
}
