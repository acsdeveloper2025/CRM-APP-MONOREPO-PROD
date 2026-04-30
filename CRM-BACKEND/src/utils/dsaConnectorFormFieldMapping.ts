/**
 * DSA/DST Connector Form Field Mapping Utilities
 *
 * This module provides comprehensive field mapping between mobile DSA/DST Connector form data
 * and database columns for DSA/DST Connector verification forms.
 */

import { logger } from '@/config/logger';
import { pickRelevantFieldsForFormType, MISSING_FIELD_DEFAULT } from './formFieldRelevance';

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

  // Mobile field aliases (mobile sends these for DSA forms)
  designation: 'met_person_designation',
  // 2026-04-27 ERT correction: metPersonType is its OWN column (matches
  // residence/rco/office/business/builder/noc pattern). Previously overloaded
  // onto met_person_designation — fixed to dedicated met_person_type column.
  metPersonType: 'met_person_type',
  businessExistsStatus: 'business_exists_status',
  applicantStayingFloor: 'applicant_staying_floor',
  approxArea: 'office_area',
  officeApproxArea: 'office_area',
  staffStrength: 'total_staff',
  staffSeen: 'staff_seen',
  metPersonConfirmation: 'security_confirmation',
  businessExistance: 'business_existence',
  applicantExistance: 'applicant_existence',
  oldOfficeShiftedPeriod: 'shifted_period',

  // DSA Positive form fields (per xlsx spec)
  ownershipType: 'ownership_type',
  nameOfCompanyOwners: 'name_of_company_owners',
  addressStatus: 'address_status',
  companyNatureOfBusiness: 'company_nature_of_business',
  businessPeriod: 'business_period',
  activeClient: 'active_client',
  companyNamePlateStatus: 'company_name_plate_status',
  nameOnBoard: 'name_on_board',

  // Business/Office details (Form specific)
  businessType: 'business_type', // Used in POSITIVE forms
  officeArea: 'office_area', // Used in POSITIVE forms

  // Team and staff details
  totalStaff: 'total_staff',

  // Financial details

  // Technology and infrastructure

  // Compliance and documentation

  // Met person details
  metPersonName: 'met_person_name',
  metPersonDesignation: 'met_person_designation',

  // Third Party Confirmation (TPC)
  tpcMetPerson1: 'tpc_met_person1',
  tpcName1: 'tpc_name1',
  tpcConfirmation1: 'tpc_confirmation1',
  tpcMetPerson2: 'tpc_met_person2',
  tpcName2: 'tpc_name2',
  tpcConfirmation2: 'tpc_confirmation2',

  // Shifted specific fields
  shiftedPeriod: 'shifted_period',
  premisesStatus: 'premises_status',
  currentCompanyName: 'current_company_name',
  currentCompanyPeriod: 'current_company_period',

  // Entry restricted specific fields
  securityConfirmation: 'security_confirmation',

  // Untraceable specific fields
  contactPerson: 'contact_person',
  callRemark: 'call_remark',

  // Market and competition

  // Area and environment
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
//   - mapDsaConnectorFormDataToDatabase(): zero call sites in any codebase. The
//     submit path uses validateAndPrepareDsaConnectorForm() from
//     dsaConnectorFormValidator.ts; this old camelCase→snake_case mapper was
//     never wired up post-migration.
//   - processDsaConnectorFieldValue() (private): only caller was the dead mapper.
//   - getDsaConnectorAvailableDbColumns(): zero call sites; only `_`-aliased import.
//   - getDsaConnectorMappedMobileFields(): zero call sites anywhere.
// DSA_CONNECTOR_FIELD_MAPPING and ensureAllDsaConnectorFieldsPopulated() stay
// alive (used by validator).

// 2026-04-26 P3 dead-code prune (per project_form_field_mapping_drift_audit.md):
// Removed validateDsaConnectorRequiredFields() — zero call sites in any codebase
// after the prior session removed its _`-aliased import in
// mobileFormController.ts. The validator file (dsaConnectorFormValidator.ts)
// calls validateAndPrepareDsaConnectorForm() which has its own internal required-
// field check. The mapping-file required-list was dormant from day one.

/**
 * Ensures all database fields are populated with appropriate values or NULL defaults
 * This function guarantees that every database column has a value, preventing null/undefined issues
 *
 * @param mappedData - Already mapped form data
 * @param formType - Type of DSA Connector form
 * @returns Complete data object with all fields populated
 */
// 2026-04-26 Phase 4 dedup (formFieldRelevance.ts shared util).
// Per-type DATA stays here; logic moved to shared `pickRelevantFieldsForFormType`.
const RELEVANT_FIELDS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  POSITIVE: [
    'address_locatable',
    'address_rating',
    'business_type',
    'office_area',
    // 2026-04-26: dropped 'training_completed', 'contact_number', 'document_shown',
    //   'document_type' — not columns on dsa_connector_verification_reports.
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
    'tpc_met_person1',
    // 2026-04-26: column renamed; was 'name_of_tpc1'
    'tpc_name1',
    'tpc_confirmation1',
    // 2026-04-26: dropped 'pan_number', 'certification_status' — not columns
    //   on dsa_connector_verification_reports.
  ],
  SHIFTED: [
    'address_locatable',
    'address_rating',
    'met_person_name',
    // 2026-04-26: column renamed; was 'designation'
    'met_person_designation',
    'shifted_period',
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
    // 2026-04-27 ERT correction: met_person_type column added to dsa_connector
    //   table (was missing). Mobile sends `metPersonType` (Security/Receptionist).
    'met_person_type',
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
    'address_structure_color',
    'door_color',

    // Landmarks
    'landmark1',
    'landmark2',
    'landmark3',
    'landmark4',

    // DSA/DST Connector core columns (only those present in schema)

    // Business/Office details
    'business_type',
    'office_area',
    'office_status',

    // Financial / performance
    'active_client',

    // Technology/infrastructure (present in schema)

    // License + compliance

    // Team
    'total_staff',

    // Person details
    'met_person_name',
    'met_person_designation',

    // Business existence
    'business_existence',

    // Address/nameplate (DSA-specific)
    'address_status',
    'name_of_company_owners',
    'ownership_type',
    'company_nature_of_business',
    'business_period',
    'company_name_plate_status',
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
    'premises_status',
    'security_confirmation',
    'contact_person',
    'call_remark',

    // Market presence

    // ERT
    // 2026-04-27: met_person_type column added (was the same overload bug as
    // Property APF). DSA ERT mobile sends `metPersonType` (Security/Receptionist).
    'met_person_type',
    'business_exists_status',

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
        logger.warn(`⚠️ Missing relevant field for ${formType} DSA Connector form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = MISSING_FIELD_DEFAULT;
    }
  }

  return completeData;
}
