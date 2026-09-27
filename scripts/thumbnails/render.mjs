/**
 * Belichtet die Kachel-Motive aus `scenes.tsx` als WebP (1080 × 1440).
 *
 *   npx vite                                   # Dev-Server, eigenes Terminal
 *   node scripts/thumbnails/render.mjs         # alle Motive
 *   node scripts/thumbnails/render.mjs tabu    # nur eines
 *
 * Braucht Playwright mit Chromium (lokal oder global installiert). Die
 * Übersicht aller Motive liegt unter /scripts/thumbnails/index.html.
 *
 * Kein Film-Look wie bei `filmize.mjs`: das ist für Fotos. Vektorbilder
 * bekommen ihre Vignette schon in der Szene, und der Blitzfleck machte die
 * satten Farben nur flau.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return require(`${root}/playwright`);
  }
}
const { chromium } = loadPlaywright();

const BASE = process.env.BASE ?? 'http://localhost:5173/Scientific-Drinking-Game/';
const QUALITY = Number(process.env.QUALITY ?? 0.82);
const IDS = [
  'truth-or-dare',
  'never-have-i-ever',
  'most-likely',
  'undercover',
  'chaos-roulette',
  'wortbombe',
  'duell',
  'tabu',
  'meme-battle',
  'lueckenfueller',
  'schaetzfrage',
  'zwei-wahrheiten',
  'top-ten',
  'maexchen',
  'busfahrer',
  'kategorien',
  'erste-zeile',
];
const wanted = process.argv.slice(2);
const ids = wanted.length ? IDS.filter((id) => wanted.includes(id)) : IDS;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 480 }, deviceScaleFactor: 3 });
for (const id of ids) {
  await page.goto(`${BASE}scripts/thumbnails/index.html?id=${id}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.locator(`#tile-${id}`).screenshot();
  // PNG → WebP über die Canvas des Browsers: kein ImageMagick nötig.
  const webp = await page.evaluate(
    async ({ b64, q }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/webp', q).split(',')[1];
    },
    { b64: png.toString('base64'), q: QUALITY },
  );
  const out = `src/assets/games/${id}.webp`;
  const buf = Buffer.from(webp, 'base64');
  writeFileSync(out, buf);
  const kb = Math.round(buf.length / 1024);
  console.log(`${out} · ${kb} kB${kb > 60 ? ' · über 60 kB, QUALITY senken' : ''}`);
}
await browser.close();
