/**
 * Type-Aware and Value-Aware Form Field Schemas
 *
 * This module provides field schemas organized by:
 * 1. Verification Type (BUSINESS, RESIDENCE, OFFICE, etc.)
 * 2. Form Type / Outcome (POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE)
 * 3. Conditional Field Rules (fields shown based on parent field values)
 *
 * This ensures only relevant fields with actual values are displayed in the frontend.
 */

import type { FormFieldDefinition } from './comprehensiveFormFieldMapping';

// ============================================================================
// CONDITIONAL FIELD RULES
// ============================================================================

export interface ConditionalRule {
  parentField: string; // Field that controls visibility
  operator: 'equals' | 'notEquals' | 'contains' | 'in' | 'notIn';
  value: unknown; // Value(s) that trigger visibility
  showFields: string[]; // Fields to show when condition is met
}

export const CONDITIONAL_FIELD_RULES: Record<string, ConditionalRule[]> = {
  // Door Status Conditionals
  door_status: [
    {
      parentField: 'door_status',
      operator: 'equals',
      value: 'Open',
      showFields: [
        'metPersonName',
        'metPersonRelation',
        'metPersonStatus',
        'documentShown',
        'documentType',
      ],
    },
    {
      parentField: 'door_status',
      operator: 'equals',
      value: 'Locked',
      showFields: [
        'tpcMetPerson1',
        'tpcName1',
        'tpcConfirmation1',
        'tpcMetPerson2',
        'tpcName2',
        'tpcConfirmation2',
      ],
    },
  ],

  // Nameplate Visibility Conditionals
  doorNamePlateStatus: [
    {
      parentField: 'doorNamePlateStatus',
      operator: 'equals',
      value: 'Visible',
      showFields: ['nameOnDoorPlate'],
    },
  ],

  societyNamePlateStatus: [
    {
      parentField: 'societyNamePlateStatus',
      operator: 'equals',
      value: 'Visible',
      showFields: ['nameOnSocietyBoard'],
    },
  ],

  companyNamePlateStatus: [
    {
      parentField: 'companyNamePlateStatus',
      operator: 'in',
      value: ['Present', 'Visible', 'Yes'],
      showFields: ['nameOnCompanyBoard'],
    },
  ],

  // Document Verification Conditionals
  documentShown: [
    {
      parentField: 'documentShown',
      operator: 'in',
      value: ['Yes', 'Shown'],
      showFields: ['documentType'],
    },
  ],

  documentShownStatus: [
    {
      parentField: 'documentShownStatus',
      operator: 'in',
      value: ['Shown', 'Yes'],
      showFields: ['documentType'],
    },
  ],

  // TPC Confirmation Conditionals
  tpcConfirmation1: [
    {
      parentField: 'tpcConfirmation1',
      operator: 'in',
      value: ['Positive', 'Confirmed', 'Yes'],
      showFields: ['tpcName1', 'tpcMetPerson1'],
    },
  ],

  tpcConfirmation2: [
    {
      parentField: 'tpcConfirmation2',
      operator: 'in',
      value: ['Positive', 'Confirmed', 'Yes'],
      showFields: ['tpcName2', 'tpcMetPerson2'],
    },
  ],

  // Business/Office Existence Conditionals
  businessExistence: [
    {
      parentField: 'businessExistence',
      operator: 'in',
      value: ['Exists', 'Active', 'Running'],
      showFields: [
        'businessStatus',
        'businessType',
        'ownershipType',
        'ownerName',
        'staffStrength',
        'staffSeen',
        'businessActivity',
      ],
    },
    {
      parentField: 'businessExistence',
      operator: 'equals',
      value: 'Shifted',
      showFields: [
        'shiftedPeriod',
        'currentCompanyName',
        'currentCompanyPeriod',
        'oldBusinessShiftedPeriod',
      ],
    },
    {
      parentField: 'businessExistence',
      operator: 'in',
      value: ['Not Found', 'Closed', 'Untraceable'],
      showFields: ['premisesStatus', 'contactPerson'],
    },
  ],

  officeExistence: [
    {
      parentField: 'officeExistence',
      operator: 'in',
      value: ['Exists', 'Active', 'Running'],
      showFields: [
        'officeStatus',
        'officeType',
        'designation',
        'workingStatus',
        'staffStrength',
        'staffSeen',
      ],
    },
    {
      parentField: 'officeExistence',
      operator: 'equals',
      value: 'Shifted',
      showFields: ['shiftedPeriod', 'currentCompanyName', 'oldOfficeShiftedPeriod'],
    },
  ],

  // Applicant Working Status Conditionals
  applicantWorkingPremises: [
    {
      parentField: 'applicantWorkingPremises',
      operator: 'in',
      value: ['Yes', 'Working'],
      showFields: [
        'designation',
        'applicantDesignation',
        'workingPeriod',
        'workingStatus',
        'applicantWorkingStatus',
      ],
    },
  ],

  // Staying Status Conditionals
  applicantStayingStatus: [
    {
      parentField: 'applicantStayingStatus',
      operator: 'in',
      value: ['Staying', 'Residing'],
      showFields: ['stayingPeriod', 'houseStatus', 'totalFamilyMembers', 'totalEarning'],
    },
    {
      parentField: 'applicantStayingStatus',
      operator: 'equals',
      value: 'Shifted',
      showFields: ['shiftedPeriod', 'currentLocation', 'stayingPersonName'],
    },
  ],

  // Entry Restriction Conditionals
  accessDenied: [
    {
      parentField: 'accessDenied',
      operator: 'in',
      value: ['Yes', 'Denied'],
      showFields: ['entryRestrictionReason', 'securityPersonName'],
    },
  ],

  // Premises Status Conditionals
  premisesStatus: [
    {
      parentField: 'premisesStatus',
      operator: 'in',
      value: ['Locked', 'Closed'],
      showFields: ['tpcMetPerson1', 'tpcConfirmation1', 'tpcMetPerson2', 'tpcConfirmation2'],
    },
    {
      parentField: 'premisesStatus',
      operator: 'equals',
      value: 'Vacant',
      showFields: ['shiftedPeriod', 'contactPerson', 'alternateContact'],
    },
  ],
};

