/**
 * Comprehensive Property Individual Form Validation and Default Handling
 * 
 * This module provides validation and default value handling for all Property Individual verification form types.
 * Ensures that every database field has an appropriate value, preventing null/undefined issues.
 */

import { PROPERTY_INDIVIDUAL_FIELD_MAPPING, ensureAllPropertyIndividualFieldsPopulated } from './propertyIndividualFormFieldMapping';

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
 * Comprehensive validation for Property Individual verification forms
 * Validates form data and ensures all database fields are properly populated
 * 
 * @param formData - Raw form data from mobile app
 * @param formType - Type of Property Individual form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Validation result with detailed field coverage information
 */
export function validateAndPreparePropertyIndividualForm(
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
    const dbColumn = PROPERTY_INDIVIDUAL_FIELD_MAPPING[mobileField];
    
    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }
    
    // Use the mapped column name or the original field name if no mapping exists
    const columnName = dbColumn || mobileField;
    mappedData[columnName] = processFieldValue(mobileField, value);
  }
  
  // Ensure all database fields are populated with appropriate defaults
  const preparedData = ensureAllPropertyIndividualFieldsPopulated(mappedData, formType);
  
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
 * Gets required fields for a specific Property Individual form type
 */
function getRequiredFieldsByFormType(formType: string): string[] {
  const requiredFieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'addressLocatable', 'addressRating', 'propertyType', 'propertyStatus',
      'individualName', 'individualAge', 'individualOccupation', 'employmentType',
      'monthlyIncome', 'contactNumber', 'metPersonName', 'metPersonRelation',
      'designation', 'locality', 'addressStructure', 'politicalConnection',
      'dominatedArea', 'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
    ],
    'SHIFTED': [
      'addressLocatable', 'addressRating', 'metPersonName', 'metPersonRelation',
      'designation', 'shiftedPeriod', 'currentLocation', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'NSP': [
      'addressLocatable', 'addressRating', 'propertyStatus', 'metPersonName',
      'metPersonRelation', 'designation', 'locality', 'addressStructure',
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
    // Age validation
    if (formData.individualAge && (formData.individualAge < 18 || formData.individualAge > 100)) {
      warnings.push('individualAge should be between 18 and 100 years');
    }
    
    // Income validation
    if (formData.monthlyIncome && formData.annualIncome && formData.monthlyIncome * 12 !== formData.annualIncome) {
      warnings.push('annualIncome should be 12 times monthlyIncome');
    }
    
    // Family members validation
    if (formData.familyMembers && formData.earningMembers && formData.earningMembers > formData.familyMembers) {
      warnings.push('earningMembers should not exceed familyMembers');
    }
    
    // Employment validation
    if (formData.employmentType === 'Salaried' && !formData.employerName) {
      warnings.push('employerName should be specified for salaried individuals');
    }
    
    if (formData.employmentType === 'Business' && !formData.businessName) {
      warnings.push('businessName should be specified for business individuals');
    }
    
    // Property value validation
    if (formData.propertyValue && formData.marketValue && formData.propertyValue > formData.marketValue * 1.5) {
      warnings.push('propertyValue seems significantly higher than marketValue');
    }
    
    // Loan validation
    if (formData.loanAmount && !formData.loanPurpose) {
      warnings.push('loanPurpose should be specified when loan amount is provided');
    }
    
    // Contact validation
    if (formData.contactNumber && formData.contactNumber.length !== 10) {
      warnings.push('contactNumber should be 10 digits');
    }
    
    // TPC conditional validation
    if (formData.tpcMetPerson1 && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is selected');
    }
    
    // Reference validation
    if (formData.reference1Name && !formData.reference1Contact) {
      warnings.push('reference1Contact should be specified when reference1Name is provided');
    }
    
    // Property area validation
    if (formData.propertyArea && (formData.propertyArea < 1 || formData.propertyArea > 100000)) {
      warnings.push('propertyArea should be between 1 and 100000 sq ft');
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
    'individualAge', 'familyMembers', 'earningMembers', 'monthlyIncome', 'annualIncome',
    'propertyAge', 'propertyArea', 'propertyValue', 'marketValue', 'loanAmount',
    'emiAmount', 'addressFloor', 'addressStructure'
  ];
  
  if (numericFields.includes(fieldName)) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  // Handle date fields
  const dateFields = ['constructionYear', 'renovationYear'];
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
export function generatePropertyIndividualFieldCoverageReport(
  formData: any, 
  preparedData: Record<string, any>, 
  formType: string
): string {
  const originalFields = Object.keys(formData).length;
  const finalFields = Object.keys(preparedData).length;
  const populatedFields = Object.values(preparedData).filter(v => v !== null && v !== undefined).length;
  const nullFields = Object.values(preparedData).filter(v => v === null).length;
  
  return `
📊 Field Coverage Report for ${formType} Property Individual Verification:
   Original form fields: ${originalFields}
   Final database fields: ${finalFields}
   Populated fields: ${populatedFields}
   Null fields: ${nullFields}
   Coverage: ${Math.round((populatedFields / finalFields) * 100)}%
  `;
}
