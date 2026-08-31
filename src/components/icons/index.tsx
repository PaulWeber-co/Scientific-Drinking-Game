import type { CSSProperties, ReactNode } from 'react';

/**
 * Eigenes Icon-Set statt Emojis.
 *
 * Alle Icons teilen dasselbe Raster (24x24), dieselbe Strichstärke und
 * `currentColor` – dadurch passen sie sich Textfarbe und Akzentfarbe an und
 * sehen auf jedem Gerät identisch aus. Emojis tun das nicht: sie sehen auf
 * iOS, Android und Windows unterschiedlich aus und lassen sich nicht einfärben.
 */
export type IconName =
  // Navigation
  | 'home' | 'games' | 'people' | 'chart' | 'person' | 'settings'
  // Aktionen
  | 'plus' | 'minus' | 'close' | 'check' | 'chevronRight' | 'chevronUp' | 'chevronDown'
  | 'share' | 'undo' | 'trash' | 'refresh' | 'phone' | 'qr'
  // Zustände & Hinweise
  | 'flame' | 'droplet' | 'car' | 'clock' | 'timer' | 'alert' | 'info' | 'lock' | 'sparkles'
  | 'trophy' | 'wifi' | 'wifiOff'
  // Spiel-Kategorien
  | 'phoneOff' | 'cards' | 'chat' | 'brush' | 'bolt' | 'team' | 'activity' | 'eyeOff'
  // Spiele
  | 'fork' | 'crown' | 'shuffle' | 'bomb' | 'ban' | 'quotes' | 'ranking' | 'bus' | 'burst'
  // Getränke
  | 'beerMug' | 'beerBottle' | 'wine' | 'flute' | 'cocktail' | 'tumbler' | 'tallGlass'
  | 'shot' | 'water'
  // Kartenfarben
  | 'spade' | 'heart' | 'diamond' | 'club'
  // Sonstiges
  | 'arrowUp' | 'arrowDown' | 'swap' | 'target' | 'logo' | 'brackets' | 'outward';

