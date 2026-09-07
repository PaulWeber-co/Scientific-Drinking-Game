import { useEffect, useState } from 'react';
import { photoUrl, releasePhotoUrl } from './photoStore';

/**
 * Lädt ein gespeichertes Bild und gibt seine Adresse wieder frei.
 *
 * Ohne das `revokeObjectURL` behält der Browser jedes einmal geöffnete Bild
 * im Speicher – bei 27 Bildern je Abend und mehreren Abenden im Album ist
 * das auf einem älteren Telefon schnell zu viel.
 */
export function usePhotoUrl(file: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    let tot = false;
    let eigene: string | null = null;
    photoUrl(file).then((u) => {
      if (tot) {
        if (u) releasePhotoUrl(u);
        return;
      }
      eigene = u;
      setUrl(u);
    });
    return () => {
      tot = true;
      if (eigene) releasePhotoUrl(eigene);
      setUrl(null);
    };
  }, [file]);

  return url;
}
