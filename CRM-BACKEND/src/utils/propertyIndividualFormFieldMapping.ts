/**
 * Property Individual Form Field Mapping Utilities
 *
 * This module provides comprehensive field mapping between mobile Property Individual form data
 * and database columns for Property Individual verification forms.
 */

import { logger } from '@/config/logger';
import { pickRelevantFieldsForFormType, MISSING_FIELD_DEFAULT } from './formFieldRelevance';

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile Property Individual form fields to database columns
 * Covers all Property Individual verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const PROPERTY_INDIVIDUAL_FIELD_MAPPING: DatabaseFieldMapping = {
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

  // Building and property status fields (from mobile form)
  buildingStatus: 'property_status', // Map building status to property status
  flatStatus: 'premises_status', // Map flat status to premises status

  // Landmarks (Common to all forms, untraceable may have more)
  landmark1: 'landmark1',
  landmark2: 'landmark2',
  landmark3: 'landmark3', // Used in untraceable forms
  landmark4: 'landmark4', // Used in untraceable forms

  // Property-specific fields (Form specific)
  propertyStatus: 'property_status', // Used in POSITIVE, NSP forms
  propertyArea: 'property_area', // Used in POSITIVE forms

  // Individual owner details
  ownerName: 'owner_name',

  // Property documents

  // Met person details
  metPersonName: 'met_person_name',
  metPersonDesignation: 'met_person_designation',
  metPersonRelation: 'met_person_relation',
  nameOfMetPerson: 'met_person_name', // Entry Restricted form field
  metPersonConfirmation: 'security_confirmation', // Entry Restricted form field

  // Neighbors and locality

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
  securityConfirmation: 'security_confirmation',

  // Untraceable specific fields
  contactPerson: 'contact_person',
  callRemark: 'call_remark',

  // Individual details (mobile sends these for Property Individual forms)

  // Legal and financial

  // Utilities and infrastructure

  // Area and environment
  politicalConnection: 'political_connection',
  dominatedArea: 'dominated_area',
  feedbackFromNeighbour: 'feedback_from_neighbour',

  // Observations and remarks
  otherObservation: 'other_observation',

  // Legacy/alternative field names and mobile app specific fields
  metPerson: 'met_person_name', // Maps to met person name
  propertyOwner: 'owner_name', // Maps to owner name
  propertyOwnerName: 'owner_name', // Maps property owner name to owner name
  neighborFeedback: 'feedback_from_neighbour', // Maps to neighbor feedback
  verificationMethod: null, // Derived field, ignore
  relationship: 'met_person_relation', // Maps to met person relation
  approxArea: 'property_area', // Maps to property area

  // Mobile app specific fields mapped to DB equivalents
  metPersonStatus: null, // No direct DB column, ignore
  metPersonType: 'met_person_designation', // ERT met person role (Security/Receptionist)

  // Property Individual Positive xlsx fields
  addressExistAt: 'address_exist_at',
  doorNamePlateStatus: 'door_name_plate_status',
  nameOnDoorPlate: 'name_on_door_plate',
  societyNamePlateStatus: 'society_name_plate',
  nameOnSocietyBoard: 'name_on_society_board',
  companyNamePlateStatus: null, // No database equivalent, ignore
  nameOnBoard: null, // No database equivalent, ignore

  // Fields to ignore (UI state, images, etc.)
  images: null,
  selfieImages: null,
  id: null,
  caseId: null,
  timestamp: null,
  isValid: null,
  errors: null,
  formType: null, // Handled separately
  attachmentIds: null, // Handled separately
  geoLocation: null, // Handled separately
};

