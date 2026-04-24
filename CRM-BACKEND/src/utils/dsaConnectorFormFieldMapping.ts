/**
 * DSA/DST Connector Form Field Mapping Utilities
 *
 * This module provides comprehensive field mapping between mobile DSA/DST Connector form data
 * and database columns for DSA/DST Connector verification forms.
 */

import { logger } from '@/config/logger';
import { eqCI } from './caseInsensitiveCompare';

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile DSA/DST Connector form fields to database columns
 * Covers all DSA Connector verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const DSA_CONNECTOR_FIELD_MAPPING: DatabaseFieldMapping = {
  // Basic form information
  outcome: null, // Handled separately as verification_outcome
  verificationOutcome: null, // Handled separately as verification_outcome
  remarks: 'remarks',
  finalStatus: 'final_status',

  // Address and location fields (Common to all forms)
  addressLocatable: 'address_locatable',
  addressRating: 'address_rating',
  locality: 'locality',
  addressStructure: 'address_structure',
  addressFloor: 'address_floor',
  addressStructureColor: 'address_structure_color',
  doorColor: 'door_color',

  // Landmarks (Common to all forms, untraceable may have more)
  landmark1: 'landmark1',
  landmark2: 'landmark2',
  landmark3: 'landmark3', // Used in untraceable forms
  landmark4: 'landmark4', // Used in untraceable forms

  // Office/premises status
  officeStatus: 'office_status', // Used to determine door open/locked

  // DSA/DST Connector specific fields (Form specific)
  connectorType: 'connector_type', // Used in POSITIVE forms
  connectorCode: 'connector_code', // Used in POSITIVE forms
  connectorName: 'connector_name', // Used in POSITIVE forms
  connectorDesignation: 'connector_designation', // Used in POSITIVE forms
  connectorExperience: 'connector_experience', // Used in POSITIVE forms
  connectorStatus: 'connector_status', // Used in POSITIVE, NSP forms

  // Mobile field aliases (mobile sends these for DSA forms)
  designation: 'met_person_designation',
  metPersonType: 'met_person_designation',
  businessExistStatus: 'business_exist_status',
  applicantStayingFloor: 'applicant_staying_floor',
  approxArea: 'office_area',
  officeApproxArea: 'office_area',
  staffStrength: 'total_staff',
  staffSeen: 'staff_seen',
  nameOfMetPerson: 'security_person_name',
  metPersonConfirmation: 'security_confirmation',
  businessExistance: 'business_operational',
  applicantExistance: 'applicant_existence',
  oldOfficeShiftedPeriod: 'shifted_period',

  // DSA Positive form fields (per xlsx spec)
  ownershipType: 'ownership_type',
  nameOfCompanyOwners: 'name_of_company_owners',
  addressStatus: 'address_status',
  companyNatureOfBusiness: 'company_nature_of_business',
  businessPeriod: 'business_period',
  activeClient: 'active_client',
  companyNamePlateStatus: 'company_nameplate_status',
  nameOnBoard: 'name_on_board',

  // Business/Office details (Form specific)
  businessName: 'business_name', // Used in POSITIVE forms
  businessType: 'business_type', // Used in POSITIVE forms
  businessRegistrationNumber: 'business_registration_number', // Used in POSITIVE forms
  businessEstablishmentYear: 'business_establishment_year', // Used in POSITIVE forms
  officeType: 'office_type', // Used in POSITIVE forms
  officeArea: 'office_area', // Used in POSITIVE forms
  officeRent: 'office_rent',

  // Team and staff details
  totalStaff: 'total_staff',
  salesStaff: 'sales_staff',
  supportStaff: 'support_staff',
  teamSize: 'team_size',
  monthlyBusinessVolume: 'monthly_business_volume',
  averageMonthlySales: 'average_monthly_sales',

  // Financial details
  annualTurnover: 'annual_turnover',
  monthlyIncome: 'monthly_income',
  commissionStructure: 'commission_structure',
  paymentTerms: 'payment_terms',
  bankAccountDetails: 'bank_account_details',

  // Technology and infrastructure
  computerSystems: 'computer_systems',
  internetConnection: 'internet_connection',
  softwareSystems: 'software_systems',
  posTerminals: 'pos_terminals',
  printerScanner: 'printer_scanner',

  // Compliance and documentation
  licenseStatus: 'license_status',
  licenseNumber: 'license_number',
  licenseExpiryDate: 'license_expiry_date',
  complianceStatus: 'compliance_status',
  auditStatus: 'audit_status',
  trainingStatus: 'training_status',

  // Met person details
  metPersonName: 'met_person_name',
  metPersonDesignation: 'met_person_designation',
  metPersonRelation: 'met_person_relation',
  metPersonContact: 'met_person_contact',

  // Business verification
  businessOperational: 'business_operational',
  customerFootfall: 'customer_footfall',
  businessHours: 'business_hours',
  weekendOperations: 'weekend_operations',

  // Third Party Confirmation (TPC)
  tpcMetPerson1: 'tpc_met_person1',
  nameOfTpc1: 'tpc_name1',
  tpcConfirmation1: 'tpc_confirmation1',
  tpcMetPerson2: 'tpc_met_person2',
  nameOfTpc2: 'tpc_name2',
  tpcConfirmation2: 'tpc_confirmation2',

  // Shifted specific fields
  shiftedPeriod: 'shifted_period',
  currentLocation: 'current_location',
  premisesStatus: 'premises_status',
  previousBusinessName: 'previous_business_name',
  currentCompanyName: 'current_company_name',
  currentCompanyPeriod: 'current_company_period',

  // Entry restricted specific fields
  entryRestrictionReason: 'entry_restriction_reason',
  securityPersonName: 'security_person_name',
  securityConfirmation: 'security_confirmation',

  // Untraceable specific fields
  contactPerson: 'contact_person',
  callRemark: 'call_remark',

  // Market and competition
  marketPresence: 'market_presence',
  competitorAnalysis: 'competitor_analysis',
  marketReputation: 'market_reputation',
  customerFeedback: 'customer_feedback',

  // Area and environment
  politicalConnection: 'political_connection',
  dominatedArea: 'dominated_area',
  feedbackFromNeighbour: 'feedback_from_neighbour',
  infrastructureStatus: 'infrastructure_status',
  commercialViability: 'commercial_viability',

  // Observations and remarks
  otherObservation: 'other_observation',
  businessConcerns: 'business_concerns',
  operationalChallenges: 'operational_challenges',
  growthPotential: 'growth_potential',
  recommendationStatus: 'recommendation_status',
  riskAssessment: 'risk_assessment',

  // Legacy/alternative field names
  metPerson: 'met_person_name', // Maps to met person name
  companyName: 'business_name', // Maps to business name
  agentName: 'connector_name', // Maps to connector name
  agentCode: 'connector_code', // Maps to connector code
  verificationMethod: null, // Derived field, ignore

  // Fields to ignore (UI state, images, etc.)
  images: null,
  selfieImages: null,
  id: null,
  caseId: null,
  timestamp: null,
  isValid: null,
  errors: null,
};

