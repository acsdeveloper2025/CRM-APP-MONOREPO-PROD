/**
 * DSA/DST Connector Form Field Mapping Utilities
 * 
 * This module provides comprehensive field mapping between mobile DSA/DST Connector form data
 * and database columns for DSA/DST Connector verification forms.
 */

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile DSA/DST Connector form fields to database columns
 * Covers all DSA Connector verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const DSA_CONNECTOR_FIELD_MAPPING: DatabaseFieldMapping = {
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

  // DSA/DST Connector specific fields (Form specific)
  'connectorType': 'connector_type',                 // Used in POSITIVE forms
  'connectorCode': 'connector_code',                 // Used in POSITIVE forms
  'connectorName': 'connector_name',                 // Used in POSITIVE forms
  'connectorDesignation': 'connector_designation',   // Used in POSITIVE forms
  'connectorExperience': 'connector_experience',     // Used in POSITIVE forms
  'connectorStatus': 'connector_status',             // Used in POSITIVE, NSP forms

  // Business/Office details (Form specific)
  'businessName': 'business_name',                   // Used in POSITIVE forms
  'businessType': 'business_type',                   // Used in POSITIVE forms
  'businessRegistrationNumber': 'business_registration_number', // Used in POSITIVE forms
  'businessEstablishmentYear': 'business_establishment_year',   // Used in POSITIVE forms
  'officeType': 'office_type',                       // Used in POSITIVE forms
  'officeArea': 'office_area',                       // Used in POSITIVE forms
  'officeRent': 'office_rent',
  
  // Team and staff details
  'totalStaff': 'total_staff',
  'salesStaff': 'sales_staff',
  'supportStaff': 'support_staff',
  'teamSize': 'team_size',
  'monthlyBusinessVolume': 'monthly_business_volume',
  'averageMonthlySales': 'average_monthly_sales',
  
  // Financial details
  'annualTurnover': 'annual_turnover',
  'monthlyIncome': 'monthly_income',
  'commissionStructure': 'commission_structure',
  'paymentTerms': 'payment_terms',
  'bankAccountDetails': 'bank_account_details',
  
  // Technology and infrastructure
  'computerSystems': 'computer_systems',
  'internetConnection': 'internet_connection',
  'softwareSystems': 'software_systems',
  'posTerminals': 'pos_terminals',
  'printerScanner': 'printer_scanner',
  
  // Compliance and documentation
  'licenseStatus': 'license_status',
  'licenseNumber': 'license_number',
  'licenseExpiryDate': 'license_expiry_date',
  'complianceStatus': 'compliance_status',
  'auditStatus': 'audit_status',
  'trainingStatus': 'training_status',
  
  // Met person details
  'metPersonName': 'met_person_name',
  'metPersonDesignation': 'met_person_designation',
  'metPersonRelation': 'met_person_relation',
  'metPersonContact': 'met_person_contact',
  
  // Business verification
  'businessOperational': 'business_operational',
  'customerFootfall': 'customer_footfall',
  'businessHours': 'business_hours',
  'weekendOperations': 'weekend_operations',
  
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
  'previousBusinessName': 'previous_business_name',
  
  // Entry restricted specific fields
  'entryRestrictionReason': 'entry_restriction_reason',
  'securityPersonName': 'security_person_name',
  'securityConfirmation': 'security_confirmation',
  
  // Untraceable specific fields
  'contactPerson': 'contact_person',
  'callRemark': 'call_remark',
  
  // Market and competition
  'marketPresence': 'market_presence',
  'competitorAnalysis': 'competitor_analysis',
  'marketReputation': 'market_reputation',
  'customerFeedback': 'customer_feedback',
  
  // Area and environment
  'politicalConnection': 'political_connection',
  'dominatedArea': 'dominated_area',
  'feedbackFromNeighbour': 'feedback_from_neighbour',
  'infrastructureStatus': 'infrastructure_status',
  'commercialViability': 'commercial_viability',
  
  // Observations and remarks
  'otherObservation': 'other_observation',
  'businessConcerns': 'business_concerns',
  'operationalChallenges': 'operational_challenges',
  'growthPotential': 'growth_potential',
  'holdReason': 'hold_reason',
  'recommendationStatus': 'recommendation_status',
  'riskAssessment': 'risk_assessment',
  
  // Legacy/alternative field names
  'metPerson': 'met_person_name', // Maps to met person name
  'companyName': 'business_name', // Maps to business name
  'agentName': 'connector_name', // Maps to connector name
  'agentCode': 'connector_code', // Maps to connector code
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
 * Maps mobile DSA/DST Connector form data to database field values with comprehensive field coverage
 * Ensures all database fields are populated with appropriate values or NULL defaults
 *
 * @param formData - Raw form data from mobile app
 * @param formType - The type of DSA Connector form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Object with database column names as keys
 */
export function mapDsaConnectorFormDataToDatabase(formData: any, formType?: string): Record<string, any> {
  const mappedData: Record<string, any> = {};

  // Process each field in the form data
  for (const [mobileField, value] of Object.entries(formData)) {
    const dbColumn = DSA_CONNECTOR_FIELD_MAPPING[mobileField];

    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }

    // Use the mapped column name or the original field name if no mapping exists
    const columnName = dbColumn || mobileField;

    // Process the value based on type
    mappedData[columnName] = processDsaConnectorFieldValue(mobileField, value);
  }

  // Ensure all database fields have values based on form type
  const completeData = ensureAllDsaConnectorFieldsPopulated(mappedData, formType || 'POSITIVE');

  return completeData;
}

