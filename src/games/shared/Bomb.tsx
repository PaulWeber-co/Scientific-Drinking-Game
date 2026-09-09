import { useEffect, useRef, useState } from 'react';

/**
 * Die Bombe der Wortbombe.
 *
 * Vorher war das ein Icon, das im Takt größer und kleiner wurde – ein
 * pulsierendes Zeichen, kein Gegenstand. Der Aufbau zur Explosion lebt aber
 * davon, dass man SIEHT, wie die Zeit verbrennt: eine Zündschnur, die kürzer
 * wird, ein Funke, der auf das Gehäuse zuwandert, und ein Körper, der sich
 * auflädt, bis er glüht.
 *
 * Drei Dinge liefen dabei vorher schief und sind hier bewusst anders gelöst:
 *
 * 1. Der Fortschritt kommt aus `armedAt`/`explodesAt`, nicht aus einer
 *    Zustandsvariablen, die alle 120 ms neu gesetzt wird. Damit läuft die
 *    Animation flüssig (ein `requestAnimationFrame` statt 8 Sprünge je
 *    Sekunde) und ist auf allen Geräten einer Online-Runde identisch.
 * 2. Die Zündschnur brennt nicht linear ab, sondern beschleunigt
 *    (`BURN_EXP`). Sie ist damit ein Spannungsbogen und keine Restanzeige –
 *    wie lang die Schnur insgesamt war, weiß niemand.
 * 3. Alles, was wackelt, sitzt in eigenen Ebenen. Das Gehäuse zittert, der
 *    Funke flackert, die Glut atmet – vorher haben sich Skalierung und
 *    Rotation auf demselben Element überlagert und die Bombe ist dabei
 *    sichtbar gesprungen.
 */

/** Wie viel der Schnur beim Knall verbrannt ist. Nie ganz: der Rest steckt
 *  im Gehäuse, und ein Funke, der exakt auf 0 ausläuft, verrät den Moment. */
const BURN_MAX = 0.93;
/** > 1 heißt: hinten wird es schnell. Der Funke rast das letzte Stück. */
const BURN_EXP = 1.45;

