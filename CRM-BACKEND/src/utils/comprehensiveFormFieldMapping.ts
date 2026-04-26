/**
 * Comprehensive Form Field Mapping for All Verification Types
 *
 * This module provides complete form field definitions and mapping for all verification types
 * to ensure comprehensive display of form data in the frontend.
 */

import type { FormSection, FormField } from '../types/mobile';
import {
  getRelevantFieldsForFormType as _getRelevantFieldsForFormType,
  shouldShowField as _shouldShowField,
  CONDITIONAL_FIELD_RULES as _CONDITIONAL_FIELD_RULES,
} from './typeAwareFormFieldSchemas';
import { logger } from './logger';

// Form field definitions organized by verification type and form type
export interface FormFieldDefinition {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'boolean' | 'textarea';
  isRequired: boolean;
  section: string;
  order: number;
  formTypes?: string[]; // Which form types this field applies to
}

// Comprehensive field definitions for RESIDENCE verification
export const RESIDENCE_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information Section
  {
    id: 'outcome',
    name: 'outcome',
    label: 'Verification Outcome',
    type: 'select',
    isRequired: true,
    section: 'Basic Information',
    order: 2,
  },
  {
    id: 'metPersonName',
    name: 'metPersonName',
    label: 'Met Person Name',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 3,
  },
  {
    id: 'callRemark',
    name: 'callRemark',
    label: 'Call Remark',
    type: 'select',
    isRequired: false,
    section: 'Basic Information',
    order: 4,
  },

  // Address & Location Section
  {
    id: 'addressLocatable',
    name: 'addressLocatable',
    label: 'Address Locatable',
    type: 'select',
    isRequired: true,
    section: 'Location Details',
    order: 1,
    formTypes: ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED'],
  },
  {
    id: 'addressRating',
    name: 'addressRating',
    label: 'Address Rating',
    type: 'select',
    isRequired: true,
    section: 'Location Details',
    order: 2,
    formTypes: ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED'],
  },
  {
    id: 'locality',
    name: 'locality',
    label: 'Locality Type',
    type: 'select',
    isRequired: false,
    section: 'Location Details',
    order: 3,
  },
  {
    id: 'addressStructure',
    name: 'addressStructure',
    label: 'Address Structure',
    type: 'select',
    isRequired: false,
    section: 'Location Details',
    order: 4,
  },
  {
    id: 'landmark1',
    name: 'landmark1',
    label: 'Landmark 1',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 5,
  },
  {
    id: 'landmark2',
    name: 'landmark2',
    label: 'Landmark 2',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 6,
  },
  {
    id: 'landmark3',
    name: 'landmark3',
    label: 'Landmark 3',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 7,
  },
  {
    id: 'landmark4',
    name: 'landmark4',
    label: 'Landmark 4',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 8,
  },

  // Personal & Family Details
  {
    id: 'metPersonRelation',
    name: 'metPersonRelation',
    label: 'Met Person Relation',
    type: 'select',
    isRequired: false,
    section: 'Personal Details',
    order: 1,
    formTypes: ['POSITIVE'],
  },
  {
    id: 'metPersonStatus',
    name: 'metPersonStatus',
    label: 'Met Person Status',
    type: 'select',
    isRequired: false,
    section: 'Personal Details',
    order: 2,
    formTypes: ['POSITIVE', 'NSP', 'SHIFTED', 'ENTRY_RESTRICTED'],
  },
  {
    id: 'totalFamilyMembers',
    name: 'totalFamilyMembers',
    label: 'Total Family Members',
    type: 'number',
    isRequired: false,
    section: 'Personal Details',
    order: 3,
    formTypes: ['POSITIVE'],
  },
  {
    id: 'totalEarningMember',
    name: 'totalEarningMember',
    label: 'Total Earning Members',
    type: 'number',
    isRequired: false,
    section: 'Personal Details',
    order: 4,
    formTypes: ['POSITIVE'],
  },
  {
    id: 'workingStatus',
    name: 'workingStatus',
    label: 'Working Status',
    type: 'select',
    isRequired: false,
    section: 'Personal Details',
    order: 5,
    formTypes: ['POSITIVE'],
  },
  {
    id: 'companyName',
    name: 'companyName',
    label: 'Company Name',
    type: 'text',
    isRequired: false,
    section: 'Personal Details',
    order: 6,
    formTypes: ['POSITIVE'],
  },
  {
    id: 'stayingPeriod',
    name: 'stayingPeriod',
    label: 'Staying Period',
    type: 'text',
    isRequired: false,
    section: 'Personal Details',
    order: 7,
    formTypes: ['POSITIVE', 'NSP'],
  },
  {
    id: 'stayingStatus',
    name: 'stayingStatus',
    label: 'Staying Status',
    type: 'select',
    isRequired: false,
    section: 'Personal Details',
    order: 8,
    formTypes: ['POSITIVE'],
  },

  // Document Verification (POSITIVE specific)
  {
    id: 'documentShownStatus',
    name: 'documentShownStatus',
    label: 'Document Shown Status',
    type: 'select',
    isRequired: false,
    section: 'Document Verification',
    order: 1,
    formTypes: ['POSITIVE'],
  },
  {
    id: 'documentType',
    name: 'documentType',
    label: 'Document Type',
    type: 'select',
    isRequired: false,
    section: 'Document Verification',
    order: 2,
    formTypes: ['POSITIVE'],
  },

  // House & Property Details
  {
    id: 'houseStatus',
    name: 'houseStatus',
    label: 'House Status',
    type: 'select',
    isRequired: false,
    section: 'Property Details',
    order: 1,
    formTypes: ['POSITIVE', 'NSP'],
  },
  {
    id: 'doorColor',
    name: 'doorColor',
    label: 'Door Color',
    type: 'text',
    isRequired: false,
    section: 'Property Details',
    order: 3,
    formTypes: ['POSITIVE', 'NSP'],
  },
  {
    id: 'doorNamePlateStatus',
    name: 'doorNamePlateStatus',
    label: 'Door Name Plate Status',
    type: 'select',
    isRequired: false,
    section: 'Property Details',
    order: 4,
    formTypes: ['POSITIVE', 'NSP'],
  },
  {
    id: 'nameOnDoorPlate',
    name: 'nameOnDoorPlate',
    label: 'Name on Door Plate',
    type: 'text',
    isRequired: false,
    section: 'Property Details',
    order: 5,
    formTypes: ['POSITIVE', 'NSP'],
  },
  {
    id: 'societyNamePlateStatus',
    name: 'societyNamePlateStatus',
    label: 'Society Name Plate Status',
    type: 'select',
    isRequired: false,
    section: 'Property Details',
    order: 6,
    formTypes: ['POSITIVE', 'NSP'],
  },
  {
    id: 'nameOnSocietyBoard',
    name: 'nameOnSocietyBoard',
    label: 'Name on Society Board',
    type: 'text',
    isRequired: false,
    section: 'Property Details',
    order: 7,
    formTypes: ['POSITIVE', 'NSP'],
  },
  {
    id: 'addressStructureColor',
    name: 'addressStructureColor',
    label: 'Address Structure Color',
    type: 'text',
    isRequired: false,
    section: 'Property Details',
    order: 8,
    formTypes: ['POSITIVE', 'NSP'],
  },
  {
    id: 'applicantStayingFloor',
    name: 'applicantStayingFloor',
    label: 'Applicant Staying Floor',
    type: 'text',
    isRequired: false,
    section: 'Property Details',
    order: 9,
    formTypes: ['POSITIVE', 'NSP'],
  },

  // Shifting Details (SHIFTED specific)
  {
    id: 'shiftedPeriod',
    name: 'shiftedPeriod',
    label: 'Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting Details',
    order: 1,
    formTypes: ['SHIFTED'],
  },
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'select',
    isRequired: false,
    section: 'Shifting Details',
    order: 3,
    formTypes: ['SHIFTED'],
  },
  {
    id: 'houseStatus',
    name: 'houseStatus',
    label: 'House Status',
    type: 'select',
    isRequired: false,
    section: 'Shifting Details',
    order: 4,
    formTypes: ['SHIFTED'],
  },
  {
    id: 'doorColor',
    name: 'doorColor',
    label: 'Door Color',
    type: 'text',
    isRequired: false,
    section: 'Shifting Details',
    order: 5,
    formTypes: ['SHIFTED'],
  },

  // NSP Details (NSP specific)
  {
    id: 'stayingPersonName',
    name: 'stayingPersonName',
    label: 'Staying Person Name',
    type: 'text',
    isRequired: false,
    section: 'NSP Details',
    order: 1,
    formTypes: ['NSP'],
  },
  {
    id: 'shiftedPeriod',
    name: 'shiftedPeriod',
    label: 'Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'NSP Details',
    order: 2,
    formTypes: ['NSP'],
  },

  // Entry Restriction Details (ENTRY_RESTRICTED specific)
  {
    id: 'accessDenied',
    name: 'accessDenied',
    label: 'Access Denied',
    type: 'boolean',
    isRequired: false,
    section: 'Entry Restriction Details',
    order: 3,
    formTypes: ['ENTRY_RESTRICTED'],
  },
  {
    id: 'nameOfMetPerson',
    name: 'nameOfMetPerson',
    label: 'Name of Met Person',
    type: 'text',
    isRequired: false,
    section: 'Entry Restriction Details',
    order: 4,
    formTypes: ['ENTRY_RESTRICTED'],
  },
  {
    id: 'metPersonType',
    name: 'metPersonType',
    label: 'Met Person Type',
    type: 'select',
    isRequired: false,
    section: 'Entry Restriction Details',
    order: 5,
    formTypes: ['ENTRY_RESTRICTED'],
  },
  {
    id: 'applicantStayingStatus',
    name: 'applicantStayingStatus',
    label: 'Applicant Staying Status',
    type: 'select',
    isRequired: false,
    section: 'Entry Restriction Details',
    order: 6,
    formTypes: ['ENTRY_RESTRICTED'],
  },

  // Contact & Inquiry Details (UNTRACEABLE specific)
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Contact Details',
    order: 1,
    formTypes: ['UNTRACEABLE'],
  },
  {
    id: 'alternateContact',
    name: 'alternateContact',
    label: 'Alternate Contact',
    type: 'text',
    isRequired: false,
    section: 'Contact Details',
    order: 2,
    formTypes: ['UNTRACEABLE'],
  },

  // Third Party Confirmation (TPC) Section
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC Met Person 1',
    type: 'select',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 1,
    formTypes: ['POSITIVE', 'NSP', 'SHIFTED'],
  },
  {
    id: 'nameOfTpc1',
    name: 'nameOfTpc1',
    label: 'TPC Name 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 2,
    formTypes: ['POSITIVE', 'NSP', 'SHIFTED'],
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC Confirmation 1',
    type: 'select',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 3,
    formTypes: ['POSITIVE', 'NSP', 'SHIFTED'],
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC Met Person 2',
    type: 'select',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 4,
    formTypes: ['POSITIVE', 'NSP', 'SHIFTED'],
  },
  {
    id: 'nameOfTpc2',
    name: 'nameOfTpc2',
    label: 'TPC Name 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 5,
    formTypes: ['POSITIVE', 'NSP', 'SHIFTED'],
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC Confirmation 2',
    type: 'select',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 6,
    formTypes: ['POSITIVE', 'NSP', 'SHIFTED'],
  },

  // Area Assessment Section (Common to all)
  {
    id: 'politicalConnection',
    name: 'politicalConnection',
    label: 'Political Connection',
    type: 'select',
    isRequired: false,
    section: 'Area Assessment',
    order: 1,
  },
  {
    id: 'dominatedArea',
    name: 'dominatedArea',
    label: 'Dominated Area',
    type: 'select',
    isRequired: false,
    section: 'Area Assessment',
    order: 2,
  },
  {
    id: 'feedbackFromNeighbour',
    name: 'feedbackFromNeighbour',
    label: 'Feedback From Neighbour',
    type: 'select',
    isRequired: false,
    section: 'Area Assessment',
    order: 3,
  },
  {
    id: 'otherObservation',
    name: 'otherObservation',
    label: 'Other Observations',
    type: 'textarea',
    isRequired: false,
    section: 'Area Assessment',
    order: 4,
  },
  {
    id: 'approxArea',
    name: 'approxArea',
    label: 'Approximate Area (sq ft)',
    type: 'number',
    isRequired: false,
    section: 'Property Details',
    order: 10,
    formTypes: ['POSITIVE'],
  },
  {
    id: 'finalStatus',
    name: 'finalStatus',
    label: 'Final Status',
    type: 'select',
    isRequired: true,
    section: 'Area Assessment',
    order: 7,
  },
];

