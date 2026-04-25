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
  doorStatus: [
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
      showFields: ['nameOnBoard'],
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
      showFields: ['stayingPeriod', 'houseStatus', 'totalFamilyMembers', 'totalEarningMember'],
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

export function evaluateConditionalRule(
  rule: ConditionalRule,
  formData: Record<string, unknown>
): boolean {
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

    case 'contains': {
      // Handle rule.value properly - it could be an array, object, or primitive
      let searchValue: string;
      if (Array.isArray(rule.value)) {
        searchValue = rule.value.join(',');
      } else if (typeof rule.value === 'object' && rule.value !== null) {
        searchValue = JSON.stringify(rule.value);
      } else if (typeof rule.value === 'string') {
        searchValue = rule.value;
      } else if (typeof rule.value === 'number') {
        searchValue = String(rule.value);
      } else if (typeof rule.value === 'boolean') {
        searchValue = String(rule.value);
      } else {
        // null, undefined, or other types
        searchValue = '';
      }

      let parentString: string;
      if (typeof parentValue === 'string') {
        parentString = parentValue;
      } else if (typeof parentValue === 'number') {
        parentString = String(parentValue);
      } else if (typeof parentValue === 'boolean') {
        parentString = String(parentValue);
      } else if (typeof parentValue === 'bigint') {
        parentString = String(parentValue);
      } else if (typeof parentValue === 'symbol') {
        parentString = String(parentValue);
      } else if (parentValue === null || parentValue === undefined) {
        // Treat null/undefined as empty for contains check
        parentString = '';
      } else {
        // Objects, Arrays, Functions
        try {
          parentString = JSON.stringify(parentValue);
        } catch {
          parentString = '';
        }
      }
      return parentString.toLowerCase().includes(searchValue.toLowerCase());
    }

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
  formData: Record<string, unknown>,
  allRules: Record<string, ConditionalRule[]> = CONDITIONAL_FIELD_RULES
): boolean {
  // Check if this field is controlled by any conditional rules
  for (const [, rules] of Object.entries(allRules)) {
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
    id: 'nameOnBoard',
    name: 'nameOnBoard',
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
    label: 'Shifted Since',
    type: 'text',
    isRequired: false,
    section: 'Shifted Details',
    order: 1,
  },
  {
    id: 'currentCompanyName',
    name: 'currentCompanyName',
    label: 'Current Company Name',
    type: 'text',
    isRequired: false,
    section: 'Shifted Details',
    order: 2,
  },
  {
    id: 'currentCompanyPeriod',
    name: 'currentCompanyPeriod',
    label: 'Current Company Period',
    type: 'text',
    isRequired: false,
    section: 'Shifted Details',
    order: 3,
  },
  {
    id: 'oldBusinessShiftedPeriod',
    name: 'oldBusinessShiftedPeriod',
    label: 'Old Business Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifted Details',
    order: 4,
  },
];

const BUSINESS_NSP_FIELDS: FormFieldDefinition[] = [
  ...BUSINESS_POSITIVE_FIELDS.filter(f =>
    ['tpcMetPerson1', 'tpcName1', 'tpcConfirmation1'].includes(f.name)
  ),
  {
    id: 'contactPerson',
    name: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    isRequired: false,
    section: 'Tracking Details',
    order: 1,
  },
];

// ============================================================================
// RESIDENCE VERIFICATION FIELD SCHEMAS
// ============================================================================

const RESIDENCE_POSITIVE_FIELDS: FormFieldDefinition[] = [
  // Residence Specifics
  {
    id: 'houseStatus',
    name: 'houseStatus',
    label: 'House Status',
    type: 'select',
    isRequired: false,
    section: 'Residence Details',
    order: 1,
  },
  {
    id: 'ownershipType',
    name: 'ownershipType',
    label: 'Ownership Type',
    type: 'select',
    isRequired: false,
    section: 'Residence Details',
    order: 2,
  },
  {
    id: 'stayingPeriod',
    name: 'stayingPeriod',
    label: 'Staying Period',
    type: 'text',
    isRequired: false,
    section: 'Residence Details',
    order: 3,
  },
  {
    id: 'totalFamilyMembers',
    name: 'totalFamilyMembers',
    label: 'Total Family Members',
    type: 'number',
    isRequired: false,
    section: 'Family Details',
    order: 1,
  },
  {
    id: 'totalEarningMember',
    name: 'totalEarningMember',
    label: 'Total Earning Members',
    type: 'number',
    isRequired: false,
    section: 'Family Details',
    order: 2,
  },
  {
    id: 'metPersonRelation',
    name: 'metPersonRelation',
    label: 'Relation with Applicant',
    type: 'text',
    isRequired: false,
    section: 'Basic Information',
    order: 4,
  },

  // Common conditional fields...
  {
    id: 'door_status',
    name: 'door_status',
    label: 'Door Status',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 1,
  },
  {
    id: 'doorNamePlateStatus',
    name: 'doorNamePlateStatus',
    label: 'Door Name Plate',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 2,
  },
  {
    id: 'societyNamePlateStatus',
    name: 'societyNamePlateStatus',
    label: 'Society Name Plate',
    type: 'select',
    isRequired: false,
    section: 'Premises Details',
    order: 3,
  },
  {
    id: 'nameOnDoorPlate',
    name: 'nameOnDoorPlate',
    label: 'Name on Door Plate',
    type: 'text',
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
];

const RESIDENCE_SHIFTED_FIELDS: FormFieldDefinition[] = [
  {
    id: 'shiftedPeriod',
    name: 'shiftedPeriod',
    label: 'Shifted Since',
    type: 'text',
    isRequired: false,
    section: 'Shifted Details',
    order: 1,
  },
  {
    id: 'currentLocation',
    name: 'currentLocation',
    label: 'Current Location',
    type: 'text',
    isRequired: false,
    section: 'Shifted Details',
    order: 2,
  },
  {
    id: 'stayingPersonName',
    name: 'stayingPersonName',
    label: 'Default/Staying Person Name',
    type: 'text',
    isRequired: false,
    section: 'Shifted Details',
    order: 3,
  },
];

const RESIDENCE_ENTRY_RESTRICTED_FIELDS: FormFieldDefinition[] = [
  {
    id: 'accessDenied',
    name: 'accessDenied',
    label: 'Access Denied',
    type: 'select',
    isRequired: true,
    section: 'Restricted Entry Details',
    order: 1,
  },
  {
    id: 'entryRestrictionReason',
    name: 'entryRestrictionReason',
    label: 'Restriction Reason',
    type: 'textarea',
    isRequired: true,
    section: 'Restricted Entry Details',
    order: 2,
  },
  {
    id: 'securityPersonName',
    name: 'securityPersonName',
    label: 'Security Person Name',
    type: 'text',
    isRequired: false,
    section: 'Restricted Entry Details',
    order: 3,
  },
];

// ============================================================================
// OFFICE VERIFICATION FIELD SCHEMAS
// ============================================================================

const OFFICE_POSITIVE_FIELDS: FormFieldDefinition[] = [
  // Office Specifics
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
    id: 'designation',
    name: 'designation',
    label: 'Designation',
    type: 'text',
    isRequired: false,
    section: 'Employment Details',
    order: 1,
  },
  {
    id: 'department',
    name: 'department',
    label: 'Department',
    type: 'text',
    isRequired: false,
    section: 'Employment Details',
    order: 2,
  },
  {
    id: 'jobTenure',
    name: 'jobTenure',
    label: 'Job Tenure',
    type: 'text',
    isRequired: false,
    section: 'Employment Details',
    order: 3,
  },
  {
    id: 'applicantDesignation',
    name: 'applicantDesignation',
    label: 'Applicant Designation',
    type: 'text',
    isRequired: false,
    section: 'Employment Details',
    order: 4,
  },
  {
    id: 'officeExistence',
    name: 'officeExistence',
    label: 'Office Existence',
    type: 'select',
    isRequired: false,
    section: 'Office Details',
    order: 3,
  },
];

const OFFICE_SHIFTED_FIELDS: FormFieldDefinition[] = [
  {
    id: 'shiftedPeriod',
    name: 'shiftedPeriod',
    label: 'Shifted Since',
    type: 'text',
    isRequired: false,
    section: 'Shifted Details',
    order: 1,
  },
  {
    id: 'currentCompanyName',
    name: 'currentCompanyName',
    label: 'Current Company Name',
    type: 'text',
    isRequired: false,
    section: 'Shifted Details',
    order: 2,
  },
  {
    id: 'oldOfficeShiftedPeriod',
    name: 'oldOfficeShiftedPeriod',
    label: 'Old Office Shifted Period',
    type: 'text',
    isRequired: false,
    section: 'Shifted Details',
    order: 3,
  },
];

// ============================================================================
// AGGREGATED SCHEMA EXPORT
// ============================================================================

export const TYPE_AWARE_SCHEMAS = {
  BUSINESS: {
    POSITIVE: [...COMMON_FIELDS, ...BUSINESS_POSITIVE_FIELDS],
    NEGATIVE: [...COMMON_FIELDS, ...BUSINESS_POSITIVE_FIELDS], // Often similar structure, just strictly validated
    SHIFTED: [...COMMON_FIELDS, ...BUSINESS_SHIFTED_FIELDS],
    NSP: [...COMMON_FIELDS, ...BUSINESS_NSP_FIELDS],
    ENTRY_RESTRICTED: [...COMMON_FIELDS, ...RESIDENCE_ENTRY_RESTRICTED_FIELDS], // Reuse logic
    UNTRACEABLE: [...COMMON_FIELDS], // Minimal fields
  },
  RESIDENCE: {
    POSITIVE: [...COMMON_FIELDS, ...RESIDENCE_POSITIVE_FIELDS],
    NEGATIVE: [...COMMON_FIELDS, ...RESIDENCE_POSITIVE_FIELDS],
    SHIFTED: [...COMMON_FIELDS, ...RESIDENCE_SHIFTED_FIELDS],
    NSP: [...COMMON_FIELDS], // Residence NSP often just TPC
    ENTRY_RESTRICTED: [...COMMON_FIELDS, ...RESIDENCE_ENTRY_RESTRICTED_FIELDS],
    UNTRACEABLE: [...COMMON_FIELDS],
  },
  OFFICE: {
    POSITIVE: [...COMMON_FIELDS, ...OFFICE_POSITIVE_FIELDS],
    NEGATIVE: [...COMMON_FIELDS, ...OFFICE_POSITIVE_FIELDS],
    SHIFTED: [...COMMON_FIELDS, ...OFFICE_SHIFTED_FIELDS],
    NSP: [...COMMON_FIELDS], // Office NSP
    ENTRY_RESTRICTED: [...COMMON_FIELDS, ...RESIDENCE_ENTRY_RESTRICTED_FIELDS],
    UNTRACEABLE: [...COMMON_FIELDS],
  },
  // Default fallback
  DEFAULT: [...COMMON_FIELDS],
};

// Helper to get schema based on type and outcome
export function getFieldSchema(
  verificationType: string,
  outcome: string = 'POSITIVE'
): FormFieldDefinition[] {
  const upperType = verificationType.toUpperCase();
  const upperOutcome = outcome.toUpperCase();

  // Handle mapped types (e.g., 'Business Verification' -> 'BUSINESS')
  const typeKey = upperType.includes('BUSINESS')
    ? 'BUSINESS'
    : upperType.includes('RESIDENCE')
      ? 'RESIDENCE'
      : upperType.includes('OFFICE')
        ? 'OFFICE'
        : 'DEFAULT';

  // Handle mapped outcomes
  let outcomeKey = 'POSITIVE';
  if (upperOutcome.includes('SHIFTED')) {
    outcomeKey = 'SHIFTED';
  }
  if (upperOutcome.includes('NSP') || upperOutcome.includes('PERSON NOT MET')) {
    outcomeKey = 'NSP';
  }
  if (upperOutcome.includes('RESTRICTED') || upperOutcome.includes('DENIED')) {
    outcomeKey = 'ENTRY_RESTRICTED';
  }
  if (upperOutcome.includes('UNTRACEABLE') || upperOutcome.includes('NOT FOUND')) {
    outcomeKey = 'UNTRACEABLE';
  }
  if (upperOutcome.includes('NEGATIVE')) {
    outcomeKey = 'NEGATIVE';
  }

  const schemas = TYPE_AWARE_SCHEMAS as unknown as Record<
    string,
    Record<string, FormFieldDefinition[]>
  >;
  const schema = schemas[typeKey]?.[outcomeKey] || TYPE_AWARE_SCHEMAS.DEFAULT;

  return schema;
}

// Alias for compatibility with comprehensiveFormFieldMapping
export function getRelevantFieldsForFormType(
  verificationType: string,
  formType: string = 'POSITIVE'
): FormFieldDefinition[] {
  return getFieldSchema(verificationType, formType);
}
