/**
 * Builder Form Field Mapping Utilities
 * 
 * This module provides comprehensive field mapping between mobile builder form data
 * and database columns for builder verification forms.
 */

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile builder form fields to database columns
 * Covers all builder verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const BUILDER_FIELD_MAPPING: DatabaseFieldMapping = {
  // Basic form information
  'outcome': null, // Handled separately as verification_outcome
  'remarks': 'remarks',
  'finalStatus': 'final_status',

  // Address and location fields (Common to all forms)
  'addressLocatable': 'address_locatable',
  'addressRating': 'address_rating',
  'locality': 'locality',
  'addressStructure': 'address_structure',
  'addressFloor': 'address_floor',
  'addressStructureColor': 'address_structure_color',
  'doorColor': 'door_color',
  'companyNamePlateStatus': 'company_nameplate_status',
  'nameOnBoard': 'name_on_company_board',
  'nameOnCompanyBoard': 'name_on_company_board',

  // Landmarks (Common to all forms, untraceable may have more)
  'landmark1': 'landmark1',
  'landmark2': 'landmark2',
  'landmark3': 'landmark3', // Used in untraceable forms
  'landmark4': 'landmark4', // Used in untraceable forms

  // Builder/Office status and details (Form specific)
  'officeStatus': 'office_status',               // Used in POSITIVE, SHIFTED, NSP forms
  'officeExistence': 'office_existence',         // Used in NSP forms
  'builderType': 'builder_type',                 // Used in POSITIVE forms
  'companyNatureOfBusiness': 'company_nature_of_business', // Used in POSITIVE forms
  'businessPeriod': 'business_period',           // Used in POSITIVE forms
  'establishmentPeriod': 'establishment_period', // Used in POSITIVE forms
  'officeApproxArea': 'office_approx_area',      // Used in POSITIVE forms
  'staffStrength': 'staff_strength',             // Used in POSITIVE forms
  'staffSeen': 'staff_seen',                     // Used in POSITIVE forms

  // Builder/Person details (Form specific)
  'metPerson': 'met_person_name',                // Used in POSITIVE, SHIFTED, NSP forms
  'metPersonName': 'met_person_name',            // Alternative field name
  'designation': 'designation',
  'builderName': 'builder_name',
  'builderOwnerName': 'builder_owner_name',
  'workingPeriod': 'working_period',
  'workingStatus': 'working_status',
  
  // Document verification
  'documentShown': 'document_shown',
  
  // Third Party Confirmation (TPC)
  'tpcMetPerson1': 'tpc_met_person1',
  'nameOfTpc1': 'tpc_name1',
  'tpcConfirmation1': 'tpc_confirmation1',
  'tpcMetPerson2': 'tpc_met_person2',
  'nameOfTpc2': 'tpc_name2',
  'tpcConfirmation2': 'tpc_confirmation2',
  
  // Shifted builder specific fields
  'shiftedPeriod': 'shifted_period',
  'oldOfficeShiftedPeriod': 'old_office_shifted_period',
  'currentCompanyName': 'current_company_name',
  'currentCompanyPeriod': 'current_company_period',
  'premisesStatus': 'premises_status',
  
  // Entry restricted specific fields
  'nameOfMetPerson': 'name_of_met_person',
  'metPersonType': 'met_person_type',
  'metPersonConfirmation': 'met_person_confirmation',
  'applicantWorkingStatus': 'applicant_working_status',
  
  // Untraceable specific fields
  'contactPerson': 'contact_person',
  'callRemark': 'call_remark',
  
  // Environment and area details
  'politicalConnection': 'political_connection',
  'dominatedArea': 'dominated_area',
  'feedbackFromNeighbour': 'feedback_from_neighbour',
  'otherObservation': 'other_observation',
  'otherExtraRemark': 'other_extra_remark',
  'holdReason': 'hold_reason',
  'recommendationStatus': 'recommendation_status',
  
  // Legacy/alternative field names
  'companyName': 'company_nature_of_business', // Maps to company nature
  'totalEmployees': 'staff_strength', // Maps to staff strength
  'businessNature': 'company_nature_of_business', // Maps to business nature
  'verificationMethod': null, // Derived field, ignore
  
  // Fields to ignore (UI state, images, etc.)
  'images': null,
  'selfieImages': null,
  'id': null,
  'caseId': null,
  'timestamp': null,
  'isValid': null,
  'errors': null,
};

/**
 * Maps mobile builder form data to database field values with comprehensive field coverage
 * Ensures all database fields are populated with appropriate values or NULL defaults
 *
 * @param formData - Raw form data from mobile app
 * @param formType - The type of builder form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Object with database column names as keys
 */