const P: Record<IconName, ReactNode> = {
  home: <><path d="M3.2 10.6 12 3.4l8.8 7.2" /><path d="M5.6 9.4V20a.8.8 0 0 0 .8.8h11.2a.8.8 0 0 0 .8-.8V9.4" /><path d="M9.8 20.8v-5.4h4.4v5.4" /></>,
  games: <><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.6" /><circle cx="8.6" cy="8.6" r="1.15" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" /><circle cx="15.4" cy="15.4" r="1.15" fill="currentColor" stroke="none" /></>,
  people: <><circle cx="9" cy="8" r="3.1" /><path d="M3.4 19.4c.5-2.9 2.8-4.7 5.6-4.7s5.1 1.8 5.6 4.7" /><path d="M16.2 6.2a3 3 0 0 1 0 5.9" /><path d="M17.6 14.9c1.7.6 2.8 2 3.1 4.1" /></>,
  chart: <><path d="M3.4 20.2h17.2" /><path d="M4.4 16.2c2.6 0 3.4-7.4 6-7.4s3 5.2 5 5.2 2.4-4.4 4.2-6.6" /></>,
  person: <><circle cx="12" cy="8.2" r="3.6" /><path d="M4.6 20.4c.7-3.8 3.6-6.1 7.4-6.1s7 2.3 7.7 6.1" /></>,
  settings: <><circle cx="12" cy="12" r="2.9" /><path d="M12 2.8v2.4M12 18.8v2.4M4.5 12H2.1M21.9 12h-2.4M6.7 6.7 5 5M19 19l-1.7-1.7M6.7 17.3 5 19M19 5l-1.7 1.7" /></>,

  plus: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  minus: <path d="M5.2 12h13.6" />,
  close: <path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6" />,
  check: <path d="M4.8 12.6 9.6 17.4 19.2 6.8" />,
  chevronRight: <path d="M9.4 5.6 15.8 12l-6.4 6.4" />,
  chevronUp: <path d="M5.6 14.6 12 8.2l6.4 6.4" />,
  chevronDown: <path d="M5.6 9.4 12 15.8l6.4-6.4" />,
  share: <><path d="M12 15.4V3.6" /><path d="M8.4 7.2 12 3.6l3.6 3.6" /><path d="M6.4 11.4H5.2a1.6 1.6 0 0 0-1.6 1.6v6.2a1.6 1.6 0 0 0 1.6 1.6h13.6a1.6 1.6 0 0 0 1.6-1.6V13a1.6 1.6 0 0 0-1.6-1.6h-1.2" /></>,
  undo: <><path d="M4 9.6h8.8a5.6 5.6 0 0 1 0 11.2H8" /><path d="M7.6 5.2 3.6 9.6l4 4.4" /></>,
  trash: <><path d="M4.6 6.8h14.8" /><path d="M9.4 6.8V4.6h5.2v2.2" /><path d="M6.6 6.8 7.6 20a1 1 0 0 0 1 .9h6.8a1 1 0 0 0 1-.9l1-13.2" /><path d="M10.4 10.6v6.2M13.6 10.6v6.2" /></>,
  refresh: <><path d="M20.2 12a8.2 8.2 0 1 1-2.5-5.9" /><path d="M20.4 3.8v4.9h-4.9" /></>,
  phone: <><rect x="6.4" y="2.6" width="11.2" height="18.8" rx="2.6" /><path d="M10.6 18.2h2.8" /></>,
  qr: <><rect x="3.6" y="3.6" width="6.4" height="6.4" rx="1.6" /><rect x="14" y="3.6" width="6.4" height="6.4" rx="1.6" /><rect x="3.6" y="14" width="6.4" height="6.4" rx="1.6" /><path d="M14 14h2.6v2.6H14zM17.8 17.8h2.6v2.6h-2.6zM14 20.4h1.4M20.4 14v1.4" /></>,

  flame: <><path d="M12 21c3.5 0 6.2-2.5 6.2-5.9 0-4.4-4.3-6-4.9-12.1-2.4 1.6-3.6 4-3.6 6.2 0 1.2.4 2 .4 2.6 0 .9-.7 1.5-1.5 1.5-1 0-1.6-.9-1.6-2.2-1.1 1.2-1.2 2.8-1.2 4C5.8 18.5 8.5 21 12 21Z" /></>,
  droplet: <path d="M12 3.2c3.4 4 6 6.9 6 10.1a6 6 0 0 1-12 0c0-3.2 2.6-6.1 6-10.1Z" />,
  car: <><path d="M3.4 16.2v-3.1l1.9-4.4a2 2 0 0 1 1.8-1.2h9.8a2 2 0 0 1 1.8 1.2l1.9 4.4v3.1" /><path d="M3.4 13.1h17.2" /><path d="M4.6 16.2v2.2h2.8v-2.2M16.6 16.2v2.2h2.8v-2.2" /><circle cx="7.6" cy="15" r=".9" fill="currentColor" stroke="none" /><circle cx="16.4" cy="15" r=".9" fill="currentColor" stroke="none" /></>,
  clock: <><circle cx="12" cy="12" r="8.6" /><path d="M12 6.9V12l3.4 2.2" /></>,
  timer: <><circle cx="12" cy="13.6" r="7.6" /><path d="M12 9.6v4M9.6 2.8h4.8M18.6 7 20 5.6" /></>,
  alert: <><path d="M12 3.6 21.2 19.6a.9.9 0 0 1-.8 1.3H3.6a.9.9 0 0 1-.8-1.3Z" /><path d="M12 9.6v4.4" /><circle cx="12" cy="17.4" r="1" fill="currentColor" stroke="none" /></>,
  info: <><circle cx="12" cy="12" r="8.6" /><path d="M12 11.2v5.2" /><circle cx="12" cy="7.9" r="1" fill="currentColor" stroke="none" /></>,
  lock: <><rect x="4.6" y="10.2" width="14.8" height="10.4" rx="2.6" /><path d="M8.2 10.2V7.8a3.8 3.8 0 0 1 7.6 0v2.4" /></>,
  sparkles: <><path d="M12 3.4 13.5 8 18 9.5 13.5 11 12 15.6 10.5 11 6 9.5 10.5 8Z" /><path d="M18.2 15.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z" /></>,
  trophy: <><path d="M7.4 4.2h9.2v5a4.6 4.6 0 0 1-9.2 0Z" /><path d="M7.4 5.8H5.2a2.4 2.4 0 0 0 2.4 4.4M16.6 5.8h2.2a2.4 2.4 0 0 1-2.4 4.4" /><path d="M12 13.8v3.4M8.4 20.2h7.2" /></>,
  wifi: <><path d="M3.4 9.2a13 13 0 0 1 17.2 0M6.6 12.8a8.4 8.4 0 0 1 10.8 0M9.8 16.4a3.9 3.9 0 0 1 4.4 0" /><circle cx="12" cy="19.6" r="1.1" fill="currentColor" stroke="none" /></>,
  wifiOff: <><path d="M3.4 9.2a13 13 0 0 1 5.2-2.9M15.4 6.4a13 13 0 0 1 5.2 2.8M6.6 12.8a8.4 8.4 0 0 1 3-1.9M14.6 11a8.4 8.4 0 0 1 2.8 1.8" /><path d="M3.6 3.6 20.4 20.4" /></>,

  phoneOff: <><rect x="6.4" y="2.6" width="11.2" height="18.8" rx="2.6" /><path d="M3.6 3.6 20.4 20.4" /></>,
  cards: <><rect x="9" y="3.6" width="11.4" height="15.4" rx="2.4" /><path d="M15.6 20.4H6.2a2.4 2.4 0 0 1-2.4-2.4V7.4" /></>,
  chat: <><path d="M20.4 12.6c0 3.8-3.8 6.9-8.4 6.9a10 10 0 0 1-2.5-.3l-5 1.4 1.5-4a6.3 6.3 0 0 1-1.4-4c0-3.8 3.8-6.9 8.4-6.9s7.4 3.1 7.4 6.9Z" /></>,
  brush: <><path d="M15.2 4.4 19.6 8.8 10 18.4a3.1 3.1 0 0 1-4.4-4.4Z" /><path d="M13 6.6 17.4 11" /><path d="M6.4 17.6c-1.4 1.4-1 3.6-2.8 3.6" /></>,
  bolt: <path d="M13.4 2.6 5 13.4h5.6L10.6 21.4 19 10.6h-5.6Z" />,
  team: <><circle cx="7.6" cy="7.8" r="3" /><circle cx="16.4" cy="7.8" r="3" /><path d="M2.8 19.4c.4-2.8 2.3-4.6 4.8-4.6s4.4 1.8 4.8 4.6" /><path d="M12.6 19.4c.4-2.8 2.3-4.6 4.8-4.6 1.6 0 3 .7 3.8 2" /></>,
  activity: <path d="M2.8 12.4h3.6l2.6-6.6 4.4 12.4 2.4-5.8h5.4" />,
  eyeOff: <><path d="M9.8 5.4A9 9 0 0 1 12 5.2c5 0 8.4 4.2 9.4 6a.9.9 0 0 1 0 .8 15 15 0 0 1-2.6 3.3M6.2 7.4A14 14 0 0 0 2.6 11.2a.9.9 0 0 0 0 .8c1 1.8 4.4 6 9.4 6a9.4 9.4 0 0 0 3.6-.7" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3.6 3.6 20.4 20.4" /></>,

  fork: <><path d="M12 20.8v-6.2L6.6 9.2V6.4" /><path d="M12 14.6l5.4-5.4V6.4" /><circle cx="6.6" cy="4.4" r="1.9" /><circle cx="17.4" cy="4.4" r="1.9" /></>,
  crown: <><path d="M3.6 7.2 7 12l5-6.4 5 6.4 3.4-4.8-1.6 11H5.2Z" /><path d="M5.6 20.4h12.8" /></>,
  shuffle: <><path d="M3.4 6.6h3.2c3.6 0 6.2 10.8 9.8 10.8h4.2M3.4 17.4h3.2c1.7 0 3-2.3 4.2-4.9M15 8.4c.5-1 1-1.8 1.6-1.8h4" /><path d="M17.8 3.4 21 6.6l-3.2 3.2M17.8 14.2l3.2 3.2-3.2 3.2" /></>,
  bomb: <><circle cx="10.4" cy="14.6" r="6.6" /><path d="M15.6 10.2 18 7.8" /><path d="M18 7.8c0-1.8.8-2.8 2.4-2.8" /><path d="M16.8 3.4v1.6M20.6 2.6l-.9 1.3" /></>,
  ban: <><circle cx="12" cy="12" r="8.6" /><path d="M6 18 18 6" /></>,
  quotes: <><path d="M20.4 11.6c0 3.4-3.4 6.2-7.6 6.2a9.6 9.6 0 0 1-2-.2l-4.4 1.3 1.3-3.5a5.7 5.7 0 0 1-1.3-3.8c0-3.4 3.4-6.2 7.6-6.2s6.4 2.8 6.4 6.2Z" /><path d="M6.4 19.6c-1.6-.7-2.8-1.9-3.4-3.3" /></>,
  ranking: <><path d="M4 20.4v-5.6h4v5.6M10 20.4V9.4h4v11M16 20.4V4.6h4v15.8" /></>,
  bus: <><rect x="4.2" y="3.6" width="15.6" height="13.4" rx="2.6" /><path d="M4.2 10.6h15.6M9.4 3.6v7" /><path d="M7 17v2.2M17 17v2.2" /><circle cx="8" cy="14" r=".9" fill="currentColor" stroke="none" /><circle cx="16" cy="14" r=".9" fill="currentColor" stroke="none" /></>,
  burst: <path d="M12 2.6 14.2 8l5.6-2.2-2.6 5.4 4.6 3.4-5.8.9 1 5.9-4.6-3.6-4.6 3.6 1-5.9-5.8-.9L8.6 11 6 5.8 11.6 8Z" />,

  beerMug: <><path d="M5.8 7.6h9.4v11.6a1.8 1.8 0 0 1-1.8 1.8H7.6a1.8 1.8 0 0 1-1.8-1.8Z" /><path d="M15.2 10.4h2.2a2.4 2.4 0 0 1 0 4.8h-2.2" /><path d="M5.8 11.4h9.4" /><path d="M5.8 7.6c0-2.1 2.1-3.6 4.7-3.6s4.7 1.5 4.7 3.6" /></>,
  beerBottle: <><path d="M9.4 2.8h5.2v3.4l1.8 2.8v10.4a1.8 1.8 0 0 1-1.8 1.8H9.4a1.8 1.8 0 0 1-1.8-1.8V9l1.8-2.8Z" /><path d="M7.6 12.4h8.8" /></>,
  wine: <><path d="M7 3.4h10l-.6 5.4a4.4 4.4 0 0 1-8.8 0Z" /><path d="M12 13.4v6M8.4 20.4h7.2" /><path d="M7.4 7.4h9.2" /></>,
  flute: <><path d="M8.8 3.4h6.4l-.8 8.2a2.6 2.6 0 0 1-4.8 0Z" /><path d="M12 13.8v6.2M9 20.4h6" /><circle cx="16.8" cy="6.6" r=".8" fill="currentColor" stroke="none" /><circle cx="18.4" cy="10" r=".7" fill="currentColor" stroke="none" /></>,
  cocktail: <><path d="M3.6 4.6h16.8L12 13.2Z" /><path d="M12 13.2v6.2M8.4 20.4h7.2" /><path d="M15.6 6.6c2-2.4 3.4-3.4 5.2-3.6" /></>,
  tumbler: <><path d="M6.4 4.6h11.2l-1 15a1.4 1.4 0 0 1-1.4 1.3H8.8a1.4 1.4 0 0 1-1.4-1.3Z" /><path d="M6.8 11.4h10.4" /></>,
  tallGlass: <><path d="M7.4 3.4h9.2l-1 16.2a1.4 1.4 0 0 1-1.4 1.3h-4.4a1.4 1.4 0 0 1-1.4-1.3Z" /><path d="M14.8 3.4 17.6 1" /><path d="M7.8 9.4h8.4" /></>,
  shot: <><path d="M7.4 5.4h9.2l-1.2 13.4a1.6 1.6 0 0 1-1.6 1.4h-3.6a1.6 1.6 0 0 1-1.6-1.4Z" /><path d="M7.9 11.4h8.2" /></>,
  water: <><path d="M6.6 4.6h10.8l-1.2 14.6a1.6 1.6 0 0 1-1.6 1.5H9.4a1.6 1.6 0 0 1-1.6-1.5Z" /><path d="M7.4 13c1.4 0 1.4-1.2 2.8-1.2s1.4 1.2 2.8 1.2 1.4-1.2 2.8-1.2" /></>,

  spade: <path d="M12 2.8c0 3.4-7 5.9-7 10.4a3.6 3.6 0 0 0 6.1 2.6c-.2 2.6-.9 4.1-2.1 5.4h6c-1.2-1.3-1.9-2.8-2.1-5.4a3.6 3.6 0 0 0 6.1-2.6c0-4.5-7-7-7-10.4Z" fill="currentColor" stroke="none" />,
  heart: <path d="M12 20.4S3.2 15 3.2 9.1a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8c0 5.9-8.8 11.3-8.8 11.3Z" fill="currentColor" stroke="none" />,
  diamond: <path d="M12 2.6 19.4 12 12 21.4 4.6 12Z" fill="currentColor" stroke="none" />,
  club: <path d="M12 2.8a3.7 3.7 0 0 1 2.6 6.3 3.7 3.7 0 1 1 1.3 6.6 3.6 3.6 0 0 1-2.8-1.4c0 2.6.7 4.1 1.9 5.3H9c1.2-1.2 1.9-2.7 1.9-5.3a3.6 3.6 0 0 1-2.8 1.4 3.7 3.7 0 1 1 1.3-6.6A3.7 3.7 0 0 1 12 2.8Z" fill="currentColor" stroke="none" />,
  brackets: <><path d="M8.4 4.6H5.2a1.6 1.6 0 0 0-1.6 1.6v11.6a1.6 1.6 0 0 0 1.6 1.6h3.2M15.6 4.6h3.2a1.6 1.6 0 0 1 1.6 1.6v11.6a1.6 1.6 0 0 1-1.6 1.6h-3.2" /><path d="M12 8.6v6.8" /></>,
  outward: <><path d="M10.4 13.6 4 20M4 15.2V20h4.8M13.6 10.4 20 4M20 8.8V4h-4.8" /></>,
  arrowUp: <><path d="M12 20V4.4" /><path d="M5.8 10.6 12 4.4l6.2 6.2" /></>,
  arrowDown: <><path d="M12 4v15.6" /><path d="M18.2 13.4 12 19.6l-6.2-6.2" /></>,
  swap: <><path d="M4 8.4h13.2M13.6 4.8 17.2 8.4l-3.6 3.6" /><path d="M20 15.6H6.8M10.4 12 6.8 15.6l3.6 3.6" /></>,
  target: <><circle cx="12" cy="12" r="8.6" /><circle cx="12" cy="12" r="4.8" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  logo: <><path d="M5 4.6h14l-1.6 6.6A5.8 5.8 0 0 1 11.8 15 5.8 5.8 0 0 1 6.6 11.2Z" /><path d="M12 15.4v3.8M8.2 19.4h7.6" /></>,
};

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function Icon({ name, size = 20, strokeWidth = 1.7, className, style, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {P[name]}
    </svg>
  );
}

/** Härtegrad als 1–3 Flammen statt Chili-Emojis. */
export function HeatIcons({ level, size = 14 }: { level: number; size?: number }) {
  return (
    <span className="heat" aria-label={`Härtegrad ${level} von 3`}>
      {[1, 2, 3].map((i) => (
        <Icon key={i} name="flame" size={size} className={i <= level ? 'heat--on' : 'heat--off'} />
      ))}
    </span>
  );
}
