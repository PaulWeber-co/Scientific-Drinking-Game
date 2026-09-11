/**
 * Der Abzug.
 *
 * Was das Album zeigt und was jemand verschickt, ist nicht dasselbe: In der
 * App liegt das Papier als CSS um das Bild, in einer verschickten Datei muss
 * es mit hineingerechnet werden. Ein nacktes JPEG ist nur ein Foto – ein
 * Abzug ist erkennbar, auch wenn er drei Chats weiter auftaucht.
 *
 * Die Geometrie steht bewusst als reine Funktion hier und nicht am Canvas:
 * so lässt sie sich prüfen, ohne einen Browser zu starten.
 */

/** Papierfarben. Dieselben Werte wie `--paper`/`--stamp` in tokens.css. */
const PAPER = '#f2ece2';
const STAMP = '#ff8a1e';

export interface PrintLayout {
  /** Papiermaße insgesamt. */
  width: number;
  height: number;
  /** Rand oben und an den Seiten. */
  pad: number;
  /** Rand unten – breiter, wie bei einem echten Abzug. */
  padBottom: number;
}

/**
 * Papierformat für ein Bild dieser Größe.
 *
 * Die Ränder wachsen mit dem Bild, damit ein Abzug bei jeder Auflösung
 * gleich aussieht: 2,3 % der langen Kante an den Seiten, 8,6 % unten –
 * dasselbe Verhältnis wie `--paper-pad` zu `--paper-pad-b` auf dem
 * Bildschirm. Die LANGE Kante, damit ein hoher und ein querer Abzug
 * denselben Rand tragen: das Labor schnitt beide vom selben Papier.
 */
export function printLayout(imageW: number, imageH: number): PrintLayout {
  const edge = Math.max(imageW, imageH);
  const pad = Math.round(edge * 0.023);
  const padBottom = Math.round(edge * 0.086);
  return {
    width: imageW + pad * 2,
    height: imageH + pad + padBottom,
    pad,
    padBottom,
  };
}

/**
 * Legt ein Foto auf Fotopapier und schreibt den Namen der App in den
 * unteren Rand – dorthin, wo ein Labor seinen Stempel hatte. Das Datum
 * steht nicht hier, sondern im Bild: das hat die Kamera beim Auslösen
 * mitbelichtet (siehe `develop.ts`).
 */
export async function makePrint(photo: Blob): Promise<Blob> {
  const bild = await createImageBitmap(photo);
  const l = printLayout(bild.width, bild.height);

  const canvas = document.createElement('canvas');
  canvas.width = l.width;
  canvas.height = l.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return photo;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, l.width, l.height);
  ctx.drawImage(bild, l.pad, l.pad);
  bild.close();

  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${Math.round(l.padBottom * 0.34)}px ui-monospace, Menlo, monospace`;
  ctx.shadowColor = 'rgba(255,138,30,0.9)';
  ctx.shadowBlur = Math.round(l.padBottom * 0.09);
  ctx.fillStyle = STAMP;
  ctx.fillText('PEGEL', l.width - l.pad * 2, l.height - Math.round(l.padBottom * 0.34));

  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? photo), 'image/jpeg', 0.86),
  );
}
