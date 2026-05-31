/**
 * Characterization of CaseTable — loading skeleton, empty state, and the
 * data view (rows + case-detail Links). Uses renderWithProviders because
 * the rows render react-router <Link>s. First consumer of the provider
 * harness.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { CaseTable } from './CaseTable';
import type { Case } from '@/types/case';

const mkCase = (overrides: Partial<Case> = {}): Case =>
  ({
    id: 'id000000000001',
    caseId: 'CASE-1',
    status: 'PENDING',
    priority: 2,
    customerName: 'Asha Rao',
    clientName: 'HDFC',
    totalTasks: 2,
    completedTasks: 1,
    updatedAt: '2026-05-20T10:30:00.000Z',
    ...overrides,
  }) as Case;

describe('CaseTable', () => {
  it('renders the loading skeleton with column headers', () => {
    renderWithProviders(<CaseTable cases={[]} isLoading />);
    expect(screen.getByText('Case ID')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
  });

  it('renders the empty state when there are no cases', () => {
    renderWithProviders(<CaseTable cases={[]} />);
    expect(screen.getByText(/No cases found/i)).toBeInTheDocument();
  });

  it('renders a row per case with a link to the case detail route', () => {
    renderWithProviders(
      <CaseTable cases={[mkCase(), mkCase({ id: 'id2', caseId: 'CASE-2', customerName: 'Ben Lee' })]} />
    );
    // Names appear in the desktop table and/or mobile card view.
    expect(screen.getAllByText('Asha Rao').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Ben Lee').length).toBeGreaterThanOrEqual(1);

    const detailLink = screen
      .getAllByRole('link')
      .some((a) => a.getAttribute('href')?.includes('/case-management/CASE-1'));
    expect(detailLink).toBe(true);
  });
});
