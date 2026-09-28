import { memeUrl, type MemeBox, type MemeTemplate } from './templates';

/**
 * Brennt ein Meme als Bild – nur, wenn jemand es speichern oder teilen will.
 *
 * Im Spiel liegt der Text als DOM über dem Bild (siehe `Meme.tsx`); in einer
 * verschickten Datei muss er hinein, samt Papierrand. Dieselbe Idee wie der
 * Abzug im Album: ein nacktes Meme ist eins von vielen, ein Abzug ist
 * erkennbar von diesem Abend.
 */

const PAPER = '#f2ece2';
const INK = '#5d8784';
const STAMP = '#ff8a1e';
/** Lange Kante des Bildes im Abzug. Die Vorlagen sind kleiner – der Text soll trotzdem scharf sein. */
const EDGE = 1080;

const FONT: Record<NonNullable<MemeBox['f']> | 'thick', string> = {
  thick: `'Anton', 'Impact', 'Haettenschweiler', 'Arial Narrow', sans-serif`,
  thin: `-apple-system, 'Segoe UI', system-ui, 'Helvetica Neue', sans-serif`,
  comic: `'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', 'Marker Felt', system-ui, sans-serif`,
};
const WEIGHT: Record<NonNullable<MemeBox['f']> | 'thick', number> = {
  thick: 400,
  thin: 700,
  comic: 700,
};

/** Zeilenumbruch an Wortgrenzen – wie der Browser es im Spiel auch tut. */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (!line || measure(next) <= maxWidth) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Größte Schrift, bei der der Text ins Feld passt – mit Umbruch.
 * Als reine Funktion, damit sie ohne Canvas prüfbar ist.
 */
export function fitText(
  text: string,
  width: number,
  height: number,
  measureAt: (s: string, size: number) => number,
  lineHeight = 1.12,
): { size: number; lines: string[] } {
  let lo = 4;
  let hi = Math.max(lo, Math.min(height, width * 0.5));
  let best = { size: lo, lines: wrapLines(text, width, (s) => measureAt(s, lo)) };
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const lines = wrapLines(text, width, (s) => measureAt(s, mid));
    const fits =
      lines.length * mid * lineHeight <= height && lines.every((l) => measureAt(l, mid) <= width);
    if (fits) {
      lo = mid;
      best = { size: mid, lines };
    } else hi = mid;
  }
  return best;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Vorlage nicht ladbar'));
    img.src = src;
  });
}

export async function renderMeme(
  template: MemeTemplate,
  texts: string[],
  caption: string,
): Promise<Blob> {
  const img = await loadImage(memeUrl(template.id));
  await document.fonts?.load(`40px 'Anton'`).catch(() => undefined);

  const scale = EDGE / Math.max(template.w, template.h);
  const iw = Math.round(template.w * scale);
  const ih = Math.round(template.h * scale);
  const edge = Math.max(iw, ih);
  const pad = Math.round(edge * 0.035);
  const padB = Math.round(edge * 0.14);

  const canvas = document.createElement('canvas');
  canvas.width = iw + pad * 2;
  canvas.height = ih + pad + padB;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kein Canvas');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, pad, pad, iw, ih);

  template.boxes.forEach((box, i) => {
    const raw = (texts[i] ?? '').trim();
    if (!raw) return;
    const text = box.s === 'none' ? raw : raw.toLocaleUpperCase('de-DE');
    const kind = box.f ?? 'thick';
    const font = (size: number) => `${WEIGHT[kind]} ${size}px ${FONT[kind]}`;
    const bw = box.w * iw;
    const bh = box.h * ih;
    const measureAt = (s: string, size: number) => {
      ctx.font = font(size);
      return ctx.measureText(s).width;
    };
    const { size, lines } = fitText(text, bw * 0.96, bh * 0.96, measureAt);

    ctx.save();
    ctx.translate(pad + (box.x + box.w / 2) * iw, pad + (box.y + box.h / 2) * ih);
    if (box.r) ctx.rotate((-box.r * Math.PI) / 180);
    ctx.font = font(size);
    ctx.textBaseline = 'middle';
    ctx.textAlign = box.a ?? 'center';
    ctx.lineJoin = 'round';
    const dark = box.c === 'black';
    ctx.fillStyle = box.c ?? '#fff';
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.55)' : '#000';
    ctx.lineWidth = dark ? size * 0.06 : size * 0.14;
    const lh = size * 1.12;
    const x = box.a === 'left' ? -bw / 2 : box.a === 'right' ? bw / 2 : 0;
    lines.forEach((line, n) => {
      const y = (n - (lines.length - 1) / 2) * lh;
      ctx.strokeText(line, x, y);
      ctx.fillText(line, x, y);
    });
    ctx.restore();
  });

  // Unterer Rand: wie auf dem Kachelmotiv die Zeile in der Plakatschrift,
  // rechts der Datumsstempel.
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  let capSize = Math.round(padB * 0.3);
  ctx.font = `400 ${capSize}px ${FONT.thick}`;
  while (ctx.measureText(caption).width > canvas.width * 0.8 && capSize > 12) {
    capSize -= 2;
    ctx.font = `400 ${capSize}px ${FONT.thick}`;
  }
  ctx.fillText(caption.toLocaleUpperCase('de-DE'), canvas.width / 2, ih + pad + padB * 0.46);

  const d = new Date();
  const stamp = [d.getDate(), d.getMonth() + 1, d.getFullYear() % 100]
    .map((n) => String(n).padStart(2, '0'))
    .join(' ');
  ctx.font = `600 ${Math.round(padB * 0.13)}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'right';
  ctx.fillStyle = STAMP;
  ctx.shadowColor = 'rgba(255,138,30,0.8)';
  ctx.shadowBlur = 6;
  ctx.fillText(stamp, canvas.width - pad * 1.2, canvas.height - padB * 0.16);
  ctx.shadowBlur = 0;

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Kein Bild'))), 'image/jpeg', 0.9),
  );
}

/** Ins Teilen-Menü – oder, ohne eines (Desktop), als Download. */
export async function shareMeme(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
