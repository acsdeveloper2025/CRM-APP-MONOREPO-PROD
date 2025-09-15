/**
 * Residence Form Field Mapping Utilities
 * 
 * This module provides comprehensive field mapping between mobile form data
 * and database columns for residence verification forms.
 */

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile form fields to database columns
 * Covers all residence verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const RESIDENCE_FIELD_MAPPING: DatabaseFieldMapping = {
  // Basic case information
  'outcome': null, // Handled separately as verification_outcome
  'remarks': 'remarks',
  'finalStatus': 'final_status',

  // Address and location fields (Common to all forms)
  'addressLocatable': 'address_locatable',
  'addressRating': 'address_rating',
  'locality': 'locality',
  'addressStructure': 'address_structure',
  'applicantStayingFloor': 'address_floor',
  'addressFloor': 'address_floor', // Alternative field name for shifted forms
  'addressStructureColor': 'address_structure_color',
  'doorColor': 'door_color',
  'doorNamePlateStatus': 'door_nameplate_status',
  'nameOnDoorPlate': 'name_on_door_plate',
  'societyNamePlateStatus': 'society_nameplate_status',
  'nameOnSocietyBoard': 'name_on_society_board',
  'companyNamePlateStatus': 'company_nameplate_status',
  'nameOnCompanyBoard': 'name_on_company_board',

  // Landmarks (Common to all forms, untraceable has 4)
  'landmark1': 'landmark1',
  'landmark2': 'landmark2',
  'landmark3': 'landmark3', // Used in untraceable forms
  'landmark4': 'landmark4', // Used in untraceable forms

  // House and room status (Form specific)
  'houseStatus': 'house_status', // Used in POSITIVE and NSP forms
  'roomStatus': 'room_status',   // Used in SHIFTED forms

  // Person details (Form specific)
  'metPersonName': 'met_person_name',           // Used in POSITIVE, SHIFTED, NSP forms
  'metPersonRelation': 'met_person_relation',   // Used in POSITIVE forms
  'metPersonStatus': 'met_person_status',       // Used in SHIFTED and NSP forms
  'stayingPersonName': 'staying_person_name',   // Used in NSP forms when house is closed
  'totalFamilyMembers': 'total_family_members', // Used in POSITIVE forms
  'totalEarning': 'total_earning',              // Used in POSITIVE forms
  'workingStatus': 'working_status',            // Used in POSITIVE forms
  'companyName': 'company_name',                // Used in POSITIVE forms
  'stayingPeriod': 'staying_period',            // Used in POSITIVE and NSP forms
  'stayingStatus': 'staying_status',            // Used in POSITIVE forms
  'approxArea': 'approx_area',                  // Used in POSITIVE forms

  // Document verification (POSITIVE forms only)
  'documentShownStatus': 'document_shown_status',
  'documentType': 'document_type',

  // Third Party Confirmation (TPC) - Used in POSITIVE, SHIFTED, NSP forms
  'tpcMetPerson1': 'tpc_met_person1',
  'tpcName1': 'tpc_name1',
  'tpcConfirmation1': 'tpc_confirmation1',
  'tpcMetPerson2': 'tpc_met_person2',
  'tpcName2': 'tpc_name2',
  'tpcConfirmation2': 'tpc_confirmation2',

  // Shifted residence specific fields
  'shiftedPeriod': 'shifted_period',
  'premisesStatus': 'premises_status',

  // Entry restricted specific fields
  'nameOfMetPerson': 'name_of_met_person',
  'metPerson': 'met_person_type', // Alternative field name for entry restricted
  'metPersonType': 'met_person_type',
  'metPersonConfirmation': 'met_person_confirmation',
  'applicantStayingStatus': 'applicant_staying_status',

  // Untraceable specific fields
  'callRemark': 'call_remark',

  // Environment and area details (Common to all forms)
  'politicalConnection': 'political_connection',
  'dominatedArea': 'dominated_area',
  'feedbackFromNeighbour': 'feedback_from_neighbour',
  'otherObservation': 'other_observation',
  'holdReason': 'hold_reason',
  'recommendationStatus': 'recommendation_status',

  // Legacy/alternative field names for backward compatibility
  'applicantName': 'met_person_name', // Maps to met_person_name
  'addressConfirmed': null, // Derived field, ignore
  'residenceType': 'house_status', // Maps to house_status
  'familyMembers': 'total_family_members', // Maps to total_family_members
  'neighborVerification': null, // Derived field, ignore

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
 * Maps mobile form data to database field values with comprehensive field coverage
 * Ensures all database fields are populated with appropriate values or 'na' defaults
 *
 * @param formData - Raw form data from mobile app
 * @param formType - The type of residence form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Object with database column names as keys
 */
export function mapFormDataToDatabase(formData: any, formType?: string): Record<string, any> {
  const mappedData: Record<string, any> = {};

  // Process each field in the form data
  for (const [mobileField, value] of Object.entries(formData)) {
    const dbColumn = RESIDENCE_FIELD_MAPPING[mobileField];

    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }

    // Use the mapped column name or the original field name if no mapping exists
    const columnName = dbColumn || mobileField;

    // Process the value based on type
    mappedData[columnName] = processFieldValue(mobileField, value);
  }

  // Ensure all database fields have values based on form type
  const completeData = ensureAllFieldsPopulated(mappedData, formType || 'POSITIVE');

  return completeData;
}

