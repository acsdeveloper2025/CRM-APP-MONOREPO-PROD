/**
 * Comprehensive Residence Form Validation and Default Handling
 * 
 * This module provides validation and default value handling for all residence verification form types.
 * Ensures that every database field has an appropriate value, preventing null/undefined issues.
 */

import { RESIDENCE_FIELD_MAPPING, ensureAllFieldsPopulated } from './residenceFormFieldMapping';

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
 * Comprehensive validation for residence verification forms
 * Validates form data and ensures all database fields are properly populated
 * 
 * @param formData - Raw form data from mobile app
 * @param formType - Type of residence form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Validation result with detailed field coverage information
 */
export function validateAndPrepareResidenceForm(
  formData: any, 
  formType: string
): { validationResult: FormValidationResult; preparedData: Record<string, any> } {
  
  const warnings: string[] = [];
  const missingFields: string[] = [];
  
  // Get required fields for this form type
  const requiredFields = getRequiredFieldsByFormType(formType);
  
  // Check for missing required fields
  for (const field of requiredFields) {
    if (!formData[field] || formData[field] === null || formData[field] === '' || formData[field] === undefined) {
      missingFields.push(field);
    }
  }
  
  // Check for form-specific conditional validations
  const conditionalWarnings = validateConditionalFields(formData, formType);
  warnings.push(...conditionalWarnings);
  
  // Map form data to database fields
  const mappedData: Record<string, any> = {};
  for (const [mobileField, value] of Object.entries(formData)) {
    const dbColumn = RESIDENCE_FIELD_MAPPING[mobileField];
    
    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }
    
    // Use the mapped column name or the original field name if no mapping exists
    const columnName = dbColumn || mobileField;
    mappedData[columnName] = processFieldValue(mobileField, value);
  }
  
  // Ensure all database fields are populated with appropriate defaults
  const preparedData = ensureAllFieldsPopulated(mappedData, formType);
  
  // Calculate field coverage statistics
  const totalFields = Object.keys(preparedData).length;
  const populatedFields = Object.values(preparedData).filter(value =>
    value !== null && value !== undefined
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
      coveragePercentage
    }
  };
  
  return { validationResult, preparedData };
}

/**
 * Gets required fields for a specific form type
 */
function getRequiredFieldsByFormType(formType: string): string[] {
  const requiredFieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'addressLocatable', 'addressRating', 'houseStatus', 'metPersonName',
      'metPersonRelation', 'totalFamilyMembers', 'workingStatus', 'stayingPeriod',
      'stayingStatus', 'documentShownStatus', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'SHIFTED': [
      'addressLocatable', 'addressRating', 'roomStatus', 'metPersonName',
      'metPersonStatus', 'shiftedPeriod', 'premisesStatus',
      'locality', 'addressStructure', 'politicalConnection', 'dominatedArea',
      'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
    ],
    'NSP': [
      'addressLocatable', 'addressRating', 'houseStatus', 'locality',
      'addressStructure', 'politicalConnection', 'dominatedArea',
      'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
    ],
    'ENTRY_RESTRICTED': [
      'addressLocatable', 'addressRating', 'nameOfMetPerson', 'metPerson',
      'metPersonConfirmation', 'applicantStayingStatus', 'locality',
      'addressStructure', 'politicalConnection', 'dominatedArea',
      'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
    ],
    'UNTRACEABLE': [
      'callRemark', 'locality', 'landmark1', 'landmark2', 'landmark3', 'landmark4',
      'dominatedArea', 'otherObservation', 'finalStatus'
    ]
  };
  
  return requiredFieldsByType[formType] || requiredFieldsByType['POSITIVE'];
}

/**
 * Validates conditional fields based on form type and field values
 */
