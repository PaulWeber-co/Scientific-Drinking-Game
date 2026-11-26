import { defineConfig } from 'vitest/config';

/**
 * Nur für `npm run test:rules`: die Security-Rules-Tests brauchen den
 * Database-Emulator und laufen deshalb getrennt von `npm test`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
