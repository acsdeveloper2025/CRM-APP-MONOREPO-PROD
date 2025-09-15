/**
 * Property Individual Form Field Mapping Utilities
 * 
 * This module provides comprehensive field mapping between mobile Property Individual form data
 * and database columns for Property Individual verification forms.
 */

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile Property Individual form fields to database columns
 * Covers all Property Individual verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const PROPERTY_INDIVIDUAL_FIELD_MAPPING: DatabaseFieldMapping = {
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

  // Building and property status fields (from mobile form)
  'buildingStatus': 'property_status', // Map building status to property status
  'flatStatus': 'premises_status', // Map flat status to premises status

  // Landmarks (Common to all forms, untraceable may have more)
  'landmark1': 'landmark1',
  'landmark2': 'landmark2',
  'landmark3': 'landmark3', // Used in untraceable forms
  'landmark4': 'landmark4', // Used in untraceable forms

  // Property-specific fields (Form specific)
  'propertyType': 'property_type',               // Used in POSITIVE forms
  'propertyStatus': 'property_status',           // Used in POSITIVE, NSP forms
  'propertyOwnership': 'property_ownership',     // Used in POSITIVE forms
  'propertyAge': 'property_age',                 // Used in POSITIVE forms
  'propertyCondition': 'property_condition',     // Used in POSITIVE forms
  'propertyArea': 'property_area',               // Used in POSITIVE forms
  'propertyValue': 'property_value',             // Used in POSITIVE forms
  'marketValue': 'market_value',                 // Used in POSITIVE forms
  'constructionType': 'construction_type',       // Used in POSITIVE forms
  
  // Individual owner details
  'ownerName': 'owner_name',
  'ownerRelation': 'owner_relation',
  'ownerAge': 'owner_age',
  'ownerOccupation': 'owner_occupation',
  'ownerIncome': 'owner_income',
  'yearsOfResidence': 'years_of_residence',
  'familyMembers': 'family_members',
  'earningMembers': 'earning_members',
  
  // Property documents
  'propertyDocuments': 'property_documents',
  'documentVerificationStatus': 'document_verification_status',
  'titleClearStatus': 'title_clear_status',
  'mutationStatus': 'mutation_status',
  'taxPaymentStatus': 'tax_payment_status',
  
  // Met person details
  'metPersonName': 'met_person_name',
  'metPersonDesignation': 'met_person_designation',
  'metPersonRelation': 'met_person_relation',
  'metPersonContact': 'met_person_contact',
  'nameOfMetPerson': 'met_person_name', // Entry Restricted form field
  'metPersonConfirmation': 'security_confirmation', // Entry Restricted form field
  
  // Neighbors and locality
  'neighbor1Name': 'neighbor1_name',
  'neighbor1Confirmation': 'neighbor1_confirmation',
  'neighbor2Name': 'neighbor2_name',
  'neighbor2Confirmation': 'neighbor2_confirmation',
  'localityReputation': 'locality_reputation',
  
  // Third Party Confirmation (TPC)
  'tpcMetPerson1': 'tpc_met_person1',
  'nameOfTpc1': 'tpc_name1',
  'tpcConfirmation1': 'tpc_confirmation1',
  'tpcMetPerson2': 'tpc_met_person2',
  'nameOfTpc2': 'tpc_name2',
  'tpcConfirmation2': 'tpc_confirmation2',
  
  // Shifted specific fields
  'shiftedPeriod': 'shifted_period',
  'currentLocation': 'current_location',
  'premisesStatus': 'premises_status',
  'previousOwnerName': 'previous_owner_name',
  
  // Entry restricted specific fields
  'entryRestrictionReason': 'entry_restriction_reason',
  'securityPersonName': 'security_person_name',
  'securityConfirmation': 'security_confirmation',
  
  // Untraceable specific fields
  'contactPerson': 'contact_person',
  'callRemark': 'call_remark',
  
  // Legal and financial
  'legalIssues': 'legal_issues',
  'loanAgainstProperty': 'loan_against_property',
  'bankName': 'bank_name',
  'loanAmount': 'loan_amount',
  'emiAmount': 'emi_amount',
  
  // Utilities and infrastructure
  'electricityConnection': 'electricity_connection',
  'waterConnection': 'water_connection',
  'gasConnection': 'gas_connection',
  'internetConnection': 'internet_connection',
  'roadConnectivity': 'road_connectivity',
  'publicTransport': 'public_transport',
  
  // Area and environment
  'politicalConnection': 'political_connection',
  'dominatedArea': 'dominated_area',
  'feedbackFromNeighbour': 'feedback_from_neighbour',
  'infrastructureStatus': 'infrastructure_status',
  'safetySecurity': 'safety_security',
  
  // Observations and remarks
  'otherObservation': 'other_observation',
  'propertyConcerns': 'property_concerns',
  'verificationChallenges': 'verification_challenges',
  'holdReason': 'hold_reason',
  'recommendationStatus': 'recommendation_status',
  
  // Legacy/alternative field names and mobile app specific fields
  'metPerson': 'met_person_name', // Maps to met person name
  'propertyOwner': 'owner_name', // Maps to owner name
  'propertyOwnerName': 'owner_name', // Maps property owner name to owner name
  'propertyDetails': 'property_type', // Maps to property type
  'neighborFeedback': 'feedback_from_neighbour', // Maps to neighbor feedback
  'verificationMethod': null, // Derived field, ignore
  'relationship': 'met_person_relation', // Maps to met person relation
  'approxArea': 'property_area', // Maps to property area

  // Mobile app specific fields that don't have database equivalents
  'addressExistAt': null, // No database equivalent, ignore
  'doorNamePlateStatus': null, // No database equivalent, ignore
  'nameOnDoorPlate': null, // No database equivalent, ignore
  'societyNamePlateStatus': null, // No database equivalent, ignore
  'nameOnSocietyBoard': null, // No database equivalent, ignore
  
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
 * Maps mobile Property Individual form data to database field values with comprehensive field coverage
 * Ensures all database fields are populated with appropriate values or NULL defaults
 *
 * @param formData - Raw form data from mobile app
 * @param formType - The type of Property Individual form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Object with database column names as keys
 */
export function mapPropertyIndividualFormDataToDatabase(formData: any, formType?: string): Record<string, any> {
  const mappedData: Record<string, any> = {};

  // Process each field in the form data
  for (const [mobileField, value] of Object.entries(formData)) {
    const dbColumn = PROPERTY_INDIVIDUAL_FIELD_MAPPING[mobileField];

    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }

    // Use the mapped column name or the original field name if no mapping exists
    const columnName = dbColumn || mobileField;

    // Process the value based on type
    mappedData[columnName] = processPropertyIndividualFieldValue(mobileField, value);
  }

  // Ensure all database fields have values based on form type
  const completeData = ensureAllPropertyIndividualFieldsPopulated(mappedData, formType || 'POSITIVE');

  return completeData;
}

