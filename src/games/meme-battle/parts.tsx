import { useEffect, useState } from 'react';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import { renderMeme, shareMeme } from './render';
import { templateOf } from './templates';

/**
 * Die Uhr als Leiste, die abbrennt – statt einer großen Zahl, die mit dem
 * Meme um Aufmerksamkeit kämpft. Die Sekunden stehen trotzdem daneben.
 */
export function TimerBar({ until, total }: { until: number; total: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [until]);
  const left = Math.max(0, until - now);
  const pct = total > 0 ? Math.min(1, left / total) : 0;
  const s = Math.ceil(left / 1000);
  return (
    <div
      className={`md-timer ${s <= 10 ? 'md-timer--hot' : ''}`}
      role="timer"
      aria-label={`Noch ${s} Sekunden`}
    >
      <Icon name="timer" size={15} />
      <div className="md-timer__track">
        <div className="md-timer__fill" style={{ transform: `scaleX(${pct})` }} />
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

/** Hoch, meh, runter als kleine Zählung unter einem Abzug. */
export function Tally({ up, meh, down }: { up: number; meh: number; down: number }) {
  return (
    <span className="md-tally t-mono-num" aria-label={`${up} Feuer, ${meh} geht so, ${down} lahm`}>
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

/**
 * Speichert ein Meme als Abzug – in die Fotos oder ins Teilen-Menü. Erst
 * hier wird aus Text und Vorlage ein Bild gerechnet.
 */
export function SaveMeme({
  meme,
  caption,
  label = 'Speichern',
}: {
  meme: { t: string; x: string[] };
  caption: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn--sm btn--glass md-save"
      disabled={busy}
      onClick={async () => {
        const template = templateOf(meme.t);
        if (!template) return;
        setBusy(true);
        haptic('tap');
        try {
          const blob = await renderMeme(template, meme.x, caption);
          await shareMeme(blob, `meme-duell-${meme.t}`);
        } catch (e) {
          console.error('Meme speichern fehlgeschlagen', e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="share" size={16} /> {busy ? 'Einen Moment …' : label}
    </button>
  );
}
