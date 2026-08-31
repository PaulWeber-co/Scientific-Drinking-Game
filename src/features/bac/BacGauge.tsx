import { bacZone, ZONE_META } from '../../engine/bac';
import { formatBac } from '../../lib/format';

const MAX = 1.2;
const R = 78;
const CIRC = Math.PI * R; // Halbkreis

/** Halbkreis-Anzeige des aktuellen Pegels mit Zielmarke und offenem Nachschub. */
export function BacGauge({
  bac,
  pending = 0,
  target,
  label,
}: {
  bac: number;
  pending?: number;
  target: number;
  label?: string;
}) {
  const zone = bacZone(bac);
  const meta = ZONE_META[zone];
  const frac = (v: number) => Math.min(1, Math.max(0, v / MAX));
  const targetAngle = 180 * frac(target);

  return (
    <div className="gauge">
      <svg viewBox="0 0 200 116" className="gauge__svg" role="img" aria-label={`Pegel ${formatBac(bac)} Promille`}>
        <defs>
          <linearGradient id="gauge-track" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--teal)" />
            <stop offset="26%" stopColor="var(--blue)" />
            <stop offset="42%" stopColor="var(--green)" />
            <stop offset="62%" stopColor="var(--orange)" />
            <stop offset="100%" stopColor="var(--red)" />
          </linearGradient>
        </defs>
        <path
          d={`M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.55"
        />
        {pending > 0.004 && (
          <path
            d={`M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`}
            fill="none"
            stroke="var(--label-4)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${CIRC * frac(bac + pending)} ${CIRC}`}
          />
        )}
        {bac > 0.004 && (
          <path
            d={`M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`}
            fill="none"
            stroke="url(#gauge-track)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${CIRC * frac(bac)} ${CIRC}`}
            className="gauge__value"
          />
        )}
        {/* Zielmarke */}
        <g transform={`rotate(${targetAngle - 180} 100 100)`}>
          <line x1={100 - R - 9} y1="100" x2={100 - R + 9} y2="100" stroke="var(--label)" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
      <div className="gauge__center">
        <div className="gauge__value-text t-mono-num">{formatBac(bac)}</div>
        <div className="gauge__unit">Promille</div>
      </div>
      <div className="gauge__foot">
        <span className="chip" style={{ ['--tint' as string]: meta.color }}>
          {meta.label}
        </span>
        <span className="t-caption">{label ?? `Ziel ${formatBac(target)}`}</span>
      </div>
    </div>
  );
}
