/**
 * DSA Connector Form Data Preparation
 *
 * Maps mobile form payload → DB columns and ensures every column is populated
 * (with null defaults via ensureAllDsaConnectorFieldsPopulated). Required-field
 * gating lives in the mobile FormValidationEngine; backend is permissive
 * observability.
 */

import {
  DSA_CONNECTOR_FIELD_MAPPING,
  ensureAllDsaConnectorFieldsPopulated,
} from './dsaConnectorFormFieldMapping';
import { processFormFieldValue } from './formFieldValueProcessor';

// Type-specific numeric fields — coerced to Number when sent by mobile.
// Per-type values per audit-finding-#5 dedup (project_form_field_mapping_drift_audit.md).
const NUMERIC_FIELDS: readonly string[] = [
  'connectorExperience',
  'businessEstablishmentYear',
  'officeArea',
  'monthlyBusinessVolume',
  'annualTurnover',
  'teamSize',
  'subAgentsCount',
  'activePolicies',
  'addressFloor',
  'addressStructure',
];
const DATE_FIELDS: readonly string[] = ['businessEstablishmentYear'];

export interface FormValidationResult {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
  fieldCoverage: {
    totalFields: number;
    populatedFields: number;
    defaultedFields: number;
    coveragePercentage: number;
  };
}

/**
 * Maps mobile DSA Connector form data to database columns and fills defaults.
 *
 * @param formData - Raw form data from mobile app
 * @param formType - Type of DSA Connector form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Prepared DB-shaped data + field-coverage stats
 */
export function validateAndPrepareDsaConnectorForm(
  formData: Record<string, unknown>,
  formType: string
): { validationResult: FormValidationResult; preparedData: Record<string, unknown> } {
  const mappedData: Record<string, unknown> = {};
  for (const [mobileField, value] of Object.entries(formData)) {
    const dbColumn = DSA_CONNECTOR_FIELD_MAPPING[mobileField];
    if (dbColumn === null || dbColumn === undefined) {
      continue;
    }
    mappedData[dbColumn] = processFormFieldValue(mobileField, value, {
      numericFields: NUMERIC_FIELDS,
      dateFields: DATE_FIELDS,
    });
  }

  const preparedData = ensureAllDsaConnectorFieldsPopulated(mappedData, formType);

  const totalFields = Object.keys(preparedData).length;
  const populatedFields = Object.values(preparedData).filter(
    v => v !== null && v !== undefined
  ).length;
  const defaultedFields = Object.values(preparedData).filter(v => v === null).length;
  const coveragePercentage = totalFields ? Math.round((populatedFields / totalFields) * 100) : 0;

  return {
    validationResult: {
      isValid: true,
      missingFields: [],
      warnings: [],
      fieldCoverage: { totalFields, populatedFields, defaultedFields, coveragePercentage },
    },
    preparedData,
  };
}

/**
 * Generates a comprehensive field coverage report for debugging
 */
export function generateDsaConnectorFieldCoverageReport(
  formData: Record<string, unknown>,
  preparedData: Record<string, unknown>,
  formType: string
): string {
  const originalFields = Object.keys(formData).length;
  const finalFields = Object.keys(preparedData).length;
  const populatedFields = Object.values(preparedData).filter(
    v => v !== null && v !== undefined
  ).length;
  const nullFields = Object.values(preparedData).filter(v => v === null).length;

  return `
📊 Field Coverage Report for ${formType} DSA Connector Verification:
   Original form fields: ${originalFields}
   Final database fields: ${finalFields}
   Populated fields: ${populatedFields}
   Null fields: ${nullFields}
   Coverage: ${Math.round((populatedFields / finalFields) * 100)}%
  `;
}
