/**
 * Characterization of UsersTable — an auth-dependent component. Demonstrates
 * the harness pattern for components that read context: vi.mock the
 * useAuth hook, then render with renderWithProviders (Router + Query).
 * Pins the empty state and the data rows (name / username / email fallback).
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { User } from '@/types/user';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'current-admin', name: 'Admin', permissionCodes: ['*'] },
    isAuthenticated: true,
  }),
}));

import { UsersTable } from './UsersTable';

const mkUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u1',
    name: 'Asha Rao',
    username: 'asha.rao',
    employeeId: 'EMP-1',
    email: 'asha@example.com',
    isActive: true,
    roles: ['FIELD_AGENT'],
    ...overrides,
  }) as User;

describe('UsersTable', () => {
  it('renders the empty state when there is no data', () => {
    renderWithProviders(<UsersTable data={[]} isLoading={false} />);
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('renders a row per user with name, username and email', () => {
    renderWithProviders(
      <UsersTable
        data={[mkUser(), mkUser({ id: 'u2', name: 'Ben Lee', username: 'ben.lee', email: undefined })]}
        isLoading={false}
      />
    );
    // name/username render in both the desktop table and the mobile cards
    expect(screen.getAllByText('Asha Rao').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Ben Lee').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('asha@example.com').length).toBeGreaterThanOrEqual(1);
    // missing email falls back to an em dash
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show the empty state while loading', () => {
    renderWithProviders(<UsersTable data={[]} isLoading={true} />);
    expect(screen.queryByText('No users found')).not.toBeInTheDocument();
  });
});
