/**
 * Characterization of the CaseCard presentational component. Prop-driven
 * (no provider hooks), so it renders directly. Pins the displayed fields,
 * the fallback chains (customerName -> applicantName -> N/A, etc.), and the
 * onClick bubbling from the card.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseCard } from './CaseCard';
import type { Case } from '@/types/case';

const baseCase = (overrides: Partial<Case> = {}): Case =>
  ({
    id: 'abcdef0123456789',
    caseId: 'CASE-123',
    status: 'PENDING',
    priority: 3,
    customerName: 'Asha Rao',
    customerPhone: '9876543210',
    address: '12 MG Road, Mumbai',
    clientName: 'HDFC',
    totalTasks: 4,
    completedTasks: 1,
    pendingTasks: 2,
    inProgressTasks: 1,
    updatedAt: '2026-05-20T10:30:00.000Z',
    ...overrides,
  }) as Case;

describe('CaseCard', () => {
  it('renders the primary case fields', () => {
    render(<CaseCard case={baseCase()} />);
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('#CASE-123')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
    expect(screen.getByText('12 MG Road, Mumbai')).toBeInTheDocument();
    expect(screen.getByText('HDFC')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument(); // priority 3 -> HIGH
  });

  it('falls back through customerName -> applicantName -> N/A and address default', () => {
    render(
      <CaseCard
        case={baseCase({
          customerName: undefined,
          applicantName: 'Backup Name',
          address: undefined,
          clientName: undefined,
          client: undefined,
        })}
      />
    );
    expect(screen.getByText('Backup Name')).toBeInTheDocument();
    expect(screen.getByText('No address provided')).toBeInTheDocument();
    // clientName + client both missing -> N/A
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('shows task counts', () => {
    render(<CaseCard case={baseCase()} />);
    expect(screen.getByText('4')).toBeInTheDocument(); // totalTasks
    expect(screen.getByText('✓ 1')).toBeInTheDocument(); // completed
    expect(screen.getByText('⏳ 3')).toBeInTheDocument(); // pending(2)+inProgress(1)
  });

  it('fires onClick when the card is clicked', async () => {
    const onClick = vi.fn();
    render(<CaseCard case={baseCase()} onClick={onClick} />);
    await userEvent.click(screen.getByText('Asha Rao'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
