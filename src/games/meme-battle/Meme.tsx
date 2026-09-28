import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { formatStamp } from '../../lib/format';
import { memeUrl, type MemeBox, type MemeTemplate } from './templates';

/**
 * Ein Meme: die Vorlage als Bild, darüber die Texte an ihren Feldern.
 *
 * Die Texte sind echter DOM-Text, kein eingebranntes Bild. So bleibt jedes
 * Meme bis zur letzten Sekunde änderbar und reist als ein paar Byte Text
 * statt als Bilddatei über die Leitung. Erst beim Speichern wird gerechnet
 * (siehe `render.ts`).
 */
export function MemeImage({
  template,
  texts,
  editing,
  active,
  onBox,
}: {
  template: MemeTemplate;
  texts: string[];
  /** Im Editor: leere Felder als gestrichelter Rahmen mit Nummer. */
  editing?: boolean;
  active?: number;
  onBox?: (index: number) => void;
}) {
  return (
    <div className="md-meme" style={{ aspectRatio: `${template.w} / ${template.h}` }}>
      <img
        className="md-meme__img"
        src={memeUrl(template.id)}
        alt={template.name}
        draggable={false}
        decoding="async"
      />
      {template.boxes.map((box, i) => (
        <MemeText
          key={i}
          box={box}
          text={texts[i] ?? ''}
          index={i}
          editing={editing}
          active={active === i}
          onTap={onBox ? () => onBox(i) : undefined}
        />
      ))}
    </div>
  );
}

function MemeText({
  box,
  text,
  index,
  editing,
  active,
  onTap,
}: {
  box: MemeBox;
  text: string;
  index: number;
  editing?: boolean;
  active?: boolean;
  onTap?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const upper = box.s !== 'none';
  const shown = upper ? text.toLocaleUpperCase('de-DE') : text;

  // Die größte Schrift, die ins Feld passt. Direkt am Element gesetzt statt
  // über State: ein Rendern je Messschritt wären zwölf pro Tastendruck.
  useLayoutEffect(() => {
    const el = ref.current;
    const frame = el?.parentElement;
    if (!el || !frame) return;
    const fit = () => {
      const w = frame.clientWidth;
      const h = frame.clientHeight;
      if (!w || !h || !el.textContent) return;
      let lo = 5;
      let hi = Math.max(lo, Math.min(h, w * 0.5));
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        el.style.fontSize = `${mid}px`;
        if (el.scrollWidth <= w + 0.5 && el.scrollHeight <= h + 0.5) lo = mid;
        else hi = mid;
      }
      el.style.fontSize = `${lo}px`;
    };
    fit();
    // Die Meme-Schrift kommt nachgeladen – mit der Ersatzschrift gemessen
    // wäre der Text danach zu groß oder zu klein.
    let alive = true;
    document.fonts?.ready.then(() => alive && fit()).catch(() => {});
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(frame);
    return () => {
      alive = false;
      ro?.disconnect();
    };
  }, [shown, box.f]);

  const style: CSSProperties = {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
    transform: box.r ? `rotate(${-box.r}deg)` : undefined,
    textAlign: box.a ?? 'center',
    ['--ink' as string]: box.c ?? '#fff',
  };
  const cls = [
    'md-box',
    `md-box--${box.f ?? 'thick'}`,
    box.c === 'black' ? 'md-box--dark' : '',
    editing ? 'md-box--edit' : '',
    editing && !text ? 'md-box--empty' : '',
    active ? 'md-box--active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <span ref={ref} className="md-box__text">
      {shown}
    </span>
  );

  if (onTap) {
    return (
      <button
        type="button"
        className={cls}
        style={style}
        onClick={onTap}
        aria-label={`Feld ${index + 1}`}
      >
        {editing && !text && <span className="md-box__no">{index + 1}</span>}
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

/**
 * Der Abzug um ein Meme – dasselbe Papier wie die Spielkarten und das Album.
 * Unten im breiten Rand steht, wovon das Bild erzählt: Runde, Name, Punkte.
 */
export function MemePrint({
  children,
  caption,
  badge,
  tilt = 0,
  stamp = true,
  ar,
  className = '',
  style,
}: {
  children: ReactNode;
  caption?: ReactNode;
  badge?: ReactNode;
  tilt?: number;
  stamp?: boolean;
  /** Seitenverhältnis des Bildes – damit hohe Vorlagen nicht aus dem Bildschirm wachsen. */
  ar?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`abzug md-print ${className}`}
      style={{
        ...style,
        ['--tilt' as string]: `${tilt}deg`,
        ...(ar ? { ['--ar' as string]: ar } : null),
      }}
    >
      <div className="md-print__foto">{children}</div>
      {caption && <div className="md-print__caption">{caption}</div>}
      {stamp && (
        <span className="abzug__stempel md-print__stamp" aria-hidden>
          {formatStamp()}
        </span>
      )}
      {badge}
    </div>
  );
}

/** Punkte als runder Aufkleber am Abzug, wie auf dem Kachelmotiv. */
export function PointsBadge({ points, tone }: { points: number; tone?: 'gold' | 'mint' | 'red' }) {
  const t = tone ?? (points < 0 ? 'red' : 'mint');
  return (
    <span className={`md-badge md-badge--${t} t-mono-num`}>
      {points > 0 ? '+' : points < 0 ? '−' : '±'}
      {Math.abs(points)}
    </span>
  );
}
