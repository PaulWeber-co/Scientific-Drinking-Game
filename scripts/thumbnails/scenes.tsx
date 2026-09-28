/**
 * Die Kachel-Motive als Vektorbilder – Platzhalter, bis es echte Fotos gibt.
 *
 * Jede Szene zeichnet in ein Raster von 360 × 480 (3:4, wie die Kachel).
 * `render.mjs` belichtet sie dreifach (1080 × 1440) und schreibt WebP nach
 * `src/assets/games/`.
 *
 * Maßstab ist das Motiv von Stichmagie: ein großes Hauptobjekt mit Tiefe
 * (Verläufe, Glanzlicht, Schlagschatten), dahinter ein Lichthof, darüber
 * Sternenstaub, am Rand eine Vignette.
 *
 * Das Motiv gehört in das mittlere Band (y 120–360): die Spielseite zeigt
 * das Bild im Querformat 3:2 und schneidet oben und unten je ein Viertel ab.
 *
 * Jede Szene wird für sich gerendert – IDs in <defs> dürfen sich deshalb
 * zwischen Szenen wiederholen, innerhalb einer Szene nicht.
 */
import type { ReactNode } from 'react';

export interface Scene {
  id: string;
  /** Hell, Mitte, Tief – der Hintergrund in der Akzentfarbe des Spiels. */
  light: string;
  mid: string;
  deep: string;
  art: () => ReactNode;
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

export function Defs({ light, mid, deep }: Pick<Scene, 'light' | 'mid' | 'deep'>) {
  return (
    <defs>
      <radialGradient id="bg" cx="50%" cy="45%" r="75%">
        <stop offset="0" stopColor={light} />
        <stop offset="0.38" stopColor={mid} />
        <stop offset="0.78" stopColor={deep} />
        <stop offset="1" stopColor="#000" />
      </radialGradient>
      <radialGradient id="vignette" cx="50%" cy="47%" r="70%">
        <stop offset="0.55" stopColor="#000" stopOpacity={0} />
        <stop offset="1" stopColor="#000" stopOpacity={0.55} />
      </radialGradient>
      <filter id="sh" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="12" stdDeviation="11" floodColor="#000" floodOpacity="0.5" />
      </filter>
      <filter id="shs" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.45" />
      </filter>
      <filter id="blur" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="18" />
      </filter>
      <filter id="blur-s" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.4" />
      </filter>
      <linearGradient id="sheen" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0.06" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="paper" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#ece7f2" />
      </linearGradient>
    </defs>
  );
}

/** Partylichter und Sternenstaub – fest verteilt, damit nichts springt. */
export function Atmosphere({ color, seed = 1 }: { color: string; seed?: number }) {
  const bokeh = Array.from({ length: 9 }, (_, i) => {
    const k = i * 7 + seed * 13;
    return {
      x: (k * 53) % 360,
      y: (k * 97) % 470,
      r: 12 + ((k * 31) % 30),
      o: 0.05 + ((k * 17) % 10) / 90,
    };
  });
  const dust = Array.from({ length: 64 }, (_, i) => {
    const x = (i * 137.5 + seed * 29) % 360;
    const y = (i * 61.8 + (i % 7) * 13 + seed * 7) % 480;
    return {
      x,
      y,
      r: 0.5 + ((i * 29) % 10) / 12,
      o: 0.2 + ((i * 17) % 10) / 16,
      gold: i % 5 === 0,
    };
  });
  return (
    <g>
      <g filter="url(#blur-s)">
        {bokeh.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={color} opacity={d.o} />
        ))}
      </g>
      {dust.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill={d.gold ? '#ffe7a3' : '#fff'}
          opacity={d.o * 0.8}
        />
      ))}
    </g>
  );
}

export function Vignette() {
  return <rect width={360} height={480} fill="url(#vignette)" />;
}

export function Sparkle({
  x,
  y,
  r = 5,
  fill = '#fff',
  o = 0.95,
}: {
  x: number;
  y: number;
  r?: number;
  fill?: string;
  o?: number;
}) {
  return (
    <path
      d={`M${x} ${y - r * 2}Q${x + r * 0.3} ${y - r * 0.3} ${x + r * 2} ${y}Q${x + r * 0.3} ${y + r * 0.3} ${x} ${y + r * 2}Q${x - r * 0.3} ${y + r * 0.3} ${x - r * 2} ${y}Q${x - r * 0.3} ${y - r * 0.3} ${x} ${y - r * 2}z`}
      fill={fill}
      opacity={o}
    />
  );
}

function Halo({
  x,
  y,
  r,
  color,
  o = 0.6,
}: {
  x: number;
  y: number;
  r: number;
  color: string;
  o?: number;
}) {
  return <circle cx={x} cy={y} r={r} fill={color} opacity={o} filter="url(#blur)" />;
}

/** Karte mit Glanz und feinem Rand – die Grundform vieler Motive. */
function Card({
  x,
  y,
  w,
  h,
  rot = 0,
  fill,
  rx = 14,
  border = '#fff',
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  fill: string;
  rx?: number;
  border?: string;
  children?: ReactNode;
}) {
  return (
    <g transform={`rotate(${rot} ${x + w / 2} ${y + h / 2})`} filter="url(#sh)">
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} />
      <rect x={x} y={y} width={w} height={h} rx={rx} fill="url(#sheen)" />
      <rect
        x={x + 6}
        y={y + 6}
        width={w - 12}
        height={h - 12}
        rx={rx - 5}
        fill="none"
        stroke={border}
        strokeOpacity={0.35}
        strokeWidth={1.2}
      />
      {children}
    </g>
  );
}

function Confetti({
  colors,
  seed = 3,
  n = 16,
  band = [90, 400],
}: {
  colors: string[];
  seed?: number;
  n?: number;
  band?: [number, number];
}) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const k = i * 11 + seed * 5;
        const x = 12 + ((k * 67) % 336);
        const y = band[0] + ((k * 41) % (band[1] - band[0]));
        const rot = (k * 37) % 180;
        const c = colors[i % colors.length];
        return i % 3 === 0 ? (
          <circle key={i} cx={x} cy={y} r={3} fill={c} opacity={0.9} />
        ) : (
          <rect
            key={i}
            x={x}
            y={y}
            width={10}
            height={4}
            rx={1.5}
            fill={c}
            opacity={0.9}
            transform={`rotate(${rot} ${x} ${y})`}
          />
        );
      })}
    </g>
  );
}

const SANS = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// ---------------------------------------------------------------------------
// Wahrheit oder Pflicht
// ---------------------------------------------------------------------------