// Comprehensive field definitions for OFFICE verification
export const OFFICE_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information Section
  {
    id: 'outcome',
    name: 'outcome',
    label: 'Verification Outcome',
    type: 'select',
    isRequired: true,
    section: 'Basic Information',
    order: 2,
  },
  {
    id: 'metPersonName',
    name: 'metPersonName',
    label: 'Met Person Name',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 3,
  },
  {
    id: 'designation',
    name: 'designation',
    label: 'Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 4,
  },
  {
    id: 'applicantDesignation',
    name: 'applicantDesignation',
    label: 'Applicant Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 5,
  },

  // Office Details Section
  {
    id: 'officeStatus',
    name: 'officeStatus',
    label: 'Office Status',
    type: 'select',
    isRequired: false,
    section: 'Office Details',
    order: 1,
  },
  {
    id: 'officeType',
    name: 'officeType',
    label: 'Office Type',
    type: 'select',
    isRequired: false,
    section: 'Office Details',
    order: 2,
  },
  {
    id: 'companyNatureOfBusiness',
    name: 'companyNatureOfBusiness',
    label: 'Company Nature of Business',
    type: 'text',
    isRequired: false,
    section: 'Office Details',
    order: 3,
  },
  {
    id: 'businessPeriod',
    name: 'businessPeriod',
    label: 'Business Period',
    type: 'text',
    isRequired: false,
    section: 'Office Details',
    order: 4,
  },
  {
    id: 'establishmentPeriod',
    name: 'establishmentPeriod',
    label: 'Establishment Period',
    type: 'text',
    isRequired: false,
    section: 'Office Details',
    order: 5,
  },
  {
    id: 'staffStrength',
    name: 'staffStrength',
    label: 'Staff Strength',
    type: 'number',
    isRequired: false,
    section: 'Office Details',
    order: 6,
  },
  {
    id: 'staffSeen',
    name: 'staffSeen',
    label: 'Staff Seen',
    type: 'number',
    isRequired: false,
    section: 'Office Details',
    order: 7,
  },
  {
    id: 'workingPeriod',
    name: 'workingPeriod',
    label: 'Working Period',
    type: 'text',
    isRequired: false,
    section: 'Office Details',
    order: 8,
  },
  {
    id: 'workingStatus',
    name: 'workingStatus',
    label: 'Working Status',
    type: 'select',
    isRequired: false,
    section: 'Office Details',
    order: 9,
  },
  {
    id: 'officeApproxArea',
    name: 'officeApproxArea',
    label: 'Office Approximate Area',
    type: 'number',
    isRequired: false,
    section: 'Office Details',
    order: 10,
  },

  // Document Verification Section
  {
    id: 'documentShown',
    name: 'documentShown',
    label: 'Document Shown',
    type: 'text',
    isRequired: false,
    section: 'Document Verification',
    order: 1,
  },
  {
    id: 'documentType',
    name: 'documentType',
    label: 'Document Type',
    type: 'text',
    isRequired: false,
    section: 'Document Verification',
    order: 2,
  },

  // Address & Location Section
  {
    id: 'addressLocatable',
    name: 'addressLocatable',
    label: 'Address Locatable',
    type: 'select',
    isRequired: true,
    section: 'Location Details',
    order: 1,
  },
  {
    id: 'addressRating',
    name: 'addressRating',
    label: 'Address Rating',
    type: 'select',
    isRequired: true,
    section: 'Location Details',
    order: 2,
  },
  {
    id: 'locality',
    name: 'locality',
    label: 'Locality Type',
    type: 'select',
    isRequired: false,
    section: 'Location Details',
    order: 3,
  },
  {
    id: 'addressStructure',
    name: 'addressStructure',
    label: 'Address Structure',
    type: 'select',
    isRequired: false,
    section: 'Location Details',
    order: 4,
  },
  {
    id: 'addressFloor',
    name: 'addressFloor',
    label: 'Address Floor',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 5,
  },
  {
    id: 'companyNamePlateStatus',
    name: 'companyNamePlateStatus',
    label: 'Company Name Plate Status',
    type: 'select',
    isRequired: false,
    section: 'Location Details',
    order: 6,
  },
  {
    id: 'nameOnBoard',
    name: 'nameOnBoard',
    label: 'Name on Company Board',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 7,
  },
  {
    id: 'landmark1',
    name: 'landmark1',
    label: 'Landmark 1',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 8,
  },
  {
    id: 'landmark2',
    name: 'landmark2',
    label: 'Landmark 2',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 9,
  },
  {
    id: 'landmark3',
    name: 'landmark3',
    label: 'Landmark 3',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 10,
  },
  {
    id: 'landmark4',
    name: 'landmark4',
    label: 'Landmark 4',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 11,
  },

  // TPC Details Section
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC Met Person 1',
    type: 'select',
    isRequired: false,
    section: 'TPC Details',
    order: 1,
  },
  {
    id: 'nameOfTpc1',
    name: 'nameOfTpc1',
    label: 'TPC Name 1',
    type: 'text',
    isRequired: false,
    section: 'TPC Details',
    order: 2,
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC Confirmation 1',
    type: 'select',
    isRequired: false,
    section: 'TPC Details',
    order: 3,
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC Met Person 2',
    type: 'select',
    isRequired: false,
    section: 'TPC Details',
    order: 4,
  },
  {
    id: 'nameOfTpc2',
    name: 'nameOfTpc2',
    label: 'TPC Name 2',
    type: 'text',
    isRequired: false,
    section: 'TPC Details',
    order: 5,
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC Confirmation 2',
    type: 'select',
    isRequired: false,
    section: 'TPC Details',
    order: 6,
  },

  // Area Assessment Section
  {
    id: 'politicalConnection',
    name: 'politicalConnection',
    label: 'Political Connection',
    type: 'select',
    isRequired: false,
    section: 'Area Assessment',
    order: 1,
  },
  {
    id: 'dominatedArea',
    name: 'dominatedArea',
    label: 'Dominated Area',
    type: 'select',
    isRequired: false,
    section: 'Area Assessment',
    order: 2,
  },
  {
    id: 'feedbackFromNeighbour',
    name: 'feedbackFromNeighbour',
    label: 'Feedback From Neighbour',
    type: 'select',
    isRequired: false,
    section: 'Area Assessment',
    order: 3,
  },
  {
    id: 'otherObservation',
    name: 'otherObservation',
    label: 'Other Observations',
    type: 'textarea',
    isRequired: false,
    section: 'Area Assessment',
    order: 4,
  },
  {
    id: 'finalStatus',
    name: 'finalStatus',
    label: 'Final Status',
    type: 'select',
    isRequired: true,
    section: 'Area Assessment',
    order: 5,
  },
];

