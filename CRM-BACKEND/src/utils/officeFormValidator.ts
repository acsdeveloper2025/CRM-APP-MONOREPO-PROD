/**
 * Comprehensive Office Form Validation and Default Handling
 * 
 * This module provides validation and default value handling for all office verification form types.
 * Ensures that every database field has an appropriate value, preventing null/undefined issues.
 */

import { OFFICE_FIELD_MAPPING, ensureAllOfficeFieldsPopulated } from './officeFormFieldMapping';

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
 * Comprehensive validation for office verification forms
 * Validates form data and ensures all database fields are properly populated
 * 
 * @param formData - Raw form data from mobile app
 * @param formType - Type of office form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Validation result with detailed field coverage information
 */
export function validateAndPrepareOfficeForm(
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
    const dbColumn = OFFICE_FIELD_MAPPING[mobileField];
    
    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }
    
    // Use the mapped column name or the original field name if no mapping exists
    const columnName = dbColumn || mobileField;
    mappedData[columnName] = processFieldValue(mobileField, value);
  }
  
  // Ensure all database fields are populated with appropriate defaults
  const preparedData = ensureAllOfficeFieldsPopulated(mappedData, formType);
  
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
 * Gets required fields for a specific office form type
 */
function getRequiredFieldsByFormType(formType: string): string[] {
  const requiredFieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'addressLocatable', 'addressRating', 'officeStatus', 'metPerson',
      'designation', 'workingPeriod', 'applicantDesignation', 'workingStatus',
      'officeType', 'companyNatureOfBusiness', 'staffStrength', 'locality',
      'addressStructure', 'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'SHIFTED': [
      'addressLocatable', 'addressRating', 'officeStatus', 'metPerson',
      'designation', 'currentCompanyName', 'oldOfficeShiftedPeriod', 'locality',
      'addressStructure', 'politicalConnection', 'dominatedArea',
      'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
    ],
    'NSP': [
      'addressLocatable', 'addressRating', 'officeStatus', 'officeExistence',
      'metPerson', 'designation', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'ENTRY_RESTRICTED': [
      'addressLocatable', 'addressRating', 'nameOfMetPerson', 'metPersonType',
      'metPersonConfirmation', 'applicantWorkingStatus', 'locality',
      'addressStructure', 'politicalConnection', 'dominatedArea',
      'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
    ],
    'UNTRACEABLE': [
      'contactPerson', 'callRemark', 'locality', 'landmark1', 'landmark2',
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
    // Office status conditional validation
    if (formData.officeStatus === 'Opened' && !formData.staffSeen) {
      warnings.push('staffSeen should be specified when office status is Opened');
    }
    
    // TPC conditional validation
    if (formData.tpcMetPerson1 && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is selected');
    }
    if (formData.tpcMetPerson1 && formData.nameOfTpc1 && !formData.tpcConfirmation1) {
      warnings.push('tpcConfirmation1 should be specified when TPC person 1 is provided');
    }
    
    // Staff strength validation - Fixed to handle 0 value correctly
    if (formData.staffStrength !== undefined && formData.staffStrength !== null &&
        (formData.staffStrength < 1 || formData.staffStrength > 10000)) {
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
  if (formData.finalStatus === 'Hold' && !formData.holdReason) {
    warnings.push('holdReason should be specified when finalStatus is Hold');
  }
  
  // Company nameplate conditional validation
  if (formData.companyNamePlateStatus === 'Sighted' && !formData.nameOnCompanyBoard) {
    warnings.push('nameOnCompanyBoard should be specified when companyNamePlateStatus is Sighted');
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
    'staffStrength', 'staffSeen', 'officeApproxArea', 'totalEmployees',
    'addressFloor', 'addressStructure'
  ];
  
  if (numericFields.includes(fieldName)) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  // Handle date fields
  const dateFields = ['establishmentPeriod', 'businessPeriod'];
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
export function generateOfficeFieldCoverageReport(
  formData: any, 
  preparedData: Record<string, any>, 
  formType: string
): string {
  const originalFields = Object.keys(formData).length;
  const finalFields = Object.keys(preparedData).length;
  const populatedFields = Object.values(preparedData).filter(v => v !== null && v !== undefined).length;
  const nullFields = Object.values(preparedData).filter(v => v === null).length;
  
  return `
📊 Field Coverage Report for ${formType} Office Verification:
   Original form fields: ${originalFields}
   Final database fields: ${finalFields}
   Populated fields: ${populatedFields}
   Null fields: ${nullFields}
   Coverage: ${Math.round((populatedFields / finalFields) * 100)}%
  `;
}
