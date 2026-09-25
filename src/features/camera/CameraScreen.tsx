import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import { plural } from '../../lib/format';
import { uid } from '../../lib/id';
import { useFilm } from '../../store/film';
import { developFrame } from './develop';
import { photoFormat } from './filmLook';
import { savePhoto } from './photoStore';
import { scheduleDevelopNotice } from './notify';
import { useFilmStatus } from './useFilmStatus';
import { useViewfinder } from './useViewfinder';

/** So lange leuchtet der Blitz vor dem Auslösen, damit die Belichtung steht. */
const FLASH_LEAD_MS = 220;

/**
 * Der Sucher.
 *
 * Man sieht, worauf man zielt – aber nie, was dabei herauskommt. Genau
 * dieser Unterschied ist das Feature: der Ausschnitt ist versetzt wie bei
 * einem optischen Sucher, und die Verfremdung passiert erst danach.
 *
 * Der Sucher ist ein Fenster im Format des Fotos, nicht der ganze
 * Bildschirm: Was im Fenster steht, kommt aufs Bild. Ein Vollbild-Sucher
 * mit einem anders geschnittenen Foto dahinter hatte oben und unten
 * abgeschnitten, was man beim Zielen noch gesehen hat.
 */
export default function CameraScreen() {
  const nav = useNavigate();
  const { videoRef, state, hasTorch, setTorch, streamSize } = useViewfinder();
  // Bis der Stream steht, ein hohes Fenster: so hält man das Handy.
  const format = streamSize ? photoFormat(streamSize.w, streamSize.h) : photoFormat(1, 2);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frame = useFit(stageRef, format.w / format.h);
  const { mineLeft, remaining, developsAt } = useFilmStatus();
  const addPhoto = useFilm((s) => s.addPhoto);
  const [busy, setBusy] = useState(false);
  const [blitz, setBlitz] = useState(false);
  const zuletzt = useRef(0);

  const auslösen = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busy || mineLeft <= 0) return;
    // Zwei schnelle Taps dürfen nicht zwei Bilder kosten.
    if (Date.now() - zuletzt.current < 900) return;
    zuletzt.current = Date.now();

    setBusy(true);
    setBlitz(true);
    haptic('heavy');
    try {
      await setTorch(true);
      await new Promise((r) => setTimeout(r, FLASH_LEAD_MS));
      const blob = await developFrame(video, video.videoWidth, video.videoHeight);
      await setTorch(false);
      if (blob) {
        const name = `${uid('f_')}.jpg`;
        await savePhoto(name, blob);
        addPhoto(name, developsAt);
        void scheduleDevelopNotice(developsAt);
        haptic('success');
      }
    } finally {
      setBlitz(false);
      setBusy(false);
    }
  }, [videoRef, busy, mineLeft, setTorch, addPhoto, developsAt]);

  return (
    <div className="viewfinder">
      {blitz && <div className="viewfinder__flash" aria-hidden />}

      <div className="viewfinder__top">
        <button
          className="viewfinder__ico hit pressable"
          onClick={() => {
            haptic('tap');
            nav(-1);
          }}
          aria-label="Zurück"
        >
          <Icon name="close" size={22} />
        </button>
        {/* Pflicht und Anstand: es muss erkennbar sein, dass die Kamera
            läuft — aber nur, solange sie es wirklich tut. */}
        {state === 'live' ? (
          <span className="viewfinder__live">
            <span className="viewfinder__dot" aria-hidden /> Kamera läuft
          </span>
        ) : (
          <span />
        )}
        <span className="t-mono-num t-headline">{remaining}</span>
      </div>

      <div className="viewfinder__stage" ref={stageRef}>
        <div
          className="viewfinder__frame"
          data-format={format.w < format.h ? 'hoch' : 'quer'}
          style={frame ? { width: frame.w, height: frame.h } : undefined}
        >
          <video
            ref={videoRef}
            className="viewfinder__video"
            playsInline
            muted
            autoPlay
            aria-label="Sucher"
          />
        </div>
      </div>

      {state === 'live' ? (
        <div className="viewfinder__bottom">
          <p className="viewfinder__hint">
            {mineLeft > 0
              ? `Noch ${mineLeft} ${plural(mineLeft, 'Bild', 'Bilder')} für dich. Wie es geworden ist, siehst du morgen.`
              : 'Dein Anteil am Film ist verbraucht.'}
          </p>
          <button
            className="shutter pressable"
            disabled={busy || mineLeft <= 0}
            onClick={() => void auslösen()}
            aria-label="Auslösen"
          >
            <span className="shutter__ring" />
          </button>
          {!hasTorch && (
            <p className="t-caption">Dieses Gerät kann den Blitz nicht schalten.</p>
          )}
        </div>
      ) : (
        <div className="viewfinder__bottom">
          <div className="notice notice--neutral">
            {state === 'starting' && 'Kamera wird geöffnet …'}
            {state === 'denied' &&
              'Ohne Kamerazugriff geht kein Foto. Du kannst ihn in den Einstellungen erlauben – der Rest der App funktioniert weiter.'}
            {state === 'unavailable' && 'Dieses Gerät stellt keine Kamera bereit.'}
          </div>
          <button
            className="btn btn--glass btn--block"
            onClick={() => {
              haptic('tap');
              nav(-1);
            }}
          >
            Zurück zum Album
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Größtes Rechteck im Seitenverhältnis `ratio`, das in den Bereich passt.
 *
 * CSS allein kann das nicht: `aspect-ratio` mit `max-height` UND `max-width`
 * bricht das Verhältnis, sobald die Höhe bindet – und genau dann zeigte das
 * Fenster mehr, als aufs Bild kommt.
 */
function useFit(
  ref: React.RefObject<HTMLElement | null>,
  ratio: number,
): { w: number; h: number } | null {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const messen = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  if (!box || !box.w || !box.h) return null;
  const w = Math.min(box.w, box.h * ratio);
  return { w: Math.floor(w), h: Math.floor(w / ratio) };
}