// Comprehensive field definitions for BUSINESS verification
export const BUSINESS_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information Section
  {
    id: 'outcome',
    name: 'outcome',
    label: 'Verification Outcome',
    type: 'select',
    isRequired: true,
    section: 'Basic Information',
    order: 2,
  },
  {
    id: 'metPersonName',
    name: 'metPersonName',
    label: 'Met Person Name',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 3,
  },
  {
    id: 'designation',
    name: 'designation',
    label: 'Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 4,
  },
  {
    id: 'applicantDesignation',
    name: 'applicantDesignation',
    label: 'Applicant Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 5,
  },

  // Business Details Section
  {
    id: 'businessStatus',
    name: 'businessStatus',
    label: 'Business Status',
    type: 'select',
    isRequired: false,
    section: 'Business Details',
    order: 1,
  },
  {
    id: 'businessType',
    name: 'businessType',
    label: 'Business Type',
    type: 'select',
    isRequired: false,
    section: 'Business Details',
    order: 2,
  },
  {
    id: 'companyNatureOfBusiness',
    name: 'companyNatureOfBusiness',
    label: 'Nature of Business',
    type: 'text',
    isRequired: false,
    section: 'Business Details',
    order: 3,
  },
  {
    id: 'businessPeriod',
    name: 'businessPeriod',
    label: 'Business Period',
    type: 'text',
    isRequired: false,
    section: 'Business Details',
    order: 4,
  },
  {
    id: 'establishmentPeriod',
    name: 'establishmentPeriod',
    label: 'Establishment Period',
    type: 'text',
    isRequired: false,
    section: 'Business Details',
    order: 5,
  },
  {
    id: 'businessExistence',
    name: 'businessExistence',
    label: 'Business Existence',
    type: 'select',
    isRequired: false,
    section: 'Business Details',
    order: 6,
  },
  {
    id: 'businessSetup',
    name: 'businessSetup',
    label: 'Business Setup',
    type: 'text',
    isRequired: false,
    section: 'Business Details',
    order: 8,
  },
  {
    id: 'businessApproxArea',
    name: 'businessApproxArea',
    label: 'Business Approximate Area',
    type: 'number',
    isRequired: false,
    section: 'Business Details',
    order: 9,
  },
  {
    id: 'staffStrength',
    name: 'staffStrength',
    label: 'Staff Strength',
    type: 'number',
    isRequired: false,
    section: 'Business Details',
    order: 10,
  },
  {
    id: 'staffSeen',
    name: 'staffSeen',
    label: 'Staff Seen',
    type: 'number',
    isRequired: false,
    section: 'Business Details',
    order: 11,
  },
  {
    id: 'ownershipType',
    name: 'ownershipType',
    label: 'Ownership Type',
    type: 'select',
    isRequired: false,
    section: 'Business Details',
    order: 12,
  },
  {
    id: 'ownerName',
    name: 'ownerName',
    label: 'Owner Name',
    type: 'text',
    isRequired: false,
    section: 'Business Details',
    order: 13,
  },
  {
    id: 'nameOfCompanyOwners',
    name: 'nameOfCompanyOwners',
    label: 'Name of Company Owners',
    type: 'text',
    isRequired: false,
    section: 'Business Details',
    order: 15,
  },

  // Working Details Section
  {
    id: 'workingPeriod',
    name: 'workingPeriod',
    label: 'Working Period',
    type: 'text',
    isRequired: false,
    section: 'Working Details',
    order: 1,
  },
  {
    id: 'workingStatus',
    name: 'workingStatus',
    label: 'Working Status',
    type: 'select',
    isRequired: false,
    section: 'Working Details',
    order: 2,
  },
  {
    id: 'applicantWorkingPremises',
    name: 'applicantWorkingPremises',
    label: 'Applicant Working Premises',
    type: 'text',
    isRequired: false,
    section: 'Working Details',
    order: 3,
  },
  {
    id: 'applicantWorkingStatus',
    name: 'applicantWorkingStatus',
    label: 'Applicant Working Status',
    type: 'select',
    isRequired: false,
    section: 'Working Details',
    order: 4,
  },

  // Document Verification Section
  {
    id: 'documentShown',
    name: 'documentShown',
    label: 'Document Shown',
    type: 'text',
    isRequired: false,
    section: 'Document Verification',
    order: 1,
  },
  {
    id: 'documentType',
    name: 'documentType',
    label: 'Document Type',
    type: 'text',
    isRequired: false,
    section: 'Document Verification',
    order: 2,
  },

  // Location Details Section
  {
    id: 'addressLocatable',
    name: 'addressLocatable',
    label: 'Address Locatable',
    type: 'select',
    isRequired: true,
    section: 'Location Details',
    order: 1,
  },
  {
    id: 'addressRating',
    name: 'addressRating',
    label: 'Address Rating',
    type: 'select',
    isRequired: true,
    section: 'Location Details',
    order: 2,
  },
  {
    id: 'locality',
    name: 'locality',
    label: 'Locality Type',
    type: 'select',
    isRequired: false,
    section: 'Location Details',
    order: 3,
  },
  {
    id: 'addressStructure',
    name: 'addressStructure',
    label: 'Address Structure',
    type: 'select',
    isRequired: false,
    section: 'Location Details',
    order: 4,
  },
  {
    id: 'addressFloor',
    name: 'addressFloor',
    label: 'Address Floor',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 5,
  },
  {
    id: 'addressStatus',
    name: 'addressStatus',
    label: 'Address Status',
    type: 'select',
    isRequired: false,
    section: 'Location Details',
    order: 6,
  },
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'select',
    isRequired: false,
    section: 'Location Details',
    order: 7,
  },
  {
    id: 'companyNamePlateStatus',
    name: 'companyNamePlateStatus',
    label: 'Company Name Plate Status',
    type: 'select',
    isRequired: false,
    section: 'Location Details',
    order: 8,
  },
  {
    id: 'nameOnBoard',
    name: 'nameOnBoard',
    label: 'Name on Company Board',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 9,
  },
  {
    id: 'landmark1',
    name: 'landmark1',
    label: 'Landmark 1',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 10,
  },
  {
    id: 'landmark2',
    name: 'landmark2',
    label: 'Landmark 2',
    type: 'text',
    isRequired: false,
    section: 'Location Details',
    order: 11,
  },

  // TPC Details Section
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC Met Person 1',
    type: 'select',
    isRequired: false,
    section: 'TPC Details',
    order: 1,
  },
  {
    id: 'nameOfTpc1',
    name: 'nameOfTpc1',
    label: 'TPC Name 1',
    type: 'text',
    isRequired: false,
    section: 'TPC Details',
    order: 2,
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC Confirmation 1',
    type: 'select',
    isRequired: false,
    section: 'TPC Details',
    order: 3,
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC Met Person 2',
    type: 'select',
    isRequired: false,
    section: 'TPC Details',
    order: 4,
  },
  {
    id: 'nameOfTpc2',
    name: 'nameOfTpc2',
    label: 'TPC Name 2',
    type: 'text',
    isRequired: false,
    section: 'TPC Details',
    order: 5,
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC Confirmation 2',
    type: 'select',
    isRequired: false,
    section: 'TPC Details',
    order: 6,
  },

  // Shifting Details Section (for shifted cases)
  {
    id: 'shiftedPeriod',
    name: 'shiftedPeriod',
    label: 'Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting Details',
    order: 1,
  },
  {
    id: 'oldBusinessShiftedPeriod',
    name: 'oldBusinessShiftedPeriod',
    label: 'Old Business Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting Details',
    order: 2,
  },
  {
    id: 'currentCompanyName',
    name: 'currentCompanyName',
    label: 'Current Company Name',
    type: 'text',
    isRequired: false,
    section: 'Shifting Details',
    order: 3,
  },
  {
    id: 'currentCompanyPeriod',
    name: 'currentCompanyPeriod',
    label: 'Current Company Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting Details',
    order: 4,
  },

  // Contact & Communication Section
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Contact & Communication',
    order: 1,
  },
  {
    id: 'callRemark',
    name: 'callRemark',
    label: 'Call Remark',
    type: 'text',
    isRequired: false,
    section: 'Contact & Communication',
    order: 2,
  },
  {
    id: 'nameOfMetPerson',
    name: 'nameOfMetPerson',
    label: 'Name of Met Person',
    type: 'text',
    isRequired: false,
    section: 'Contact & Communication',
    order: 3,
  },
  {
    id: 'metPersonType',
    name: 'metPersonType',
    label: 'Met Person Type',
    type: 'select',
    isRequired: false,
    section: 'Contact & Communication',
    order: 4,
  },
  {
    id: 'metPersonConfirmation',
    name: 'metPersonConfirmation',
    label: 'Met Person Confirmation',
    type: 'select',
    isRequired: false,
    section: 'Contact & Communication',
    order: 5,
  },

  // Area Assessment Section
  {
    id: 'politicalConnection',
    name: 'politicalConnection',
    label: 'Political Connection',
    type: 'select',
    isRequired: false,
    section: 'Area Assessment',
    order: 1,
  },
  {
    id: 'dominatedArea',
    name: 'dominatedArea',
    label: 'Dominated Area',
    type: 'select',
    isRequired: false,
    section: 'Area Assessment',
    order: 2,
  },
  {
    id: 'feedbackFromNeighbour',
    name: 'feedbackFromNeighbour',
    label: 'Feedback From Neighbour',
    type: 'select',
    isRequired: false,
    section: 'Area Assessment',
    order: 3,
  },
  {
    id: 'otherObservation',
    name: 'otherObservation',
    label: 'Other Observations',
    type: 'textarea',
    isRequired: false,
    section: 'Area Assessment',
    order: 4,
  },
  {
    id: 'finalStatus',
    name: 'finalStatus',
    label: 'Final Status',
    type: 'select',
    isRequired: true,
    section: 'Area Assessment',
    order: 6,
  },
];