// ============================================================================
// CONDITIONAL FIELD EVALUATION LOGIC
// ============================================================================

export function evaluateConditionalRule(rule: ConditionalRule, formData: any): boolean {
  const parentValue = formData[rule.parentField];

  // If parent field has no value, condition is not met
  if (parentValue === null || parentValue === undefined || parentValue === '') {
    return false;
  }

  switch (rule.operator) {
    case 'equals':
      return parentValue === rule.value;

    case 'notEquals':
      return parentValue !== rule.value;

    case 'contains':
      return String(parentValue).toLowerCase().includes(String(rule.value).toLowerCase());

    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(parentValue);

    case 'notIn':
      return Array.isArray(rule.value) && !rule.value.includes(parentValue);

    default:
      return false;
  }
}

export function shouldShowField(
  fieldName: string,
  formData: any,
  allRules: Record<string, ConditionalRule[]> = CONDITIONAL_FIELD_RULES
): boolean {
  // Check if this field is controlled by any conditional rules
  for (const [_parentField, rules] of Object.entries(allRules)) {
    for (const rule of rules) {
      if (rule.showFields.includes(fieldName)) {
        // This field is conditional - check if condition is met
        const conditionMet = evaluateConditionalRule(rule, formData);
        if (!conditionMet) {
          return false; // Condition not met, hide field
        }
      }
    }
  }

  // Field is not conditional OR all conditions are met
  return true;
}

// ============================================================================
// TYPE-AWARE FIELD SCHEMAS
// ============================================================================