export function mapBuilderFormDataToDatabase(formData: any, formType?: string): Record<string, any> {
  const mappedData: Record<string, any> = {};

  // Process each field in the form data
  for (const [mobileField, value] of Object.entries(formData)) {
    const dbColumn = BUILDER_FIELD_MAPPING[mobileField];

    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }

    // Use the mapped column name or the original field name if no mapping exists
    const columnName = dbColumn || mobileField;

    // Process the value based on type
    mappedData[columnName] = processBuilderFieldValue(mobileField, value);
  }

  // Ensure all database fields have values based on form type
  const completeData = ensureAllBuilderFieldsPopulated(mappedData, formType || 'POSITIVE');

  return completeData;
}

/**
 * Processes builder field values to ensure they're in the correct format for database storage
 * 
 * @param fieldName - The mobile field name
 * @param value - The field value
 * @returns Processed value suitable for database storage
 */
function processBuilderFieldValue(fieldName: string, value: any): any {
  // Handle null/undefined values
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Handle boolean fields
  if (typeof value === 'boolean') {
    return value;
  }
  
  // Handle enum values - convert to string
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // If it's an enum object, return its string representation
    return String(value);
  }
  
  // Handle numeric fields
  const numericFields = [
    'staffStrength', 'staffSeen', 'officeApproxArea', 'totalEmployees'
  ];
  
  if (numericFields.includes(fieldName)) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  // Default: convert to string and trim
  return String(value).trim() || null;
}

/**
 * Gets all database columns that can be populated from builder form data
 * 
 * @returns Array of database column names
 */
export function getBuilderAvailableDbColumns(): string[] {
  const columns = new Set<string>();
  
  for (const dbColumn of Object.values(BUILDER_FIELD_MAPPING)) {
    if (dbColumn !== null) {
      columns.add(dbColumn);
    }
  }
  
  return Array.from(columns).sort();
}

/**
 * Gets all mobile builder form fields that are mapped to database columns
 * 
 * @returns Array of mobile field names
 */
export function getBuilderMappedMobileFields(): string[] {
  return Object.keys(BUILDER_FIELD_MAPPING)
    .filter(field => BUILDER_FIELD_MAPPING[field] !== null)
    .sort();
}

/**
 * Validates that all required fields are present in builder form data
 * 
 * @param formData - Form data to validate
 * @param formType - Type of form (POSITIVE, SHIFTED, NSP, etc.)
 * @returns Object with validation result and missing fields
 */
export function validateBuilderRequiredFields(formData: any, formType: string): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  // Define required fields by builder form type
  const requiredFieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'addressLocatable', 'addressRating', 'officeStatus', 'metPerson',
      'designation', 'builderType', 'builderName', 'workingPeriod',
      'workingStatus', 'companyNatureOfBusiness', 'businessPeriod', 'staffStrength',
      'locality', 'addressStructure', 'politicalConnection', 'dominatedArea',
      'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
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
  
  const requiredFields = requiredFieldsByType[formType] || [];
  
  // Check for missing required fields
  for (const field of requiredFields) {
    if (!formData[field] || formData[field] === null || formData[field] === '') {
      missingFields.push(field);
    }
  }
  
  // Check for conditional fields
  if (formType === 'POSITIVE') {
    if (formData.officeStatus === 'Opened' && !formData.staffSeen) {
      warnings.push('staffSeen should be specified when office is opened');
    }
    if (formData.tpcMetPerson1 === 'Yes' && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is Yes');
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings
  };
}

/**
 * Ensures all database fields are populated with appropriate values or NULL defaults
 * This function guarantees that every database column has a value, preventing null/undefined issues
 *
 * @param mappedData - Already mapped form data
 * @param formType - Type of builder form
 * @returns Complete data object with all fields populated
 */
