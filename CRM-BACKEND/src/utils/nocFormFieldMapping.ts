/**
 * NOC Form Field Mapping Utilities
 *
 * This module provides comprehensive field mapping between mobile NOC form data
 * and database columns for NOC verification forms.
 */

import { logger } from '@/config/logger';
import { eqCI } from './caseInsensitiveCompare';

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile NOC form fields to database columns
 * Covers all NOC verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const NOC_FIELD_MAPPING: DatabaseFieldMapping = {
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

  // NOC-specific fields (mobile sends these)
  authorisedSignature: 'authorised_signature',
  nameOnNoc: 'name_on_noc',
  flatNo: 'flat_no',
  designation: 'met_person_designation',
  // NOC ERT mobile field `metPersonType` should map to its own column, not
  // to met_person_designation (which is for POSITIVE's designation field).
  metPersonType: 'met_person_type',
  companyNamePlateStatus: 'company_name_plate_status',
  nameOnBoard: 'name_on_board',
  currentCompanyName: 'current_company_name',
  // Period-composite merged destinations (added 2026-04-19 — mobile sends
  // currentCompanyPeriodValue/Unit which preprocessCompositeFields merges into
  // currentCompanyPeriod; without this mapping entry the merged value was dropped).
  currentCompanyPeriod: 'current_company_period',
  oldOfficeShiftedPeriod: 'old_office_shifted_period',
  officeApproxArea: 'office_approx_area',
  otherExtraRemark: 'other_extra_remark',
  // NOC ERT uses dedicated name_of_met_person / met_person_confirmation columns.
  // Prior aliases mapped these to security_person_name / security_confirmation
  // which are LEGACY ERT columns — causing ERT data loss (fixed 2026-04-19).
  nameOfMetPerson: 'met_person_name',
  metPersonConfirmation: 'met_person_confirmation',
  applicantExistance: 'applicant_existence',
  businessExistance: 'business_existence',

  nocStatus: 'noc_status', // Used in POSITIVE, NSP forms
  nocType: 'noc_type', // Used in POSITIVE forms
  nocNumber: 'noc_number', // Used in POSITIVE forms
  nocIssueDate: 'noc_issue_date', // Used in POSITIVE forms
  nocExpiryDate: 'noc_expiry_date', // Used in POSITIVE forms
  nocIssuingAuthority: 'noc_issuing_authority', // Used in POSITIVE forms
  nocValidityStatus: 'noc_validity_status', // Used in POSITIVE forms

  // Property/Project details (Form specific)
  propertyType: 'property_type', // Used in POSITIVE forms
  projectName: 'project_name', // Used in POSITIVE forms
  projectStatus: 'project_status', // Used in POSITIVE forms
  constructionStatus: 'construction_status', // Used in POSITIVE forms
  projectApprovalStatus: 'project_approval_status', // Used in POSITIVE forms
  totalUnits: 'total_units',
  completedUnits: 'completed_units',
  soldUnits: 'sold_units',
  possessionStatus: 'possession_status',

  // Builder/Developer information
  builderName: 'builder_name',
  builderContact: 'builder_contact',
  developerName: 'developer_name',
  developerContact: 'developer_contact',
  builderRegistrationNumber: 'builder_registration_number',

  // Met person details
  metPersonName: 'met_person_name',
  metPersonDesignation: 'met_person_designation',
  metPersonRelation: 'met_person_relation',
  metPersonContact: 'met_person_contact',

  // Document verification
  documentShownStatus: 'document_shown_status',
  documentType: 'document_type',
  documentVerificationStatus: 'document_verification_status',

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

  // Entry restricted specific fields
  entryRestrictionReason: 'entry_restriction_reason',
  securityPersonName: 'security_person_name',
  securityConfirmation: 'security_confirmation',

  // Untraceable specific fields
  contactPerson: 'contact_person',
  callRemark: 'call_remark',

  // Environment and compliance
  environmentalClearance: 'environmental_clearance',
  fireSafetyClearance: 'fire_safety_clearance',
  pollutionClearance: 'pollution_clearance',
  waterConnectionStatus: 'water_connection_status',
  electricityConnectionStatus: 'electricity_connection_status',

  // Area and infrastructure
  politicalConnection: 'political_connection',
  dominatedArea: 'dominated_area',
  feedbackFromNeighbour: 'feedback_from_neighbour',
  infrastructureStatus: 'infrastructure_status',
  roadConnectivity: 'road_connectivity',

  // Observations and remarks
  otherObservation: 'other_observation',
  complianceIssues: 'compliance_issues',
  regulatoryConcerns: 'regulatory_concerns',
  recommendationStatus: 'recommendation_status',

  // Legacy/alternative field names
  metPerson: 'met_person_name', // Maps to met person name
  companyName: 'builder_name', // Maps to builder name
  projectDetails: 'project_name', // Maps to project name
  clearanceStatus: 'environmental_clearance', // Maps to environmental clearance
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
 * Maps mobile NOC form data to database field values with comprehensive field coverage
 * Ensures all database fields are populated with appropriate values or NULL defaults
 *
 * @param formData - Raw form data from mobile app
 * @param formType - The type of NOC form (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * @returns Object with database column names as keys
 */
export function mapNocFormDataToDatabase(
  formData: Record<string, unknown>,
  formType?: string
): Record<string, unknown> {
  const mappedData: Record<string, unknown> = {};

  // Process each field in the form data
  for (const [mobileField, value] of Object.entries(formData)) {
    const dbColumn = NOC_FIELD_MAPPING[mobileField];

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
    mappedData[columnName] = processNocFieldValue(mobileField, value);
  }

  // Ensure all database fields have values based on form type
  const completeData = ensureAllNocFieldsPopulated(mappedData, formType || 'POSITIVE');

  return completeData;
}

/**
 * Processes NOC field values to ensure they're in the correct format for database storage
 *
 * @param fieldName - The mobile field name
 * @param value - The field value
 * @returns Processed value suitable for database storage
 */
function processNocFieldValue(fieldName: string, value: unknown): unknown {
  // Handle null/undefined values
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Handle boolean fields
  if (typeof value === 'boolean') {
    return value;
  }

  // Handle numeric fields FIRST (before composite string conversion)
  const numericFields = ['totalUnits', 'completedUnits', 'soldUnits'];

  if (numericFields.includes(fieldName)) {
    const raw =
      typeof value === 'object' && value !== null && 'value' in (value as Record<string, unknown>)
        ? (value as Record<string, unknown>).value
        : value;
    const num = Number(raw);
    return isNaN(num) ? null : num;
  }

  // Handle date fields
  const dateFields = ['nocIssueDate', 'nocExpiryDate'];
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
 * Gets all database columns that can be populated from NOC form data
 *
 * @returns Array of database column names
 */
export function getNocAvailableDbColumns(): string[] {
  const columns = new Set<string>();

  for (const dbColumn of Object.values(NOC_FIELD_MAPPING)) {
    if (dbColumn !== null) {
      columns.add(dbColumn);
    }
  }

  return Array.from(columns).sort();
}

/**
 * Gets all mobile NOC form fields that are mapped to database columns
 *
 * @returns Array of mobile field names
 */
export function getNocMappedMobileFields(): string[] {
  return Object.keys(NOC_FIELD_MAPPING)
    .filter(field => NOC_FIELD_MAPPING[field] !== null)
    .sort();
}

/**
 * Validates that all required fields are present in NOC form data
 *
 * @param formData - Form data to validate
 * @param formType - Type of form (POSITIVE, SHIFTED, NSP, etc.)
 * @returns Object with validation result and missing fields
 */
export function validateNocRequiredFields(
  formData: Record<string, unknown>,
  formType: string
): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  // Define required fields by NOC form type
  const requiredFieldsByType: Record<string, string[]> = {
    POSITIVE: [
      'addressLocatable',
      'addressRating',
      'nocStatus',
      'nocType',
      'metPersonName',
      'metPersonDesignation',
      'projectName',
      'builderName',
      'propertyType',
      'projectStatus',
      'constructionStatus',
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
      'projectName',
      'builderName',
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
    if (eqCI(formData.nocStatus, 'Available') && !formData.nocNumber) {
      warnings.push('nocNumber should be specified when NOC is available');
    }
    if (eqCI(formData.nocStatus, 'Available') && !formData.nocValidityStatus) {
      warnings.push('nocValidityStatus should be specified when NOC is available');
    }
    if (eqCI(formData.tpcMetPerson1, 'Yes') && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is Yes');
    }
    if (formData.totalUnits && !formData.completedUnits) {
      warnings.push('completedUnits should be specified when totalUnits is provided');
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
 * @param formType - Type of NOC form
 * @returns Complete data object with all fields populated
 */
export function ensureAllNocFieldsPopulated(
  mappedData: Record<string, unknown>,
  formType: string
): Record<string, unknown> {
  const completeData = { ...mappedData };

  // Define all possible database fields for NOC verification
  // Curated to match actual noc_verification_reports schema (2026-04-19).
  // Removed 24 "speculative" columns that never existed: noc_purpose, noc_category,
  // project_area, project_location, project_phase, completion_date,
  // builder_license_number, developer_registration, contact_number, contact_email,
  // structural_safety_clearance, water_connection_noc, sewage_connection_noc,
  // electricity_connection_noc, pollution_control_noc, municipal_approval,
  // gram_panchayat_approval, designation (DB uses met_person_designation),
  // met_person_status, met_person_type, met_person_confirmation, name_of_met_person,
  // document_shown (DB uses document_shown_status). Also corrected
  // name_of_tpc1/2 → tpc_name1/tpc_name2 (wrong naming bug).
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

    // Office status + NOC-specific fields
    'office_status',
    'noc_status',
    'noc_type',
    'noc_number',
    'noc_issue_date',
    'noc_expiry_date',
    'noc_issuing_authority',
    'noc_validity_status',
    'authorised_signature',
    'name_on_noc',
    'flat_no',

    // Property/Project details
    'property_type',
    'project_name',
    'project_status',
    'construction_status',
    'project_approval_status',
    'total_units',
    'completed_units',
    'sold_units',
    'possession_status',

    // Builder/Developer details
    'builder_name',
    'builder_contact',
    'developer_name',
    'developer_contact',
    'builder_registration_number',
    'contact_person',

    // Regulatory and compliance (actual DB columns)
    'environmental_clearance',
    'fire_safety_clearance',
    'pollution_clearance',
    'water_connection_status',
    'electricity_connection_status',

    // Document verification
    'document_shown_status',
    'document_type',
    'document_verification_status',

    // Person details
    'met_person_name',
    'met_person_designation',
    'met_person_relation',
    'met_person_contact',

    // Third Party Confirmation (correct DB column names)
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
    'entry_restriction_reason',
    'security_person_name',
    'security_confirmation',
    'call_remark',

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
  const relevantFields = getRelevantNocFieldsForFormType(formType);

  // Populate missing fields with appropriate defaults
  for (const field of allDatabaseFields) {
    if (completeData[field] === undefined || completeData[field] === null) {
      if (relevantFields.includes(field)) {
        // Field is relevant for this form type but missing - this might indicate an issue
        logger.warn(`⚠️ Missing relevant field for ${formType} NOC form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = getDefaultNocValueForField(field);
    }
  }

  return completeData;
}

/**
 * Gets relevant database fields for a specific NOC form type
 *
 * @param formType - Type of NOC form
 * @returns Array of relevant database field names
 */
function getRelevantNocFieldsForFormType(formType: string): string[] {
  const fieldsByType: Record<string, string[]> = {
    POSITIVE: [
      'address_locatable',
      'address_rating',
      'noc_status',
      'noc_type',
      'noc_number',
      'noc_issue_date',
      'noc_expiry_date',
      'noc_issuing_authority',
      'noc_validity_status',
      'property_type',
      'project_name',
      'project_status',
      'construction_status',
      'project_approval_status',
      'builder_name',
      'developer_name',
      'contact_person',
      'environmental_clearance',
      'fire_safety_clearance',
      'municipal_approval',
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
      'project_area',
      'total_units',
      'completed_units',
      'contact_number',
      'builder_license_number',
      'tpc_met_person1',
      'name_of_tpc1',
      'tpc_confirmation1',
      'address_floor',
      'address_structure_color',
      'door_color',
      'landmark1',
      'landmark2',
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
      'noc_status',
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
 * Gets appropriate default value for a NOC database field
 *
 * @param _fieldName - Database field name
 * @returns Default value for the field
 */
function getDefaultNocValueForField(_fieldName: string): unknown {
  // All fields default to null for missing/irrelevant data
  return null;
}
