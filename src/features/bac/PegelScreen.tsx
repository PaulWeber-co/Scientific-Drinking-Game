import { useMemo, useState } from 'react';
import {
  BETA_CONSERVATIVE,
  BETA_TYPICAL,
} from '../../engine/constants';
import { ZONE_META, bacZone, drivingLight, estimateBac, residualBac, soberAt } from '../../engine/bac';
import { alcoholPerSip } from '../../engine/drinks';
import { formatBac, formatDuration, formatTime } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { NavBar, Sheet, Stepper } from '../../components/ui';
import { BacGauge } from './BacGauge';
import { useLiveBac } from './useLiveBac';
import { DrinkPicker } from '../drinks/DrinkPicker';
import { useCurrentDrink, usePlayer } from '../../store/player';

const HOUR = 3_600_000;

export function PegelScreen() {
  const profile = usePlayer((s) => s.profile);
  const log = usePlayer((s) => s.log);
  const logSips = usePlayer((s) => s.logSips);
  const undoLast = usePlayer((s) => s.undoLast);
  const endNight = usePlayer((s) => s.endNight);
  const drink = useCurrentDrink();
  const { estimate, now } = useLiveBac();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [manualSips, setManualSips] = useState(4);
  const [driveHour, setDriveHour] = useState(8);

  const series = useMemo(() => {
    if (!profile || !log.length) return [];
    const start = Math.min(...log.map((e) => e.at)) - 15 * 60_000;
    const end = now + 5 * HOUR;
    const points: { t: number; bac: number }[] = [];
    for (let i = 0; i <= 36; i++) {
      const t = start + ((end - start) * i) / 36;
      points.push({ t, bac: estimateBac(log, profile, t).bac });
    }
    return points;
  }, [log, profile, now]);

  if (!profile) return null;

  const zone = ZONE_META[bacZone(estimate?.bac ?? 0)];
  const totalG = log.reduce((s, e) => s + e.alcoholGrams, 0);
  const standardDrinks = totalG / 12; // 1 Standardglas = 12 g reiner Alkohol
  const sober = log.length ? soberAt(log, profile, now) : null;

  const driveTarget = (() => {
    const d = new Date(now);
    d.setHours(driveHour, 0, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  })();
  const driveBac = log.length ? residualBac(log, profile, driveTarget) : 0;
  const light = drivingLight(driveBac);

  return (
    <div className="screen">
      <NavBar title="Pegel" />
      <div className="stack-6">
        <section className="card card--pad-lg stack-3">
          <BacGauge
            bac={estimate?.bac ?? 0}
            pending={estimate?.pending ?? 0}
            target={profile.targetBac}
            label={
              estimate && estimate.pending > 0.01
                ? `+${formatBac(estimate.pending)} noch im Magen`
                : `Ziel ${formatBac(profile.targetBac)}`
            }
          />
          <p className="t-sub t-center t-balance">{zone.note}</p>
        </section>

        <section className="statgrid">
          <Stat label="Reiner Alkohol" value={`${totalG.toFixed(0)} g`} />
          <Stat label="Standardgläser" value={de(standardDrinks, 1)} />
          <Stat label="Ansagen" value={String(log.length)} />
          <Stat
            label="Verteilungsfaktor"
            value={estimate ? de(estimate.r, 2) : '–'}
            hint={estimate?.rSource === 'watson' ? 'Watson' : 'Standard'}
          />
        </section>

        {series.length > 1 && (
          <section className="card stack-3">
            <div className="row-between">
              <div className="t-upper">Verlauf & Prognose</div>
              <div className="t-caption">bis {formatTime(series[series.length - 1].t)}</div>
            </div>
            <BacChart points={series} now={now} target={profile.targetBac} />
          </section>
        )}

        <section className="card stack-3">
          <div className="t-upper">Fahrtauglichkeit</div>
          <p className="t-sub">Ich muss fahren um …</p>
          <Stepper value={driveHour} onChange={setDriveHour} min={0} max={23} unit=":00 Uhr" />
          <div className={`lightbox lightbox--${light}`}>
            <div className="lightbox__dot" />
            <div className="grow">
              <div className="t-headline">
                {light === 'green'
                  ? 'Rechnerisch nüchtern'
                  : light === 'yellow'
                    ? 'Noch Restalkohol'
                    : 'Auf keinen Fall fahren'}
              </div>
              <div className="t-caption">
                Geschätzt {formatBac(driveBac)} ‰ um {String(driveHour).padStart(2, '0')}:00
                Uhr · konservativ mit {de(BETA_CONSERVATIVE, 2)} ‰/h gerechnet
              </div>
            </div>
          </div>
          {sober && (
            <div className="t-caption">
              Voraussichtlich nüchtern gegen <strong>{formatTime(sober)}</strong> (in{' '}
              {formatDuration(sober - now)}). Der Durchschnittswert liegt bei{' '}
              {de(BETA_TYPICAL, 2)} ‰/h – wir rechnen absichtlich langsamer.
            </div>
          )}
          <div className="notice notice--red">
            Auch bei „grün" gilt: Die Rechnung ist eine Schätzung. Wer getrunken hat, fährt nicht.
          </div>
        </section>

        <section className="stack-3">
          <div className="row-between">
            <h2 className="t-title2">Trink-Log</h2>
            <button className="chip pressable" onClick={() => setPickerOpen(true)}>
              {drink.emoji} {drink.name}
            </button>
          </div>
          <div className="grid-2">
            <button className="btn btn--glass" onClick={() => setAddOpen(true)}>
              + Selbst getrunken
            </button>
            <button className="btn btn--gray" disabled={!log.length} onClick={() => {
              haptic('warn');
              undoLast();
            }}>
              Rückgängig
            </button>
          </div>
          {log.length ? (
            <div className="list">
              {[...log]
                .reverse()
                .slice(0, 20)
                .map((e) => (
                  <div key={e.id} className="list__item">
                    <span className="grow">
                      <span className="t-headline" style={{ display: 'block' }}>
                        {e.sips}× {e.drinkName}
                      </span>
                      <span className="t-caption">
                        {formatTime(e.at)} · {e.alcoholGrams.toFixed(1)} g
                        {e.source ? ` · ${e.source}` : ''}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="notice notice--neutral">
              Noch nichts getrunken. Trinkansagen aus den Spielen landen automatisch hier.
            </div>
          )}
          {log.length > 0 && (
            <button
              className="btn btn--danger btn--block"
              onClick={() => {
                if (confirm('Abend beenden und Trink-Log löschen?')) {
                  haptic('warn');
                  endNight();
                }
              }}
            >
              Abend beenden
            </button>
          )}
        </section>
      </div>

      <DrinkPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Selbst getrunken">
        <div className="stack">
          <p className="t-sub">
            {drink.emoji} {drink.name} · {alcoholPerSip(drink).toFixed(1)} g pro{' '}
            {drink.sipIsUnit ? 'Shot' : 'Schluck'}
          </p>
          <Stepper value={manualSips} onChange={setManualSips} min={1} max={40} unit={drink.sipIsUnit ? ' Shots' : ' Schlucke'} />
          <div className="t-caption t-center">
            entspricht {(manualSips * alcoholPerSip(drink)).toFixed(1)} g reinem Alkohol
          </div>
          <button
            className="btn btn--brand btn--block btn--lg"
            onClick={() => {
              haptic('success');
              logSips(manualSips, 'manuell');
              setAddOpen(false);
            }}
          >
            Eintragen
          </button>
        </div>
      </Sheet>
    </div>
  );
}

/** Deutsche Zahlenschreibweise mit Komma. */
function de(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat__value t-mono-num">{value}</div>
      <div className="t-caption">{label}</div>
      {hint && <div className="t-caption" style={{ opacity: 0.6 }}>{hint}</div>}
    </div>
  );
}

function BacChart({
  points,
  now,
  target,
}: {
  points: { t: number; bac: number }[];
  now: number;
  target: number;
}) {
  const W = 320;
  const H = 110;
  const maxBac = Math.max(target * 1.6, ...points.map((p) => p.bac)) || 0.5;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const x = (t: number) => ((t - t0) / (t1 - t0)) * W;
  const y = (b: number) => H - (b / maxBac) * (H - 8) - 4;
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.t).toFixed(1)} ${y(p.bac).toFixed(1)}`).join(' ');
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Promilleverlauf">
      <defs>
        <linearGradient id="bacfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={y(target)} x2={W} y2={y(target)} stroke="var(--green)" strokeWidth="1" strokeDasharray="4 4" opacity="0.8" />
      <path d={area} fill="url(#bacfill)" />
      <path d={path} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <line x1={x(now)} y1="0" x2={x(now)} y2={H} stroke="var(--label-3)" strokeWidth="1" />
      <circle cx={x(now)} cy={y(points.reduce((a, p) => (Math.abs(p.t - now) < Math.abs(a.t - now) ? p : a)).bac)} r="4" fill="var(--label)" />
    </svg>
  );
}