/**
 * Processes DSA/DST Connector field values to ensure they're in the correct format for database storage
 * 
 * @param fieldName - The mobile field name
 * @param value - The field value
 * @returns Processed value suitable for database storage
 */
function processDsaConnectorFieldValue(fieldName: string, value: any): any {
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
    'connectorExperience', 'businessEstablishmentYear', 'totalStaff', 'salesStaff', 
    'supportStaff', 'teamSize', 'computerSystems', 'posTerminals'
  ];
  
  if (numericFields.includes(fieldName)) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  
  // Handle decimal fields
  const decimalFields = [
    'officeArea', 'officeRent', 'monthlyBusinessVolume', 'averageMonthlySales',
    'annualTurnover', 'monthlyIncome'
  ];
  
  if (decimalFields.includes(fieldName)) {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  
  // Handle date fields
  const dateFields = ['licenseExpiryDate'];
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
 * Gets all database columns that can be populated from DSA/DST Connector form data
 * 
 * @returns Array of database column names
 */
export function getDsaConnectorAvailableDbColumns(): string[] {
  const columns = new Set<string>();
  
  for (const dbColumn of Object.values(DSA_CONNECTOR_FIELD_MAPPING)) {
    if (dbColumn !== null) {
      columns.add(dbColumn);
    }
  }
  
  return Array.from(columns).sort();
}

/**
 * Gets all mobile DSA/DST Connector form fields that are mapped to database columns
 * 
 * @returns Array of mobile field names
 */
export function getDsaConnectorMappedMobileFields(): string[] {
  return Object.keys(DSA_CONNECTOR_FIELD_MAPPING)
    .filter(field => DSA_CONNECTOR_FIELD_MAPPING[field] !== null)
    .sort();
}

/**
 * Validates that all required fields are present in DSA/DST Connector form data
 * 
 * @param formData - Form data to validate
 * @param formType - Type of form (POSITIVE, SHIFTED, NSP, etc.)
 * @returns Object with validation result and missing fields
 */
export function validateDsaConnectorRequiredFields(formData: any, formType: string): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  // Define required fields by DSA/DST Connector form type
  const requiredFieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'addressLocatable', 'addressRating', 'connectorType', 'connectorName',
      'connectorCode', 'businessName', 'businessType', 'metPersonName',
      'metPersonDesignation', 'businessOperational', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'SHIFTED': [
      'addressLocatable', 'addressRating', 'metPersonName', 'metPersonDesignation',
      'shiftedPeriod', 'currentLocation', 'previousBusinessName', 'locality', 'addressStructure',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour',
      'otherObservation', 'finalStatus'
    ],
    'NSP': [
      'addressLocatable', 'addressRating', 'metPersonName', 'metPersonDesignation',
      'connectorName', 'businessName', 'locality', 'addressStructure',
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
    if (formData.connectorType === 'DSA' && !formData.connectorCode) {
      warnings.push('connectorCode should be specified for DSA connector type');
    }
    if (formData.businessType === 'Company' && !formData.businessRegistrationNumber) {
      warnings.push('businessRegistrationNumber should be specified for Company business type');
    }
    if (formData.tpcMetPerson1 === 'Yes' && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is Yes');
    }
    if (formData.totalStaff && !formData.salesStaff) {
      warnings.push('salesStaff should be specified when totalStaff is provided');
    }
    if (formData.licenseStatus === 'Valid' && !formData.licenseNumber) {
      warnings.push('licenseNumber should be specified when license status is Valid');
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
 * @param formType - Type of DSA Connector form
 * @returns Complete data object with all fields populated
 */
export function ensureAllDsaConnectorFieldsPopulated(mappedData: Record<string, any>, formType: string): Record<string, any> {
  const completeData = { ...mappedData };

  // Define all possible database fields for DSA Connector verification
  const allDatabaseFields = [
    // Address and location fields
    'address_locatable', 'address_rating', 'locality', 'address_structure', 'address_floor',
    'address_structure_color', 'door_color',

    // Landmarks
    'landmark1', 'landmark2', 'landmark3', 'landmark4',

    // DSA/DST Connector specific fields
    'connector_type', 'connector_code', 'connector_name', 'connector_designation',
    'connector_experience', 'connector_status', 'connector_category', 'connector_level',
    'connector_territory', 'connector_target', 'connector_achievement', 'connector_rating',
    'connector_training_status', 'connector_certification', 'connector_license_number',

    // Business/Office details
    'business_name', 'business_type', 'business_registration_number', 'business_establishment_year',
    'office_type', 'office_area', 'office_status', 'office_ownership', 'office_rent',
    'office_facilities', 'office_staff_count', 'office_equipment',

    // Financial and performance details
    'monthly_business_volume', 'annual_turnover', 'commission_structure', 'incentive_details',
    'payment_terms', 'outstanding_dues', 'credit_limit', 'security_deposit',
    'bank_account_details', 'pan_number', 'gst_number', 'tax_compliance_status',

    // Team and network details
    'team_size', 'sub_agents_count', 'network_coverage', 'territory_details',
    'customer_base', 'active_policies', 'renewal_rate', 'claim_ratio',

    // Training and development
    'training_completed', 'certification_status', 'skill_assessment', 'product_knowledge',
    'compliance_training', 'technology_adoption', 'digital_literacy',

    // Contact and communication
    'contact_number', 'alternate_number', 'email_address', 'communication_preference',
    'availability_hours', 'response_time', 'customer_feedback_score',

    // Verification details
    'met_person_name', 'met_person_relation', 'designation', 'met_person_status',
    'document_shown', 'document_type', 'document_verification_status',
    'identity_verification', 'address_verification', 'business_verification',

    // Technology and infrastructure
    'computer_literacy', 'internet_connectivity', 'mobile_app_usage', 'digital_tools',
    'pos_machine_availability', 'printer_availability', 'scanner_availability',

    // Compliance and regulatory
    'regulatory_compliance', 'code_of_conduct_adherence', 'ethical_practices',
    'customer_grievance_handling', 'data_protection_compliance', 'anti_fraud_measures',

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
  const relevantFields = getRelevantDsaConnectorFieldsForFormType(formType);

  // Populate missing fields with appropriate defaults
  for (const field of allDatabaseFields) {
    if (completeData[field] === undefined || completeData[field] === null) {
      if (relevantFields.includes(field)) {
        // Field is relevant for this form type but missing - this might indicate an issue
        console.warn(`⚠️ Missing relevant field for ${formType} DSA Connector form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = getDefaultDsaConnectorValueForField(field);
    }
  }

  return completeData;
}

/**
 * Gets relevant database fields for a specific DSA Connector form type
 *
 * @param formType - Type of DSA Connector form
 * @returns Array of relevant database field names
 */
function getRelevantDsaConnectorFieldsForFormType(formType: string): string[] {
  const fieldsByType: Record<string, string[]> = {
    'POSITIVE': [
      'address_locatable', 'address_rating', 'connector_type', 'connector_code',
      'connector_name', 'connector_designation', 'connector_experience', 'connector_status',
      'business_name', 'business_type', 'business_registration_number', 'office_type',
      'office_area', 'monthly_business_volume', 'team_size', 'training_completed',
      'contact_number', 'met_person_name', 'designation', 'document_shown',
      'document_type', 'locality', 'address_structure', 'political_connection',
      'dominated_area', 'feedback_from_neighbour', 'other_observation', 'final_status',
      'address_floor', 'address_structure_color', 'door_color', 'landmark1', 'landmark2',
      'tpc_met_person1', 'name_of_tpc1', 'tpc_confirmation1', 'annual_turnover',
      'commission_structure', 'bank_account_details', 'pan_number', 'certification_status'
    ],
    'SHIFTED': [
      'address_locatable', 'address_rating', 'met_person_name', 'designation',
      'shifted_period', 'current_location', 'locality', 'address_structure',
      'political_connection', 'dominated_area', 'feedback_from_neighbour',
      'other_observation', 'final_status', 'address_floor', 'address_structure_color',
      'door_color', 'landmark1', 'landmark2'
    ],
    'NSP': [
      'address_locatable', 'address_rating', 'connector_status', 'met_person_name',
      'designation', 'locality', 'address_structure', 'political_connection',
      'dominated_area', 'feedback_from_neighbour', 'other_observation', 'final_status',
      'address_floor', 'address_structure_color', 'door_color', 'landmark1', 'landmark2'
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
 * Gets appropriate default value for a DSA Connector database field
 *
 * @param fieldName - Database field name
 * @returns Default value for the field
 */
function getDefaultDsaConnectorValueForField(fieldName: string): any {
  // All fields default to null for missing/irrelevant data
  return null;
}
