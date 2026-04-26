/**
 * NOC Form Field Mapping Utilities
 *
 * This module provides comprehensive field mapping between mobile NOC form data
 * and database columns for NOC verification forms.
 */

import { logger } from '@/config/logger';
import { pickRelevantFieldsForFormType, MISSING_FIELD_DEFAULT } from './formFieldRelevance';

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
  // 2026-04-26: dropped 'otherExtraRemark: other_extra_remark' — column does
  //   not exist on noc_verification_reports.
  // NOC ERT uses dedicated name_of_met_person / met_person_confirmation columns.
  // Prior aliases mapped these to security_person_name / security_confirmation
  // which are LEGACY ERT columns — causing ERT data loss (fixed 2026-04-19).
  nameOfMetPerson: 'met_person_name',
  metPersonConfirmation: 'met_person_confirmation',
  applicantExistance: 'applicant_existence',
  businessExistance: 'business_existence',

  // Property/Project details (Form specific)

  // Builder/Developer information

  // Met person details
  metPersonName: 'met_person_name',
  metPersonDesignation: 'met_person_designation',

  // Document verification

  // Third Party Confirmation (TPC)
  tpcMetPerson1: 'tpc_met_person1',
  nameOfTpc1: 'tpc_name1',
  tpcConfirmation1: 'tpc_confirmation1',
  tpcMetPerson2: 'tpc_met_person2',
  nameOfTpc2: 'tpc_name2',
  tpcConfirmation2: 'tpc_confirmation2',

  // Shifted specific fields
  premisesStatus: 'premises_status',

  // Entry restricted specific fields

  // Untraceable specific fields
  contactPerson: 'contact_person',
  callRemark: 'call_remark',

  // Environment and compliance

  // Area and infrastructure
  politicalConnection: 'political_connection',
  dominatedArea: 'dominated_area',
  feedbackFromNeighbour: 'feedback_from_neighbour',

  // Observations and remarks
  otherObservation: 'other_observation',

  // Legacy/alternative field names
  metPerson: 'met_person_name', // Maps to met person name
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
//   - mapNocFormDataToDatabase(): zero call sites in any codebase. The submit
//     path uses validateAndPrepareNocForm() from nocFormValidator.ts;
//     this old camelCase→snake_case mapper was never wired up post-migration.
//   - processNocFieldValue() (private): only caller was the dead mapper above.
//   - getNocAvailableDbColumns(): zero call sites; only `_`-aliased import.
//   - getNocMappedMobileFields(): zero call sites anywhere.
// NOC_FIELD_MAPPING and ensureAllNocFieldsPopulated() stay alive (used by validator).

// 2026-04-26 P3 dead-code prune (per project_form_field_mapping_drift_audit.md):
// Removed validateNocRequiredFields() — zero call sites in any codebase
// after the prior session removed its _`-aliased import in
// mobileFormController.ts. The validator file (nocFormValidator.ts)
// calls validateAndPrepareNocForm() which has its own internal required-
// field check. The mapping-file required-list was dormant from day one.

/**
 * Ensures all database fields are populated with appropriate values or NULL defaults
 * This function guarantees that every database column has a value, preventing null/undefined issues
 *
 * @param mappedData - Already mapped form data
 * @param formType - Type of NOC form
 * @returns Complete data object with all fields populated
 */
// 2026-04-26 Phase 4 dedup (formFieldRelevance.ts shared util).
// Per-type DATA stays here; logic moved to shared `pickRelevantFieldsForFormType`.
const RELEVANT_FIELDS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  POSITIVE: [
    'address_locatable',
    'address_rating',
    'contact_person',
    // 2026-04-26: dropped 'municipal_approval', 'document_shown' — not columns
    //   on noc_verification_reports.
    'met_person_name',
    // 2026-04-26: column renamed; was 'designation'
    'met_person_designation',
    'locality',
    'address_structure',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
    // 2026-04-26: dropped 'project_area', 'contact_number', 'builder_license_number' —
    //   not columns on noc_verification_reports.
    'tpc_met_person1',
    // 2026-04-26: column renamed; was 'name_of_tpc1'
    'tpc_name1',
    'tpc_confirmation1',
    'address_structure_color',
    'door_color',
    'landmark1',
    'landmark2',
  ],
  SHIFTED: [
    'address_locatable',
    'address_rating',
    'met_person_name',
    // 2026-04-26: column renamed; was 'designation'
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
    'landmark1',
    'landmark2',
  ],
  NSP: [
    'address_locatable',
    'address_rating',
    'met_person_name',
    // 2026-04-26: column renamed; was 'designation'
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
    'locality',
    'address_structure',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
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
    'address_structure_color',
    'door_color',

    // Landmarks
    'landmark1',
    'landmark2',
    'landmark3',
    'landmark4',

    // Office status + NOC-specific fields
    'office_status',
    'authorised_signature',
    'name_on_noc',
    'flat_no',

    // Property/Project details

    // Builder/Developer details
    'contact_person',

    // Regulatory and compliance (actual DB columns)

    // Document verification

    // Person details
    'met_person_name',
    'met_person_designation',

    // Third Party Confirmation (correct DB column names)
    'tpc_met_person1',
    'tpc_name1',
    'tpc_confirmation1',
    'tpc_met_person2',
    'tpc_name2',
    'tpc_confirmation2',

    // Form-specific fields
    'premises_status',
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
        logger.warn(`⚠️ Missing relevant field for ${formType} NOC form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = MISSING_FIELD_DEFAULT;
    }
  }

  return completeData;
}
