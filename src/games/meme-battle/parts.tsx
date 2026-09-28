import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { haptic, hapticRamp } from '../../lib/haptics';
import { renderMeme, shareMeme } from './render';
import { templateOf } from './templates';

/**
 * Die Uhr als Leiste, die abbrennt – statt einer großen Zahl, die mit dem
 * Meme um Aufmerksamkeit kämpft. Die Sekunden stehen trotzdem daneben.
 *
 * Die Leiste läuft als EINE CSS-Animation über die Restzeit, nicht in
 * Viertelsekunden-Schritten: so gleitet sie mit 60 bzw. 120 Bildern pro
 * Sekunde, ohne dass React dafür rendert.
 *
 * `feel`: Zehn Sekunden vor Schluss ein Warnstoß, in den letzten fünf ein
 * Ticken, das härter wird – wie der Zünder der Wortbombe.
 */
export function TimerBar({ until, total, feel }: { until: number; total: number; feel?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [until]);
  const left = Math.max(0, until - now);
  const s = Math.ceil(left / 1000);

  // Startwert und Dauer nur beim Aufziehen der Uhr festlegen – ein Nachrechnen
  // bei jedem Rendern startete die Animation ständig neu.
  const [burn] = useState(() => {
    const rest = Math.max(0, until - Date.now());
    return { from: total > 0 ? Math.min(1, rest / total) : 0, ms: rest };
  });

  const lastFelt = useRef<number | null>(null);
  useEffect(() => {
    if (!feel || s === lastFelt.current) return;
    lastFelt.current = s;
    if (s === 10) haptic('warn');
    else if (s > 0 && s <= 5) hapticRamp((6 - s) / 5);
  }, [s, feel]);

  return (
    <div
      className={`md-timer ${s <= 10 ? 'md-timer--hot' : ''}`}
      role="timer"
      aria-label={`Noch ${s} Sekunden`}
    >
      <Icon name="timer" size={15} />
      <div className="md-timer__track">
        <div
          className="md-timer__fill"
          style={{
            ['--from' as string]: burn.from,
            animationDuration: `${burn.ms}ms`,
          }}
        />
      </div>
      <span className="md-timer__s t-mono-num">{s}</span>
    </div>
  );
}

/** Das Thema der Runde als Zettel mit Klebeband über dem Abzug. */
export function TopicNote({ text }: { text: string }) {
  return (
    <div className="md-topic">
      <span className="md-topic__tape" aria-hidden />
      <span className="md-topic__kicker">Thema</span>
      <span className="md-topic__text t-balance">{text}</span>
    </div>
  );
}

/** Fire, OK, Lame als kleine Zählung unter einem Abzug. */
export function Tally({ up, meh, down }: { up: number; meh: number; down: number }) {
  return (
    <span className="md-tally t-mono-num" aria-label={`${up}× Fire, ${meh}× OK, ${down}× Lame`}>
      <span className="md-tally__up">
        <Icon name="flame" size={13} /> {up}
      </span>
      <span className="md-tally__meh">
        <Icon name="minus" size={13} /> {meh}
      </span>
      <span className="md-tally__down">
        <Icon name="arrowDown" size={13} /> {down}
      </span>
    </span>
  );
}

export function tallyOf(votes: Record<string, number> | undefined) {
  const all = Object.values(votes ?? {});
  return {
    up: all.filter((v) => v === 1).length,
    meh: all.filter((v) => v === 0).length,
    down: all.filter((v) => v === -1).length,
  };
}

/** Kleine Neigung je Abzug – ein Stapel echter Bilder liegt nie gerade. */
export function tiltFor(seed: string, spread = 3): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * spread;
}

/** In so vielen Rasten läuft das Zählwerk unter dem Daumen aus. */
const COUNT_STEPS = 8;

/**
 * Zählt vom alten zum neuen Punktestand – auch ins Minus, mit sanftem Auslaufen.
 * Ohne Bewegung (reduzierte Animationen) steht sofort die Endzahl da.
 *
 * `feel`: Das Zählwerk rastet spürbar ein – schnell am Anfang, dann immer
 * langsamer wie ein auslaufendes Rad. Nur für die eigene Zeile, sonst ratterten
 * acht Zählwerke gleichzeitig.
 */
export function CountTo({
  from,
  to,
  delay = 350,
  feel,
}: {
  from: number;
  to: number;
  delay?: number;
  feel?: boolean;
}) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    const still =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (from === to || still || typeof requestAnimationFrame === 'undefined') {
      setValue(to);
      return;
    }
    let raf = 0;
    let step = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / 900));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      // Rasten nach dem gebremsten Fortschritt, nicht nach der Zeit: so liegen
      // sie vorne dicht und hinten weit auseinander.
      const reached = Math.floor(eased * COUNT_STEPS);
      if (feel && reached > step) {
        step = reached;
        haptic(reached >= COUNT_STEPS ? (to > from ? 'press' : 'tap') : 'tick');
      }
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delay, feel]);
  return <>{value}</>;
}

/**
 * Speichert ein Meme als Abzug – in die Fotos oder ins Teilen-Menü. Erst
 * hier wird aus Text und Vorlage ein Bild gerechnet.
 */
export function SaveMeme({
  meme,
  caption,
  label = 'Speichern',
  compact,
}: {
  meme: { t: string; x: string[] };
  caption: string;
  label?: string;
  /** Nur das Symbol – für enge Kopfzeilen. */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`btn btn--sm btn--glass md-save ${compact ? 'md-save--icon' : ''}`}
      aria-label={compact ? `${label}: ${caption}` : undefined}
      disabled={busy}
      onClick={async () => {
        const template = templateOf(meme.t);
        if (!template) return;
        setBusy(true);
        haptic('tap');
        try {
          const blob = await renderMeme(template, meme.x, caption);
          await shareMeme(blob, `meme-duell-${meme.t}`);
          haptic('success');
        } catch (e) {
          console.error('Meme speichern fehlgeschlagen', e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="share" size={16} />
      {!compact && (busy ? 'Einen Moment …' : label)}
    </button>
  );
}