/**
 * Maps mobile DSA/DST Connector form data to database field values with comprehensive field coverage
 * Ensures all database fields are populated with appropriate values or NULL defaults
 *
 * @param formData - Raw form data from mobile app
 * @param formType - The type of DSA Connector form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Object with database column names as keys
 */
export function mapDsaConnectorFormDataToDatabase(
  formData: Record<string, unknown>,
  formType?: string
): Record<string, unknown> {
  const mappedData: Record<string, unknown> = {};

  // Process each field in the form data
  for (const [mobileField, value] of Object.entries(formData)) {
    const dbColumn = DSA_CONNECTOR_FIELD_MAPPING[mobileField];

    // Skip fields that should be ignored
    if (dbColumn === null) {
      continue;
    }

    // Skip fields that have no DB mapping (undefined = not in mapping)
    if (dbColumn === undefined) {
      continue;
    }
    const columnName = dbColumn;

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
function processDsaConnectorFieldValue(fieldName: string, value: unknown): unknown {
  // Handle null/undefined values
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Handle boolean fields
  if (typeof value === 'boolean') {
    return value;
  }

  // Handle numeric fields FIRST (before composite string conversion)
  const numericFields = [
    'connectorExperience',
    'businessEstablishmentYear',
    'totalStaff',
    'salesStaff',
    'supportStaff',
    'teamSize',
    'computerSystems',
    'posTerminals',
  ];

  if (numericFields.includes(fieldName)) {
    const raw =
      typeof value === 'object' && value !== null && 'value' in (value as Record<string, unknown>)
        ? (value as Record<string, unknown>).value
        : value;
    const num = Number(raw);
    return isNaN(num) ? null : num;
  }

  // Handle decimal fields
  const decimalFields = [
    'officeArea',
    'officeRent',
    'monthlyBusinessVolume',
    'averageMonthlySales',
    'annualTurnover',
    'monthlyIncome',
  ];

  if (decimalFields.includes(fieldName)) {
    const num = parseFloat(String(value as string | number | boolean | null | undefined));
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

  // Handle composite objects (e.g., { value: 3, unit: 'Years' } from mobile dropdowns)
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ('value' in obj && 'unit' in obj) {
      return `${String(obj.value as string | number)} ${String(obj.unit as string | number)}`.trim();
    }
    return JSON.stringify(value);
  }

  // Default: convert to string and trim
  return (
    (typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : String(value as string | number | boolean | null | undefined)
    ).trim() || null
  );
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
export function validateDsaConnectorRequiredFields(
  formData: Record<string, unknown>,
  formType: string
): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  // Define required fields by DSA/DST Connector form type
  const requiredFieldsByType: Record<string, string[]> = {
    POSITIVE: [
      'addressLocatable',
      'addressRating',
      'connectorType',
      'connectorName',
      'connectorCode',
      'businessName',
      'businessType',
      'metPersonName',
      'metPersonDesignation',
      'businessOperational',
      'locality',
      'addressStructure',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'otherObservation',
      'finalStatus',
    ],
    SHIFTED: [
      'addressLocatable',
      'addressRating',
      'metPersonName',
      'metPersonDesignation',
      'shiftedPeriod',
      'currentLocation',
      'previousBusinessName',
      'locality',
      'addressStructure',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'otherObservation',
      'finalStatus',
    ],
    NSP: [
      'addressLocatable',
      'addressRating',
      'metPersonName',
      'metPersonDesignation',
      'connectorName',
      'businessName',
      'locality',
      'addressStructure',
      'dominatedArea',
      'otherObservation',
      'finalStatus',
    ],
    ENTRY_RESTRICTED: [
      'addressLocatable',
      'addressRating',
      'entryRestrictionReason',
      'securityPersonName',
      'securityConfirmation',
      'locality',
      'addressStructure',
      'politicalConnection',
      'dominatedArea',
      'feedbackFromNeighbour',
      'otherObservation',
      'finalStatus',
    ],
    UNTRACEABLE: [
      'contactPerson',
      'callRemark',
      'locality',
      'landmark1',
      'landmark2',
      'dominatedArea',
      'otherObservation',
      'finalStatus',
    ],
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
    if (eqCI(formData.businessType, 'Company') && !formData.businessRegistrationNumber) {
      warnings.push('businessRegistrationNumber should be specified for Company business type');
    }
    if (eqCI(formData.tpcMetPerson1, 'Yes') && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is Yes');
    }
    if (formData.totalStaff && !formData.salesStaff) {
      warnings.push('salesStaff should be specified when totalStaff is provided');
    }
    if (eqCI(formData.licenseStatus, 'Valid') && !formData.licenseNumber) {
      warnings.push('licenseNumber should be specified when license status is Valid');
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
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
export function ensureAllDsaConnectorFieldsPopulated(
  mappedData: Record<string, unknown>,
  formType: string
): Record<string, unknown> {
  const completeData = { ...mappedData };

  // Define all possible database fields for DSA Connector verification
  // Curated to match actual dsa_connector_verification_reports schema (2026-04-19).
  // Removed 65 speculative columns that never existed (connector_category,
  // connector_level, connector_territory, connector_target, connector_achievement,
  // connector_rating, connector_training_status, connector_certification,
  // connector_license_number, office_ownership, office_facilities, office_staff_count,
  // office_equipment, incentive_details, outstanding_dues, security_deposit,
  // pan_number, gst_number, tax_compliance_status, sub_agents_count, network_coverage,
  // territory_details, renewal_rate, training_completed, skill_assessment,
  // product_knowledge, technology_adoption, email_address, response_time,
  // met_person_status, identity_verification, internet_connectivity, mobile_app_usage,
  // pos_machine_availability, printer_availability, scanner_availability,
  // regulatory_compliance, ethical_practices, and 28 more).
  // Corrected name_of_tpc1/2 → tpc_name1/2 (wrong naming).
  const allDatabaseFields = [
    // Address and location fields
    'address_locatable',
    'address_rating',
    'locality',
    'address_structure',
    'address_floor',
    'address_structure_color',
    'door_color',

    // Landmarks
    'landmark1',
    'landmark2',
    'landmark3',
    'landmark4',

    // DSA/DST Connector core columns (only those present in schema)
    'connector_type',
    'connector_code',
    'connector_name',
    'connector_designation',
    'connector_experience',
    'connector_status',

    // Business/Office details
    'business_name',
    'business_type',
    'business_registration_number',
    'business_establishment_year',
    'office_type',
    'office_area',
    'office_status',
    'office_rent',

    // Financial / performance
    'monthly_business_volume',
    'average_monthly_sales',
    'annual_turnover',
    'monthly_income',
    'commission_structure',
    'payment_terms',
    'bank_account_details',
    'active_client',

    // Technology/infrastructure (present in schema)
    'computer_systems',
    'internet_connection',
    'software_systems',
    'pos_terminals',
    'printer_scanner',

    // License + compliance
    'license_status',
    'license_number',
    'license_expiry_date',
    'compliance_status',
    'audit_status',
    'training_status',

    // Team
    'total_staff',
    'sales_staff',
    'support_staff',
    'team_size',

    // Person details
    'met_person_name',
    'met_person_designation',
    'met_person_relation',
    'met_person_contact',

    // Business operational
    'business_operational',
    'customer_footfall',
    'business_hours',
    'weekend_operations',

    // Address/nameplate (DSA-specific)
    'address_status',
    'name_of_company_owners',
    'ownership_type',
    'company_nature_of_business',
    'business_period',
    'company_nameplate_status',
    'name_on_board',
    // DSA table has `staff_seen` but NOT `staff_strength` (uses `total_staff` instead).
    'staff_seen',

    // Third Party Confirmation (correct names)
    'tpc_met_person1',
    'tpc_name1',
    'tpc_confirmation1',
    'tpc_met_person2',
    'tpc_name2',
    'tpc_confirmation2',

    // Form-specific fields
    'shifted_period',
    'current_location',
    'premises_status',
    'previous_business_name',
    'entry_restriction_reason',
    'security_person_name',
    'security_confirmation',
    'contact_person',
    'call_remark',

    // Market presence
    'market_presence',
    'competitor_analysis',
    'market_reputation',
    'customer_feedback',

    // ERT — DSA table only has business_exist_status. The other ERT fields
    // (nameOfMetPerson, metPersonType, metPersonConfirmation, applicantWorkingStatus)
    // are aliased via mapping to security_person_name / met_person_designation
    // / security_confirmation / applicant_working_status (which also doesn't exist).
    'business_exist_status',

    // Environment and area details
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'recommendation_status',

    // Final status
    'final_status',
  ];

  // Get fields that are relevant for this form type
  const relevantFields = getRelevantDsaConnectorFieldsForFormType(formType);

  // Populate missing fields with appropriate defaults
  for (const field of allDatabaseFields) {
    if (completeData[field] === undefined || completeData[field] === null) {
      if (relevantFields.includes(field)) {
        // Field is relevant for this form type but missing - this might indicate an issue
        logger.warn(`⚠️ Missing relevant field for ${formType} DSA Connector form: ${field}`);
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
    POSITIVE: [
      'address_locatable',
      'address_rating',
      'connector_type',
      'connector_code',
      'connector_name',
      'connector_designation',
      'connector_experience',
      'connector_status',
      'business_name',
      'business_type',
      'business_registration_number',
      'office_type',
      'office_area',
      'monthly_business_volume',
      'team_size',
      'training_completed',
      'contact_number',
      'met_person_name',
      'designation',
      'document_shown',
      'document_type',
      'locality',
      'address_structure',
      'political_connection',
      'dominated_area',
      'feedback_from_neighbour',
      'other_observation',
      'final_status',
      'address_floor',
      'address_structure_color',
      'door_color',
      'landmark1',
      'landmark2',
      'tpc_met_person1',
      'name_of_tpc1',
      'tpc_confirmation1',
      'annual_turnover',
      'commission_structure',
      'bank_account_details',
      'pan_number',
      'certification_status',
    ],
    SHIFTED: [
      'address_locatable',
      'address_rating',
      'met_person_name',
      'designation',
      'shifted_period',
      'current_location',
      'locality',
      'address_structure',
      'political_connection',
      'dominated_area',
      'feedback_from_neighbour',
      'other_observation',
      'final_status',
      'address_floor',
      'address_structure_color',
      'door_color',
      'landmark1',
      'landmark2',
    ],
    NSP: [
      'address_locatable',
      'address_rating',
      'connector_status',
      'met_person_name',
      'designation',
      'locality',
      'address_structure',
      'political_connection',
      'dominated_area',
      'feedback_from_neighbour',
      'other_observation',
      'final_status',
      'address_floor',
      'address_structure_color',
      'door_color',
      'landmark1',
      'landmark2',
    ],
    ENTRY_RESTRICTED: [
      'address_locatable',
      'address_rating',
      'name_of_met_person',
      'met_person_type',
      'met_person_confirmation',
      'locality',
      'address_structure',
      'political_connection',
      'dominated_area',
      'feedback_from_neighbour',
      'other_observation',
      'final_status',
      'address_floor',
      'address_structure_color',
      'landmark1',
      'landmark2',
    ],
    UNTRACEABLE: [
      'call_remark',
      'contact_person',
      'locality',
      'landmark1',
      'landmark2',
      'landmark3',
      'landmark4',
      'dominated_area',
      'other_observation',
      'final_status',
    ],
  };

  return fieldsByType[formType] || fieldsByType['POSITIVE'];
}

/**
 * Gets appropriate default value for a DSA Connector database field
 *
 * @param _fieldName - Database field name
 * @returns Default value for the field
 */
function getDefaultDsaConnectorValueForField(_fieldName: string): unknown {
  // All fields default to null for missing/irrelevant data
  return null;
}