export function Bomb({ armedAt, explodesAt }: { armedAt: number; explodesAt: number }) {
  const fuseRef = useRef<SVGPathElement | null>(null);
  const funkeRef = useRef<SVGGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Nur für das, was wirklich neu gerendert werden muss: die Hitze-Klasse.
  const [heiß, setHeiß] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    const fuse = fuseRef.current;
    if (!el) return;

    // `getTotalLength` gibt es nur in einer echten SVG-Engine. Fehlt sie
    // (Test, alter WebView), bleibt die Schnur eben stehen – der Rest der
    // Animation läuft trotzdem.
    const länge = fuse?.getTotalLength?.() ?? 0;
    const dauer = Math.max(1, explodesAt - armedAt);
    let frame = 0;
    let warHeiß = false;

    const zeichne = () => {
      const p = Math.max(0, Math.min(1, (Date.now() - armedAt) / dauer));
      const burn = BURN_MAX * Math.pow(p, BURN_EXP);

      // Die Spannung steuert Zittern, Glut und Tempo – als CSS-Variable,
      // damit die Animationen auf dem Compositor bleiben.
      el.style.setProperty('--t', p.toFixed(3));

      if (länge && fuse) {
        const rest = länge * (1 - burn);
        // Sichtbar ist nur das Stück vom Gehäuse bis zum Funken.
        fuse.style.strokeDasharray = `${rest} ${länge + 1}`;
        const punkt = fuse.getPointAtLength(rest);
        funkeRef.current?.setAttribute('transform', `translate(${punkt.x} ${punkt.y})`);
      }

      const jetztHeiß = p > 0.66;
      if (jetztHeiß !== warHeiß) {
        warHeiß = jetztHeiß;
        setHeiß(jetztHeiß);
      }
      frame = requestAnimationFrame(zeichne);
    };
    zeichne();
    return () => cancelAnimationFrame(frame);
  }, [armedAt, explodesAt]);

  return (
    <div ref={wrapRef} className={`bombe ${heiß ? 'bombe--heiss' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 240 250" className="bombe__svg">
        <defs>
          {/* Gusseisen: oben Streiflicht, unten fast schwarz. */}
          <radialGradient id="bombe-koerper" cx="36%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#6b6b76" />
            <stop offset="42%" stopColor="#33333c" />
            <stop offset="100%" stopColor="#0d0d11" />
          </radialGradient>
          {/* Die Glut sitzt IM Gehäuse und wächst nach außen. Sie muss früh
              transparent werden: zieht sie sich bis an den Rand, wird aus
              gluehendem Eisen ein hellgrauer Ballon. */}
          <radialGradient id="bombe-glut" cx="50%" cy="68%" r="58%">
            {/* Kein helles Gelb im Kern: „screen“ ueber dem blaugrauen Eisen
                zieht es ins Gruenliche. Orange bleibt Orange. */}
            <stop offset="0%" stopColor="#ff8c1a" stopOpacity="1" />
            <stop offset="24%" stopColor="#ff3d08" stopOpacity="0.92" />
            <stop offset="58%" stopColor="#a81200" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#4a0800" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bombe-funke" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffdf0" />
            <stop offset="35%" stopColor="#ffd76a" />
            <stop offset="70%" stopColor="#ff7a18" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#ff3b18" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Schatten auf dem Boden – ohne ihn schwebt der Körper. */}
        <ellipse className="bombe__schatten" cx="120" cy="236" rx="56" ry="10" />

        <g className="bombe__zittern">
          {/* Zündschnur. Nur der VERBLIEBENE Teil wird gezeichnet – wäre die
              ganze Bahn zu sehen, stünde da eine Restanzeige. */}
          <path
            ref={fuseRef}
            className="bombe__lunte"
            d="M126 84 C 150 62, 176 74, 178 50 C 180 28, 160 22, 148 30"
          />

          {/* Gehäuse */}
          <g className="bombe__koerper">
            <circle cx="120" cy="158" r="68" fill="url(#bombe-koerper)" />
            <circle className="bombe__glut" cx="120" cy="158" r="68" fill="url(#bombe-glut)" />
            {/* Streiflicht oben links – macht aus dem Kreis eine Kugel. */}
            <ellipse
              className="bombe__licht"
              cx="96"
              cy="128"
              rx="26"
              ry="17"
              transform="rotate(-28 96 128)"
            />
            {/* Kantenlicht unten rechts, damit der Körper nicht wegsackt. */}
            <path
              className="bombe__kante"
              d="M172 186 A 68 68 0 0 1 108 225"
            />
            {/* Hitzerisse. Sie kommen erst spaet und machen aus „leuchtet rot“
                ein „gleich platzt es“ – ohne sie ist die Glut nur Licht. */}
            <g className="bombe__risse">
              <path d="M92 132 L104 152 L96 168 L110 188" />
              <path d="M138 122 L130 146 L146 158 L138 182" />
              <path d="M74 168 L94 176 L88 196" />
              <path d="M158 176 L142 192 L150 208" />
            </g>
            {/* Stutzen, in dem die Schnur steckt. */}
            <path
              className="bombe__stutzen"
              d="M105 100 L110 78 A 12 12 0 0 1 134 78 L139 100 Z"
            />
            <ellipse className="bombe__stutzenrand" cx="122" cy="79" rx="12.5" ry="4.2" />
          </g>

          {/* Funke am Ende der Schnur. Die Position setzt der Frame-Loop. */}
          <g ref={funkeRef} className="bombe__funke">
            <circle className="bombe__funke-hof" r="26" fill="url(#bombe-funke)" />
            <circle className="bombe__funke-kern" r="5" />
            {/* Fliegende Funken. Winkel und Weite fest, aber ungleich –
                gleichmäßig verteilt sieht es nach Zahnrad aus. */}
            {SPLITTER.map((s, i) => (
              <circle
                key={i}
                className="bombe__splitter"
                r={s.r}
                style={{
                  ['--a' as string]: `${s.a}deg`,
                  ['--d' as string]: `${s.d}px`,
                  ['--delay' as string]: `${s.delay}ms`,
                }}
              />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}

/** Sieben Funken mit unregelmäßigen Winkeln, Weiten und Startzeiten. */
const SPLITTER = [
  { a: -70, d: 34, r: 2.4, delay: 0 },
  { a: -28, d: 26, r: 1.7, delay: 120 },
  { a: 14, d: 30, r: 2.1, delay: 240 },
  { a: 62, d: 22, r: 1.5, delay: 60 },
  { a: 128, d: 28, r: 2.0, delay: 320 },
  { a: -142, d: 24, r: 1.6, delay: 180 },
  { a: 178, d: 32, r: 2.3, delay: 400 },
];
