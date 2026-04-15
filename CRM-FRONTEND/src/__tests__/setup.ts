import { afterEach, beforeEach, vi } from 'vitest';

// Reset localStorage and any spies between tests so accidental leakage
// can't make one test depend on another's side effects.
beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});
