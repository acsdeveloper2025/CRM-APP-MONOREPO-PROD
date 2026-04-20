/**
 * Comprehensive Residence-cum-Office Form Validation and Default Handling
 *
 * This module provides validation and default value handling for all residence-cum-office verification form types.
 * Ensures that every database field has an appropriate value, preventing null/undefined issues.
 */

import {
  RESIDENCE_CUM_OFFICE_FIELD_MAPPING,
  ensureAllResidenceCumOfficeFieldsPopulated,
} from './residenceCumOfficeFormFieldMapping';

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
 * Comprehensive validation for residence-cum-office verification forms
 * Validates form data and ensures all database fields are properly populated
 *
 * @param formData - Raw form data from mobile app
 * @param formType - Type of residence-cum-office form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Validation result with detailed field coverage information
 */
export function validateAndPrepareResidenceCumOfficeForm(
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

  // Mirror resiCumOfficeStatus to both house_status AND office_status columns so
  // the template selection logic (which checks either field) works correctly.
  // The shared mapper function `mapFormDataToDatabase` has this same mirroring, but
  // the RCO submit path uses inline mapping here — this block keeps the mirror alive.
  const rcoStatus = formData.resiCumOfficeStatus;
  if (rcoStatus !== undefined && rcoStatus !== null && rcoStatus !== '') {
    mappedData.house_status = String(rcoStatus as string | number);
    mappedData.office_status = String(rcoStatus as string | number);
  }

  for (const [mobileField, value] of Object.entries(formData)) {
    const dbColumn = RESIDENCE_CUM_OFFICE_FIELD_MAPPING[mobileField];

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
  const preparedData = ensureAllResidenceCumOfficeFieldsPopulated(mappedData, formType);

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
 * Gets required fields for a specific residence-cum-office form type
 */
function getRequiredFieldsByFormType(formType: string): string[] {
  const requiredFieldsByType: Record<string, string[]> = {
    POSITIVE: [
      // Required unconditionally by the RCO mobile form (legacyPositiveResiCumOfficeFields).
      // Prior audit (see project_form_audit_status.md) dropped 11 Office-form fields that
      // mobile never captures: houseStatus, officeStatus, metPersonName, metPersonRelation,
      // designation, applicantDesignation, totalFamilyMembers, workingPeriod, workingStatus,
      // officeType, staffStrength. That trim was applied to residenceCumOfficeFormFieldMapping
      // but this validator file was missed — aligned 2026-04-19.
      'addressLocatable',
      'addressRating',
      'resiCumOfficeStatus',
      'residenceSetup',
      'businessSetup',
      'stayingPeriod',
      'stayingStatus',
      'companyNatureOfBusiness',
      'businessPeriod',
      'businessStatus',
      'businessLocation',
      'locality',
      'addressStructure',
      'applicantStayingFloor',
      'addressStructureColor',
      'doorColor',
      'doorNamePlateStatus',
      'societyNamePlateStatus',
      'companyNamePlateStatus',
      'landmark1',
      'landmark2',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'otherObservation',
      'finalStatus',
    ],
    SHIFTED: [
      // Aligned with legacyShiftedResiCumOfficeFields. 2026-04-19: dropped
      // metPersonName/premisesStatus/currentCompanyName/oldOfficeShiftedPeriod
      // (not captured by RCO SHIFTED mobile). resiCumOfficeStatus is always
      // required; metPerson/metPersonStatus are conditional on status=Open.
      'addressLocatable',
      'addressRating',
      'resiCumOfficeStatus',
      'shiftedPeriod',
      'locality',
      'addressStructure',
      'addressFloor',
      'addressStructureColor',
      'doorColor',
      'doorNamePlateStatus',
      'societyNamePlateStatus',
      'landmark1',
      'landmark2',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'otherObservation',
      'finalStatus',
    ],
    NSP: [
      // Aligned with legacyNspResiCumOfficeFields. 2026-04-19: dropped
      // houseStatus/officeStatus (mobile uses resiCumOfficeStatus), officeExistence
      // (not in RCO NSP), metPersonName (mobile uses metPerson). Per standing rule
      // feedback_nsp_no_political_feedback.md: NSP has no politicalConnection or
      // feedbackFromNeighbour.
      'addressTraceable',
      'addressLocatable',
      'addressRating',
      'resiCumOfficeStatus',
      'locality',
      'addressStructure',
      'applicantStayingFloor',
      'addressStructureColor',
      'doorColor',
      'doorNamePlateStatus',
      'societyNamePlateStatus',
      'landmark1',
      'landmark2',
      'dominatedArea',
      'otherObservation',
      'finalStatus',
    ],
    ENTRY_RESTRICTED: [
      'addressLocatable',
      'addressRating',
      'nameOfMetPerson',
      'metPersonType',
      'metPersonConfirmation',
      'applicantStayingStatus',
      'applicantWorkingStatus',
      'locality',
      'addressStructure',
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
    // House status conditional validation
    if (formData.houseStatus === 'Opened' && !formData.totalFamilyMembers) {
      warnings.push('totalFamilyMembers should be specified when house status is Opened');
    }

    // Office status conditional validation
    if (formData.officeStatus === 'Opened' && !formData.staffSeen) {
      warnings.push('staffSeen should be specified when office status is Opened');
    }

    // Document verification conditional validation
    if (formData.documentShownStatus === 'Showed' && !formData.documentType) {
      warnings.push('documentType should be specified when documentShownStatus is Showed');
    }

    // TPC conditional validation
    if (formData.tpcMetPerson1 && !formData.tpcName1) {
      warnings.push('tpcName1 should be specified when tpcMetPerson1 is selected');
    }

    // Family members validation - Fixed to handle 0 value correctly
    if (
      formData.totalFamilyMembers !== undefined &&
      formData.totalFamilyMembers !== null &&
      typeof formData.totalFamilyMembers === 'number' &&
      (formData.totalFamilyMembers < 1 || formData.totalFamilyMembers > 50)
    ) {
      warnings.push('totalFamilyMembers should be between 1 and 50');
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
    // Office existence conditional validation
    if (formData.officeStatus === 'Closed' && !formData.officeExistence) {
      warnings.push('officeExistence should be specified when office status is Closed');
    }
  }

  // Common validations for all forms

  // Nameplate conditional validations
  if (formData.companyNamePlateStatus === 'Sighted' && !formData.nameOnCompanyBoard) {
    warnings.push('nameOnCompanyBoard should be specified when companyNamePlateStatus is Sighted');
  }

  if (formData.doorNamePlateStatus === 'Sighted' && !formData.nameOnDoorPlate) {
    warnings.push('nameOnDoorPlate should be specified when doorNamePlateStatus is Sighted');
  }

  if (formData.societyNamePlateStatus === 'Sighted' && !formData.nameOnSocietyBoard) {
    warnings.push('nameOnSocietyBoard should be specified when societyNamePlateStatus is Sighted');
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
    'totalFamilyMembers',
    'totalEarningMember',
    'approxArea',
    'staffStrength',
    'staffSeen',
    'officeApproxArea',
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
export function generateResidenceCumOfficeFieldCoverageReport(
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
📊 Field Coverage Report for ${formType} Residence-cum-Office Verification:
   Original form fields: ${originalFields}
   Final database fields: ${finalFields}
   Populated fields: ${populatedFields}
   Null fields: ${nullFields}
   Coverage: ${Math.round((populatedFields / finalFields) * 100)}%
  `;
}
