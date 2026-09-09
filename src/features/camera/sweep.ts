import { useNights } from '../../store/nights';
import { useFilm } from '../../store/film';
import { deletePhotos } from './photoStore';

/**
 * Räumt Bilder weg, deren Abend es nicht mehr gibt.
 *
 * Nötig, weil Abende auf drei Wegen verschwinden: gelöscht, vom Deckel
 * verdrängt (ab 60 bleiben 50), oder mit „alles zurücksetzen". Statt jeden
 * Weg einzeln ans Dateisystem zu koppeln, wird einmal beim Öffnen des Albums
 * verglichen – das fängt auch abgebrochene Läufe auf.
 */
export async function sweepOrphans(): Promise<void> {
  // Erst die Dateien, deren Metadaten schon weg sind („alles zurücksetzen").
  // Sie tauchen in keinem Vergleich mehr auf und müssen vorgemerkt werden.
  const offen = useFilm.getState().pendingDeletes;
  if (offen.length) {
    await deletePhotos(offen);
    useFilm.getState().clearPending(offen);
  }

  const bekannt = new Set(useNights.getState().nights.map((n) => n.id));
  const photos = useFilm.getState().photos;
  const verwaist = photos.filter((p) => p.nightId !== null && !bekannt.has(p.nightId));
  if (!verwaist.length) return;

  await deletePhotos(verwaist.map((p) => p.file));
  const weg = new Set(verwaist.map((p) => p.id));
  useFilm.setState({ photos: useFilm.getState().photos.filter((p) => !weg.has(p.id)) });
}
