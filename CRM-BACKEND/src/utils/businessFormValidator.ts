/**
 * Comprehensive Business Form Validation and Default Handling
 *
 * This module provides validation and default value handling for all business verification form types.
 * Ensures that every database field has an appropriate value, preventing null/undefined issues.
 */

import {
  BUSINESS_FIELD_MAPPING,
  ensureAllBusinessFieldsPopulated,
} from './businessFormFieldMapping';
import { eqCI } from './caseInsensitiveCompare';

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
 * Comprehensive validation for business verification forms
 * Validates form data and ensures all database fields are properly populated
 *
 * @param formData - Raw form data from mobile app
 * @param formType - Type of business form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Validation result with detailed field coverage information
 */
export function validateAndPrepareBusinessForm(
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
    const dbColumn = BUSINESS_FIELD_MAPPING[mobileField];

    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }

    // Use the mapped column name or the original field name if no mapping exists
    if (dbColumn === undefined) {
      continue;
    } // Skip unmapped fields
    const columnName = dbColumn;
    mappedData[columnName] = processFieldValue(mobileField, value);
  }

  // Ensure all database fields are populated with appropriate defaults
  const preparedData = ensureAllBusinessFieldsPopulated(mappedData, formType);

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
 * Gets required fields for a specific business form type
 */