// Common fields shown for ALL verification types and outcomes
const COMMON_FIELDS: FormFieldDefinition[] = [
  {
    id: 'customerName',
    name: 'customerName',
    label: 'Customer Name',
    type: 'text',
    isRequired: true,
    section: 'Basic Information',
    order: 1,
  },
  {
    id: 'metPersonName',
    name: 'metPersonName',
    label: 'Person Met',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 2,
  },
  {
    id: 'addressLocatable',
    name: 'addressLocatable',
    label: 'Address Locatable',
    type: 'select',
    isRequired: false,
    section: 'Address Details',
    order: 1,
  },
  {
    id: 'addressRating',
    name: 'addressRating',
    label: 'Address Rating',
    type: 'select',
    isRequired: false,
    section: 'Address Details',
    order: 2,
  },
  {
    id: 'locality',
    name: 'locality',
    label: 'Locality',
    type: 'text',
    isRequired: false,
    section: 'Address Details',
    order: 3,
  },
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
    label: 'Feedback from Neighbour',
    type: 'textarea',
    isRequired: false,
    section: 'Area Assessment',
    order: 3,
  },
  {
    id: 'finalStatus',
    name: 'finalStatus',
    label: 'Final Status',
    type: 'select',
    isRequired: false,
    section: 'Verification Outcome',
    order: 1,
  },
  {
    id: 'callRemark',
    name: 'callRemark',
    label: 'Call Remark',
    type: 'textarea',
    isRequired: false,
    section: 'Verification Outcome',
    order: 2,
  },
  {
    id: 'landmark1',
    name: 'landmark1',
    label: 'Landmark 1',
    type: 'text',
    isRequired: false,
    section: 'Address Details',
    order: 4,
  },
  {
    id: 'landmark2',
    name: 'landmark2',
    label: 'Landmark 2',
    type: 'text',
    isRequired: false,
    section: 'Address Details',
    order: 5,
  },
  {
    id: 'landmark3',
    name: 'landmark3',
    label: 'Landmark 3',
    type: 'text',
    isRequired: false,
    section: 'Address Details',
    order: 6,
  },
  {
    id: 'landmark4',
    name: 'landmark4',
    label: 'Landmark 4',
    type: 'text',
    isRequired: false,
    section: 'Address Details',
    order: 7,
  },
  {
    id: 'addressStructure',
    name: 'addressStructure',
    label: 'Address Structure',
    type: 'text',
    isRequired: false,
    section: 'Address Details',
    order: 8,
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
];

// ============================================================================
// BUSINESS VERIFICATION FIELD SCHEMAS
// ============================================================================

