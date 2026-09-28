import type { ReactNode } from 'react';
import { Sheet } from '../../components/ui';
import type { Meme } from './game';
import { MemeImage, MemePrint } from './Meme';
import { SaveMeme } from './parts';
import { templateOf } from './templates';

export interface LightboxEntry {
  meme: Meme;
  caption: string;
  badge?: ReactNode;
  /** Zeile unter dem Abzug, etwa die Stimmen. */
  footer?: ReactNode;
}

/**
 * Ein Meme groß, mit Speichern. Galerie und Auflösung zeigen die Abzüge klein
 * und ohne Knöpfe darauf – wer eines will, tippt es an.
 */
export function MemeLightbox({
  entry,
  onClose,
}: {
  entry: LightboxEntry | null;
  onClose: () => void;
}) {
  const t = templateOf(entry?.meme.t);
  return (
    <Sheet open={!!entry} onClose={onClose}>
      {entry && (
        <div className="md-lightbox stack-3">
          <MemePrint
            className="md-print--lift"
            caption={entry.caption}
            badge={entry.badge}
            ar={t ? t.w / t.h : undefined}
          >
            {t && <MemeImage template={t} texts={entry.meme.x} />}
          </MemePrint>
          {entry.footer && <div className="row-between">{entry.footer}</div>}
          <SaveMeme meme={entry.meme} caption={entry.caption} />
        </div>
      )}
    </Sheet>
  );
}
