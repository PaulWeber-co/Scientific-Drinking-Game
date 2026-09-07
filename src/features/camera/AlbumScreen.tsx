import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Sheet } from '../../components/ui';
import { Icon } from '../../components/icons';
import { formatNightDate, formatTime, plural } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { useNights } from '../../store/nights';
import { isDeveloped, useFilm, type Photo } from '../../store/film';
import { useFilmStatus } from './useFilmStatus';
import { FilmSetup } from './FilmSetup';
import { usePhotoUrl } from './usePhotoUrl';
import { sweepOrphans } from './sweep';

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

  // Bilder ohne Abend wegräumen – siehe `sweep.ts`.
  useEffect(() => {
    void sweepOrphans();
  }, []);

  const gruppen = useMemo(() => groupByNight(photos), [photos]);
  const titelFor = (nightId: string | null) => {
    if (nightId === null) return 'Heute Abend';
    const n = nights.find((x) => x.id === nightId);
    return n ? formatNightDate(n.startedAt) + (n.place ? ` · ${n.place}` : '') : 'Früherer Abend';
  };

  return (
    <div className="screen">
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
                ? `Noch ${plural(remaining, 'Bild', 'Bilder')} auf dem Film, ${mineLeft} davon für dich.`
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
          </section>
        )}

        {running && <FilmSetup />}

        {!photos.length && (
          <div className="notice notice--neutral">
            Noch kein Bild geschossen. Was hier landet, siehst du erst am nächsten Morgen – wie
            bei einer Einwegkamera.
          </div>
        )}

        {gruppen.map(([nightId, bilder]) => (
          <section key={nightId ?? 'current'} className="stack-3">
            <div className="row-between">
              <h2 className="t-title2">{titelFor(nightId)}</h2>
              <span className="t-caption">{plural(bilder.length, 'Bild', 'Bilder')}</span>
            </div>
            <div className="photogrid">
              {bilder.map((p) => (
                <Frame key={p.id} photo={p} onOpen={() => setOpen(p)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <PhotoSheet photo={open} onClose={() => setOpen(null)} />
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

function Frame({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  const fertig = isDeveloped(photo);
  const url = usePhotoUrl(fertig ? photo.file : null);

  if (!fertig) {
    return (
      <div className="photoframe photoframe--latent" aria-label="Noch nicht entwickelt">
        <Icon name="clock" size={20} />
      </div>
    );
  }
  return (
    <button className="photoframe pressable" onClick={onOpen}>
      {url && <img src={url} alt={`Foto von ${formatTime(photo.at)} Uhr`} loading="lazy" />}
    </button>
  );
}

function PhotoSheet({ photo, onClose }: { photo: Photo | null; onClose: () => void }) {
  const url = usePhotoUrl(photo && isDeveloped(photo) ? photo.file : null);

  return (
    <Sheet open={!!photo} onClose={onClose} title={photo ? `${formatTime(photo.at)} Uhr` : ''}>
      {photo && (
        <div className="stack">
          {url && <img className="photofull" src={url} alt="" />}
          <button
            className="btn btn--glass btn--block"
            onClick={() => {
              haptic('select');
              void sharePhoto(url, photo);
            }}
          >
            <Icon name="share" size={18} /> Teilen
          </button>
        </div>
      )}
    </Sheet>
  );
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
  const datei = new File([blob], `pegel-${photo.at}.jpg`, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [datei] })) {
    await navigator.share({ files: [datei] }).catch(() => {});
    return;
  }
  // Kein Teilen-Menü (Desktop-Browser): dann wenigstens herunterladen.
  const a = document.createElement('a');
  a.href = url;
  a.download = datei.name;
  a.click();
}
