/**
 * Property APF Form Field Mapping Utilities
 * 
 * This module provides comprehensive field mapping between mobile Property APF form data
 * and database columns for Property APF verification forms.
 */

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile Property APF form fields to database columns
 * Covers all Property APF verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const PROPERTY_APF_FIELD_MAPPING: DatabaseFieldMapping = {
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

  // Landmarks (Common to all forms, untraceable may have more)
  'landmark1': 'landmark1',
  'landmark2': 'landmark2',
  'landmark3': 'landmark3', // Used in untraceable forms
  'landmark4': 'landmark4', // Used in untraceable forms

  // Property-specific fields (Form specific)
  'propertyType': 'property_type',               // Used in POSITIVE forms
  'propertyStatus': 'property_status',           // Used in POSITIVE, NSP forms
  'buildingStatus': 'building_status',           // Entry Restricted form field
  'constructionActivity': 'construction_activity', // Construction activity field
  'activityStopReason': 'activity_stop_reason',   // Activity stop reason field
  'propertyOwnership': 'property_ownership',     // Used in POSITIVE forms
  'propertyAge': 'property_age',                 // Used in POSITIVE forms
  'propertyCondition': 'property_condition',     // Used in POSITIVE forms
  'propertyArea': 'property_area',               // Used in POSITIVE forms
  'propertyValue': 'property_value',             // Used in POSITIVE forms
  'marketValue': 'market_value',                 // Used in POSITIVE forms

  // APF-specific fields (Form specific)
  'apfStatus': 'apf_status',                     // Used in POSITIVE, NSP forms
  'apfNumber': 'apf_number',                     // Used in POSITIVE forms
  'apfIssueDate': 'apf_issue_date',              // Used in POSITIVE forms
  'apfExpiryDate': 'apf_expiry_date',            // Used in POSITIVE forms
  'apfIssuingAuthority': 'apf_issuing_authority',
  'apfValidityStatus': 'apf_validity_status',
  'apfAmount': 'apf_amount',
  'apfUtilizedAmount': 'apf_utilized_amount',
  'apfBalanceAmount': 'apf_balance_amount',
  
  // Project details
  'projectName': 'project_name',
  'projectStatus': 'project_status',
  'projectApprovalStatus': 'project_approval_status',
  'projectCompletionPercentage': 'project_completion_percentage',
  'projectCompletionPercent': 'project_completion_percentage', // Alternative field name
  'projectStartedDate': 'project_started_date',
  'projectStartDate': 'project_started_date', // Alternative field name
  'projectCompletionDate': 'project_completion_date',
  'projectEndDate': 'project_completion_date', // Alternative field name
  'totalUnits': 'total_units',
  'totalWing': 'total_wing',
  'totalFlats': 'total_flats',
  'totalBuildingsInProject': 'total_buildings_in_project',
  'totalFlatsInBuilding': 'total_flats_in_building',
  'completedUnits': 'completed_units',
  'soldUnits': 'sold_units',
  'availableUnits': 'available_units',
  'possessionStatus': 'possession_status',
  'staffStrength': 'staff_strength',
  'staffSeen': 'staff_seen',
  
  // Builder/Developer information
  'builderName': 'builder_name',
  'builderContact': 'builder_contact',
  'developerName': 'developer_name',
  'developerContact': 'developer_contact',
  'builderRegistrationNumber': 'builder_registration_number',
  'reraRegistrationNumber': 'rera_registration_number',
  
  // Financial details
  'loanAmount': 'loan_amount',
  'loanPurpose': 'loan_purpose',
  'loanStatus': 'loan_status',
  'bankName': 'bank_name',
  'loanAccountNumber': 'loan_account_number',
  'emiAmount': 'emi_amount',
  
  // Met person details
  'metPersonName': 'met_person_name',
  'metPersonDesignation': 'met_person_designation',
  'metPersonRelation': 'met_person_relation',
  'metPersonContact': 'met_person_contact',
  'nameOfMetPerson': 'name_of_met_person', // Entry Restricted form field
  'metPersonConfirmation': 'met_person_confirmation', // Entry Restricted form field
  'designation': 'designation', // Alternative field name
  
  // Document verification
  'documentShownStatus': 'document_shown_status',
  'documentType': 'document_type',
  'documentVerificationStatus': 'document_verification_status',
  
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
  
  // Entry restricted specific fields
  'entryRestrictionReason': 'entry_restriction_reason',
  'securityPersonName': 'security_person_name',
  'securityConfirmation': 'security_confirmation',
  
  // Untraceable specific fields
  'contactPerson': 'contact_person',
  'callRemark': 'call_remark',
  
  // Legal and compliance
  'legalClearance': 'legal_clearance',
  'titleClearance': 'title_clearance',
  'encumbranceStatus': 'encumbrance_status',
  'litigationStatus': 'litigation_status',
  
  // Area and infrastructure
  'politicalConnection': 'political_connection',
  'dominatedArea': 'dominated_area',
  'feedbackFromNeighbour': 'feedback_from_neighbour',
  'infrastructureStatus': 'infrastructure_status',
  'roadConnectivity': 'road_connectivity',
  
  // Observations and remarks
  'otherObservation': 'other_observation',
  'propertyConcerns': 'property_concerns',
  'financialConcerns': 'financial_concerns',
  'holdReason': 'hold_reason',
  'recommendationStatus': 'recommendation_status',
  
  // Legacy/alternative field names
  'metPerson': 'met_person_name', // Maps to met person name
  'companyName': 'builder_name', // Maps to builder name
  'companyNameBoard': 'company_name_board', // Company name board field
  'nameOnBoard': 'name_on_board', // Name on board field
  'projectDetails': 'project_name', // Maps to project name
  'propertyDetails': 'property_type', // Maps to property type
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
 * Maps mobile Property APF form data to database field values with comprehensive field coverage
 * Ensures all database fields are populated with appropriate values or NULL defaults
 *
 * @param formData - Raw form data from mobile app
 * @param formType - The type of Property APF form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Object with database column names as keys
 */
export function mapPropertyApfFormDataToDatabase(formData: any, formType?: string): Record<string, any> {
  const mappedData: Record<string, any> = {};

  // Process each field in the form data
  for (const [mobileField, value] of Object.entries(formData)) {
    const dbColumn = PROPERTY_APF_FIELD_MAPPING[mobileField];

    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }

    // Use the mapped column name or the original field name if no mapping exists
    const columnName = dbColumn || mobileField;

    // Process the value based on type
    mappedData[columnName] = processPropertyApfFieldValue(mobileField, value);
  }

  // Ensure all database fields have values based on form type
  const completeData = ensureAllPropertyApfFieldsPopulated(mappedData, formType || 'POSITIVE');

  return completeData;
}

