/**
 * Bereitet ein Kachel-Motiv auf: zuschneiden, den Einwegkamera-Look der App
 * darüberlegen, als WebP schreiben.
 *
 * Der Look kommt aus derselben Funktion, die auch die Fotos der Nutzer
 * entwickelt (`src/features/camera/filmLook.ts`). Nur so sehen die Motive
 * aus wie vom selben Film wie die eigenen Bilder – ein per Hand gedrehter
 * Filter träfe die Werte nie zweimal gleich.
 *
 * Braucht ImageMagick (`convert`).
 *
 *   node_modules/.bin/vite-node scripts/filmize.mjs \
 *     roh.jpg src/assets/games/kings-cup.webp
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { DISPOSABLE, applyFilmLook } from '../src/features/camera/filmLook.ts';

/** Liefervorgabe: 3:4 hochkant, wie die Kachel im Spieleraster. */
const W = 1080;
const H = 1440;

/**
 * Wie die eigene Kamera – nur ohne Korn.
 *
 * Das Korn liegt in der App live über dem ganzen Bildschirm (`.korn`).
 * Eingebrannt käme es doppelt, und weil Rauschen sich nicht komprimieren
 * lässt, verdoppelt es nebenbei die Dateigröße.
 */
const LOOK = { ...DISPOSABLE, grain: 0 };

const [ein, aus, qualitaet = '72'] = process.argv.slice(2);
if (!ein || !aus) {
  console.error('Aufruf: filmize.mjs <roh.jpg> <ziel.webp> [qualitaet]');
  process.exit(1);
}

const roh = `${aus}.raw`;
execFileSync('convert', [ein, '-resize', `${W}x${H}^`, '-gravity', 'center',
  '-extent', `${W}x${H}`, '-depth', '8', `rgba:${roh}`]);

const data = new Uint8ClampedArray(readFileSync(roh));
applyFilmLook(data, W, H, LOOK);
writeFileSync(roh, Buffer.from(data.buffer));

execFileSync('convert', ['-size', `${W}x${H}`, '-depth', '8', `rgba:${roh}`,
  '-strip', '-quality', qualitaet, aus]);
unlinkSync(roh);

const kb = Math.round(readFileSync(aus).length / 1024);
console.log(`${aus} · ${kb} kB${kb > 60 ? ' · über 60 kB, Qualität senken' : ''}`);
