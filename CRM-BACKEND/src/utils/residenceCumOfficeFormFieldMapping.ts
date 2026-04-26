/**
 * Residence-cum-Office Form Field Mapping Utilities
 *
 * This module provides comprehensive field mapping between mobile residence-cum-office form data
 * and database columns for residence-cum-office verification forms.
 */

import { logger } from '@/config/logger';
import { pickRelevantFieldsForFormType, MISSING_FIELD_DEFAULT } from './formFieldRelevance';

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile residence-cum-office form fields to database columns
 * Covers all residence-cum-office verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 * This combines both residence and office verification aspects
 */
export const RESIDENCE_CUM_OFFICE_FIELD_MAPPING: DatabaseFieldMapping = {
  // Basic form information
  outcome: null, // Handled separately as verification_outcome
  remarks: 'remarks',
  finalStatus: 'final_status',
  resiCumOfficeStatus: null, // Handled specially: mirrored to house_status + office_status in mapper

  // Address and location fields (Common to all forms)
  addressLocatable: 'address_locatable',
  addressRating: 'address_rating',
  locality: 'locality',
  addressStructure: 'address_structure',
  addressFloor: 'address_floor',
  addressStructureColor: 'address_structure_color',
  doorColor: 'door_color',
  companyNamePlateStatus: 'company_name_plate_status',
  nameOnBoard: 'name_on_board',
  doorNamePlateStatus: 'door_name_plate_status',
  nameOnDoorPlate: 'name_on_door_plate',
  societyNamePlateStatus: 'society_name_plate_status',
  nameOnSocietyBoard: 'name_on_society_board',

  // Landmarks (Common to all forms, untraceable may have more)
  landmark1: 'landmark1',
  landmark2: 'landmark2',
  landmark3: 'landmark3', // Used in untraceable forms
  landmark4: 'landmark4', // Used in untraceable forms

  // Residence-specific fields (Form specific)
  metPersonName: 'met_person_name', // Used in POSITIVE, SHIFTED, NSP forms
  metPersonRelation: 'met_person_relation', // Used in POSITIVE forms
  stayingPeriod: 'staying_period',
  stayingPersonName: 'staying_person_name', // Maps to staying_person_name column
  stayingStatus: 'staying_status',
  approxArea: 'approx_area',
  documentShownStatus: 'document_shown_status',
  documentType: 'document_type',

  // Office-specific fields
  sittingLocation: 'sitting_location',
  companyNatureOfBusiness: 'company_nature_of_business',
  businessPeriod: 'business_period',
  officeApproxArea: 'approx_area', // Maps to approx_area column (shared with residence area)

  // Third Party Confirmation (TPC)
  tpcMetPerson1: 'tpc_met_person1',
  nameOfTpc1: 'tpc_name1',
  tpcName1: 'tpc_name1', // Alternative field name for TPC name 1
  tpcConfirmation1: 'tpc_confirmation1',
  tpcMetPerson2: 'tpc_met_person2',
  nameOfTpc2: 'tpc_name2',
  tpcName2: 'tpc_name2', // Alternative field name for TPC name 2
  tpcConfirmation2: 'tpc_confirmation2',

  // Shifted specific fields
  shiftedPeriod: 'shifted_period',

  // Entry restricted specific fields
  nameOfMetPerson: 'met_person_name',
  metPersonType: 'met_person_type',
  metPersonConfirmation: 'met_person_confirmation',
  applicantWorkingStatus: 'applicant_working_status',
  applicantStayingStatus: 'applicant_staying_status',

  // Untraceable specific fields
  contactPerson: 'contact_person',
  callRemark: 'call_remark',

  // Environment and area details
  politicalConnection: 'political_connection',
  dominatedArea: 'dominated_area',
  feedbackFromNeighbour: 'feedback_from_neighbour',
  otherObservation: 'other_observation',

  // Legacy/alternative field names
  metPerson: 'met_person_name', // Maps to met person name

  // Additional mobile form fields that need mapping or ignoring
  residenceSetup: 'residence_setup', // SIGHTED AS / NOT SIGHTED — dedicated column (added 2026-04-18)
  businessSetup: 'business_setup', // SIGHTED AS / NOT SIGHTED — dedicated column (added 2026-04-18)
  relation: 'met_person_relation', // Maps to met person relation
  businessStatus: 'business_status', // Self Employee - Proprietorship / Partnership Firm / Private Limited — dedicated column (was colliding with office_status before 2026-04-18)
  businessLocation: 'sitting_location', // Maps to sitting location (At Same Address / From Different Address)
  businessOperatingAddress: 'business_operating_address', // Conditional text when businessLocation = 'From Different Address' — dedicated column (added 2026-04-18)
  applicantStayingFloor: 'address_floor', // Maps to address floor
  businessNature: 'company_nature_of_business', // Maps to business nature
  verificationMethod: null, // Derived field, ignore

  // Additional form-specific fields from mobile components (avoiding duplicates)
  metPersonStatus: 'met_person_status', // Maps to met person status
  addressTraceable: 'address_locatable', // Alternative name for address locatable
  fullAddress: null, // No full_address column — address is on verification_tasks

  // Business/Office related fields (avoiding duplicates)
  businessOperatingHours: null, // Ignore - not in database

  // Residence related fields
  ownershipStatus: 'staying_status', // Maps to staying status

  // Document related fields
  documentShown: 'document_shown_status', // Maps to document shown status
  documentTypes: 'document_type', // Maps to document type
  idProofShown: 'document_shown_status', // Alternative for document shown

  // Additional comprehensive field mappings from all form types
  residenceConfirmed: null, // Ignore - derived field
  officeConfirmed: null, // Ignore - derived field
  nameOnNamePlate: 'name_on_door_plate', // Maps to name on door plate
  nameOnSocietyNamePlate: 'name_on_society_board', // Maps to society board name
  nameOnCompanyNamePlate: 'name_on_board', // Maps to company board name
  shiftedFrom: 'shifted_period', // Maps to shifted period
  oldOfficeAddress: null, // Ignore - not in database
  newOfficeAddress: null, // Ignore - not in database
  reasonForShift: null, // Ignore - not in database
  verificationOutcome: null, // Handled separately
  submissionDate: null, // Ignore - auto-generated
  submissionTime: null, // Ignore - auto-generated
  geoLocation: null, // Ignore - handled separately
  photoCount: null, // Ignore - calculated field
  formType: null, // Ignore - handled separately
  caseNumber: null, // Ignore - from case data
  assignedAgent: null, // Ignore - from case data

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
// Removed 4 dead exports + 1 dead private helper from this file (split across
// this comment and a second one further down before the getAvailable/getMapped
// pair, since the live ensureAll/getRelevant/getDefault helpers sit between):
//   - mapResidenceCumOfficeFormDataToDatabase(): zero call sites in any
//     codebase. The submit path uses validateAndPrepareResidenceCumOfficeForm()
//     from residenceCumOfficeFormValidator.ts; this old camelCase→snake_case
//     mapper was never wired up post-migration.
//   - processResidenceCumOfficeFieldValue() (private): only caller was the
//     dead mapper above.
//   - getResidenceCumOfficeAvailableDbColumns(): zero call sites; only
//     `_`-aliased import (see further-down breadcrumb).
//   - getResidenceCumOfficeMappedMobileFields(): zero call sites anywhere
//     (see further-down breadcrumb).
// RESIDENCE_CUM_OFFICE_FIELD_MAPPING and ensureAllResidenceCumOfficeFieldsPopulated()
// stay alive (used by validator).

/**
 * Ensures all database fields are populated with appropriate values or NULL defaults
 * This function guarantees that every database column has a value, preventing null/undefined issues
 *
 * @param mappedData - Already mapped form data
 * @param formType - Type of residence-cum-office form
 * @returns Complete data object with all fields populated
 */
// 2026-04-26 Phase 4 dedup (formFieldRelevance.ts shared util).
// Per-type DATA stays here; logic moved to shared `pickRelevantFieldsForFormType`.
const RELEVANT_FIELDS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  POSITIVE: [
    // Address and location
    'address_locatable',
    'address_rating',
    'locality',
    'address_structure',
    'address_floor',
    'address_structure_color',
    'door_color',
    'company_name_plate_status',
    'name_on_board',
    'door_name_plate_status',
    'name_on_door_plate',
    'society_name_plate_status',
    'name_on_society_board',
    'landmark1',
    'landmark2',
    // Residence fields
    'met_person_name',
    'met_person_relation',
    'staying_period',
    'staying_status',
    'approx_area',
    'document_shown_status',
    'document_type',
    // Office fields
    'company_nature_of_business',
    'business_period',
    // TPC and environment
    'tpc_met_person1',
    'tpc_name1',
    'tpc_confirmation1',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
  ],
  SHIFTED: [
    'address_locatable',
    'address_rating',
    'locality',
    'address_structure',
    'address_floor',
    'address_structure_color',
    'door_color',
    'company_name_plate_status',
    'name_on_board',
    'door_name_plate_status',
    'name_on_door_plate',
    'society_name_plate_status',
    'name_on_society_board',
    'landmark1',
    'landmark2',
    'met_person_name',
    'shifted_period',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
  ],
  NSP: [
    'address_locatable',
    'address_rating',
    'locality',
    'address_structure',
    'address_floor',
    'address_structure_color',
    'door_color',
    'company_name_plate_status',
    'name_on_board',
    'door_name_plate_status',
    'name_on_door_plate',
    'society_name_plate_status',
    'name_on_society_board',
    'landmark1',
    'landmark2',
    'met_person_name',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
  ],
  ENTRY_RESTRICTED: [
    'address_locatable',
    'address_rating',
    'locality',
    'address_structure',
    'address_floor',
    'address_structure_color',
    'company_name_plate_status',
    'name_on_board',
    'society_name_plate_status',
    'name_on_society_board',
    'landmark1',
    'landmark2',
    // 2026-04-26: column renamed; was 'name_of_met_person'
    'met_person_name',
    'met_person_type',
    'met_person_confirmation',
    'applicant_staying_status',
    'applicant_working_status',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
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

export function ensureAllResidenceCumOfficeFieldsPopulated(
  mappedData: Record<string, unknown>,
  formType: string
): Record<string, unknown> {
  const completeData = { ...mappedData };

  // Define all possible database fields for residence-cum-office verification
  const allDatabaseFields = [
    // Address and location fields
    'address_locatable',
    'address_rating',
    'locality',
    'address_structure',
    'address_floor',
    'address_structure_color',
    'door_color',
    'company_name_plate_status',
    'name_on_board',
    'door_name_plate_status',
    'name_on_door_plate',
    'society_name_plate_status',
    'name_on_society_board',

    // Landmarks
    'landmark1',
    'landmark2',
    'landmark3',
    'landmark4',

    // Residence-specific fields
    'met_person_name',
    'met_person_relation',
    'staying_period',
    'staying_status',
    'approx_area',
    'document_shown_status',
    'document_type',

    // Office-specific fields
    'company_nature_of_business',
    'business_period',

    // Third Party Confirmation
    'tpc_met_person1',
    'tpc_name1',
    'tpc_confirmation1',
    'tpc_met_person2',
    'tpc_name2',
    'tpc_confirmation2',

    // Form specific fields
    'shifted_period',
    // 2026-04-26: dropped duplicate 'name_of_met_person' — column was renamed
    //   to met_person_name (already listed above).
    'met_person_type',
    'met_person_confirmation',
    'applicant_staying_status',
    'applicant_working_status',
    'call_remark',
    'contact_person',

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
        logger.warn(
          `⚠️ Missing relevant field for ${formType} residence-cum-office form: ${field}`
        );
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = MISSING_FIELD_DEFAULT;
    }
  }

  return completeData;
}

// 2026-04-26 P3 dead-code prune (continued): getResidenceCumOfficeAvailableDbColumns()
// and getResidenceCumOfficeMappedMobileFields() removed here. See top breadcrumb
// in this file for full context.

// 2026-04-26 Finding-#2 prune (per project_form_field_mapping_drift_audit.md):
// Removed dormant validateResidenceCumOfficeRequiredFields() — zero call sites
// in any codebase. The controller calls validateAndPrepareResidenceCumOfficeForm
// from residenceCumOfficeFormValidator.ts (the validator file's own required-list
// is the authority). Same prune as the other 5 type-prefixed validates already
// removed (builder/noc/dsa/apf/propind) by the bulk Phase 2 sub-agent.
