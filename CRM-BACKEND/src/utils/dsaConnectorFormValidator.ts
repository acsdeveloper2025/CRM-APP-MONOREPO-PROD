/**
 * Comprehensive DSA Connector Form Validation and Default Handling
 *
 * This module provides validation and default value handling for all DSA Connector verification form types.
 * Ensures that every database field has an appropriate value, preventing null/undefined issues.
 */

import {
  DSA_CONNECTOR_FIELD_MAPPING,
  ensureAllDsaConnectorFieldsPopulated,
} from './dsaConnectorFormFieldMapping';
import { eqCI } from './caseInsensitiveCompare';
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
 * Comprehensive validation for DSA Connector verification forms
 * Validates form data and ensures all database fields are properly populated
 *
 * @param formData - Raw form data from mobile app
 * @param formType - Type of DSA Connector form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Validation result with detailed field coverage information
 */
export function validateAndPrepareDsaConnectorForm(
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
    const dbColumn = DSA_CONNECTOR_FIELD_MAPPING[mobileField];

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
  const preparedData = ensureAllDsaConnectorFieldsPopulated(mappedData, formType);

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
 * Gets required fields for a specific DSA Connector form type
 */
function getRequiredFieldsByFormType(formType: string): string[] {
  const requiredFieldsByType: Record<string, string[]> = {
    POSITIVE: [
      'addressLocatable',
      'addressRating',
      'officeStatus',
      'businessType',
      'ownershipType',
      'nameOfCompanyOwners',
      'addressStatus',
      'companyNatureOfBusiness',
      'businessPeriod',
      'activeClient',
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
      'otherObservation',
      'finalStatus',
    ],
    SHIFTED: [
      'addressLocatable',
      'addressRating',
      'officeStatus',
      'premisesStatus',
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
      'otherObservation',
      'finalStatus',
    ],
    NSP: [
      // Aligned with legacyNspDsaFields 2026-04-19. Per NSP rule — mobile doesn't
      // capture politicalConnection or feedbackFromNeighbour; dropped from validator.
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
      'addressLocatable',
      'addressRating',
      'metPersonType',
      'nameOfMetPerson',
      'metPersonConfirmation',
      'businessExistStatus',
      'locality',
      'addressStructure',
      'applicantStayingFloor',
      'addressStructureColor',
      'landmark1',
      'landmark2',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'otherObservation',
      'finalStatus',
    ],
    UNTRACEABLE: [
      'callRemark',
      'contactPerson',
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
    // Connector experience validation
    if (
      formData.connectorExperience !== undefined &&
      formData.connectorExperience !== null &&
      typeof formData.connectorExperience === 'number' &&
      (formData.connectorExperience < 0 || formData.connectorExperience > 50)
    ) {
      warnings.push('connectorExperience should be between 0 and 50 years');
    }

    // Business volume validation
    if (
      formData.monthlyBusinessVolume !== undefined &&
      formData.annualTurnover !== undefined &&
      typeof formData.monthlyBusinessVolume === 'number' &&
      typeof formData.annualTurnover === 'number' &&
      formData.monthlyBusinessVolume * 12 > formData.annualTurnover * 1.2
    ) {
      warnings.push('monthly_business_volume seems inconsistent with annual_turnover');
    }

    // Team size validation
    if (
      formData.teamSize !== undefined &&
      formData.subAgentsCount !== undefined &&
      typeof formData.teamSize === 'number' &&
      typeof formData.subAgentsCount === 'number' &&
      formData.subAgentsCount > formData.teamSize
    ) {
      warnings.push('subAgentsCount should not exceed teamSize');
    }

    // Contact validation
    if (typeof formData.contactNumber === 'string' && formData.contactNumber.length !== 10) {
      warnings.push('contactNumber should be 10 digits');
    }

    // Business registration validation
    if (eqCI(formData.businessType, 'Registered') && !formData.businessRegistrationNumber) {
      warnings.push('businessRegistrationNumber should be specified for registered business');
    }

    // Office area validation
    if (
      formData.officeArea !== undefined &&
      formData.officeArea !== null &&
      typeof formData.officeArea === 'number' &&
      (formData.officeArea < 1 || formData.officeArea > 50000)
    ) {
      warnings.push('officeArea should be between 1 and 50000 sq ft');
    }

    // TPC conditional validation
    if (formData.tpcMetPerson1 && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is selected');
    }

    // Training validation
    if (eqCI(formData.certificationStatus, 'Certified') && !formData.trainingCompleted) {
      warnings.push('trainingCompleted should be specified when certification status is Certified');
    }

    // Financial validation
    if (
      formData.outstandingDues !== undefined &&
      formData.creditLimit !== undefined &&
      typeof formData.outstandingDues === 'number' &&
      typeof formData.creditLimit === 'number' &&
      formData.outstandingDues > formData.creditLimit
    ) {
      warnings.push('outstandingDues should not exceed creditLimit');
    }
  }

  if (formType === 'NSP') {
    // Connector status conditional validation
    if (eqCI(formData.connectorStatus, 'Inactive') && !formData.otherObservation) {
      warnings.push('otherObservation should be specified when connector status is Inactive');
    }
  }

  // Common validations for all forms

  return warnings;
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