export function ensureAllBuilderFieldsPopulated(mappedData: Record<string, any>, formType: string): Record<string, any> {
  const completeData = { ...mappedData };

  // Define all possible database fields for builder verification
  const allDatabaseFields = [
    // Address and location fields
    'address_locatable', 'address_rating', 'locality', 'address_structure', 'address_floor',
    'address_structure_color', 'door_color', 'company_nameplate_status', 'name_on_company_board',

    // Landmarks
    'landmark1', 'landmark2', 'landmark3', 'landmark4',

    // Builder/Office status and details
    'office_status', 'office_existence', 'builder_type', 'company_nature_of_business',
    'business_period', 'establishment_period', 'office_approx_area', 'staff_strength', 'staff_seen',

    // Person details
    'met_person_name', 'designation', 'applicant_designation', 'working_period', 'working_status',
    'applicant_working_premises', 'current_company_name', 'old_office_shifted_period',

    // Project specific fields
    'project_name', 'project_type', 'project_status', 'project_approval_status',
    'project_completion_status', 'project_area', 'total_units', 'sold_units',
    'construction_stage', 'approval_authority', 'rera_registration', 'rera_number',

    // Document verification
    'document_shown', 'document_type', 'license_status', 'license_number',

    // Third Party Confirmation
    'tpc_met_person1', 'name_of_tpc1', 'tpc_confirmation1',
    'tpc_met_person2', 'name_of_tpc2', 'tpc_confirmation2',

    // Entry restricted specific fields
    'name_of_met_person', 'met_person_type', 'met_person_confirmation', 'applicant_working_status',

    // Untraceable specific fields
    'contact_person', 'call_remark',

    // Environment and area details
    'political_connection', 'dominated_area', 'feedback_from_neighbour',
    'other_observation', 'hold_reason', 'recommendation_status',

    // Final status
    'final_status'
  ];

  // Get fields that are relevant for this form type
  const relevantFields = getRelevantBuilderFieldsForFormType(formType);

  // Populate missing fields with appropriate defaults
  for (const field of allDatabaseFields) {
    if (completeData[field] === undefined || completeData[field] === null) {
      if (relevantFields.includes(field)) {
        // Field is relevant for this form type but missing - this might indicate an issue
        console.warn(`⚠️ Missing relevant field for ${formType} builder form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = getDefaultBuilderValueForField(field);
    }
  }

  return completeData;
}

/**
 * Gets relevant database fields for a specific builder form type
 *
 * @param formType - Type of builder form
 * @returns Array of relevant database field names
 */
function getRelevantBuilderFieldsForFormType(formType: string): string[] {
  const fieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'address_locatable', 'address_rating', 'office_status', 'met_person_name',
      'designation', 'working_period', 'applicant_designation', 'working_status',
      'builder_type', 'company_nature_of_business', 'staff_strength', 'locality',
      'address_structure', 'political_connection', 'dominated_area', 'feedback_from_neighbour',
      'other_observation', 'final_status', 'business_period', 'establishment_period',
      'office_approx_area', 'staff_seen', 'document_shown', 'document_type',
      'project_name', 'project_type', 'project_status', 'project_approval_status',
      'project_completion_status', 'project_area', 'total_units', 'sold_units',
      'construction_stage', 'approval_authority', 'rera_registration', 'rera_number',
      'license_status', 'license_number', 'tpc_met_person1', 'name_of_tpc1', 'tpc_confirmation1',
      'address_floor', 'address_structure_color', 'door_color', 'company_nameplate_status',
      'name_on_company_board', 'landmark1', 'landmark2'
    ],
    'SHIFTED': [
      'address_locatable', 'address_rating', 'office_status', 'met_person_name',
      'designation', 'current_company_name', 'old_office_shifted_period', 'locality',
      'address_structure', 'political_connection', 'dominated_area', 'feedback_from_neighbour',
      'other_observation', 'final_status', 'address_floor', 'address_structure_color',
      'door_color', 'company_nameplate_status', 'name_on_company_board', 'landmark1', 'landmark2'
    ],
    'NSP': [
      'address_locatable', 'address_rating', 'office_status', 'office_existence',
      'met_person_name', 'designation', 'locality', 'address_structure',
      'political_connection', 'dominated_area', 'feedback_from_neighbour',
      'other_observation', 'final_status', 'address_floor', 'address_structure_color',
      'door_color', 'company_nameplate_status', 'name_on_company_board', 'landmark1', 'landmark2'
    ],
    'ENTRY_RESTRICTED': [
      'address_locatable', 'address_rating', 'name_of_met_person', 'met_person_type',
      'met_person_confirmation', 'applicant_working_status', 'locality',
      'address_structure', 'political_connection', 'dominated_area',
      'feedback_from_neighbour', 'other_observation', 'final_status',
      'address_floor', 'address_structure_color', 'company_nameplate_status', 'name_on_company_board',
      'landmark1', 'landmark2'
    ],
    'UNTRACEABLE': [
      'contact_person', 'call_remark', 'locality', 'landmark1', 'landmark2', 'landmark3', 'landmark4',
      'dominated_area', 'other_observation', 'final_status'
    ]
  };

  return fieldsByType[formType] || fieldsByType['POSITIVE'];
}

/**
 * Gets appropriate default value for a builder database field
 *
 * @param fieldName - Database field name
 * @returns Default value for the field
 */
function getDefaultBuilderValueForField(fieldName: string): any {
  // All fields default to null for missing/irrelevant data
  return null;
}