function getRequiredFieldsByFormType(formType: string): string[] {
  const requiredFieldsByType: Record<string, string[]> = {
    POSITIVE: [
      // Aligned with legacyPositiveBusinessFields 2026-04-19.
      // Mobile uses `officeStatus` (aliased to business_status DB column via mapping).
      // Conditional-on-Open fields (metPerson/designation/businessType/nameOfCompanyOwners/
      // ownershipType/addressStatus/officeApproxArea/staffStrength/staffSeen) removed from
      // the unconditional list — they belong in a conditional warning block.
      // `workingPeriod/applicantDesignation/workingStatus` dropped: they're Office fields,
      // not Business Positive fields.
      'addressLocatable',
      'addressRating',
      'officeStatus', // mobile name; maps to business_status
      'companyNatureOfBusiness',
      'businessPeriod',
      'companyNamePlateStatus',
      'documentShown',
      'locality',
      'addressStructure',
      'addressStructureColor',
      'doorColor',
      'landmark1',
      'landmark2',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'finalStatus',
    ],
    SHIFTED: [
      // Aligned with legacyShiftedBusinessFields 2026-04-19.
      // Mobile uses officeStatus (aliases to business_status), premisesStatus,
      // currentCompanyPeriod+oldOfficeShiftedPeriod (not oldBusinessShiftedPeriod).
      // Conditional-on-Open fields (metPerson/designation) and
      // conditional-on-!Vacant (currentCompanyName) removed from unconditional.
      'addressLocatable',
      'addressRating',
      'officeStatus',
      'premisesStatus',
      'currentCompanyPeriod',
      'oldOfficeShiftedPeriod',
      'approxArea',
      'locality',
      'addressStructure',
      'addressStructureColor',
      'doorColor',
      'companyNamePlateStatus',
      'landmark1',
      'landmark2',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'finalStatus',
    ],
    NSP: [
      // Aligned with legacyNspBusinessFields 2026-04-19. Mobile uses
      // businessExistance (typo preserved for compat) and applicantExistance.
      // Per NSP rule — no politicalConnection / feedbackFromNeighbour.
      'addressLocatable',
      'addressRating',
      'officeStatus',
      'businessExistance',
      'applicantExistance',
      'premisesStatus',
      'locality',
      'addressStructure',
      'addressStructureColor',
      'doorColor',
      'companyNamePlateStatus',
      'landmark1',
      'landmark2',
      'dominatedArea',
      'finalStatus',
    ],
    ENTRY_RESTRICTED: [
      // Aligned with legacyEntryRestrictedBusinessFields 2026-04-19.
      // Added businessExistStatus (Business ERT-specific mobile field).
      'addressLocatable',
      'addressRating',
      'nameOfMetPerson',
      'metPersonType',
      'metPersonConfirmation',
      'applicantWorkingStatus',
      'businessExistStatus',
      'locality',
      'addressStructure',
      'addressStructureColor',
      'landmark1',
      'landmark2',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'finalStatus',
    ],
    UNTRACEABLE: [
      'contactPerson',
      'callRemark',
      'locality',
      'landmark1',
      'landmark2',
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

  if (formType === 'POSITIVE') {
    // Business status conditional validation
    if (eqCI(formData.businessStatus, 'Open') && !formData.staffSeen) {
      warnings.push('staffSeen should be specified when business status is Opened');
    }

    // Office area validation
    if (
      formData.officeArea !== undefined &&
      formData.officeArea !== null &&
      typeof formData.officeArea === 'number' &&
      (formData.officeArea < 1 || formData.officeArea > 50000)
    ) {
      warnings.push('Office area should be between 1 and 50000');
    }

    // TPC conditional validation
    if (formData.tpcMetPerson1 && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is selected');
    }
    if (formData.tpcMetPerson1 && formData.nameOfTpc1 && !formData.tpcConfirmation1) {
      warnings.push('tpcConfirmation1 should be specified when TPC person 1 is provided');
    }

    // Staff strength validation - Fixed to handle 0 value correctly
    if (
      formData.staffStrength !== undefined &&
      formData.staffStrength !== null &&
      typeof formData.staffStrength === 'number' &&
      (formData.staffStrength < 1 || formData.staffStrength > 10000)
    ) {
      warnings.push('staffStrength should be between 1 and 10000');
    }
  }

  if (formType === 'NSP') {
    // Business existence conditional validation
    if (eqCI(formData.businessStatus, 'Closed') && !formData.businessExistence) {
      warnings.push('businessExistence should be specified when business status is Closed');
    }
  }

  // Common validations for all forms

  // Company nameplate conditional validation
  if (eqCI(formData.companyNamePlateStatus, 'Sighted') && !formData.nameOnCompanyBoard) {
    warnings.push('nameOnCompanyBoard should be specified when companyNamePlateStatus is Sighted');
  }

  return warnings;
}

/**
 * Processes field values based on field type and validation rules
 */
function processFieldValue(fieldName: string, value: unknown): unknown {
  // Handle null/undefined values
  if (value === null || value === undefined) {
    return null;
  }

  // Handle empty strings
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  // Handle numeric fields
  const numericFields = [
    'staffStrength',
    'staffSeen',
    'businessApproxArea',
    'totalEmployees',
    'addressFloor',
    'addressStructure',
  ];

  if (numericFields.includes(fieldName)) {
    const raw =
      typeof value === 'object' && value !== null && 'value' in (value as Record<string, unknown>)
        ? (value as Record<string, unknown>).value
        : value;
    const num = Number(raw);
    return isNaN(num) ? null : num;
  }

  // Handle date fields (NOT period/duration fields like businessPeriod)
  const dateFields: string[] = [];
  if (dateFields.includes(fieldName)) {
    if (typeof value === 'string' && value.trim() !== '') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : value;
    }
    return null;
  }

  // Handle composite objects (e.g., { value: 3, unit: 'Years' } from mobile dropdowns)
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ('value' in obj && 'unit' in obj) {
      return (
        `${String(obj.value as string | number)} ${String(obj.unit as string | number)}`.trim() ||
        null
      );
    }
  }

  // Default: convert to string and trim, return null if empty
  const trimmedValue = (
    typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : String(value as string | number | boolean | null | undefined)
  ).trim();
  return trimmedValue === '' ? null : trimmedValue;
}

/**
 * Generates a comprehensive field coverage report for debugging
 */
export function generateBusinessFieldCoverageReport(
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
📊 Field Coverage Report for ${formType} Business Verification:
   Original form fields: ${originalFields}
   Final database fields: ${finalFields}
   Populated fields: ${populatedFields}
   Null fields: ${nullFields}
   Coverage: ${Math.round((populatedFields / finalFields) * 100)}%
  `;
}