const BUSINESS_POSITIVE_FIELDS: FormFieldDefinition[] = [
  // Business Details
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
    id: 'businessExistence',
    name: 'businessExistence',
    label: 'Business Existence',
    type: 'select',
    isRequired: false,
    section: 'Business Details',
    order: 5,
  },
  {
    id: 'businessActivity',
    name: 'businessActivity',
    label: 'Business Activity',
    type: 'select',
    isRequired: false,
    section: 'Business Details',
    order: 6,
  },
  {
    id: 'ownershipType',
    name: 'ownershipType',
    label: 'Ownership Type',
    type: 'select',
    isRequired: false,
    section: 'Business Details',
    order: 7,
  },
  {
    id: 'ownerName',
    name: 'ownerName',
    label: 'Owner Name',
    type: 'text',
    isRequired: false,
    section: 'Business Details',
    order: 8,
  },
  {
    id: 'businessOwnerName',
    name: 'businessOwnerName',
    label: 'Business Owner Name',
    type: 'text',
    isRequired: false,
    section: 'Business Details',
    order: 9,
  },

  // Working Details
  {
    id: 'workingStatus',
    name: 'workingStatus',
    label: 'Working Status',
    type: 'select',
    isRequired: false,
    section: 'Working Details',
    order: 1,
  },
  {
    id: 'applicantWorkingPremises',
    name: 'applicantWorkingPremises',
    label: 'Applicant Working at Premises',
    type: 'select',
    isRequired: false,
    section: 'Working Details',
    order: 2,
  },
  {
    id: 'applicantWorkingStatus',
    name: 'applicantWorkingStatus',
    label: 'Applicant Working Status',
    type: 'select',
    isRequired: false,
    section: 'Working Details',
    order: 3,
  },
  {
    id: 'staffStrength',
    name: 'staffStrength',
    label: 'Staff Strength',
    type: 'number',
    isRequired: false,
    section: 'Working Details',
    order: 4,
  },
  {
    id: 'staffSeen',
    name: 'staffSeen',
    label: 'Staff Seen',
    type: 'number',
    isRequired: false,
    section: 'Working Details',
    order: 5,
  },

  // Document Verification
  {
    id: 'documentShown',
    name: 'documentShown',
    label: 'Document Shown',
    type: 'select',
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

  // Premises Details
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 1,
  },
  {
    id: 'companyNamePlateStatus',
    name: 'companyNamePlateStatus',
    label: 'Company Name Plate Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 2,
  },
  {
    id: 'nameOnCompanyBoard',
    name: 'nameOnCompanyBoard',
    label: 'Name on Company Board',
    type: 'text',
    isRequired: false,
    section: 'Premises Details',
    order: 3,
  },
  {
    id: 'businessApproxArea',
    name: 'businessApproxArea',
    label: 'Approximate Area',
    type: 'number',
    isRequired: false,
    section: 'Premises Details',
    order: 4,
  },

  // TPC (Third Party Confirmation)
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC 1 - Person Met',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 1,
  },
  {
    id: 'tpcName1',
    name: 'tpcName1',
    label: 'TPC 1 - Name',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 2,
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC 1 - Confirmation',
    type: 'select',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 3,
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC 2 - Person Met',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 4,
  },
  {
    id: 'tpcName2',
    name: 'tpcName2',
    label: 'TPC 2 - Name',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 5,
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC 2 - Confirmation',
    type: 'select',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 6,
  },
  {
    id: 'nameOfTpc1',
    name: 'nameOfTpc1',
    label: 'Name of TPC 1',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 7,
  },
  {
    id: 'nameOfTpc2',
    name: 'nameOfTpc2',
    label: 'Name of TPC 2',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 8,
  },
  {
    id: 'addressFloor',
    name: 'addressFloor',
    label: 'Address Floor',
    type: 'text',
    isRequired: false,
    section: 'Premises Details',
    order: 5,
  },
  {
    id: 'addressStatus',
    name: 'addressStatus',
    label: 'Address Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 6,
  },
  {
    id: 'nameOfMetPerson',
    name: 'nameOfMetPerson',
    label: 'Name of Met Person',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 3,
  },
  {
    id: 'metPersonType',
    name: 'metPersonType',
    label: 'Met Person Type',
    type: 'select',
    isRequired: false,
    section: 'Basic Information',
    order: 4,
  },
  {
    id: 'metPersonConfirmation',
    name: 'metPersonConfirmation',
    label: 'Met Person Confirmation',
    type: 'select',
    isRequired: false,
    section: 'Basic Information',
    order: 5,
  },
  {
    id: 'otherExtraRemark',
    name: 'otherExtraRemark',
    label: 'Other Extra Remarks',
    type: 'textarea',
    isRequired: false,
    section: 'Area Assessment',
    order: 5,
  },
  {
    id: 'holdReason',
    name: 'holdReason',
    label: 'Hold Reason',
    type: 'textarea',
    isRequired: false,
    section: 'Verification Outcome',
    order: 3,
  },
  {
    id: 'recommendationStatus',
    name: 'recommendationStatus',
    label: 'Recommendation Status',
    type: 'select',
    isRequired: false,
    section: 'Verification Outcome',
    order: 4,
  },
];

const BUSINESS_SHIFTED_FIELDS: FormFieldDefinition[] = [
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
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 1,
  },
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Contact Details',
    order: 1,
  },
];

const BUSINESS_NSP_FIELDS: FormFieldDefinition[] = [
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 1,
  },
  {
    id: 'businessActivity',
    name: 'businessActivity',
    label: 'Business Activity',
    type: 'select',
    isRequired: false,
    section: 'Business Details',
    order: 1,
  },
  {
    id: 'roomStatus',
    name: 'roomStatus',
    label: 'Room Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 2,
  },
];

const BUSINESS_ENTRY_RESTRICTED_FIELDS: FormFieldDefinition[] = [
  {
    id: 'entryRestrictionReason',
    name: 'entryRestrictionReason',
    label: 'Entry Restriction Reason',
    type: 'textarea',
    isRequired: false,
    section: 'Access Details',
    order: 1,
  },
  {
    id: 'securityPersonName',
    name: 'securityPersonName',
    label: 'Security Person Name',
    type: 'text',
    isRequired: false,
    section: 'Access Details',
    order: 2,
  },
  {
    id: 'accessDenied',
    name: 'accessDenied',
    label: 'Access Denied',
    type: 'select',
    isRequired: false,
    section: 'Access Details',
    order: 3,
  },
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 1,
  },
];

