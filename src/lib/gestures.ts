import { useEffect, useRef, useState, type RefObject } from 'react';
import { motionReduced } from './motion';

/**
 * Wischgesten wie bei iOS: Zurück mit einem Wisch nach rechts, Sheets mit
 * einem Wisch nach unten weg.
 *
 * Beide folgen dem Finger 1:1 und entscheiden erst beim Loslassen – über
 * Weg ODER Tempo. Ein kurzer, schneller Schnipser reicht also genauso wie ein
 * langer, langsamer Zug. Abbrechen geht jederzeit: Finger zurück, loslassen.
 *
 * Touch-Ereignisse statt Pointer-Ereignisse: Nur bei `touchmove` mit
 * `passive: false` lässt sich das Scrollen der Seite unterdrücken, sobald
 * klar ist, dass gewischt und nicht gescrollt wird. Pointer-Ereignisse
 * enden in dem Moment mit `pointercancel`, in dem der Browser scrollt.
 */

/** Ab hier ist eine Bewegung eine Richtung und kein Zittern. */
const SLOP = 8;
/** Vom Rand aus gewinnt das Zurück immer, auch über Schiebern und Listen. */
const EDGE = 28;
/** Tempo in px/ms, ab dem ein kurzer Schnipser reicht. */
const FLICK = 0.45;

/** Hier gehört die Bewegung dem Element selbst. */
const OWN_GESTURE =
  'input, textarea, select, [contenteditable="true"], canvas, video, [data-swipe-ignore]';

/** Liegt zwischen Ziel und Grenze etwas, das selbst seitlich scrollt? */
function scrollsSideways(from: Element | null, stop: Element): boolean {
  for (let el = from; el && el !== stop; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
  }
  return false;
}

/** Ist zwischen Ziel und Grenze etwas nach unten gescrollt? */
function scrolledDown(from: Element | null, stop: Element): boolean {
  for (let el = from; el; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
    if (el === stop) return false;
  }
  return false;
}

