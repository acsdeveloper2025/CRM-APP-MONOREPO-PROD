/**
 * Builder Form Field Mapping Utilities
 *
 * This module provides comprehensive field mapping between mobile builder form data
 * and database columns for builder verification forms.
 */

import { logger } from '@/config/logger';
import { pickRelevantFieldsForFormType, MISSING_FIELD_DEFAULT } from './formFieldRelevance';

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile builder form fields to database columns
 * Covers all builder verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const BUILDER_FIELD_MAPPING: DatabaseFieldMapping = {
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

  // Builder/Office status and details (Form specific)
  officeStatus: 'office_status', // Used in POSITIVE, SHIFTED, NSP forms
  officeExistence: 'office_existence', // Used in NSP forms
  builderType: 'builder_type', // Used in POSITIVE forms
  businessType: 'builder_type', // Mobile sends businessType for Builder (maps to builder_type)
  ownershipType: 'ownership_type', // Used in POSITIVE forms
  addressStatus: 'address_status', // Used in POSITIVE forms
  nameOfCompanyOwners: 'builder_owner_name', // Maps to builder_owner_name
  approxArea: 'office_approx_area', // Alias for officeApproxArea
  businessExistance: 'office_existence', // NSP variant (Exist/Does Not Exist)
  businessExistsStatus: 'business_exists_status', // Builder ERT — dedicated column (split from office_existence)
  applicantExistance: 'applicant_existence', // Builder NSP — dedicated column (split from applicant_working_status)
  companyNatureOfBusiness: 'company_nature_of_business', // Used in POSITIVE forms
  businessPeriod: 'business_period', // Used in POSITIVE forms
  officeApproxArea: 'office_approx_area', // Used in POSITIVE forms
  staffStrength: 'staff_strength', // Used in POSITIVE forms
  staffSeen: 'staff_seen', // Used in POSITIVE forms

  // Builder/Person details (Form specific)
  metPerson: 'met_person_name', // Used in POSITIVE, SHIFTED, NSP forms
  metPersonName: 'met_person_name', // Alternative field name
  // 2026-04-27: Builder mobile field renamed `designation` → `metPersonDesignation`,
  // DB column renamed `designation` → `met_person_designation` (Path A unification).
  // Legacy `designation` LHS kept for grace period.
  designation: 'met_person_designation',
  metPersonDesignation: 'met_person_designation',
  builderOwnerName: 'builder_owner_name',

  // Document verification
  documentShown: 'document_shown',

  // Third Party Confirmation (TPC)
  tpcMetPerson1: 'tpc_met_person1',
  tpcName1: 'tpc_name1',
  tpcConfirmation1: 'tpc_confirmation1',
  tpcMetPerson2: 'tpc_met_person2',
  tpcName2: 'tpc_name2',
  tpcConfirmation2: 'tpc_confirmation2',

  // Shifted builder specific fields
  oldOfficeShiftedPeriod: 'old_office_shifted_period',
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
  companyName: 'company_nature_of_business', // Maps to company nature
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
//   - mapBuilderFormDataToDatabase(): zero call sites in any codebase. The submit
//     path uses validateAndPrepareBuilderForm() from builderFormValidator.ts;
//     this old camelCase→snake_case mapper was never wired up post-migration.
//   - processBuilderFieldValue() (private): only caller was the dead mapper above.
//   - getBuilderAvailableDbColumns(): zero call sites; only `_`-aliased import.
//   - getBuilderMappedMobileFields(): zero call sites anywhere.
// BUILDER_FIELD_MAPPING and ensureAllBuilderFieldsPopulated() stay alive (used by validator).

// 2026-04-26 P3 dead-code prune (per project_form_field_mapping_drift_audit.md):
// Removed validateBuilderRequiredFields() — zero call sites in any codebase
// after the prior session removed its _`-aliased import in
// mobileFormController.ts. The validator file (builderFormValidator.ts)
// calls validateAndPrepareBuilderForm() which has its own internal required-
// field check. The mapping-file required-list was dormant from day one.

/**
 * Ensures all database fields are populated with appropriate values or NULL defaults
 * This function guarantees that every database column has a value, preventing null/undefined issues
 *
 * @param mappedData - Already mapped form data
 * @param formType - Type of builder form
 * @returns Complete data object with all fields populated
 */
// 2026-04-26 Phase 4 dedup (formFieldRelevance.ts shared util).
// Per-type DATA stays here; logic moved to shared `pickRelevantFieldsForFormType`.
const RELEVANT_FIELDS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  POSITIVE: [
    'address_locatable',
    'address_rating',
    'office_status',
    'met_person_name',
    'met_person_designation',
    'builder_type',
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
    'office_approx_area',
    'staff_seen',
    'document_shown',
    // 2026-04-26: dropped 'document_type', 'project_name', 'project_type',
    //   'project_status', 'project_approval_status', 'project_completion_status' —
    //   not columns on builder_verification_reports.
    // 2026-04-26: dropped speculative columns not on builder_verification_reports schema:
    //   project_area, total_units, sold_units, construction_stage, approval_authority,
    //   rera_registration, rera_number, license_status, license_number
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
    'office_status',
    'met_person_name',
    'met_person_designation',
    'current_company_name',
    'old_office_shifted_period',
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
    'office_status',
    'office_existence',
    'applicant_existence',
    'met_person_name',
    'met_person_designation',
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

export function ensureAllBuilderFieldsPopulated(
  mappedData: Record<string, unknown>,
  formType: string
): Record<string, unknown> {
  const completeData = { ...mappedData };

  // Define all possible database fields for builder verification
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

    // Builder/Office status and details
    'office_status',
    'office_existence',
    'builder_type',
    'company_nature_of_business',
    'business_period',
    'office_approx_area',
    'staff_strength',
    'staff_seen',

    // Person details
    'met_person_name',
    'met_person_designation',
    'current_company_name',
    'old_office_shifted_period',
    // Removed 2026-04-19: applicant_working_premises — not a column on
    // builder_verification_reports; caused INSERT 42703 failures.

    // Project specific fields
    // Removed 2026-04-19: project_name, project_type, project_status,
    // project_approval_status, project_completion_status, project_area,
    // total_units, sold_units, construction_stage, approval_authority,
    // rera_registration, rera_number — speculative columns never added to
    // builder_verification_reports schema; blocked every Builder submit.

    // Document verification
    'document_shown',
    // Removed: document_type, license_status, license_number (not in DB schema).

    // Third Party Confirmation
    // Column names in DB are tpc_name1/tpc_name2, NOT name_of_tpc1/name_of_tpc2.
    'tpc_met_person1',
    'tpc_name1',
    'tpc_confirmation1',
    'tpc_met_person2',
    'tpc_name2',
    'tpc_confirmation2',

    // Entry restricted specific fields
    // 2026-04-26: dropped 'name_of_met_person' — DB column is met_person_name (already listed above).
    'met_person_type',
    'met_person_confirmation',
    'applicant_working_status',
    'applicant_existence',
    'business_exists_status',

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
        logger.warn(`⚠️ Missing relevant field for ${formType} builder form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = MISSING_FIELD_DEFAULT;
    }
  }

  return completeData;
}
