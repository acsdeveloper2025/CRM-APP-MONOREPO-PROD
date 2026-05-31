/**
 * Characterization of formTypeDetection — the pure outcome→formType engine.
 * Snapshots pin detectFormTypeEnhanced across verification types × outcomes
 * (incl. door-state refinement), the per-type wrappers, the pattern-matching
 * fallback for unknown outcomes, and the indicator/analysis helpers.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  detectFormTypeEnhanced,
  detectFormType,
  detectResidenceFormType,
  detectOfficeFormType,
  detectBusinessFormType,
  detectBuilderFormType,
  detectResidenceCumOfficeFormType,
  detectNocFormType,
  detectPropertyApfFormType,
  detectPropertyIndividualFormType,
  detectDsaConnectorFormType,
  getFormTypeIndicators,
  analyzeFormTypeDetection,
} from '@/utils/formTypeDetection';

const TYPES = [
  'RESIDENCE',
  'OFFICE',
  'BUSINESS',
  'BUILDER',
  'RESIDENCE_CUM_OFFICE',
  'NOC',
  'PROPERTY_APF',
  'PROPERTY_INDIVIDUAL',
  'DSA_CONNECTOR',
];

const DOOR_FIELD: Record<string, string> = {
  RESIDENCE: 'houseStatus',
  OFFICE: 'officeStatus',
  BUSINESS: 'businessStatus',
  BUILDER: 'officeStatus',
  RESIDENCE_CUM_OFFICE: 'resiCumOfficeStatus',
  NOC: 'officeStatus',
  PROPERTY_APF: 'buildingStatus',
  PROPERTY_INDIVIDUAL: 'flatStatus',
  DSA_CONNECTOR: 'officeStatus',
};

const OUTCOMES = ['Positive', 'Shifted', 'NSP', 'Entry Restricted', 'Untraceable', 'Negative'];

describe('detectFormTypeEnhanced — outcome mapping across types', () => {
  for (const type of TYPES) {
    for (const outcome of OUTCOMES) {
      it(`${type} / ${outcome} (door open)`, () => {
        const result = detectFormTypeEnhanced(
          { verificationOutcome: outcome, [DOOR_FIELD[type]]: 'Open' },
          type
        );
        expect(result).toMatchSnapshot();
      });
    }

    it(`${type} / Positive door closed → door-locked refinement`, () => {
      expect(
        detectFormTypeEnhanced({ verificationOutcome: 'Positive', [DOOR_FIELD[type]]: 'Closed' }, type)
      ).toMatchSnapshot();
    });
  }
});

describe('detectFormTypeEnhanced — fields, fallbacks, edge cases', () => {
  it('reads outcome from finalStatus when verificationOutcome absent', () => {
    expect(detectFormTypeEnhanced({ finalStatus: 'Positive' }, 'RESIDENCE')).toMatchSnapshot();
  });

  it('falls back to pattern matching for an unmapped outcome', () => {
    // untraceable-ish pattern: contactPerson + callRemark, no mapped outcome
    expect(
      detectFormTypeEnhanced(
        { contactPerson: 'Neighbour', callRemark: 'Could not locate' },
        'RESIDENCE'
      )
    ).toMatchSnapshot();
  });

  it('handles empty form data', () => {
    expect(detectFormTypeEnhanced({}, 'RESIDENCE')).toMatchSnapshot();
  });

  it('defaults verificationType to RESIDENCE when omitted', () => {
    expect(detectFormTypeEnhanced({ verificationOutcome: 'Positive' })).toMatchSnapshot();
  });
});

describe('per-type wrappers delegate to the engine', () => {
  const wrappers = {
    residence: detectResidenceFormType,
    office: detectOfficeFormType,
    business: detectBusinessFormType,
    builder: detectBuilderFormType,
    rco: detectResidenceCumOfficeFormType,
    noc: detectNocFormType,
    apf: detectPropertyApfFormType,
    pi: detectPropertyIndividualFormType,
    dsa: detectDsaConnectorFormType,
  };
  for (const [name, fn] of Object.entries(wrappers)) {
    it(`${name} wrapper returns a FormTypeResult`, () => {
      const r = fn({ verificationOutcome: 'Positive' });
      expect(typeof r.formType).toBe('string');
      expect(typeof r.confidence).toBe('number');
    });
  }
});

describe('detectFormType + helpers', () => {
  it('detectFormType routes by verification type (NOTE: args are (verificationType, formData) — reversed vs detectFormTypeEnhanced)', () => {
    expect(detectFormType('OFFICE', { verificationOutcome: 'Shifted' })).toMatchSnapshot();
  });

  it('getFormTypeIndicators returns indicators per type and null for unknown', () => {
    for (const t of TYPES) {
      const ind = getFormTypeIndicators(t);
      // some types may legitimately have no indicator table
      if (ind) expect(Array.isArray(ind.positiveIndicators)).toBe(true);
    }
    expect(getFormTypeIndicators('NOT_A_TYPE')).toBeNull();
  });

  it('analyzeFormTypeDetection produces a structured analysis', () => {
    expect(analyzeFormTypeDetection({ verificationOutcome: 'Positive' }, 'RESIDENCE')).toBeTruthy();
  });
});