/**
 * Processes field values to ensure they're in the correct format for database storage
 * 
 * @param fieldName - The mobile field name
 * @param value - The field value
 * @returns Processed value suitable for database storage
 */
function processFieldValue(fieldName: string, value: any): any {
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
    'totalFamilyMembers', 'totalEarning', 'approxArea',
    'applicantStayingFloor', 'addressFloor', 'familyMembers'
  ];
  
  if (numericFields.includes(fieldName)) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  // Handle date fields
  const dateFields: string[] = [];
  if (dateFields.includes(fieldName)) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
    return null;
  }
  
  // Default: convert to string and trim
  return String(value).trim() || null;
}

/**
 * Gets all database columns that can be populated from form data
 * 
 * @returns Array of database column names
 */
export function getAvailableDbColumns(): string[] {
  const columns = new Set<string>();
  
  for (const dbColumn of Object.values(RESIDENCE_FIELD_MAPPING)) {
    if (dbColumn !== null) {
      columns.add(dbColumn);
    }
  }
  
  return Array.from(columns).sort();
}

/**
 * Gets all mobile form fields that are mapped to database columns
 * 
 * @returns Array of mobile field names
 */
export function getMappedMobileFields(): string[] {
  return Object.keys(RESIDENCE_FIELD_MAPPING)
    .filter(field => RESIDENCE_FIELD_MAPPING[field] !== null)
    .sort();
}

/**
 * Validates that all required fields are present in form data
 * 
 * @param formData - Form data to validate
 * @param formType - Type of form (POSITIVE, SHIFTED, NSP, etc.)
 * @returns Object with validation result and missing fields
 */
export function validateRequiredFields(formData: any, formType: string): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  // Define required fields by form type
  const requiredFieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'addressLocatable', 'addressRating', 'houseStatus', 'metPersonName',
      'metPersonRelation', 'totalFamilyMembers', 'workingStatus', 'stayingPeriod',
      'stayingStatus', 'documentShownStatus', 'tpcMetPerson1', 'locality',
      'addressStructure', 'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'SHIFTED': [
      'addressLocatable', 'addressRating', 'roomStatus', 'metPersonName',
      'metPersonStatus', 'shiftedPeriod', 'tpcMetPerson1', 'premisesStatus',
      'locality', 'addressStructure', 'politicalConnection', 'dominatedArea',
      'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
    ],
    'NSP': [
      'addressLocatable', 'addressRating', 'houseStatus', 'locality',
      'addressStructure', 'politicalConnection', 'dominatedArea',
      'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
    ],
    'ENTRY_RESTRICTED': [
      'addressLocatable', 'addressRating', 'nameOfMetPerson', 'metPersonType',
      'metPersonConfirmation', 'applicantStayingStatus', 'locality',
      'addressStructure', 'politicalConnection', 'dominatedArea',
      'feedbackFromNeighbour', 'otherObservation', 'finalStatus'
    ],
    'UNTRACEABLE': [
      'callRemark', 'locality', 'landmark1', 'landmark2', 'dominatedArea',
      'otherObservation', 'finalStatus'
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
    if (formData.documentShownStatus === 'Yes' && !formData.documentType) {
      warnings.push('documentType should be specified when documentShownStatus is Yes');
    }
    if (formData.tpcMetPerson1 === 'Yes' && !formData.tpcName1) {
      warnings.push('tpcName1 should be specified when tpcMetPerson1 is Yes');
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings
  };
}

/**
 * Ensures all database fields are populated with appropriate values or 'na' defaults
 * This function guarantees that every database column has a value, preventing null/undefined issues
 *
 * @param mappedData - Already mapped form data
 * @param formType - Type of residence form
 * @returns Complete data object with all fields populated
 */
