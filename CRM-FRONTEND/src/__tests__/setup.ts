import { afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

// Reset localStorage and any spies between tests so accidental leakage
// can't make one test depend on another's side effects.
beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup(); // unmount React trees rendered via @testing-library/react
  vi.restoreAllMocks();
  window.localStorage.clear();
});
