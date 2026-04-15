import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Standalone vitest config so the shared `vite.config.ts` doesn't have
// to grow a `test:` block — and so test runs can override env-aware
// behaviour (e.g. VITE_API_BASE_URL) without affecting `vite dev`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/types/**', 'src/main.tsx'],
    },
    // happy-dom comes with localStorage + window built in; just make
    // sure we start each test with a clean slate.
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
