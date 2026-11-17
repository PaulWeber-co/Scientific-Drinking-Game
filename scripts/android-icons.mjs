/**
 * Android-App-Icons aus den Web-Icons erzeugen – eine Icon-Quelle für alle.
 *
 *   npm run icons:android
 *
 * Quellen: public/icon-maskable-512.png (randlos) und public/icon-512.png
 * (mit abgerundeten Ecken). Schreibt nach android/app/src/main/res/:
 * - mipmap-*dpi/ic_launcher_background.png  Adaptive Icon (ganzes Motiv)
 * - mipmap-*dpi/ic_launcher_foreground.png  leer – das Motiv ist ein Bild
 * - mipmap-*dpi/ic_launcher(.png|_round.png) für Android 7 (vor Adaptive Icons)
 *
 * Neues Icon → Skript erneut laufen lassen, dann `npx cap sync android`.
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const res = `${root}android/app/src/main/res`;
const maskable = `${root}public/icon-maskable-512.png`;
const rounded = `${root}public/icon-512.png`;

/**
 * Adaptive Icons zeigen nur die Mitte (72 von 108 dp), Launcher schneiden
 * Kreis, Quadrat oder Squircle daraus. Das Motiv kommt darum mit 78 dp in
 * die Mitte – so hat das Glas auf dem Startbildschirm dieselbe Größe wie auf
 * dem iPhone. Der Rand darum ist das unscharf gezogene Motiv: Launcher mit
 * Parallax-Effekt verschieben die Maske, und dann soll kein Streifen kommen.
 */
async function adaptive(size) {
  const inner = Math.round((size * 78) / 108);
  const offset = Math.round((size - inner) / 2);
  const edge = await sharp(maskable)
    .resize(size, size)
    .blur(size / 12)
    .toBuffer();
  const motif = await sharp(maskable).resize(inner, inner).toBuffer();
  return sharp(edge)
    .composite([{ input: motif, left: offset, top: offset }])
    .png();
}

async function round(size) {
  // Ausschnitt so gewählt, dass das Glas im Kreis so groß ist wie im Squircle.
  const crop = Math.round(512 * 0.86);
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`,
  );
  const body = await sharp(maskable)
    .extract({ left: (512 - crop) / 2, top: (512 - crop) / 2, width: crop, height: crop })
    .resize(size, size)
    .toBuffer();
  return sharp(body)
    .composite([{ input: circle, blend: 'dest-in' }])
    .png();
}

const empty = (size) =>
  sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png();

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, scale] of Object.entries(densities)) {
  const dir = `${res}/mipmap-${name}`;
  mkdirSync(dir, { recursive: true });
  const layer = 108 * scale;
  const legacy = 48 * scale;
  await Promise.all([
    (await adaptive(layer)).toFile(`${dir}/ic_launcher_background.png`),
    empty(layer).toFile(`${dir}/ic_launcher_foreground.png`),
    sharp(rounded).resize(legacy, legacy).png().toFile(`${dir}/ic_launcher.png`),
    (await round(legacy)).toFile(`${dir}/ic_launcher_round.png`),
  ]);
}
console.log('Android-Icons erzeugt in', res);