// Property APF form field definitions (based on actual database fields)
const PROPERTY_APF_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  {
    id: 'outcome',
    name: 'outcome',
    label: 'Verification Outcome',
    type: 'select',
    isRequired: true,
    section: 'Basic Information',
    order: 1,
  },
  {
    id: 'metPersonName',
    name: 'metPersonName',
    label: 'Met Person Name',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 3,
  },
  {
    id: 'metPersonDesignation',
    name: 'metPersonDesignation',
    label: 'Met Person Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 4,
  },
  {
    id: 'metPersonRelation',
    name: 'metPersonRelation',
    label: 'Met Person Relation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 5,
  },

  // Address Information
  {
    id: 'locality',
    name: 'locality',
    label: 'Locality',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 2,
  },
  {
    id: 'addressLocatable',
    name: 'addressLocatable',
    label: 'Address Locatable',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 3,
  },
  {
    id: 'addressRating',
    name: 'addressRating',
    label: 'Address Rating',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 4,
  },
  {
    id: 'addressStructure',
    name: 'addressStructure',
    label: 'Address Structure',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 5,
  },
  {
    id: 'addressStructureColor',
    name: 'addressStructureColor',
    label: 'Address Structure Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 6,
  },
  {
    id: 'addressFloor',
    name: 'addressFloor',
    label: 'Address Floor',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 7,
  },
  {
    id: 'doorColor',
    name: 'doorColor',
    label: 'Door Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 8,
  },
  {
    id: 'landmark1',
    name: 'landmark1',
    label: 'Landmark 1',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 9,
  },
  {
    id: 'landmark2',
    name: 'landmark2',
    label: 'Landmark 2',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 10,
  },
  {
    id: 'landmark3',
    name: 'landmark3',
    label: 'Landmark 3',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 11,
  },
  {
    id: 'landmark4',
    name: 'landmark4',
    label: 'Landmark 4',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 12,
  },

  // Property Details
  {
    id: 'propertyStatus',
    name: 'propertyStatus',
    label: 'Property Status',
    type: 'text',
    isRequired: false,
    section: 'Property Details',
    order: 2,
  },
  {
    id: 'propertyArea',
    name: 'propertyArea',
    label: 'Property Area',
    type: 'number',
    isRequired: false,
    section: 'Property Details',
    order: 6,
  },
  {
    id: 'buildingStatus',
    name: 'buildingStatus',
    label: 'Building Status',
    type: 'text',
    isRequired: false,
    section: 'Property Details',
    order: 9,
  },
  {
    id: 'constructionActivity',
    name: 'constructionActivity',
    label: 'Construction Activity',
    type: 'text',
    isRequired: false,
    section: 'Property Details',
    order: 10,
  },

  // APF Details

  // Project Information
  {
    id: 'projectName',
    name: 'projectName',
    label: 'Project Name',
    type: 'text',
    isRequired: false,
    section: 'Project Information',
    order: 1,
  },
  {
    id: 'projectCompletionPercentage',
    name: 'projectCompletionPercentage',
    label: 'Project Completion %',
    type: 'number',
    isRequired: false,
    section: 'Project Information',
    order: 4,
  },
  {
    id: 'projectStartDate',
    name: 'projectStartDate',
    label: 'Project Start Date',
    type: 'date',
    isRequired: false,
    section: 'Project Information',
    order: 5,
  },
  {
    id: 'projectEndDate',
    name: 'projectEndDate',
    label: 'Project End Date',
    type: 'date',
    isRequired: false,
    section: 'Project Information',
    order: 6,
  },
  {
    id: 'projectStartedDate',
    name: 'projectStartedDate',
    label: 'Project Started Date',
    type: 'date',
    isRequired: false,
    section: 'Project Information',
    order: 7,
  },
  {
    id: 'projectCompletionDate',
    name: 'projectCompletionDate',
    label: 'Project Completion Date',
    type: 'date',
    isRequired: false,
    section: 'Project Information',
    order: 8,
  },
  {
    id: 'totalFlats',
    name: 'totalFlats',
    label: 'Total Flats',
    type: 'number',
    isRequired: false,
    section: 'Project Information',
    order: 15,
  },
  {
    id: 'totalWing',
    name: 'totalWing',
    label: 'Total Wings',
    type: 'number',
    isRequired: false,
    section: 'Project Information',
    order: 17,
  },

  // Staff Information
  {
    id: 'staffSeen',
    name: 'staffSeen',
    label: 'Staff Seen',
    type: 'number',
    isRequired: false,
    section: 'Staff Information',
    order: 1,
  },
  {
    id: 'staffStrength',
    name: 'staffStrength',
    label: 'Staff Strength',
    type: 'number',
    isRequired: false,
    section: 'Staff Information',
    order: 2,
  },

  // Name Plates & Boards
  {
    id: 'companyNamePlateStatus',
    name: 'companyNamePlateStatus',
    label: 'Company Name Board',
    type: 'text',
    isRequired: false,
    section: 'Name Plates & Boards',
    order: 1,
  },
  {
    id: 'nameOnBoard',
    name: 'nameOnBoard',
    label: 'Name on Board',
    type: 'text',
    isRequired: false,
    section: 'Name Plates & Boards',
    order: 2,
  },

  // Document Verification
  {
    id: 'documentShownStatus',
    name: 'documentShownStatus',
    label: 'Document Shown Status',
    type: 'text',
    isRequired: false,
    section: 'Document Verification',
    order: 1,
  },
  {
    id: 'documentType',
    name: 'documentType',
    label: 'Document Type',
    type: 'text',
    isRequired: false,
    section: 'Document Verification',
    order: 2,
  },

  // Third Party Confirmation
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC Met Person 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 1,
  },
  {
    id: 'nameOfTpc1',
    name: 'nameOfTpc1',
    label: 'TPC Name 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 2,
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC Confirmation 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 3,
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC Met Person 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 4,
  },
  {
    id: 'nameOfTpc2',
    name: 'nameOfTpc2',
    label: 'TPC Name 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 5,
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC Confirmation 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 6,
  },

  // Builder Information

  // Loan Information

  // Legal & Clearance

  // Shifting & Contact Details
  {
    id: 'shiftedPeriod',
    name: 'shiftedPeriod',
    label: 'Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 1,
  },
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 3,
  },
  {
    id: 'securityConfirmation',
    name: 'securityConfirmation',
    label: 'Security Confirmation',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 6,
  },
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 7,
  },
  {
    id: 'callRemark',
    name: 'callRemark',
    label: 'Call Remark',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 8,
  },

  // Infrastructure & Area Assessment
  {
    id: 'politicalConnection',
    name: 'politicalConnection',
    label: 'Political Connection',
    type: 'text',
    isRequired: false,
    section: 'Infrastructure & Area Assessment',
    order: 3,
  },
  {
    id: 'dominatedArea',
    name: 'dominatedArea',
    label: 'Dominated Area',
    type: 'text',
    isRequired: false,
    section: 'Infrastructure & Area Assessment',
    order: 4,
  },
  {
    id: 'feedbackFromNeighbour',
    name: 'feedbackFromNeighbour',
    label: 'Feedback from Neighbour',
    type: 'text',
    isRequired: false,
    section: 'Infrastructure & Area Assessment',
    order: 5,
  },
  {
    id: 'otherObservation',
    name: 'otherObservation',
    label: 'Other Observation',
    type: 'textarea',
    isRequired: false,
    section: 'Infrastructure & Area Assessment',
    order: 6,
  },
  {
    id: 'finalStatus',
    name: 'finalStatus',
    label: 'Final Status',
    type: 'text',
    isRequired: false,
    section: 'Infrastructure & Area Assessment',
    order: 9,
  },
  {
    id: 'remarks',
    name: 'remarks',
    label: 'Remarks',
    type: 'textarea',
    isRequired: false,
    section: 'Infrastructure & Area Assessment',
    order: 12,
  },
];

// Property Individual form field definitions (based on actual database fields)
const PROPERTY_INDIVIDUAL_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  {
    id: 'outcome',
    name: 'outcome',
    label: 'Verification Outcome',
    type: 'select',
    isRequired: true,
    section: 'Basic Information',
    order: 1,
  },
  {
    id: 'metPersonName',
    name: 'metPersonName',
    label: 'Met Person Name',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 3,
  },
  {
    id: 'metPersonDesignation',
    name: 'metPersonDesignation',
    label: 'Met Person Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 4,
  },
  {
    id: 'metPersonRelation',
    name: 'metPersonRelation',
    label: 'Met Person Relation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 5,
  },

  // Address Information
  {
    id: 'locality',
    name: 'locality',
    label: 'Locality',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 2,
  },
  {
    id: 'addressLocatable',
    name: 'addressLocatable',
    label: 'Address Locatable',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 3,
  },
  {
    id: 'addressRating',
    name: 'addressRating',
    label: 'Address Rating',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 4,
  },
  {
    id: 'addressStructure',
    name: 'addressStructure',
    label: 'Address Structure',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 5,
  },
  {
    id: 'addressStructureColor',
    name: 'addressStructureColor',
    label: 'Address Structure Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 6,
  },
  {
    id: 'addressFloor',
    name: 'addressFloor',
    label: 'Address Floor',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 7,
  },
  {
    id: 'doorColor',
    name: 'doorColor',
    label: 'Door Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 8,
  },
  {
    id: 'landmark1',
    name: 'landmark1',
    label: 'Landmark 1',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 9,
  },
  {
    id: 'landmark2',
    name: 'landmark2',
    label: 'Landmark 2',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 10,
  },
  {
    id: 'landmark3',
    name: 'landmark3',
    label: 'Landmark 3',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 11,
  },
  {
    id: 'landmark4',
    name: 'landmark4',
    label: 'Landmark 4',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 12,
  },

  // Property Details
  {
    id: 'propertyStatus',
    name: 'propertyStatus',
    label: 'Property Status',
    type: 'text',
    isRequired: false,
    section: 'Property Details',
    order: 2,
  },
  {
    id: 'propertyArea',
    name: 'propertyArea',
    label: 'Property Area',
    type: 'number',
    isRequired: false,
    section: 'Property Details',
    order: 6,
  },

  // Owner Information
  {
    id: 'ownerName',
    name: 'ownerName',
    label: 'Owner Name',
    type: 'text',
    isRequired: false,
    section: 'Owner Information',
    order: 1,
  },

  // Individual Information

  // Family & Employment
  {
    id: 'familyMembers',
    name: 'familyMembers',
    label: 'Family Members',
    type: 'number',
    isRequired: false,
    section: 'Family & Employment',
    order: 1,
  },

  // Business Information
  {
    id: 'businessName',
    name: 'businessName',
    label: 'Business Name',
    type: 'text',
    isRequired: false,
    section: 'Business Information',
    order: 1,
  },
  {
    id: 'businessType',
    name: 'businessType',
    label: 'Business Type',
    type: 'text',
    isRequired: false,
    section: 'Business Information',
    order: 2,
  },

  // Financial Information

  // Legal & Documentation

  // Utilities & Amenities

  // Third Party Confirmation
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC Met Person 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 1,
  },
  {
    id: 'nameOfTpc1',
    name: 'nameOfTpc1',
    label: 'TPC Name 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 2,
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC Confirmation 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 3,
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC Met Person 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 4,
  },
  {
    id: 'nameOfTpc2',
    name: 'nameOfTpc2',
    label: 'TPC Name 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 5,
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC Confirmation 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 6,
  },

  // Shifting & Contact Details
  {
    id: 'shiftedPeriod',
    name: 'shiftedPeriod',
    label: 'Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 1,
  },
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 3,
  },
  {
    id: 'securityConfirmation',
    name: 'securityConfirmation',
    label: 'Security Confirmation',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 6,
  },
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 7,
  },
  {
    id: 'callRemark',
    name: 'callRemark',
    label: 'Call Remark',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 8,
  },

  // Area Assessment & Reputation
  {
    id: 'politicalConnection',
    name: 'politicalConnection',
    label: 'Political Connection',
    type: 'text',
    isRequired: false,
    section: 'Area Assessment & Reputation',
    order: 3,
  },
  {
    id: 'dominatedArea',
    name: 'dominatedArea',
    label: 'Dominated Area',
    type: 'text',
    isRequired: false,
    section: 'Area Assessment & Reputation',
    order: 4,
  },
  {
    id: 'feedbackFromNeighbour',
    name: 'feedbackFromNeighbour',
    label: 'Feedback from Neighbour',
    type: 'text',
    isRequired: false,
    section: 'Area Assessment & Reputation',
    order: 5,
  },
  {
    id: 'otherObservation',
    name: 'otherObservation',
    label: 'Other Observation',
    type: 'textarea',
    isRequired: false,
    section: 'Area Assessment & Reputation',
    order: 6,
  },
  {
    id: 'finalStatus',
    name: 'finalStatus',
    label: 'Final Status',
    type: 'text',
    isRequired: false,
    section: 'Area Assessment & Reputation',
    order: 9,
  },
  {
    id: 'remarks',
    name: 'remarks',
    label: 'Remarks',
    type: 'textarea',
    isRequired: false,
    section: 'Area Assessment & Reputation',
    order: 12,
  },
];