/** Tempo der letzten ~100 ms in px/ms; älteres zählt nicht, sonst bremst ein Zögern den Schnipser. */
function velocity(samples: { v: number; t: number }[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const first = samples.find((s) => last.t - s.t <= 100) ?? samples[0];
  const dt = last.t - first.t;
  return dt > 0 ? (last.v - first.v) / dt : 0;
}

function track(samples: { v: number; t: number }[], v: number, t: number) {
  samples.push({ v, t });
  if (samples.length > 12) samples.shift();
}

/** Alle Nachlaeufe gehoeren zur konkreten sichtbaren Seite bzw. zum Sheet. */
function gestureTimers() {
  const pending = new Set<number>();
  return {
    later(callback: () => void, ms: number) {
      const id = window.setTimeout(() => { pending.delete(id); callback(); }, ms);
      pending.add(id);
      return id;
    },
    clear() { pending.forEach((id) => window.clearTimeout(id)); pending.clear(); },
  };
}

/**
 * Vom Rand oder aus der Fläche nach rechts wischen: die Seite folgt dem
 * Finger und gleitet beim Loslassen hinaus – dann erst geht es zurück.
 *
 * Wie seit iOS 26 nicht nur vom Rand: Wer mitten auf der Seite nach rechts
 * zieht, meint dasselbe. Ausgenommen sind Stellen, die selbst seitlich
 * bewegt werden (Schieber, Karussells, das Glas im Pegel-Tab) – dort gilt nur
 * der schmale Streifen am linken Rand.
 *
 * `stay`: Die Seite bleibt danach stehen (ein Schritt zurück im selben
 * Bildschirm, etwa im Onboarding). Dann springt sie sofort heim, statt
 * hinauszugleiten.
 */
export function useSwipeBack<T extends HTMLElement>(
  onBack: () => void,
  { enabled = true, stay = false }: { enabled?: boolean; stay?: boolean } = {},
): (el: T | null) => void {
  // Als State statt als Ref: Bildschirme rendern ihr Wurzelelement oft erst
  // nach einem Ladezustand, dann muss die Geste nachträglich andocken.
  const [el, setEl] = useState<T | null>(null);
  const back = useRef(onBack);
  useEffect(() => {
    back.current = onBack;
  });

  useEffect(() => {
    if (!el || !enabled) return;
    const timers = gestureTimers();
    let phase: 'idle' | 'pending' | 'drag' | 'off' = 'idle';
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let offset = 0;
    let fromEdge = false;
    let timer: number | undefined;
    // Die Seite gleitet gerade hinaus: dann gehört sie niemandem mehr.
    let leaving = false;
    const samples: { v: number; t: number }[] = [];

    const width = () => el.getBoundingClientRect().width || window.innerWidth;
    const place = (x: number, ms = 0) => {
      el.style.transition = ms ? `translate ${ms}ms var(--ease-out), box-shadow ${ms}ms linear` : 'none';
      el.style.translate = x > 0 ? `${x}px 0` : '';
    };
    const reset = () => {
      el.style.transition = '';
      el.style.translate = '';
      delete el.dataset.swiping;
    };

    const onStart = (e: TouchEvent) => {
      // Ein neuer Finger darf das Zurück nicht abbrechen – sonst hinge die
      // Seite unsichtbar neben dem Bildschirm.
      if (leaving) return;
      // Federt sie noch zurück, steht sie ab sofort.
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
        reset();
      }
      if (e.touches.length !== 1) {
        if (phase === 'drag') settle(false);
        phase = 'off';
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      fromEdge = startX <= EDGE;
      const target = e.target instanceof Element ? e.target : null;
      if (!fromEdge && target && (target.closest(OWN_GESTURE) || scrollsSideways(target, el))) {
        phase = 'off';
        return;
      }
      phase = 'pending';
      samples.length = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (phase === 'off' || phase === 'idle') return;
      const t = e.touches[0];
      if (!t) return;
      if (phase === 'pending') {
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        // Deutlich waagerecht und nach rechts – sonst gehört die Bewegung
        // dem Scrollen. Vom Rand reicht etwas weniger Eindeutigkeit.
        if (dx > 0 && dx > Math.abs(dy) * (fromEdge ? 1 : 1.4)) {
          phase = 'drag';
          originX = t.clientX;
          el.dataset.swiping = '';
        } else {
          phase = 'off';
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      offset = Math.max(0, t.clientX - originX);
      track(samples, offset, e.timeStamp);
      place(offset);
    };

    const settle = (commit: boolean) => {
      phase = 'idle';
      const w = width();
      if (!commit) {
        place(0, motionReduced() ? 0 : 320);
        timer = timers.later(() => {
          timer = undefined;
          reset();
        }, 330);
        return;
      }
      if (stay || motionReduced()) {
        reset();
        back.current();
        return;
      }
      // Gleiten mit dem Tempo des Fingers: je schneller der Schnipser,
      // desto kürzer der Rest – wie beim System.
      const v = Math.max(velocity(samples), 0.6);
      const ms = Math.round(Math.min(280, Math.max(120, (w - offset) / v)));
      leaving = true;
      place(w, ms);
      timers.later(() => {
        back.current();
        // Bleibt die Seite trotzdem stehen (keine Navigation passiert),
        // kommt sie zurück statt unsichtbar außerhalb zu hängen.
        timers.later(() => {
          leaving = false;
          if (el.isConnected) reset();
        }, 120);
      }, ms);
    };

    const onEnd = () => {
      if (phase !== 'drag') {
        phase = 'idle';
        return;
      }
      const w = width();
      const v = velocity(samples);
      settle(offset > w * 0.35 || (v > FLICK && offset > 24));
    };
    const onCancel = () => {
      if (phase === 'drag') settle(false);
      else phase = 'idle';
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onCancel);
    return () => {
      window.clearTimeout(timer);
      timers.clear();
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
      reset();
    };
  }, [el, enabled, stay]);

  return setEl;
}

/**
 * Ein Sheet nach unten wegziehen – vom Griff aus immer, aus dem Inhalt,
 * sobald der ganz oben steht. Wer weiter scrollen will, scrollt.
 *
 * Nach oben gibt es Widerstand statt einer Grenze: das Sheet dehnt sich ein
 * paar Pixel und federt zurück, so wie das Original.
 */
export function useSwipeDown<T extends HTMLElement>(
  onClose: () => void,
  scrim?: RefObject<HTMLElement | null>,
): (el: T | null) => void {
  const [el, setEl] = useState<T | null>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!el) return;
    const timers = gestureTimers();
    let phase: 'idle' | 'pending' | 'drag' | 'off' = 'idle';
    let startX = 0;
    let startY = 0;
    let originY = 0;
    let offset = 0;
    let fromGrip = false;
    let timer: number | undefined;
    // Das Sheet gleitet gerade hinaus und schließt gleich.
    let closing = false;
    const samples: { v: number; t: number }[] = [];

    const place = (y: number, ms = 0) => {
      el.style.transition = ms ? `translate ${ms}ms var(--ease-spring)` : 'none';
      el.style.translate = y ? `0 ${y}px` : '';
      const h = el.getBoundingClientRect().height || window.innerHeight;
      // Der Hintergrund hellt mit auf: man sieht, wohin man zurückkehrt.
      const backdrop = scrim?.current;
      if (backdrop) {
        const shade = Math.max(0, Math.min(1, 1 - y / h));
        backdrop.style.transition = ms ? `background-color ${ms}ms linear` : 'none';
        backdrop.style.backgroundColor = `rgba(0, 0, 0, ${(0.5 * shade).toFixed(3)})`;
      }
    };
    const reset = () => {
      el.style.transition = '';
      el.style.translate = '';
      if (scrim?.current) {
        scrim.current.style.transition = '';
        scrim.current.style.backgroundColor = '';
      }
    };

    const onStart = (e: TouchEvent) => {
      // Ein neuer Finger darf das Schließen nicht abbrechen – sonst bliebe
      // der dunkle Hintergrund ohne Sheet stehen.
      if (closing) return;
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
        reset();
      }
      if (e.touches.length !== 1) {
        phase = 'off';
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      const target = e.target instanceof Element ? e.target : null;
      // Griff und Kopfzeile: die obersten 56 px des Sheets.
      fromGrip = t.clientY - el.getBoundingClientRect().top <= 56;
      if (!fromGrip && target && (target.closest(OWN_GESTURE) || scrolledDown(target, el))) {
        phase = 'off';
        return;
      }
      phase = 'pending';
      samples.length = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (phase === 'off' || phase === 'idle') return;
      const t = e.touches[0];
      if (!t) return;
      if (phase === 'pending') {
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        if (dy > 0 && dy > Math.abs(dx) && (fromGrip || el.scrollTop <= 0)) {
          phase = 'drag';
          originY = t.clientY;
        } else {
          phase = 'off';
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      const raw = t.clientY - originY;
      // Nach oben nur ein Hauch: Gummiband statt harter Kante.
      offset = raw >= 0 ? raw : -Math.min(18, Math.sqrt(-raw) * 2);
      track(samples, offset, e.timeStamp);
      place(offset);
    };

    const onEnd = () => {
      if (phase !== 'drag') {
        phase = 'idle';
        return;
      }
      phase = 'idle';
      const h = el.getBoundingClientRect().height || window.innerHeight;
      const v = velocity(samples);
      if (offset > h * 0.3 || (v > FLICK && offset > 20)) {
        if (motionReduced()) {
          reset();
          close.current();
          return;
        }
        const ms = Math.round(Math.min(260, Math.max(120, (h - offset) / Math.max(v, 0.8))));
        closing = true;
        place(h, ms);
        timers.later(() => {
          close.current();
          // Lehnt der Besitzer das Schließen ab, kommt das Sheet zurück.
          timers.later(() => {
            closing = false;
            if (el.isConnected) springBack(320);
          }, 60);
        }, ms);
      } else {
        springBack(motionReduced() ? 0 : 420);
      }
    };
    const springBack = (ms: number) => {
      place(0, ms);
      timer = timers.later(() => {
        timer = undefined;
        reset();
      }, ms + 10);
    };
    const onCancel = () => {
      if (phase === 'drag') springBack(320);
      phase = 'idle';
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onCancel);
    return () => {
      window.clearTimeout(timer);
      timers.clear();
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, [el, scrim]);

  return setEl;
}
