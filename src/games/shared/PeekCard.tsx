import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';

/**
 * Eine Karte, die man mit dem Finger nach oben schiebt, um zu sehen, was
 * darunter liegt. Loslassen legt sie zurück.
 *
 * Warum ziehen statt tippen: Der Deckel folgt dem Finger 1:1, deshalb fühlt es
 * sich nach einem Gegenstand an und nicht nach einer ausgelösten Animation.
 * Und ein Fehlgriff ist harmlos — wer zu früh loslässt, verdeckt nur; es kann
 * nie versehentlich zum nächsten Spieler weitergeschaltet werden.
 *
 * Bedienbar ist sie auch ohne Ziehen: ein Tipp rastet sie offen, der nächste
 * schließt sie wieder. Das verlangt WCAG 2.2 (SC 2.5.7) und hilft nebenbei
 * jedem, der die Karte länger lesen will.
 */

/** Ab hier gilt die Bewegung als Ziehen, darunter als Tipp. */
const DRAG_START_PX = 3;
/** Wie weit der Deckel geht, als Anteil der Kartenhöhe. */
const MAX_LIFT = 0.6;
/** Ab diesem Anteil des Hubs ist lesbar, was darunter steht. */
const READ_ON = 0.4;
/** Und erst darunter gilt es wieder als zu — Hysterese gegen Zittern. */
const READ_OFF = 0.32;
/** Gummiband jenseits des Anschlags. Die Konstante stammt von iOS. */
const RUBBER_C = 0.55;

/**
 * Widerstand jenseits des Anschlags: `b = (1 − 1/((x·c/d)+1))·d`. Ohne das
 * stoppt der Deckel hart und die Karte fühlt sich an wie ein Bild, nicht wie
 * ein Gegenstand.
 */
function rubberBand(over: number, dim: number): number {
  return (1 - 1 / ((over * RUBBER_C) / dim + 1)) * dim;
}

interface Props {
  /** Was unter dem Deckel liegt. */
  children: ReactNode;
  /** Beschriftung auf dem geschlossenen Deckel. */
  label?: string;
  /** Läuft einmal, sobald zum ersten Mal lesbar war, was darunter steht. */
  onRevealed?: () => void;
  /** Zusätzliche Klasse für die Hülle. */
  className?: string;
}

export function PeekCard({ children, label = 'Karte aufdecken', onRevealed, className }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const lidRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startY: number;
    height: number;
    dragging: boolean;
  } | null>(null);
  /** Ob gerade lesbar ist, was darunter steht. Steuert auch den a11y-Baum. */
  const [readable, setReadable] = useState(false);
  /** Per Tipp offen gerastet — die Bedienung ohne Ziehen. */
  const [latched, setLatched] = useState(false);
  const revealed = useRef(false);

  /** Setzt den Deckel. Direkt am Knoten, nicht über React: sonst rendert die
   *  Komponente sechzigmal in der Sekunde neu. */
  const setLift = useCallback(
    (px: number, settle: boolean) => {
      const lid = lidRef.current;
      if (!lid) return;
      lid.style.transition = settle
        ? `transform var(--dur-peek-settle) var(--ease-peek-settle)`
        : 'none';
      lid.style.transform = `translate3d(0, ${-Math.round(px)}px, 0)`;
    },
    [],
  );

  /** Spiegelt `readable`, damit der Übergang OHNE State-Updater erkennbar ist. */
  const readableRef = useRef(false);

  const markReadable = useCallback(
    (next: boolean) => {
      if (readableRef.current === next) return;
      readableRef.current = next;
      // Genau an der Schwelle, an der es lesbar wird — nicht am Anschlag und
      // nicht am Gummiband. Apple nennt das die Stelle für „selection".
      //
      // Bewusst NICHT im `setReadable`-Updater: den ruft React im StrictMode
      // absichtlich zweimal mit demselben Wert auf, und die Haptik tickte
      // dann in der Entwicklung doppelt.
      if (next) haptic('select');
      setReadable(next);
      if (next && !revealed.current) {
        revealed.current = true;
        onRevealed?.();
      }
    },
    [onRevealed],
  );

  /**
   * Rasten per Tipp oder Tastatur. Die Haptik haengt hier am echten Uebergang
   * und nicht im Effekt: dort loeste sie ein zweites Mal aus, sobald ein
   * Aufrufer `onRevealed` inline uebergibt und der Effekt wegen der neuen
   * Funktionsidentitaet erneut lief.
   */
  const toggleLatch = useCallback(() => {
    const next = !latched;
    haptic(next ? 'heavy' : 'tap');
    setLatched(next);
  }, [latched]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) return;
    const height = boxRef.current?.offsetHeight ?? 0;
    if (!height) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerId: e.pointerId, startY: e.clientY, height, dragging: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const raw = d.startY - e.clientY;
    if (!d.dragging) {
      if (raw < DRAG_START_PX) return;
      d.dragging = true;
      // Der Moment, in dem sich der Deckel löst.
      haptic('tap');
      setLatched(false);
    }
    const max = d.height * MAX_LIFT;
    const lift = raw <= max ? raw : max + rubberBand(raw - max, d.height * (1 - MAX_LIFT));
    setLift(lift, false);
    const ratio = lift / max;
    markReadable(ratio >= READ_ON ? true : ratio < READ_OFF ? false : readable);
  };

  /** Ende der Geste — auch bei `pointercancel`, sonst bliebe der Deckel bei
   *  einem Anruf oder dem Kontrollzentrum oben stehen. */
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (!d.dragging) {
      // Kein Ziehen, also ein Tipp: rasten statt federn.
      toggleLatch();
      return;
    }
    setLift(0, true);
    markReadable(false);
  };

  /**
   * iOS entzieht die Zeigerbindung bei Systemgesten (Kontrollzentrum, Wischen
   * vom Rand). Dann kommt weder `pointerup` noch `pointercancel`, und der
   * Deckel bliebe auf halber Hoehe kleben. Nach einem normalen Ende ist
   * `drag.current` bereits leer, deshalb greift der Waechter und es passiert
   * nichts doppelt.
   */
  const onLostCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setLift(0, true);
    markReadable(false);
  };

  // Der gerastete Zustand wird nicht im Move-Pfad gesetzt, sondern hier — so
  // teilen sich Ziehen und Tippen denselben Deckel, ohne sich zu stören.
  useEffect(() => {
    if (drag.current?.dragging) return;
    const height = boxRef.current?.offsetHeight ?? 0;
    setLift(latched ? height * MAX_LIFT : 0, true);
    markReadable(latched);
  }, [latched, setLift, markReadable]);

  return (
    <div ref={boxRef} className={`peekcard ${readable ? 'peekcard--open' : ''} ${className ?? ''}`}>
      {/* Bleibt im Baum, damit der Text unter dem Deckel hervorgleitet statt
          aufzuploppen — aber vor Screenreadern verborgen, solange zu ist. */}
      <div className="peekcard__under" aria-hidden={!readable}>
        {children}
      </div>
      <div
        ref={lidRef}
        className="peekcard__lid"
        role="button"
        tabIndex={0}
        aria-pressed={readable}
        aria-label={readable ? 'Karte zudecken' : label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={onLostCapture}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          toggleLatch();
        }}
      >
        <span className="peekcard__label">
          <Icon name="chevronUp" size={26} strokeWidth={2.2} />
          {label}
        </span>
      </div>
    </div>
  );
}