// NOC form field definitions
const NOC_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  {
    id: 'outcome',
    name: 'outcome',
    label: 'Verification Outcome',
    type: 'select',
    isRequired: true,
    section: 'Basic Information',
    order: 1,
  },
  {
    id: 'metPersonName',
    name: 'metPersonName',
    label: 'Met Person Name',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 3,
  },
  {
    id: 'metPersonDesignation',
    name: 'metPersonDesignation',
    label: 'Met Person Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 4,
  },
  {
    id: 'metPersonRelation',
    name: 'metPersonRelation',
    label: 'Met Person Relation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 5,
  },

  // Address Information
  {
    id: 'locality',
    name: 'locality',
    label: 'Locality',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 2,
  },
  {
    id: 'addressLocatable',
    name: 'addressLocatable',
    label: 'Address Locatable',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 3,
  },
  {
    id: 'addressRating',
    name: 'addressRating',
    label: 'Address Rating',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 4,
  },
  {
    id: 'addressStructure',
    name: 'addressStructure',
    label: 'Address Structure',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 5,
  },
  {
    id: 'addressStructureColor',
    name: 'addressStructureColor',
    label: 'Address Structure Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 6,
  },
  {
    id: 'addressFloor',
    name: 'addressFloor',
    label: 'Address Floor',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 7,
  },
  {
    id: 'doorColor',
    name: 'doorColor',
    label: 'Door Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 8,
  },
  {
    id: 'landmark1',
    name: 'landmark1',
    label: 'Landmark 1',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 9,
  },
  {
    id: 'landmark2',
    name: 'landmark2',
    label: 'Landmark 2',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 10,
  },
  {
    id: 'landmark3',
    name: 'landmark3',
    label: 'Landmark 3',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 11,
  },
  {
    id: 'landmark4',
    name: 'landmark4',
    label: 'Landmark 4',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 12,
  },

  // NOC Information

  // Property & Project Information
  {
    id: 'projectName',
    name: 'projectName',
    label: 'Project Name',
    type: 'text',
    isRequired: false,
    section: 'Property & Project Information',
    order: 2,
  },

  // Builder & Developer Information

  // Document Verification
  {
    id: 'documentShownStatus',
    name: 'documentShownStatus',
    label: 'Document Shown Status',
    type: 'text',
    isRequired: false,
    section: 'Document Verification',
    order: 1,
  },
  {
    id: 'documentType',
    name: 'documentType',
    label: 'Document Type',
    type: 'text',
    isRequired: false,
    section: 'Document Verification',
    order: 2,
  },

  // Third Party Confirmation
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC Met Person 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 1,
  },
  {
    id: 'nameOfTpc1',
    name: 'nameOfTpc1',
    label: 'TPC Name 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 2,
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC Confirmation 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 3,
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC Met Person 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 4,
  },
  {
    id: 'nameOfTpc2',
    name: 'nameOfTpc2',
    label: 'TPC Name 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 5,
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC Confirmation 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 6,
  },

  // Shifting & Contact Details
  {
    id: 'shiftedPeriod',
    name: 'shiftedPeriod',
    label: 'Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 1,
  },
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 3,
  },
  {
    id: 'securityConfirmation',
    name: 'securityConfirmation',
    label: 'Security Confirmation',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 6,
  },
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 7,
  },
  {
    id: 'callRemark',
    name: 'callRemark',
    label: 'Call Remark',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 8,
  },

  // Clearances & Compliance

  // Infrastructure & Assessment
  {
    id: 'politicalConnection',
    name: 'politicalConnection',
    label: 'Political Connection',
    type: 'text',
    isRequired: false,
    section: 'Infrastructure & Assessment',
    order: 3,
  },
  {
    id: 'dominatedArea',
    name: 'dominatedArea',
    label: 'Dominated Area',
    type: 'text',
    isRequired: false,
    section: 'Infrastructure & Assessment',
    order: 4,
  },
  {
    id: 'feedbackFromNeighbour',
    name: 'feedbackFromNeighbour',
    label: 'Feedback from Neighbour',
    type: 'text',
    isRequired: false,
    section: 'Infrastructure & Assessment',
    order: 5,
  },
  {
    id: 'otherObservation',
    name: 'otherObservation',
    label: 'Other Observation',
    type: 'textarea',
    isRequired: false,
    section: 'Infrastructure & Assessment',
    order: 6,
  },

  // Final Status & Recommendations
  {
    id: 'finalStatus',
    name: 'finalStatus',
    label: 'Final Status',
    type: 'text',
    isRequired: false,
    section: 'Final Status & Recommendations',
    order: 1,
  },
  {
    id: 'remarks',
    name: 'remarks',
    label: 'Remarks',
    type: 'textarea',
    isRequired: false,
    section: 'Final Status & Recommendations',
    order: 4,
  },
];

// Builder form field definitions
const BUILDER_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  {
    id: 'outcome',
    name: 'outcome',
    label: 'Verification Outcome',
    type: 'select',
    isRequired: true,
    section: 'Basic Information',
    order: 1,
  },
  {
    id: 'metPersonName',
    name: 'metPersonName',
    label: 'Met Person Name',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 3,
  },
  {
    id: 'designation',
    name: 'designation',
    label: 'Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 4,
  },
  {
    id: 'applicantDesignation',
    name: 'applicantDesignation',
    label: 'Applicant Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 5,
  },

  // Address Information
  {
    id: 'locality',
    name: 'locality',
    label: 'Locality',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 2,
  },
  {
    id: 'addressLocatable',
    name: 'addressLocatable',
    label: 'Address Locatable',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 3,
  },
  {
    id: 'addressRating',
    name: 'addressRating',
    label: 'Address Rating',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 4,
  },
  {
    id: 'addressStructure',
    name: 'addressStructure',
    label: 'Address Structure',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 5,
  },
  {
    id: 'addressStructureColor',
    name: 'addressStructureColor',
    label: 'Address Structure Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 6,
  },
  {
    id: 'addressFloor',
    name: 'addressFloor',
    label: 'Address Floor',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 7,
  },
  {
    id: 'doorColor',
    name: 'doorColor',
    label: 'Door Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 8,
  },
  {
    id: 'landmark1',
    name: 'landmark1',
    label: 'Landmark 1',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 9,
  },
  {
    id: 'landmark2',
    name: 'landmark2',
    label: 'Landmark 2',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 10,
  },
  {
    id: 'landmark3',
    name: 'landmark3',
    label: 'Landmark 3',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 11,
  },
  {
    id: 'landmark4',
    name: 'landmark4',
    label: 'Landmark 4',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 12,
  },

  // Builder Information
  {
    id: 'builderOwnerName',
    name: 'builderOwnerName',
    label: 'Builder Owner Name',
    type: 'text',
    isRequired: false,
    section: 'Builder Information',
    order: 2,
  },
  {
    id: 'builderType',
    name: 'builderType',
    label: 'Builder Type',
    type: 'text',
    isRequired: false,
    section: 'Builder Information',
    order: 3,
  },
  {
    id: 'companyNatureOfBusiness',
    name: 'companyNatureOfBusiness',
    label: 'Company Nature of Business',
    type: 'text',
    isRequired: false,
    section: 'Builder Information',
    order: 4,
  },
  {
    id: 'businessPeriod',
    name: 'businessPeriod',
    label: 'Business Period',
    type: 'text',
    isRequired: false,
    section: 'Builder Information',
    order: 5,
  },
  {
    id: 'establishmentPeriod',
    name: 'establishmentPeriod',
    label: 'Establishment Period',
    type: 'text',
    isRequired: false,
    section: 'Builder Information',
    order: 6,
  },
  {
    id: 'workingPeriod',
    name: 'workingPeriod',
    label: 'Working Period',
    type: 'text',
    isRequired: false,
    section: 'Builder Information',
    order: 7,
  },
  {
    id: 'workingStatus',
    name: 'workingStatus',
    label: 'Working Status',
    type: 'text',
    isRequired: false,
    section: 'Builder Information',
    order: 8,
  },
  {
    id: 'applicantWorkingStatus',
    name: 'applicantWorkingStatus',
    label: 'Applicant Working Status',
    type: 'text',
    isRequired: false,
    section: 'Builder Information',
    order: 9,
  },

  // Office Information
  {
    id: 'officeStatus',
    name: 'officeStatus',
    label: 'Office Status',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 1,
  },
  {
    id: 'officeExistence',
    name: 'officeExistence',
    label: 'Office Existence',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 2,
  },
  {
    id: 'officeApproxArea',
    name: 'officeApproxArea',
    label: 'Office Approximate Area',
    type: 'number',
    isRequired: false,
    section: 'Office Information',
    order: 3,
  },
  {
    id: 'companyNamePlateStatus',
    name: 'companyNamePlateStatus',
    label: 'Company Nameplate Status',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 4,
  },
  {
    id: 'nameOnBoard',
    name: 'nameOnBoard',
    label: 'Name on Company Board',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 5,
  },

  // Staff Information
  {
    id: 'staffStrength',
    name: 'staffStrength',
    label: 'Staff Strength',
    type: 'number',
    isRequired: false,
    section: 'Staff Information',
    order: 1,
  },
  {
    id: 'staffSeen',
    name: 'staffSeen',
    label: 'Staff Seen',
    type: 'number',
    isRequired: false,
    section: 'Staff Information',
    order: 2,
  },

  // Document Verification
  {
    id: 'documentShown',
    name: 'documentShown',
    label: 'Document Shown',
    type: 'text',
    isRequired: false,
    section: 'Document Verification',
    order: 1,
  },

  // Third Party Confirmation
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC Met Person 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 1,
  },
  {
    id: 'nameOfTpc1',
    name: 'nameOfTpc1',
    label: 'TPC Name 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 2,
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC Confirmation 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 3,
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC Met Person 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 4,
  },
  {
    id: 'nameOfTpc2',
    name: 'nameOfTpc2',
    label: 'TPC Name 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 5,
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC Confirmation 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 6,
  },
  {
    id: 'nameOfMetPerson',
    name: 'nameOfMetPerson',
    label: 'Name of Met Person',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 7,
  },
  {
    id: 'metPersonType',
    name: 'metPersonType',
    label: 'Met Person Type',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 8,
  },
  {
    id: 'metPersonConfirmation',
    name: 'metPersonConfirmation',
    label: 'Met Person Confirmation',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 9,
  },

  // Shifting & Contact Details
  {
    id: 'shiftedPeriod',
    name: 'shiftedPeriod',
    label: 'Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 1,
  },
  {
    id: 'oldOfficeShiftedPeriod',
    name: 'oldOfficeShiftedPeriod',
    label: 'Old Office Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 2,
  },
  {
    id: 'currentCompanyName',
    name: 'currentCompanyName',
    label: 'Current Company Name',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 3,
  },
  {
    id: 'currentCompanyPeriod',
    name: 'currentCompanyPeriod',
    label: 'Current Company Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 4,
  },
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 5,
  },
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 6,
  },
  {
    id: 'callRemark',
    name: 'callRemark',
    label: 'Call Remark',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 7,
  },

  // Assessment & Feedback
  {
    id: 'politicalConnection',
    name: 'politicalConnection',
    label: 'Political Connection',
    type: 'text',
    isRequired: false,
    section: 'Assessment & Feedback',
    order: 1,
  },
  {
    id: 'dominatedArea',
    name: 'dominatedArea',
    label: 'Dominated Area',
    type: 'text',
    isRequired: false,
    section: 'Assessment & Feedback',
    order: 2,
  },
  {
    id: 'feedbackFromNeighbour',
    name: 'feedbackFromNeighbour',
    label: 'Feedback from Neighbour',
    type: 'text',
    isRequired: false,
    section: 'Assessment & Feedback',
    order: 3,
  },
  {
    id: 'otherObservation',
    name: 'otherObservation',
    label: 'Other Observation',
    type: 'textarea',
    isRequired: false,
    section: 'Assessment & Feedback',
    order: 4,
  },

  // Final Status & Recommendations
  {
    id: 'finalStatus',
    name: 'finalStatus',
    label: 'Final Status',
    type: 'text',
    isRequired: false,
    section: 'Final Status & Recommendations',
    order: 1,
  },
  {
    id: 'remarks',
    name: 'remarks',
    label: 'Remarks',
    type: 'textarea',
    isRequired: false,
    section: 'Final Status & Recommendations',
    order: 4,
  },
];

