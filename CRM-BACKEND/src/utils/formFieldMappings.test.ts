/**
 * Characterization tests for the 9 per-type form-field mapping utils +
 * the 2 required-field validators + the comprehensive form-field getters.
 *
 * Purpose: pin the EXACT current behavior of these pure functions BEFORE
 * the §7 form-mapping consolidation refactor, so the consolidation cannot
 * silently change output. These assert observed behavior (warts included),
 * not desired behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Silence the missing-relevant-field warnings; spy so we can pin warn behavior.
const warn = vi.fn();
vi.mock('@/config/logger', () => ({
  logger: { warn: (...a: unknown[]) => warn(...a), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ensureAllFieldsPopulated } from '@/utils/residenceFormFieldMapping';
import {
  ensureAllOfficeFieldsPopulated,
  validateOfficeRequiredFields,
} from '@/utils/officeFormFieldMapping';
import {
  ensureAllBusinessFieldsPopulated,
  validateBusinessRequiredFields,
} from '@/utils/businessFormFieldMapping';
import { ensureAllBuilderFieldsPopulated } from '@/utils/builderFormFieldMapping';
import { ensureAllNocFieldsPopulated } from '@/utils/nocFormFieldMapping';
import { ensureAllDsaConnectorFieldsPopulated } from '@/utils/dsaConnectorFormFieldMapping';
import { ensureAllPropertyApfFieldsPopulated } from '@/utils/propertyApfFormFieldMapping';
import { ensureAllPropertyIndividualFieldsPopulated } from '@/utils/propertyIndividualFormFieldMapping';
import { ensureAllResidenceCumOfficeFieldsPopulated } from '@/utils/residenceCumOfficeFormFieldMapping';
import {
  getFormFieldDefinitions,
  getFormSections,
  getFieldsForSection,
  getFormTypeLabel,
  getVerificationTableName,
} from '@/utils/comprehensiveFormFieldMapping';

type EnsureFn = (m: Record<string, unknown>, formType: string) => Record<string, unknown>;

const FORM_TYPES = ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'] as const;

const ENSURE_FNS: Array<[string, EnsureFn]> = [
  ['residence', ensureAllFieldsPopulated],
  ['office', ensureAllOfficeFieldsPopulated],
  ['business', ensureAllBusinessFieldsPopulated],
  ['builder', ensureAllBuilderFieldsPopulated],
  ['noc', ensureAllNocFieldsPopulated],
  ['dsaConnector', ensureAllDsaConnectorFieldsPopulated],
  ['propertyApf', ensureAllPropertyApfFieldsPopulated],
  ['propertyIndividual', ensureAllPropertyIndividualFieldsPopulated],
  ['residenceCumOffice', ensureAllResidenceCumOfficeFieldsPopulated],
];

beforeEach(() => warn.mockClear());

describe('ensureAll*FieldsPopulated — full field shape per form type', () => {
  for (const [name, fn] of ENSURE_FNS) {
    for (const formType of FORM_TYPES) {
      it(`${name} / ${formType} — empty input yields the canonical field set (all null)`, () => {
        // Snapshot pins exactly which DB columns each type emits + their defaults.
        expect(fn({}, formType)).toMatchSnapshot();
      });
    }

    it(`${name} — unknown formType still returns the canonical field set`, () => {
      // pickRelevantFieldsForFormType falls back to POSITIVE for relevance,
      // but allDatabaseFields is type-fixed, so the OUTPUT key set is stable.
      const out = fn({}, 'NONSENSE_TYPE');
      expect(out).toMatchSnapshot();
    });
  }
});

describe('ensureAll*FieldsPopulated — invariants', () => {
  for (const [name, fn] of ENSURE_FNS) {
    it(`${name} — preserves provided values and does not mutate input`, () => {
      const input = { remarks: 'hello', final_status: 'Positive', locality: 'Andheri' };
      const snapshotOfInput = { ...input };
      const out = fn(input, 'POSITIVE');

      expect(out.remarks).toBe('hello');
      expect(out.final_status).toBe('Positive');
      expect(out.locality).toBe('Andheri');
      // input object is not mutated
      expect(input).toEqual(snapshotOfInput);
      // a new object is returned
      expect(out).not.toBe(input);
    });

    it(`${name} — defaults missing fields to null (MISSING_FIELD_DEFAULT)`, () => {
      const out = fn({}, 'POSITIVE');
      // every emitted key whose value is absent is null, never undefined
      for (const [, v] of Object.entries(out)) {
        expect(v === null || v !== undefined).toBe(true);
      }
      expect(Object.values(out).some(v => v === null)).toBe(true);
    });

    it(`${name} — null and undefined provided values both normalize to null`, () => {
      const out = fn({ locality: null, address_rating: undefined }, 'POSITIVE');
      expect(out.locality).toBeNull();
      expect(out.address_rating).toBeNull();
    });

    it(`${name} — passthrough keys not in the canonical set are retained`, () => {
      const out = fn({ __extra_unknown_key__: 'kept' }, 'POSITIVE');
      expect(out.__extra_unknown_key__).toBe('kept');
    });
  }
});

describe('validateOfficeRequiredFields', () => {
  it('flags all required POSITIVE fields missing on empty input', () => {
    expect(validateOfficeRequiredFields({}, 'POSITIVE')).toMatchSnapshot();
  });

  it('passes when required POSITIVE fields are present', () => {
    const data: Record<string, unknown> = {
      addressLocatable: 'Yes',
      addressRating: 'Good',
      officeStatus: 'Open',
      metPersonName: 'A',
      metPersonDesignation: 'Mgr',
      workingPeriod: '2y',
      applicantDesignation: 'Exec',
      workingStatus: 'Working',
      officeType: 'Pvt',
      companyNatureOfBusiness: 'IT',
      staffStrength: '10',
      locality: 'X',
      addressStructure: 'Building',
      politicalConnection: 'No',
      dominatedArea: 'No',
      feedbackFromNeighbour: 'Good',
      otherObservation: 'None',
      finalStatus: 'Positive',
      staffSeen: 'Yes',
    };
    const res = validateOfficeRequiredFields(data, 'POSITIVE');
    expect(res.isValid).toBe(true);
    expect(res.missingFields).toEqual([]);
  });

  it('emits the staffSeen warning when office Open and staffSeen absent (case-insensitive)', () => {
    const res = validateOfficeRequiredFields({ officeStatus: 'open' }, 'POSITIVE');
    expect(res.warnings).toContain('staffSeen should be specified when office is opened');
  });

  it('unknown formType has no required fields → valid', () => {
    const res = validateOfficeRequiredFields({}, 'NONSENSE');
    expect(res.isValid).toBe(true);
    expect(res.missingFields).toEqual([]);
  });
});

describe('validateBusinessRequiredFields', () => {
  it('flags required fields missing on empty input across form types', () => {
    expect(validateBusinessRequiredFields({}, 'POSITIVE')).toMatchSnapshot();
    expect(validateBusinessRequiredFields({}, 'SHIFTED')).toMatchSnapshot();
    expect(validateBusinessRequiredFields({}, 'NSP')).toMatchSnapshot();
  });

  it('unknown formType → valid with no missing fields', () => {
    const res = validateBusinessRequiredFields({}, 'NONSENSE');
    expect(res.isValid).toBe(true);
    expect(res.missingFields).toEqual([]);
  });
});

describe('comprehensive getters', () => {
  const TYPES = [
    'RESIDENCE',
    'OFFICE',
    'BUSINESS',
    'PROPERTY_APF',
    'PROPERTY_INDIVIDUAL',
    'NOC',
    'BUILDER',
    'DSA_CONNECTOR',
    'RESIDENCE_CUM_OFFICE',
  ];

  it('getFormFieldDefinitions is case-insensitive and returns [] for unknown type', () => {
    expect(getFormFieldDefinitions('residence')).toEqual(getFormFieldDefinitions('RESIDENCE'));
    expect(getFormFieldDefinitions('NOT_A_TYPE')).toEqual([]);
  });

  it('CONNECTOR alias resolves to the DSA_CONNECTOR set', () => {
    expect(getFormFieldDefinitions('CONNECTOR')).toEqual(getFormFieldDefinitions('DSA_CONNECTOR'));
  });

  it("QUIRK: the 'Residence-cum-office' alias is unreachable via this getter", () => {
    // getFormFieldDefinitions uppercases its arg → 'RESIDENCE-CUM-OFFICE'
    // (hyphens), which matches neither the 'RESIDENCE_CUM_OFFICE' key nor the
    // mixed-case 'Residence-cum-office' alias key → returns []. Pinning the
    // ACTUAL behavior; the alias only resolves under the underscore form.
    expect(getFormFieldDefinitions('Residence-cum-office')).toEqual([]);
    expect(getFormFieldDefinitions('RESIDENCE_CUM_OFFICE').length).toBeGreaterThan(0);
  });

  it('formType filtering returns a subset of the unfiltered definitions', () => {
    for (const t of TYPES) {
      const all = getFormFieldDefinitions(t);
      const positive = getFormFieldDefinitions(t, 'POSITIVE');
      expect(positive.length).toBeLessThanOrEqual(all.length);
    }
  });

  it('getFormSections returns the distinct section list per type (snapshot)', () => {
    const sections = Object.fromEntries(TYPES.map(t => [t, getFormSections(t)]));
    expect(sections).toMatchSnapshot();
  });

  it('getFieldsForSection returns order-sorted fields confined to the section', () => {
    for (const t of TYPES) {
      for (const section of getFormSections(t)) {
        const fields = getFieldsForSection(t, section);
        expect(fields.every(f => f.section === section)).toBe(true);
        const orders = fields.map(f => f.order);
        expect(orders).toEqual([...orders].sort((a, b) => a - b));
      }
    }
  });

  it('getFormTypeLabel and getVerificationTableName are stable (snapshot)', () => {
    const labels = Object.fromEntries(
      [...FORM_TYPES, 'UNKNOWN'].map(ft => [ft, getFormTypeLabel(ft)])
    );
    const tables = Object.fromEntries(
      [...TYPES, 'CONNECTOR', 'UNKNOWN'].map(t => [t, getVerificationTableName(t)])
    );
    expect({ labels, tables }).toMatchSnapshot();
  });
});
