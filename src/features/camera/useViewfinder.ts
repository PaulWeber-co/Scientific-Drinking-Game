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
  // Weitwinkel wie das „0,5" der Kamera-App. Zwei Wege, je nach Gerät: die
  // Rückkamera zoomt unter 1 (Kamera mit mehreren Linsen hinter einem
  // Gerät), oder die Ultraweitwinkel-Linse steht als eigene Kamera in der
  // Liste. Kann das Gerät keins von beidem, gibt es keinen Umschalter.
  const [wideWay, setWideWay] = useState<{ zoom: number } | { deviceId: string } | null>(null);
  const [wide, setWideState] = useState(false);
  const deviceId = wide && wideWay && 'deviceId' in wideWay ? wideWay.deviceId : null;

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
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
      })
      .then((stream) => {
        if (abgebrochen) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        setHasTorch(torchFähig(track));
        if (!deviceId) void weitwinkelSuchen(track).then((w) => !abgebrochen && w && setWideWay(w));
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
        setState('live');
      })
      .catch((e: unknown) => {
        if (abgebrochen) return;
        // Verweigert die Linse den Dienst, zurück auf die normale Kamera.
        if (deviceId) return setWideState(false);
        const name = e instanceof Error ? e.name : '';
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      });

    return () => {
      abgebrochen = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [deviceId]);

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

  /** Schaltet zwischen 1× und Weitwinkel. Ein Linsenwechsel öffnet den Stream neu (Effekt oben). */
  const setWide = useCallback(
    (an: boolean) => {
      if (!wideWay) return;
      if ('zoom' in wideWay) {
        const track = streamRef.current?.getVideoTracks()[0];
        const zoom = an ? wideWay.zoom : 1;
        void track?.applyConstraints({ advanced: [{ zoom }] } as unknown as MediaTrackConstraints).catch(() => {});
      }
      setWideState(an);
    },
    [wideWay],
  );

  return { videoRef, state, hasTorch, setTorch, streamSize, canWide: wideWay !== null, wide, setWide };
}

/**
 * Findet den Weg zum Weitwinkel, sofern das Gerät einen hat.
 *
 * Die Namen der Kameras gibt der Browser erst nach der Freigabe heraus –
 * deshalb läuft das auf dem ersten Stream und nicht vorher.
 */
export async function weitwinkelSuchen(
  track: MediaStreamTrack | undefined,
): Promise<{ zoom: number } | { deviceId: string } | null> {
  const caps = track?.getCapabilities?.() as { zoom?: { min?: number } } | undefined;
  const min = caps?.zoom?.min;
  if (typeof min === 'number' && min < 1) return { zoom: Math.max(min, 0.5) };
  const geräte = await navigator.mediaDevices?.enumerateDevices?.().catch(() => []);
  const ultra = geräte?.find(
    (d) => d.kind === 'videoinput' && /ultra ?wide|ultraweitwinkel/i.test(d.label),
  );
  return ultra?.deviceId ? { deviceId: ultra.deviceId } : null;
}

/** `torch` steht nicht im Standard-Typ, WebKit und Chromium kennen es trotzdem. */
function torchFähig(track: MediaStreamTrack | undefined): boolean {
  if (!track?.getCapabilities) return false;
  return (track.getCapabilities() as { torch?: boolean }).torch === true;
}
