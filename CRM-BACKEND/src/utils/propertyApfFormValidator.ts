/**
 * Comprehensive Property APF Form Validation and Default Handling
 *
 * This module provides validation and default value handling for all Property APF verification form types.
 * Ensures that every database field has an appropriate value, preventing null/undefined issues.
 */

import {
  PROPERTY_APF_FIELD_MAPPING,
  ensureAllPropertyApfFieldsPopulated,
} from './propertyApfFormFieldMapping';
import { eqCI } from './caseInsensitiveCompare';
import { processFormFieldValue } from './formFieldValueProcessor';

// Type-specific numeric fields — coerced to Number when sent by mobile.
// Per-type values per audit-finding-#5 dedup (project_form_field_mapping_drift_audit.md).
const NUMERIC_FIELDS: readonly string[] = [
  'propertyAge',
  'propertyArea',
  'propertyValue',
  'marketValue',
  'apfAmount',
  'loanAmount',
  'emiAmount',
  'outstandingAmount',
  'addressFloor',
  'addressStructure',
];
const DATE_FIELDS: readonly string[] = [
  'apfIssueDate',
  'apfExpiryDate',
  'valuationDate',
  'loanApprovalDate',
];

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
 * Comprehensive validation for Property APF verification forms
 * Validates form data and ensures all database fields are properly populated
 *
 * @param formData - Raw form data from mobile app
 * @param formType - Type of Property APF form (POSITIVE, NEGATIVE, ENTRY_RESTRICTED, UNTRACEABLE).
 *                   Enforced by the `chk_property_apf_verification_form_type`
 *                   CHECK constraint in the DB; APF does NOT use NSP or SHIFTED
 *                   (it routes on `constructionActivity` — SEEN → POSITIVE,
 *                   STOP / VACANT → NEGATIVE — per
 *                   feedback_apf_construction_activity_rule.md).
 * @returns Validation result with detailed field coverage information
 */
export function validateAndPreparePropertyApfForm(
  formData: Record<string, unknown>,
  formType: string
): { validationResult: FormValidationResult; preparedData: Record<string, unknown> } {
  const warnings: string[] = [];
  const missingFields: string[] = [];

  // Get required fields for this form type
  const requiredFields = getRequiredFieldsByFormType(formType);

  // Check for missing required fields
  for (const field of requiredFields) {
    if (
      !formData[field] ||
      formData[field] === null ||
      formData[field] === '' ||
      formData[field] === undefined
    ) {
      missingFields.push(field);
    }
  }

  // Check for form-specific conditional validations
  const conditionalWarnings = validateConditionalFields(formData, formType);
  warnings.push(...conditionalWarnings);

  // Map form data to database fields
  const mappedData: Record<string, unknown> = {};
  for (const [mobileField, value] of Object.entries(formData)) {
    const dbColumn = PROPERTY_APF_FIELD_MAPPING[mobileField];

    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }

    // Use the mapped column name or the original field name if no mapping exists
    if (dbColumn === undefined) {
      continue;
    } // Skip unmapped fields
    const columnName = dbColumn;
    mappedData[columnName] = processFormFieldValue(mobileField, value, {
      numericFields: NUMERIC_FIELDS,
      dateFields: DATE_FIELDS,
    });
  }

  // Ensure all database fields are populated with appropriate defaults
  const preparedData = ensureAllPropertyApfFieldsPopulated(mappedData, formType);

  // Calculate field coverage statistics
  const totalFields = Object.keys(preparedData).length;
  const populatedFields = Object.values(preparedData).filter(
    value => value !== null && value !== undefined
  ).length;
  const defaultedFields = Object.values(preparedData).filter(value => value === null).length;
  const coveragePercentage = Math.round((populatedFields / totalFields) * 100);

  const validationResult: FormValidationResult = {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
    fieldCoverage: {
      totalFields,
      populatedFields,
      defaultedFields,
      coveragePercentage,
    },
  };

  return { validationResult, preparedData };
}

/**
 * Gets required fields for a specific Property APF form type
 */
