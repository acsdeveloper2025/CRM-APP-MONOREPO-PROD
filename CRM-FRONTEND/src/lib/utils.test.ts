import { describe, it, expect } from 'vitest';
import { cn, formatDate, formatDateTime } from './utils';

describe('cn', () => {
  it('joins truthy class values and drops falsy ones', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', false, undefined, null, 'c')).toBe('a c');
  });

  it('lets tailwind-merge resolve conflicting utilities (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('formatDate', () => {
  it('returns empty string for empty or invalid input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });

  it('formats a valid date as "Mon D, YYYY"', () => {
    // Use a local-time Date to avoid UTC-parse timezone drift.
    expect(formatDate(new Date(2026, 0, 15))).toBe('Jan 15, 2026');
  });
});

describe('formatDateTime', () => {
  it('returns empty string for invalid input', () => {
    expect(formatDateTime('not-a-date')).toBe('');
  });

  it('includes the date portion for a valid date', () => {
    const out = formatDateTime(new Date(2026, 0, 15, 9, 30));
    expect(out).toContain('Jan 15, 2026');
  });
});