/**
 * Processes Property Individual field values to ensure they're in the correct format for database storage
 * 
 * @param fieldName - The mobile field name
 * @param value - The field value
 * @returns Processed value suitable for database storage
 */
function processPropertyIndividualFieldValue(fieldName: string, value: any): any {
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
    'propertyAge', 'ownerAge', 'yearsOfResidence', 'familyMembers', 'earningMembers'
  ];
  
  if (numericFields.includes(fieldName)) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  // Handle decimal fields
  const decimalFields = [
    'propertyArea', 'propertyValue', 'marketValue', 'ownerIncome', 'loanAmount', 'emiAmount'
  ];
  
  if (decimalFields.includes(fieldName)) {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  
  // Default: convert to string and trim
  return String(value).trim() || null;
}

/**
 * Gets all database columns that can be populated from Property Individual form data
 * 
 * @returns Array of database column names
 */
export function getPropertyIndividualAvailableDbColumns(): string[] {
  const columns = new Set<string>();
  
  for (const dbColumn of Object.values(PROPERTY_INDIVIDUAL_FIELD_MAPPING)) {
    if (dbColumn !== null) {
      columns.add(dbColumn);
    }
  }
  
  return Array.from(columns).sort();
}

/**
 * Gets all mobile Property Individual form fields that are mapped to database columns
 * 
 * @returns Array of mobile field names
 */
