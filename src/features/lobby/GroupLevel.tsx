import { ZONE_META } from '../../engine/bac';
import type { BacZone } from '../../engine/types';
import type { GamePlayer } from '../../games/types';

const ORDER: BacZone[] = ['sober', 'warmup', 'sweet', 'edge', 'over'];

/**
 * Wie steht die Runde? Bewusst nur Zonen, keine Zahlen und keine Namen –
 * so wird aus einem Sicherheitsfeature kein Gruppenzwang.
 */
export function GroupLevel({ players }: { players: GamePlayer[] }) {
  const known = players.filter((p) => p.zone && p.online !== false);
  if (known.length < 2) return null;

  const counts = ORDER.map((z) => ({ zone: z, n: known.filter((p) => p.zone === z).length }));
  const total = known.length;
  const drivers = players.filter((p) => p.driver).length;

  return (
    <section className="card stack-3">
      <div className="row-between">
        <span className="t-upper">Wie steht die Runde</span>
        <span className="t-caption">{total} anonym</span>
      </div>
      <div className="zonebar" role="img" aria-label="Verteilung der Pegel in der Gruppe">
        {counts
          .filter((c) => c.n > 0)
          .map((c) => (
            <span
              key={c.zone}
              className="zonebar__seg"
              style={{
                flexGrow: c.n,
                background: ZONE_META[c.zone].color,
              }}
            />
          ))}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {counts
          .filter((c) => c.n > 0)
          .map((c) => (
            <span key={c.zone} className="chip" style={{ ['--tint' as string]: ZONE_META[c.zone].color }}>
              {c.n}× {ZONE_META[c.zone].label}
            </span>
          ))}
      </div>
      <p className="t-caption t-balance">
        Nur die Zone wird geteilt – keine Promillewerte, keine Namen.
        {drivers > 0 && ` ${drivers} ${drivers === 1 ? 'Person fährt' : 'Personen fahren'} heute.`}
      </p>
    </section>
  );
}
