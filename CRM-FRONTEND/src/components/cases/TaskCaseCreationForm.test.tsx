/**
 * Smoke / characterization test for the TaskCaseCreationForm god-component
 * (1587 LOC, DEFERRED_ITEMS §7 decomposition target). A full render is the
 * safety net that catches structural regressions while the component is
 * later decomposed.
 *
 * All data/context hooks are mocked to return empty defaults so the form
 * renders offline. The two raw useQuery calls in TaskCard are `enabled`-
 * guarded off while fields are empty, so no service mocks are needed.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/__tests__/renderWithProviders';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'a1', name: 'Admin', permissionCodes: ['*'] }, isAuthenticated: true }),
}));
vi.mock('@/hooks/useActiveScope', () => ({
  useActiveScope: () => ({ selectedClientId: null, selectedProductId: null }),
}));
vi.mock('@/hooks/useClients', () => ({
  useClients: () => ({ data: { data: [] } }),
  useProductsByClient: () => ({ data: { data: [] } }),
}));
vi.mock('@/hooks/useStandardizedQuery', () => ({
  useStandardizedQuery: () => ({ data: { data: [] } }),
}));
vi.mock('@/hooks/useLocations', () => ({
  useScopedPincodeSearch: () => ({ pincodes: [], setSearchTerm: vi.fn() }),
}));
vi.mock('@/hooks/useUsers', () => ({
  useAvailableFieldUsers: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/useAreas', () => ({
  useScopedAreasByPincode: () => ({ data: { data: [] } }),
}));

import { TaskCaseCreationForm } from './TaskCaseCreationForm';
import type { CustomerInfoData } from './CustomerInfoStep';

const customerInfo = {
  customerName: 'Test Customer',
  mobileNumber: '9999999999',
} as CustomerInfoData;

describe('TaskCaseCreationForm (smoke)', () => {
  const renderForm = () =>
    renderWithProviders(
      <TaskCaseCreationForm customerInfo={customerInfo} onSubmit={vi.fn()} caseType="field" />
    );

  it('renders the form shell with its main sections', () => {
    renderForm();
    expect(screen.getByText('Create Case with Tasks')).toBeInTheDocument();
    expect(screen.getByText('Customer Details')).toBeInTheDocument();
    expect(screen.getByText('Client & Product')).toBeInTheDocument();
  });

  it('shows the passed customer info', () => {
    renderForm();
    expect(screen.getByText('Test Customer')).toBeInTheDocument();
    expect(screen.getByText('9999999999')).toBeInTheDocument();
  });

  it('starts with one task card', () => {
    renderForm();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });
});
