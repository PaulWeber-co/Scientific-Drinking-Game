import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../components/icons';
import { haptic } from '../lib/haptics';
import { motionReduced } from '../lib/motion';

// Vier statt fünf: Der alte Start war ein zweites Spiele-Menü mit
// Promille-Anzeige davor. Die Spiele sind jetzt selbst der Start, die
// Promille-Anzeige lebt vollständig im Pegel-Tab.
const TABS: { to: string; icon: IconName; label: string }[] = [
  { to: '/', icon: 'games', label: 'Spiele' },
  { to: '/lobby', icon: 'people', label: 'Runde' },
  { to: '/pegel', icon: 'chart', label: 'Pegel' },
  { to: '/album', icon: 'album', label: 'Album' },
];

/** Innenabstand der Linse zur Kante der Leiste. */
const INSET = 4;
/** Ab hier ist ein Druck ein Ziehen über die Leiste. */
const DRAG_SLOP = 6;
/** So weit über oder unter der Leiste darf der Finger losgelassen werden. */
const RELEASE_SLOP = 56;
/** So lange nach einem eigenen Wechsel per Finger wird der Klick geschluckt. */
const CLICK_GUARD_MS = 700;

/** Welcher Tab die Seite trägt; -1, wenn keiner (z. B. das Profil). */
function activeIndex(pathname: string): number {
  if (pathname === '/' || pathname.startsWith('/spiele/')) return 0;
  return TABS.findIndex((t) => t.to !== '/' && pathname.startsWith(t.to));
}

/**
 * Die Tab-Leiste wie seit iOS 26: eine schwebende Glaskapsel statt eines
 * Balkens am Rand, darin eine Linse unter dem aktiven Tab.
 *
 * Die Linse ist das, was sich bewegt, nicht die Symbole:
 * - Drücken hebt sie an – sie wird größer und klar wie ein Tropfen.
 * - Ziehen über die Leiste nimmt sie mit; jeder Tab, über den sie gleitet,
 *   rastet spürbar ein. Loslassen wechselt dorthin.
 * - Beim Wechsel gleitet sie auf einer Feder hinüber, dehnt sich dabei in
 *   Laufrichtung und schwingt leicht nach.
 *
 * Gerechnet wird mit einer gedämpften Feder statt einer CSS-Transition: nur so
 * folgt die Linse dem Finger ohne Verzögerung und nimmt dessen Tempo mit,
 * wenn er loslässt. Die Schleife läuft nur, solange sich etwas bewegt.
 */
