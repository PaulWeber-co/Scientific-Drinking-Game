import { useId, type ReactNode } from 'react';
import { SUITS, kindOf, suitOf, valueOf, type Kind } from './rules';

/**
 * Die Karten von Stichmagie – jede ein eigenes kleines Bild.
 *
 * Alles ist SVG im Raster 100 × 140 (5:7 wie eine echte Spielkarte): scharf in
 * jeder Größe, kein Bild zum Nachladen, und offline in der nativen App
 * genauso da. Keine Emojis, keine fremden Motive.
 *
 * Die linke obere Ecke trägt immer Wert und Zeichen. In der Hand liegen die
 * Karten gefächert übereinander; zu sehen ist oft nur dieser Streifen.
 */

// ---------------------------------------------------------------------------
// Motive der vier Farben
// ---------------------------------------------------------------------------

function Flamme({ fill, inner }: { fill: string; inner: string }) {
  return (
    <g>
      <path
        d="M50 18c7 13 20 22 20 40 0 12-9 22-20 22S30 70 30 58c0-9 5-14 8-19 1 6 3 9 6 11 1-12 1-21 6-32z"
        fill={fill}
      />
      <path
        d="M50 44c4 7 10 11 10 20 0 6-4 10-10 10s-10-4-10-10c0-5 3-7 5-10 1 3 2 4 3 5 0-6 0-10 2-15z"
        fill={inner}
      />
    </g>
  );
}

function Welle({ fill, inner }: { fill: string; inner: string }) {
  return (
    <g>
      <path
        d="M16 62c6-18 22-30 40-28 14 2 24 12 24 24 0 9-7 15-15 15-7 0-12-5-12-11 0-5 4-8 8-8 3 0 5 2 5 4-2-6-8-10-15-9-12 1-20 12-22 26-1 6-1 11 0 15l-13 0c-2-9-2-18 0-28z"
        fill={fill}
      />
      <path
        d="M14 86c8-5 14-5 20 0s12 5 18 0 12-5 18 0 12 5 16 2v7c-6 3-11 2-16-2-6-5-12-5-18 0s-12 5-18 0-12-5-20 0z"
        fill={inner}
      />
    </g>
  );
}