const BUSINESS_UNTRACEABLE_FIELDS: FormFieldDefinition[] = [
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 1,
  },
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Contact Details',
    order: 1,
  },
  {
    id: 'alternateContact',
    name: 'alternateContact',
    label: 'Alternate Contact',
    type: 'text',
    isRequired: false,
    section: 'Contact Details',
    order: 2,
  },
];

// ============================================================================
// RESIDENCE VERIFICATION FIELD SCHEMAS
// ============================================================================

const RESIDENCE_POSITIVE_FIELDS: FormFieldDefinition[] = [
  // Residence Information
  {
    id: 'houseStatus',
    name: 'houseStatus',
    label: 'House Status',
    type: 'select',
    isRequired: false,
    section: 'Residence Information',
    order: 1,
  },
  {
    id: 'metPersonRelation',
    name: 'metPersonRelation',
    label: 'Met Person Relation',
    type: 'select',
    isRequired: false,
    section: 'Residence Information',
    order: 2,
  },
  {
    id: 'metPersonStatus',
    name: 'metPersonStatus',
    label: 'Met Person Status',
    type: 'select',
    isRequired: false,
    section: 'Residence Information',
    order: 3,
  },
  {
    id: 'totalFamilyMembers',
    name: 'totalFamilyMembers',
    label: 'Total Family Members',
    type: 'number',
    isRequired: false,
    section: 'Residence Information',
    order: 4,
  },
  {
    id: 'totalEarning',
    name: 'totalEarning',
    label: 'Total Earning Members',
    type: 'number',
    isRequired: false,
    section: 'Residence Information',
    order: 5,
  },
  {
    id: 'stayingPeriod',
    name: 'stayingPeriod',
    label: 'Staying Period',
    type: 'text',
    isRequired: false,
    section: 'Residence Information',
    order: 6,
  },
  {
    id: 'stayingStatus',
    name: 'stayingStatus',
    label: 'Staying Status',
    type: 'select',
    isRequired: false,
    section: 'Residence Information',
    order: 7,
  },

  // Working Details
  {
    id: 'workingStatus',
    name: 'workingStatus',
    label: 'Working Status',
    type: 'select',
    isRequired: false,
    section: 'Working Details',
    order: 1,
  },
  {
    id: 'companyName',
    name: 'companyName',
    label: 'Company Name',
    type: 'text',
    isRequired: false,
    section: 'Working Details',
    order: 2,
  },

  // Document Verification
  {
    id: 'documentShownStatus',
    name: 'documentShownStatus',
    label: 'Document Shown',
    type: 'select',
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

  // Premises Details
  {
    id: 'doorColor',
    name: 'doorColor',
    label: 'Door Color',
    type: 'text',
    isRequired: false,
    section: 'Premises Details',
    order: 1,
  },
  {
    id: 'doorNamePlateStatus',
    name: 'doorNamePlateStatus',
    label: 'Door Name Plate Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 2,
  },
  {
    id: 'nameOnDoorPlate',
    name: 'nameOnDoorPlate',
    label: 'Name on Door Plate',
    type: 'text',
    isRequired: false,
    section: 'Premises Details',
    order: 3,
  },
  {
    id: 'societyNamePlateStatus',
    name: 'societyNamePlateStatus',
    label: 'Society Name Plate Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 4,
  },
  {
    id: 'nameOnSocietyBoard',
    name: 'nameOnSocietyBoard',
    label: 'Name on Society Board',
    type: 'text',
    isRequired: false,
    section: 'Premises Details',
    order: 5,
  },
  {
    id: 'addressFloor',
    name: 'addressFloor',
    label: 'Floor Number',
    type: 'text',
    isRequired: false,
    section: 'Premises Details',
    order: 6,
  },

  // TPC (Third Party Confirmation)
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC 1 - Person Met',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 1,
  },
  {
    id: 'tpcName1',
    name: 'tpcName1',
    label: 'TPC 1 - Name',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 2,
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC 1 - Confirmation',
    type: 'select',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 3,
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC 2 - Person Met',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 4,
  },
  {
    id: 'tpcName2',
    name: 'tpcName2',
    label: 'TPC 2 - Name',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 5,
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC 2 - Confirmation',
    type: 'select',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 6,
  },
];

