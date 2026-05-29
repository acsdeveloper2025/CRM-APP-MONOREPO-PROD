import { describe, it, expect } from 'vitest';
import {
  formatBadgeLabel,
  getPriorityLabel,
  getStatusLabel,
  getStatusBadgeStyle,
  getTaskPriorityBadgeStyle,
} from './badgeStyles';

describe('formatBadgeLabel', () => {
  it('returns N/A for nullish input', () => {
    expect(formatBadgeLabel(undefined)).toBe('N/A');
    expect(formatBadgeLabel(null as unknown as undefined)).toBe('N/A');
  });

  it('uppercases and replaces the FIRST underscore only (pinned quirk)', () => {
    expect(formatBadgeLabel('in_progress')).toBe('IN PROGRESS');
    // .replace('_', ' ') is non-global → only the first underscore is replaced
    expect(formatBadgeLabel('a_b_c')).toBe('A B_C');
  });

  it('stringifies numbers', () => {
    expect(formatBadgeLabel(3)).toBe('3');
  });
});

describe('getPriorityLabel', () => {
  it('maps numeric priorities 1-5 to labels', () => {
    expect(getPriorityLabel(1)).toBe('LOW');
    expect(getPriorityLabel(2)).toBe('MEDIUM');
    expect(getPriorityLabel(3)).toBe('HIGH');
    expect(getPriorityLabel(4)).toBe('URGENT');
    expect(getPriorityLabel(5)).toBe('CRITICAL');
  });

  it('returns UNKNOWN for out-of-range numbers', () => {
    expect(getPriorityLabel(0)).toBe('UNKNOWN');
    expect(getPriorityLabel(99)).toBe('UNKNOWN');
  });

  it('uppercases string priorities as-is', () => {
    expect(getPriorityLabel('high')).toBe('HIGH');
  });
});

describe('getStatusLabel', () => {
  it('uppercases and replaces the first underscore', () => {
    expect(getStatusLabel('pending')).toBe('PENDING');
    expect(getStatusLabel('in_progress')).toBe('IN PROGRESS');
  });
});

describe('badge style helpers', () => {
  it('return the standardized green badge classes', () => {
    for (const style of [getStatusBadgeStyle('x'), getTaskPriorityBadgeStyle('y')]) {
      expect(style).toContain('bg-green-600');
      expect(style).toContain('uppercase');
      expect(style).toContain('text-xs');
    }
  });
});