function TruthOrDare() {
  return (
    <g>
      <defs>
        <linearGradient id="dare" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#ff5c8a" />
          <stop offset="1" stopColor="#ff7a18" />
        </linearGradient>
        <linearGradient id="truth" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#fbf4ff" />
          <stop offset="1" stopColor="#e7d6f7" />
        </linearGradient>
        <linearGradient id="back" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#6a2a9a" />
          <stop offset="1" stopColor="#2a0b44" />
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fe08f" />
          <stop offset="0.5" stopColor="#1e9d56" />
          <stop offset="1" stopColor="#0d5a30" />
        </linearGradient>
      </defs>
      <Halo x={180} y={230} r={150} color="#f0a8ff" o={0.45} />
      {/* Karte hinten */}
      <Card x={112} y={112} w={136} h={196} rot={0} fill="url(#back)" border="#e8c26a">
        <circle
          cx={180}
          cy={210}
          r={34}
          fill="none"
          stroke="#e8c26a"
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />
        <path
          d="M180 184l7 19h20l-16 12 6 19-17-12-17 12 6-19-16-12h20z"
          fill="#e8c26a"
          opacity={0.8}
        />
      </Card>
      {/* Wahrheit */}
      <Card x={44} y={128} w={146} h={206} rot={-17} fill="url(#truth)" border="#bf5af2">
        <text
          x={117}
          y={170}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={24}
          fill="#7b2fa8"
          letterSpacing={1}
        >
          WAHRHEIT
        </text>
        <path
          d="M80 200h74a16 16 0 0 1 16 16v44a16 16 0 0 1-16 16h-38l-20 18v-18h-16a16 16 0 0 1-16-16v-44a16 16 0 0 1 16-16z"
          fill="#bf5af2"
        />
        <path
          d="M80 200h74a16 16 0 0 1 16 16v10H64v-10a16 16 0 0 1 16-16z"
          fill="#fff"
          opacity={0.18}
        />
        <text x={117} y={264} textAnchor="middle" fontFamily="Anton" fontSize={54} fill="#fff">
          ?
        </text>
      </Card>
      {/* Pflicht */}
      <Card x={172} y={134} w={146} h={206} rot={15} fill="url(#dare)">
        <text
          x={245}
          y={176}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={24}
          fill="#fff"
          letterSpacing={1}
        >
          PFLICHT
        </text>
        <path
          d="M245 196c16 18 34 30 34 58 0 19-15 34-34 34s-34-15-34-34c0-14 8-22 12-30 3 9 6 14 10 17 1-19 4-32 12-45z"
          fill="#fff"
        />
        <path
          d="M245 234c7 9 15 14 15 26 0 9-7 15-15 15s-15-6-15-15c0-7 4-10 7-13 1 3 2 5 4 7 0-8 1-13 4-20z"
          fill="#ffb02e"
        />
      </Card>
      {/* Flasche */}
      <g transform="translate(182 382) rotate(-14)">
        <ellipse
          cx={4}
          cy={4}
          rx={140}
          ry={44}
          fill="none"
          stroke="#fff"
          strokeOpacity={0.35}
          strokeWidth={2.2}
          strokeDasharray="8 9"
        />
        <g filter="url(#sh)">
          <rect x={-84} y={-21} width={110} height={42} rx={17} fill="url(#glass)" />
          <path d="M22 -21c18 0 22 12 38 12h28v18H60c-16 0-20 12-38 12z" fill="url(#glass)" />
          <rect x={86} y={-10} width={13} height={20} rx={4} fill="#ffd24a" />
          <rect x={-62} y={-15} width={52} height={30} rx={6} fill="#fff3d6" />
          <text x={-36} y={5} textAnchor="middle" fontFamily="Anton" fontSize={13} fill="#1e7a44">
            DREH!
          </text>
          <rect x={-76} y={-17} width={96} height={7} rx={3.5} fill="#fff" opacity={0.45} />
        </g>
        <path
          d="M-150 -4l-14 -8M-150 4l-16 2M150 0l14 -6M150 8l16 4"
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.5}
        />
      </g>
      <Sparkle x={48} y={104} r={4.5} />
      <Sparkle x={318} y={118} r={3.5} fill="#ffd9f0" />
      <Sparkle x={320} y={330} r={3} fill="#ffe7a3" />
      <Sparkle x={36} y={336} r={2.5} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Ich hab noch nie
// ---------------------------------------------------------------------------

function Finger({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={w / 2} fill="url(#skinX)" />
      <rect
        x={x + w * 0.18}
        y={y + 5}
        width={w * 0.64}
        height={w * 0.72}
        rx={w * 0.3}
        fill="#ffe6d6"
        opacity={0.85}
      />
      <path
        d={`M${x + 4} ${y + h * 0.42}q${w / 2 - 4} 4 ${w - 8} 0`}
        stroke="#d58b66"
        strokeWidth={1.6}
        fill="none"
        opacity={0.6}
      />
    </g>
  );
}

function NeverHaveIEver() {
  return (
    <g>
      <defs>
        <linearGradient id="skinX" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e89c75" />
          <stop offset="0.35" stopColor="#ffd6ba" />
          <stop offset="1" stopColor="#e39470" />
        </linearGradient>
        <linearGradient id="palm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd6ba" />
          <stop offset="1" stopColor="#e39470" />
        </linearGradient>
        <linearGradient id="nhie" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#0f8fbf" />
          <stop offset="1" stopColor="#063a55" />
        </linearGradient>
      </defs>
      <Halo x={180} y={230} r={150} color="#8fe3ff" o={0.45} />
      {/* Karte */}
      <Card x={40} y={92} w={196} h={250} rot={-9} fill="url(#nhie)" border="#9be7ff">
        <text
          x={138}
          y={146}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={31}
          fill="#fff"
          letterSpacing={0.5}
        >
          ICH HAB
        </text>
        <text
          x={138}
          y={184}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={31}
          fill="#fff"
          letterSpacing={0.5}
        >
          NOCH NIE …
        </text>
        <rect x={72} y={208} width={132} height={10} rx={5} fill="#fff" opacity={0.35} />
        <rect x={86} y={228} width={104} height={10} rx={5} fill="#fff" opacity={0.25} />
      </Card>
      {/* Hand mit drei Fingern */}
      <g transform="translate(26 58) rotate(4 220 330)" filter="url(#sh)">
        <rect x={188} y={352} width={76} height={120} rx={20} fill="url(#palm)" />
        <Finger x={170} y={200} w={29} h={112} />
        <Finger x={202} y={184} w={30} h={124} />
        <Finger x={235} y={196} w={29} h={112} />
        <rect x={262} y={262} width={26} height={52} rx={13} fill="url(#skinX)" />
        <rect x={166} y={268} width={124} height={118} rx={38} fill="url(#palm)" />
        <path
          d="M168 330c12-26 38-40 66-38 9 1 11 13 2 17-22 7-38 20-48 36-9 12-27 3-20-15z"
          fill="#eea583"
        />
        <path
          d="M172 334c10-20 30-32 52-33"
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          opacity={0.35}
        />
        <path
          d="M188 360c20 10 50 10 72 0"
          stroke="#c97b58"
          strokeWidth={2}
          fill="none"
          opacity={0.5}
        />
      </g>
      <Confetti
        colors={['#fff', '#ffd60a', '#ff375f', '#9be7ff']}
        seed={2}
        n={14}
        band={[100, 430]}
      />
      <Sparkle x={306} y={112} r={4.5} />
      <Sparkle x={44} y={380} r={3} fill="#ffe7a3" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Wer aus der Runde
// ---------------------------------------------------------------------------

function MostLikely() {
  const arrows = [
    { x: 44, y: 160, c: '#ff375f', l: 'A' },
    { x: 318, y: 150, c: '#64d2ff', l: 'B' },
    { x: 36, y: 318, c: '#30d158', l: 'C' },
    { x: 326, y: 322, c: '#ffd60a', l: 'D' },
    { x: 180, y: 96, c: '#bf5af2', l: 'E' },
  ];
  return (
    <g>
      <defs>
        <linearGradient id="spot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6d6" stopOpacity={0.75} />
          <stop offset="1" stopColor="#fff6d6" stopOpacity={0} />
        </linearGradient>
        <radialGradient id="person" cx="50%" cy="30%" r="70%">
          <stop offset="0" stopColor="#5a2c00" />
          <stop offset="1" stopColor="#1c0b00" />
        </radialGradient>
      </defs>
      <path d="M148 0h64l118 440H30z" fill="url(#spot)" opacity={0.55} />
      <Halo x={180} y={300} r={110} color="#ffd08a" o={0.45} />
      <ellipse cx={180} cy={400} rx={110} ry={18} fill="#fff4d0" opacity={0.3} />
      {/* Person im Lichtkegel */}
      <g filter="url(#sh)">
        <path d="M98 404c0-68 36-102 82-102s82 34 82 102z" fill="url(#person)" />
        <circle cx={180} cy={250} r={44} fill="url(#person)" />
        <path
          d="M140 236a44 44 0 0 1 80 0"
          stroke="#ffdca0"
          strokeWidth={3.5}
          fill="none"
          opacity={0.85}
        />
        <path
          d="M104 388c4-44 30-74 76-78"
          stroke="#ffdca0"
          strokeWidth={3.5}
          fill="none"
          opacity={0.6}
        />
        <path
          d="M256 388c-4-44-30-74-76-78"
          stroke="#ffdca0"
          strokeWidth={2}
          fill="none"
          opacity={0.3}
        />
      </g>
      {/* Zeigende Pfeile */}
      {arrows.map((a, i) => {
        const tx = 180;
        const ty = 262;
        const ang = Math.atan2(ty - a.y, tx - a.x);
        const len = Math.hypot(tx - a.x, ty - a.y) - 70;
        const ex = a.x + Math.cos(ang) * len;
        const ey = a.y + Math.sin(ang) * len;
        const deg = (ang * 180) / Math.PI;
        return (
          <g key={i} filter="url(#shs)">
            <line
              x1={a.x}
              y1={a.y}
              x2={ex}
              y2={ey}
              stroke={a.c}
              strokeWidth={11}
              strokeLinecap="round"
            />
            <line
              x1={a.x}
              y1={a.y}
              x2={ex}
              y2={ey}
              stroke="#fff"
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.35}
            />
            <path
              d="M-2 -16L24 0L-2 16z"
              fill={a.c}
              transform={`translate(${ex} ${ey}) rotate(${deg})`}
            />
            <circle cx={a.x} cy={a.y} r={23} fill={a.c} />
            <circle cx={a.x} cy={a.y} r={23} fill="url(#sheen)" />
            <circle cx={a.x} cy={a.y} r={23} fill="none" stroke="#fff" strokeWidth={2.5} />
            <text
              x={a.x}
              y={a.y + 8}
              textAnchor="middle"
              fontFamily="Anton"
              fontSize={22}
              fill="#fff"
            >
              {a.l}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Undercover
// ---------------------------------------------------------------------------

function Undercover() {
  return (
    <g>
      <defs>
        <linearGradient id="coat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9a866" />
          <stop offset="1" stopColor="#8a5f2c" />
        </linearGradient>
        <linearGradient id="face" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f2bf9a" />
          <stop offset="1" stopColor="#c9876a" />
        </linearGradient>
        <linearGradient id="hat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#35326a" />
          <stop offset="1" stopColor="#12112a" />
        </linearGradient>
        <radialGradient id="lens" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset="1" stopColor="#9fd0ff" stopOpacity={0.12} />
        </radialGradient>
      </defs>
      <Halo x={180} y={236} r={150} color="#8f8dff" o={0.55} />
      {/* Wortkarten dahinter */}
      <Card x={36} y={110} w={84} h={116} rot={-16} fill="#f5f3ff" border="#5e5ce6">
        <text x={78} y={176} textAnchor="middle" fontFamily="Anton" fontSize={20} fill="#3b3a9c">
          KATZE
        </text>
      </Card>
      <Card x={240} y={104} w={84} h={116} rot={14} fill="#f5f3ff" border="#5e5ce6">
        <text x={282} y={170} textAnchor="middle" fontFamily="Anton" fontSize={20} fill="#3b3a9c">
          KATZE
        </text>
      </Card>
      <g filter="url(#sh)">
        {/* Mantel */}
        <path d="M70 440c6-74 44-116 110-116s104 42 110 116z" fill="url(#coat)" />
        <path d="M126 330l54 64 54-64-20 110h-68z" fill="#8a6333" />
        <path d="M148 324l32 48 32-48" fill="#f2efe6" />
        <path d="M172 352l8 62 8-62-8-12z" fill="#1a1830" />
        <path d="M118 336l34 104M242 336l-34 104" stroke="#6e4c24" strokeWidth={3} />
        <path
          d="M84 430c8-40 26-70 58-86"
          stroke="#fff"
          strokeWidth={3}
          fill="none"
          opacity={0.2}
        />
        {/* Kopf */}
        <rect x={142} y={240} width={76} height={92} rx={34} fill="url(#face)" />
        <path
          d="M168 312q12 6 24 0"
          stroke="#8a4a36"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        {/* Sonnenbrille */}
        <rect x={137} y={262} width={38} height={22} rx={9} fill="#0d0c1a" />
        <rect x={185} y={262} width={38} height={22} rx={9} fill="#0d0c1a" />
        <rect x={173} y={268} width={14} height={4} fill="#0d0c1a" />
        <path
          d="M143 267l12 0M191 267l12 0"
          stroke="#8f8dff"
          strokeWidth={3.5}
          strokeLinecap="round"
        />
        {/* Hut */}
        <ellipse cx={180} cy={248} rx={90} ry={18} fill="#0d0c20" />
        <path d="M122 248c2-44 20-68 58-68s56 24 58 68z" fill="url(#hat)" />
        <path d="M124 234c18 7 94 7 112 0v14c-18 7-94 7-112 0z" fill="#5e5ce6" />
        <path
          d="M166 188c9-7 19-7 28 0"
          stroke="#0d0c20"
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M134 214c4-16 12-26 24-30"
          stroke="#fff"
          strokeWidth={3}
          fill="none"
          opacity={0.25}
          strokeLinecap="round"
        />
      </g>
      {/* Lupe */}
      <g transform="rotate(-30 280 360)" filter="url(#sh)">
        <rect x={269} y={392} width={22} height={76} rx={9} fill="#6b3f1d" />
        <rect x={273} y={396} width={6} height={68} rx={3} fill="#fff" opacity={0.2} />
        <circle cx={280} cy={350} r={48} fill="url(#lens)" />
        <circle cx={280} cy={350} r={48} fill="none" stroke="#dfe3ee" strokeWidth={11} />
        <circle cx={280} cy={350} r={48} fill="none" stroke="#9aa0b4" strokeWidth={2} />
        <path
          d="M252 330a33 33 0 0 1 26-16"
          stroke="#fff"
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          opacity={0.9}
        />
      </g>
      <Sparkle x={300} y={240} r={3.5} fill="#c9c8ff" />
      <Sparkle x={50} y={290} r={3} fill="#c9c8ff" o={0.8} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Chaos-Roulette
// ---------------------------------------------------------------------------

function ChaosRoulette() {
  const cx = 180;
  const cy = 240;
  const r = 132;
  const colors = [
    '#ff9f0a',
    '#2b1606',
    '#ff375f',
    '#2b1606',
    '#64d2ff',
    '#2b1606',
    '#ffd60a',
    '#2b1606',
    '#30d158',
    '#2b1606',
    '#bf5af2',
    '#2b1606',
  ];
  const seg = (i: number, rr: number) => {
    const a0 = ((i * 30 - 90 - 15) * Math.PI) / 180;
    const a1 = ((i * 30 - 90 + 15) * Math.PI) / 180;
    return `M${cx} ${cy}L${cx + rr * Math.cos(a0)} ${cy + rr * Math.sin(a0)}A${rr} ${rr} 0 0 1 ${cx + rr * Math.cos(a1)} ${cy + rr * Math.sin(a1)}z`;
  };
  const ballA = -0.42;
  return (
    <g>
      <defs>
        <radialGradient id="rim" cx="50%" cy="50%" r="50%">
          <stop offset="0.86" stopColor="#8a4a14" />
          <stop offset="0.93" stopColor="#e3a04a" />
          <stop offset="1" stopColor="#5a2c08" />
        </radialGradient>
        <radialGradient id="gloss" cx="35%" cy="25%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity={0.4} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0.05} />
          <stop offset="1" stopColor="#000" stopOpacity={0.25} />
        </radialGradient>
        <radialGradient id="hub" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffe7a3" />
          <stop offset="1" stopColor="#b8801e" />
        </radialGradient>
        <radialGradient id="ball" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#c9ccd6" />
        </radialGradient>
      </defs>
      <Halo x={cx} y={cy} r={160} color="#ffc266" o={0.55} />
      <ellipse
        cx={cx}
        cy={cy + r + 26}
        rx={r}
        ry={16}
        fill="#000"
        opacity={0.35}
        filter="url(#blur-s)"
      />
      <g filter="url(#sh)">
        <circle cx={cx} cy={cy} r={r + 16} fill="url(#rim)" />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * 15 * Math.PI) / 180;
          return (
            <circle
              key={i}
              cx={cx + (r + 8) * Math.cos(a)}
              cy={cy + (r + 8) * Math.sin(a)}
              r={2.2}
              fill="#ffe7a3"
              opacity={0.9}
            />
          );
        })}
        <g transform={`rotate(12 ${cx} ${cy})`}>
          {colors.map((c, i) => (
            <path key={i} d={seg(i, r)} fill={c} />
          ))}
          {colors.map((_, i) => {
            const a = ((i * 30 - 90 - 15) * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={cx + 46 * Math.cos(a)}
                y1={cy + 46 * Math.sin(a)}
                x2={cx + r * Math.cos(a)}
                y2={cy + r * Math.sin(a)}
                stroke="#ffd48a"
                strokeWidth={2.4}
              />
            );
          })}
          {colors.map((c, i) => {
            if (c === '#2b1606') return null;
            const a = ((i * 30 - 90) * Math.PI) / 180;
            return (
              <Sparkle key={`s${i}`} x={cx + 92 * Math.cos(a)} y={cy + 92 * Math.sin(a)} r={4.5} />
            );
          })}
        </g>
        <circle cx={cx} cy={cy} r={r} fill="url(#gloss)" />
        <circle cx={cx} cy={cy} r={48} fill="#2b1606" />
        <circle cx={cx} cy={cy} r={48} fill="none" stroke="#ffd48a" strokeWidth={3} />
        <path
          d={`M${cx - 34} ${cy}h68M${cx} ${cy - 34}v68`}
          stroke="url(#hub)"
          strokeWidth={8}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={18} fill="url(#hub)" />
      </g>
      <circle
        cx={cx + (r - 14) * Math.cos(ballA)}
        cy={cy + (r - 14) * Math.sin(ballA)}
        r={10}
        fill="url(#ball)"
        filter="url(#shs)"
      />
      <path d={`M${cx - 18} ${cy - r - 40}h36l-18 32z`} fill="#fff" filter="url(#shs)" />
      <path
        d={`M${cx - 172} ${cy + 50}a176 176 0 0 1 40 -140`}
        stroke="#fff"
        strokeOpacity={0.45}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M${cx + 172} ${cy - 50}a176 176 0 0 1 -40 140`}
        stroke="#fff"
        strokeOpacity={0.45}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      <Confetti
        colors={['#fff', '#ffd60a', '#ff375f', '#64d2ff']}
        seed={5}
        n={10}
        band={[60, 110]}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Wortbombe
// ---------------------------------------------------------------------------

function Tile({ l, x, y, r, s = 1 }: { l: string; x: number; y: number; r: number; s?: number }) {
  const w = 54 * s;
  return (
    <g transform={`rotate(${r} ${x + w / 2} ${y + w / 2})`} filter="url(#shs)">
      <rect x={x} y={y + 5 * s} width={w} height={w} rx={11 * s} fill="#c9a887" />
      <rect x={x} y={y} width={w} height={w} rx={11 * s} fill="#fff4e4" />
      <rect x={x} y={y} width={w} height={w / 2} rx={11 * s} fill="#fff" opacity={0.6} />
      <text
        x={x + w / 2}
        y={y + w * 0.76}
        textAnchor="middle"
        fontFamily="Anton"
        fontSize={36 * s}
        fill="#d61f4a"
      >
        {l}
      </text>
    </g>
  );
}

function Wortbombe() {
  return (
    <g>
      <defs>
        <radialGradient id="bomb" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#5a5668" />
          <stop offset="0.45" stopColor="#24222d" />
          <stop offset="1" stopColor="#0c0b10" />
        </radialGradient>
        <radialGradient id="spark" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="0.4" stopColor="#ffd24a" />
          <stop offset="1" stopColor="#ff7a18" stopOpacity={0} />
        </radialGradient>
      </defs>
      <Halo x={176} y={272} r={140} color="#ff7a9a" o={0.55} />
      <Tile l="W" x={40} y={128} r={-16} />
      <Tile l="O" x={270} y={210} r={12} />
      <Tile l="R" x={44} y={316} r={10} />
      <Tile l="T" x={270} y={330} r={-12} />
      <Tile l="?" x={30} y={228} r={-6} s={0.7} />
      <g filter="url(#sh)">
        <path
          d="M206 192c14-32 36-50 62-60"
          stroke="#d9b37a"
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M206 192c14-32 36-50 62-60"
          stroke="#8a6a3a"
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="3 5"
        />
        <rect
          x={184}
          y={184}
          width={44}
          height={32}
          rx={7}
          transform="rotate(34 206 200)"
          fill="#5a5e6c"
        />
        <rect
          x={188}
          y={186}
          width={36}
          height={8}
          rx={4}
          transform="rotate(34 206 200)"
          fill="#fff"
          opacity={0.25}
        />
        <circle cx={172} cy={280} r={90} fill="url(#bomb)" />
        <path
          d="M118 244c12-26 34-42 62-44"
          stroke="#fff"
          strokeWidth={11}
          strokeLinecap="round"
          fill="none"
          opacity={0.28}
        />
        <circle cx={128} cy={300} r={5} fill="#fff" opacity={0.15} />
      </g>
      <circle cx={268} cy={132} r={34} fill="url(#spark)" />
      <path
        d="M268 104l7 18 18-7-11 16 16 11-20 0 2 20-12-16-13 13 3-20-18-4 18-9-7-18 16 11z"
        fill="#ffe14a"
      />
      <circle cx={268} cy={132} r={7} fill="#fffbe0" />
      <Sparkle x={306} y={98} r={3.5} fill="#ffe28a" />
      <Sparkle x={232} y={96} r={3} fill="#ffe28a" />
      <Sparkle x={304} y={156} r={2.5} fill="#ffe28a" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Reaktions-Duell
// ---------------------------------------------------------------------------

function Bolt({ x, y, s = 1, rot = 0 }: { x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} filter="url(#shs)">
      <path d="M8 -46L-22 6h20l-10 40 34-54H0z" fill="#ffd60a" />
      <path d="M8 -46L-22 6h10z" fill="#fff" opacity={0.5} />
    </g>
  );
}

function Duell() {
  return (
    <g>
      <defs>
        <linearGradient id="bezel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a3c48" />
          <stop offset="1" stopColor="#0b0c10" />
        </linearGradient>
        <radialGradient id="target" cx="45%" cy="40%" r="60%">
          <stop offset="0" stopColor="#7bf29a" />
          <stop offset="1" stopColor="#1fa84a" />
        </radialGradient>
        <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f4a28" />
          <stop offset="1" stopColor="#062616" />
        </linearGradient>
      </defs>
      <path d="M0 0h236L126 480H0z" fill="#fff" opacity={0.06} />
      <Halo x={180} y={250} r={150} color="#ff8a80" o={0.5} />
      <Halo x={180} y={250} r={70} color="#30d158" o={0.45} />
      <Bolt x={54} y={200} s={1.2} rot={-18} />
      <Bolt x={306} y={300} s={1.2} rot={160} />
      {/* Handy mit Ziel */}
      <g transform="rotate(-8 180 250)" filter="url(#sh)">
        <rect x={104} y={110} width={152} height={280} rx={26} fill="url(#bezel)" />
        <rect x={112} y={124} width={136} height={252} rx={18} fill="url(#screen)" />
        <circle
          cx={180}
          cy={250}
          r={96}
          fill="none"
          stroke="#30d158"
          strokeOpacity={0.18}
          strokeWidth={3}
        />
        <circle
          cx={180}
          cy={250}
          r={76}
          fill="none"
          stroke="#30d158"
          strokeOpacity={0.4}
          strokeWidth={4}
        />
        <circle cx={180} cy={250} r={56} fill="url(#target)" />
        <circle cx={180} cy={250} r={56} fill="url(#sheen)" />
        <text x={180} y={264} textAnchor="middle" fontFamily="Anton" fontSize={36} fill="#fff">
          JETZT!
        </text>
        <rect x={156} y={114} width={48} height={7} rx={3.5} fill="#1b1c22" />
        <path
          d="M118 140c10-8 24-12 40-12"
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.2}
          fill="none"
        />
      </g>
      <g filter="url(#sh)">
        <circle cx={64} cy={368} r={34} fill="#fff" />
        <circle cx={64} cy={368} r={34} fill="none" stroke="#ff453a" strokeWidth={4} />
        <text x={64} y={381} textAnchor="middle" fontFamily="Anton" fontSize={32} fill="#d62a20">
          VS
        </text>
        <rect x={232} y={96} width={108} height={42} rx={21} fill="#1c0a08" />
        <rect
          x={232}
          y={96}
          width={108}
          height={42}
          rx={21}
          fill="none"
          stroke="#ffd60a"
          strokeOpacity={0.5}
          strokeWidth={2}
        />
        <text x={286} y={125} textAnchor="middle" fontFamily="Anton" fontSize={24} fill="#ffd60a">
          0,21 s
        </text>
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Tabu Rush
// ---------------------------------------------------------------------------

function Tabu() {
  const words = ['Käse', 'Italien', 'Ofen', 'Salami'];
  return (
    <g>
      <defs>
        <linearGradient id="band" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a78f5" />
          <stop offset="1" stopColor="#3b39b8" />
        </linearGradient>
        <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd06a" />
          <stop offset="1" stopColor="#ff9a1e" />
        </linearGradient>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d49a55" />
          <stop offset="1" stopColor="#8a5a24" />
        </linearGradient>
      </defs>
      <Halo x={176} y={240} r={150} color="#8f8dff" o={0.5} />
      <Card x={96} y={122} w={190} h={260} rot={9} fill="#dcdaf7" />
      <Card x={86} y={116} w={190} h={260} rot={2} fill="#ecebfb" />
      <Card x={72} y={104} w={194} h={272} rot={-7} fill="url(#paper)" border="#5e5ce6">
        <rect x={72} y={104} width={194} height={78} rx={14} fill="url(#band)" />
        <rect x={72} y={160} width={194} height={22} fill="url(#band)" />
        <text
          x={169}
          y={160}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={44}
          fill="#fff"
          letterSpacing={1}
        >
          PIZZA
        </text>
        {words.map((w, i) => (
          <g key={w}>
            <text
              x={169}
              y={226 + i * 38}
              textAnchor="middle"
              fontFamily={SANS}
              fontWeight={800}
              fontSize={23}
              fill="#2b2a4a"
            >
              {w}
            </text>
            <line
              x1={112}
              y1={218 + i * 38}
              x2={226}
              y2={218 + i * 38}
              stroke="#ff375f"
              strokeWidth={4.5}
              strokeLinecap="round"
            />
          </g>
        ))}
      </Card>
      {/* Sanduhr */}
      <g transform="rotate(14 292 360)" filter="url(#sh)">
        <rect x={250} y={296} width={84} height={14} rx={6} fill="url(#wood)" />
        <rect x={250} y={418} width={84} height={14} rx={6} fill="url(#wood)" />
        <rect x={256} y={308} width={6} height={112} rx={3} fill="url(#wood)" />
        <rect x={322} y={308} width={6} height={112} rx={3} fill="url(#wood)" />
        <path
          d="M264 310h56c0 32-24 40-24 54s24 22 24 54h-56c0-32 24-40 24-54s-24-22-24-54z"
          fill="#e6f2ff"
          opacity={0.4}
        />
        <path d="M272 322h40c-4 18-15 24-20 32-5-8-16-14-20-32z" fill="url(#sand)" />
        <path d="M272 418c2-22 13-28 20-28s18 6 20 28z" fill="url(#sand)" />
        <line x1={292} y1={356} x2={292} y2={396} stroke="#ffb13b" strokeWidth={2.5} />
        <path
          d="M270 318c2 14 8 22 12 28"
          stroke="#fff"
          strokeWidth={3}
          fill="none"
          opacity={0.6}
          strokeLinecap="round"
        />
      </g>
      <g filter="url(#sh)">
        <circle cx={70} cy={112} r={30} fill="#ff375f" />
        <circle cx={70} cy={112} r={30} fill="url(#sheen)" />
        <circle cx={70} cy={112} r={17} fill="none" stroke="#fff" strokeWidth={6} />
        <line
          x1={58}
          y1={124}
          x2={82}
          y2={100}
          stroke="#fff"
          strokeWidth={6}
          strokeLinecap="round"
        />
      </g>
      <text
        x={30}
        y={420}
        fontFamily="Anton"
        fontSize={34}
        fill="#fff"
        opacity={0.85}
        filter="url(#shs)"
      >
        60 s
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Meme Battle
// ---------------------------------------------------------------------------

function MemeBattle() {
  return (
    <g>
      <defs>
        <radialGradient id="catbg" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#1f7a74" />
          <stop offset="1" stopColor="#0a3431" />
        </radialGradient>
        <radialGradient id="fur" cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffc47a" />
          <stop offset="1" stopColor="#e0873a" />
        </radialGradient>
      </defs>
      <Halo x={180} y={240} r={150} color="#a6fff8" o={0.45} />
      <Card x={70} y={112} w={228} h={272} rot={-10} fill="#e9f6f5" rx={6} />
      <g transform="rotate(5 180 244)" filter="url(#sh)">
        <rect x={60} y={98} width={240} height={290} rx={6} fill="#fff" />
        <rect x={74} y={112} width={212} height={214} fill="url(#catbg)" />
        {/* Katze */}
        <path d="M126 206l-8-50 38 30zM234 206l8-50-38 30z" fill="url(#fur)" />
        <path d="M131 196l-3-26 18 16zM229 196l3-26-18 16z" fill="#ffd9b0" />
        <ellipse cx={180} cy={240} rx={66} ry={60} fill="url(#fur)" />
        <path
          d="M150 196c8-6 14-6 20 2M190 198c6-8 12-8 20-2"
          stroke="#b8621e"
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx={180} cy={268} rx={32} ry={24} fill="#ffe7cc" />
        <circle cx={154} cy={232} r={17} fill="#fff" />
        <circle cx={206} cy={232} r={17} fill="#fff" />
        <circle cx={156} cy={234} r={9.5} fill="#111" />
        <circle cx={208} cy={234} r={9.5} fill="#111" />
        <circle cx={159} cy={230} r={3} fill="#fff" />
        <circle cx={211} cy={230} r={3} fill="#fff" />
        <ellipse cx={180} cy={274} rx={8} ry={10} fill="#6b2b1a" />
        <path d="M175 258h10l-5 6z" fill="#e0707a" />
        <path
          d="M118 260l-26-5M118 268l-26 5M242 260l26-5M242 268l26 5"
          stroke="#ffe7cc"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <rect x={74} y={112} width={212} height={60} fill="url(#sheen)" opacity={0.5} />
        <text
          x={180}
          y={150}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={25}
          fill="#fff"
          stroke="#000"
          strokeWidth={2.6}
          paintOrder="stroke"
        >
          WENN DIE MUSIK
        </text>
        <text
          x={180}
          y={316}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={30}
          fill="#fff"
          stroke="#000"
          strokeWidth={2.8}
          paintOrder="stroke"
        >
          AUSGEHT
        </text>
        <text
          x={180}
          y={364}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={17}
          fill="#1b6f69"
          opacity={0.55}
        >
          MEME DER RUNDE
        </text>
      </g>
      {[
        // Punkte wie im Spiel: einstimmig Feuer sind 1000, das Trittbrett die Hälfte.
        { x: 60, y: 386, t: '+1000', c: '#ffd60a' },
        { x: 300, y: 112, t: '+500', c: '#66d4cf' },
      ].map((v) => (
        <g key={v.t} filter="url(#shs)">
          <circle cx={v.x} cy={v.y} r={30} fill={v.c} />
          <circle cx={v.x} cy={v.y} r={30} fill="url(#sheen)" />
          <text
            x={v.x}
            y={v.y + (v.t.length > 4 ? 7 : 8)}
            textAnchor="middle"
            fontFamily="Anton"
            fontSize={v.t.length > 4 ? 18 : 21}
            fill="#063e3b"
          >
            {v.t}
          </text>
        </g>
      ))}
      <Sparkle x={310} y={392} r={4} />
      <Sparkle x={40} y={130} r={3.5} fill="#ffe7a3" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Lückenfüller
// ---------------------------------------------------------------------------

function Lueckenfueller() {
  return (
    <g>
      <defs>
        <linearGradient id="black" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#2a2433" />
          <stop offset="1" stopColor="#0b090e" />
        </linearGradient>
      </defs>
      <Halo x={180} y={244} r={150} color="#e39bff" o={0.45} />
      <Card x={28} y={96} w={178} h={248} rot={-10} fill="url(#black)" border="#bf5af2">
        <text fontFamily={SANS} fontWeight={800} fontSize={21} fill="#fff">
          <tspan x={48} y={142}>
            Auf jeder
          </tspan>
          <tspan x={48} y={170}>
            Party gibt
          </tspan>
          <tspan x={48} y={198}>
            es ______.
          </tspan>
        </text>
        <text
          x={48}
          y={320}
          fontFamily="Anton"
          fontSize={13}
          fill="#fff"
          opacity={0.5}
          letterSpacing={1.5}
        >
          LÜCKENFÜLLER
        </text>
      </Card>
      <Card x={184} y={140} w={148} h={206} rot={8} fill="url(#paper)" border="#bf5af2">
        <text fontFamily={SANS} fontWeight={800} fontSize={19} fill="#1b1030">
          <tspan x={200} y={180}>
            Einen, der
          </tspan>
          <tspan x={200} y={205}>
            ungefragt
          </tspan>
          <tspan x={200} y={230}>
            Gitarre spielt.
          </tspan>
        </text>
      </Card>
      <Card x={150} y={272} w={150} h={150} rot={-4} fill="#fff" border="#bf5af2">
        <text fontFamily={SANS} fontWeight={800} fontSize={21} fill="#1b1030">
          <tspan x={168} y={310}>
            Tante
          </tspan>
          <tspan x={168} y={336}>
            Gisela.
          </tspan>
        </text>
        <circle cx={272} cy={392} r={17} fill="#bf5af2" />
        <path
          d="M264 392l6 6 10-12"
          stroke="#fff"
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Card>
      <g transform="translate(78 392) rotate(-24)" filter="url(#sh)">
        <rect x={-6} y={0} width={12} height={62} rx={5} fill="#8a5a24" />
        <rect x={-32} y={-24} width={64} height={28} rx={8} fill="#b07a3b" />
        <rect x={-32} y={-24} width={64} height={9} rx={4} fill="#fff" opacity={0.3} />
      </g>
      <Sparkle x={320} y={110} r={4} fill="#f0c8ff" />
      <Sparkle x={236} y={96} r={3} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Schätzfrage
// ---------------------------------------------------------------------------

function Schaetzfrage() {
  const balls: { x: number; y: number; c: string }[] = [];
  const cs = ['#ff375f', '#ffd60a', '#30d158', '#ff9f0a', '#bf5af2', '#ffffff', '#0a84ff'];
  let k = 0;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 92 + col * 25 + (row % 2) * 12 + ((k * 7) % 5) - 2;
      const y = 404 - row * 22 - ((k * 3) % 4);
      balls.push({ x, y, c: cs[(k * 5 + row) % cs.length] });
      k++;
    }
  }
  const jar =
    'M106 170h148v20c22 11 32 30 32 54v150c0 22-15 34-36 34H110c-21 0-36-12-36-34V244c0-24 10-43 32-54z';
  return (
    <g>
      <defs>
        <clipPath id="jar">
          <path d={jar} />
        </clipPath>
        <radialGradient id="candy" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity={0.65} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.25} />
        </radialGradient>
        <linearGradient id="lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd66a" />
          <stop offset="1" stopColor="#b8801e" />
        </linearGradient>
        <linearGradient id="glassJ" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={0.35} />
          <stop offset="0.25" stopColor="#fff" stopOpacity={0.05} />
          <stop offset="0.8" stopColor="#fff" stopOpacity={0.02} />
          <stop offset="1" stopColor="#fff" stopOpacity={0.3} />
        </linearGradient>
      </defs>
      <Halo x={180} y={290} r={150} color="#9be7ff" o={0.5} />
      <ellipse
        cx={180}
        cy={432}
        rx={120}
        ry={14}
        fill="#000"
        opacity={0.35}
        filter="url(#blur-s)"
      />
      <g filter="url(#sh)">
        <path d={jar} fill="#d6f3ff" opacity={0.2} />
        <g clipPath="url(#jar)">
          {balls.map((b, i) => (
            <g key={i}>
              <circle cx={b.x} cy={b.y} r={12} fill={b.c} />
              <circle cx={b.x} cy={b.y} r={12} fill="url(#candy)" />
            </g>
          ))}
        </g>
        <path d={jar} fill="url(#glassJ)" />
        <path d={jar} fill="none" stroke="#e8f8ff" strokeWidth={4} opacity={0.85} />
        <path
          d="M90 256c0-22 9-37 24-45"
          stroke="#fff"
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
          opacity={0.6}
        />
        <path d="M88 290v70" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.35} />
        <rect x={98} y={144} width={164} height={34} rx={9} fill="url(#lid)" />
        <path d="M104 154h152" stroke="#fff" strokeWidth={3} opacity={0.35} />
        <path d="M104 166h152" stroke="#8a5a14" strokeWidth={2} opacity={0.35} />
        <rect x={130} y={262} width={100} height={76} rx={12} fill="#fffdf6" />
        <rect
          x={130}
          y={262}
          width={100}
          height={76}
          rx={12}
          fill="none"
          stroke="#0a6d8f"
          strokeOpacity={0.3}
          strokeWidth={2}
        />
        <text x={180} y={322} textAnchor="middle" fontFamily="Anton" fontSize={58} fill="#0a6d8f">
          ?
        </text>
      </g>
      {[
        { x: 64, y: 112, t: '137' },
        { x: 296, y: 100, t: '88' },
        { x: 312, y: 244, t: '250' },
      ].map((b) => (
        <g key={b.t} filter="url(#shs)">
          <rect x={b.x - 36} y={b.y - 24} width={72} height={44} rx={15} fill="#fff" />
          <path d={`M${b.x - 7} ${b.y + 19}l7 11 7-11z`} fill="#fff" />
          <text
            x={b.x}
            y={b.y + 10}
            textAnchor="middle"
            fontFamily="Anton"
            fontSize={26}
            fill="#0a6d8f"
          >
            {b.t}
          </text>
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Zwei Wahrheiten, eine Lüge
// ---------------------------------------------------------------------------

function Stamp({ x, y, ok }: { x: number; y: number; ok: boolean }) {
  const c = ok ? '#30d158' : '#ff453a';
  return (
    <g filter="url(#shs)">
      <circle cx={x} cy={y} r={30} fill={c} />
      <circle cx={x} cy={y} r={30} fill="url(#sheen)" />
      <circle cx={x} cy={y} r={24} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={2} />
      {ok ? (
        <path
          d={`M${x - 13} ${y}l9 9 18-19`}
          stroke="#fff"
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d={`M${x - 11} ${y - 11}l22 22M${x + 11} ${y - 11}l-22 22`}
          stroke="#fff"
          strokeWidth={7}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function ZweiWahrheiten() {
  const cards = [
    { x: 34, rot: -16, ok: true, n: '1' },
    { x: 108, rot: 0, ok: true, n: '2' },
    { x: 182, rot: 16, ok: false, n: '3' },
  ];
  return (
    <g>
      <defs>
        <linearGradient id="lie" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff5f4" />
          <stop offset="1" stopColor="#ffd9d6" />
        </linearGradient>
      </defs>
      <Halo x={180} y={250} r={150} color="#8dffae" o={0.4} />
      {cards.map((c, i) => (
        <Card
          key={i}
          x={c.x}
          y={138 + (i === 1 ? -14 : 8)}
          w={144}
          h={206}
          rot={c.rot}
          fill={c.ok ? 'url(#paper)' : 'url(#lie)'}
          border={c.ok ? '#30d158' : '#ff453a'}
        >
          <text
            x={c.x + 20}
            y={190 + (i === 1 ? -14 : 8)}
            fontFamily="Anton"
            fontSize={34}
            fill={c.ok ? '#1e8a45' : '#c62a22'}
          >
            {c.n}
          </text>
          <rect
            x={c.x + 20}
            y={210 + (i === 1 ? -14 : 8)}
            width={104}
            height={10}
            rx={5}
            fill="#c7d3cc"
          />
          <rect
            x={c.x + 20}
            y={230 + (i === 1 ? -14 : 8)}
            width={84}
            height={10}
            rx={5}
            fill="#dde5e0"
          />
          <rect
            x={c.x + 20}
            y={250 + (i === 1 ? -14 : 8)}
            width={96}
            height={10}
            rx={5}
            fill="#dde5e0"
          />
          <Stamp x={c.x + 100} y={306 + (i === 1 ? -14 : 8)} ok={c.ok} />
        </Card>
      ))}
      <g filter="url(#sh)">
        <rect x={82} y={378} width={196} height={46} rx={23} fill="#fff" />
        <text
          x={180}
          y={410}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={22}
          fill="#1e8a45"
          letterSpacing={0.5}
        >
          EINE STIMMT NICHT
        </text>
      </g>
      <Sparkle x={316} y={112} r={4} />
      <Sparkle x={44} y={110} r={3} fill="#c9ffd9" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Top Ten
// ---------------------------------------------------------------------------

function TopTen() {
  const cols = [
    '#64d2ff',
    '#4fb8ff',
    '#3a9dff',
    '#4a82ff',
    '#6a6cff',
    '#8f5cf2',
    '#bf5af2',
    '#e050c8',
    '#ff4f8a',
    '#ff5c5c',
  ];
  // Ein Blatt auf der Hand: Drehpunkt unter dem Bild, jede Karte ein Stück
  // weiter rechts gedreht. Die Zahl steht oben links – nur die ist sichtbar.
  const px = 180;
  const py = 470;
  return (
    <g>
      <Halo x={180} y={250} r={150} color="#6fb6ff" o={0.55} />
      {cols.map((c, i) => {
        const n = i + 1;
        const deg = -30 + i * (60 / 9);
        const hot = n === 7;
        return (
          <g
            key={n}
            transform={`translate(${px} ${py}) rotate(${deg}) translate(0 ${hot ? -38 : 0})`}
            filter="url(#sh)"
          >
            <rect x={-40} y={-262} width={80} height={116} rx={10} fill={c} />
            <rect x={-40} y={-262} width={80} height={116} rx={10} fill="url(#sheen)" />
            <rect
              x={-35}
              y={-257}
              width={70}
              height={106}
              rx={7}
              fill="none"
              stroke="#fff"
              strokeOpacity={0.5}
              strokeWidth={1.2}
            />
            <text x={-30} y={-228} fontFamily="Anton" fontSize={24} fill="#fff">
              {n}
            </text>
            <text
              x={2}
              y={-180}
              textAnchor="middle"
              fontFamily="Anton"
              fontSize={n === 10 ? 40 : 48}
              fill="#fff"
              opacity={0.95}
            >
              {n}
            </text>
            {hot && (
              <rect
                x={-44}
                y={-266}
                width={88}
                height={124}
                rx={13}
                fill="none"
                stroke="#fff"
                strokeWidth={3.5}
              />
            )}
          </g>
        );
      })}
      <g filter="url(#sh)">
        <rect x={104} y={84} width={152} height={50} rx={25} fill="#fff" />
        <text
          x={180}
          y={119}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={28}
          fill="#0a4fa0"
          letterSpacing={0.5}
        >
          TOP TEN
        </text>
      </g>
      <Sparkle x={52} y={112} r={3.5} />
      <Sparkle x={318} y={120} r={3} fill="#ffd9f0" />
      <Sparkle x={300} y={210} r={4} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Mäxchen
// ---------------------------------------------------------------------------

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.27, 0.22],
    [0.27, 0.5],
    [0.27, 0.78],
    [0.73, 0.22],
    [0.73, 0.5],
    [0.73, 0.78],
  ],
};

/** Würfel in Isometrie: `x, y` = Mitte der Oberseite, `s` = Kantenlänge. */
function Die({
  x,
  y,
  s,
  top,
  left,
  right,
}: {
  x: number;
  y: number;
  s: number;
  top: number;
  left: number;
  right: number;
}) {
  const c = 0.866 * s;
  const face = (
    o: [number, number],
    a: [number, number],
    b: [number, number],
    n: number,
    fill: string,
    red = false,
  ) => (
    <g>
      <path
        d={`M${o[0]} ${o[1]}l${a[0]} ${a[1]}l${b[0]} ${b[1]}l${-a[0]} ${-a[1]}z`}
        fill={fill}
        stroke={fill}
        strokeWidth={7}
        strokeLinejoin="round"
      />
      <g transform={`matrix(${a[0]} ${a[1]} ${b[0]} ${b[1]} ${o[0]} ${o[1]})`}>
        {PIPS[n].map(([u, v], i) => (
          <circle
            key={i}
            cx={u}
            cy={v}
            r={n === 1 ? 0.14 : 0.1}
            fill={red && n === 1 ? '#e0242a' : '#1d1b22'}
          />
        ))}
      </g>
    </g>
  );
  return (
    <g filter="url(#sh)">
      {face([x - c, y], [c, s / 2], [0, s], left, '#e2e0e8')}
      {face([x, y + s / 2], [c, -s / 2], [0, s], right, '#c4c1cf')}
      {face([x - c, y], [c, -s / 2], [c, s / 2], top, '#ffffff', true)}
    </g>
  );
}

function Maexchen() {
  // Eine Etage höher als die anderen: die Würfel sollen auch im
  // Querformat der Spielseite (y 120–360) ganz zu sehen sein.
  return (
    <g transform="translate(0 -46)">
      <defs>
        <linearGradient id="leather" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5a2c12" />
          <stop offset="0.35" stopColor="#a4592a" />
          <stop offset="1" stopColor="#4a220c" />
        </linearGradient>
        <radialGradient id="felt" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#1f6b3a" />
          <stop offset="1" stopColor="#0c3a1d" />
        </radialGradient>
      </defs>
      <Halo x={180} y={260} r={150} color="#ffe680" o={0.5} />
      {/* Filz */}
      <ellipse cx={180} cy={352} rx={160} ry={62} fill="url(#felt)" filter="url(#sh)" />
      <ellipse
        cx={180}
        cy={352}
        rx={150}
        ry={56}
        fill="none"
        stroke="#ffd48a"
        strokeOpacity={0.4}
        strokeWidth={2}
        strokeDasharray="4 6"
      />
      {/* Becher, angehoben */}
      <g transform="rotate(-26 204 170)" filter="url(#sh)">
        <path d="M136 92h136l-18 158H154z" fill="url(#leather)" />
        <path d="M150 238h108l3 16H147z" fill="#e8c26a" />
        <path d="M137 96h134l-2 16H139z" fill="#e8c26a" />
        <path
          d="M150 124l14 108M258 124l-12 108"
          stroke="#2a1406"
          strokeWidth={2}
          strokeDasharray="4 4"
          opacity={0.7}
        />
        <ellipse cx={204} cy={252} rx={56} ry={12} fill="#1c0c04" />
        <path
          d="M160 130c6 30 8 60 8 96"
          stroke="#fff"
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.18}
          fill="none"
        />
      </g>
      <Die x={128} y={300} s={54} top={2} left={3} right={6} />
      <Die x={236} y={312} s={54} top={1} left={2} right={4} />
      <g filter="url(#sh)">
        <rect x={112} y={414} width={136} height={44} rx={22} fill="#fff" />
        <text
          x={180}
          y={445}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={26}
          fill="#8a5a00"
          letterSpacing={1}
        >
          MÄXCHEN!
        </text>
      </g>
      <path
        d="M72 244c-10-10-12-26-4-38M300 232c12-6 18-18 14-32"
        stroke="#fff"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
      <Sparkle x={312} y={110} r={4} fill="#fff6c2" />
      <Sparkle x={48} y={120} r={3} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Busfahrer
// ---------------------------------------------------------------------------

function Heart({
  x,
  y,
  s = 1,
  fill = '#e0242a',
}: {
  x: number;
  y: number;
  s?: number;
  fill?: string;
}) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -6c-4-6-14-6-14 2 0 7 9 12 14 18 5-6 14-11 14-18 0-8-10-8-14-2z"
      fill={fill}
    />
  );
}

function PlayCard({ x, y, r, face }: { x: number; y: number; r: number; face?: 'K' | 'A' | 'D' }) {
  return (
    <g transform={`rotate(${r} ${x + 24} ${y + 34})`} filter="url(#shs)">
      <rect x={x} y={y} width={48} height={68} rx={6} fill={face ? '#fff' : '#b8121c'} />
      {face ? (
        <>
          <text x={x + 7} y={y + 19} fontFamily="Anton" fontSize={17} fill="#c8202a">
            {face}
          </text>
          <Heart x={x + 26} y={y + 38} s={1.1} />
        </>
      ) : (
        <>
          <rect
            x={x + 5}
            y={y + 5}
            width={38}
            height={58}
            rx={4}
            fill="none"
            stroke="#fff"
            strokeWidth={1.6}
          />
          <path d={`M${x + 24} ${y + 16}l12 18-12 18-12-18z`} fill="#fff" opacity={0.6} />
        </>
      )}
      <rect x={x} y={y} width={48} height={24} rx={6} fill="#fff" opacity={0.18} />
    </g>
  );
}

function Busfahrer() {
  return (
    <g>
      <defs>
        <linearGradient id="bus" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe35c" />
          <stop offset="0.6" stopColor="#ffc400" />
          <stop offset="1" stopColor="#d99a00" />
        </linearGradient>
        <linearGradient id="win" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c8ecff" />
          <stop offset="1" stopColor="#5ba9e0" />
        </linearGradient>
        <radialGradient id="tire" cx="50%" cy="50%" r="50%">
          <stop offset="0.55" stopColor="#3a3a3a" />
          <stop offset="1" stopColor="#111" />
        </radialGradient>
      </defs>
      <Halo x={180} y={250} r={160} color="#fff08a" o={0.45} />
      {/* Straße */}
      <path d="M0 360h360v70H0z" fill="#1c1700" opacity={0.6} />
      <path
        d="M10 396h44M84 396h44M158 396h44M232 396h44M306 396h44"
        stroke="#fff"
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.65}
      />
      {/* Pyramide */}
      <PlayCard x={100} y={96} r={-8} />
      <PlayCard x={150} y={92} r={3} face="K" />
      <PlayCard x={200} y={96} r={9} />
      <PlayCard x={124} y={44} r={-4} face="A" />
      <PlayCard x={176} y={42} r={6} />
      {/* Bus */}
      <g filter="url(#sh)">
        <rect x={26} y={168} width={312} height={178} rx={30} fill="url(#bus)" />
        <rect x={26} y={300} width={312} height={46} rx={22} fill="#d99a00" />
        <rect x={26} y={292} width={312} height={11} fill="#1f1f1f" opacity={0.85} />
        <rect x={34} y={176} width={296} height={20} rx={10} fill="#fff" opacity={0.3} />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={48 + i * 60} y={200} width={50} height={56} rx={9} fill="url(#win)" />
            <path
              d={`M${56 + i * 60} ${248}l24 -40`}
              stroke="#fff"
              strokeWidth={6}
              opacity={0.45}
              strokeLinecap="round"
            />
          </g>
        ))}
        <rect x={290} y={200} width={38} height={92} rx={9} fill="url(#win)" />
        <rect x={295} y={206} width={10} height={80} rx={4} fill="#fff" opacity={0.5} />
        <rect x={34} y={264} width={24} height={22} rx={5} fill="#fff6c2" />
        <circle cx={330} cy={306} r={9} fill="#fff6c2" />
        <circle cx={330} cy={306} r={16} fill="#fff6c2" opacity={0.3} filter="url(#blur-s)" />
        <rect x={114} y={144} width={140} height={30} rx={7} fill="#1f1f1f" />
        <text
          x={184}
          y={166}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={18}
          fill="#ff9f0a"
          letterSpacing={1.5}
        >
          PYRAMIDE
        </text>
        {[96, 266].map((x) => (
          <g key={x}>
            <circle cx={x} cy={346} r={32} fill="url(#tire)" />
            <circle cx={x} cy={346} r={14} fill="#d0d0d0" />
            <circle cx={x} cy={346} r={5} fill="#666" />
          </g>
        ))}
      </g>
      <path
        d="M8 250h-4M14 230h-12M14 272h-10"
        stroke="#fff"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.5}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

function Kategorien() {
  const tiles = [
    { x: 54, y: 116, r: -9, c: '#ff375f', d: '#b8123a', icon: 'note' },
    { x: 196, y: 104, r: 7, c: '#ffc400', d: '#b88600', icon: 'globe' },
    { x: 50, y: 256, r: 6, c: '#0a84ff', d: '#0654a8', icon: 'mug' },
    { x: 196, y: 250, r: -7, c: '#bf5af2', d: '#7a2aa8', icon: 'film' },
  ];
  const icon = (kind: string, x: number, y: number) => {
    const cx = x + 56;
    const cy = y + 56;
    switch (kind) {
      case 'note':
        return (
          <g fill="#fff">
            <ellipse cx={cx - 12} cy={cy + 20} rx={14} ry={11} />
            <rect x={cx} y={cy - 34} width={7} height={56} />
            <path d={`M${cx + 7} ${cy - 34}c16 6 24 16 20 32-4-11-11-15-20-17z`} />
          </g>
        );
      case 'globe':
        return (
          <g fill="none" stroke="#fff" strokeWidth={5.5}>
            <circle cx={cx} cy={cy} r={34} />
            <ellipse cx={cx} cy={cy} rx={15} ry={34} />
            <path d={`M${cx - 34} ${cy}h68M${cx - 29} ${cy - 17}h58M${cx - 29} ${cy + 17}h58`} />
          </g>
        );
      case 'mug':
        return (
          <g>
            <rect x={cx - 28} y={cy - 22} width={42} height={54} rx={7} fill="#fff" />
            <rect x={cx - 21} y={cy - 12} width={28} height={38} rx={4} fill="#ffc400" />
            <path
              d={`M${cx + 14} ${cy - 12}h9a11 11 0 0 1 0 30h-9`}
              fill="none"
              stroke="#fff"
              strokeWidth={7}
            />
            <path
              d={`M${cx - 32} ${cy - 22}c0-13 13-17 19-11 5-9 20-9 24 2 9-2 15 5 13 11z`}
              fill="#fff"
            />
          </g>
        );
      default:
        return (
          <g fill="#fff">
            <rect x={cx - 34} y={cy - 6} width={68} height={42} rx={6} />
            <path d={`M${cx - 34} ${cy - 12}l64 -18 4 13 -64 18z`} />
            <path
              d={`M${cx - 22} ${cy - 16}l8 13M${cx - 4} ${cy - 21}l8 13M${cx + 14} ${cy - 26}l8 13`}
              stroke="#7a2aa8"
              strokeWidth={4.5}
            />
          </g>
        );
    }
  };
  return (
    <g>
      <Halo x={180} y={250} r={150} color="#b2fff8" o={0.4} />
      {tiles.map((t) => (
        <g key={t.icon} transform={`rotate(${t.r} ${t.x + 56} ${t.y + 56})`} filter="url(#sh)">
          <rect x={t.x} y={t.y + 8} width={112} height={112} rx={24} fill={t.d} />
          <rect x={t.x} y={t.y} width={112} height={112} rx={24} fill={t.c} />
          <rect x={t.x} y={t.y} width={112} height={112} rx={24} fill="url(#sheen)" />
          {icon(t.icon, t.x, t.y)}
        </g>
      ))}
      <g filter="url(#sh)">
        <path d="M92 390h176a22 22 0 0 1 0 44H92a22 22 0 0 1 0-44z" fill="#fff" />
        <path d="M120 390l-6-14 20 14z" fill="#fff" />
        <text
          x={180}
          y={421}
          textAnchor="middle"
          fontFamily="Anton"
          fontSize={24}
          fill="#0c5e58"
          letterSpacing={0.5}
        >
          BIERSORTEN …
        </text>
      </g>
      <Sparkle x={326} y={236} r={4} />
      <Sparkle x={30} y={236} r={3} fill="#ffe7a3" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Erste Zeile
// ---------------------------------------------------------------------------

function Note({ x, y, s = 1, fill = '#fff' }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill} filter="url(#shs)">
      <ellipse cx={-8} cy={20} rx={11} ry={8.5} transform="rotate(-20 -8 20)" />
      <rect x={0} y={-26} width={4.5} height={46} />
      <path d="M4.5 -26c13 4 19 13 15 26-3-9-9-13-15-14z" />
    </g>
  );
}

function ErsteZeile() {
  return (
    <g>
      <defs>
        <radialGradient id="mic" cx="38%" cy="32%" r="72%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#c9ccd6" />
          <stop offset="1" stopColor="#6e7384" />
        </radialGradient>
        <linearGradient id="handle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#15151b" />
          <stop offset="0.4" stopColor="#4a4a58" />
          <stop offset="1" stopColor="#101015" />
        </linearGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b8801e" />
          <stop offset="0.4" stopColor="#ffe7a3" />
          <stop offset="1" stopColor="#a8701a" />
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.5} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d="M150 0h60l90 480H60z" fill="url(#beam)" opacity={0.35} />
      <Halo x={180} y={200} r={130} color="#ff8fb0" o={0.6} />
      {[74, 104, 134].map((r, i) => (
        <path
          key={r}
          d={`M${180 - r} 196a${r} ${r} 0 0 1 ${r * 2} 0`}
          fill="none"
          stroke="#fff"
          strokeOpacity={0.45 - i * 0.12}
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      <g filter="url(#sh)">
        <path d="M158 264h44l-9 160c0 12-26 12-26 0z" fill="url(#handle)" />
        <rect x={146} y={250} width={68} height={26} rx={9} fill="url(#gold)" />
        <circle cx={180} cy={194} r={66} fill="url(#mic)" />
        <clipPath id="grill">
          <circle cx={180} cy={194} r={60} />
        </clipPath>
        <g clipPath="url(#grill)" stroke="#7a8092" strokeWidth={2} opacity={0.75}>
          {Array.from({ length: 14 }, (_, i) => (
            <line key={`a${i}`} x1={100 + i * 12} y1={120} x2={100 + i * 12 + 44} y2={280} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <line key={`b${i}`} x1={260 - i * 12} y1={120} x2={260 - i * 12 - 44} y2={280} />
          ))}
        </g>
        <rect x={114} y={188} width={132} height={13} fill="#ff375f" />
        <rect x={114} y={188} width={132} height={4} fill="#fff" opacity={0.35} />
        <path
          d="M134 164a54 54 0 0 1 40-38"
          stroke="#fff"
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
          opacity={0.75}
        />
      </g>
      <Note x={64} y={140} s={1.4} />
      <Note x={300} y={122} s={1.15} fill="#ffd60a" />
      <Note x={292} y={308} s={1.5} />
      <Note x={62} y={322} s={1.05} fill="#ffd60a" />
      <Sparkle x={252} y={92} r={3.5} />
      <Sparkle x={108} y={92} r={3} fill="#ffd60a" />
      <Sparkle x={320} y={216} r={2.5} />
    </g>
  );
}

export const SCENES: Scene[] = [
  { id: 'truth-or-dare', light: '#d77cff', mid: '#6d2194', deep: '#1a0628', art: TruthOrDare },
  {
    id: 'never-have-i-ever',
    light: '#5fd0ff',
    mid: '#0f6f94',
    deep: '#041c28',
    art: NeverHaveIEver,
  },
  { id: 'most-likely', light: '#ffb347', mid: '#b35a00', deep: '#2a1000', art: MostLikely },
  { id: 'undercover', light: '#7f7df7', mid: '#2b2a8a', deep: '#08071f', art: Undercover },
  { id: 'chaos-roulette', light: '#ffb347', mid: '#a84b00', deep: '#240c00', art: ChaosRoulette },
  { id: 'wortbombe', light: '#ff6a8c', mid: '#9c0f35', deep: '#24030d', art: Wortbombe },
  { id: 'duell', light: '#ff7a6c', mid: '#a3150d', deep: '#240504', art: Duell },
  { id: 'tabu', light: '#8a88ff', mid: '#2e2c99', deep: '#0a0926', art: Tabu },
  { id: 'meme-battle', light: '#6fe0d8', mid: '#12716b', deep: '#031e1c', art: MemeBattle },
  { id: 'lueckenfueller', light: '#d77cff', mid: '#5e1a85', deep: '#170523', art: Lueckenfueller },
  { id: 'schaetzfrage', light: '#5fd0ff', mid: '#0e6286', deep: '#031823', art: Schaetzfrage },
  { id: 'zwei-wahrheiten', light: '#5ff08a', mid: '#127a3a', deep: '#03200e', art: ZweiWahrheiten },
  { id: 'top-ten', light: '#4fa8ff', mid: '#0b4fa8', deep: '#03122a', art: TopTen },
  { id: 'maexchen', light: '#ffe35c', mid: '#b88a00', deep: '#2a1f00', art: Maexchen },
  { id: 'busfahrer', light: '#ffe35c', mid: '#a88000', deep: '#261c00', art: Busfahrer },
  { id: 'kategorien', light: '#7ae6e0', mid: '#16726c', deep: '#031e1c', art: Kategorien },
  { id: 'erste-zeile', light: '#ff6a90', mid: '#96103a', deep: '#22030e', art: ErsteZeile },
];