const RESIDENCE_SHIFTED_FIELDS: FormFieldDefinition[] = [
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
    id: 'currentLocation',
    name: 'currentLocation',
    label: 'Current Location',
    type: 'text',
    isRequired: false,
    section: 'Shifting Details',
    order: 2,
  },
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 1,
  },
  {
    id: 'stayingPersonName',
    name: 'stayingPersonName',
    label: 'Current Staying Person Name',
    type: 'text',
    isRequired: false,
    section: 'Shifting Details',
    order: 3,
  },
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Contact Details',
    order: 1,
  },
];

const RESIDENCE_NSP_FIELDS: FormFieldDefinition[] = [
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 1,
  },
  {
    id: 'roomStatus',
    name: 'roomStatus',
    label: 'Room Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 2,
  },
];

const RESIDENCE_ENTRY_RESTRICTED_FIELDS: FormFieldDefinition[] = [
  {
    id: 'entryRestrictionReason',
    name: 'entryRestrictionReason',
    label: 'Entry Restriction Reason',
    type: 'textarea',
    isRequired: false,
    section: 'Access Details',
    order: 1,
  },
  {
    id: 'securityPersonName',
    name: 'securityPersonName',
    label: 'Security Person Name',
    type: 'text',
    isRequired: false,
    section: 'Access Details',
    order: 2,
  },
  {
    id: 'accessDenied',
    name: 'accessDenied',
    label: 'Access Denied',
    type: 'select',
    isRequired: false,
    section: 'Access Details',
    order: 3,
  },
];

const RESIDENCE_UNTRACEABLE_FIELDS: FormFieldDefinition[] = [
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Contact Details',
    order: 1,
  },
  {
    id: 'alternateContact',
    name: 'alternateContact',
    label: 'Alternate Contact',
    type: 'text',
    isRequired: false,
    section: 'Contact Details',
    order: 2,
  },
];

// ============================================================================
// OFFICE VERIFICATION FIELD SCHEMAS
// ============================================================================

const OFFICE_POSITIVE_FIELDS: FormFieldDefinition[] = [
  // Office Information
  {
    id: 'designation',
    name: 'designation',
    label: 'Designation',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 1,
  },
  {
    id: 'applicantDesignation',
    name: 'applicantDesignation',
    label: 'Applicant Designation',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 2,
  },
  {
    id: 'officeStatus',
    name: 'officeStatus',
    label: 'Office Status',
    type: 'select',
    isRequired: false,
    section: 'Office Information',
    order: 3,
  },
  {
    id: 'officeType',
    name: 'officeType',
    label: 'Office Type',
    type: 'select',
    isRequired: false,
    section: 'Office Information',
    order: 4,
  },
  {
    id: 'companyNatureOfBusiness',
    name: 'companyNatureOfBusiness',
    label: 'Nature of Business',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 5,
  },
  {
    id: 'businessPeriod',
    name: 'businessPeriod',
    label: 'Business Period',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 6,
  },
  {
    id: 'establishmentPeriod',
    name: 'establishmentPeriod',
    label: 'Establishment Period',
    type: 'text',
    isRequired: false,
    section: 'Office Information',
    order: 7,
  },

  // Working Details
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
    label: 'Applicant Working at Premises',
    type: 'select',
    isRequired: false,
    section: 'Working Details',
    order: 3,
  },
  {
    id: 'staffStrength',
    name: 'staffStrength',
    label: 'Staff Strength',
    type: 'number',
    isRequired: false,
    section: 'Working Details',
    order: 4,
  },
  {
    id: 'staffSeen',
    name: 'staffSeen',
    label: 'Staff Seen',
    type: 'number',
    isRequired: false,
    section: 'Working Details',
    order: 5,
  },

  // Document Verification
  {
    id: 'documentShown',
    name: 'documentShown',
    label: 'Document Shown',
    type: 'select',
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

  // Premises Details
  {
    id: 'officeApproxArea',
    name: 'officeApproxArea',
    label: 'Office Approximate Area',
    type: 'number',
    isRequired: false,
    section: 'Premises Details',
    order: 1,
  },
  {
    id: 'addressFloor',
    name: 'addressFloor',
    label: 'Floor Number',
    type: 'text',
    isRequired: false,
    section: 'Premises Details',
    order: 2,
  },
  {
    id: 'companyNamePlateStatus',
    name: 'companyNamePlateStatus',
    label: 'Company Name Plate Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 3,
  },
  {
    id: 'nameOnCompanyBoard',
    name: 'nameOnCompanyBoard',
    label: 'Name on Company Board',
    type: 'text',
    isRequired: false,
    section: 'Premises Details',
    order: 4,
  },

  // TPC (Third Party Confirmation)
  {
    id: 'tpcMetPerson1',
    name: 'tpcMetPerson1',
    label: 'TPC 1 - Person Met',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 1,
  },
  {
    id: 'tpcName1',
    name: 'tpcName1',
    label: 'TPC 1 - Name',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 2,
  },
  {
    id: 'tpcConfirmation1',
    name: 'tpcConfirmation1',
    label: 'TPC 1 - Confirmation',
    type: 'select',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 3,
  },
  {
    id: 'tpcMetPerson2',
    name: 'tpcMetPerson2',
    label: 'TPC 2 - Person Met',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 4,
  },
  {
    id: 'tpcName2',
    name: 'tpcName2',
    label: 'TPC 2 - Name',
    type: 'text',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 5,
  },
  {
    id: 'tpcConfirmation2',
    name: 'tpcConfirmation2',
    label: 'TPC 2 - Confirmation',
    type: 'select',
    isRequired: false,
    section: 'Third Party Confirmation',
    order: 6,
  },
];

