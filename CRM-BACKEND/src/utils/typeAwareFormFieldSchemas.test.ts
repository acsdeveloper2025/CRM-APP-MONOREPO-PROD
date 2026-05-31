/**
 * Characterization of typeAwareFormFieldSchemas — the conditional-field
 * visibility engine + per-type schema getters. Pins evaluateConditionalRule
 * across all operators, shouldShowField, and getFieldSchema per
 * verification/form type.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateConditionalRule,
  shouldShowField,
  getFieldSchema,
  getRelevantFieldsForFormType,
  type ConditionalRule,
} from '@/utils/typeAwareFormFieldSchemas';

const rule = (over: Partial<ConditionalRule>): ConditionalRule => ({
  parentField: 'door_status',
  operator: 'equals',
  value: 'Open',
  showFields: ['metPersonName'],
  ...over,
});

describe('evaluateConditionalRule — operators', () => {
  it('equals', () => {
    expect(evaluateConditionalRule(rule({ operator: 'equals', value: 'Open' }), { door_status: 'Open' })).toBe(true);
    expect(evaluateConditionalRule(rule({ operator: 'equals', value: 'Open' }), { door_status: 'Locked' })).toBe(false);
  });

  it('notEquals', () => {
    expect(evaluateConditionalRule(rule({ operator: 'notEquals', value: 'Open' }), { door_status: 'Locked' })).toBe(true);
    expect(evaluateConditionalRule(rule({ operator: 'notEquals', value: 'Open' }), { door_status: 'Open' })).toBe(false);
  });

  it('in / notIn', () => {
    expect(evaluateConditionalRule(rule({ operator: 'in', value: ['Open', 'Locked'] }), { door_status: 'Open' })).toBe(true);
    expect(evaluateConditionalRule(rule({ operator: 'in', value: ['Open'] }), { door_status: 'X' })).toBe(false);
    expect(evaluateConditionalRule(rule({ operator: 'notIn', value: ['Open'] }), { door_status: 'X' })).toBe(true);
    expect(evaluateConditionalRule(rule({ operator: 'notIn', value: ['X'] }), { door_status: 'X' })).toBe(false);
  });

  it('contains + missing parent value (snapshot for exact behavior)', () => {
    expect(evaluateConditionalRule(rule({ operator: 'contains', value: 'pen' }), { door_status: 'Open' })).toMatchSnapshot('contains-hit');
    expect(evaluateConditionalRule(rule({ operator: 'equals', value: 'Open' }), {})).toMatchSnapshot('missing-parent');
  });
});

describe('shouldShowField', () => {
  it('shows a field with no governing rule', () => {
    expect(shouldShowField('someUnruledField', { door_status: 'Open' })).toBe(true);
  });

  it('is deterministic for a governed field (snapshot)', () => {
    expect(shouldShowField('metPersonName', { door_status: 'Open' })).toMatchSnapshot('open');
    expect(shouldShowField('metPersonName', { door_status: 'Locked' })).toMatchSnapshot('locked');
  });
});

describe('getFieldSchema / getRelevantFieldsForFormType', () => {
  it('returns a schema for known type/formType combinations (snapshot)', () => {
    for (const [vt, ft] of [
      ['RESIDENCE', 'POSITIVE'],
      ['BUSINESS', 'SHIFTED'],
      ['RESIDENCE', 'UNTRACEABLE'],
    ] as const) {
      expect(getFieldSchema(vt, ft)).toMatchSnapshot(`${vt}-${ft}`);
    }
  });

  it('is case-insensitive on verification type', () => {
    expect(getFieldSchema('residence', 'POSITIVE')).toEqual(getFieldSchema('RESIDENCE', 'POSITIVE'));
  });

  it('getRelevantFieldsForFormType delegates to getFieldSchema (POSITIVE default)', () => {
    expect(getRelevantFieldsForFormType('RESIDENCE')).toEqual(getFieldSchema('RESIDENCE', 'POSITIVE'));
  });
});
