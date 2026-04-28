/**
 * Property APF Form Field Mapping Utilities
 *
 * This module provides comprehensive field mapping between mobile Property APF form data
 * and database columns for Property APF verification forms.
 */

import { logger } from '@/config/logger';
import { pickRelevantFieldsForFormType, MISSING_FIELD_DEFAULT } from './formFieldRelevance';

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile Property APF form fields to database columns
 * Covers all Property APF verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const PROPERTY_APF_FIELD_MAPPING: DatabaseFieldMapping = {
  // Basic form information
  outcome: null, // Handled separately as verification_outcome
  verificationOutcome: null, // Handled separately as verification_outcome
  remarks: 'remarks',
  finalStatus: 'final_status',
  // Mobile APF uses two conditional sibling fields for Final Status —
  // `finalStatus` is shown when constructionActivity=SEEN, and
  // `finalStatusNegative` is shown when constructionActivity is
  // STOP/VACANT. Both map to the same DB column. At most one is sent
  // per submission; the backend controller coalesces them.
  finalStatusNegative: 'final_status',

  // Address and location fields (Common to all forms)
  addressLocatable: 'address_locatable',
  addressRating: 'address_rating',
  locality: 'locality',

  // Landmarks (Common to all forms, untraceable may have more)
  landmark1: 'landmark1',
  landmark2: 'landmark2',
  landmark3: 'landmark3', // Used in untraceable forms
  landmark4: 'landmark4', // Used in untraceable forms

  // Property-specific fields (Form specific)
  buildingStatus: 'building_status', // Entry Restricted form field
  constructionActivity: 'construction_activity', // Construction activity field
  activityStopReason: 'activity_stop_reason', // Activity stop reason field

  // APF-specific fields (Form specific)

  // Project details
  // 2026-04-27 F2 dead-alias prune: dropped projectCompletionPercentage, projectStartDate,
  // projectEndDate — not in mobile SSOT (legacyPositivePropertyApfFields). Mobile sends
  // canonical `projectCompletionPercent`/`projectStartedDate`/`projectCompletionDate`.
  projectName: 'project_name',
  projectCompletionPercent: 'project_completion_percentage',
  projectStartedDate: 'project_started_date',
  projectCompletionDate: 'project_completion_date',
  totalWing: 'total_wing',
  totalFlats: 'total_flats',
  staffStrength: 'staff_strength',
  staffSeen: 'staff_seen',

  // Builder/Developer information

  // Financial details

  // Met person details
  metPersonName: 'met_person_name',
  metPersonDesignation: 'met_person_designation',
  nameOfMetPerson: 'met_person_name', // Entry Restricted form field
  metPersonConfirmation: 'met_person_confirmation', // Entry Restricted form field
  // 2026-04-27: Property APF mobile field renamed `designation` → `metPersonDesignation`
  // (mapping at line 69 covers it). Dead `designation` DB column dropped same date.

  // Document verification

  // Third Party Confirmation (TPC)
  tpcMetPerson1: 'tpc_met_person1',
  tpcName1: 'tpc_name1',
  tpcConfirmation1: 'tpc_confirmation1',
  tpcMetPerson2: 'tpc_met_person2',
  tpcName2: 'tpc_name2',
  tpcConfirmation2: 'tpc_confirmation2',

  // Shifted specific fields

  // Entry restricted specific fields

  // Untraceable specific fields
  contactPerson: 'contact_person',
  callRemark: 'call_remark',

  // Legal and compliance

  // Area and infrastructure
  politicalConnection: 'political_connection',
  dominatedArea: 'dominated_area',
  feedbackFromNeighbour: 'feedback_from_neighbour',

  // Observations and remarks
  otherObservation: 'other_observation',

  // Legacy/alternative field names
  // 2026-04-27 F2 dead-alias prune: dropped `metPerson` (use canonical metPersonName)
  // and `projectDetails` (use canonical projectName). Not in mobile SSOT.
  // 2026-04-27 F2 ERT correction: metPersonType is its OWN column (matches
  // residence/rco/office/business/builder/noc pattern). Was incorrectly
  // overloaded onto met_person_designation — fixed below.
  metPersonType: 'met_person_type',
  companyNamePlateStatus: 'company_name_plate_status', // Company name plate status (unified naming with peer forms)
  nameOnBoard: 'name_on_board', // Name on board field
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
//   - mapPropertyApfFormDataToDatabase(): zero call sites in any codebase. The
//     submit path uses validateAndPreparePropertyApfForm() from
//     propertyApfFormValidator.ts; this old camelCase→snake_case mapper was
//     never wired up post-migration.
//   - processPropertyApfFieldValue() (private): only caller was the dead mapper.
//   - getPropertyApfAvailableDbColumns(): zero call sites; only `_`-aliased import.
//   - getPropertyApfMappedMobileFields(): zero call sites anywhere.
// PROPERTY_APF_FIELD_MAPPING and ensureAllPropertyApfFieldsPopulated() stay
// alive (used by validator).

// 2026-04-26 P3 dead-code prune (per project_form_field_mapping_drift_audit.md):
// Removed validatePropertyApfRequiredFields() — zero call sites in any codebase
// after the prior session removed its _`-aliased import in
// mobileFormController.ts. The validator file (propertyApfFormValidator.ts)
// calls validateAndPreparePropertyApfForm() which has its own internal required-
// field check. The mapping-file required-list was dormant from day one.

/**
 * Ensures all database fields are populated with appropriate values or NULL defaults
 * This function guarantees that every database column has a value, preventing null/undefined issues
 *
 * @param mappedData - Already mapped form data
 * @param formType - Type of Property APF form
 * @returns Complete data object with all fields populated
 */
// 2026-04-26 Phase 4 dedup (formFieldRelevance.ts shared util).
// Per-type DATA stays here; logic moved to shared `pickRelevantFieldsForFormType`.
const RELEVANT_FIELDS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  POSITIVE: [
    'address_locatable',
    'address_rating',
    // 2026-04-26: dropped 'apf_coverage', 'owner_name', 'occupant_name',
    //   'occupancy_status', 'title_deed_status', 'registration_number',
    //   'property_tax_status', 'valuation_date', 'valuer_name' —
    //   not columns on property_apf_verification_reports.
    'met_person_name',
    'met_person_designation',
    'locality',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
    'landmark1',
    'landmark2',
    'tpc_met_person1',
    // 2026-04-26: column renamed; was 'name_of_tpc1'
    'tpc_name1',
    'tpc_confirmation1',
    // 2026-04-26: dropped 'electricity_connection', 'water_connection' —
    //   not columns on property_apf_verification_reports.
  ],
  SHIFTED: [
    'address_locatable',
    'address_rating',
    'met_person_name',
    'met_person_designation',
    'locality',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
    'landmark1',
    'landmark2',
  ],
  NSP: [
    'address_locatable',
    'address_rating',
    'met_person_name',
    'met_person_designation',
    'locality',
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
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
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',
    'other_observation',
    'final_status',
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

export function ensureAllPropertyApfFieldsPopulated(
  mappedData: Record<string, unknown>,
  formType: string
): Record<string, unknown> {
  const completeData = { ...mappedData };

  // Rewritten to match actual DB schema (psql \d property_apf_verification_reports).
  // Previous list referenced 45+ non-existent columns (property_location,
  // property_usage, apf_premium, owner_name, occupancy_status, title_deed_status,
  // valuation_date, name_of_tpc1/2, met_person_type, etc.) causing every insert
  // to fail with "column X of relation ... does not exist". Same class as
  // Findings #11 (Builder), #14 (NOC), #19 (DSA).
  const allDatabaseFields = [
    // Address and location
    'address_locatable',
    'address_rating',
    'locality',

    // Landmarks
    'landmark1',
    'landmark2',
    'landmark3',
    'landmark4',

    // Property-specific

    // APF-specific

    // Project / construction
    'construction_activity',
    'activity_stop_reason',
    'project_name',
    'project_completion_percentage',
    'project_started_date',
    'project_completion_date',
    'total_wing',
    'total_flats',
    'staff_strength',
    'staff_seen',
    'company_name_plate_status',
    'name_on_board',
    'building_status',

    // Builder / developer

    // Financial

    // Met person (POSITIVE SEEN path + ERT aliases)
    'met_person_name',
    'met_person_designation',
    'met_person_type',
    // 2026-04-26: dropped duplicate 'name_of_met_person' — column was renamed
    //   to met_person_name (already listed above).
    // 2026-04-27: dropped 'designation' — Property APF mobile field renamed
    //   to metPersonDesignation; data now lives in met_person_designation column.
    // 2026-04-27 F2 ERT correction: met_person_type added (was missing). It's
    //   its own column, matching peer forms (residence/rco/office/business/builder/noc).
    'met_person_confirmation',

    // Document verification

    // TPC
    'tpc_met_person1',
    'tpc_name1',
    'tpc_confirmation1',
    'tpc_met_person2',
    'tpc_name2',
    'tpc_confirmation2',

    // Form-specific
    'contact_person',
    'call_remark',

    // Legal & compliance

    // Area / infrastructure
    'political_connection',
    'dominated_area',
    'feedback_from_neighbour',

    // Observations & remarks
    'other_observation',

    // Final
    'final_status',
  ];

  // Get fields that are relevant for this form type
  const relevantFields = pickRelevantFieldsForFormType(formType, RELEVANT_FIELDS_BY_TYPE);

  // Populate missing fields with appropriate defaults
  for (const field of allDatabaseFields) {
    if (completeData[field] === undefined || completeData[field] === null) {
      if (relevantFields.includes(field)) {
        // Field is relevant for this form type but missing - this might indicate an issue
        logger.warn(`⚠️ Missing relevant field for ${formType} Property APF form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = MISSING_FIELD_DEFAULT;
    }
  }

  return completeData;
}