/**
 * Processes Property APF field values to ensure they're in the correct format for database storage
 * 
 * @param fieldName - The mobile field name
 * @param value - The field value
 * @returns Processed value suitable for database storage
 */
function processPropertyApfFieldValue(fieldName: string, value: any): any {
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
    'propertyAge', 'projectCompletionPercentage', 'totalUnits', 'completedUnits', 
    'soldUnits', 'availableUnits'
  ];
  
  if (numericFields.includes(fieldName)) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  // Handle decimal fields
  const decimalFields = [
    'propertyArea', 'propertyValue', 'marketValue', 'apfAmount', 'apfUtilizedAmount',
    'apfBalanceAmount', 'loanAmount', 'emiAmount'
  ];
  
  if (decimalFields.includes(fieldName)) {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  
  // Handle date fields
  const dateFields = ['apfIssueDate', 'apfExpiryDate'];
  if (dateFields.includes(fieldName)) {
    if (value && typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    }
    return null;
  }
  
  // Default: convert to string and trim
  return String(value).trim() || null;
}

/**
 * Gets all database columns that can be populated from Property APF form data
 * 
 * @returns Array of database column names
 */
export function getPropertyApfAvailableDbColumns(): string[] {
  const columns = new Set<string>();
  
  for (const dbColumn of Object.values(PROPERTY_APF_FIELD_MAPPING)) {
    if (dbColumn !== null) {
      columns.add(dbColumn);
    }
  }
  
  return Array.from(columns).sort();
}

/**
 * Gets all mobile Property APF form fields that are mapped to database columns
 * 
 * @returns Array of mobile field names
 */
export function getPropertyApfMappedMobileFields(): string[] {
  return Object.keys(PROPERTY_APF_FIELD_MAPPING)
    .filter(field => PROPERTY_APF_FIELD_MAPPING[field] !== null)
    .sort();
}

/**
 * Validates that all required fields are present in Property APF form data
 * 
 * @param formData - Form data to validate
 * @param formType - Type of form (POSITIVE, SHIFTED, NSP, etc.)
 * @returns Object with validation result and missing fields
 */