const OFFICE_SHIFTED_FIELDS: FormFieldDefinition[] = [
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
    id: 'oldOfficeShiftedPeriod',
    name: 'oldOfficeShiftedPeriod',
    label: 'Old Office Shifted Period',
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
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Contact Details',
    order: 1,
  },
];

const OFFICE_NSP_FIELDS: FormFieldDefinition[] = [
  {
    id: 'premisesStatus',
    name: 'premisesStatus',
    label: 'Premises Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 1,
  },
];

const OFFICE_ENTRY_RESTRICTED_FIELDS: FormFieldDefinition[] = [
  {
    id: 'entryRestrictionReason',
    name: 'entryRestrictionReason',
    label: 'Entry Restriction Reason',
    type: 'textarea',
    isRequired: false,
    section: 'Access Details',
    order: 1,
  },
  {
    id: 'securityPersonName',
    name: 'securityPersonName',
    label: 'Security Person Name',
    type: 'text',
    isRequired: false,
    section: 'Access Details',
    order: 2,
  },
];

const OFFICE_UNTRACEABLE_FIELDS: FormFieldDefinition[] = [
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Contact Details',
    order: 1,
  },
];

// ============================================================================
// VERIFICATION TYPE FIELD MAPPING
// ============================================================================

export const VERIFICATION_FORM_TYPE_FIELDS: Record<
  string,
  Record<string, FormFieldDefinition[]>
