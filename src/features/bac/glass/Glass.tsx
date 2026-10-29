import { useEffect, useRef, useState } from 'react';
import type { DrinkDefinition } from '../../../engine/types';
import { formatBac } from '../../../lib/format';
import { createSim, fillFraction, splash, stepSim } from './glassPhysics';
import type { GlassSim } from './glassPhysics';
import { GLASS_PROFILES, liquidFor, shapeFor } from './glassShapes';
import { useTilt } from './useTilt';
import './glass.css';

type Props = {
  bac: number;
  pending: number;
  target: number;
  drink: DrinkDefinition;
  showTarget: boolean;
  still: boolean;
};
const INK = {
  outline: 'rgba(255,246,232,0.45)',
  light: 'rgba(255,255,255,0.20)',
  foam: 'rgba(252,244,226,0.96)',
  bubble: 'rgba(255,244,214,0.55)',
  target: '#ff8a1e',
  shadow: 'rgba(0,0,0,0.55)',
  pending: 'rgba(255,250,224,0.48)',
  cloud: 'rgba(255,231,173,0.18)',
};

function draw(ctx: CanvasRenderingContext2D, s: GlassSim, props: Props, time: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, 280, 270);
  const profile = GLASS_PROFILES[shapeFor(props.drink.category)];
  const liquid = liquidFor(props.drink);
  const { height, stem, points } = profile;
  ctx.fillStyle = INK.shadow;
  ctx.beginPath();
  ctx.ellipse(140 + s.tilt * 30, 249, 65, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(140, 240);
  ctx.rotate(s.tilt);
  ctx.translate(0, -stem);
  const contour = () => {
    ctx.beginPath();
    points.forEach(([width, y], i) => {
      if (i === 0) ctx.moveTo(-width, -y);
      else ctx.lineTo(-width, -y);
    });
    for (let i = points.length - 1; i >= 0; i--) ctx.lineTo(points[i][0], -points[i][1]);
    ctx.closePath();
  };
  ctx.save();
  contour();
  ctx.clip();
  const surface = (x: number, level: number) =>
    -height * level +
    Math.tan(s.surf) * x +
    (props.still ? 0 : Math.sin(x * 0.09 + time * 3.1) * Math.min(4, 0.8 + Math.abs(s.vel)));
  const fill = (level: number) => {
    ctx.beginPath();
    ctx.moveTo(-100, 8);
    for (let x = -100; x <= 100; x += 3) ctx.lineTo(x, surface(x, level));
    ctx.lineTo(100, 8);
    ctx.closePath();
    ctx.fill();
  };
  const gradient = ctx.createLinearGradient(0, -height, 0, 0);
  gradient.addColorStop(0, liquid.top);
  gradient.addColorStop(0.55, liquid.mid);
  gradient.addColorStop(1, liquid.bottom);
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.5;
  fill(Math.min(0.94, s.level + s.pending));
  ctx.globalAlpha = 1;
  fill(s.level);
  if (liquid.cloudy) {
    ctx.fillStyle = INK.cloud;
    fill(s.level);
  }
  if (s.pending > 0.001) {
    ctx.fillStyle = INK.pending;
    ctx.beginPath();
    for (let x = -100; x <= 100; x += 3) {
      if (x === -100) ctx.moveTo(x, surface(x, s.level + s.pending));
      else ctx.lineTo(x, surface(x, s.level + s.pending));
    }
    for (let x = 100; x >= -100; x -= 3) ctx.lineTo(x, surface(x, s.level));
    ctx.closePath();
    ctx.fill();
  }
  if (liquid.foam || props.drink.category === 'sparkling' || props.drink.id === 'hard-seltzer') {
    ctx.strokeStyle = INK.bubble;
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      const x = Math.sin(i * 12.7) * 36;
      const y = -((i * 17.3 + time * (14 + (i % 5) * 5)) % height);
      if (y > surface(x, s.level) + 5) {
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + (i % 3) * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  if (liquid.foam) {
    ctx.fillStyle = INK.foam;
    ctx.beginPath();
    for (let x = -100; x <= 100; x += 3) {
      const y = surface(x, s.level) + 2;
      if (x === -100) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let x = 100; x >= -100; x -= 3) {
      ctx.lineTo(x, surface(x, s.level) - 8 - s.foam * 12 - Math.sin(x * 0.3) * 1.5);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  contour();
  ctx.stroke();
  if (stem) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, stem);
    ctx.moveTo(-32, stem);
    ctx.lineTo(32, stem);
    ctx.stroke();
  }
  ctx.strokeStyle = INK.light;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach(([width, y], i) => {
    if (i === 0) ctx.moveTo(-width + 8, -y - 8);
    else ctx.lineTo(-width + 8, -y + 10);
  });
  ctx.stroke();
  if (props.showTarget) {
    const y = height * 0.72;
    const index = points.findIndex((point) => point[1] >= y);
    const [w1, y1] = points[Math.max(0, index - 1)];
    const [w2, y2] = points[index];
    const width = w1 + ((w2 - w1) * (y - y1)) / (y2 - y1);
    ctx.strokeStyle = INK.target;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(width - 16, -y);
    ctx.lineTo(width + 8, -y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = INK.target;
    ctx.font = '12px monospace';
    ctx.fillText('ZIEL', width + 12, -y + 4);
  }
  ctx.restore();
}

export function Glass(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Die Schleife liest die Props über eine Ref: hinge sie an den Props selbst,
  // startete sie bei jedem Neuzeichnen des Tabs neu, und das Canvas flackerte.
  const live = useRef(props);
  const [sim] = useState(() => createSim(fillFraction(props.bac, props.target)));
  // Geschwappt wird beim Eintragen, nicht erst, wenn der Alkohol im Blut
  // ankommt: neu ist, was die Summe aus Blut und Magen erhöht.
  const previousTotal = useRef(props.bac + props.pending);
  const drag = useRef<{ id: number; x: number; base: number; target: number } | null>(null);
  const repaint = useRef<(() => void) | null>(null);
  const tilt = useTilt();
  const sensor = useRef({ on: false, target: 0 });
  const [prompt, setPrompt] = useState(false);
  const asked = useRef(false);
  const { still } = props;

  useEffect(() => {
    live.current = props;
  });
  useEffect(() => {
    sensor.current = { on: tilt.state === 'on', target: tilt.target };
  }, [tilt.state, tilt.target]);
  useEffect(() => {
    const total = props.bac + props.pending;
    if (total > previousTotal.current + 0.005) splash(sim);
    previousTotal.current = total;
  }, [props.bac, props.pending, sim]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = 280 * dpr;
    cv.height = 270 * dpr;
    const ctx = cv.getContext('2d');
    let frame: number | null = null;
    let last: number | null = null;
    const paint = (now: number) => {
      const p = live.current;
      const t = now / 1000;
      const levelGoal = fillFraction(p.bac, p.target);
      // Leises Schwanken, solange niemand zieht und kein Sensor lenkt: das
      // Glas steht auf einem Tisch, an dem gelacht wird.
      const idle =
        p.still || drag.current || sensor.current.on
          ? 0
          : Math.sin(t * 0.8) * 0.045 + Math.sin(t * 2.1) * 0.012;
      stepSim(sim, last === null ? 0 : (now - last) / 1000, {
        target: drag.current?.target ?? sensor.current.target + idle,
        levelGoal,
        pendingGoal: fillFraction(p.bac + p.pending, p.target) - levelGoal,
        still: p.still,
      });
      last = now;
      if (ctx) draw(ctx, sim, p, p.still ? 0 : t);
    };
    const loop = (now: number) => {
      paint(now);
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      last = null;
    };
    const resume = () => {
      stop();
      if (document.hidden) return;
      if (still) paint(0);
      else frame = requestAnimationFrame(loop);
    };
    repaint.current = () => paint(0);
    resume();
    document.addEventListener('visibilitychange', resume);
    return () => {
      stop();
      repaint.current = null;
      document.removeEventListener('visibilitychange', resume);
    };
  }, [still, sim]);

  // Im Stillstand läuft keine Schleife: jede neue Angabe zeichnet genau ein Bild.
  useEffect(() => {
    if (still) repaint.current?.();
  }, [still, props.bac, props.pending, props.target, props.drink, props.showTarget]);

  const release = (id: number) => {
    if (drag.current?.id !== id) return;
    drag.current = null;
  };
  return (
    <div className="glass">
      <canvas
        ref={canvas}
        className="glass__canvas"
        role="img"
        aria-label={`${props.drink.name}: ${formatBac(props.bac)} Promille`}
        onPointerDown={(event) => {
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            base: sim.tilt,
            target: sim.tilt,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          if (!asked.current && tilt.state === 'idle') {
            asked.current = true;
            setPrompt(true);
          }
        }}
        onPointerMove={(event) => {
          if (drag.current?.id === event.pointerId) {
            drag.current.target = Math.max(
              -0.6,
              Math.min(0.6, drag.current.base + (event.clientX - drag.current.x) / 160),
            );
          }
        }}
        onPointerUp={(event) => release(event.pointerId)}
        onPointerCancel={(event) => release(event.pointerId)}
        onLostPointerCapture={(event) => release(event.pointerId)}
      />
      {prompt && (
        <div className="glass__frage">
          <span className="glass__frage-text">Glas mitneigen?</span>
          <button
            type="button"
            className="btn btn--tinted btn--sm"
            onClick={() => {
              setPrompt(false);
              void tilt.request();
            }}
          >
            Erlauben
          </button>
          <button
            type="button"
            className="btn btn--plain btn--sm"
            onClick={() => {
              setPrompt(false);
              tilt.decline();
            }}
          >
            Nein danke
          </button>
        </div>
      )}
    </div>
  );
}
