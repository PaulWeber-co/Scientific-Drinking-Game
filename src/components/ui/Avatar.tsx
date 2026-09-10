import { Icon } from '../icons';

/** Farbpalette für Spieler-Avatare – ersetzt die Emoji-Auswahl. */
export const AVATAR_COLORS = [
  'indigo',
  'purple',
  'pink',
  'red',
  'orange',
  'yellow',
  'green',
  'mint',
  'teal',
  'blue',
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

export function isAvatarColor(v: unknown): v is AvatarColor {
  return typeof v === 'string' && (AVATAR_COLORS as readonly string[]).includes(v);
}

/** Deterministische Farbe, wenn keine gewählt wurde (z. B. bei Altdaten). */
export function colorFor(seed: string): AvatarColor {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function avatarStyle(color: AvatarColor) {
  return { ['--avatar-color' as string]: `var(--${color})` };
}

/**
 * Avatar: eigenes Foto, sonst Initialen auf einem Farbverlauf.
 *
 * Das Monogramm bleibt der Normalfall und nicht der Ersatz – es skaliert
 * sauber, lässt sich einfärben und sieht auf allen Plattformen gleich aus.
 * Wer ein Bild hinterlegt hat, sieht es überall dort, wo die eigene Person
 * auftaucht; die Farbe bleibt als Rand stehen, damit die Zuordnung in der
 * Runde erhalten bleibt (in Ranglisten und Chips erkennt man sie schneller
 * als ein 26 Pixel grosses Gesicht).
 */
export function Avatar({
  name,
  color,
  photo,
  size = 'md',
  className = '',
}: {
  name: string;
  color: AvatarColor;
  /** Eigenes Bild als Data-URL. Kommt aus `Profile.photo`. */
  photo?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const text = initials(name);
  return (
    <span
      className={`avatar avatar--${size} ${photo ? 'avatar--foto' : ''} ${className}`}
      style={avatarStyle(color)}
      aria-hidden="true"
    >
      {photo ? (
        <img className="avatar__img" src={photo} alt="" />
      ) : (
        text || <Icon name="person" size={size === 'lg' ? 28 : size === 'sm' ? 15 : 19} />
      )}
    </span>
  );
}
