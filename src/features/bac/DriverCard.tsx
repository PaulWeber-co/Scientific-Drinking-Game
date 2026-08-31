import { formatTime } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { Icon } from '../../components/icons';
import { usePlayer } from '../../store/player';

/**
 * Eigene Bühne für die Person, die heute fährt: sichtbar, mit Wasserzähler
 * statt Trinkansage. Der alkoholfreie Modus allein reicht nicht – er ist
 * unsichtbar, und genau deshalb wird trotzdem nachgeschenkt.
 */
export function DriverCard() {
  const profile = usePlayer((s) => s.profile);
  const water = usePlayer((s) => s.waterCount);
  const addWater = usePlayer((s) => s.addWater);
  const log = usePlayer((s) => s.log);

  if (!profile?.designatedDriver) return null;
  const lastDrink = log.length ? Math.max(...log.map((e) => e.at)) : null;

  return (
    <section className="card card--pad-lg stack-3 drivercard">
      <div className="row">
        <span className="drivercard__badge">
          <Icon name="car" size={19} />
        </span>
        <div className="grow">
          <div className="t-headline">Du fährst heute</div>
          <div className="t-caption">
            {lastDrink
              ? `Letzter Drink um ${formatTime(lastDrink)} – ab jetzt nur noch Wasser.`
              : 'Alle Trinkansagen werden für dich zu Aufgaben.'}
          </div>
        </div>
      </div>
      <div className="row-between">
        <div className="row" style={{ gap: 6 }}>
          {Array.from({ length: Math.max(4, water) }, (_, i) => (
            <Icon
              key={i}
              name="water"
              size={20}
              className={i < water ? 'drivercard__glass--on' : 'drivercard__glass'}
            />
          ))}
        </div>
        <button
          className="btn btn--sm btn--tinted"
          style={{ ['--tint' as string]: 'var(--teal)' }}
          onClick={() => {
            haptic('success');
            addWater();
          }}
        >
          <Icon name="plus" size={15} /> Wasser
        </button>
      </div>
    </section>
  );
}
