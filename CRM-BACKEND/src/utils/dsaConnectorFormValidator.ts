/**
 * Comprehensive DSA Connector Form Validation and Default Handling
 * 
 * This module provides validation and default value handling for all DSA Connector verification form types.
 * Ensures that every database field has an appropriate value, preventing null/undefined issues.
 */

import { DSA_CONNECTOR_FIELD_MAPPING, ensureAllDsaConnectorFieldsPopulated } from './dsaConnectorFormFieldMapping';

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
    const dbColumn = DSA_CONNECTOR_FIELD_MAPPING[mobileField];
    
    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }
    
    // Use the mapped column name or the original field name if no mapping exists
    const columnName = dbColumn || mobileField;
    mappedData[columnName] = processFieldValue(mobileField, value);
  }
  
  // Ensure all database fields are populated with appropriate defaults
  const preparedData = ensureAllDsaConnectorFieldsPopulated(mappedData, formType);
  
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
 * Gets required fields for a specific DSA Connector form type
 */
function getRequiredFieldsByFormType(formType: string): string[] {
  const requiredFieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'addressLocatable', 'addressRating', 'connectorType', 'connectorCode',
      'connectorName', 'connectorDesignation', 'connectorStatus', 'businessName',
      'businessType', 'officeType', 'contactNumber', 'metPersonName',
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
      'addressLocatable', 'addressRating', 'connectorStatus', 'metPersonName',
      'designation', 'locality', 'addressStructure', 'politicalConnection',
      'dominatedArea', 'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
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
    // Connector experience validation
    if (formData.connectorExperience && (formData.connectorExperience < 0 || formData.connectorExperience > 50)) {
      warnings.push('connectorExperience should be between 0 and 50 years');
    }
    
    // Business volume validation
    if (formData.monthlyBusinessVolume && formData.annualTurnover && formData.monthlyBusinessVolume * 12 > formData.annualTurnover * 1.2) {
      warnings.push('monthlyBusinessVolume seems inconsistent with annualTurnover');
    }
    
    // Team size validation
    if (formData.teamSize && formData.subAgentsCount && formData.subAgentsCount > formData.teamSize) {
      warnings.push('subAgentsCount should not exceed teamSize');
    }
    
    // Contact validation
    if (formData.contactNumber && formData.contactNumber.length !== 10) {
      warnings.push('contactNumber should be 10 digits');
    }
    
    // Business registration validation
    if (formData.businessType === 'Registered' && !formData.businessRegistrationNumber) {
      warnings.push('businessRegistrationNumber should be specified for registered business');
    }
    
    // Office area validation
    if (formData.officeArea && (formData.officeArea < 1 || formData.officeArea > 50000)) {
      warnings.push('officeArea should be between 1 and 50000 sq ft');
    }
    
    // TPC conditional validation
    if (formData.tpcMetPerson1 && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is selected');
    }
    
    // Training validation
    if (formData.certificationStatus === 'Certified' && !formData.trainingCompleted) {
      warnings.push('trainingCompleted should be specified when certification status is Certified');
    }
    
    // Financial validation
    if (formData.outstandingDues && formData.creditLimit && formData.outstandingDues > formData.creditLimit) {
      warnings.push('outstandingDues should not exceed creditLimit');
    }
  }
  
  if (formType === 'NSP') {
    // Connector status conditional validation
    if (formData.connectorStatus === 'Inactive' && !formData.otherObservation) {
      warnings.push('otherObservation should be specified when connector status is Inactive');
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
    'connectorExperience', 'businessEstablishmentYear', 'officeArea', 'monthlyBusinessVolume',
    'annualTurnover', 'teamSize', 'subAgentsCount', 'activePolicies', 'addressFloor', 'addressStructure'
  ];
  
  if (numericFields.includes(fieldName)) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  // Handle date fields
  const dateFields = ['businessEstablishmentYear'];
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
export function generateDsaConnectorFieldCoverageReport(
  formData: any, 
  preparedData: Record<string, any>, 
  formType: string
): string {
  const originalFields = Object.keys(formData).length;
  const finalFields = Object.keys(preparedData).length;
  const populatedFields = Object.values(preparedData).filter(v => v !== null && v !== undefined).length;
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
