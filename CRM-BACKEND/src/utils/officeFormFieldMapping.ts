/**
 * Office Form Field Mapping Utilities
 *
 * This module provides comprehensive field mapping between mobile office form data
 * and database columns for office verification forms.
 */

import { logger } from '@/config/logger';
import { eqCI } from './caseInsensitiveCompare';
import { pickRelevantFieldsForFormType, MISSING_FIELD_DEFAULT } from './formFieldRelevance';

export interface DatabaseFieldMapping {
  [mobileField: string]: string | null; // null means field should be ignored
}

/**
 * Complete field mapping from mobile office form fields to database columns
 * Covers all office verification form types: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
 */
export const OFFICE_FIELD_MAPPING: DatabaseFieldMapping = {
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
  companyNamePlateStatus: 'company_name_plate_status',
  nameOnBoard: 'name_on_board',

  // Landmarks (Common to all forms, untraceable may have more)
  landmark1: 'landmark1',
  landmark2: 'landmark2',
  landmark3: 'landmark3', // Used in untraceable forms
  landmark4: 'landmark4', // Used in untraceable forms

  // Office status and details (Form specific)
  officeStatus: 'office_status', // Used in POSITIVE, SHIFTED, NSP forms (values: Open/Closed/Shifted)
  officeExistsStatus: 'office_exists_status', // Used in ENTRY_RESTRICTED forms (values: Office Exist At / Does Not Exist At / Shifted From)
  officeExistence: 'office_existence', // Used in NSP forms
  officeType: 'office_type', // Used in POSITIVE forms
  companyNatureOfBusiness: 'company_nature_of_business', // Used in POSITIVE forms
  businessPeriod: 'business_period', // Used in POSITIVE forms
  establishmentPeriod: 'establishment_period', // Used in POSITIVE forms
  officeApproxArea: 'office_approx_area', // Used in POSITIVE forms
  staffStrength: 'staff_strength', // Used in POSITIVE forms
  staffSeen: 'staff_seen', // Used in POSITIVE forms

  // Person details (Form specific)
  metPerson: 'met_person_name', // Used in POSITIVE, SHIFTED, NSP forms
  metPersonName: 'met_person_name', // Alternative field name
  // 2026-04-27: Office mobile field renamed `designation` → `metPersonDesignation`,
  // DB column renamed `designation` → `met_person_designation` (Path A unification).
  // Legacy `designation` LHS kept for grace period (old client submissions).
  designation: 'met_person_designation',
  metPersonDesignation: 'met_person_designation',
  applicantDesignation: 'applicant_designation',
  workingPeriod: 'working_period',
  workingStatus: 'working_status',
  applicantWorkingPremises: 'applicant_working_premises',
  sittingLocation: 'sitting_location',
  currentCompanyName: 'current_company_name',

  // Document verification
  documentShown: 'document_shown',

  // Third Party Confirmation (TPC)
  tpcMetPerson1: 'tpc_met_person1',
  tpcName1: 'tpc_name1', // Mobile emits this field name
  tpcConfirmation1: 'tpc_confirmation1',
  tpcMetPerson2: 'tpc_met_person2',
  tpcName2: 'tpc_name2', // Mobile emits this field name
  tpcConfirmation2: 'tpc_confirmation2',

  // Shifted office specific fields
  shiftedPeriod: 'shifted_period',
  oldOfficeShiftedPeriod: 'old_office_shifted_period',
  currentCompanyPeriod: 'current_company_period',

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
  employeeId: null, // Legacy field, no direct DB mapping
  hrVerification: null, // Derived field, ignore
  salaryConfirmed: null, // Derived field, ignore
  department: 'applicant_designation', // Maps to applicant designation
  joiningDate: null, // Legacy field, no direct DB mapping
  monthlySalary: null, // Legacy field, no direct DB mapping
  hrContactName: null, // Legacy field, no direct DB mapping
  hrContactPhone: null, // Legacy field, no direct DB mapping
  officeAddress: null, // Legacy field, no direct DB mapping
  verificationMethod: null, // Derived field, ignore

  // Document fields
  documentType: 'document_type',
  documentShownStatus: 'document_shown',
  metPersonStatus: null,
  applicantStayingFloor: null,
  doorNamePlateStatus: null,
  nameOnDoorPlate: null,
  societyNamePlateStatus: null,
  nameOnSocietyBoard: null,
  formType: null,
  attachmentIds: null,
  geoLocation: null,

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
//   - mapOfficeFormDataToDatabase(): zero call sites in any codebase. The submit
//     path uses validateAndPrepareOfficeForm() from officeFormValidator.ts;
//     this old camelCase→snake_case mapper was never wired up post-migration.
//   - processOfficeFieldValue() (private): only caller was the dead mapper above.
//   - getOfficeAvailableDbColumns(): zero call sites; only `_`-aliased import
//     in mobileFormController.ts (intentional eslint-quiet for unused).
//   - getOfficeMappedMobileFields(): zero call sites anywhere.
// validateOfficeRequiredFields() and ensureAllOfficeFieldsPopulated() stay
// alive — the controller and validator file call them respectively.
//
// `logger` import on this file is now orphaned (was only referenced by the
// deleted processOfficeFieldValue's finalStatus warning). Will be cleaned up
// by the gates run.

/**
 * Validates that all required fields are present in office form data
 *
 * @param formData - Form data to validate
 * @param formType - Type of form (POSITIVE, SHIFTED, NSP, etc.)
 * @returns Object with validation result and missing fields
 */
export function validateOfficeRequiredFields(
  formData: Record<string, unknown>,
  formType: string
): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  // Define required fields by office form type
  const requiredFieldsByType: Record<string, string[]> = {
    POSITIVE: [
      'addressLocatable',
      'addressRating',
      'officeStatus',
      'metPersonName',
      'metPersonDesignation',
      'workingPeriod',
      'applicantDesignation',
      'workingStatus',
      'officeType',
      'companyNatureOfBusiness',
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
      'officeStatus',
      'currentCompanyName',
      'oldOfficeShiftedPeriod',
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
      'officeStatus',
      'officeExistence',
      'currentCompanyName',
      'locality',
      'addressStructure',
      'dominatedArea',
      'otherObservation',
      'finalStatus',
    ],
    ENTRY_RESTRICTED: [
      'addressLocatable',
      'addressRating',
      'metPersonName',
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
    if (eqCI(formData.officeStatus, 'Open') && !formData.staffSeen) {
      warnings.push('staffSeen should be specified when office is opened');
    }
    if (eqCI(formData.tpcMetPerson1, 'Yes') && !formData.tpcName1) {
      warnings.push('tpcName1 should be specified when tpcMetPerson1 is Yes');
    }
  }
  if (formType === 'SHIFTED' && eqCI(formData.officeStatus, 'Open')) {
    if (!formData.metPersonName) {
      warnings.push('metPersonName should be specified when office is open');
    }
    if (!formData.metPersonDesignation && !formData.designation) {
      warnings.push('metPersonDesignation should be specified when office is open');
    }
  }
  if (formType === 'NSP' && eqCI(formData.officeStatus, 'Open')) {
    if (!formData.metPersonName) {
      warnings.push('metPersonName should be specified when office is open');
    }
    if (!formData.metPersonDesignation && !formData.designation) {
      warnings.push('metPersonDesignation should be specified when office is open');
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
 * @param formType - Type of office form
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
    'working_period',
    'applicant_designation',
    'working_status',
    'office_type',
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
    'establishment_period',
    'office_approx_area',
    'staff_seen',
    'document_shown',
    'document_type',
    'tpc_met_person1',
    'tpc_name1',
    'tpc_confirmation1',
    'address_floor',
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
    'address_floor',
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
    'company_name_plate_status',
    'name_on_board',
    'landmark1',
    'landmark2',
  ],
  ENTRY_RESTRICTED: [
    'address_locatable',
    'address_rating',
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
    'address_floor',
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

export function ensureAllOfficeFieldsPopulated(
  mappedData: Record<string, unknown>,
  formType: string
): Record<string, unknown> {
  const completeData = { ...mappedData };

  // Define all possible database fields for office verification
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

    // Landmarks
    'landmark1',
    'landmark2',
    'landmark3',
    'landmark4',

    // Office status and details
    'office_status',
    'office_existence',
    'office_type',
    'company_nature_of_business',
    'business_period',
    'establishment_period',
    'office_approx_area',
    'staff_strength',
    'staff_seen',

    // Person details
    'met_person_name',
    'met_person_designation',
    'applicant_designation',
    'working_period',
    'working_status',
    'applicant_working_premises',
    'current_company_name',
    'old_office_shifted_period',

    // Document verification
    'document_shown',
    'document_type',

    // Third Party Confirmation
    'tpc_met_person1',
    'tpc_name1',
    'tpc_confirmation1',
    'tpc_met_person2',
    'tpc_name2',
    'tpc_confirmation2',

    // Entry restricted specific fields
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
        logger.warn(`⚠️ Missing relevant field for ${formType} office form: ${field}`);
      }

      // Set default value (NULL for all missing fields)
      completeData[field] = MISSING_FIELD_DEFAULT;
    }
  }

  return completeData;
}
