/**
 * Characterization of TemplateReportService.generateTemplateReport — the
 * 3184-line pure template engine. Drives every verification type x outcome
 * so getTemplateKey / getTemplate / mapFormDataToTemplateVariables / variable
 * replacement all execute. Snapshots a COMPACT map (templateUsed or ERR) per
 * combo rather than the large report bodies, plus structural assertions that
 * a found template renders a non-empty report.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { templateReportService } from '@/services/TemplateReportService';
import type { VerificationReportData } from '@/services/TemplateReportService';

const TYPES = [
  'RESIDENCE',
  'OFFICE',
  'BUSINESS',
  'RESIDENCE_CUM_OFFICE',
  'BUILDER',
  'NOC',
  'DSA_CONNECTOR',
  'PROPERTY_APF',
  'PROPERTY_INDIVIDUAL',
];

const OUTCOMES = [
  'Positive & Door Open',
  'Positive & Door Locked',
  'Shifted & Door Open',
  'Shifted & Door Locked',
  'NSP & Door Open',
  'NSP & Door Locked',
  'Entry Restricted',
  'Untraceable',
  'Negative',
];

const caseDetails = {
  caseId: 'C-1',
  customerName: 'Asha Rao',
  address: '12 MG Road, Mumbai',
  applicantType: 'APPLICANT',
};

const formData: Record<string, unknown> = {
  houseStatus: 'Open',
  officeStatus: 'Open',
  businessStatus: 'Open',
  flatStatus: 'Open',
  buildingStatus: 'Open',
  resiCumOfficeStatus: 'Open',
  metPersonName: 'Ramesh',
  metPersonRelation: 'Self',
  stayingPeriod: '2 years',
  locality: 'Andheri',
  finalStatus: 'Positive',
  callRemark: 'No response',
  constructionActivity: 'CONSTRUCTION IS STOP',
};

const run = (verificationType: string, outcome: string) =>
  templateReportService.generateTemplateReport({
    verificationType,
    outcome,
    formData,
    caseDetails,
  } as VerificationReportData);

describe('TemplateReportService.generateTemplateReport', () => {
  it('selects a stable template key (or ERR) for every type x outcome', () => {
    const matrix: Record<string, string> = {};
    for (const t of TYPES) {
      for (const o of OUTCOMES) {
        const r = run(t, o);
        matrix[`${t} | ${o}`] = r.success ? r.metadata?.templateUsed ?? 'OK_NO_META' : 'ERR';
      }
    }
    expect(matrix).toMatchSnapshot();
  });

  it('renders a non-empty report with metadata when a template is found', () => {
    const r = run('RESIDENCE', 'Positive & Door Open');
    expect(r.success).toBe(true);
    expect(typeof r.report).toBe('string');
    expect((r.report as string).length).toBeGreaterThan(50);
    expect(r.metadata?.verificationType).toBe('RESIDENCE');
    expect(r.metadata?.outcome).toBe('Positive & Door Open');
  });

  it('substitutes caseDetails into the report body', () => {
    const r = run('RESIDENCE', 'Positive & Door Open');
    // customerName flows into the {Customer_Name} placeholders
    expect(r.report).toContain('Asha Rao');
  });

  it('returns success:false for a verification type with no templates', () => {
    const r = run('NOT_A_TYPE', 'Positive & Door Open');
    expect(r.success).toBe(false);
    expect(typeof r.error).toBe('string');
  });
});