// DSA Connector form field definitions
const DSA_CONNECTOR_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  {
    id: 'outcome',
    name: 'outcome',
    label: 'Verification Outcome',
    type: 'select',
    isRequired: true,
    section: 'Basic Information',
    order: 1,
  },
  {
    id: 'metPersonName',
    name: 'metPersonName',
    label: 'Met Person Name',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 3,
  },
  {
    id: 'metPersonDesignation',
    name: 'metPersonDesignation',
    label: 'Met Person Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 4,
  },
  {
    id: 'metPersonRelation',
    name: 'metPersonRelation',
    label: 'Met Person Relation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 5,
  },

  // Address Information
  {
    id: 'locality',
    name: 'locality',
    label: 'Locality',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 2,
  },
  {
    id: 'addressLocatable',
    name: 'addressLocatable',
    label: 'Address Locatable',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 3,
  },
  {
    id: 'addressRating',
    name: 'addressRating',
    label: 'Address Rating',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 4,
  },
  {
    id: 'addressStructure',
    name: 'addressStructure',
    label: 'Address Structure',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 5,
  },
  {
    id: 'addressStructureColor',
    name: 'addressStructureColor',
    label: 'Address Structure Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 6,
  },
  {
    id: 'addressFloor',
    name: 'addressFloor',
    label: 'Address Floor',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 7,
  },
  {
    id: 'doorColor',
    name: 'doorColor',
    label: 'Door Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 8,
  },
  {
    id: 'landmark1',
    name: 'landmark1',
    label: 'Landmark 1',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 9,
  },
  {
    id: 'landmark2',
    name: 'landmark2',
    label: 'Landmark 2',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 10,
  },
  {
    id: 'landmark3',
    name: 'landmark3',
    label: 'Landmark 3',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 11,
  },
  {
    id: 'landmark4',
    name: 'landmark4',
    label: 'Landmark 4',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 12,
  },

  // Connector Information

  // Business Information
  {
    id: 'businessName',
    name: 'businessName',
    label: 'Business Name',
    type: 'text',
    isRequired: false,
    section: 'Business Information',
    order: 1,
  },
  {
    id: 'businessType',
    name: 'businessType',
    label: 'Business Type',
    type: 'text',
    isRequired: false,
    section: 'Business Information',
    order: 2,
  },
  {
    id: 'businessOperational',
    name: 'businessOperational',
    label: 'Business Operational',
    type: 'text',
    isRequired: false,
    section: 'Business Information',
    order: 5,
  },

  // Office Information
  {
    id: 'officeType',
    name: 'officeType',
    label: 'Office Type',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 1,
  },
  {
    id: 'officeArea',
    name: 'officeArea',
    label: 'Office Area',
    type: 'number',
    isRequired: false,
    section: 'Office Information',
    order: 2,
  },

  // Staff Information
  {
    id: 'totalStaff',
    name: 'totalStaff',
    label: 'Total Staff',
    type: 'number',
    isRequired: false,
    section: 'Staff Information',
    order: 1,
  },

  // Financial Information

  // Technology & Infrastructure

  // Compliance & Licensing

  // Third Party Confirmation
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC Met Person 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 1,
  },
  {
    id: 'nameOfTpc1',
    name: 'nameOfTpc1',
    label: 'TPC Name 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 2,
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC Confirmation 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 3,
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC Met Person 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 4,
  },
  {
    id: 'nameOfTpc2',
    name: 'nameOfTpc2',
    label: 'TPC Name 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 5,
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC Confirmation 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 6,
  },

  // Shifting & Contact Details
  {
    id: 'shiftedPeriod',
    name: 'shiftedPeriod',
    label: 'Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 1,
  },
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 3,
  },
  {
    id: 'securityConfirmation',
    name: 'securityConfirmation',
    label: 'Security Confirmation',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 6,
  },
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 7,
  },
  {
    id: 'callRemark',
    name: 'callRemark',
    label: 'Call Remark',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 8,
  },

  // Market Analysis & Assessment

  // Risk Assessment & Final Status
  {
    id: 'politicalConnection',
    name: 'politicalConnection',
    label: 'Political Connection',
    type: 'text',
    isRequired: false,
    section: 'Risk Assessment & Final Status',
    order: 1,
  },
  {
    id: 'dominatedArea',
    name: 'dominatedArea',
    label: 'Dominated Area',
    type: 'text',
    isRequired: false,
    section: 'Risk Assessment & Final Status',
    order: 2,
  },
  {
    id: 'feedbackFromNeighbour',
    name: 'feedbackFromNeighbour',
    label: 'Feedback from Neighbour',
    type: 'text',
    isRequired: false,
    section: 'Risk Assessment & Final Status',
    order: 3,
  },
  {
    id: 'otherObservation',
    name: 'otherObservation',
    label: 'Other Observation',
    type: 'textarea',
    isRequired: false,
    section: 'Risk Assessment & Final Status',
    order: 4,
  },
  {
    id: 'finalStatus',
    name: 'finalStatus',
    label: 'Final Status',
    type: 'text',
    isRequired: false,
    section: 'Risk Assessment & Final Status',
    order: 8,
  },
  {
    id: 'remarks',
    name: 'remarks',
    label: 'Remarks',
    type: 'textarea',
    isRequired: false,
    section: 'Risk Assessment & Final Status',
    order: 11,
  },
];

