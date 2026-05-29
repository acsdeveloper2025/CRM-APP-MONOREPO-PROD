import { defineConfig } from 'vitest/config';
import path from 'path';

// Integration tests run against the real Express app (supertest) + the
// isolated acs_db_test Postgres database. Kept separate from the unit config
// so `npm test` stays fast and DB-free. Run with `npm run test:integration`.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['./src/test-support/setupEnv.ts'],
    fileParallelism: false, // all suites share one DB; run serially
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
