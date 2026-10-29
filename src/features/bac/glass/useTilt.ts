import { useCallback, useEffect, useRef, useState } from 'react';

type TiltState = 'idle' | 'asking' | 'on' | 'denied' | 'unsupported';
type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<string>;
};
function readChoice(): string | null {
  try {
    return localStorage.getItem('pegel.tilt');
  } catch {
    return null;
  }
}
function storeChoice(choice: string): void {
  try {
    localStorage.setItem('pegel.tilt', choice);
  } catch {
    /* Speicher gesperrt. */
  }
}

export function useTilt(): {
  target: number;
  state: TiltState;
  request: () => Promise<void>;
  decline: () => void;
} {
  const [target, setTarget] = useState(0);
  const [state, setState] = useState<TiltState>(() => {
    if (typeof window.DeviceOrientationEvent === 'undefined') return 'unsupported';
    const choice = readChoice();
    return choice === 'denied' ? 'denied' : choice === 'granted' ? 'on' : 'idle';
  });
  const attempted = useRef(state !== 'idle');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (state !== 'on') return;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null) return;
      setTarget(Math.max(-0.6, Math.min(0.6, ((event.gamma * Math.PI) / 180) * 0.7)));
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [state]);
  const request = useCallback(async () => {
    if (attempted.current) return;
    attempted.current = true;
    setState('asking');
    const ctor = window.DeviceOrientationEvent as OrientationConstructor | undefined;
    if (!ctor) {
      setState('unsupported');
      return;
    }
    let choice = 'denied';
    try {
      choice = ctor.requestPermission ? await ctor.requestPermission() : 'granted';
    } catch {
      /* Ohne Erlaubnis bleibt der Sensor aus. */
    }
    storeChoice(choice === 'granted' ? 'granted' : 'denied');
    if (mounted.current) setState(choice === 'granted' ? 'on' : 'denied');
  }, []);
  // Die eigene Rückfrage abgelehnt: iOS fragt dann gar nicht erst.
  const decline = useCallback(() => {
    attempted.current = true;
    storeChoice('denied');
    setState('denied');
  }, []);
  return { target, state, request, decline };
}
