import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

type TiltState = 'idle' | 'asking' | 'on' | 'denied' | 'unsupported';
type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<string>;
};
/** Richtung der Schwerkraft auf dem Bildschirm: x nach rechts, y nach unten, in g. */
export type Gravity = { x: number; y: number };

/** Gespeicherte Wahl: 'granted', 'denied' oder nichts (noch nie gefragt). */
export function readTiltChoice(): string | null {
  try {
    return localStorage.getItem('pegel.tilt');
  } catch {
    return null;
  }
}
export function storeTiltChoice(choice: 'granted' | 'denied'): void {
  try {
    localStorage.setItem('pegel.tilt', choice);
  } catch {
    /* Speicher gesperrt. */
  }
}

export function tiltSupported(): boolean {
  return typeof window.DeviceOrientationEvent !== 'undefined';
}

/**
 * Fragt beim System nach (iOS-Safari verlangt dafür einen Fingertipp) und
 * merkt sich die Antwort. Ohne Abfrage-Funktion gilt der Sensor als frei.
 */
export async function askTilt(): Promise<'granted' | 'denied'> {
  const ctor = window.DeviceOrientationEvent as OrientationConstructor | undefined;
  let choice = 'denied';
  try {
    choice = ctor?.requestPermission ? await ctor.requestPermission() : 'granted';
  } catch {
    /* Ohne Erlaubnis bleibt der Sensor aus. */
  }
  const result = choice === 'granted' ? 'granted' : 'denied';
  storeTiltChoice(result);
  return result;
}

const APPLE =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Vom Gerät auf den Bildschirm, falls das Bild gedreht ist. */
function toScreen(v: Gravity): Gravity {
  const angle =
    typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : 0;
  switch (((angle % 360) + 360) % 360) {
    case 90:
      return { x: v.y, y: -v.x };
    case 180:
      return { x: -v.x, y: -v.y };
    case 270:
      return { x: -v.y, y: v.x };
    default:
      return v;
  }
}

/**
 * Schwerkraft auf dem Bildschirm – wie ein echtes Glas in der Hand.
 *
 * Zwei Quellen, eine Aufgabe:
 * - `deviceorientation` liefert die Lage (beta/gamma). Daraus folgt die
 *   Richtung der Schwerkraft exakt und auf allen Plattformen gleich.
 * - `devicemotion` liefert die Beschleunigung samt Schwerkraft. Nur damit
 *   schwappt es auch, wenn man das Handy ruckartig bewegt statt kippt.
 *   iOS meldet diesen Wert mit umgekehrtem Vorzeichen; welches gilt, ergibt
 *   sich aus dem Vergleich mit der Lage, statt aus dem Gerätenamen.
 *
 * Der Wert liegt in einer Ref statt im State: er ändert sich 60-mal pro
 * Sekunde, und die Zeichenschleife liest ihn ohnehin selbst.
 */
export function useTilt(): {
  state: TiltState;
  gravity: MutableRefObject<Gravity | null>;
  request: () => Promise<void>;
  decline: () => void;
} {
  const [state, setState] = useState<TiltState>(() => {
    if (!tiltSupported()) return 'unsupported';
    const choice = readTiltChoice();
    return choice === 'denied' ? 'denied' : choice === 'granted' ? 'on' : 'idle';
  });
  const gravity = useRef<Gravity | null>(null);
  const attempted = useRef(state !== 'idle');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (state !== 'on') {
      gravity.current = null;
      return;
    }
    // Lage, wie die Orientierung sie liefert – im Geräterahmen, y nach unten.
    let pose: Gravity | null = null;
    let lastMotion = 0;
    // > 0: Plattform meldet die Gegenkraft (Spezifikation), < 0: die Schwerkraft selbst (iOS).
    let agreement = 0;
    const blend = (v: Gravity) => {
      const s = toScreen(v);
      const prev = gravity.current;
      // Leicht geglättet: Sensorrauschen soll kräuseln, nicht zappeln.
      gravity.current = prev ? { x: prev.x + (s.x - prev.x) * 0.5, y: prev.y + (s.y - prev.y) * 0.5 } : s;
    };
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      const beta = (event.beta * Math.PI) / 180;
      const gamma = (event.gamma * Math.PI) / 180;
      pose = { x: Math.sin(gamma) * Math.cos(beta), y: Math.sin(beta) };
      // Ohne frische Beschleunigungswerte führt die Lage allein.
      if (performance.now() - lastMotion > 250) blend(pose);
    };
    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null) return;
      // Nach Spezifikation: Gegenkraft zur Schwerkraft, x rechts, y oben.
      const spec = { x: -a.x / 9.81, y: a.y / 9.81 };
      if (pose) {
        agreement = agreement * 0.97 + (spec.x * pose.x + spec.y * pose.y);
      }
      // Bis die Lage zum Vergleich da ist, gilt die bekannte Eigenheit von iOS.
      const sign = agreement !== 0 ? Math.sign(agreement) : APPLE ? -1 : 1;
      lastMotion = performance.now();
      blend({ x: spec.x * sign, y: spec.y * sign });
    };
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
      gravity.current = null;
    };
  }, [state]);
  const request = useCallback(async () => {
    if (attempted.current) return;
    attempted.current = true;
    if (!tiltSupported()) {
      setState('unsupported');
      return;
    }
    setState('asking');
    const choice = await askTilt();
    if (mounted.current) setState(choice === 'granted' ? 'on' : 'denied');
  }, []);
  // Die eigene Rückfrage abgelehnt: iOS fragt dann gar nicht erst.
  // Zurückholen lässt es sich im Profil („Glas mitneigen").
  const decline = useCallback(() => {
    attempted.current = true;
    storeTiltChoice('denied');
    setState('denied');
  }, []);
  return { state, gravity, request, decline };
}
