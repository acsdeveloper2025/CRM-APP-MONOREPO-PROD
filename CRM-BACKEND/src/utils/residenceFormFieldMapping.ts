/**
 * Residence Form Field Mapping Utilities
 *
 * This module provides comprehensive field mapping between mobile form data
 * and database columns for residence verification forms.
 */

import { logger } from '@/config/logger';
import { pickRelevantFieldsForFormType, MISSING_FIELD_DEFAULT } from './formFieldRelevance';

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile form fields to database columns
 * Covers all residence verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const RESIDENCE_FIELD_MAPPING: DatabaseFieldMapping = {
  // Basic case information
  outcome: null, // Handled separately as verification_outcome
  verificationOutcome: null, // Handled separately as verification_outcome
  remarks: 'remarks',
  finalStatus: 'final_status',

  // Address and location fields (Common to all forms)
  addressLocatable: 'address_locatable',
  addressRating: 'address_rating',
  locality: 'locality',
  addressStructure: 'address_structure',
  applicantStayingFloor: 'applicant_staying_floor',
  addressFloor: 'address_floor', // Alternative/generic field name
  addressStructureColor: 'address_structure_color',
  doorColor: 'door_color',
  doorNamePlateStatus: 'door_name_plate_status',
  nameOnDoorPlate: 'name_on_door_plate',
  societyNamePlateStatus: 'society_name_plate_status',
  nameOnSocietyBoard: 'name_on_society_board',

  // Landmarks (Common to all forms, untraceable has 4)
  landmark1: 'landmark1',
  landmark2: 'landmark2',
  landmark3: 'landmark3', // Used in untraceable forms
  landmark4: 'landmark4', // Used in untraceable forms

  // House and room status (Form specific)
  houseStatus: 'house_status', // Used in POSITIVE and NSP forms

  // Person details (Form specific)
  metPersonName: 'met_person_name', // Used in POSITIVE, SHIFTED, NSP forms
  metPersonRelation: 'met_person_relation', // Used in POSITIVE forms
  metPersonStatus: 'met_person_status', // Used in SHIFTED and NSP forms
  stayingPersonName: 'staying_person_name', // Used in NSP forms when house is closed
  totalFamilyMembers: 'total_family_members', // Used in POSITIVE forms
  totalEarningMember: 'total_earning_member', // How many earning members out of total family
  workingStatus: 'working_status', // Used in POSITIVE forms
  companyName: 'company_name', // Used in POSITIVE forms
  stayingPeriod: 'staying_period', // Used in POSITIVE and NSP forms
  stayingStatus: 'staying_status', // Used in POSITIVE forms
  approxArea: 'approx_area', // Used in POSITIVE forms

  // Document verification (POSITIVE forms only)
  documentShownStatus: 'document_shown_status',
  documentType: 'document_type',

  // Third Party Confirmation (TPC) - Used in POSITIVE, SHIFTED, NSP forms
  tpcMetPerson1: 'tpc_met_person1',
  nameOfTpc1: 'tpc_name1',
  tpcName1: 'tpc_name1', // Mobile emits this field name
  tpcConfirmation1: 'tpc_confirmation1',
  tpcMetPerson2: 'tpc_met_person2',
  nameOfTpc2: 'tpc_name2',
  tpcName2: 'tpc_name2', // Mobile emits this field name
  tpcConfirmation2: 'tpc_confirmation2',

  // Shifted residence specific fields
  shiftedPeriod: 'shifted_period',
  premisesStatus: 'premises_status',

  // Entry restricted specific fields
  nameOfMetPerson: 'met_person_name',
  // 2026-04-26 (P0-4 audit fix): `metPerson` LHS now routes to
  // `met_person_name` (the NAME column) — NOT `met_person_type` (the
  // role/type column). Office/Business/Builder/NOC/DSA/Property*/RCO
  // mappings already routed `metPerson` → `met_person_name`; residence
  // was the lone outlier. Mobile residence schema never emits
  // `metPerson` (it uses `metPersonName` for non-ERT and `metPersonType`
  // for ERT), but the legacy alias is kept per the office-naming-
  // unification grace-period rule. Now routed correctly so any client
  // that does send it has the value land in the name column.
  metPerson: 'met_person_name',
  metPersonType: 'met_person_type',
  metPersonConfirmation: 'met_person_confirmation',
  applicantStayingStatus: 'applicant_staying_status',

  // Untraceable specific fields
  contactPerson: 'contact_person',
  callRemark: 'call_remark',

  // Environment and area details (Common to all forms)
  politicalConnection: 'political_connection',
  dominatedArea: 'dominated_area',
  feedbackFromNeighbour: 'feedback_from_neighbour',
  otherObservation: 'other_observation',

  // Legacy/alternative field names for backward compatibility
  applicantName: 'met_person_name', // Maps to met_person_name
  addressConfirmed: null, // Derived field, ignore
  residenceType: 'house_status', // Maps to house_status
  familyMembers: 'total_family_members', // Maps to total_family_members
  neighborVerification: null, // Derived field, ignore

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
// Removed 4 dead exports + 1 dead private helper:
//   - mapFormDataToDatabase(): zero call sites in any codebase. The submit
//     path uses validateAndPrepareResidenceForm() from residenceFormValidator.ts;
//     this old camelCase→snake_case mapper was never wired up post-migration.
//   - processFieldValue() (private): only caller was the dead mapper above.
//   - getAvailableDbColumns(): zero call sites; only commented-out import.
//   - getMappedMobileFields(): zero call sites anywhere.
// Cross-checked against CRM-FRONTEND, crm-mobile-native, scripts/, tests:
// the form-submission-display path uses convertReportToFormData() in
// mobileFormController.ts (manually-mapped, hardcoded snake→camel) and
// createComprehensiveFormSections() from comprehensiveFormFieldMapping.ts —
// neither touches the deleted exports. RESIDENCE_FIELD_MAPPING and
// ensureAllFieldsPopulated() stay alive (used by validator file).
//
// Also previously removed dormant validateRequiredFields() (P4 fix).

/**
 * Ensures all database fields are populated with appropriate values or 'na' defaults
 * This function guarantees that every database column has a value, preventing null/undefined issues
 *
 * @param mappedData - Already mapped form data
 * @param formType - Type of residence form
 * @returns Complete data object with all fields populated
 */
// 2026-04-26 Phase 4 dedup (formFieldRelevance.ts shared util).
// Per-type DATA stays here; logic moved to shared `pickRelevantFieldsForFormType`.
const RELEVANT_FIELDS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  POSITIVE: [
    'address_locatable',
    'address_rating',
    'house_status',
    'met_person_name',
    'met_person_relation',
    'total_family_members',
    'working_status',
    'staying_period',
    'staying_status',
    'document_shown_status',
    'tpc_met_person1',
    'locality',
    'address_structure',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
    'total_earning_member',
    'company_name',
    'approx_area',
    'document_type',
    'tpc_name1',
    'tpc_confirmation1',
    'applicant_staying_floor',
    'address_structure_color',
    'door_color',
    'door_name_plate_status',
    'name_on_door_plate',
    'society_name_plate_status',
    'name_on_society_board',
    'landmark1',
    'landmark2',
  ],
  SHIFTED: [
    'address_locatable',
    'address_rating',
    'met_person_name',
    'met_person_status',
    'shifted_period',
    'tpc_met_person1',
    'premises_status',
    'locality',
    'address_structure',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
    'tpc_name1',
    'address_floor',
    'address_structure_color',
    'door_color',
    'door_name_plate_status',
    'name_on_door_plate',
    'society_name_plate_status',
    'name_on_society_board',
    'landmark1',
    'landmark2',
  ],
  NSP: [
    'address_locatable',
    'address_rating',
    'house_status',
    'locality',
    'address_structure',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
    'met_person_name',
    'met_person_status',
    'staying_person_name',
    'staying_period',
    'address_floor',
    'address_structure_color',
    'door_color',
    'door_name_plate_status',
    'name_on_door_plate',
    'society_name_plate_status',
    'name_on_society_board',
    'landmark1',
    'landmark2',
  ],
  ENTRY_RESTRICTED: [
    'address_locatable',
    'address_rating',
    'met_person_name',
    'met_person_type',
    'met_person_confirmation',
    'applicant_staying_status',
    'locality',
    'address_structure',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
    'address_floor',
    'address_structure_color',
    'society_name_plate_status',
    'name_on_society_board',
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

export function ensureAllFieldsPopulated(
  mappedData: Record<string, unknown>,
  formType: string
): Record<string, unknown> {
  const completeData = { ...mappedData };

  // Define all possible database fields for residence verification
  const allDatabaseFields = [
    // Address and location fields
    'address_locatable',
    'address_rating',
    'locality',
    'address_structure',
    'address_floor',
    'applicant_staying_floor',
    'address_structure_color',
    'door_color',
    'door_name_plate_status',
    'name_on_door_plate',
    'society_name_plate_status',
    'name_on_society_board',

    // Landmarks
    'landmark1',
    'landmark2',
    'landmark3',
    'landmark4',

    // House and room status
    'house_status',

    // Person details
    'met_person_name',
    'met_person_relation',
    'met_person_status',
    'staying_person_name',
    'total_family_members',
    'total_earning_member',
    'working_status',
    'company_name',
    'staying_period',
    'staying_status',
    'approx_area',

    // Document verification
    'document_shown_status',
    'document_type',

    // Third Party Confirmation
    'tpc_met_person1',
    'tpc_name1',
    'tpc_confirmation1',
    'tpc_met_person2',
    'tpc_name2',
    'tpc_confirmation2',

    // Form specific fields
    'shifted_period',
    'premises_status',
    // 2026-04-26: dropped duplicate 'name_of_met_person' — column was
    // renamed to met_person_name (already on line 412); pre-fix every
    // residence INSERT failed 42703 "column name_of_met_person does not
    // exist". See project_form_field_mapping_drift_audit.md.
    'met_person_type',
    'met_person_confirmation',
    'applicant_staying_status',
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
        logger.warn(`⚠️ Missing relevant field for ${formType} form: ${field}`);
      }

      // Set default value based on field type
      completeData[field] = MISSING_FIELD_DEFAULT;
    }
  }

  return completeData;
}