export function getPropertyIndividualMappedMobileFields(): string[] {
  return Object.keys(PROPERTY_INDIVIDUAL_FIELD_MAPPING)
    .filter(field => PROPERTY_INDIVIDUAL_FIELD_MAPPING[field] !== null)
    .sort();
}

/**
 * Validates that all required fields are present in Property Individual form data
 * 
 * @param formData - Form data to validate
 * @param formType - Type of form (POSITIVE, SHIFTED, NSP, etc.)
 * @returns Object with validation result and missing fields
 */
export function validatePropertyIndividualRequiredFields(formData: any, formType: string): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  // Define required fields by Property Individual form type
  const requiredFieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'addressLocatable', 'addressRating', 'propertyType', 'propertyStatus',
      'propertyOwnership', 'ownerName', 'ownerRelation', 'metPersonName',
      'metPersonRelation', 'familyMembers', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'SHIFTED': [
      'addressLocatable', 'addressRating', 'metPersonName', 'metPersonRelation',
      'shiftedPeriod', 'currentLocation', 'previousOwnerName', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'NSP': [
      'addressLocatable', 'addressRating', 'metPersonName', 'metPersonRelation',
      'ownerName', 'propertyType', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'ENTRY_RESTRICTED': [
      'addressLocatable', 'addressRating', 'entryRestrictionReason',
      'securityPersonName', 'securityConfirmation', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
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
    if (formData.propertyOwnership === 'Self Owned' && !formData.propertyDocuments) {
      warnings.push('propertyDocuments should be specified for self-owned property');
    }
    if (formData.loanAgainstProperty === 'Yes' && !formData.bankName) {
      warnings.push('bankName should be specified when loan against property exists');
    }
    if (formData.tpcMetPerson1 === 'Yes' && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is Yes');
    }
    if (formData.familyMembers && !formData.earningMembers) {
      warnings.push('earningMembers should be specified when familyMembers is provided');
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
 * @param formType - Type of Property Individual form
 * @returns Complete data object with all fields populated
 */
export function ensureAllPropertyIndividualFieldsPopulated(mappedData: Record<string, any>, formType: string): Record<string, any> {
  const completeData = { ...mappedData };

  // Define all existing database fields for Property Individual verification (only fields that exist in DB)
  const allDatabaseFields = [
    // Address and location fields
    'address_locatable', 'address_rating', 'locality', 'address_structure', 'address_floor',
    'address_structure_color', 'door_color', 'premises_status',

    // Landmarks
    'landmark1', 'landmark2', 'landmark3', 'landmark4',

    // Property-specific fields
    'property_type', 'property_status', 'property_ownership', 'property_age',
    'property_condition', 'property_area', 'property_value', 'market_value',
    'construction_type', 'property_location', 'property_description',
    'construction_year', 'renovation_year', 'property_amenities',

    // Individual/Personal details
    'individual_name', 'individual_age', 'individual_occupation', 'individual_income',
    'individual_education', 'individual_marital_status', 'family_members',
    'earning_members', 'individual_experience',

    // Employment details
    'employment_type', 'employer_name', 'employment_duration', 'monthly_income',
    'annual_income', 'income_source', 'business_name', 'business_type',
    'business_experience', 'business_income',

    // Financial details
    'bank_name', 'loan_amount', 'emi_amount', 'loan_against_property',

    // Verification details
    'met_person_name', 'met_person_relation', 'met_person_contact', 'met_person_designation',
    'document_verification_status',

    // Third Party Confirmation
    'tpc_met_person1', 'tpc_name1', 'tpc_confirmation1',
    'tpc_met_person2', 'tpc_name2', 'tpc_confirmation2',

    // Form specific fields
    'shifted_period', 'current_location', 'call_remark', 'contact_person',
    'entry_restriction_reason', 'security_person_name', 'security_confirmation',

    // Legal and compliance
    'legal_issues',

    // Environment and area details
    'political_connection', 'dominated_area', 'feedback_from_neighbour',
    'other_observation', 'hold_reason', 'recommendation_status',

    // Owner details
    'owner_name', 'owner_age', 'owner_income', 'owner_occupation', 'owner_relation',
    'previous_owner_name',

    // Infrastructure and utilities
    'infrastructure_status', 'road_connectivity', 'electricity_connection', 'water_connection',
    'gas_connection', 'internet_connection', 'public_transport', 'safety_security',

    // Property documents and status
    'property_documents', 'property_concerns', 'title_clear_status', 'mutation_status',
    'tax_payment_status', 'years_of_residence',

    // Neighbors
    'neighbor1_name', 'neighbor1_confirmation', 'neighbor2_name', 'neighbor2_confirmation',
    'locality_reputation',

    // Verification challenges
    'verification_challenges',

    // Final status
    'final_status'
  ];

  // Get fields that are relevant for this form type
  const relevantFields = getRelevantPropertyIndividualFieldsForFormType(formType);

  // Populate missing fields with appropriate defaults
  for (const field of allDatabaseFields) {
    if (completeData[field] === undefined || completeData[field] === null) {
      if (relevantFields.includes(field)) {
        // Field is relevant for this form type but missing - this might indicate an issue
        console.warn(`⚠️ Missing relevant field for ${formType} Property Individual form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = getDefaultPropertyIndividualValueForField(field);
    }
  }

  return completeData;
}

/**
 * Gets relevant database fields for a specific Property Individual form type
 *
 * @param formType - Type of Property Individual form
 * @returns Array of relevant database field names
 */
function getRelevantPropertyIndividualFieldsForFormType(formType: string): string[] {
  const fieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'address_locatable', 'address_rating', 'property_type', 'property_status',
      'property_ownership', 'property_age', 'property_condition', 'property_area',
      'property_value', 'market_value', 'individual_name', 'individual_age',
      'individual_occupation', 'individual_income', 'family_members', 'earning_members',
      'employment_type', 'employer_name', 'monthly_income', 'bank_name',
      'contact_number', 'met_person_name', 'met_person_relation', 'designation',
      'document_shown', 'document_type', 'locality', 'address_structure',
      'political_connection', 'dominated_area', 'feedback_from_neighbour',
      'other_observation', 'final_status', 'address_floor', 'address_structure_color',
      'door_color', 'landmark1', 'landmark2', 'tpc_met_person1', 'name_of_tpc1',
      'tpc_confirmation1', 'reference1_name', 'reference1_contact', 'premises_status'
    ],
    'SHIFTED': [
      'address_locatable', 'address_rating', 'met_person_name', 'met_person_relation',
      'designation', 'shifted_period', 'current_location', 'locality', 'address_structure',
      'political_connection', 'dominated_area', 'feedback_from_neighbour',
      'other_observation', 'final_status', 'address_floor', 'address_structure_color',
      'door_color', 'landmark1', 'landmark2'
    ],
    'NSP': [
      'address_locatable', 'address_rating', 'property_status', 'met_person_name',
      'met_person_relation', 'designation', 'locality', 'address_structure',
      'political_connection', 'dominated_area', 'feedback_from_neighbour',
      'other_observation', 'final_status', 'address_floor', 'address_structure_color',
      'door_color', 'landmark1', 'landmark2'
    ],
    'ENTRY_RESTRICTED': [
      'address_locatable', 'address_rating', 'name_of_met_person', 'met_person_type',
      'met_person_confirmation', 'locality', 'address_structure', 'political_connection',
      'dominated_area', 'feedback_from_neighbour', 'other_observation', 'final_status',
      'address_floor', 'address_structure_color', 'landmark1', 'landmark2'
    ],
    'UNTRACEABLE': [
      'call_remark', 'contact_person', 'locality', 'landmark1', 'landmark2', 'landmark3', 'landmark4',
      'dominated_area', 'other_observation', 'final_status'
    ]
  };

  return fieldsByType[formType] || fieldsByType['POSITIVE'];
}

/**
 * Gets appropriate default value for a Property Individual database field
 *
 * @param fieldName - Database field name
 * @returns Default value for the field
 */
function getDefaultPropertyIndividualValueForField(fieldName: string): any {
  // All fields default to null for missing/irrelevant data
  return null;
}
