/**
 * Shared render helper for FE component tests that need Router and/or
 * TanStack Query context — wraps the UI in a MemoryRouter + a fresh
 * QueryClient (retries off so failed queries reject fast in tests).
 *
 * Components that also consume Auth/Permission/ActiveScope contexts should
 * `vi.mock('@/contexts/...')` (or the `@/hooks/useAuth` hook) in their test
 * file — those providers fetch on mount and must not hit the network here.
 */
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options: { route?: string } & Omit<RenderOptions, 'wrapper'> = {}
) {
  const { route = '/', ...renderOptions } = options;
  const queryClient = makeTestQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
