import { useEffect, useMemo, useRef, useState } from 'react';
import type { DrinkDefinition } from '../../../engine/types';
import { formatBac } from '../../../lib/format';
import { haptic } from '../../../lib/haptics';
import { STAGE, createSim, fillFraction, setGlass, splash, stepSim, tap } from './glassPhysics';
import { drawGlass } from './glassRender';
import { glassFor, liquidFor } from './glassShapes';
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

/** So weit lässt sich das Glas über den Tisch ziehen, bevor es sich sträubt. */
const REACH = 64;

/** Über die Reichweite hinaus wird Ziehen zäh wie ein Gummiband. */
function rubber(x: number): number {
  const a = Math.abs(x);
  if (a <= REACH) return x;
  return Math.sign(x) * (REACH + (1 - 1 / ((a - REACH) / 60 + 1)) * 60);
}

/**
 * Das eigene Glas im Pegel-Tab: Füllstand ist der Pegel, die Form das
 * Getränk. Mit Sensor schwappt es beim Kippen und Schütteln des Handys,
 * ohne Sensor lässt es sich mit dem Finger über den Tisch schieben.
 */
export function Glass(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Die Schleife liest die Props über eine Ref: hinge sie an den Props selbst,
  // startete sie bei jedem Neuzeichnen des Tabs neu, und das Canvas flackerte.
  const live = useRef(props);
  const shape = glassFor(props.drink);
  const look = useMemo(() => liquidFor(props.drink), [props.drink]);
  const [sim] = useState(() => {
    const level = fillFraction(props.bac, props.target);
    return createSim(level, fillFraction(props.bac + props.pending, props.target) - level, shape, look);
  });
  // Geschwappt wird beim Eintragen, nicht erst, wenn der Alkohol im Blut
  // ankommt: neu ist, was die Summe aus Blut und Magen erhöht.
  const previousTotal = useRef(props.bac + props.pending);
  const hold = useRef<{ id: number; x: number; base: number; target: number; moved: boolean; at: number } | null>(
    null,
  );
  const repaint = useRef<(() => void) | null>(null);
  const tilt = useTilt();
  const gravity = tilt.gravity;
  const [prompt, setPrompt] = useState(false);
  const asked = useRef(false);
  const { still } = props;

  useEffect(() => {
    live.current = props;
  });

  // Anderes Getränk, anderes Glas.
  useEffect(() => {
    if (sim.shape === shape && sim.look === look) return;
    setGlass(sim, shape, look);
    repaint.current?.();
  }, [sim, shape, look]);

  useEffect(() => {
    const total = props.bac + props.pending;
    if (total > previousTotal.current + 0.005) splash(sim);
    previousTotal.current = total;
  }, [props.bac, props.pending, sim]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = STAGE.width * dpr;
    cv.height = STAGE.height * dpr;
    const ctx = cv.getContext('2d');
    let frame: number | null = null;
    let last: number | null = null;
    let onScreen = true;
    const paint = (now: number) => {
      const p = live.current;
      const levelGoal = fillFraction(p.bac, p.target);
      stepSim(sim, last === null ? 0 : (now - last) / 1000, {
        levelGoal,
        pendingGoal: fillFraction(p.bac + p.pending, p.target) - levelGoal,
        still: p.still,
        gravity: gravity.current,
        hold: hold.current ? hold.current.target : null,
      });
      last = now;
      if (ctx) drawGlass(ctx, sim, { showTarget: p.showTarget, still: p.still, time: p.still ? 0 : now / 1000 });
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
      if (document.hidden || !onScreen) return;
      if (still) paint(0);
      else frame = requestAnimationFrame(loop);
    };
    repaint.current = () => paint(0);
    resume();
    document.addEventListener('visibilitychange', resume);
    // Weggescrollt rechnet niemand mit: dann ruht die Schleife.
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(([entry]) => {
        const visible = entry?.isIntersecting ?? true;
        if (visible === onScreen) return;
        onScreen = visible;
        resume();
      });
      observer.observe(cv);
    }
    return () => {
      stop();
      observer?.disconnect();
      repaint.current = null;
      document.removeEventListener('visibilitychange', resume);
    };
  }, [still, sim, gravity]);

  // Im Stillstand läuft keine Schleife: jede neue Angabe zeichnet genau ein Bild.
  useEffect(() => {
    if (still) repaint.current?.();
  }, [still, props.bac, props.pending, props.target, props.drink, props.showTarget]);

  const release = (id: number, clientX?: number) => {
    const h = hold.current;
    if (h?.id !== id) return;
    hold.current = null;
    // Kurz angetippt statt gezogen: das Glas klingt an.
    if (!h.moved && performance.now() - h.at < 350 && clientX !== undefined && canvas.current) {
      const rect = canvas.current.getBoundingClientRect();
      const scale = rect.width ? STAGE.width / rect.width : 1;
      tap(sim, (clientX - rect.left) * scale - STAGE.centerX - sim.offset);
      haptic('tick');
    }
  };
  return (
    <div className="glass">
      <canvas
        ref={canvas}
        className="glass__canvas"
        role="img"
        aria-label={`${props.drink.name}: ${formatBac(props.bac)} Promille`}
        onPointerDown={(event) => {
          hold.current = {
            id: event.pointerId,
            x: event.clientX,
            base: sim.offset,
            target: sim.offset,
            moved: false,
            at: performance.now(),
          };
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* Ohne Capture endet das Ziehen am Rand des Bildes. */
          }
          if (!asked.current && tilt.state === 'idle') {
            asked.current = true;
            setPrompt(true);
          }
        }}
        onPointerMove={(event) => {
          const h = hold.current;
          if (h?.id !== event.pointerId) return;
          const dx = event.clientX - h.x;
          if (Math.abs(dx) > 4) h.moved = true;
          h.target = rubber(h.base + dx);
        }}
        onPointerUp={(event) => release(event.pointerId, event.clientX)}
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
