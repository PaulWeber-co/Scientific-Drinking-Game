import { useCallback, useEffect, useRef, useState } from 'react';

/** Was der Sucher gerade macht. */
export type ViewfinderState = 'starting' | 'live' | 'denied' | 'unavailable';

/**
 * Kamerabild im Sucher.
 *
 * Bewusst über `getUserMedia` statt über die System-Kamera: die zeigt nach
 * dem Auslösen zwingend „Foto verwenden / Wiederholen" und damit genau das
 * Ergebnis, das hier niemand sehen soll.
 *
 * Der Blitz läuft über die Taschenlampe der Rückkamera. WebKit kann das erst
 * seit iOS 17; ältere Geräte bekommen kein Licht, aber ein Bild – deshalb
 * wird die Fähigkeit abgefragt und nicht vorausgesetzt.
 */
export function useViewfinder() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<ViewfinderState>('starting');
  const [hasTorch, setHasTorch] = useState(false);
  // Maße des Streams, wie die Kamera ihn liefert: aufrecht gehalten hoch,
  // quer gehalten breit. Daraus folgt das Format des Fotos.
  const [streamSize, setStreamSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let abgebrochen = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        // Kein Ton: sonst fragt iOS zusätzlich nach dem Mikrofon, und das
        // hat für ein Foto nichts zu suchen.
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
      })
      .then((stream) => {
        if (abgebrochen) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        setHasTorch(torchFähig(track));
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
        setState('live');
      })
      .catch((e: unknown) => {
        if (abgebrochen) return;
        const name = e instanceof Error ? e.name : '';
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      });

    return () => {
      abgebrochen = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Die Maße stehen erst, wenn der Stream läuft – und ändern sich, wenn das
  // Gerät gedreht wird. Beides meldet das Videoelement selbst.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const lesen = () => {
      if (video.videoWidth && video.videoHeight) {
        setStreamSize({ w: video.videoWidth, h: video.videoHeight });
      }
    };
    video.addEventListener('loadedmetadata', lesen);
    video.addEventListener('resize', lesen);
    return () => {
      video.removeEventListener('loadedmetadata', lesen);
      video.removeEventListener('resize', lesen);
    };
  }, []);

  // WKWebView pausiert den Stream im Hintergrund und startet ihn nicht von
  // selbst wieder – ohne das steht der Sucher nach jedem Wegschauen still.
  useEffect(() => {
    const wieder = () => {
      if (document.visibilityState === 'visible') void videoRef.current?.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', wieder);
    return () => document.removeEventListener('visibilitychange', wieder);
  }, []);

  /** Schaltet die Taschenlampe, solange das Gerät es kann. */
  const setTorch = useCallback(async (an: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchFähig(track)) return;
    const constraints = { advanced: [{ torch: an }] } as unknown as MediaTrackConstraints;
    await track.applyConstraints(constraints).catch(() => {});
  }, []);

  return { videoRef, state, hasTorch, setTorch, streamSize };
}

/** `torch` steht nicht im Standard-Typ, WebKit und Chromium kennen es trotzdem. */
function torchFähig(track: MediaStreamTrack | undefined): boolean {
  if (!track?.getCapabilities) return false;
  return (track.getCapabilities() as { torch?: boolean }).torch === true;
}
