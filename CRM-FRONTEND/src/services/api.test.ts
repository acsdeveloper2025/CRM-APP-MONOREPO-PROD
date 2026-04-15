import { describe, it, expect, vi, beforeEach } from 'vitest';

// vite.config aliases are picked up by vitest, but VITE_API_BASE_URL must
// be defined for the ApiService constructor not to throw in the dev path.
beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api');
});

import { STORAGE_KEYS } from '@/types/constants';

// Importing the singleton triggers the ApiService constructor exactly
// once for this module — exactly what we want to assert against. We
// import it inside `beforeEach` for tests that need a fresh
// construction sequence.

describe('ApiService — Phase E5 token storage hardening', () => {
  it('clears any pre-existing AUTH_TOKEN from localStorage on construction', async () => {
    // Pretend an older build left a token behind
    window.localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'leftover-from-old-build');
    expect(window.localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBe('leftover-from-old-build');

    // Re-import to get a fresh module evaluation. Vite's ESM cache means
    // the singleton is created on first import; using vi.resetModules
    // forces a re-evaluation so the constructor's wipe runs again.
    vi.resetModules();
    await import('./api');

    expect(window.localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull();
  });

  it('setAccessToken does not persist the token to localStorage', async () => {
    vi.resetModules();
    const { apiService } = await import('./api');

    apiService.setAccessToken('in-memory-only-token');

    expect(window.localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull();
    expect(apiService.getAccessToken()).toBe('in-memory-only-token');
  });

  it('setAccessToken(null) clears in-memory and never writes localStorage', async () => {
    vi.resetModules();
    const { apiService } = await import('./api');

    apiService.setAccessToken('temp-token');
    apiService.setAccessToken(null);

    expect(window.localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull();
    expect(apiService.getAccessToken()).toBeNull();
  });

  it('setAccessToken still wipes a stale legacy AUTH_TOKEN written by another tab', async () => {
    vi.resetModules();
    const { apiService } = await import('./api');

    // Simulate another tab (or a script) writing the legacy key after construction
    window.localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'tampered');
    apiService.setAccessToken('fresh-token');

    expect(window.localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull();
  });
});
