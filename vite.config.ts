import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages served the app under /<repo>/ -- override with VITE_BASE when
// deploying somewhere else (Vercel, Cloudflare Pages, custom domain: "/").
const base = process.env.VITE_BASE ?? '/Scientific-Drinking-Game/';

export default defineConfig({
  base,
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
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
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
