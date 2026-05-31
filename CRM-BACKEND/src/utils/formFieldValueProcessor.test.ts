/**
 * Characterization of processFormFieldValue — the shared, pure field-value
 * coercion used by every *FormValidator. High-risk: this is the locus of the
 * numeric-coercion bug (a non-numeric value like "Ground" in a numericField
 * coerces to null — which is WHY addressFloor must stay OUT of NUMERIC_FIELDS;
 * see project_verification_forms_ux). Pins every branch.
 */
import { describe, it, expect } from 'vitest';
import { processFormFieldValue } from '@/utils/formFieldValueProcessor';

const opts = (over: Partial<{ numericFields: string[]; dateFields: string[] }> = {}) => ({
  numericFields: [] as string[],
  ...over,
});

describe('processFormFieldValue', () => {
  it('maps null / undefined / blank strings to null', () => {
    expect(processFormFieldValue('f', null, opts())).toBeNull();
    expect(processFormFieldValue('f', undefined, opts())).toBeNull();
    expect(processFormFieldValue('f', '   ', opts())).toBeNull();
  });

  describe('numeric fields', () => {
    const o = opts({ numericFields: ['amount'] });
    it('coerces numeric strings/objects to numbers', () => {
      expect(processFormFieldValue('amount', '5', o)).toBe(5);
      expect(processFormFieldValue('amount', 7, o)).toBe(7);
      expect(processFormFieldValue('amount', { value: 9 }, o)).toBe(9);
    });

    it('REGRESSION: a non-numeric value in a numeric field becomes null (e.g. "Ground")', () => {
      // This is exactly why addressFloor must NOT be a numericField — "Ground"
      // would silently become null and lose the floor.
      expect(processFormFieldValue('amount', 'Ground', o)).toBeNull();
    });
  });

  describe('date fields', () => {
    const o = opts({ dateFields: ['dob'] });
    it('keeps a valid date string and nulls an invalid one', () => {
      expect(processFormFieldValue('dob', '2026-01-15', o)).toBe('2026-01-15');
      expect(processFormFieldValue('dob', 'not-a-date', o)).toBeNull();
    });
  });

  it('joins composite {value, unit} objects into a string', () => {
    expect(processFormFieldValue('stayingPeriod', { value: 3, unit: 'Years' }, opts())).toBe('3 Years');
  });

  it('defaults to a trimmed string for plain values', () => {
    expect(processFormFieldValue('name', '  Asha  ', opts())).toBe('Asha');
    expect(processFormFieldValue('flag', true, opts())).toBe('true');
  });

  it('JSON-stringifies a non-composite object', () => {
    expect(processFormFieldValue('meta', { a: 1 }, opts())).toBe('{"a":1}');
  });
});