// 2026-04-26 P3 dead-code prune (per project_form_field_mapping_drift_audit.md):
// Removed 4 dead exports + 1 dead private helper from this file:
//   - mapPropertyIndividualFormDataToDatabase(): zero call sites in any codebase.
//     The submit path uses validateAndPreparePropertyIndividualForm() from
//     propertyIndividualFormValidator.ts; this old camelCase→snake_case mapper
//     was never wired up post-migration.
//   - processPropertyIndividualFieldValue() (private): only caller was the dead
//     mapper above.
//   - getPropertyIndividualAvailableDbColumns(): zero call sites; only `_`-aliased
//     import.
//   - getPropertyIndividualMappedMobileFields(): zero call sites anywhere.
// PROPERTY_INDIVIDUAL_FIELD_MAPPING and ensureAllPropertyIndividualFieldsPopulated()
// stay alive (used by validator).

// 2026-04-26 P3 dead-code prune (per project_form_field_mapping_drift_audit.md):
// Removed validatePropertyIndividualRequiredFields() — zero call sites in any
// codebase after the prior session removed its _`-aliased import in
// mobileFormController.ts. The validator file (propertyIndividualFormValidator.ts)
// calls validateAndPreparePropertyIndividualForm() which has its own internal
// required-field check. The mapping-file required-list was dormant from day one.

/**
 * Ensures all database fields are populated with appropriate values or NULL defaults
 * This function guarantees that every database column has a value, preventing null/undefined issues
 *
 * @param mappedData - Already mapped form data
 * @param formType - Type of Property Individual form
 * @returns Complete data object with all fields populated
 */
// 2026-04-26 Phase 4 dedup (formFieldRelevance.ts shared util).
// Per-type DATA stays here; logic moved to shared `pickRelevantFieldsForFormType`.
const RELEVANT_FIELDS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  POSITIVE: [
    'address_locatable',
    'address_rating',
    'property_status',
    'property_area',
    // 2026-04-26: dropped 'contact_number', 'document_shown', 'document_type' —
    //   not columns on property_individual_verification_reports.
    'met_person_name',
    'met_person_relation',
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
    'tpc_met_person1',
    // 2026-04-26: column renamed; was 'name_of_tpc1'
    'tpc_name1',
    'tpc_confirmation1',
    // 2026-04-26: dropped 'reference1_name', 'reference1_contact' —
    //   not columns on property_individual_verification_reports.
    'premises_status',
  ],
  SHIFTED: [
    'address_locatable',
    'address_rating',
    'met_person_name',
    'met_person_relation',
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
    'property_status',
    'met_person_name',
    'met_person_relation',
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
    // 2026-04-26: dropped 'met_person_type', 'met_person_confirmation' —
    //   not columns on property_individual_verification_reports.
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

export function ensureAllPropertyIndividualFieldsPopulated(
  mappedData: Record<string, unknown>,
  formType: string
): Record<string, unknown> {
  const completeData = { ...mappedData };

  // Define all existing database fields for Property Individual verification (only fields that exist in DB)
  const allDatabaseFields = [
    // Address and location fields
    'address_locatable',
    'address_rating',
    'locality',
    'address_structure',
    'address_structure_color',
    'door_color',
    'premises_status',

    // Landmarks
    'landmark1',
    'landmark2',
    'landmark3',
    'landmark4',

    // Property-specific fields
    'property_status',
    'property_area',

    // Individual/Personal details

    // Employment details

    // Financial details

    // Verification details
    'met_person_name',
    'met_person_relation',
    'met_person_designation',

    // Third Party Confirmation
    'tpc_met_person1',
    'tpc_name1',
    'tpc_confirmation1',
    'tpc_met_person2',
    'tpc_name2',
    'tpc_confirmation2',

    // Form specific fields
    'call_remark',
    'contact_person',
    'security_confirmation',

    // Legal and compliance

    // Environment and area details
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',

    // Owner details
    'owner_name',

    // Infrastructure and utilities

    // Property documents and status

    // Neighbors

    // Verification challenges

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
        logger.warn(`⚠️ Missing relevant field for ${formType} Property Individual form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = MISSING_FIELD_DEFAULT;
    }
  }

  return completeData;
}