// Residence-cum-Office form field definitions (combines residence and office fields)
const RESIDENCE_CUM_OFFICE_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  {
    id: 'outcome',
    name: 'outcome',
    label: 'Verification Outcome',
    type: 'select',
    isRequired: true,
    section: 'Basic Information',
    order: 1,
  },
  {
    id: 'metPersonName',
    name: 'metPersonName',
    label: 'Met Person Name',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 3,
  },
  {
    id: 'metPersonRelation',
    name: 'metPersonRelation',
    label: 'Met Person Relation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 4,
  },
  {
    id: 'designation',
    name: 'designation',
    label: 'Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 5,
  },
  {
    id: 'applicantDesignation',
    name: 'applicantDesignation',
    label: 'Applicant Designation',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 6,
  },

  // Address Information
  {
    id: 'locality',
    name: 'locality',
    label: 'Locality',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 2,
  },
  {
    id: 'addressLocatable',
    name: 'addressLocatable',
    label: 'Address Locatable',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 3,
  },
  {
    id: 'addressRating',
    name: 'addressRating',
    label: 'Address Rating',
    type: 'select',
    isRequired: false,
    section: 'Address Information',
    order: 4,
  },
  {
    id: 'addressStructure',
    name: 'addressStructure',
    label: 'Address Structure',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 5,
  },
  {
    id: 'addressStructureColor',
    name: 'addressStructureColor',
    label: 'Address Structure Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 6,
  },
  {
    id: 'addressFloor',
    name: 'addressFloor',
    label: 'Address Floor',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 7,
  },
  {
    id: 'doorColor',
    name: 'doorColor',
    label: 'Door Color',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 8,
  },
  {
    id: 'landmark1',
    name: 'landmark1',
    label: 'Landmark 1',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 9,
  },
  {
    id: 'landmark2',
    name: 'landmark2',
    label: 'Landmark 2',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 10,
  },
  {
    id: 'landmark3',
    name: 'landmark3',
    label: 'Landmark 3',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 11,
  },
  {
    id: 'landmark4',
    name: 'landmark4',
    label: 'Landmark 4',
    type: 'text',
    isRequired: false,
    section: 'Address Information',
    order: 12,
  },

  // Residence Information
  {
    id: 'houseStatus',
    name: 'houseStatus',
    label: 'House Status',
    type: 'text',
    isRequired: false,
    section: 'Residence Information',
    order: 1,
  },
  {
    id: 'totalFamilyMembers',
    name: 'totalFamilyMembers',
    label: 'Total Family Members',
    type: 'number',
    isRequired: false,
    section: 'Residence Information',
    order: 2,
  },
  {
    id: 'totalEarningMember',
    name: 'totalEarningMember',
    label: 'Total Earning Members',
    type: 'number',
    isRequired: false,
    section: 'Residence Information',
    order: 3,
  },
  {
    id: 'stayingPeriod',
    name: 'stayingPeriod',
    label: 'Staying Period',
    type: 'text',
    isRequired: false,
    section: 'Residence Information',
    order: 4,
  },
  {
    id: 'stayingStatus',
    name: 'stayingStatus',
    label: 'Staying Status',
    type: 'text',
    isRequired: false,
    section: 'Residence Information',
    order: 5,
  },
  {
    id: 'stayingPersonName',
    name: 'stayingPersonName',
    label: 'Staying Person Name',
    type: 'text',
    isRequired: false,
    section: 'Residence Information',
    order: 6,
  },
  {
    id: 'doorNamePlateStatus',
    name: 'doorNamePlateStatus',
    label: 'Door Nameplate Status',
    type: 'text',
    isRequired: false,
    section: 'Residence Information',
    order: 7,
  },
  {
    id: 'nameOnDoorPlate',
    name: 'nameOnDoorPlate',
    label: 'Name on Door Plate',
    type: 'text',
    isRequired: false,
    section: 'Residence Information',
    order: 8,
  },
  {
    id: 'societyNamePlateStatus',
    name: 'societyNamePlateStatus',
    label: 'Society Nameplate Status',
    type: 'text',
    isRequired: false,
    section: 'Residence Information',
    order: 9,
  },
  {
    id: 'nameOnSocietyBoard',
    name: 'nameOnSocietyBoard',
    label: 'Name on Society Board',
    type: 'text',
    isRequired: false,
    section: 'Residence Information',
    order: 10,
  },

  // Applicant Information
  {
    id: 'applicantStayingStatus',
    name: 'applicantStayingStatus',
    label: 'Applicant Staying Status',
    type: 'text',
    isRequired: false,
    section: 'Applicant Information',
    order: 3,
  },
  {
    id: 'applicantWorkingStatus',
    name: 'applicantWorkingStatus',
    label: 'Applicant Working Status',
    type: 'text',
    isRequired: false,
    section: 'Applicant Information',
    order: 4,
  },
  {
    id: 'applicantWorkingPremises',
    name: 'applicantWorkingPremises',
    label: 'Applicant Working Premises',
    type: 'text',
    isRequired: false,
    section: 'Applicant Information',
    order: 5,
  },

  // Office Information
  {
    id: 'officeStatus',
    name: 'officeStatus',
    label: 'Office Status',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 1,
  },
  {
    id: 'officeExistence',
    name: 'officeExistence',
    label: 'Office Existence',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 2,
  },
  {
    id: 'officeType',
    name: 'officeType',
    label: 'Office Type',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 3,
  },
  {
    id: 'companyNatureOfBusiness',
    name: 'companyNatureOfBusiness',
    label: 'Company Nature of Business',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 4,
  },
  {
    id: 'businessPeriod',
    name: 'businessPeriod',
    label: 'Business Period',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 5,
  },
  {
    id: 'establishmentPeriod',
    name: 'establishmentPeriod',
    label: 'Establishment Period',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 6,
  },
  {
    id: 'workingPeriod',
    name: 'workingPeriod',
    label: 'Working Period',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 7,
  },
  {
    id: 'workingStatus',
    name: 'workingStatus',
    label: 'Working Status',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 8,
  },
  {
    id: 'approxArea',
    name: 'approxArea',
    label: 'Approximate Area',
    type: 'number',
    isRequired: false,
    section: 'Office Information',
    order: 9,
  },
  {
    id: 'sittingLocation',
    name: 'sittingLocation',
    label: 'Sitting Location',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 10,
  },
  {
    id: 'companyNamePlateStatus',
    name: 'companyNamePlateStatus',
    label: 'Company Nameplate Status',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 11,
  },
  {
    id: 'nameOnBoard',
    name: 'nameOnBoard',
    label: 'Name on Company Board',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 12,
  },

  // Staff Information
  {
    id: 'staffStrength',
    name: 'staffStrength',
    label: 'Staff Strength',
    type: 'number',
    isRequired: false,
    section: 'Staff Information',
    order: 1,
  },
  {
    id: 'staffSeen',
    name: 'staffSeen',
    label: 'Staff Seen',
    type: 'number',
    isRequired: false,
    section: 'Staff Information',
    order: 2,
  },

  // Document Verification
  {
    id: 'documentShownStatus',
    name: 'documentShownStatus',
    label: 'Document Shown Status',
    type: 'text',
    isRequired: false,
    section: 'Document Verification',
    order: 1,
  },
  {
    id: 'documentType',
    name: 'documentType',
    label: 'Document Type',
    type: 'text',
    isRequired: false,
    section: 'Document Verification',
    order: 2,
  },

  // Third Party Confirmation
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC Met Person 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 1,
  },
  {
    id: 'nameOfTpc1',
    name: 'nameOfTpc1',
    label: 'TPC Name 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 2,
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC Confirmation 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 3,
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC Met Person 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 4,
  },
  {
    id: 'nameOfTpc2',
    name: 'nameOfTpc2',
    label: 'TPC Name 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 5,
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC Confirmation 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 6,
  },
  {
    id: 'nameOfMetPerson',
    name: 'nameOfMetPerson',
    label: 'Name of Met Person',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 7,
  },
  {
    id: 'metPersonType',
    name: 'metPersonType',
    label: 'Met Person Type',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 8,
  },
  {
    id: 'metPersonConfirmation',
    name: 'metPersonConfirmation',
    label: 'Met Person Confirmation',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 9,
  },

  // Shifting & Contact Details
  {
    id: 'shiftedPeriod',
    name: 'shiftedPeriod',
    label: 'Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 1,
  },
  {
    id: 'oldOfficeShiftedPeriod',
    name: 'oldOfficeShiftedPeriod',
    label: 'Old Office Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 2,
  },
  {
    id: 'currentCompanyName',
    name: 'currentCompanyName',
    label: 'Current Company Name',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 3,
  },
  {
    id: 'currentCompanyPeriod',
    name: 'currentCompanyPeriod',
    label: 'Current Company Period',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 4,
  },
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 5,
  },
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 6,
  },
  {
    id: 'callRemark',
    name: 'callRemark',
    label: 'Call Remark',
    type: 'text',
    isRequired: false,
    section: 'Shifting & Contact Details',
    order: 7,
  },

  // Area Assessment & Final Status
  {
    id: 'politicalConnection',
    name: 'politicalConnection',
    label: 'Political Connection',
    type: 'text',
    isRequired: false,
    section: 'Area Assessment & Final Status',
    order: 1,
  },
  {
    id: 'dominatedArea',
    name: 'dominatedArea',
    label: 'Dominated Area',
    type: 'text',
    isRequired: false,
    section: 'Area Assessment & Final Status',
    order: 2,
  },
  {
    id: 'feedbackFromNeighbour',
    name: 'feedbackFromNeighbour',
    label: 'Feedback from Neighbour',
    type: 'text',
    isRequired: false,
    section: 'Area Assessment & Final Status',
    order: 3,
  },
  {
    id: 'otherObservation',
    name: 'otherObservation',
    label: 'Other Observation',
    type: 'textarea',
    isRequired: false,
    section: 'Area Assessment & Final Status',
    order: 4,
  },
  {
    id: 'finalStatus',
    name: 'finalStatus',
    label: 'Final Status',
    type: 'text',
    isRequired: false,
    section: 'Area Assessment & Final Status',
    order: 6,
  },
  {
    id: 'remarks',
    name: 'remarks',
    label: 'Remarks',
    type: 'textarea',
    isRequired: false,
    section: 'Area Assessment & Final Status',
    order: 9,
  },
];

// Field definitions mapping by verification type
export const VERIFICATION_TYPE_FIELDS: Record<string, FormFieldDefinition[]> = {
  RESIDENCE: RESIDENCE_FORM_FIELDS,
  OFFICE: OFFICE_FORM_FIELDS,
  BUSINESS: BUSINESS_FORM_FIELDS,
  PROPERTY_APF: PROPERTY_APF_FORM_FIELDS,
  PROPERTY_INDIVIDUAL: PROPERTY_INDIVIDUAL_FORM_FIELDS,
  NOC: NOC_FORM_FIELDS,
  BUILDER: BUILDER_FORM_FIELDS,
  DSA_CONNECTOR: DSA_CONNECTOR_FORM_FIELDS,
  CONNECTOR: DSA_CONNECTOR_FORM_FIELDS, // Alias for DSA_CONNECTOR
  RESIDENCE_CUM_OFFICE: RESIDENCE_CUM_OFFICE_FORM_FIELDS,
  'Residence-cum-office': RESIDENCE_CUM_OFFICE_FORM_FIELDS, // Alias for RESIDENCE_CUM_OFFICE
};

/**
 * Get form field definitions for a specific verification type and form type
 */
export function getFormFieldDefinitions(
  verificationType: string,
  formType?: string
): FormFieldDefinition[] {
  const fields = VERIFICATION_TYPE_FIELDS[verificationType.toUpperCase()] || [];

  if (!formType) {
    return fields;
  }

  // Filter fields based on form type
  return fields.filter(
    field => !field.formTypes || field.formTypes.includes(formType.toUpperCase())
  );
}

/**
 * Get sections for a specific verification type and form type
 */
export function getFormSections(verificationType: string, formType?: string): string[] {
  const fields = getFormFieldDefinitions(verificationType, formType);
  const sections = new Set<string>();

  fields.forEach(field => sections.add(field.section));

  return Array.from(sections);
}

/**
 * Get fields for a specific section
 */
export function getFieldsForSection(
  verificationType: string,
  section: string,
  formType?: string
): FormFieldDefinition[] {
  const fields = getFormFieldDefinitions(verificationType, formType);

  return fields.filter(field => field.section === section).sort((a, b) => a.order - b.order);
}