export function validatePropertyApfRequiredFields(formData: any, formType: string): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  // Define required fields by Property APF form type
  const requiredFieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'addressLocatable', 'addressRating', 'propertyType', 'propertyStatus',
      'metPersonName', 'metPersonDesignation', 'projectName', 'builderName',
      'apfStatus', 'propertyValue', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'SHIFTED': [
      'addressLocatable', 'addressRating', 'metPersonName', 'metPersonDesignation',
      'shiftedPeriod', 'currentLocation', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'NSP': [
      'addressLocatable', 'addressRating', 'metPersonName', 'metPersonDesignation',
      'projectName', 'builderName', 'propertyType', 'locality', 'addressStructure',
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
    if (formData.apfStatus === 'Available' && !formData.apfNumber) {
      warnings.push('apfNumber should be specified when APF is available');
    }
    if (formData.apfStatus === 'Available' && !formData.apfValidityStatus) {
      warnings.push('apfValidityStatus should be specified when APF is available');
    }
    if (formData.tpcMetPerson1 === 'Yes' && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is Yes');
    }
    if (formData.totalUnits && !formData.completedUnits) {
      warnings.push('completedUnits should be specified when totalUnits is provided');
    }
    if (formData.loanAmount && !formData.bankName) {
      warnings.push('bankName should be specified when loanAmount is provided');
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
 * @param formType - Type of Property APF form
 * @returns Complete data object with all fields populated
 */
export function ensureAllPropertyApfFieldsPopulated(mappedData: Record<string, any>, formType: string): Record<string, any> {
  const completeData = { ...mappedData };

  // Define all possible database fields for Property APF verification
  const allDatabaseFields = [
    // Address and location fields
    'address_locatable', 'address_rating', 'locality', 'address_structure', 'address_floor',
    'address_structure_color', 'door_color',

    // Landmarks
    'landmark1', 'landmark2', 'landmark3', 'landmark4',

    // Property-specific fields
    'property_type', 'property_status', 'property_ownership', 'property_age',
    'property_condition', 'property_area', 'property_value', 'market_value',
    'property_location', 'property_description', 'property_usage',
    'construction_year', 'renovation_year', 'property_amenities',

    // APF-specific fields
    'apf_status', 'apf_number', 'apf_issue_date', 'apf_expiry_date',
    'apf_amount', 'apf_premium', 'apf_coverage', 'apf_policy_type',
    'apf_insurer', 'apf_agent', 'apf_renewal_date', 'apf_claim_history',

    // Financial details
    'loan_amount', 'bank_name', 'loan_account_number', 'emi_amount',
    'outstanding_amount', 'loan_tenure', 'interest_rate', 'loan_type',
    'loan_status', 'loan_approval_date', 'loan_disbursement_date',

    // Owner/Occupant details
    'owner_name', 'owner_contact', 'owner_email', 'occupant_name',
    'occupant_relation', 'occupancy_status', 'tenant_details',
    'met_person_name', 'designation', 'met_person_relation',

    // Legal and documentation
    'title_deed_status', 'registration_number', 'survey_number',
    'khata_number', 'property_tax_status', 'electricity_connection',
    'water_connection', 'sewage_connection', 'legal_issues',
    'encumbrance_certificate', 'building_approval', 'occupancy_certificate',

    // Valuation details
    'valuation_date', 'valuer_name', 'valuation_method', 'comparable_properties',
    'depreciation_factor', 'appreciation_potential', 'market_trends',

    // Third Party Confirmation
    'tpc_met_person1', 'name_of_tpc1', 'tpc_confirmation1',
    'tpc_met_person2', 'name_of_tpc2', 'tpc_confirmation2',

    // Form specific fields
    'shifted_period', 'current_location', 'name_of_met_person', 'met_person_type',
    'met_person_confirmation', 'call_remark', 'contact_person',

    // Environment and area details
    'political_connection', 'dominated_area', 'feedback_from_neighbour',
    'other_observation', 'hold_reason', 'recommendation_status',

    // Final status
    'final_status'
  ];

  // Get fields that are relevant for this form type
  const relevantFields = getRelevantPropertyApfFieldsForFormType(formType);

  // Populate missing fields with appropriate defaults
  for (const field of allDatabaseFields) {
    if (completeData[field] === undefined || completeData[field] === null) {
      if (relevantFields.includes(field)) {
        // Field is relevant for this form type but missing - this might indicate an issue
        console.warn(`⚠️ Missing relevant field for ${formType} Property APF form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = getDefaultPropertyApfValueForField(field);
    }
  }

  return completeData;
}

/**
 * Gets relevant database fields for a specific Property APF form type
 *
 * @param formType - Type of Property APF form
 * @returns Array of relevant database field names
 */
function getRelevantPropertyApfFieldsForFormType(formType: string): string[] {
  const fieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'address_locatable', 'address_rating', 'property_type', 'property_status',
      'property_ownership', 'property_age', 'property_condition', 'property_area',
      'property_value', 'market_value', 'apf_status', 'apf_number', 'apf_issue_date',
      'apf_expiry_date', 'apf_amount', 'apf_coverage', 'loan_amount', 'bank_name',
      'owner_name', 'occupant_name', 'occupancy_status', 'met_person_name',
      'designation', 'title_deed_status', 'registration_number', 'property_tax_status',
      'valuation_date', 'valuer_name', 'locality', 'address_structure',
      'political_connection', 'dominated_area', 'feedback_from_neighbour',
      'other_observation', 'final_status', 'address_floor', 'address_structure_color',
      'door_color', 'landmark1', 'landmark2', 'tpc_met_person1', 'name_of_tpc1',
      'tpc_confirmation1', 'electricity_connection', 'water_connection'
    ],
    'SHIFTED': [
      'address_locatable', 'address_rating', 'met_person_name', 'designation',
      'shifted_period', 'current_location', 'locality', 'address_structure',
      'political_connection', 'dominated_area', 'feedback_from_neighbour',
      'other_observation', 'final_status', 'address_floor', 'address_structure_color',
      'door_color', 'landmark1', 'landmark2'
    ],
    'NSP': [
      'address_locatable', 'address_rating', 'property_status', 'apf_status',
      'met_person_name', 'designation', 'locality', 'address_structure',
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
 * Gets appropriate default value for a Property APF database field
 *
 * @param fieldName - Database field name
 * @returns Default value for the field
 */
function getDefaultPropertyApfValueForField(fieldName: string): any {
  // All fields default to null for missing/irrelevant data
  return null;
}
