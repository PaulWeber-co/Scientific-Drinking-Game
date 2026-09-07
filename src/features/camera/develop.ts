import { DISPOSABLE, applyFilmLook, viewfinderCrop } from './filmLook';

/** Kleinbild-Format, in der Größe eines ordentlichen Abzugs. */
const W = 1620;
const H = 1080;

/**
 * Macht aus einem Sucherbild ein belichtetes Foto.
 *
 * Hier passiert alles, was den Unterschied zwischen einem Handyfoto mit
 * Filter und einem Einwegkamera-Bild ausmacht: der versetzte Ausschnitt des
 * optischen Suchers, der harte Blitz-Abfall zum Rand, Korn, warmer Stich –
 * und das eingebrannte Datum, das jede Kamera mit Datenrückwand hatte.
 */
export async function developFrame(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  at: number = Date.now(),
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const crop = viewfinderCrop(sourceW, sourceH);
  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, W, H);

  const image = ctx.getImageData(0, 0, W, H);
  applyFilmLook(image.data, W, H, DISPOSABLE);
  ctx.putImageData(image, 0, 0);

  burnInDate(ctx, at);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
}

/**
 * Datum und App-Name unten rechts, in dem Orange, das jeder als „analog"
 * liest.
 *
 * Genau genommen ist das der Look einer Kompaktkamera mit Datenrückwand und
 * nicht der einer Wegwerfkamera – die druckte gar nichts aufs Bild. Aber es
 * ist das gelernte Zeichen dafür, und ein Foto ohne die Zahlen wirkt neben
 * einem mit sofort wie das schlechtere.
 */
function burnInDate(ctx: CanvasRenderingContext2D, at: number): void {
  const d = new Date(at);
  const zz = (n: number) => String(n).padStart(2, '0');
  const text = `${zz(d.getDate())}.${zz(d.getMonth() + 1)}.${d.getFullYear()} ${zz(d.getHours())}:${zz(d.getMinutes())}`;

  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 40px "DS-Digital", "Courier New", monospace';
  // Das Datum wurde vom Licht der LED mitbelichtet, nicht aufgedruckt: es
  // leuchtet in das Bild hinein statt darauf zu liegen.
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = 'rgba(255,140,20,0.9)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(255,150,40,0.92)';
  ctx.fillText(text, W - 46, H - 46);

  ctx.font = '600 22px system-ui, sans-serif';
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(255,150,40,0.55)';
  ctx.fillText('PEGEL', W - 46, H - 92);
  ctx.restore();
}
