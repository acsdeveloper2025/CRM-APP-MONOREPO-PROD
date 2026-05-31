/**
 * Characterization of TaskCompletionValidator.canTransition — the PURE task
 * status state machine (the workflow-integrity guard that blocks illegal
 * transitions like ASSIGNED→COMPLETED or reviving a COMPLETED/REVOKED task).
 * DB/logger imports are mocked; canTransition is a static pure method.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/database', () => ({ query: vi.fn() }));
vi.mock('../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { TaskCompletionValidator } from './taskCompletionValidator';

const can = (a: string, b: string) => TaskCompletionValidator.canTransition(a, b);

describe('TaskCompletionValidator.canTransition', () => {
  it('allows the valid forward transitions', () => {
    expect(can('PENDING', 'ASSIGNED')).toBe(true);
    expect(can('ASSIGNED', 'IN_PROGRESS')).toBe(true);
    expect(can('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('allows revoking from any active state', () => {
    expect(can('PENDING', 'REVOKED')).toBe(true);
    expect(can('ASSIGNED', 'REVOKED')).toBe(true);
    expect(can('IN_PROGRESS', 'REVOKED')).toBe(true);
  });

  it('blocks skipping states', () => {
    expect(can('PENDING', 'IN_PROGRESS')).toBe(false);
    expect(can('ASSIGNED', 'COMPLETED')).toBe(false);
    expect(can('PENDING', 'COMPLETED')).toBe(false);
  });

  it('blocks backward transitions', () => {
    expect(can('IN_PROGRESS', 'ASSIGNED')).toBe(false);
    expect(can('ASSIGNED', 'PENDING')).toBe(false);
  });

  it('treats COMPLETED and REVOKED as terminal', () => {
    for (const to of ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REVOKED']) {
      expect(can('COMPLETED', to)).toBe(false);
    }
    for (const to of ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED']) {
      expect(can('REVOKED', to)).toBe(false);
    }
  });

  it('returns false for an unknown current status', () => {
    expect(can('NONSENSE', 'ASSIGNED')).toBe(false);
  });
});