function validateConditionalFields(formData: any, formType: string): string[] {
  const warnings: string[] = [];

  if (formType === 'POSITIVE') {
    // Document verification conditional validation
    if (formData.documentShownStatus === 'Showed' && !formData.documentType) {
      warnings.push('documentType should be specified when documentShownStatus is Showed');
    }

    // TPC conditional validation
    if (formData.tpcMetPerson1 && !formData.tpcName1) {
      warnings.push('tpcName1 should be specified when tpcMetPerson1 is selected');
    }
    if (formData.tpcMetPerson1 && formData.tpcName1 && !formData.tpcConfirmation1) {
      warnings.push('tpcConfirmation1 should be specified when TPC person 1 is provided');
    }
    if (formData.tpcMetPerson2 && !formData.tpcName2) {
      warnings.push('tpcName2 should be specified when tpcMetPerson2 is selected');
    }
    if (formData.tpcMetPerson2 && formData.tpcName2 && !formData.tpcConfirmation2) {
      warnings.push('tpcConfirmation2 should be specified when TPC person 2 is provided');
    }

    // Family members validation - Fixed to handle 0 value correctly
    if (formData.totalFamilyMembers !== undefined && formData.totalFamilyMembers !== null &&
        (formData.totalFamilyMembers < 1 || formData.totalFamilyMembers > 50)) {
      warnings.push('totalFamilyMembers should be between 1 and 50');
    }

    // House status conditional validation for POSITIVE forms
    if (formData.houseStatus === 'Opened' && !formData.totalFamilyMembers) {
      warnings.push('totalFamilyMembers should be specified when house status is Opened');
    }

    // Staying status validation
    if (formData.stayingStatus === 'On Rental Basis' && !formData.rentAmount) {
      warnings.push('rentAmount should be specified when staying status is On Rental Basis');
    }
  }

  if (formType === 'SHIFTED') {
    // TPC validation for shifted forms
    if (formData.tpcMetPerson1 && !formData.tpcName1) {
      warnings.push('tpcName1 should be specified when tpcMetPerson1 is selected');
    }
    if (formData.tpcMetPerson1 && formData.tpcName1 && !formData.tpcConfirmation1) {
      warnings.push('tpcConfirmation1 should be specified when TPC person 1 is provided');
    }
  }

  if (formType === 'NSP') {
    // House status conditional validation
    if (formData.houseStatus === 'Closed' && !formData.stayingPersonName) {
      warnings.push('stayingPersonName should be specified when house status is Closed');
    }
    if (formData.houseStatus === 'Opened' && !formData.metPersonName) {
      warnings.push('metPersonName should be specified when house status is Opened');
    }
  }

  if (formType === 'ENTRY_RESTRICTED') {
    // Entry restricted specific validations
    if (formData.metPersonConfirmation === 'Not Confirmed' && !formData.reasonForNonConfirmation) {
      warnings.push('reasonForNonConfirmation should be specified when met person confirmation is Not Confirmed');
    }
  }

  // Common validations for all forms
  if (formData.finalStatus === 'Hold' && !formData.holdReason) {
    warnings.push('holdReason should be specified when finalStatus is Hold');
  }

  // Society nameplate conditional validation
  if (formData.societyNamePlateStatus === 'Sighted' && !formData.nameOnSocietyBoard) {
    warnings.push('nameOnSocietyBoard should be specified when societyNamePlateStatus is Sighted');
  }

  // Door nameplate conditional validation
  if (formData.doorNamePlateStatus === 'Sighted' && !formData.nameOnDoorPlate) {
    warnings.push('nameOnDoorPlate should be specified when doorNamePlateStatus is Sighted');
  }

  return warnings;
}

/**
 * Processes field values based on field type and validation rules
 */
function processFieldValue(fieldName: string, value: any): any {
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
    'totalFamilyMembers', 'totalEarning', 'approxArea',
    'applicantStayingFloor', 'addressFloor', 'familyMembers', 'addressStructure'
  ];

  if (numericFields.includes(fieldName)) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  // Handle date fields
  const dateFields: string[] = [];
  if (dateFields.includes(fieldName)) {
    if (typeof value === 'string' && value.trim() !== '') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : value;
    }
    return null;
  }

  // Default: convert to string and trim, return null if empty
  const trimmedValue = String(value).trim();
  return trimmedValue === '' ? null : trimmedValue;
}

/**
 * Generates a comprehensive field coverage report for debugging
 */
export function generateFieldCoverageReport(
  formData: any,
  preparedData: Record<string, any>,
  formType: string
): string {
  const originalFields = Object.keys(formData).length;
  const finalFields = Object.keys(preparedData).length;
  const populatedFields = Object.values(preparedData).filter(v => v !== null && v !== undefined).length;
  const nullFields = Object.values(preparedData).filter(v => v === null).length;

  return `
📊 Field Coverage Report for ${formType} Residence Verification:
   Original form fields: ${originalFields}
   Final database fields: ${finalFields}
   Populated fields: ${populatedFields}
   Null fields: ${nullFields}
   Coverage: ${Math.round((populatedFields / finalFields) * 100)}%
  `;
}