function Blatt({ fill, inner }: { fill: string; inner: string }) {
  return (
    <g>
      <path
        d="M50 16c20 12 28 30 24 48-3 14-12 22-24 26-12-4-21-12-24-26-4-18 4-36 24-48z"
        fill={fill}
      />
      <path
        d="M50 24v70M50 42l-11-8M50 42l11-8M50 56l-15-9M50 56l15-9M50 70l-14-8M50 70l14-8"
        stroke={inner}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

function Sonne({ fill, inner }: { fill: string; inner: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <g>
      {rays.map((a) => (
        <path key={a} d="M50 16l5 14h-10z" fill={fill} transform={`rotate(${a} 50 54)`} />
      ))}
      <circle cx="50" cy="54" r="19" fill={fill} />
      <circle cx="50" cy="54" r="12" fill={inner} />
    </g>
  );
}

const MOTIF = [Flamme, Welle, Blatt, Sonne];

/** Kleines Farbzeichen für Knöpfe, Chips und Ecken. */
export function SuitMark({ suit, size = 18 }: { suit: number; size?: number }) {
  const Motif = MOTIF[suit] ?? Flamme;
  const s = SUITS[suit] ?? SUITS[0];
  return (
    <svg width={size} height={size} viewBox="10 12 80 84" aria-hidden className="sm-suitmark">
      <Motif fill={s.color} inner={s.deep} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sonderkarten – je ein Motiv im Raster 100 × 140
// ---------------------------------------------------------------------------

function Sparkle({
  x,
  y,
  r = 3,
  fill = '#fff6d5',
  opacity = 1,
}: {
  x: number;
  y: number;
  r?: number;
  fill?: string;
  opacity?: number;
}) {
  return (
    <path
      d={`M${x} ${y - r * 2}Q${x + r * 0.35} ${y - r * 0.35} ${x + r * 2} ${y}Q${x + r * 0.35} ${y + r * 0.35} ${x} ${y + r * 2}Q${x - r * 0.35} ${y + r * 0.35} ${x - r * 2} ${y}Q${x - r * 0.35} ${y - r * 0.35} ${x} ${y - r * 2}z`}
      fill={fill}
      opacity={opacity}
    />
  );
}

function MagierArt() {
  return (
    <g>
      <circle cx="72" cy="36" r="11" fill="#fff3c4" />
      <circle cx="77" cy="32" r="10" fill="#2b2170" />
      <path
        d="M52 22c6 10 11 26 16 50 2 8 4 14 6 18H26c4-6 9-14 13-26 5-16 8-30 13-42z"
        fill="#4b3fd6"
      />
      <path d="M52 22c6 10 11 26 16 50 2 8 4 14 6 18H56c0-18-1-40-4-68z" fill="#3a2fb4" />
      <path d="M31 79c12 4 26 4 38 0l3 8c-14 5-30 5-44 0z" fill="#ffcf4a" />
      <ellipse cx="50" cy="92" rx="36" ry="8" fill="#2d2491" />
      <ellipse cx="50" cy="90" rx="34" ry="6" fill="#4b3fd6" />
      <Sparkle x={44} y={52} r={3.2} fill="#ffe28a" />
      <Sparkle x={56} y={66} r={2.2} fill="#ffe28a" />
      <Sparkle x={49} y={38} r={1.6} fill="#ffe28a" />
      <Sparkle x={22} y={42} r={2.4} opacity={0.8} />
      <Sparkle x={80} y={60} r={1.8} opacity={0.7} />
      <Sparkle x={28} y={104} r={1.6} opacity={0.6} />
      <Sparkle x={74} y={108} r={2.2} opacity={0.8} />
    </g>
  );
}

function NarrArt() {
  return (
    <g>
      <path d="M40 80C36 62 26 50 12 46c12-5 26 2 34 16z" fill="#1fb5a3" />
      <path d="M44 78c-2-18 0-36 6-50 6 14 8 32 6 50z" fill="#f2545b" />
      <path d="M60 80c4-18 14-30 28-34-12-5-26 2-34 16z" fill="#1fb5a3" />
      <path d="M40 80C36 62 26 50 12 46c6 1 16 8 22 20 3 5 5 10 6 14z" fill="#138779" />
      <path d="M60 80c4-18 14-30 28-34-6 2-16 9-21 21-3 5-5 9-7 13z" fill="#138779" />
      <path d="M50 28c6 14 8 32 6 50h-6z" fill="#c63a42" />
      <circle cx="12" cy="46" r="5" fill="#ffd24a" />
      <circle cx="50" cy="27" r="5" fill="#ffd24a" />
      <circle cx="88" cy="46" r="5" fill="#ffd24a" />
      <circle cx="10.5" cy="44.5" r="1.6" fill="#fff8d6" />
      <circle cx="48.5" cy="25.5" r="1.6" fill="#fff8d6" />
      <circle cx="86.5" cy="44.5" r="1.6" fill="#fff8d6" />
      <path d="M26 80h48l2 12H24z" fill="#ffd24a" />
      <path
        d="M30 84l4 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4"
        stroke="#b8860b"
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M36 102c4 6 10 9 14 9s10-3 14-9"
        stroke="#fff"
        strokeOpacity=".5"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function DracheArt() {
  return (
    <g>
      <circle cx="50" cy="66" r="34" fill="#ff7a1a" opacity=".22" />
      <path
        d="M52 62c10-16 24-26 42-30-5 7-4 12-8 18-4-1-7 1-8 5-4-1-7 1-8 5-4-1-9 1-12 6z"
        fill="#b3121a"
      />
      <path
        d="M48 62c-10-16-24-26-42-30 5 7 4 12 8 18 4-1 7 1 8 5 4-1 7 1 8 5 4-1 9 1 12 6z"
        fill="#b3121a"
      />
      <path
        d="M52 62c10-16 24-26 42-30-9 5-21 13-30 26-3 4-7 5-12 6zM48 62c-10-16-24-26-42-30 9 5 21 13 30 26 3 4 7 5 12 6z"
        fill="#7d0b11"
      />
      <path d="M50 50c7 5 9 22 6 40-1 8-3 12-6 12s-5-4-6-12c-3-18-1-35 6-40z" fill="#d61e24" />
      <path
        d="M50 102c1 8 6 13 12 13 5 0 8-3 8-7"
        stroke="#d61e24"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M69 108l6-2-3 6z" fill="#d61e24" />
      <path d="M43 44l-5-14 8 9zM57 44l5-14-8 9z" fill="#f4c542" />
      <path d="M50 34c5 2 8 7 8 12 0 5-4 9-8 11-4-2-8-6-8-11 0-5 3-10 8-12z" fill="#e62a2a" />
      <circle cx="46.5" cy="45" r="1.8" fill="#ffe14a" />
      <circle cx="53.5" cy="45" r="1.8" fill="#ffe14a" />
      <path d="M50 57c-4 6-3 12 0 16 3-4 4-10 0-16z" fill="#ffb02e" opacity=".9" />
      <path d="M44 60h12M43 68h14M44 76h12M45 84h10" stroke="#9e1016" strokeWidth="1.4" />
    </g>
  );
}

function FeeArt() {
  return (
    <g>
      <ellipse
        cx="36"
        cy="54"
        rx="13"
        ry="22"
        transform="rotate(-32 36 54)"
        fill="#ffe7fb"
        opacity=".72"
      />
      <ellipse
        cx="64"
        cy="54"
        rx="13"
        ry="22"
        transform="rotate(32 64 54)"
        fill="#ffe7fb"
        opacity=".72"
      />
      <ellipse
        cx="38"
        cy="80"
        rx="9"
        ry="14"
        transform="rotate(28 38 80)"
        fill="#e7fff8"
        opacity=".6"
      />
      <ellipse
        cx="62"
        cy="80"
        rx="9"
        ry="14"
        transform="rotate(-28 62 80)"
        fill="#e7fff8"
        opacity=".6"
      />
      <ellipse
        cx="36"
        cy="54"
        rx="8"
        ry="15"
        transform="rotate(-32 36 54)"
        fill="none"
        stroke="#fff"
        strokeOpacity=".8"
        strokeWidth=".8"
      />
      <ellipse
        cx="64"
        cy="54"
        rx="8"
        ry="15"
        transform="rotate(32 64 54)"
        fill="none"
        stroke="#fff"
        strokeOpacity=".8"
        strokeWidth=".8"
      />
      <path d="M50 56c6 0 9 6 11 16l5 20H34l5-20c2-10 5-16 11-16z" fill="#c42f8f" />
      <path d="M50 56c6 0 9 6 11 16l5 20H52z" fill="#a0237a" />
      <circle cx="50" cy="47" r="7" fill="#ffd9c2" />
      <path d="M43 46c0-6 3-10 7-10s7 4 7 10c-2-3-4-5-7-5s-5 2-7 5z" fill="#ffcb52" />
      <path d="M58 64l14-18" stroke="#fff3b0" strokeWidth="1.8" strokeLinecap="round" />
      <Sparkle x={73} y={44} r={3.4} fill="#fff6b8" />
      <Sparkle x={26} y={30} r={2} opacity={0.8} />
      <Sparkle x={80} y={86} r={1.8} opacity={0.8} />
      <Sparkle x={22} y={98} r={2.4} opacity={0.7} />
      <Sparkle x={62} y={108} r={1.4} opacity={0.8} />
      <Sparkle x={40} y={112} r={1.8} opacity={0.6} />
    </g>
  );
}

function BombeArt() {
  return (
    <g>
      <circle cx="47" cy="78" r="30" fill="#ff8a1e" opacity=".14" />
      <path
        d="M58 46c4-10 12-14 20-14"
        stroke="#c9a46b"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <rect
        x="50"
        y="46"
        width="14"
        height="10"
        rx="2"
        transform="rotate(35 57 51)"
        fill="#565a66"
      />
      <circle cx="47" cy="78" r="25" fill="#23252d" />
      <circle cx="47" cy="78" r="25" fill="none" stroke="#3a3d49" strokeWidth="2" />
      <path
        d="M32 68c3-7 10-12 18-12"
        stroke="#6c7182"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="80" cy="30" r="9" fill="#ffb21e" opacity=".55" />
      <path d="M80 18l3 8 8-3-5 7 7 5-9 0 1 9-5-7-6 6 1-9-8-2 8-4-3-8 7 5z" fill="#ffd94a" />
      <circle cx="80" cy="30" r="3" fill="#fff8d6" />
    </g>
  );
}

function WerwolfArt() {
  return (
    <g>
      <circle cx="54" cy="46" r="27" fill="#f3f0d2" />
      <circle cx="46" cy="40" r="5" fill="#dcd7b0" />
      <circle cx="62" cy="54" r="3.5" fill="#dcd7b0" />
      <circle cx="60" cy="36" r="2.4" fill="#dcd7b0" />
      <path
        d="M20 128l6-26c-4-6-4-14 1-20l4-20 5 10c3-2 7-3 11-2l9-14 1 10 11-4c-1 6-4 10-8 13l10 1c-3 5-8 8-14 9l-3 3c4 8 6 18 6 40z"
        fill="#10131f"
      />
      <path d="M48 70l3 2" stroke="#ffd84a" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6 128c6-14 10-22 16-26l2 26zM76 128c2-10 6-18 12-22 3 8 4 14 6 22z"
        fill="#0b0e18"
      />
      <Sparkle x={20} y={30} r={1.6} opacity={0.8} />
      <Sparkle x={88} y={22} r={1.3} opacity={0.7} />
      <Sparkle x={86} y={82} r={1.2} opacity={0.6} />
    </g>
  );
}

function JongleurArt() {
  return (
    <g>
      <path
        d="M24 88C24 50 76 50 76 88"
        stroke="#fff"
        strokeOpacity=".35"
        strokeWidth="1.6"
        strokeDasharray="3 4"
        fill="none"
      />
      <path
        d="M32 96C30 66 70 60 72 30"
        stroke="#fff"
        strokeOpacity=".22"
        strokeWidth="1.4"
        strokeDasharray="2 4"
        fill="none"
      />
      <circle cx="30" cy="70" r="10" fill="#ff5a4e" />
      <circle cx="50" cy="46" r="10" fill="#ffc93c" />
      <circle cx="70" cy="70" r="10" fill="#3d9bff" />
      <circle cx="27" cy="67" r="3" fill="#fff" opacity=".5" />
      <circle cx="47" cy="43" r="3" fill="#fff" opacity=".5" />
      <circle cx="67" cy="67" r="3" fill="#fff" opacity=".5" />
      <path
        d="M36 104c4-6 9-9 14-9s10 3 14 9"
        stroke="#fff"
        strokeOpacity=".7"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="36" cy="104" r="3.4" fill="#ffd9c2" />
      <circle cx="64" cy="104" r="3.4" fill="#ffd9c2" />
    </g>
  );
}

function WolkeArt() {
  return (
    <g>
      <path d="M52 78l-10 18h8l-6 18 16-24h-8l6-12z" fill="#ffe14a" />
      <path
        d="M28 88l-3 7M36 94l-3 7M66 90l-3 7M74 84l-3 7"
        stroke="#bfe6ff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M26 80c-9 0-14-6-14-13 0-8 6-13 13-13 2-11 11-18 21-18 9 0 16 5 19 13 2-1 4-1 6-1 9 0 16 7 16 16s-7 16-16 16z"
        fill="#f4fbff"
      />
      <path
        d="M26 80c-9 0-14-6-14-13 0-3 1-6 3-8 2 8 9 12 18 12h38c6 0 11-2 14-6 0 1 1 2 1 4 0 7-6 11-15 11z"
        fill="#cfe7fb"
      />
    </g>
  );
}

function WandlerArt() {
  return (
    <g>
      <path d="M50 24c-5 12-8 28-12 42-3 10-6 18-10 24h22z" fill="#5a4be6" />
      <Sparkle x={42} y={60} r={2.2} fill="#ffe28a" />
      <path d="M50 30c4 14 6 30 5 48l-5 12z" fill="#f2545b" />
      <path d="M54 80c6-16 16-26 30-28-10-6-24 0-32 14z" fill="#1fb5a3" />
      <circle cx="84" cy="52" r="4.5" fill="#ffd24a" />
      <circle cx="50" cy="24" r="4" fill="#ffd24a" />
      <ellipse cx="50" cy="92" rx="32" ry="7" fill="#2a2440" />
      <path d="M18 92a32 7 0 0 1 32-7v14a32 7 0 0 1-32-7z" fill="#4b3fd6" />
      <path d="M50 85a32 7 0 0 1 32 7 32 7 0 0 1-32 7z" fill="#ffd24a" />
      <path
        d="M22 112c10 8 22 10 34 6"
        stroke="#fff"
        strokeOpacity=".7"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M58 114l-2 4 5 1"
        stroke="#fff"
        strokeOpacity=".7"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M78 18c-10-8-22-10-34-6"
        stroke="#fff"
        strokeOpacity=".5"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function HexeArt() {
  return (
    <g>
      <path d="M18 116L84 34" stroke="#8a5a2b" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 116l-8 4 6-10c-2-4 0-7 3-8l8 6c-1 4-4 7-9 8z" fill="#d9a441" />
      <path d="M12 118l14-12M16 120l12-10M10 114l14-12" stroke="#b07f2a" strokeWidth="1.2" />
      <path
        d="M58 22c-6 6-14 10-16 22l-8 32h36l-6-26c-2-8 2-16 10-22-6-2-12-3-16-6z"
        fill="#3e1f5c"
      />
      <path d="M42 66h32l2 8H40z" fill="#58d68d" />
      <ellipse cx="56" cy="80" rx="32" ry="7" fill="#2b1442" />
      <ellipse cx="56" cy="78" rx="30" ry="5" fill="#4a2670" />
      <circle cx="30" cy="36" r="4" fill="#9dffc6" opacity=".8" />
      <circle cx="24" cy="48" r="2.6" fill="#9dffc6" opacity=".6" />
      <circle cx="34" cy="26" r="2" fill="#9dffc6" opacity=".5" />
      <Sparkle x={80} y={100} r={2} fill="#c9ffe0" opacity={0.8} />
      <Sparkle x={70} y={112} r={1.4} fill="#c9ffe0" opacity={0.7} />
    </g>
  );
}

function VampirArt() {
  return (
    <g>
      <circle cx="50" cy="42" r="22" fill="#ffdfd6" opacity=".9" />
      <circle cx="50" cy="42" r="22" fill="#ff3b3b" opacity=".18" />
      <path
        d="M50 64c3-4 6-5 8-4 4-8 12-12 22-12 6 0 11 2 16 6-6 0-10 3-12 8-4-2-8-1-10 3-4-3-9-2-11 3-4-2-8 0-9 4-2-2-3-4-4-8zM50 64c-3-4-6-5-8-4-4-8-12-12-22-12-6 0-11 2-16 6 6 0 10 3 12 8 4-2 8-1 10 3 4-3 9-2 11 3 4-2 8 0 9 4 2-2 3-4 4-8z"
        fill="#1a0b10"
      />
      <path d="M46 58l2-6 2 3 2-3 2 6c0 5-2 8-4 8s-4-3-4-8z" fill="#1a0b10" />
      <circle cx="48" cy="60" r=".9" fill="#ff4747" />
      <circle cx="52" cy="60" r=".9" fill="#ff4747" />
      <path
        d="M36 98c4 6 9 9 14 9s10-3 14-9"
        stroke="#ffe9e9"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M43 101l2 6 2-5M53 102l2 5 2-6"
        fill="#fff"
        stroke="#fff"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M49 110c0 3-1 5-2 6" stroke="#c4111c" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Farben der Sonderkarten und Ecken
// ---------------------------------------------------------------------------

interface Look {
  top: string;
  bottom: string;
  ink: string;
  corner: string;
  label: string;
  Art: () => ReactNode;
}

const LOOK: Record<Exclude<Kind, 'num'>, Look> = {
  magier: {
    top: '#2f2585',
    bottom: '#0c0a2a',
    ink: '#ffe28a',
    corner: 'M',
    label: 'Magier',
    Art: MagierArt,
  },
  narr: {
    top: '#1e5f64',
    bottom: '#0b2326',
    ink: '#e7fffb',
    corner: 'N',
    label: 'Narr',
    Art: NarrArt,
  },
  drache: {
    top: '#5e0a0e',
    bottom: '#1b0406',
    ink: '#ffc24a',
    corner: 'D',
    label: 'Drache',
    Art: DracheArt,
  },
  fee: {
    top: '#e36fb8',
    bottom: '#5b2a86',
    ink: '#fff5fb',
    corner: 'F',
    label: 'Fee',
    Art: FeeArt,
  },
  bombe: {
    top: '#3a2a1c',
    bottom: '#0e0b09',
    ink: '#ffb21e',
    corner: 'B',
    label: 'Bombe',
    Art: BombeArt,
  },
  werwolf: {
    top: '#23305e',
    bottom: '#070a18',
    ink: '#f3f0d2',
    corner: 'Ww',
    label: 'Werwolf',
    Art: WerwolfArt,
  },
  jongleur: {
    top: '#7a2fc2',
    bottom: '#2a0d4a',
    ink: '#fff',
    corner: '7½',
    label: 'Jongleur',
    Art: JongleurArt,
  },
  wolke: {
    top: '#5ab4f0',
    bottom: '#1b4f86',
    ink: '#fff',
    corner: '9¾',
    label: 'Wolke',
    Art: WolkeArt,
  },
  wandler: {
    top: '#34306e',
    bottom: '#0f3a3a',
    ink: '#fff',
    corner: 'G',
    label: 'Wandler',
    Art: WandlerArt,
  },
  hexe: {
    top: '#1f5a3a',
    bottom: '#1a0b2e',
    ink: '#b8ffd8',
    corner: 'H',
    label: 'Hexe',
    Art: HexeArt,
  },
  vampir: {
    top: '#5a0710',
    bottom: '#12030a',
    ink: '#ffd6d6',
    corner: 'V',
    label: 'Vampir',
    Art: VampirArt,
  },
};

/** Sternenstaub im Hintergrund – fest verteilt, damit er nicht springt. */
const DUST = [
  [14, 22, 0.9],
  [84, 16, 0.7],
  [20, 118, 0.8],
  [88, 124, 0.6],
  [12, 70, 0.5],
  [90, 94, 0.7],
  [70, 12, 0.5],
  [30, 132, 0.4],
];

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface CardProps {
  /** `null` = verdeckte Karte (Rückseite). */
  id: number | null;
  size?: CardSize;
  className?: string;
  /** Kleines Etikett unten, etwa die gewählte Farbe eines Jongleurs. */
  badge?: ReactNode;
  title?: string;
}

/** Die Karte als Bild. Die Größe setzt CSS über `--cw` (Breite). */
export function MagicCard({ id, size = 'md', className, badge, title }: CardProps) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, '');
  const cls = ['smcard', `smcard--${size}`, className].filter(Boolean).join(' ');
  if (id == null) {
    return (
      <span className={`${cls} smcard--back`} role="img" aria-label={title ?? 'verdeckte Karte'}>
        <CardBack uid={uid} />
      </span>
    );
  }
  const kind = kindOf(id);
  return (
    <span className={cls} role="img" aria-label={title ?? labelOf(id)} data-card={id}>
      {kind === 'num' ? <NumberFace id={id} uid={uid} /> : <SpecialFace kind={kind} uid={uid} />}
      {badge != null && <span className="smcard__badge">{badge}</span>}
    </span>
  );
}

function labelOf(id: number): string {
  const kind = kindOf(id);
  if (kind === 'num') return `${SUITS[suitOf(id)!].name} ${valueOf(id)}`;
  return LOOK[kind].label;
}

function Frame({
  uid,
  top,
  bottom,
  children,
}: {
  uid: string;
  top: string;
  bottom: string;
  children: ReactNode;
}) {
  return (
    <svg viewBox="0 0 100 140" className="smcard__svg" aria-hidden>
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <radialGradient id={`gl${uid}`} cx="0.5" cy="0.45" r="0.55">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="140" rx="9" fill={`url(#bg${uid})`} />
      <rect x="0" y="0" width="100" height="140" rx="9" fill={`url(#gl${uid})`} />
      {DUST.map(([x, y, o], i) => (
        <circle key={i} cx={x} cy={y} r={0.9} fill="#fff" opacity={o * 0.6} />
      ))}
      {children}
      <rect
        x="4"
        y="4"
        width="92"
        height="132"
        rx="6.5"
        fill="none"
        stroke="#ffe9b8"
        strokeOpacity=".45"
        strokeWidth=".9"
      />
    </svg>
  );
}

function Corner({ text, ink, children }: { text: string; ink: string; children?: ReactNode }) {
  const long = text.length > 1;
  return (
    <g>
      <text
        x="11"
        y={long ? 22 : 25}
        textAnchor="middle"
        className="smcard__corner"
        fontSize={long ? 13 : 19}
        fill={ink}
      >
        {text}
      </text>
      {children && <g transform="translate(3.5 28) scale(0.15)">{children}</g>}
    </g>
  );
}

function NumberFace({ id, uid }: { id: number; uid: string }) {
  const suit = suitOf(id)!;
  const value = valueOf(id)!;
  const s = SUITS[suit];
  const Motif = MOTIF[suit];
  return (
    <Frame uid={uid} top={s.color} bottom={s.deep}>
      <g transform="translate(14 22) scale(0.72)" opacity="0.95">
        <Motif fill="rgba(255,255,255,0.9)" inner={s.color} />
      </g>
      <text x="50" y="118" textAnchor="middle" className="smcard__big" fill="#fff" fontSize="34">
        {value}
      </text>
      <Corner text={String(value)} ink="#fff">
        <Motif fill="#fff" inner={s.deep} />
      </Corner>
    </Frame>
  );
}

function SpecialFace({ kind, uid }: { kind: Exclude<Kind, 'num'>; uid: string }) {
  const look = LOOK[kind];
  const Art = look.Art;
  return (
    <Frame uid={uid} top={look.top} bottom={look.bottom}>
      <g transform="translate(5 6) scale(0.9)">
        <Art />
      </g>
      <text
        x="50"
        y="128"
        textAnchor="middle"
        className="smcard__name"
        fill={look.ink}
        fontSize="11"
      >
        {look.label.toUpperCase()}
      </text>
      <Corner text={look.corner} ink={look.ink} />
    </Frame>
  );
}

function CardBack({ uid }: { uid: string }) {
  const points = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg viewBox="0 0 100 140" className="smcard__svg" aria-hidden>
      <defs>
        <linearGradient id={`bk${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#2a1f6e" />
          <stop offset="1" stopColor="#0a0820" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="140" rx="9" fill={`url(#bk${uid})`} />
      <rect
        x="5"
        y="5"
        width="90"
        height="130"
        rx="6"
        fill="none"
        stroke="#e8c26a"
        strokeOpacity=".7"
        strokeWidth="1"
      />
      <rect
        x="9"
        y="9"
        width="82"
        height="122"
        rx="4"
        fill="none"
        stroke="#e8c26a"
        strokeOpacity=".3"
        strokeWidth=".7"
      />
      <circle
        cx="50"
        cy="70"
        r="30"
        fill="none"
        stroke="#e8c26a"
        strokeOpacity=".55"
        strokeWidth=".9"
      />
      <circle
        cx="50"
        cy="70"
        r="22"
        fill="none"
        stroke="#e8c26a"
        strokeOpacity=".35"
        strokeWidth=".7"
      />
      {points.map((a) => (
        <path
          key={a}
          d="M50 40l3 24h-6z"
          fill="#e8c26a"
          opacity=".75"
          transform={`rotate(${a} 50 70)`}
        />
      ))}
      <circle cx="50" cy="70" r="7" fill="#e8c26a" />
      <circle cx="50" cy="70" r="3.4" fill="#2a1f6e" />
      {DUST.map(([x, y, o], i) => (
        <circle key={i} cx={x} cy={y} r={1} fill="#e8c26a" opacity={o * 0.7} />
      ))}
    </svg>
  );
}
