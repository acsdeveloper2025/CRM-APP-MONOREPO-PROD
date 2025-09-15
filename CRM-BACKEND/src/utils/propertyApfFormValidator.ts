/**
 * Comprehensive Property APF Form Validation and Default Handling
 * 
 * This module provides validation and default value handling for all Property APF verification form types.
 * Ensures that every database field has an appropriate value, preventing null/undefined issues.
 */

import { PROPERTY_APF_FIELD_MAPPING, ensureAllPropertyApfFieldsPopulated } from './propertyApfFormFieldMapping';

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
 * @param formType - Type of Property APF form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Validation result with detailed field coverage information
 */
export function validateAndPreparePropertyApfForm(
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
    const dbColumn = PROPERTY_APF_FIELD_MAPPING[mobileField];
    
    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }
    
    // Use the mapped column name or the original field name if no mapping exists
    const columnName = dbColumn || mobileField;
    mappedData[columnName] = processFieldValue(mobileField, value);
  }
  
  // Ensure all database fields are populated with appropriate defaults
  const preparedData = ensureAllPropertyApfFieldsPopulated(mappedData, formType);
  
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
 * Gets required fields for a specific Property APF form type
 */
function getRequiredFieldsByFormType(formType: string): string[] {
  const requiredFieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'addressLocatable', 'addressRating', 'propertyType', 'propertyStatus',
      'propertyOwnership', 'propertyCondition', 'propertyArea', 'propertyValue',
      'apfStatus', 'apfNumber', 'ownerName', 'occupancyStatus', 'metPersonName',
      'designation', 'locality', 'addressStructure', 'politicalConnection',
      'dominatedArea', 'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
    ],
    'SHIFTED': [
      'addressLocatable', 'addressRating', 'metPersonName', 'designation',
      'shiftedPeriod', 'currentLocation', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'NSP': [
      'addressLocatable', 'addressRating', 'propertyStatus', 'apfStatus',
      'metPersonName', 'designation', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'ENTRY_RESTRICTED': [
      'addressLocatable', 'addressRating', 'nameOfMetPerson', 'metPersonType',
      'metPersonConfirmation', 'locality', 'addressStructure', 'politicalConnection',
      'dominatedArea', 'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
    ],
    'UNTRACEABLE': [
      'callRemark', 'contactPerson', 'locality', 'landmark1', 'landmark2',
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
    // APF validity conditional validation
    if (formData.apfStatus === 'Active' && !formData.apfExpiryDate) {
      warnings.push('apfExpiryDate should be specified when APF status is Active');
    }
    
    // Property value validation
    if (formData.propertyValue && formData.marketValue && formData.propertyValue > formData.marketValue * 1.5) {
      warnings.push('propertyValue seems significantly higher than marketValue');
    }
    
    // Loan amount validation
    if (formData.loanAmount && !formData.bankName) {
      warnings.push('bankName should be specified when loan amount is provided');
    }
    
    // Property age validation
    if (formData.propertyAge && (formData.propertyAge < 0 || formData.propertyAge > 200)) {
      warnings.push('propertyAge should be between 0 and 200 years');
    }
    
    // APF amount validation
    if (formData.apfAmount && formData.propertyValue && formData.apfAmount > formData.propertyValue) {
      warnings.push('apfAmount should not exceed propertyValue');
    }
    
    // TPC conditional validation
    if (formData.tpcMetPerson1 && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is selected');
    }
    
    // Property area validation
    if (formData.propertyArea && (formData.propertyArea < 1 || formData.propertyArea > 100000)) {
      warnings.push('propertyArea should be between 1 and 100000 sq ft');
    }
    
    // Date validation
    if (formData.apfIssueDate && formData.apfExpiryDate) {
      const issueDate = new Date(formData.apfIssueDate);
      const expiryDate = new Date(formData.apfExpiryDate);
      if (expiryDate <= issueDate) {
        warnings.push('apfExpiryDate should be after apfIssueDate');
      }
    }
    
    // Occupancy validation
    if (formData.occupancyStatus === 'Tenant' && !formData.tenantDetails) {
      warnings.push('tenantDetails should be specified when occupancy status is Tenant');
    }
  }
  
  if (formType === 'NSP') {
    // Property status conditional validation
    if (formData.propertyStatus === 'Not Found' && !formData.otherObservation) {
      warnings.push('otherObservation should be specified when property status is Not Found');
    }
  }
  
  // Common validations for all forms
  if (formData.finalStatus === 'Hold' && !formData.holdReason) {
    warnings.push('holdReason should be specified when finalStatus is Hold');
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
    'propertyAge', 'propertyArea', 'propertyValue', 'marketValue', 'apfAmount',
    'loanAmount', 'emiAmount', 'outstandingAmount', 'addressFloor', 'addressStructure'
  ];
  
  if (numericFields.includes(fieldName)) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  // Handle date fields
  const dateFields = ['apfIssueDate', 'apfExpiryDate', 'valuationDate', 'loanApprovalDate'];
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
export function generatePropertyApfFieldCoverageReport(
  formData: any, 
  preparedData: Record<string, any>, 
  formType: string
): string {
  const originalFields = Object.keys(formData).length;
  const finalFields = Object.keys(preparedData).length;
  const populatedFields = Object.values(preparedData).filter(v => v !== null && v !== undefined).length;
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
