/**
 * Business Form Field Mapping Utilities
 *
 * This module provides comprehensive field mapping between mobile business form data
 * and database columns for business verification forms.
 */

import { logger } from '@/config/logger';
import { eqCI } from './caseInsensitiveCompare';
import { pickRelevantFieldsForFormType, MISSING_FIELD_DEFAULT } from './formFieldRelevance';

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile business form fields to database columns
 * Covers all business verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const BUSINESS_FIELD_MAPPING: DatabaseFieldMapping = {
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
  addressStructureColor: 'address_structure_color',
  doorColor: 'door_color',
  companyNamePlateStatus: 'company_name_plate_status',
  nameOnBoard: 'name_on_board',

  // Landmarks (Common to all forms, untraceable may have more)
  landmark1: 'landmark1',
  landmark2: 'landmark2',
  landmark3: 'landmark3', // Used in untraceable forms
  landmark4: 'landmark4', // Used in untraceable forms

  // Business status and details (Form specific)
  businessStatus: 'business_status', // Used in POSITIVE, SHIFTED, NSP forms
  businessExistance: 'business_existence', // Note: typo in mobile app
  businessExistence: 'business_existence', // Used in NSP forms
  businessType: 'business_type', // Used in POSITIVE forms
  ownershipType: 'ownership_type', // Used in POSITIVE forms
  addressStatus: 'address_status', // Used in POSITIVE forms
  companyNatureOfBusiness: 'company_nature_of_business', // Used in POSITIVE forms
  businessPeriod: 'business_period', // Used in POSITIVE forms
  businessApproxArea: 'business_approx_area', // Used in POSITIVE forms
  officeApproxArea: 'business_approx_area', // Alternative field name
  documentShownStatus: 'document_shown',
  staffStrength: 'staff_strength', // Used in POSITIVE forms
  staffSeen: 'staff_seen', // Used in POSITIVE forms

  // Additional business fields from mobile forms
  businessAddress: null, // No full_address column — address is on verification_tasks
  operatingHours: null, // Map to other_observation or ignore
  employeeCount: 'staff_strength', // Map employeeCount to staff_strength

  // Owner/Person details
  metPerson: 'met_person_name',
  metPersonName: 'met_person_name',
  designation: 'designation',
  nameOfCompanyOwners: 'name_of_company_owners',

  // Document verification
  documentShown: 'document_shown',

  // Third Party Confirmation (TPC)
  tpcMetPerson1: 'tpc_met_person1',
  nameOfTpc1: 'tpc_name1',
  tpcConfirmation1: 'tpc_confirmation1',
  tpcMetPerson2: 'tpc_met_person2',
  nameOfTpc2: 'tpc_name2',
  tpcConfirmation2: 'tpc_confirmation2',

  // Mobile sends officeStatus for Business forms (maps to business_status)
  officeStatus: 'business_status',
  // Alias: mobile sends approxArea for Business (maps to business_approx_area)
  approxArea: 'business_approx_area',
  // Mobile field variants
  applicantExistance: 'applicant_working_status',
  businessExistStatus: 'business_existence',
  oldOfficeShiftedPeriod: 'old_business_shifted_period',

  // Shifted business specific fields
  oldBusinessShiftedPeriod: 'old_business_shifted_period',
  currentCompanyName: 'current_company_name',
  currentCompanyPeriod: 'current_company_period',
  premisesStatus: 'premises_status',

  // Entry restricted specific fields
  nameOfMetPerson: 'met_person_name',
  metPersonType: 'met_person_type',
  metPersonConfirmation: 'met_person_confirmation',
  applicantWorkingStatus: 'applicant_working_status',

  // Untraceable specific fields
  contactPerson: 'contact_person',
  callRemark: 'call_remark',

  // Environment and area details
  politicalConnection: 'political_connection',
  dominatedArea: 'dominated_area',
  feedbackFromNeighbour: 'feedback_from_neighbour',
  otherObservation: 'other_observation',

  // Legacy/alternative field names
  businessName: 'company_nature_of_business', // Maps to company nature
  companyName: 'company_nature_of_business', // Maps to company nature
  totalEmployees: 'staff_strength', // Maps to staff strength
  businessNature: 'company_nature_of_business', // Maps to business nature
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

// 2026-04-26 P3 dead-code prune (per project_form_field_mapping_drift_audit.md):
// Removed 4 dead exports + 1 dead private helper from this file:
//   - mapBusinessFormDataToDatabase(): zero call sites in any codebase. The submit
//     path uses validateAndPrepareBusinessForm() from businessFormValidator.ts;
//     this old camelCase→snake_case mapper was never wired up post-migration.
//   - processBusinessFieldValue() (private): only caller was the dead mapper above.
//   - getBusinessAvailableDbColumns(): zero call sites; only `_`-aliased import.
//   - getBusinessMappedMobileFields(): zero call sites anywhere.
// BUSINESS_FIELD_MAPPING and ensureAllBusinessFieldsPopulated() stay alive (used by validator).

/**
 * Validates that all required fields are present in business form data
 *
 * @param formData - Form data to validate
 * @param formType - Type of form (POSITIVE, SHIFTED, NSP, etc.)
 * @returns Object with validation result and missing fields
 */
export function validateBusinessRequiredFields(
  formData: Record<string, unknown>,
  formType: string
): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  // Define required fields by business form type
  const requiredFieldsByType: Record<string, string[]> = {
    POSITIVE: [
      'addressLocatable',
      'addressRating',
      'businessStatus',
      'metPerson',
      'designation',
      'businessType',
      'nameOfCompanyOwners',
      'ownershipType',
      'addressStatus',
      'companyNatureOfBusiness',
      'businessPeriod',
      'staffStrength',
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
      'businessStatus',
      'metPerson',
      'designation',
      'currentCompanyName',
      'oldBusinessShiftedPeriod',
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
      'businessStatus',
      'businessExistence',
      'metPerson',
      'designation',
      'locality',
      'addressStructure',
      'dominatedArea',
      'otherObservation',
      'finalStatus',
    ],
    ENTRY_RESTRICTED: [
      'addressLocatable',
      'addressRating',
      'nameOfMetPerson',
      'metPersonType',
      'metPersonConfirmation',
      'applicantWorkingStatus',
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
    if (eqCI(formData.businessStatus, 'Open') && !formData.staffSeen) {
      warnings.push('staffSeen should be specified when business is opened');
    }
    if (eqCI(formData.tpcMetPerson1, 'Yes') && !formData.nameOfTpc1) {
      warnings.push('nameOfTpc1 should be specified when tpcMetPerson1 is Yes');
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
 * @param formType - Type of business form
 * @returns Complete data object with all fields populated
 */
// 2026-04-26 Phase 4 dedup (formFieldRelevance.ts shared util).
// Per-type DATA stays here; logic moved to shared `pickRelevantFieldsForFormType`.
const RELEVANT_FIELDS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  POSITIVE: [
    'address_locatable',
    'address_rating',
    'business_status',
    'met_person_name',
    'designation',
    'business_type',
    'ownership_type',
    'company_nature_of_business',
    'staff_strength',
    'locality',
    'address_structure',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
    'business_period',
    'business_approx_area',
    'staff_seen',
    'document_shown',
    'tpc_met_person1',
    // 2026-04-26: column renamed; was 'name_of_tpc1'
    'tpc_name1',
    'tpc_confirmation1',
    'address_structure_color',
    'door_color',
    'company_name_plate_status',
    'name_on_board',
    'landmark1',
    'landmark2',
  ],
  SHIFTED: [
    'address_locatable',
    'address_rating',
    'business_status',
    'met_person_name',
    'designation',
    'current_company_name',
    'old_business_shifted_period',
    'locality',
    'address_structure',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
    'address_structure_color',
    'door_color',
    'company_name_plate_status',
    'name_on_board',
    'landmark1',
    'landmark2',
  ],
  NSP: [
    'address_locatable',
    'address_rating',
    'business_status',
    'business_existence',
    'met_person_name',
    'designation',
    'locality',
    'address_structure',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
    'address_structure_color',
    'door_color',
    'company_name_plate_status',
    'name_on_board',
    'landmark1',
    'landmark2',
  ],
  ENTRY_RESTRICTED: [
    'address_locatable',
    'address_rating',
    // 2026-04-26: column renamed; was 'name_of_met_person'
    'met_person_name',
    'met_person_type',
    'met_person_confirmation',
    'applicant_working_status',
    'locality',
    'address_structure',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
    'address_structure_color',
    'company_name_plate_status',
    'name_on_board',
    'landmark1',
    'landmark2',
  ],
  UNTRACEABLE: [
    'contact_person',
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

export function ensureAllBusinessFieldsPopulated(
  mappedData: Record<string, unknown>,
  formType: string
): Record<string, unknown> {
  const completeData = { ...mappedData };

  // Define all possible database fields for business verification
  const allDatabaseFields = [
    // Address and location fields
    'address_locatable',
    'address_rating',
    'locality',
    'address_structure',
    'address_structure_color',
    'door_color',
    'company_name_plate_status',
    'name_on_board',

    // Landmarks
    'landmark1',
    'landmark2',
    'landmark3',
    'landmark4',

    // Business status and details
    'business_status',
    'business_existence',
    'business_type',
    'ownership_type',
    'address_status',
    'company_nature_of_business',
    'business_period',
    'business_approx_area',
    'staff_strength',
    'staff_seen',

    // Person details
    'met_person_name',
    'designation',
    'current_company_name',
    'old_business_shifted_period',

    // Document verification
    'document_shown',

    // Third Party Confirmation
    'tpc_met_person1',
    'tpc_name1',
    'tpc_confirmation1',
    'tpc_met_person2',
    'tpc_name2',
    'tpc_confirmation2',

    // Entry restricted specific fields
    // 2026-04-26: dropped duplicate 'name_of_met_person' — column was
    // renamed to met_person_name (already in this array on line ~434);
    // pre-fix every business INSERT failed 42703.
    'met_person_type',
    'met_person_confirmation',
    'applicant_working_status',

    // Untraceable specific fields
    'contact_person',
    'call_remark',

    // Environment and area details
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',

    // Final status
    'final_status',
  ];

  // Get fields that are relevant for this form type
  const relevantFields = pickRelevantFieldsForFormType(formType, RELEVANT_FIELDS_BY_TYPE);

  // Populate missing fields with appropriate defaults
  for (const field of allDatabaseFields) {
    if (completeData[field] === undefined || completeData[field] === null) {
      if (relevantFields.includes(field)) {
        // Field is relevant for this form type but missing - this might indicate an issue
        logger.warn(`⚠️ Missing relevant field for ${formType} business form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = MISSING_FIELD_DEFAULT;
    }
  }

  return completeData;
}
