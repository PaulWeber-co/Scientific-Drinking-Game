import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Sheet } from '../../components/ui';
import { Icon } from '../../components/icons';
import { formatNightDate, formatTime, plural } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { useNights } from '../../store/nights';
import { isDeveloped, useFilm, type Photo } from '../../store/film';
import { useFilmStatus } from './useFilmStatus';
import { FilmSetup } from './FilmSetup';
import { photoUrl, releasePhotoUrl } from './photoStore';
import { makePrint } from './print';
import { sweepOrphans } from './sweep';
import { NightReview } from '../bac/NightReview';
import { usePlayer } from '../../store/player';
import { shareFile } from '../../lib/shareFile';

/**
 * Das Album des Abends.
 *
 * Zwei Zustände, die bewusst gleich aussehen sollen: Was noch nicht
 * entwickelt ist, bleibt als leere Hülle sichtbar – man soll merken, dass
 * da etwas wartet, ohne es zu sehen.
 */
export function AlbumScreen() {
  const nav = useNavigate();
  const photos = useFilm((s) => s.photos);
  const nights = useNights((s) => s.nights);
  const { remaining, mineLeft, running } = useFilmStatus();
  const [open, setOpen] = useState<Photo | null>(null);
  const [now, setNow] = useState(Date.now);
  const [reviewOpen, setReviewOpen] = useState(false);
  const endNight = usePlayer((s) => s.endNight);

  useEffect(() => {
    const next = Math.min(...photos.filter((p) => p.developAt > now).map((p) => p.developAt));
    if (!Number.isFinite(next)) return;
    // Ein offenes Album muss den Abzug zur Entwicklungszeit freigeben,
    // auch wenn sich weder Film noch Lobby in der Zwischenzeit ändern.
    const timer = setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(0, next - Date.now())));
    return () => clearTimeout(timer);
  }, [photos, now]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  // Bilder ohne Abend wegräumen – siehe `sweep.ts`.
  useEffect(() => {
    void sweepOrphans();
  }, []);

  const gruppen = useMemo(() => groupByNight(photos), [photos]);
  const developed = gruppen.flatMap(([, pictures]) => pictures).filter((photo) => isDeveloped(photo, now));
  const titelFor = (nightId: string | null) => {
    if (nightId === null) return 'Heute Abend';
    const n = nights.find((x) => x.id === nightId);
    return n ? formatNightDate(n.startedAt) + (n.place ? ` · ${n.place}` : '') : 'Früherer Abend';
  };

  return (
    <div className="screen korn">
      <NavBar title={<span className="t-headline">Album</span>} />

      <div className="stack-6">
        {running && (
          <section className="card card--pad-lg stack-3">
            <div className="row-between">
              <span className="t-title2">Der Film läuft</span>
              <span className="t-mono-num t-headline">{remaining}</span>
            </div>
            <p className="t-sub">
              {remaining > 0
                ? `Noch ${remaining} ${plural(remaining, 'Bild', 'Bilder')} auf dem Film, ${mineLeft} davon für dich.`
                : 'Der Film ist voll. Mehr Bilder gibt es nur mit einem neuen Film.'}
            </p>
            <button
              className="btn btn--accent btn--block"
              disabled={mineLeft <= 0}
              onClick={() => {
                haptic('select');
                nav('/kamera');
              }}
            >
              <Icon name="camera" size={18} /> Foto machen
            </button>
            {/* Hier sucht man es: wer den Film abschließt, schließt den Abend. */}
            <button
              className="btn btn--glass btn--block"
              onClick={() => {
                haptic('press');
                setReviewOpen(true);
              }}
            >
              Abend beenden
            </button>
          </section>
        )}

        {running && <FilmSetup />}

        {!photos.length && (
          <section className="album-empty stack-6">
            <div className="photoframe photoframe--latent album-empty__print" aria-hidden="true" />
            <div className="stack-3">
              <h2 className="t-title2">Hier sammelt sich euer Abend</h2>
              <p className="t-sub">
                Was hier landet, siehst du erst am nächsten Morgen – wie bei einer Einwegkamera.
              </p>
            </div>
          </section>
        )}

        {gruppen.map(([nightId, bilder]) => (
          <section key={nightId ?? 'current'} className="stack-3">
            <div className="row-between">
              <h2 className="t-title2">{titelFor(nightId)}</h2>
              <span className="t-caption">
                {bilder.length} {plural(bilder.length, 'Bild', 'Bilder')}
              </span>
            </div>
            <div className="photogrid">
              {bilder.map((p) => (
                <Frame key={p.id} photo={p} now={now} onOpen={() => setOpen(p)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <PhotoSheet photo={developed.find((photo) => photo.id === open?.id) ?? null} photos={developed} onSelect={setOpen} onClose={() => setOpen(null)} />
      <NightReview open={reviewOpen} onClose={() => setReviewOpen(false)} onEnd={endNight} />
    </div>
  );
}

/** Neueste Gruppe zuerst; der laufende Abend steht immer ganz oben. */
function groupByNight(photos: readonly Photo[]): [string | null, Photo[]][] {
  const map = new Map<string | null, Photo[]>();
  for (const p of photos) {
    const list = map.get(p.nightId);
    if (list) list.push(p);
    else map.set(p.nightId, [p]);
  }
  return [...map.entries()];
}

function Frame({ photo, now, onOpen }: { photo: Photo; now: number; onOpen: () => void }) {
  const fertig = isDeveloped(photo, now);
  const image = useAlbumPhoto(fertig ? photo.file : null);
  const { url } = image;

  if (!fertig) {
    return (
      <div className="photoframe photoframe--latent" aria-label="Noch nicht entwickelt">
        <Icon name="clock" size={20} />
      </div>
    );
  }
  return (
    <button
      className="photoframe pressable"
      aria-label={image.status === 'error' ? 'Foto gerade nicht verfügbar – erneut laden' : `Foto von ${formatTime(photo.at)} Uhr öffnen`}
      onClick={() => {
        haptic('tap');
        if (image.status === 'error') image.reload();
        else onOpen();
      }}
    >
      {image.status === 'loading' && <span role="status">Foto wird geladen …</span>}
      {image.status === 'error' && <span>Foto gerade nicht verfügbar – erneut laden</span>}
      {url && <img src={url} alt={`Foto von ${formatTime(photo.at)} Uhr`} loading="lazy" onError={image.fail} />}
    </button>
  );
}

function PhotoSheet({ photo, photos, onSelect, onClose }: {
  photo: Photo | null;
  photos: Photo[];
  onSelect: (photo: Photo) => void;
  onClose: () => void;
}) {
  const image = useAlbumPhoto(photo?.file ?? null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const index = photos.findIndex((item) => item.id === photo?.id);
  const move = (offset: number) => {
    const next = photos[index + offset];
    if (next) onSelect(next);
  };
  return (
    <Sheet open={!!photo} onClose={onClose} title={photo ? `${formatTime(photo.at)} Uhr` : ''}>
      {photo && (
        <div className="stack">
          <div className="album-viewer"
            onTouchStart={(event) => {
              const touch = event.touches[0];
              start.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
            }}
            onTouchCancel={() => { start.current = null; }}
            onTouchEnd={(event) => {
              const origin = start.current;
              start.current = null;
              if (!origin) return;
              const touch = event.changedTouches[0];
              const dx = touch.clientX - origin.x;
              const dy = touch.clientY - origin.y;
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
            }}>
            {image.status === 'loading' && <p role="status">Foto wird geladen …</p>}
            {image.status === 'error' && <button className="btn btn--glass btn--block" onClick={image.reload}>Foto gerade nicht verfügbar – erneut laden</button>}
            {image.url && (
              <figure className="abzug abzug--album">
                <img className="photofull" src={image.url} alt={`Foto von ${formatTime(photo.at)} Uhr`} onError={image.fail} />
                <figcaption className="abzug__stempel">PEGEL</figcaption>
              </figure>
            )}
          </div>
          <div className="row-between">
            <button className="btn btn--plain" disabled={index <= 0} onClick={() => move(-1)}>Zurück</button>
            <span aria-live="polite">Bild {index + 1} von {photos.length}</span>
            <button className="btn btn--plain" disabled={index >= photos.length - 1} onClick={() => move(1)}>Vor</button>
          </div>
          <button className="btn btn--glass btn--block" disabled={!image.url}
            onClick={() => { haptic('select'); void sharePhoto(image.url, photo); }}>
            <Icon name="share" size={18} /> Teilen
          </button>
        </div>
      )}
    </Sheet>
  );
}

// Der bisherige URL-Hook unterscheidet Laden und fehlende Dateien nicht.
// Dieser lokale Ladezustand hält Wiederholen innerhalb des Albums.
function useAlbumPhoto(file: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; url: string | null; status: 'loading' | 'ready' | 'error' } | null>(null);
  const key = `${file}:${attempt}`;
  useEffect(() => {
    if (!file) return;
    let active = true;
    let owned: string | null = null;
    photoUrl(file).then((url) => {
      owned = url;
      if (!active) { if (url) releasePhotoUrl(url); return; }
      setResult({ key, url, status: url ? 'ready' : 'error' });
    }).catch(() => {
      if (active) setResult({ key, url: null, status: 'error' });
    });
    return () => { active = false; if (owned) releasePhotoUrl(owned); };
  }, [file, key]);
  const current = result?.key === key ? result : { url: null, status: 'loading' as const };
  return {
    ...current,
    reload: () => setAttempt((value) => value + 1),
    fail: () => setResult({ key, url: null, status: 'error' }),
  };
}

/**
 * Gibt das Bild an das System-Menü weiter.
 *
 * Erst hier verlässt ein Foto das Gerät – und nur, weil jemand es
 * ausdrücklich verschickt.
 */
async function sharePhoto(url: string | null, photo: Photo): Promise<void> {
  if (!url) return;
  const blob = await fetch(url).then((r) => r.blob());
  // Der Rahmen muss in die Datei hinein: CSS reist nicht mit.
  const abzug = await makePrint(blob);
  await shareFile(abzug, `pegel-${photo.at}.jpg`);
}
