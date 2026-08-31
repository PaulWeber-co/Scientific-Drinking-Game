import { formatBac, formatTime } from '../../lib/format';
import type { NightSummary } from './nightSummary';

const W = 1080;
const H = 1350;

/**
 * Zeichnet den Abend-Rückblick direkt auf ein Canvas.
 *
 * Bewusst ohne DOM-Screenshot-Bibliothek: das hier sind ein paar Rechtecke und
 * Textzeilen, und so bleibt die Karte unabhängig vom aktuellen Theme scharf.
 */
export function drawNightCard(summary: NightSummary, name: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const font = (size: number, weight = 600) =>
    `${weight} ${size}px -apple-system, "SF Pro Display", "Segoe UI", system-ui, sans-serif`;

  // Hintergrund mit ruhigem Farbverlauf oben
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -180, 40, W / 2, -180, 900);
  glow.addColorStop(0, 'rgba(10,132,255,0.42)');
  glow.addColorStop(1, 'rgba(10,132,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 900);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(235,235,245,0.6)';
  ctx.font = font(30, 700);
  ctx.letterSpacing = '3px';
  ctx.fillText('PEGEL · DER ABEND IN ZAHLEN', 84, 150);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = '#ffffff';
  ctx.font = font(96, 800);
  ctx.fillText(name || 'Dein Abend', 84, 260);

  ctx.fillStyle = 'rgba(235,235,245,0.55)';
  ctx.font = font(34, 500);
  ctx.fillText(
    `${formatTime(summary.from)} – ${formatTime(summary.to)} Uhr`,
    84,
    316,
  );

  const tiles: [string, string][] = [
    [formatBac(summary.peakBac), 'Höchster Pegel'],
    [summary.standardDrinks.toFixed(1).replace('.', ','), 'Standardgläser'],
    [`${Math.round(summary.totalGrams)} g`, 'Reiner Alkohol'],
    [String(summary.calls), 'Trinkansagen'],
    [String(summary.water), 'Gläser Wasser'],
    [formatTime(summary.soberAt), 'Nüchtern gegen'],
  ];

  const cols = 2;
  const gap = 24;
  const tileW = (W - 84 * 2 - gap) / cols;
  const tileH = 190;
  const tilesTop = 400;

  tiles.forEach(([value, label], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 84 + col * (tileW + gap);
    const ty = tilesTop + row * (tileH + gap);
    roundRect(ctx, x, ty, tileW, tileH, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,235,245,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = font(70, 800);
    ctx.fillText(value, x + 38, ty + 108);
    ctx.fillStyle = 'rgba(235,235,245,0.55)';
    ctx.font = font(28, 600);
    ctx.fillText(label, x + 38, ty + 152);
  });

  const rows = Math.ceil(tiles.length / cols);
  const linesTop = tilesTop + rows * tileH + (rows - 1) * gap + 76;

  const lines = [
    summary.topGame ? `Meistgespielt: ${summary.topGame}` : null,
    summary.topDrink ? `Getrunken: ${summary.topDrink}` : null,
    `Höchster Pegel um ${formatTime(summary.peakAt)} Uhr`,
  ].filter(Boolean) as string[];

  ctx.fillStyle = 'rgba(235,235,245,0.72)';
  ctx.font = font(34, 500);
  lines.forEach((line, i) => ctx.fillText(line, 84, linesTop + i * 54));

  ctx.fillStyle = 'rgba(235,235,245,0.34)';
  ctx.font = font(25, 500);
  ctx.fillText('Schätzung nach der Widmark-Formel. Kein Messgerät.', 84, H - 62);

  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Teilt die Karte als Bild – mit Download als Rückfall. */
export async function shareNightCard(summary: NightSummary, name: string): Promise<void> {
  const canvas = drawNightCard(summary, name);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'pegel-abend.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Der Abend in Zahlen' });
      return;
    } catch {
      /* Abgebrochen – dann eben herunterladen. */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pegel-abend.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