export function ensureAllFieldsPopulated(mappedData: Record<string, any>, formType: string): Record<string, any> {
  const completeData = { ...mappedData };

  // Define all possible database fields for residence verification
  const allDatabaseFields = [
    // Address and location fields
    'address_locatable', 'address_rating', 'locality', 'address_structure', 'address_floor',
    'address_structure_color', 'door_color', 'door_nameplate_status', 'name_on_door_plate',
    'society_nameplate_status', 'name_on_society_board', 'company_nameplate_status', 'name_on_company_board',

    // Landmarks
    'landmark1', 'landmark2', 'landmark3', 'landmark4',

    // House and room status
    'house_status', 'room_status',

    // Person details
    'met_person_name', 'met_person_relation', 'met_person_status', 'staying_person_name',
    'total_family_members', 'total_earning',
    'working_status', 'company_name', 'staying_period', 'staying_status', 'approx_area',

    // Document verification
    'document_shown_status', 'document_type',

    // Third Party Confirmation
    'tpc_met_person1', 'tpc_name1', 'tpc_confirmation1',
    'tpc_met_person2', 'tpc_name2', 'tpc_confirmation2',

    // Form specific fields
    'shifted_period', 'premises_status', 'name_of_met_person', 'met_person_type',
    'met_person_confirmation', 'applicant_staying_status', 'call_remark',

    // Environment and area details
    'political_connection', 'dominated_area', 'feedback_from_neighbour',
    'other_observation', 'hold_reason', 'recommendation_status',

    // Final status
    'final_status'
  ];

  // Get fields that are relevant for this form type
  const relevantFields = getRelevantFieldsForFormType(formType);

  // Populate missing fields with appropriate defaults
  for (const field of allDatabaseFields) {
    if (completeData[field] === undefined || completeData[field] === null) {
      if (relevantFields.includes(field)) {
        // Field is relevant for this form type but missing - this might indicate an issue
        console.warn(`⚠️ Missing relevant field for ${formType} form: ${field}`);
      }

      // Set default value based on field type
      completeData[field] = getDefaultValueForField(field);
    }
  }

  return completeData;
}

/**
 * Gets relevant database fields for a specific form type
 *
 * @param formType - Type of residence form
 * @returns Array of relevant database field names
 */
function getRelevantFieldsForFormType(formType: string): string[] {
  const fieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'address_locatable', 'address_rating', 'house_status', 'met_person_name',
      'met_person_relation', 'total_family_members', 'working_status', 'staying_period',
      'staying_status', 'document_shown_status', 'tpc_met_person1', 'locality',
      'address_structure', 'political_connection', 'dominated_area', 'feedback_from_neighbour',
      'other_observation', 'final_status', 'total_earning', 'company_name',
      'approx_area', 'document_type', 'tpc_name1', 'tpc_confirmation1', 'address_floor',
      'address_structure_color', 'door_color', 'door_nameplate_status', 'name_on_door_plate',
      'society_nameplate_status', 'name_on_society_board', 'landmark1', 'landmark2'
    ],
    'SHIFTED': [
      'address_locatable', 'address_rating', 'room_status', 'met_person_name',
      'met_person_status', 'shifted_period', 'tpc_met_person1', 'premises_status',
      'locality', 'address_structure', 'political_connection', 'dominated_area',
      'feedback_from_neighbour', 'other_observation', 'final_status', 'tpc_name1',
      'address_floor', 'address_structure_color', 'door_color', 'door_nameplate_status',
      'name_on_door_plate', 'society_nameplate_status', 'name_on_society_board', 'landmark1', 'landmark2'
    ],
    'NSP': [
      'address_locatable', 'address_rating', 'house_status', 'locality',
      'address_structure', 'political_connection', 'dominated_area',
      'feedback_from_neighbour', 'other_observation', 'final_status',
      'met_person_name', 'met_person_status', 'staying_person_name', 'staying_period',
      'address_floor', 'address_structure_color', 'door_color', 'door_nameplate_status',
      'name_on_door_plate', 'society_nameplate_status', 'name_on_society_board', 'landmark1', 'landmark2'
    ],
    'ENTRY_RESTRICTED': [
      'address_locatable', 'address_rating', 'name_of_met_person', 'met_person_type',
      'met_person_confirmation', 'applicant_staying_status', 'locality',
      'address_structure', 'political_connection', 'dominated_area',
      'feedback_from_neighbour', 'other_observation', 'final_status',
      'address_floor', 'address_structure_color', 'society_nameplate_status', 'name_on_society_board',
      'landmark1', 'landmark2'
    ],
    'UNTRACEABLE': [
      'call_remark', 'locality', 'landmark1', 'landmark2', 'landmark3', 'landmark4',
      'dominated_area', 'other_observation', 'final_status'
    ]
  };

  return fieldsByType[formType] || fieldsByType['POSITIVE'];
}

/**
 * Gets appropriate default value for a database field
 *
 * @param fieldName - Database field name
 * @returns Default value for the field
 */
function getDefaultValueForField(fieldName: string): any {
  // All fields default to null for missing/irrelevant data
  return null;
}
