/**
 * Comprehensive NOC Form Validation and Default Handling
 *
 * This module provides validation and default value handling for all NOC verification form types.
 * Ensures that every database field has an appropriate value, preventing null/undefined issues.
 */

import { NOC_FIELD_MAPPING, ensureAllNocFieldsPopulated } from './nocFormFieldMapping';
import { eqCI } from './caseInsensitiveCompare';
import { processFormFieldValue } from './formFieldValueProcessor';

// Type-specific numeric fields — coerced to Number when sent by mobile.
// Per-type values per audit-finding-#5 dedup (project_form_field_mapping_drift_audit.md).
const NUMERIC_FIELDS: readonly string[] = [
  'totalUnits',
  'completedUnits',
  'projectArea',
  'addressFloor',
  'addressStructure',
];
const DATE_FIELDS: readonly string[] = ['nocIssueDate', 'nocExpiryDate', 'completionDate'];

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
 * Comprehensive validation for NOC verification forms
 * Validates form data and ensures all database fields are properly populated
 *
 * @param formData - Raw form data from mobile app
 * @param formType - Type of NOC form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Validation result with detailed field coverage information
 */
export function validateAndPrepareNocForm(
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
    const dbColumn = NOC_FIELD_MAPPING[mobileField];

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
  const preparedData = ensureAllNocFieldsPopulated(mappedData, formType);

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
 * Gets required fields for a specific NOC form type
 */
function getRequiredFieldsByFormType(formType: string): string[] {
  const requiredFieldsByType: Record<string, string[]> = {
    POSITIVE: [
      // Aligned with legacyPositiveNocFields 2026-04-19. Dropped 11 legacy
      // fields that the mobile NOC Positive form doesn't capture (nocStatus,
      // nocType, nocNumber, nocIssuingAuthority, nocValidityStatus, propertyType,
      // projectName, projectStatus, builderName, metPersonName, metPersonDesignation).
      // Mobile uses `metPerson` (conditional on officeStatus=Open), not metPersonName.
      // Added NOC-specific captured fields: authorisedSignature, nameOnNoc, flatNo
      // are conditional-on-Open — not unconditional.
      'addressLocatable',
      'addressRating',
      'officeStatus',
      'locality',
      'addressStructure',
      'addressStructureColor',
      'landmark1',
      'landmark2',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'otherObservation',
      'finalStatus',
    ],
    SHIFTED: [
      // Aligned with legacyShiftedNocFields 2026-04-19. Dropped metPersonName,
      // metPersonDesignation (mobile uses metPerson conditional on Open), shiftedPeriod,
      // currentLocation (mobile uses currentCompanyName + currentCompanyPeriod/oldOfficeShiftedPeriod).
      'addressLocatable',
      'addressRating',
      'officeStatus',
      'currentCompanyName',
      'currentCompanyPeriod',
      'oldOfficeShiftedPeriod',
      'officeApproxArea',
      'companyNamePlateStatus',
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
    NSP: [
      // Aligned with legacyNspNocFields 2026-04-19. Mobile uses officeStatus,
      // businessExistance (typo preserved), applicantExistance, premisesStatus.
      // No nocStatus/metPersonName/metPersonDesignation in mobile.
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
      // Aligned with legacyEntryRestrictedNocFields 2026-04-19. Mobile uses
      // metPersonType/nameOfMetPerson/metPersonConfirmation — NOT entryRestrictionReason/
      // securityPersonName/securityConfirmation (those are legacy fields not in UI).
      'addressLocatable',
      'addressRating',
      'metPersonType',
      'nameOfMetPerson',
      'metPersonConfirmation',
      'officeStatus',
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
      // Added contactPerson (mobile required but was missing from validator list).
      'contactPerson',
      'callRemark',
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

  if (formType === 'POSITIVE') {
    // NOC validity conditional validation
    if (eqCI(formData.nocValidityStatus, 'Valid') && !formData.nocExpiryDate) {
      warnings.push('nocExpiryDate should be specified when NOC validity status is Valid');
    }

    // NOC number conditional validation
    if (eqCI(formData.nocStatus, 'Available') && !formData.nocNumber) {
      warnings.push('nocNumber should be specified when NOC status is Available');
    }

    // Project validation
    if (eqCI(formData.projectStatus, 'Completed') && !formData.completedUnits) {
      warnings.push('completedUnits should be specified when project status is Completed');
    }

    // Builder license validation
    if (formData.builderName && !formData.builderLicenseNumber) {
      warnings.push('builderLicenseNumber should be specified when builder name is provided');
    }

    // Environmental clearance validation
    if (eqCI(formData.environmentalClearance, 'Required') && !formData.projectApprovalStatus) {
      warnings.push(
        'projectApprovalStatus should be specified when environmental clearance is required'
      );
    }

    // TPC conditional validation
    if (formData.tpcMetPerson1 && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is selected');
    }

    // Units validation
    if (
      formData.totalUnits !== undefined &&
      formData.completedUnits !== undefined &&
      typeof formData.totalUnits === 'number' &&
      typeof formData.completedUnits === 'number' &&
      formData.completedUnits > formData.totalUnits
    ) {
      warnings.push('completedUnits should not exceed totalUnits');
    }

    // Date validation
    if (formData.nocIssueDate && formData.nocExpiryDate) {
      const issueDate = new Date(
        typeof formData.nocIssueDate === 'object' && formData.nocIssueDate !== null
          ? JSON.stringify(formData.nocIssueDate)
          : String(formData.nocIssueDate as string | number | boolean | null | undefined)
      );
      const expiryDate = new Date(
        typeof formData.nocExpiryDate === 'object' && formData.nocExpiryDate !== null
          ? JSON.stringify(formData.nocExpiryDate)
          : String(formData.nocExpiryDate as string | number | boolean | null | undefined)
      );
      if (!isNaN(issueDate.getTime()) && !isNaN(expiryDate.getTime()) && expiryDate <= issueDate) {
        warnings.push('nocExpiryDate should be after nocIssueDate');
      }
    }
  }

  if (formType === 'NSP') {
    // NOC status conditional validation
    if (eqCI(formData.nocStatus, 'Not Available') && !formData.otherObservation) {
      warnings.push('otherObservation should be specified when NOC status is Not Available');
    }
  }

  // Common validations for all forms

  return warnings;
}

/**
 * Generates a comprehensive field coverage report for debugging
 */
export function generateNocFieldCoverageReport(
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
📊 Field Coverage Report for ${formType} NOC Verification:
   Original form fields: ${originalFields}
   Final database fields: ${finalFields}
   Populated fields: ${populatedFields}
   Null fields: ${nullFields}
   Coverage: ${Math.round((populatedFields / finalFields) * 100)}%
  `;
}