> = {
  BUSINESS: {
    COMMON: COMMON_FIELDS,
    POSITIVE: BUSINESS_POSITIVE_FIELDS,
    SHIFTED: BUSINESS_SHIFTED_FIELDS,
    NSP: BUSINESS_NSP_FIELDS,
    ENTRY_RESTRICTED: BUSINESS_ENTRY_RESTRICTED_FIELDS,
    UNTRACEABLE: BUSINESS_UNTRACEABLE_FIELDS,
  },
  RESIDENCE: {
    COMMON: COMMON_FIELDS,
    POSITIVE: RESIDENCE_POSITIVE_FIELDS,
    SHIFTED: RESIDENCE_SHIFTED_FIELDS,
    NSP: RESIDENCE_NSP_FIELDS,
    ENTRY_RESTRICTED: RESIDENCE_ENTRY_RESTRICTED_FIELDS,
    UNTRACEABLE: RESIDENCE_UNTRACEABLE_FIELDS,
  },
  OFFICE: {
    COMMON: COMMON_FIELDS,
    POSITIVE: OFFICE_POSITIVE_FIELDS,
    SHIFTED: OFFICE_SHIFTED_FIELDS,
    NSP: OFFICE_NSP_FIELDS,
    ENTRY_RESTRICTED: OFFICE_ENTRY_RESTRICTED_FIELDS,
    UNTRACEABLE: OFFICE_UNTRACEABLE_FIELDS,
  },
  // Residence-cum-Office uses combination of residence and office fields
  RESIDENCE_CUM_OFFICE: {
    COMMON: COMMON_FIELDS,
    POSITIVE: [...RESIDENCE_POSITIVE_FIELDS, ...OFFICE_POSITIVE_FIELDS],
    SHIFTED: [...RESIDENCE_SHIFTED_FIELDS, ...OFFICE_SHIFTED_FIELDS],
    NSP: [...RESIDENCE_NSP_FIELDS, ...OFFICE_NSP_FIELDS],
    ENTRY_RESTRICTED: [...RESIDENCE_ENTRY_RESTRICTED_FIELDS, ...OFFICE_ENTRY_RESTRICTED_FIELDS],
    UNTRACEABLE: [...RESIDENCE_UNTRACEABLE_FIELDS, ...OFFICE_UNTRACEABLE_FIELDS],
  },
  // Builder verification uses office-like fields
  BUILDER: {
    COMMON: COMMON_FIELDS,
    POSITIVE: OFFICE_POSITIVE_FIELDS,
    SHIFTED: OFFICE_SHIFTED_FIELDS,
    NSP: OFFICE_NSP_FIELDS,
    ENTRY_RESTRICTED: OFFICE_ENTRY_RESTRICTED_FIELDS,
    UNTRACEABLE: OFFICE_UNTRACEABLE_FIELDS,
  },
  // NOC verification uses office-like fields
  NOC: {
    COMMON: COMMON_FIELDS,
    POSITIVE: OFFICE_POSITIVE_FIELDS,
    SHIFTED: OFFICE_SHIFTED_FIELDS,
    NSP: OFFICE_NSP_FIELDS,
    ENTRY_RESTRICTED: OFFICE_ENTRY_RESTRICTED_FIELDS,
    UNTRACEABLE: OFFICE_UNTRACEABLE_FIELDS,
  },
  // DSA/Connector verification uses business-like fields
  DSA_CONNECTOR: {
    COMMON: COMMON_FIELDS,
    POSITIVE: BUSINESS_POSITIVE_FIELDS,
    SHIFTED: BUSINESS_SHIFTED_FIELDS,
    NSP: BUSINESS_NSP_FIELDS,
    ENTRY_RESTRICTED: BUSINESS_ENTRY_RESTRICTED_FIELDS,
    UNTRACEABLE: BUSINESS_UNTRACEABLE_FIELDS,
  },
  // Property APF verification uses business-like fields
  PROPERTY_APF: {
    COMMON: COMMON_FIELDS,
    POSITIVE: BUSINESS_POSITIVE_FIELDS,
    SHIFTED: BUSINESS_SHIFTED_FIELDS,
    NSP: BUSINESS_NSP_FIELDS,
    ENTRY_RESTRICTED: BUSINESS_ENTRY_RESTRICTED_FIELDS,
    UNTRACEABLE: BUSINESS_UNTRACEABLE_FIELDS,
  },
  // Property Individual verification uses residence-like fields
  PROPERTY_INDIVIDUAL: {
    COMMON: COMMON_FIELDS,
    POSITIVE: RESIDENCE_POSITIVE_FIELDS,
    SHIFTED: RESIDENCE_SHIFTED_FIELDS,
    NSP: RESIDENCE_NSP_FIELDS,
    ENTRY_RESTRICTED: RESIDENCE_ENTRY_RESTRICTED_FIELDS,
    UNTRACEABLE: RESIDENCE_UNTRACEABLE_FIELDS,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getRelevantFieldsForFormType(
  verificationType: string,
  formType: string
): FormFieldDefinition[] {
  const typeFields = VERIFICATION_FORM_TYPE_FIELDS[verificationType.toUpperCase()];
  if (!typeFields) {
    console.warn(`No field schema found for verification type: ${verificationType}`);
    return [];
  }

  // Get common fields (always shown)
  const commonFields = typeFields.COMMON || [];

  // Get form-type-specific fields
  const specificFields = typeFields[formType.toUpperCase()] || [];

  // Merge and deduplicate by field name
  const allFields = [...commonFields, ...specificFields];
  const uniqueFields = allFields.filter(
    (field, index, self) => index === self.findIndex(f => f.name === field.name)
  );

  return uniqueFields;
}
