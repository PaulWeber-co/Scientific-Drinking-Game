import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from '../../components/icons';
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
          placeholder={template.boxes.length === 1 ? 'Dein Text' : `Text ${i + 1}`}
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
  placeholder,
  index,
  editing,
  active,
  onTap,
}: {
  box: MemeBox;
  text: string;
  placeholder: string;
  index: number;
  editing?: boolean;
  active?: boolean;
  onTap?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const upper = box.s !== 'none';
  // Mit Antippen ist das Feld ein <button>, sonst ein <div>. Beim Abgeben
  // wechselt React deshalb das Element aus – und die neue Textzeile hätte
  // ohne erneutes Einpassen wieder die Grundgröße.
  const tappable = !!onTap;
  // Im Editor steht in leeren Feldern „Text 1", „Text 2" – wie auf dem
  // Eingabefeld darunter, damit klar ist, welches Feld wohin gehört.
  const isPlaceholder = !text && !!editing;
  const raw = isPlaceholder ? placeholder : text;
  const shown = upper ? raw.toLocaleUpperCase('de-DE') : raw;

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
      // Unten offen bis 2 px: auf den kleinen Abzügen der Galerie ist ein Feld
      // manchmal nur 9 px hoch. Winzig ist dort besser als übers Bild gelaufen –
      // antippen zeigt das Meme ohnehin groß.
      let lo = 2;
      // Der Platzhalter bleibt klein – sonst füllt „TEXT 1" ein großes Feld aus.
      let hi = Math.max(lo, Math.min(h, w * 0.5, isPlaceholder ? Math.max(12, h * 0.4) : h));
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
  }, [shown, box.f, isPlaceholder, tappable]);

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

  if (tappable) {
    return (
      <button
        type="button"
        className={cls}
        style={style}
        onClick={onTap}
        aria-label={`Feld ${index + 1}`}
      >
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
 *
 * Unten im breiten Rand steht links, wovon das Bild erzählt (Name, Runde,
 * Vorlage), rechts ein Etikett (Punkte, „Mit dabei") oder der Datumsstempel.
 * Beides sitzt IM Papierrand, nie auf dem Bild: ein Aufkleber auf der Ecke
 * deckte sonst genau die Textzeile ab, um die es geht.
 */
export function MemePrint({
  children,
  caption,
  badge,
  tilt = 0,
  stamp = true,
  ar,
  onOpen,
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
  /** Macht den ganzen Abzug antippbar (Galerie → groß ansehen). */
  onOpen?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const right = badge ?? (stamp ? <span className="md-print__stamp">{formatStamp()}</span> : null);
  return (
    <div
      className={`abzug md-print ${onOpen ? 'md-print--open' : ''} ${className}`}
      style={{
        ...style,
        ['--tilt' as string]: `${tilt}deg`,
        ...(ar ? { ['--ar' as string]: ar } : null),
      }}
    >
      <div className="md-print__foto">{children}</div>
      {/* Immer da, auch leer: der breite Rand unten macht den Abzug erst zum Abzug. */}
      <div className="md-print__strip">
        <span className="md-print__caption">{caption}</span>
        {right}
      </div>
      {onOpen && (
        <button
          type="button"
          className="md-print__hit"
          onClick={onOpen}
          aria-label={typeof caption === 'string' ? `${caption} groß ansehen` : 'Groß ansehen'}
        />
      )}
    </div>
  );
}

type LabelTone = 'ink' | 'gold' | 'silver' | 'bronze' | 'red' | 'mint';

/**
 * Ein Prägeetikett wie aus dem Beschriftungsgerät: Band, erhabene Buchstaben,
 * leicht schief aufgeklebt. Passt zu Papier und Datumsstempel – und ist eckig,
 * damit auch lange Zahlen wie „+1000" nicht in einen Kreis gequetscht werden.
 */
export function Label({
  children,
  tone = 'ink',
  icon,
  slap,
  className = '',
}: {
  children: ReactNode;
  tone?: LabelTone;
  icon?: IconName;
  /** Wird mit Schwung aufgeklebt (Auflösung). */
  slap?: boolean;
  className?: string;
}) {
  return (
    <span className={`md-label md-label--${tone} ${slap ? 'md-label--slap' : ''} ${className}`}>
      {icon && <Icon name={icon} size={13} strokeWidth={2.2} />}
      <span className="md-label__text">{children}</span>
    </span>
  );
}

/** Punkte als Etikett: Gold fürs beste, Rot fürs Minus, sonst schwarzes Band. */
export function PointsBadge({
  points,
  tone,
  slap,
}: {
  points: number;
  tone?: LabelTone;
  slap?: boolean;
}) {
  const t = tone ?? (points < 0 ? 'red' : 'ink');
  return (
    <Label tone={t} slap={slap} className="t-mono-num">
      {points > 0 ? '+' : points < 0 ? '−' : '±'}
      {Math.abs(points)}
    </Label>
  );
}