/**
 * Create form sections directly from formData — no predefined schema needed.
 * Groups fields by category, converts camelCase to labels, skips system fields.
 */
export function createComprehensiveFormSections(
  formData: Record<string, unknown>,
  _verificationType: string,
  _formType: string
): FormSection[] {
  // System fields that should NOT be displayed (set by controller, not by mobile)
  const SKIP_FIELDS = new Set([
    'outcome',
    'customerName',
    'callRemark',
    'finalStatus',
    'remarks',
    'recommendationStatus',
  ]);

  // Field → Section mapping based on field name patterns
  const getSectionForField = (name: string): string => {
    if (
      /^address|^locality|^landmark|^door(Color|Name)|^society|^company.*Plate|^nameOn/.test(name)
    ) {
      return 'Address & Location';
    }
    if (/^metPerson|^nameOfMet|^applicant(Staying|Working)|^stayingPerson/.test(name)) {
      return 'Person Details';
    }
    if (/^house|^room|^premises|^office(Status|Existence|Type|Area)|^building|^flat/.test(name)) {
      return 'Premises Details';
    }
    if (
      /^total(Family|Earning|Staff)|^staff|^earning|^family|^staying(Period|Status)|^working|^companyName$|^approxArea/.test(
        name
      )
    ) {
      return 'Personal & Work Details';
    }
    if (/^document|^property(Doc|Documents)/.test(name)) {
      return 'Document Verification';
    }
    if (/^tpc|^nameOfTpc|^neighbor/.test(name)) {
      return 'Third Party Confirmation';
    }
    if (/^shifted|^current(Location|Company)|^old(Office|Business)|^previous/.test(name)) {
      return 'Shifting Details';
    }
    if (/^entry|^security|^access/.test(name)) {
      return 'Entry Restriction';
    }
    if (/^contact|^alternate|^callRemark/.test(name)) {
      return 'Contact Details';
    }
    if (
      /^political|^dominated|^feedback|^other(Observation|Extra)|^infrastructure|^road/.test(name)
    ) {
      return 'Area Assessment';
    }
    if (
      /^connector|^business(Name|Type|Reg|Est|Operational|Hours)|^license|^compliance|^audit|^training/.test(
        name
      )
    ) {
      return 'Business & Connector Details';
    }
    if (
      /^noc|^project|^builder|^developer|^rera|^apf|^property|^owner|^individual|^loan|^bank|^emi/.test(
        name
      )
    ) {
      return 'Property & Project Details';
    }
    if (
      /^monthly|^annual|^commission|^payment|^market|^competitor|^customer(Footfall|Feedback)|^commercial|^growth|^risk/.test(
        name
      )
    ) {
      return 'Financial & Market Details';
    }
    if (/^computer|^internet|^software|^pos|^printer|^office(Rent|Area(?!$))/.test(name)) {
      return 'Technology & Infrastructure';
    }
    if (/^electric|^water|^gas|^fire|^pollution|^environmental|^safety/.test(name)) {
      return 'Utilities & Clearances';
    }
    return 'Other Details';
  };

  // Convert camelCase to label: "metPersonName" → "Met Person Name"
  const toLabel = (name: string): string =>
    name
      .replace(/(\d+)/g, ' $1') // "landmark1" → "landmark 1"
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .replace(/\bTpc\b/gi, 'TPC')
      .replace(/\bNoc\b/gi, 'NOC')
      .replace(/\bApf\b/gi, 'APF')
      .replace(/\bDsa\b/gi, 'DSA')
      .replace(/\bRera\b/gi, 'RERA')
      .replace(/\bEmi\b/gi, 'EMI')
      .trim();

  // Build sections from formData
  const sectionMap = new Map<string, FormField[]>();
  let order = 0;

  for (const [key, value] of Object.entries(formData)) {
    if (SKIP_FIELDS.has(key)) {
      continue;
    }
    if (value === null || value === undefined || value === '') {
      continue;
    }

    const section = getSectionForField(key);
    if (!sectionMap.has(section)) {
      sectionMap.set(section, []);
    }

    sectionMap.get(section)!.push({
      id: key,
      name: key,
      label: toLabel(key),
      type: typeof value === 'number' ? 'number' : 'text',
      value,
      isRequired: false,
    });
  }

  // Add final assessment section with the skipped fields that have values
  const assessmentFields: FormField[] = [];
  const assessmentKeys = ['finalStatus', 'recommendationStatus', 'remarks', 'callRemark'];
  for (const key of assessmentKeys) {
    const val = formData[key];
    if (val !== null && val !== undefined && val !== '') {
      assessmentFields.push({
        id: key,
        name: key,
        label: toLabel(key),
        type: 'text',
        value: val,
        isRequired: false,
      });
    }
  }
  if (assessmentFields.length > 0) {
    sectionMap.set('Final Assessment', assessmentFields);
  }

  // Add customer info at the top
  const basicFields: FormField[] = [];
  if (formData.customerName) {
    basicFields.push({
      id: 'customerName',
      name: 'customerName',
      label: 'Customer Name',
      type: 'text',
      value: formData.customerName,
      isRequired: false,
    });
  }
  if (formData.outcome) {
    basicFields.push({
      id: 'outcome',
      name: 'outcome',
      label: 'Verification Outcome',
      type: 'text',
      value: formData.outcome,
      isRequired: false,
    });
  }

  // Build final sections array
  const sections: FormSection[] = [];

  if (basicFields.length > 0) {
    sections.push({
      id: 'basic_info',
      title: 'Basic Information',
      order: order++,
      fields: basicFields,
    });
  }

  // Preferred section order
  const sectionOrder = [
    'Address & Location',
    'Premises Details',
    'Person Details',
    'Personal & Work Details',
    'Document Verification',
    'Business & Connector Details',
    'Property & Project Details',
    'Financial & Market Details',
    'Technology & Infrastructure',
    'Utilities & Clearances',
    'Third Party Confirmation',
    'Shifting Details',
    'Entry Restriction',
    'Contact Details',
    'Area Assessment',
    'Other Details',
    'Final Assessment',
  ];

  for (const sectionName of sectionOrder) {
    const fields = sectionMap.get(sectionName);
    if (fields && fields.length > 0) {
      sections.push({
        id: sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        title: sectionName,
        order: order++,
        fields,
      });
    }
  }

  logger.info(
    `Generated ${sections.length} sections with ${sections.reduce((n, s) => n + s.fields.length, 0)} fields from formData`
  );
  return sections;
}

/**
 * Group fields into sections based on their section property
 */
function _groupFieldsIntoSections(
  fields: FormFieldDefinition[],
  formData: Record<string, unknown>
): FormSection[] {
  // Group fields by section
  const sectionMap = new Map<string, FormField[]>();

  fields.forEach(fieldDef => {
    const sectionName = fieldDef.section || 'General Information';
    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, []);
    }

    const value = formData[fieldDef.name] || formData[fieldDef.id];

    sectionMap.get(sectionName)!.push({
      id: fieldDef.id,
      name: fieldDef.name,
      label: fieldDef.label,
      type: fieldDef.type,
      value,
      displayValue: value,
      isRequired: fieldDef.isRequired,
      validation: {
        isValid: true,
        errors: [],
      },
    });
  });

  // Convert map to sections array
  const sections: FormSection[] = [];
  let order = 1;

  for (const [title, sectionFields] of sectionMap.entries()) {
    if (sectionFields.length > 0) {
      sections.push({
        id: title.toLowerCase().replace(/\s+/g, '_'),
        title,
        description: `${title} fields`,
        fields: sectionFields,
        order: order++,
        isRequired: title === 'Basic Information',
        defaultExpanded: order <= 2, // Expand first 2 sections by default
      });
    }
  }

  return sections;
}

/**
 * Legacy form sections creation (fallback)
 * Uses the old method of showing all fields
 */
function _createLegacyFormSections(
  formData: Record<string, unknown>,
  verificationType: string,
  formType: string
): FormSection[] {
  logger.info(`Using legacy form sections for ${verificationType} - ${formType}`);

  const sections: FormSection[] = [];
  const sectionNames = getFormSections(verificationType, formType);

  sectionNames.forEach((sectionName, index) => {
    const sectionFields = getFieldsForSection(verificationType, sectionName, formType);
    const populatedFields: FormField[] = [];

    sectionFields.forEach(fieldDef => {
      const value = formData[fieldDef.name] || formData[fieldDef.id];

      // Always include the field, even if empty (show "Not provided")
      populatedFields.push({
        id: fieldDef.id,
        name: fieldDef.name,
        label: fieldDef.label,
        type: fieldDef.type,
        value: value || null,
        displayValue: value || 'Not provided',
        isRequired: fieldDef.isRequired,
        validation: {
          isValid: true,
          errors: [],
        },
      });
    });

    if (populatedFields.length > 0) {
      sections.push({
        id: sectionName.toLowerCase().replace(/\s+/g, '_'),
        title: sectionName,
        description: `${sectionName} fields for ${formType} verification`,
        fields: populatedFields,
        order: index + 1,
        isRequired: sectionName === 'Basic Information',
        defaultExpanded: index < 2,
      });
    }
  });

  return sections;
}

/**
 * Get human-readable labels for form types
 */
export function getFormTypeLabel(formType: string): string {
  const labels: Record<string, string> = {
    POSITIVE: 'Positive & Door Locked',
    SHIFTED: 'Shifted & Door Lock',
    NSP: 'NSP & Door Lock',
    ENTRY_RESTRICTED: 'Entry Restricted (ERT)',
    UNTRACEABLE: 'Untraceable',
  };

  return labels[formType.toUpperCase()] || formType;
}

/**
 * Get verification type specific table names
 */
export function getVerificationTableName(verificationType: string): string {
  const tableNames: Record<string, string> = {
    RESIDENCE: 'residenceVerificationReports',
    OFFICE: 'officeVerificationReports',
    BUSINESS: 'businessVerificationReports',
    BUILDER: 'builderVerificationReports',
    RESIDENCE_CUM_OFFICE: 'residenceCumOfficeVerificationReports',
    PROPERTY_APF: 'propertyApfVerificationReports',
    NOC: 'nocVerificationReports',
    PROPERTY_INDIVIDUAL: 'propertyIndividualVerificationReports',
    DSA_CONNECTOR: 'dsaConnectorVerificationReports',
  };

  return tableNames[verificationType.toUpperCase()] || 'residenceVerificationReports';
}
