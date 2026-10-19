import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages served the app under /<repo>/ -- override with VITE_BASE when
// deploying somewhere else (Vercel, Cloudflare Pages, custom domain: "/").
const base = process.env.VITE_BASE ?? '/Scientific-Drinking-Game/';

/**
 * Fingerabdruck der Spiellogik. Der Host schreibt ihn in die Runde; ein Handy
 * mit anderem Stand sieht einen Hinweis statt „undefined beschreibt gerade".
 * Pfade und Zeilenenden normalisiert: derselbe Code soll unter Windows und
 * Linux denselben Abdruck ergeben.
 */
function gameBuild(): string {
  const dir = fileURLToPath(new URL('./src/games', import.meta.url));
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((f) => f.replaceAll('\\', '/'))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .sort();
  const hash = createHash('sha256');
  for (const f of files) {
    hash.update(f).update(readFileSync(`${dir}/${f}`, 'utf8').replaceAll('\r\n', '\n'));
  }
  return hash.digest('hex').slice(0, 12);
}

export default defineConfig({
  base,
  define: { __GAME_BUILD__: JSON.stringify(gameBuild()) },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': die neue Version wartet, bis jemand „Neu laden" tippt.
      // Ein stilles Auto-Update würde laufende Runden mitten im Spiel neu
      // laden – und nicht auf allen Handys gleichzeitig.
      registerType: 'prompt',
      // Vitest braucht keinen Service Worker.
      disable: process.env.VITEST === 'true',
      includeAssets: ['icon.svg', 'icon-180.png'],
      manifest: {
        name: 'Pegel - Wissenschaftliche Trinkspiele',
        short_name: 'Pegel',
        description: 'Trinkspiele mit individuell berechneten Schlucken.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#08080B',
        theme_color: '#08080B',
        icons: [
          { src: './icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: './icon-180.png', sizes: '180x180', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // App-Shell komplett vorab: HTML, CSS, JS (auch die Spiel-Chunks),
        // Icons. Damit startet Pass & Play ohne Netz.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Firebase geht immer ans Netz. Die WebSocket-Verbindung erreicht
            // den Service Worker ohnehin nie; das hier fängt den Long-Polling-
            // Fallback ab, damit nie ein alter Lobby-Zustand aus dem Cache kommt.
            urlPattern: ({ url }) =>
              /firebasedatabase\.app$|firebaseio\.com$|googleapis\.com$/.test(url.hostname),
            handler: 'NetworkOnly',
          },
          {
            // Die Meme-Vorlagen (public/memes, rund 3 MB) stehen ebenfalls
            // nicht im Precache. Eigener Cache, damit knapp 200 Vorlagen nicht
            // die Kachel-Motive verdrängen – wer eine Vorlage einmal hatte,
            // hat sie danach auch ohne Netz.
            urlPattern: ({ url }) => /\/memes\/[a-z0-9-]+\.webp$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'memes',
              expiration: { maxEntries: 260, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            // Die Kachel-Motive liegen als eigene Dateien neben dem Paket und
            // stehen bewusst NICHT im Precache: 19 Motive sind knapp ein
            // Megabyte, das beim ersten Start niemand braucht. Wer ein Spiel
            // einmal gesehen hat, sieht sein Bild danach auch ohne Netz.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'motive',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (/node_modules\/(@firebase|firebase)\//.test(id)) return 'firebase';
          // React und Router ändern sich selten: eigener Chunk, damit ein
          // App-Update nicht das Framework neu lädt.
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|zustand)\//.test(id))
            return 'vendor';
          return undefined;
        },
        // Spiel-Chunks nach dem Ordner benennen statt alle „index-*.js".
        chunkFileNames: (info) => {
          const game = info.facadeModuleId?.match(/games\/([a-z0-9-]+)\/index\.tsx?$/);
          return game ? `assets/spiel-${game[1]}-[hash].js` : 'assets/[name]-[hash].js';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