function getRequiredFieldsByFormType(formType: string): string[] {
  const requiredFieldsByType: Record<string, string[]> = {
    POSITIVE: [
      // Aligned with legacyPositivePropertyApfFields unconditional required.
      // Conditional fields (metPerson/designation on SEEN, buildingStatus/
      // activityStopReason on STOP, nameOnBoard on SIGHTED AS) are validated
      // in mobile UI via requiredWhen, not here.
      'addressLocatable',
      'addressRating',
      'constructionActivity',
      'locality',
      'landmark1',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'finalStatus',
    ],
    NEGATIVE: [
      // Property APF NEGATIVE uses the SAME mobile form as POSITIVE —
      // only finalStatus='Negative' switches the routing. Required list
      // matches POSITIVE.
      'addressLocatable',
      'addressRating',
      'constructionActivity',
      'locality',
      'landmark1',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'finalStatus',
    ],
    // NOTE: SHIFTED and NSP entries were removed here on 2026-04-22.
    // Property APF's DB `chk_property_apf_verification_form_type` CHECK
    // constraint permits only POSITIVE / NEGATIVE / ENTRY_RESTRICTED /
    // UNTRACEABLE, so both were unreachable dead code. Per
    // `feedback_apf_construction_activity_rule.md`, APF routes on
    // `constructionActivity` (SEEN → POSITIVE, STOP / VACANT → NEGATIVE),
    // not the NSP / SHIFTED dichotomy used by other verification types.
    ENTRY_RESTRICTED: [
      // Aligned with legacyEntryRestrictedPropertyApfFields.
      'addressLocatable',
      'addressRating',
      'buildingStatus',
      'metPersonType',
      'nameOfMetPerson',
      'metPersonConfirmation',
      'locality',
      'companyNamePlateStatus',
      'landmark1',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'finalStatus',
    ],
    UNTRACEABLE: [
      // Aligned with legacyUntraceablePropertyApfFields — all 4 landmarks required.
      'callRemark',
      'contactPerson',
      'locality',
      'landmark1',
      'landmark2',
      'landmark3',
      'landmark4',
      'dominatedArea',
      'otherObservation',
      'finalStatus',
    ],
  };

  return requiredFieldsByType[formType] || requiredFieldsByType['POSITIVE'];
}

/**
 * Validates conditional fields based on form type and field values
 */
function validateConditionalFields(formData: Record<string, unknown>, formType: string): string[] {
  const warnings: string[] = [];

  // NOTE (C25, 2026-04-20): activity↔finalStatus consistency warning removed.
  // All four finalStatus options (Positive/Negative/Refer/Fraud) are now valid
  // on every Property APF form regardless of constructionActivity. The
  // form_type derivation in the controller still applies.

  if (formType === 'POSITIVE') {
    // APF validity conditional validation
    if (eqCI(formData.apfStatus, 'Active') && !formData.apfExpiryDate) {
      warnings.push('apfExpiryDate should be specified when APF status is Active');
    }

    // Property value validation
    if (
      formData.propertyValue !== undefined &&
      formData.marketValue !== undefined &&
      typeof formData.propertyValue === 'number' &&
      typeof formData.marketValue === 'number' &&
      formData.propertyValue > formData.marketValue * 1.5
    ) {
      warnings.push('propertyValue seems significantly higher than marketValue');
    }

    // Loan amount validation
    if (formData.loanAmount && !formData.bankName) {
      warnings.push('bankName should be specified when loan amount is provided');
    }

    // Property age validation
    // Property age validation
    if (
      formData.propertyAge !== undefined &&
      formData.propertyAge !== null &&
      typeof formData.propertyAge === 'number' &&
      (formData.propertyAge < 0 || formData.propertyAge > 200)
    ) {
      warnings.push('propertyAge should be between 0 and 200 years');
    }

    // APF amount validation
    if (
      formData.apfAmount !== undefined &&
      formData.propertyValue !== undefined &&
      typeof formData.apfAmount === 'number' &&
      typeof formData.propertyValue === 'number' &&
      formData.apfAmount > formData.propertyValue
    ) {
      warnings.push('apfAmount should not exceed propertyValue');
    }

    // TPC conditional validation
    if (formData.tpcMetPerson1 && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is selected');
    }

    // Property area validation
    if (
      formData.propertyArea !== undefined &&
      formData.propertyArea !== null &&
      typeof formData.propertyArea === 'number' &&
      (formData.propertyArea < 1 || formData.propertyArea > 100000)
    ) {
      warnings.push('propertyArea should be between 1 and 100000 sq ft');
    }

    // Date validation
    if (formData.apfIssueDate && formData.apfExpiryDate) {
      const fromDate = new Date(
        String(formData.apfIssueDate as string | number | boolean | null | undefined)
      );
      const toDate = new Date(
        String(formData.apfExpiryDate as string | number | boolean | null | undefined)
      );
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime()) && toDate <= fromDate) {
        warnings.push('apfExpiryDate should be after apfIssueDate');
      }
    }

    // Occupancy validation
    if (eqCI(formData.occupancyStatus, 'Tenant') && !formData.tenantDetails) {
      warnings.push('tenantDetails should be specified when occupancy status is Tenant');
    }
  }

  // NOTE: formType === 'NSP' branch removed on 2026-04-22 — APF's DB
  // CHECK constraint makes NSP unreachable (see getRequiredFieldsByFormType
  // comment for the full rationale).

  // Common validations for all forms

  return warnings;
}

/**
 * Generates a comprehensive field coverage report for debugging
 */
export function generatePropertyApfFieldCoverageReport(
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
📊 Field Coverage Report for ${formType} Property APF Verification:
   Original form fields: ${originalFields}
   Final database fields: ${finalFields}
   Populated fields: ${populatedFields}
   Null fields: ${nullFields}
   Coverage: ${Math.round((populatedFields / finalFields) * 100)}%
  `;
}