export function TabBar() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const active = activeIndex(pathname);
  // Das Profil öffnet sich aus den Spielen heraus – wie unter iOS bleibt
  // die Linse auf dem Tab, aus dem man gekommen ist.
  const home = active === -1 ? 0 : active;
  const bar = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const [lifted, setLifted] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const sim = useRef({ x: 0, v: 0, target: 0, lift: 0, liftV: 0, liftTarget: 0, placed: false });
  const frame = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const press = useRef<{ id: number; x: number; index: number; dragging: boolean } | null>(null);
  const guard = useRef(0);

  const geometry = useCallback(() => {
    const rect = bar.current?.getBoundingClientRect();
    const width = rect?.width ?? 0;
    const slot = Math.max(0, (width - INSET * 2) / TABS.length);
    return { left: rect?.left ?? 0, width, slot };
  }, []);

  const render = useCallback(() => {
    const el = lens.current;
    if (!el) return;
    const s = sim.current;
    const { slot } = geometry();
    el.style.width = `${slot}px`;
    // Dehnen in Laufrichtung, dafür etwas flacher: Volumen bleibt ungefähr.
    const speed = Math.abs(s.v);
    const stretch = Math.min(0.42, speed / 2600);
    const sx = (1 + stretch) * (1 + 0.16 * s.lift);
    const sy = (1 - stretch * 0.35) * (1 + 0.3 * s.lift);
    el.style.transform = `translate3d(${s.x.toFixed(2)}px, 0, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  }, [geometry]);

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      const dt = last.current === null ? 1 / 60 : Math.min(0.032, (now - last.current) / 1000);
      last.current = now;
      // Zwei Federn: Position (beim Ziehen straffer, damit sie am Finger
      // klebt) und Anheben. Leicht unterdämpft – das Nachschwingen ist der
      // Teil, der nach Flüssigkeit aussieht.
      const k = press.current?.dragging ? 900 : 430;
      const c = 2 * Math.sqrt(k) * (press.current?.dragging ? 0.9 : 0.62);
      const steps = 4;
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        s.v += (k * (s.target - s.x) - c * s.v) * h;
        s.x += s.v * h;
        s.liftV += (380 * (s.liftTarget - s.lift) - 2 * Math.sqrt(380) * 0.55 * s.liftV) * h;
        s.lift += s.liftV * h;
      }
      render();
      const resting =
        Math.abs(s.target - s.x) < 0.25 &&
        Math.abs(s.v) < 4 &&
        Math.abs(s.liftTarget - s.lift) < 0.004 &&
        Math.abs(s.liftV) < 0.02;
      if (resting) {
        s.x = s.target;
        s.v = 0;
        s.lift = s.liftTarget;
        s.liftV = 0;
        render();
        frame.current = null;
        last.current = null;
        return;
      }
      frame.current = requestAnimationFrame(tick);
    },
    [render],
  );

  const kick = useCallback(() => {
    if (motionReduced()) {
      const s = sim.current;
      s.x = s.target;
      s.v = 0;
      s.lift = 0;
      s.liftV = 0;
      render();
      return;
    }
    if (frame.current === null) frame.current = requestAnimationFrame(tick);
  }, [render, tick]);

  const slotX = useCallback(
    (index: number) => INSET + Math.max(0, index) * geometry().slot,
    [geometry],
  );

  // Aktiver Tab geändert (Tippen, Zurück, Link von woanders): Linse hinüber.
  // Beim ersten Mal ohne Fahrt – die App startet nicht mit einer Animation.
  useLayoutEffect(() => {
    const s = sim.current;
    if (press.current) return;
    s.target = slotX(home);
    if (!s.placed) {
      s.x = s.target;
      s.placed = true;
      render();
      return;
    }
    kick();
  }, [home, slotX, render, kick]);

  // Drehen oder Fenstergröße: Linse ohne Fahrt neu ausrichten.
  useEffect(() => {
    const onResize = () => {
      const s = sim.current;
      s.target = slotX(home);
      s.x = s.target;
      s.v = 0;
      render();
    };
    window.addEventListener('resize', onResize);
    // Auch wenn nur die Leiste ihre Breite ändert (Schrift lädt, Rand ändert sich).
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (bar.current) observer?.observe(bar.current);
    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [home, slotX, render]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const indexAt = (clientX: number) => {
    const { left, slot } = geometry();
    if (!slot) return home;
    return Math.max(0, Math.min(TABS.length - 1, Math.floor((clientX - left - INSET) / slot)));
  };

  const follow = (clientX: number) => {
    const { left, width, slot } = geometry();
    const s = sim.current;
    s.target = Math.max(INSET, Math.min(width - INSET - slot, clientX - left - slot / 2));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || press.current) return;
    const index = indexAt(e.clientX);
    press.current = { id: e.pointerId, x: e.clientX, index, dragging: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* Ohne Capture geht es auch, nur ohne Ziehen über den Rand hinaus. */
    }
    const s = sim.current;
    s.target = slotX(index);
    s.liftTarget = 1;
    setLifted(true);
    setHover(index);
    kick();
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (!p.dragging && Math.abs(e.clientX - p.x) < DRAG_SLOP) return;
    p.dragging = true;
    follow(e.clientX);
    const index = indexAt(e.clientX);
    if (index !== p.index) {
      p.index = index;
      setHover(index);
      haptic('select');
    }
    kick();
  };

  const finish = (e: PointerEvent<HTMLDivElement>, commit: boolean) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    const s = sim.current;
    s.liftTarget = 0;
    setLifted(false);
    setHover(null);
    // Weit über der Leiste losgelassen heißt: doch nicht – wie bei jedem
    // Knopf, von dem man den Finger wegzieht.
    const rect = bar.current?.getBoundingClientRect();
    if (rect && rect.height && (e.clientY < rect.top - RELEASE_SLOP || e.clientY > rect.bottom + RELEASE_SLOP)) {
      commit = false;
    }
    const index = commit ? indexAt(e.clientX) : home;
    s.target = slotX(index);
    kick();
    // Der Wechsel passiert hier und nicht im Klick: mit Pointer-Capture
    // landet der Klick je nach Browser auf der Leiste statt auf dem Tab.
    // Ein Klick danach ist darum immer doppelt – auch nach einem Abbruch.
    guard.current = performance.now();
    if (!commit) return;
    haptic('tap');
    goTo(index);
  };

  /** Wie unter iOS: der aktive Tab noch einmal führt nach oben bzw. zurück zum Anfang. */
  const goTo = (index: number) => {
    const to = TABS[index].to;
    if (pathname === to) window.scrollTo({ top: 0, behavior: motionReduced() ? 'auto' : 'smooth' });
    else nav(to);
  };

  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      <div
        ref={bar}
        className={`tabbar__inner${lifted ? ' is-pressed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, true)}
        onPointerCancel={(e) => finish(e, false)}
        // Geht der Finger ohne „Loslassen" verloren (App im Hintergrund),
        // darf die Linse nicht angehoben hängen bleiben.
        onLostPointerCapture={(e) => finish(e, false)}
      >
        <span ref={lens} className={`tabbar__lens${lifted ? ' is-lifted' : ''}`} aria-hidden />
        {TABS.map((t, i) => {
          const current = i === active;
          const lit = hover !== null ? hover === i : i === home;
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={current ? 'page' : undefined}
              className={`tabbar__item${lit ? ' is-lit' : ''}`}
              draggable={false}
              onClick={(e) => {
                // Tastatur und Screenreader klicken ohne Pointer – die gehen
                // durch. Nach einem Fingerwechsel ist der Klick doppelt.
                e.preventDefault();
                if (performance.now() - guard.current < CLICK_GUARD_MS) return;
                haptic('tap');
                goTo(i);
              }}
            >
              <Icon name={t.icon} size={24} className="tabbar__icon" />
              <span className="tabbar__label">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
