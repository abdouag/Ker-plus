import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` n'a de sens que dans le bundler Next.js.
      'server-only': resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Les tests d'intégration partagent une base PostgreSQL : exécution séquentielle.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
