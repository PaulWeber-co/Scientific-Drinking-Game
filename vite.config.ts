import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages served the app under /<repo>/ -- override with VITE_BASE when
// deploying somewhere else (Vercel, Cloudflare Pages, custom domain: "/").
const base = process.env.VITE_BASE ?? '/Scientific-Drinking-Game/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/database'],
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
