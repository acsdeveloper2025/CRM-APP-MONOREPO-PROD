/**
 * Comprehensive Form Field Mapping for All Verification Types
 * 
 * This module provides complete form field definitions and mapping for all verification types
 * to ensure comprehensive display of form data in the frontend.
 */

import { FormSection, FormField } from '../types/mobile';

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
  { id: 'customerName', name: 'customerName', label: 'Customer Name', type: 'text', isRequired: true, section: 'Basic Information', order: 1 },
  { id: 'outcome', name: 'outcome', label: 'Verification Outcome', type: 'select', isRequired: true, section: 'Basic Information', order: 2 },
  { id: 'metPersonName', name: 'metPersonName', label: 'Met Person Name', type: 'text', isRequired: false, section: 'Basic Information', order: 3 },
  { id: 'callRemark', name: 'callRemark', label: 'Call Remark', type: 'select', isRequired: false, section: 'Basic Information', order: 4 },
  
  // Address & Location Section
  { id: 'addressLocatable', name: 'addressLocatable', label: 'Address Locatable', type: 'select', isRequired: true, section: 'Location Details', order: 1, formTypes: ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED'] },
  { id: 'addressRating', name: 'addressRating', label: 'Address Rating', type: 'select', isRequired: true, section: 'Location Details', order: 2, formTypes: ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED'] },
  { id: 'locality', name: 'locality', label: 'Locality Type', type: 'select', isRequired: false, section: 'Location Details', order: 3 },
  { id: 'addressStructure', name: 'addressStructure', label: 'Address Structure', type: 'select', isRequired: false, section: 'Location Details', order: 4 },
  { id: 'landmark1', name: 'landmark1', label: 'Landmark 1', type: 'text', isRequired: false, section: 'Location Details', order: 5 },
  { id: 'landmark2', name: 'landmark2', label: 'Landmark 2', type: 'text', isRequired: false, section: 'Location Details', order: 6 },
  { id: 'landmark3', name: 'landmark3', label: 'Landmark 3', type: 'text', isRequired: false, section: 'Location Details', order: 7 },
  { id: 'landmark4', name: 'landmark4', label: 'Landmark 4', type: 'text', isRequired: false, section: 'Location Details', order: 8 },
  
  // Personal & Family Details
  { id: 'metPersonRelation', name: 'metPersonRelation', label: 'Met Person Relation', type: 'select', isRequired: false, section: 'Personal Details', order: 1, formTypes: ['POSITIVE'] },
  { id: 'metPersonStatus', name: 'metPersonStatus', label: 'Met Person Status', type: 'select', isRequired: false, section: 'Personal Details', order: 2, formTypes: ['POSITIVE', 'NSP', 'SHIFTED', 'ENTRY_RESTRICTED'] },
  { id: 'totalFamilyMembers', name: 'totalFamilyMembers', label: 'Total Family Members', type: 'number', isRequired: false, section: 'Personal Details', order: 3, formTypes: ['POSITIVE'] },
  { id: 'totalEarning', name: 'totalEarning', label: 'Total Earning Members', type: 'number', isRequired: false, section: 'Personal Details', order: 4, formTypes: ['POSITIVE'] },
  { id: 'workingStatus', name: 'workingStatus', label: 'Working Status', type: 'select', isRequired: false, section: 'Personal Details', order: 5, formTypes: ['POSITIVE'] },
  { id: 'companyName', name: 'companyName', label: 'Company Name', type: 'text', isRequired: false, section: 'Personal Details', order: 6, formTypes: ['POSITIVE'] },
  { id: 'stayingPeriod', name: 'stayingPeriod', label: 'Staying Period', type: 'text', isRequired: false, section: 'Personal Details', order: 7, formTypes: ['POSITIVE', 'NSP'] },
  { id: 'stayingStatus', name: 'stayingStatus', label: 'Staying Status', type: 'select', isRequired: false, section: 'Personal Details', order: 8, formTypes: ['POSITIVE'] },
  
  // Document Verification (POSITIVE specific)
  { id: 'documentShownStatus', name: 'documentShownStatus', label: 'Document Shown Status', type: 'select', isRequired: false, section: 'Document Verification', order: 1, formTypes: ['POSITIVE'] },
  { id: 'documentType', name: 'documentType', label: 'Document Type', type: 'select', isRequired: false, section: 'Document Verification', order: 2, formTypes: ['POSITIVE'] },
  
  // House & Property Details
  { id: 'houseStatus', name: 'houseStatus', label: 'House Status', type: 'select', isRequired: false, section: 'Property Details', order: 1, formTypes: ['POSITIVE', 'NSP'] },
  { id: 'roomStatus', name: 'roomStatus', label: 'Room Status', type: 'select', isRequired: false, section: 'Property Details', order: 2, formTypes: ['NSP', 'SHIFTED'] },
  { id: 'doorColor', name: 'doorColor', label: 'Door Color', type: 'text', isRequired: false, section: 'Property Details', order: 3, formTypes: ['POSITIVE', 'NSP'] },
  { id: 'doorNamePlateStatus', name: 'doorNamePlateStatus', label: 'Door Name Plate Status', type: 'select', isRequired: false, section: 'Property Details', order: 4, formTypes: ['POSITIVE', 'NSP'] },
  { id: 'nameOnDoorPlate', name: 'nameOnDoorPlate', label: 'Name on Door Plate', type: 'text', isRequired: false, section: 'Property Details', order: 5, formTypes: ['POSITIVE', 'NSP'] },
  { id: 'societyNamePlateStatus', name: 'societyNamePlateStatus', label: 'Society Name Plate Status', type: 'select', isRequired: false, section: 'Property Details', order: 6, formTypes: ['POSITIVE', 'NSP'] },
  { id: 'nameOnSocietyBoard', name: 'nameOnSocietyBoard', label: 'Name on Society Board', type: 'text', isRequired: false, section: 'Property Details', order: 7, formTypes: ['POSITIVE', 'NSP'] },
  { id: 'addressStructureColor', name: 'addressStructureColor', label: 'Address Structure Color', type: 'text', isRequired: false, section: 'Property Details', order: 8, formTypes: ['POSITIVE', 'NSP'] },
  { id: 'addressFloor', name: 'addressFloor', label: 'Address Floor', type: 'text', isRequired: false, section: 'Property Details', order: 9, formTypes: ['POSITIVE', 'NSP'] },
  
  // Shifting Details (SHIFTED specific)
  { id: 'shiftedPeriod', name: 'shiftedPeriod', label: 'Shifted Period', type: 'text', isRequired: false, section: 'Shifting Details', order: 1, formTypes: ['SHIFTED'] },
  { id: 'premisesStatus', name: 'premisesStatus', label: 'Premises Status', type: 'select', isRequired: false, section: 'Shifting Details', order: 2, formTypes: ['SHIFTED'] },
  { id: 'roomStatus', name: 'roomStatus', label: 'Room Status', type: 'select', isRequired: false, section: 'Shifting Details', order: 3, formTypes: ['SHIFTED'] },
  { id: 'houseStatus', name: 'houseStatus', label: 'House Status', type: 'select', isRequired: false, section: 'Shifting Details', order: 4, formTypes: ['SHIFTED'] },
  { id: 'doorColor', name: 'doorColor', label: 'Door Color', type: 'text', isRequired: false, section: 'Shifting Details', order: 5, formTypes: ['SHIFTED'] },
  
  // NSP Details (NSP specific)
  { id: 'stayingPersonName', name: 'stayingPersonName', label: 'Staying Person Name', type: 'text', isRequired: false, section: 'NSP Details', order: 1, formTypes: ['NSP'] },
  { id: 'shiftedPeriod', name: 'shiftedPeriod', label: 'Shifted Period', type: 'text', isRequired: false, section: 'NSP Details', order: 2, formTypes: ['NSP'] },
  
  // Entry Restriction Details (ENTRY_RESTRICTED specific)
  { id: 'entryRestrictionReason', name: 'entryRestrictionReason', label: 'Entry Restriction Reason', type: 'text', isRequired: false, section: 'Entry Restriction Details', order: 1, formTypes: ['ENTRY_RESTRICTED'] },
  { id: 'securityPersonName', name: 'securityPersonName', label: 'Security Person Name', type: 'text', isRequired: false, section: 'Entry Restriction Details', order: 2, formTypes: ['ENTRY_RESTRICTED'] },
  { id: 'accessDenied', name: 'accessDenied', label: 'Access Denied', type: 'boolean', isRequired: false, section: 'Entry Restriction Details', order: 3, formTypes: ['ENTRY_RESTRICTED'] },
  { id: 'nameOfMetPerson', name: 'nameOfMetPerson', label: 'Name of Met Person', type: 'text', isRequired: false, section: 'Entry Restriction Details', order: 4, formTypes: ['ENTRY_RESTRICTED'] },
  { id: 'metPersonType', name: 'metPersonType', label: 'Met Person Type', type: 'select', isRequired: false, section: 'Entry Restriction Details', order: 5, formTypes: ['ENTRY_RESTRICTED'] },
  { id: 'applicantStayingStatus', name: 'applicantStayingStatus', label: 'Applicant Staying Status', type: 'select', isRequired: false, section: 'Entry Restriction Details', order: 6, formTypes: ['ENTRY_RESTRICTED'] },
  
  // Contact & Inquiry Details (UNTRACEABLE specific)
  { id: 'contactPerson', name: 'contactPerson', label: 'Contact Person', type: 'text', isRequired: false, section: 'Contact Details', order: 1, formTypes: ['UNTRACEABLE'] },
  { id: 'alternateContact', name: 'alternateContact', label: 'Alternate Contact', type: 'text', isRequired: false, section: 'Contact Details', order: 2, formTypes: ['UNTRACEABLE'] },

  // Third Party Confirmation (TPC) Section
  { id: 'tpcMetPerson1', name: 'tpcMetPerson1', label: 'TPC Met Person 1', type: 'select', isRequired: false, section: 'Third Party Confirmation', order: 1, formTypes: ['POSITIVE', 'NSP', 'SHIFTED'] },
  { id: 'tpcName1', name: 'tpcName1', label: 'TPC Name 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 2, formTypes: ['POSITIVE', 'NSP', 'SHIFTED'] },
  { id: 'tpcConfirmation1', name: 'tpcConfirmation1', label: 'TPC Confirmation 1', type: 'select', isRequired: false, section: 'Third Party Confirmation', order: 3, formTypes: ['POSITIVE', 'NSP', 'SHIFTED'] },
  { id: 'tpcMetPerson2', name: 'tpcMetPerson2', label: 'TPC Met Person 2', type: 'select', isRequired: false, section: 'Third Party Confirmation', order: 4, formTypes: ['POSITIVE', 'NSP', 'SHIFTED'] },
  { id: 'tpcName2', name: 'tpcName2', label: 'TPC Name 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 5, formTypes: ['POSITIVE', 'NSP', 'SHIFTED'] },
  { id: 'tpcConfirmation2', name: 'tpcConfirmation2', label: 'TPC Confirmation 2', type: 'select', isRequired: false, section: 'Third Party Confirmation', order: 6, formTypes: ['POSITIVE', 'NSP', 'SHIFTED'] },

  // Area Assessment Section (Common to all)
  { id: 'politicalConnection', name: 'politicalConnection', label: 'Political Connection', type: 'select', isRequired: false, section: 'Area Assessment', order: 1 },
  { id: 'dominatedArea', name: 'dominatedArea', label: 'Dominated Area', type: 'select', isRequired: false, section: 'Area Assessment', order: 2 },
  { id: 'feedbackFromNeighbour', name: 'feedbackFromNeighbour', label: 'Feedback From Neighbour', type: 'select', isRequired: false, section: 'Area Assessment', order: 3 },
  { id: 'otherObservation', name: 'otherObservation', label: 'Other Observations', type: 'textarea', isRequired: false, section: 'Area Assessment', order: 4 },
  { id: 'finalStatus', name: 'finalStatus', label: 'Final Status', type: 'select', isRequired: true, section: 'Area Assessment', order: 5 },
];

// Comprehensive field definitions for OFFICE verification
export const OFFICE_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information Section
  { id: 'customerName', name: 'customerName', label: 'Customer Name', type: 'text', isRequired: true, section: 'Basic Information', order: 1 },
  { id: 'outcome', name: 'outcome', label: 'Verification Outcome', type: 'select', isRequired: true, section: 'Basic Information', order: 2 },
  { id: 'metPersonName', name: 'metPersonName', label: 'Met Person Name', type: 'text', isRequired: false, section: 'Basic Information', order: 3 },
  { id: 'designation', name: 'designation', label: 'Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 4 },
  { id: 'applicantDesignation', name: 'applicantDesignation', label: 'Applicant Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 5 },

  // Office Details Section
  { id: 'officeStatus', name: 'officeStatus', label: 'Office Status', type: 'select', isRequired: false, section: 'Office Details', order: 1 },
  { id: 'officeType', name: 'officeType', label: 'Office Type', type: 'select', isRequired: false, section: 'Office Details', order: 2 },
  { id: 'companyNatureOfBusiness', name: 'companyNatureOfBusiness', label: 'Company Nature of Business', type: 'text', isRequired: false, section: 'Office Details', order: 3 },
  { id: 'businessPeriod', name: 'businessPeriod', label: 'Business Period', type: 'text', isRequired: false, section: 'Office Details', order: 4 },
  { id: 'establishmentPeriod', name: 'establishmentPeriod', label: 'Establishment Period', type: 'text', isRequired: false, section: 'Office Details', order: 5 },
  { id: 'staffStrength', name: 'staffStrength', label: 'Staff Strength', type: 'number', isRequired: false, section: 'Office Details', order: 6 },
  { id: 'staffSeen', name: 'staffSeen', label: 'Staff Seen', type: 'number', isRequired: false, section: 'Office Details', order: 7 },
  { id: 'workingPeriod', name: 'workingPeriod', label: 'Working Period', type: 'text', isRequired: false, section: 'Office Details', order: 8 },
  { id: 'workingStatus', name: 'workingStatus', label: 'Working Status', type: 'select', isRequired: false, section: 'Office Details', order: 9 },
  { id: 'officeApproxArea', name: 'officeApproxArea', label: 'Office Approximate Area', type: 'number', isRequired: false, section: 'Office Details', order: 10 },

  // Document Verification Section
  { id: 'documentShown', name: 'documentShown', label: 'Document Shown', type: 'text', isRequired: false, section: 'Document Verification', order: 1 },
  { id: 'documentType', name: 'documentType', label: 'Document Type', type: 'text', isRequired: false, section: 'Document Verification', order: 2 },

  // Address & Location Section
  { id: 'addressLocatable', name: 'addressLocatable', label: 'Address Locatable', type: 'select', isRequired: true, section: 'Location Details', order: 1 },
  { id: 'addressRating', name: 'addressRating', label: 'Address Rating', type: 'select', isRequired: true, section: 'Location Details', order: 2 },
  { id: 'locality', name: 'locality', label: 'Locality Type', type: 'select', isRequired: false, section: 'Location Details', order: 3 },
  { id: 'addressStructure', name: 'addressStructure', label: 'Address Structure', type: 'select', isRequired: false, section: 'Location Details', order: 4 },
  { id: 'addressFloor', name: 'addressFloor', label: 'Address Floor', type: 'text', isRequired: false, section: 'Location Details', order: 5 },
  { id: 'companyNamePlateStatus', name: 'companyNamePlateStatus', label: 'Company Name Plate Status', type: 'select', isRequired: false, section: 'Location Details', order: 6 },
  { id: 'nameOnCompanyBoard', name: 'nameOnCompanyBoard', label: 'Name on Company Board', type: 'text', isRequired: false, section: 'Location Details', order: 7 },
  { id: 'landmark1', name: 'landmark1', label: 'Landmark 1', type: 'text', isRequired: false, section: 'Location Details', order: 8 },
  { id: 'landmark2', name: 'landmark2', label: 'Landmark 2', type: 'text', isRequired: false, section: 'Location Details', order: 9 },
  { id: 'landmark3', name: 'landmark3', label: 'Landmark 3', type: 'text', isRequired: false, section: 'Location Details', order: 10 },
  { id: 'landmark4', name: 'landmark4', label: 'Landmark 4', type: 'text', isRequired: false, section: 'Location Details', order: 11 },

  // TPC Details Section
  { id: 'tpcMetPerson1', name: 'tpcMetPerson1', label: 'TPC Met Person 1', type: 'select', isRequired: false, section: 'TPC Details', order: 1 },
  { id: 'tpcName1', name: 'tpcName1', label: 'TPC Name 1', type: 'text', isRequired: false, section: 'TPC Details', order: 2 },
  { id: 'tpcConfirmation1', name: 'tpcConfirmation1', label: 'TPC Confirmation 1', type: 'select', isRequired: false, section: 'TPC Details', order: 3 },
  { id: 'tpcMetPerson2', name: 'tpcMetPerson2', label: 'TPC Met Person 2', type: 'select', isRequired: false, section: 'TPC Details', order: 4 },
  { id: 'tpcName2', name: 'tpcName2', label: 'TPC Name 2', type: 'text', isRequired: false, section: 'TPC Details', order: 5 },
  { id: 'tpcConfirmation2', name: 'tpcConfirmation2', label: 'TPC Confirmation 2', type: 'select', isRequired: false, section: 'TPC Details', order: 6 },

  // Area Assessment Section
  { id: 'politicalConnection', name: 'politicalConnection', label: 'Political Connection', type: 'select', isRequired: false, section: 'Area Assessment', order: 1 },
  { id: 'dominatedArea', name: 'dominatedArea', label: 'Dominated Area', type: 'select', isRequired: false, section: 'Area Assessment', order: 2 },
  { id: 'feedbackFromNeighbour', name: 'feedbackFromNeighbour', label: 'Feedback From Neighbour', type: 'select', isRequired: false, section: 'Area Assessment', order: 3 },
  { id: 'otherObservation', name: 'otherObservation', label: 'Other Observations', type: 'textarea', isRequired: false, section: 'Area Assessment', order: 4 },
  { id: 'finalStatus', name: 'finalStatus', label: 'Final Status', type: 'select', isRequired: true, section: 'Area Assessment', order: 5 },
];

// Comprehensive field definitions for BUSINESS verification
export const BUSINESS_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information Section
  { id: 'customerName', name: 'customerName', label: 'Customer Name', type: 'text', isRequired: true, section: 'Basic Information', order: 1 },
  { id: 'outcome', name: 'outcome', label: 'Verification Outcome', type: 'select', isRequired: true, section: 'Basic Information', order: 2 },
  { id: 'metPersonName', name: 'metPersonName', label: 'Met Person Name', type: 'text', isRequired: false, section: 'Basic Information', order: 3 },
  { id: 'designation', name: 'designation', label: 'Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 4 },
  { id: 'applicantDesignation', name: 'applicantDesignation', label: 'Applicant Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 5 },

  // Business Details Section
  { id: 'businessStatus', name: 'businessStatus', label: 'Business Status', type: 'select', isRequired: false, section: 'Business Details', order: 1 },
  { id: 'businessType', name: 'businessType', label: 'Business Type', type: 'select', isRequired: false, section: 'Business Details', order: 2 },
  { id: 'companyNatureOfBusiness', name: 'companyNatureOfBusiness', label: 'Nature of Business', type: 'text', isRequired: false, section: 'Business Details', order: 3 },
  { id: 'businessPeriod', name: 'businessPeriod', label: 'Business Period', type: 'text', isRequired: false, section: 'Business Details', order: 4 },
  { id: 'establishmentPeriod', name: 'establishmentPeriod', label: 'Establishment Period', type: 'text', isRequired: false, section: 'Business Details', order: 5 },
  { id: 'businessExistence', name: 'businessExistence', label: 'Business Existence', type: 'select', isRequired: false, section: 'Business Details', order: 6 },
  { id: 'businessActivity', name: 'businessActivity', label: 'Business Activity', type: 'text', isRequired: false, section: 'Business Details', order: 7 },
  { id: 'businessSetup', name: 'businessSetup', label: 'Business Setup', type: 'text', isRequired: false, section: 'Business Details', order: 8 },
  { id: 'businessApproxArea', name: 'businessApproxArea', label: 'Business Approximate Area', type: 'number', isRequired: false, section: 'Business Details', order: 9 },
  { id: 'staffStrength', name: 'staffStrength', label: 'Staff Strength', type: 'number', isRequired: false, section: 'Business Details', order: 10 },
  { id: 'staffSeen', name: 'staffSeen', label: 'Staff Seen', type: 'number', isRequired: false, section: 'Business Details', order: 11 },
  { id: 'ownershipType', name: 'ownershipType', label: 'Ownership Type', type: 'select', isRequired: false, section: 'Business Details', order: 12 },
  { id: 'ownerName', name: 'ownerName', label: 'Owner Name', type: 'text', isRequired: false, section: 'Business Details', order: 13 },
  { id: 'businessOwnerName', name: 'businessOwnerName', label: 'Business Owner Name', type: 'text', isRequired: false, section: 'Business Details', order: 14 },
  { id: 'nameOfCompanyOwners', name: 'nameOfCompanyOwners', label: 'Name of Company Owners', type: 'text', isRequired: false, section: 'Business Details', order: 15 },

  // Working Details Section
  { id: 'workingPeriod', name: 'workingPeriod', label: 'Working Period', type: 'text', isRequired: false, section: 'Working Details', order: 1 },
  { id: 'workingStatus', name: 'workingStatus', label: 'Working Status', type: 'select', isRequired: false, section: 'Working Details', order: 2 },
  { id: 'applicantWorkingPremises', name: 'applicantWorkingPremises', label: 'Applicant Working Premises', type: 'text', isRequired: false, section: 'Working Details', order: 3 },
  { id: 'applicantWorkingStatus', name: 'applicantWorkingStatus', label: 'Applicant Working Status', type: 'select', isRequired: false, section: 'Working Details', order: 4 },

  // Document Verification Section
  { id: 'documentShown', name: 'documentShown', label: 'Document Shown', type: 'text', isRequired: false, section: 'Document Verification', order: 1 },
  { id: 'documentType', name: 'documentType', label: 'Document Type', type: 'text', isRequired: false, section: 'Document Verification', order: 2 },

  // Location Details Section
  { id: 'addressLocatable', name: 'addressLocatable', label: 'Address Locatable', type: 'select', isRequired: true, section: 'Location Details', order: 1 },
  { id: 'addressRating', name: 'addressRating', label: 'Address Rating', type: 'select', isRequired: true, section: 'Location Details', order: 2 },
  { id: 'locality', name: 'locality', label: 'Locality Type', type: 'select', isRequired: false, section: 'Location Details', order: 3 },
  { id: 'addressStructure', name: 'addressStructure', label: 'Address Structure', type: 'select', isRequired: false, section: 'Location Details', order: 4 },
  { id: 'addressFloor', name: 'addressFloor', label: 'Address Floor', type: 'text', isRequired: false, section: 'Location Details', order: 5 },
  { id: 'addressStatus', name: 'addressStatus', label: 'Address Status', type: 'select', isRequired: false, section: 'Location Details', order: 6 },
  { id: 'premisesStatus', name: 'premisesStatus', label: 'Premises Status', type: 'select', isRequired: false, section: 'Location Details', order: 7 },
  { id: 'companyNamePlateStatus', name: 'companyNamePlateStatus', label: 'Company Name Plate Status', type: 'select', isRequired: false, section: 'Location Details', order: 8 },
  { id: 'nameOnCompanyBoard', name: 'nameOnCompanyBoard', label: 'Name on Company Board', type: 'text', isRequired: false, section: 'Location Details', order: 9 },
  { id: 'landmark1', name: 'landmark1', label: 'Landmark 1', type: 'text', isRequired: false, section: 'Location Details', order: 10 },
  { id: 'landmark2', name: 'landmark2', label: 'Landmark 2', type: 'text', isRequired: false, section: 'Location Details', order: 11 },

  // TPC Details Section
  { id: 'tpcMetPerson1', name: 'tpcMetPerson1', label: 'TPC Met Person 1', type: 'select', isRequired: false, section: 'TPC Details', order: 1 },
  { id: 'tpcName1', name: 'tpcName1', label: 'TPC Name 1', type: 'text', isRequired: false, section: 'TPC Details', order: 2 },
  { id: 'tpcConfirmation1', name: 'tpcConfirmation1', label: 'TPC Confirmation 1', type: 'select', isRequired: false, section: 'TPC Details', order: 3 },
  { id: 'tpcMetPerson2', name: 'tpcMetPerson2', label: 'TPC Met Person 2', type: 'select', isRequired: false, section: 'TPC Details', order: 4 },
  { id: 'tpcName2', name: 'tpcName2', label: 'TPC Name 2', type: 'text', isRequired: false, section: 'TPC Details', order: 5 },
  { id: 'tpcConfirmation2', name: 'tpcConfirmation2', label: 'TPC Confirmation 2', type: 'select', isRequired: false, section: 'TPC Details', order: 6 },
  { id: 'nameOfTpc1', name: 'nameOfTpc1', label: 'Name of TPC 1', type: 'text', isRequired: false, section: 'TPC Details', order: 7 },
  { id: 'nameOfTpc2', name: 'nameOfTpc2', label: 'Name of TPC 2', type: 'text', isRequired: false, section: 'TPC Details', order: 8 },

  // Shifting Details Section (for shifted cases)
  { id: 'shiftedPeriod', name: 'shiftedPeriod', label: 'Shifted Period', type: 'text', isRequired: false, section: 'Shifting Details', order: 1 },
  { id: 'oldBusinessShiftedPeriod', name: 'oldBusinessShiftedPeriod', label: 'Old Business Shifted Period', type: 'text', isRequired: false, section: 'Shifting Details', order: 2 },
  { id: 'currentCompanyName', name: 'currentCompanyName', label: 'Current Company Name', type: 'text', isRequired: false, section: 'Shifting Details', order: 3 },
  { id: 'currentCompanyPeriod', name: 'currentCompanyPeriod', label: 'Current Company Period', type: 'text', isRequired: false, section: 'Shifting Details', order: 4 },

  // Contact & Communication Section
  { id: 'contactPerson', name: 'contactPerson', label: 'Contact Person', type: 'text', isRequired: false, section: 'Contact & Communication', order: 1 },
  { id: 'callRemark', name: 'callRemark', label: 'Call Remark', type: 'text', isRequired: false, section: 'Contact & Communication', order: 2 },
  { id: 'nameOfMetPerson', name: 'nameOfMetPerson', label: 'Name of Met Person', type: 'text', isRequired: false, section: 'Contact & Communication', order: 3 },
  { id: 'metPersonType', name: 'metPersonType', label: 'Met Person Type', type: 'select', isRequired: false, section: 'Contact & Communication', order: 4 },
  { id: 'metPersonConfirmation', name: 'metPersonConfirmation', label: 'Met Person Confirmation', type: 'select', isRequired: false, section: 'Contact & Communication', order: 5 },

  // Area Assessment Section
  { id: 'politicalConnection', name: 'politicalConnection', label: 'Political Connection', type: 'select', isRequired: false, section: 'Area Assessment', order: 1 },
  { id: 'dominatedArea', name: 'dominatedArea', label: 'Dominated Area', type: 'select', isRequired: false, section: 'Area Assessment', order: 2 },
  { id: 'feedbackFromNeighbour', name: 'feedbackFromNeighbour', label: 'Feedback From Neighbour', type: 'select', isRequired: false, section: 'Area Assessment', order: 3 },
  { id: 'otherObservation', name: 'otherObservation', label: 'Other Observations', type: 'textarea', isRequired: false, section: 'Area Assessment', order: 4 },
  { id: 'otherExtraRemark', name: 'otherExtraRemark', label: 'Other Extra Remarks', type: 'textarea', isRequired: false, section: 'Area Assessment', order: 5 },
  { id: 'finalStatus', name: 'finalStatus', label: 'Final Status', type: 'select', isRequired: true, section: 'Area Assessment', order: 6 },
  { id: 'holdReason', name: 'holdReason', label: 'Hold Reason', type: 'textarea', isRequired: false, section: 'Area Assessment', order: 7 },
  { id: 'recommendationStatus', name: 'recommendationStatus', label: 'Recommendation Status', type: 'select', isRequired: false, section: 'Area Assessment', order: 8 },
];

// Property APF form field definitions (based on actual database fields)
const PROPERTY_APF_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  { id: 'outcome', name: 'outcome', label: 'Verification Outcome', type: 'select', isRequired: true, section: 'Basic Information', order: 1 },
  { id: 'customerName', name: 'customerName', label: 'Customer Name', type: 'text', isRequired: false, section: 'Basic Information', order: 2 },
  { id: 'metPersonName', name: 'metPersonName', label: 'Met Person Name', type: 'text', isRequired: false, section: 'Basic Information', order: 3 },
  { id: 'metPersonDesignation', name: 'metPersonDesignation', label: 'Met Person Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 4 },
  { id: 'metPersonRelation', name: 'metPersonRelation', label: 'Met Person Relation', type: 'text', isRequired: false, section: 'Basic Information', order: 5 },
  { id: 'metPersonContact', name: 'metPersonContact', label: 'Met Person Contact', type: 'text', isRequired: false, section: 'Basic Information', order: 6 },

  // Address Information
  { id: 'fullAddress', name: 'fullAddress', label: 'Full Address', type: 'textarea', isRequired: false, section: 'Address Information', order: 1 },
  { id: 'locality', name: 'locality', label: 'Locality', type: 'text', isRequired: false, section: 'Address Information', order: 2 },
  { id: 'addressLocatable', name: 'addressLocatable', label: 'Address Locatable', type: 'select', isRequired: false, section: 'Address Information', order: 3 },
  { id: 'addressRating', name: 'addressRating', label: 'Address Rating', type: 'select', isRequired: false, section: 'Address Information', order: 4 },
  { id: 'addressStructure', name: 'addressStructure', label: 'Address Structure', type: 'text', isRequired: false, section: 'Address Information', order: 5 },
  { id: 'addressStructureColor', name: 'addressStructureColor', label: 'Address Structure Color', type: 'text', isRequired: false, section: 'Address Information', order: 6 },
  { id: 'addressFloor', name: 'addressFloor', label: 'Address Floor', type: 'text', isRequired: false, section: 'Address Information', order: 7 },
  { id: 'doorColor', name: 'doorColor', label: 'Door Color', type: 'text', isRequired: false, section: 'Address Information', order: 8 },
  { id: 'landmark1', name: 'landmark1', label: 'Landmark 1', type: 'text', isRequired: false, section: 'Address Information', order: 9 },
  { id: 'landmark2', name: 'landmark2', label: 'Landmark 2', type: 'text', isRequired: false, section: 'Address Information', order: 10 },
  { id: 'landmark3', name: 'landmark3', label: 'Landmark 3', type: 'text', isRequired: false, section: 'Address Information', order: 11 },
  { id: 'landmark4', name: 'landmark4', label: 'Landmark 4', type: 'text', isRequired: false, section: 'Address Information', order: 12 },

  // Property Details
  { id: 'propertyType', name: 'propertyType', label: 'Property Type', type: 'text', isRequired: false, section: 'Property Details', order: 1 },
  { id: 'propertyStatus', name: 'propertyStatus', label: 'Property Status', type: 'text', isRequired: false, section: 'Property Details', order: 2 },
  { id: 'propertyOwnership', name: 'propertyOwnership', label: 'Property Ownership', type: 'text', isRequired: false, section: 'Property Details', order: 3 },
  { id: 'propertyAge', name: 'propertyAge', label: 'Property Age', type: 'number', isRequired: false, section: 'Property Details', order: 4 },
  { id: 'propertyCondition', name: 'propertyCondition', label: 'Property Condition', type: 'text', isRequired: false, section: 'Property Details', order: 5 },
  { id: 'propertyArea', name: 'propertyArea', label: 'Property Area', type: 'number', isRequired: false, section: 'Property Details', order: 6 },
  { id: 'propertyValue', name: 'propertyValue', label: 'Property Value', type: 'number', isRequired: false, section: 'Property Details', order: 7 },
  { id: 'marketValue', name: 'marketValue', label: 'Market Value', type: 'number', isRequired: false, section: 'Property Details', order: 8 },
  { id: 'buildingStatus', name: 'buildingStatus', label: 'Building Status', type: 'text', isRequired: false, section: 'Property Details', order: 9 },
  { id: 'constructionActivity', name: 'constructionActivity', label: 'Construction Activity', type: 'text', isRequired: false, section: 'Property Details', order: 10 },

  // APF Details
  { id: 'apfStatus', name: 'apfStatus', label: 'APF Status', type: 'text', isRequired: false, section: 'APF Details', order: 1 },
  { id: 'apfNumber', name: 'apfNumber', label: 'APF Number', type: 'text', isRequired: false, section: 'APF Details', order: 2 },
  { id: 'apfIssueDate', name: 'apfIssueDate', label: 'APF Issue Date', type: 'date', isRequired: false, section: 'APF Details', order: 3 },
  { id: 'apfExpiryDate', name: 'apfExpiryDate', label: 'APF Expiry Date', type: 'date', isRequired: false, section: 'APF Details', order: 4 },
  { id: 'apfIssuingAuthority', name: 'apfIssuingAuthority', label: 'APF Issuing Authority', type: 'text', isRequired: false, section: 'APF Details', order: 5 },
  { id: 'apfValidityStatus', name: 'apfValidityStatus', label: 'APF Validity Status', type: 'text', isRequired: false, section: 'APF Details', order: 6 },
  { id: 'apfAmount', name: 'apfAmount', label: 'APF Amount', type: 'number', isRequired: false, section: 'APF Details', order: 7 },
  { id: 'apfUtilizedAmount', name: 'apfUtilizedAmount', label: 'APF Utilized Amount', type: 'number', isRequired: false, section: 'APF Details', order: 8 },
  { id: 'apfBalanceAmount', name: 'apfBalanceAmount', label: 'APF Balance Amount', type: 'number', isRequired: false, section: 'APF Details', order: 9 },

  // Project Information
  { id: 'projectName', name: 'projectName', label: 'Project Name', type: 'text', isRequired: false, section: 'Project Information', order: 1 },
  { id: 'projectStatus', name: 'projectStatus', label: 'Project Status', type: 'text', isRequired: false, section: 'Project Information', order: 2 },
  { id: 'projectApprovalStatus', name: 'projectApprovalStatus', label: 'Project Approval Status', type: 'text', isRequired: false, section: 'Project Information', order: 3 },
  { id: 'projectCompletionPercentage', name: 'projectCompletionPercentage', label: 'Project Completion %', type: 'number', isRequired: false, section: 'Project Information', order: 4 },
  { id: 'projectStartDate', name: 'projectStartDate', label: 'Project Start Date', type: 'date', isRequired: false, section: 'Project Information', order: 5 },
  { id: 'projectEndDate', name: 'projectEndDate', label: 'Project End Date', type: 'date', isRequired: false, section: 'Project Information', order: 6 },
  { id: 'projectStartedDate', name: 'projectStartedDate', label: 'Project Started Date', type: 'date', isRequired: false, section: 'Project Information', order: 7 },
  { id: 'projectCompletionDate', name: 'projectCompletionDate', label: 'Project Completion Date', type: 'date', isRequired: false, section: 'Project Information', order: 8 },
  { id: 'totalUnits', name: 'totalUnits', label: 'Total Units', type: 'number', isRequired: false, section: 'Project Information', order: 9 },
  { id: 'completedUnits', name: 'completedUnits', label: 'Completed Units', type: 'number', isRequired: false, section: 'Project Information', order: 10 },
  { id: 'soldUnits', name: 'soldUnits', label: 'Sold Units', type: 'number', isRequired: false, section: 'Project Information', order: 11 },
  { id: 'availableUnits', name: 'availableUnits', label: 'Available Units', type: 'number', isRequired: false, section: 'Project Information', order: 12 },
  { id: 'possessionStatus', name: 'possessionStatus', label: 'Possession Status', type: 'text', isRequired: false, section: 'Project Information', order: 13 },
  { id: 'totalBuildingsInProject', name: 'totalBuildingsInProject', label: 'Total Buildings in Project', type: 'number', isRequired: false, section: 'Project Information', order: 14 },
  { id: 'totalFlats', name: 'totalFlats', label: 'Total Flats', type: 'number', isRequired: false, section: 'Project Information', order: 15 },
  { id: 'totalFlatsInBuilding', name: 'totalFlatsInBuilding', label: 'Total Flats in Building', type: 'number', isRequired: false, section: 'Project Information', order: 16 },
  { id: 'totalWing', name: 'totalWing', label: 'Total Wings', type: 'number', isRequired: false, section: 'Project Information', order: 17 },

  // Staff Information
  { id: 'staffSeen', name: 'staffSeen', label: 'Staff Seen', type: 'number', isRequired: false, section: 'Staff Information', order: 1 },
  { id: 'staffStrength', name: 'staffStrength', label: 'Staff Strength', type: 'number', isRequired: false, section: 'Staff Information', order: 2 },

  // Name Plates & Boards
  { id: 'companyNameBoard', name: 'companyNameBoard', label: 'Company Name Board', type: 'text', isRequired: false, section: 'Name Plates & Boards', order: 1 },
  { id: 'nameOnBoard', name: 'nameOnBoard', label: 'Name on Board', type: 'text', isRequired: false, section: 'Name Plates & Boards', order: 2 },

  // Document Verification
  { id: 'documentShownStatus', name: 'documentShownStatus', label: 'Document Shown Status', type: 'text', isRequired: false, section: 'Document Verification', order: 1 },
  { id: 'documentType', name: 'documentType', label: 'Document Type', type: 'text', isRequired: false, section: 'Document Verification', order: 2 },
  { id: 'documentVerificationStatus', name: 'documentVerificationStatus', label: 'Document Verification Status', type: 'text', isRequired: false, section: 'Document Verification', order: 3 },

  // Third Party Confirmation
  { id: 'tpcMetPerson1', name: 'tpcMetPerson1', label: 'TPC Met Person 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 1 },
  { id: 'tpcName1', name: 'tpcName1', label: 'TPC Name 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 2 },
  { id: 'tpcConfirmation1', name: 'tpcConfirmation1', label: 'TPC Confirmation 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 3 },
  { id: 'tpcMetPerson2', name: 'tpcMetPerson2', label: 'TPC Met Person 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 4 },
  { id: 'tpcName2', name: 'tpcName2', label: 'TPC Name 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 5 },
  { id: 'tpcConfirmation2', name: 'tpcConfirmation2', label: 'TPC Confirmation 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 6 },

  // Builder Information
  { id: 'builderName', name: 'builderName', label: 'Builder Name', type: 'text', isRequired: false, section: 'Builder Information', order: 1 },
  { id: 'builderContact', name: 'builderContact', label: 'Builder Contact', type: 'text', isRequired: false, section: 'Builder Information', order: 2 },
  { id: 'developerName', name: 'developerName', label: 'Developer Name', type: 'text', isRequired: false, section: 'Builder Information', order: 3 },
  { id: 'developerContact', name: 'developerContact', label: 'Developer Contact', type: 'text', isRequired: false, section: 'Builder Information', order: 4 },
  { id: 'builderRegistrationNumber', name: 'builderRegistrationNumber', label: 'Builder Registration Number', type: 'text', isRequired: false, section: 'Builder Information', order: 5 },
  { id: 'reraRegistrationNumber', name: 'reraRegistrationNumber', label: 'RERA Registration Number', type: 'text', isRequired: false, section: 'Builder Information', order: 6 },

  // Loan Information
  { id: 'loanAmount', name: 'loanAmount', label: 'Loan Amount', type: 'number', isRequired: false, section: 'Loan Information', order: 1 },
  { id: 'loanPurpose', name: 'loanPurpose', label: 'Loan Purpose', type: 'text', isRequired: false, section: 'Loan Information', order: 2 },
  { id: 'loanStatus', name: 'loanStatus', label: 'Loan Status', type: 'text', isRequired: false, section: 'Loan Information', order: 3 },
  { id: 'bankName', name: 'bankName', label: 'Bank Name', type: 'text', isRequired: false, section: 'Loan Information', order: 4 },
  { id: 'loanAccountNumber', name: 'loanAccountNumber', label: 'Loan Account Number', type: 'text', isRequired: false, section: 'Loan Information', order: 5 },
  { id: 'emiAmount', name: 'emiAmount', label: 'EMI Amount', type: 'number', isRequired: false, section: 'Loan Information', order: 6 },

  // Legal & Clearance
  { id: 'legalClearance', name: 'legalClearance', label: 'Legal Clearance', type: 'text', isRequired: false, section: 'Legal & Clearance', order: 1 },
  { id: 'titleClearance', name: 'titleClearance', label: 'Title Clearance', type: 'text', isRequired: false, section: 'Legal & Clearance', order: 2 },
  { id: 'encumbranceStatus', name: 'encumbranceStatus', label: 'Encumbrance Status', type: 'text', isRequired: false, section: 'Legal & Clearance', order: 3 },
  { id: 'litigationStatus', name: 'litigationStatus', label: 'Litigation Status', type: 'text', isRequired: false, section: 'Legal & Clearance', order: 4 },

  // Shifting & Contact Details
  { id: 'shiftedPeriod', name: 'shiftedPeriod', label: 'Shifted Period', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 1 },
  { id: 'currentLocation', name: 'currentLocation', label: 'Current Location', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 2 },
  { id: 'premisesStatus', name: 'premisesStatus', label: 'Premises Status', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 3 },
  { id: 'entryRestrictionReason', name: 'entryRestrictionReason', label: 'Entry Restriction Reason', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 4 },
  { id: 'securityPersonName', name: 'securityPersonName', label: 'Security Person Name', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 5 },
  { id: 'securityConfirmation', name: 'securityConfirmation', label: 'Security Confirmation', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 6 },
  { id: 'contactPerson', name: 'contactPerson', label: 'Contact Person', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 7 },
  { id: 'callRemark', name: 'callRemark', label: 'Call Remark', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 8 },

  // Infrastructure & Area Assessment
  { id: 'infrastructureStatus', name: 'infrastructureStatus', label: 'Infrastructure Status', type: 'text', isRequired: false, section: 'Infrastructure & Area Assessment', order: 1 },
  { id: 'roadConnectivity', name: 'roadConnectivity', label: 'Road Connectivity', type: 'text', isRequired: false, section: 'Infrastructure & Area Assessment', order: 2 },
  { id: 'politicalConnection', name: 'politicalConnection', label: 'Political Connection', type: 'text', isRequired: false, section: 'Infrastructure & Area Assessment', order: 3 },
  { id: 'dominatedArea', name: 'dominatedArea', label: 'Dominated Area', type: 'text', isRequired: false, section: 'Infrastructure & Area Assessment', order: 4 },
  { id: 'feedbackFromNeighbour', name: 'feedbackFromNeighbour', label: 'Feedback from Neighbour', type: 'text', isRequired: false, section: 'Infrastructure & Area Assessment', order: 5 },
  { id: 'otherObservation', name: 'otherObservation', label: 'Other Observation', type: 'textarea', isRequired: false, section: 'Infrastructure & Area Assessment', order: 6 },
  { id: 'propertyConcerns', name: 'propertyConcerns', label: 'Property Concerns', type: 'textarea', isRequired: false, section: 'Infrastructure & Area Assessment', order: 7 },
  { id: 'financialConcerns', name: 'financialConcerns', label: 'Financial Concerns', type: 'textarea', isRequired: false, section: 'Infrastructure & Area Assessment', order: 8 },
  { id: 'finalStatus', name: 'finalStatus', label: 'Final Status', type: 'text', isRequired: false, section: 'Infrastructure & Area Assessment', order: 9 },
  { id: 'holdReason', name: 'holdReason', label: 'Hold Reason', type: 'textarea', isRequired: false, section: 'Infrastructure & Area Assessment', order: 10 },
  { id: 'recommendationStatus', name: 'recommendationStatus', label: 'Recommendation Status', type: 'text', isRequired: false, section: 'Infrastructure & Area Assessment', order: 11 },
  { id: 'remarks', name: 'remarks', label: 'Remarks', type: 'textarea', isRequired: false, section: 'Infrastructure & Area Assessment', order: 12 },
];

// Property Individual form field definitions (based on actual database fields)
const PROPERTY_INDIVIDUAL_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  { id: 'outcome', name: 'outcome', label: 'Verification Outcome', type: 'select', isRequired: true, section: 'Basic Information', order: 1 },
  { id: 'customerName', name: 'customerName', label: 'Customer Name', type: 'text', isRequired: false, section: 'Basic Information', order: 2 },
  { id: 'metPersonName', name: 'metPersonName', label: 'Met Person Name', type: 'text', isRequired: false, section: 'Basic Information', order: 3 },
  { id: 'metPersonDesignation', name: 'metPersonDesignation', label: 'Met Person Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 4 },
  { id: 'metPersonRelation', name: 'metPersonRelation', label: 'Met Person Relation', type: 'text', isRequired: false, section: 'Basic Information', order: 5 },
  { id: 'metPersonContact', name: 'metPersonContact', label: 'Met Person Contact', type: 'text', isRequired: false, section: 'Basic Information', order: 6 },

  // Address Information
  { id: 'fullAddress', name: 'fullAddress', label: 'Full Address', type: 'textarea', isRequired: false, section: 'Address Information', order: 1 },
  { id: 'locality', name: 'locality', label: 'Locality', type: 'text', isRequired: false, section: 'Address Information', order: 2 },
  { id: 'addressLocatable', name: 'addressLocatable', label: 'Address Locatable', type: 'select', isRequired: false, section: 'Address Information', order: 3 },
  { id: 'addressRating', name: 'addressRating', label: 'Address Rating', type: 'select', isRequired: false, section: 'Address Information', order: 4 },
  { id: 'addressStructure', name: 'addressStructure', label: 'Address Structure', type: 'text', isRequired: false, section: 'Address Information', order: 5 },
  { id: 'addressStructureColor', name: 'addressStructureColor', label: 'Address Structure Color', type: 'text', isRequired: false, section: 'Address Information', order: 6 },
  { id: 'addressFloor', name: 'addressFloor', label: 'Address Floor', type: 'text', isRequired: false, section: 'Address Information', order: 7 },
  { id: 'doorColor', name: 'doorColor', label: 'Door Color', type: 'text', isRequired: false, section: 'Address Information', order: 8 },
  { id: 'landmark1', name: 'landmark1', label: 'Landmark 1', type: 'text', isRequired: false, section: 'Address Information', order: 9 },
  { id: 'landmark2', name: 'landmark2', label: 'Landmark 2', type: 'text', isRequired: false, section: 'Address Information', order: 10 },
  { id: 'landmark3', name: 'landmark3', label: 'Landmark 3', type: 'text', isRequired: false, section: 'Address Information', order: 11 },
  { id: 'landmark4', name: 'landmark4', label: 'Landmark 4', type: 'text', isRequired: false, section: 'Address Information', order: 12 },

  // Property Details
  { id: 'propertyType', name: 'propertyType', label: 'Property Type', type: 'text', isRequired: false, section: 'Property Details', order: 1 },
  { id: 'propertyStatus', name: 'propertyStatus', label: 'Property Status', type: 'text', isRequired: false, section: 'Property Details', order: 2 },
  { id: 'propertyOwnership', name: 'propertyOwnership', label: 'Property Ownership', type: 'text', isRequired: false, section: 'Property Details', order: 3 },
  { id: 'propertyAge', name: 'propertyAge', label: 'Property Age', type: 'number', isRequired: false, section: 'Property Details', order: 4 },
  { id: 'propertyCondition', name: 'propertyCondition', label: 'Property Condition', type: 'text', isRequired: false, section: 'Property Details', order: 5 },
  { id: 'propertyArea', name: 'propertyArea', label: 'Property Area', type: 'number', isRequired: false, section: 'Property Details', order: 6 },
  { id: 'propertyValue', name: 'propertyValue', label: 'Property Value', type: 'number', isRequired: false, section: 'Property Details', order: 7 },
  { id: 'marketValue', name: 'marketValue', label: 'Market Value', type: 'number', isRequired: false, section: 'Property Details', order: 8 },
  { id: 'propertyLocation', name: 'propertyLocation', label: 'Property Location', type: 'text', isRequired: false, section: 'Property Details', order: 9 },
  { id: 'propertyDescription', name: 'propertyDescription', label: 'Property Description', type: 'textarea', isRequired: false, section: 'Property Details', order: 10 },
  { id: 'propertyAmenities', name: 'propertyAmenities', label: 'Property Amenities', type: 'textarea', isRequired: false, section: 'Property Details', order: 11 },
  { id: 'constructionType', name: 'constructionType', label: 'Construction Type', type: 'text', isRequired: false, section: 'Property Details', order: 12 },
  { id: 'constructionYear', name: 'constructionYear', label: 'Construction Year', type: 'number', isRequired: false, section: 'Property Details', order: 13 },
  { id: 'renovationYear', name: 'renovationYear', label: 'Renovation Year', type: 'number', isRequired: false, section: 'Property Details', order: 14 },

  // Owner Information
  { id: 'ownerName', name: 'ownerName', label: 'Owner Name', type: 'text', isRequired: false, section: 'Owner Information', order: 1 },
  { id: 'ownerAge', name: 'ownerAge', label: 'Owner Age', type: 'number', isRequired: false, section: 'Owner Information', order: 2 },
  { id: 'ownerOccupation', name: 'ownerOccupation', label: 'Owner Occupation', type: 'text', isRequired: false, section: 'Owner Information', order: 3 },
  { id: 'ownerIncome', name: 'ownerIncome', label: 'Owner Income', type: 'number', isRequired: false, section: 'Owner Information', order: 4 },
  { id: 'ownerRelation', name: 'ownerRelation', label: 'Owner Relation', type: 'text', isRequired: false, section: 'Owner Information', order: 5 },
  { id: 'previousOwnerName', name: 'previousOwnerName', label: 'Previous Owner Name', type: 'text', isRequired: false, section: 'Owner Information', order: 6 },

  // Individual Information
  { id: 'individualName', name: 'individualName', label: 'Individual Name', type: 'text', isRequired: false, section: 'Individual Information', order: 1 },
  { id: 'individualAge', name: 'individualAge', label: 'Individual Age', type: 'number', isRequired: false, section: 'Individual Information', order: 2 },
  { id: 'individualOccupation', name: 'individualOccupation', label: 'Individual Occupation', type: 'text', isRequired: false, section: 'Individual Information', order: 3 },
  { id: 'individualEducation', name: 'individualEducation', label: 'Individual Education', type: 'text', isRequired: false, section: 'Individual Information', order: 4 },
  { id: 'individualMaritalStatus', name: 'individualMaritalStatus', label: 'Individual Marital Status', type: 'text', isRequired: false, section: 'Individual Information', order: 5 },
  { id: 'individualExperience', name: 'individualExperience', label: 'Individual Experience', type: 'number', isRequired: false, section: 'Individual Information', order: 6 },
  { id: 'individualIncome', name: 'individualIncome', label: 'Individual Income', type: 'number', isRequired: false, section: 'Individual Information', order: 7 },
  { id: 'yearsOfResidence', name: 'yearsOfResidence', label: 'Years of Residence', type: 'number', isRequired: false, section: 'Individual Information', order: 8 },

  // Family & Employment
  { id: 'familyMembers', name: 'familyMembers', label: 'Family Members', type: 'number', isRequired: false, section: 'Family & Employment', order: 1 },
  { id: 'earningMembers', name: 'earningMembers', label: 'Earning Members', type: 'number', isRequired: false, section: 'Family & Employment', order: 2 },
  { id: 'employmentType', name: 'employmentType', label: 'Employment Type', type: 'text', isRequired: false, section: 'Family & Employment', order: 3 },
  { id: 'employerName', name: 'employerName', label: 'Employer Name', type: 'text', isRequired: false, section: 'Family & Employment', order: 4 },
  { id: 'employmentDuration', name: 'employmentDuration', label: 'Employment Duration', type: 'number', isRequired: false, section: 'Family & Employment', order: 5 },
  { id: 'incomeSource', name: 'incomeSource', label: 'Income Source', type: 'text', isRequired: false, section: 'Family & Employment', order: 6 },
  { id: 'monthlyIncome', name: 'monthlyIncome', label: 'Monthly Income', type: 'number', isRequired: false, section: 'Family & Employment', order: 7 },
  { id: 'annualIncome', name: 'annualIncome', label: 'Annual Income', type: 'number', isRequired: false, section: 'Family & Employment', order: 8 },

  // Business Information
  { id: 'businessName', name: 'businessName', label: 'Business Name', type: 'text', isRequired: false, section: 'Business Information', order: 1 },
  { id: 'businessType', name: 'businessType', label: 'Business Type', type: 'text', isRequired: false, section: 'Business Information', order: 2 },
  { id: 'businessIncome', name: 'businessIncome', label: 'Business Income', type: 'number', isRequired: false, section: 'Business Information', order: 3 },
  { id: 'businessExperience', name: 'businessExperience', label: 'Business Experience', type: 'number', isRequired: false, section: 'Business Information', order: 4 },

  // Financial Information
  { id: 'loanAmount', name: 'loanAmount', label: 'Loan Amount', type: 'number', isRequired: false, section: 'Financial Information', order: 1 },
  { id: 'emiAmount', name: 'emiAmount', label: 'EMI Amount', type: 'number', isRequired: false, section: 'Financial Information', order: 2 },
  { id: 'bankName', name: 'bankName', label: 'Bank Name', type: 'text', isRequired: false, section: 'Financial Information', order: 3 },
  { id: 'loanAgainstProperty', name: 'loanAgainstProperty', label: 'Loan Against Property', type: 'text', isRequired: false, section: 'Financial Information', order: 4 },

  // Legal & Documentation
  { id: 'propertyDocuments', name: 'propertyDocuments', label: 'Property Documents', type: 'text', isRequired: false, section: 'Legal & Documentation', order: 1 },
  { id: 'documentVerificationStatus', name: 'documentVerificationStatus', label: 'Document Verification Status', type: 'text', isRequired: false, section: 'Legal & Documentation', order: 2 },
  { id: 'titleClearStatus', name: 'titleClearStatus', label: 'Title Clear Status', type: 'text', isRequired: false, section: 'Legal & Documentation', order: 3 },
  { id: 'mutationStatus', name: 'mutationStatus', label: 'Mutation Status', type: 'text', isRequired: false, section: 'Legal & Documentation', order: 4 },
  { id: 'taxPaymentStatus', name: 'taxPaymentStatus', label: 'Tax Payment Status', type: 'text', isRequired: false, section: 'Legal & Documentation', order: 5 },
  { id: 'legalIssues', name: 'legalIssues', label: 'Legal Issues', type: 'text', isRequired: false, section: 'Legal & Documentation', order: 6 },

  // Utilities & Amenities
  { id: 'electricityConnection', name: 'electricityConnection', label: 'Electricity Connection', type: 'text', isRequired: false, section: 'Utilities & Amenities', order: 1 },
  { id: 'waterConnection', name: 'waterConnection', label: 'Water Connection', type: 'text', isRequired: false, section: 'Utilities & Amenities', order: 2 },
  { id: 'gasConnection', name: 'gasConnection', label: 'Gas Connection', type: 'text', isRequired: false, section: 'Utilities & Amenities', order: 3 },
  { id: 'internetConnection', name: 'internetConnection', label: 'Internet Connection', type: 'text', isRequired: false, section: 'Utilities & Amenities', order: 4 },
  { id: 'publicTransport', name: 'publicTransport', label: 'Public Transport', type: 'text', isRequired: false, section: 'Utilities & Amenities', order: 5 },
  { id: 'roadConnectivity', name: 'roadConnectivity', label: 'Road Connectivity', type: 'text', isRequired: false, section: 'Utilities & Amenities', order: 6 },
  { id: 'safetySecurityy', name: 'safetySecurity', label: 'Safety & Security', type: 'text', isRequired: false, section: 'Utilities & Amenities', order: 7 },

  // Third Party Confirmation
  { id: 'tpcMetPerson1', name: 'tpcMetPerson1', label: 'TPC Met Person 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 1 },
  { id: 'tpcName1', name: 'tpcName1', label: 'TPC Name 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 2 },
  { id: 'tpcConfirmation1', name: 'tpcConfirmation1', label: 'TPC Confirmation 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 3 },
  { id: 'tpcMetPerson2', name: 'tpcMetPerson2', label: 'TPC Met Person 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 4 },
  { id: 'tpcName2', name: 'tpcName2', label: 'TPC Name 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 5 },
  { id: 'tpcConfirmation2', name: 'tpcConfirmation2', label: 'TPC Confirmation 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 6 },
  { id: 'neighbor1Name', name: 'neighbor1Name', label: 'Neighbor 1 Name', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 7 },
  { id: 'neighbor1Confirmation', name: 'neighbor1Confirmation', label: 'Neighbor 1 Confirmation', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 8 },
  { id: 'neighbor2Name', name: 'neighbor2Name', label: 'Neighbor 2 Name', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 9 },
  { id: 'neighbor2Confirmation', name: 'neighbor2Confirmation', label: 'Neighbor 2 Confirmation', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 10 },

  // Shifting & Contact Details
  { id: 'shiftedPeriod', name: 'shiftedPeriod', label: 'Shifted Period', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 1 },
  { id: 'currentLocation', name: 'currentLocation', label: 'Current Location', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 2 },
  { id: 'premisesStatus', name: 'premisesStatus', label: 'Premises Status', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 3 },
  { id: 'entryRestrictionReason', name: 'entryRestrictionReason', label: 'Entry Restriction Reason', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 4 },
  { id: 'securityPersonName', name: 'securityPersonName', label: 'Security Person Name', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 5 },
  { id: 'securityConfirmation', name: 'securityConfirmation', label: 'Security Confirmation', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 6 },
  { id: 'contactPerson', name: 'contactPerson', label: 'Contact Person', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 7 },
  { id: 'callRemark', name: 'callRemark', label: 'Call Remark', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 8 },

  // Area Assessment & Reputation
  { id: 'localityReputation', name: 'localityReputation', label: 'Locality Reputation', type: 'text', isRequired: false, section: 'Area Assessment & Reputation', order: 1 },
  { id: 'infrastructureStatus', name: 'infrastructureStatus', label: 'Infrastructure Status', type: 'text', isRequired: false, section: 'Area Assessment & Reputation', order: 2 },
  { id: 'politicalConnection', name: 'politicalConnection', label: 'Political Connection', type: 'text', isRequired: false, section: 'Area Assessment & Reputation', order: 3 },
  { id: 'dominatedArea', name: 'dominatedArea', label: 'Dominated Area', type: 'text', isRequired: false, section: 'Area Assessment & Reputation', order: 4 },
  { id: 'feedbackFromNeighbour', name: 'feedbackFromNeighbour', label: 'Feedback from Neighbour', type: 'text', isRequired: false, section: 'Area Assessment & Reputation', order: 5 },
  { id: 'otherObservation', name: 'otherObservation', label: 'Other Observation', type: 'textarea', isRequired: false, section: 'Area Assessment & Reputation', order: 6 },
  { id: 'propertyConcerns', name: 'propertyConcerns', label: 'Property Concerns', type: 'textarea', isRequired: false, section: 'Area Assessment & Reputation', order: 7 },
  { id: 'verificationChallenges', name: 'verificationChallenges', label: 'Verification Challenges', type: 'textarea', isRequired: false, section: 'Area Assessment & Reputation', order: 8 },
  { id: 'finalStatus', name: 'finalStatus', label: 'Final Status', type: 'text', isRequired: false, section: 'Area Assessment & Reputation', order: 9 },
  { id: 'holdReason', name: 'holdReason', label: 'Hold Reason', type: 'textarea', isRequired: false, section: 'Area Assessment & Reputation', order: 10 },
  { id: 'recommendationStatus', name: 'recommendationStatus', label: 'Recommendation Status', type: 'text', isRequired: false, section: 'Area Assessment & Reputation', order: 11 },
  { id: 'remarks', name: 'remarks', label: 'Remarks', type: 'textarea', isRequired: false, section: 'Area Assessment & Reputation', order: 12 },
];

// NOC form field definitions
const NOC_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  { id: 'outcome', name: 'outcome', label: 'Verification Outcome', type: 'select', isRequired: true, section: 'Basic Information', order: 1 },
  { id: 'customerName', name: 'customerName', label: 'Customer Name', type: 'text', isRequired: false, section: 'Basic Information', order: 2 },
  { id: 'metPersonName', name: 'metPersonName', label: 'Met Person Name', type: 'text', isRequired: false, section: 'Basic Information', order: 3 },
  { id: 'metPersonDesignation', name: 'metPersonDesignation', label: 'Met Person Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 4 },
  { id: 'metPersonRelation', name: 'metPersonRelation', label: 'Met Person Relation', type: 'text', isRequired: false, section: 'Basic Information', order: 5 },
  { id: 'metPersonContact', name: 'metPersonContact', label: 'Met Person Contact', type: 'text', isRequired: false, section: 'Basic Information', order: 6 },

  // Address Information
  { id: 'fullAddress', name: 'fullAddress', label: 'Full Address', type: 'textarea', isRequired: false, section: 'Address Information', order: 1 },
  { id: 'locality', name: 'locality', label: 'Locality', type: 'text', isRequired: false, section: 'Address Information', order: 2 },
  { id: 'addressLocatable', name: 'addressLocatable', label: 'Address Locatable', type: 'select', isRequired: false, section: 'Address Information', order: 3 },
  { id: 'addressRating', name: 'addressRating', label: 'Address Rating', type: 'select', isRequired: false, section: 'Address Information', order: 4 },
  { id: 'addressStructure', name: 'addressStructure', label: 'Address Structure', type: 'text', isRequired: false, section: 'Address Information', order: 5 },
  { id: 'addressStructureColor', name: 'addressStructureColor', label: 'Address Structure Color', type: 'text', isRequired: false, section: 'Address Information', order: 6 },
  { id: 'addressFloor', name: 'addressFloor', label: 'Address Floor', type: 'text', isRequired: false, section: 'Address Information', order: 7 },
  { id: 'doorColor', name: 'doorColor', label: 'Door Color', type: 'text', isRequired: false, section: 'Address Information', order: 8 },
  { id: 'landmark1', name: 'landmark1', label: 'Landmark 1', type: 'text', isRequired: false, section: 'Address Information', order: 9 },
  { id: 'landmark2', name: 'landmark2', label: 'Landmark 2', type: 'text', isRequired: false, section: 'Address Information', order: 10 },
  { id: 'landmark3', name: 'landmark3', label: 'Landmark 3', type: 'text', isRequired: false, section: 'Address Information', order: 11 },
  { id: 'landmark4', name: 'landmark4', label: 'Landmark 4', type: 'text', isRequired: false, section: 'Address Information', order: 12 },

  // NOC Information
  { id: 'nocType', name: 'nocType', label: 'NOC Type', type: 'text', isRequired: false, section: 'NOC Information', order: 1 },
  { id: 'nocStatus', name: 'nocStatus', label: 'NOC Status', type: 'text', isRequired: false, section: 'NOC Information', order: 2 },
  { id: 'nocNumber', name: 'nocNumber', label: 'NOC Number', type: 'text', isRequired: false, section: 'NOC Information', order: 3 },
  { id: 'nocIssueDate', name: 'nocIssueDate', label: 'NOC Issue Date', type: 'date', isRequired: false, section: 'NOC Information', order: 4 },
  { id: 'nocExpiryDate', name: 'nocExpiryDate', label: 'NOC Expiry Date', type: 'date', isRequired: false, section: 'NOC Information', order: 5 },
  { id: 'nocIssuingAuthority', name: 'nocIssuingAuthority', label: 'NOC Issuing Authority', type: 'text', isRequired: false, section: 'NOC Information', order: 6 },
  { id: 'nocValidityStatus', name: 'nocValidityStatus', label: 'NOC Validity Status', type: 'text', isRequired: false, section: 'NOC Information', order: 7 },

  // Property & Project Information
  { id: 'propertyType', name: 'propertyType', label: 'Property Type', type: 'text', isRequired: false, section: 'Property & Project Information', order: 1 },
  { id: 'projectName', name: 'projectName', label: 'Project Name', type: 'text', isRequired: false, section: 'Property & Project Information', order: 2 },
  { id: 'projectStatus', name: 'projectStatus', label: 'Project Status', type: 'text', isRequired: false, section: 'Property & Project Information', order: 3 },
  { id: 'constructionStatus', name: 'constructionStatus', label: 'Construction Status', type: 'text', isRequired: false, section: 'Property & Project Information', order: 4 },
  { id: 'projectApprovalStatus', name: 'projectApprovalStatus', label: 'Project Approval Status', type: 'text', isRequired: false, section: 'Property & Project Information', order: 5 },
  { id: 'totalUnits', name: 'totalUnits', label: 'Total Units', type: 'number', isRequired: false, section: 'Property & Project Information', order: 6 },
  { id: 'completedUnits', name: 'completedUnits', label: 'Completed Units', type: 'number', isRequired: false, section: 'Property & Project Information', order: 7 },
  { id: 'soldUnits', name: 'soldUnits', label: 'Sold Units', type: 'number', isRequired: false, section: 'Property & Project Information', order: 8 },
  { id: 'possessionStatus', name: 'possessionStatus', label: 'Possession Status', type: 'text', isRequired: false, section: 'Property & Project Information', order: 9 },

  // Builder & Developer Information
  { id: 'builderName', name: 'builderName', label: 'Builder Name', type: 'text', isRequired: false, section: 'Builder & Developer Information', order: 1 },
  { id: 'builderContact', name: 'builderContact', label: 'Builder Contact', type: 'text', isRequired: false, section: 'Builder & Developer Information', order: 2 },
  { id: 'developerName', name: 'developerName', label: 'Developer Name', type: 'text', isRequired: false, section: 'Builder & Developer Information', order: 3 },
  { id: 'developerContact', name: 'developerContact', label: 'Developer Contact', type: 'text', isRequired: false, section: 'Builder & Developer Information', order: 4 },
  { id: 'builderRegistrationNumber', name: 'builderRegistrationNumber', label: 'Builder Registration Number', type: 'text', isRequired: false, section: 'Builder & Developer Information', order: 5 },

  // Document Verification
  { id: 'documentShownStatus', name: 'documentShownStatus', label: 'Document Shown Status', type: 'text', isRequired: false, section: 'Document Verification', order: 1 },
  { id: 'documentType', name: 'documentType', label: 'Document Type', type: 'text', isRequired: false, section: 'Document Verification', order: 2 },
  { id: 'documentVerificationStatus', name: 'documentVerificationStatus', label: 'Document Verification Status', type: 'text', isRequired: false, section: 'Document Verification', order: 3 },

  // Third Party Confirmation
  { id: 'tpcMetPerson1', name: 'tpcMetPerson1', label: 'TPC Met Person 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 1 },
  { id: 'tpcName1', name: 'tpcName1', label: 'TPC Name 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 2 },
  { id: 'tpcConfirmation1', name: 'tpcConfirmation1', label: 'TPC Confirmation 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 3 },
  { id: 'tpcMetPerson2', name: 'tpcMetPerson2', label: 'TPC Met Person 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 4 },
  { id: 'tpcName2', name: 'tpcName2', label: 'TPC Name 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 5 },
  { id: 'tpcConfirmation2', name: 'tpcConfirmation2', label: 'TPC Confirmation 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 6 },

  // Shifting & Contact Details
  { id: 'shiftedPeriod', name: 'shiftedPeriod', label: 'Shifted Period', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 1 },
  { id: 'currentLocation', name: 'currentLocation', label: 'Current Location', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 2 },
  { id: 'premisesStatus', name: 'premisesStatus', label: 'Premises Status', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 3 },
  { id: 'entryRestrictionReason', name: 'entryRestrictionReason', label: 'Entry Restriction Reason', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 4 },
  { id: 'securityPersonName', name: 'securityPersonName', label: 'Security Person Name', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 5 },
  { id: 'securityConfirmation', name: 'securityConfirmation', label: 'Security Confirmation', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 6 },
  { id: 'contactPerson', name: 'contactPerson', label: 'Contact Person', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 7 },
  { id: 'callRemark', name: 'callRemark', label: 'Call Remark', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 8 },

  // Clearances & Compliance
  { id: 'environmentalClearance', name: 'environmentalClearance', label: 'Environmental Clearance', type: 'text', isRequired: false, section: 'Clearances & Compliance', order: 1 },
  { id: 'fireSafetyClearance', name: 'fireSafetyClearance', label: 'Fire Safety Clearance', type: 'text', isRequired: false, section: 'Clearances & Compliance', order: 2 },
  { id: 'pollutionClearance', name: 'pollutionClearance', label: 'Pollution Clearance', type: 'text', isRequired: false, section: 'Clearances & Compliance', order: 3 },
  { id: 'waterConnectionStatus', name: 'waterConnectionStatus', label: 'Water Connection Status', type: 'text', isRequired: false, section: 'Clearances & Compliance', order: 4 },
  { id: 'electricityConnectionStatus', name: 'electricityConnectionStatus', label: 'Electricity Connection Status', type: 'text', isRequired: false, section: 'Clearances & Compliance', order: 5 },
  { id: 'complianceIssues', name: 'complianceIssues', label: 'Compliance Issues', type: 'textarea', isRequired: false, section: 'Clearances & Compliance', order: 6 },
  { id: 'regulatoryConcerns', name: 'regulatoryConcerns', label: 'Regulatory Concerns', type: 'textarea', isRequired: false, section: 'Clearances & Compliance', order: 7 },

  // Infrastructure & Assessment
  { id: 'infrastructureStatus', name: 'infrastructureStatus', label: 'Infrastructure Status', type: 'text', isRequired: false, section: 'Infrastructure & Assessment', order: 1 },
  { id: 'roadConnectivity', name: 'roadConnectivity', label: 'Road Connectivity', type: 'text', isRequired: false, section: 'Infrastructure & Assessment', order: 2 },
  { id: 'politicalConnection', name: 'politicalConnection', label: 'Political Connection', type: 'text', isRequired: false, section: 'Infrastructure & Assessment', order: 3 },
  { id: 'dominatedArea', name: 'dominatedArea', label: 'Dominated Area', type: 'text', isRequired: false, section: 'Infrastructure & Assessment', order: 4 },
  { id: 'feedbackFromNeighbour', name: 'feedbackFromNeighbour', label: 'Feedback from Neighbour', type: 'text', isRequired: false, section: 'Infrastructure & Assessment', order: 5 },
  { id: 'otherObservation', name: 'otherObservation', label: 'Other Observation', type: 'textarea', isRequired: false, section: 'Infrastructure & Assessment', order: 6 },

  // Final Status & Recommendations
  { id: 'finalStatus', name: 'finalStatus', label: 'Final Status', type: 'text', isRequired: false, section: 'Final Status & Recommendations', order: 1 },
  { id: 'holdReason', name: 'holdReason', label: 'Hold Reason', type: 'textarea', isRequired: false, section: 'Final Status & Recommendations', order: 2 },
  { id: 'recommendationStatus', name: 'recommendationStatus', label: 'Recommendation Status', type: 'text', isRequired: false, section: 'Final Status & Recommendations', order: 3 },
  { id: 'remarks', name: 'remarks', label: 'Remarks', type: 'textarea', isRequired: false, section: 'Final Status & Recommendations', order: 4 },
];

// Builder form field definitions
const BUILDER_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  { id: 'outcome', name: 'outcome', label: 'Verification Outcome', type: 'select', isRequired: true, section: 'Basic Information', order: 1 },
  { id: 'customerName', name: 'customerName', label: 'Customer Name', type: 'text', isRequired: false, section: 'Basic Information', order: 2 },
  { id: 'metPersonName', name: 'metPersonName', label: 'Met Person Name', type: 'text', isRequired: false, section: 'Basic Information', order: 3 },
  { id: 'designation', name: 'designation', label: 'Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 4 },
  { id: 'applicantDesignation', name: 'applicantDesignation', label: 'Applicant Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 5 },

  // Address Information
  { id: 'fullAddress', name: 'fullAddress', label: 'Full Address', type: 'textarea', isRequired: false, section: 'Address Information', order: 1 },
  { id: 'locality', name: 'locality', label: 'Locality', type: 'text', isRequired: false, section: 'Address Information', order: 2 },
  { id: 'addressLocatable', name: 'addressLocatable', label: 'Address Locatable', type: 'select', isRequired: false, section: 'Address Information', order: 3 },
  { id: 'addressRating', name: 'addressRating', label: 'Address Rating', type: 'select', isRequired: false, section: 'Address Information', order: 4 },
  { id: 'addressStructure', name: 'addressStructure', label: 'Address Structure', type: 'text', isRequired: false, section: 'Address Information', order: 5 },
  { id: 'addressStructureColor', name: 'addressStructureColor', label: 'Address Structure Color', type: 'text', isRequired: false, section: 'Address Information', order: 6 },
  { id: 'addressFloor', name: 'addressFloor', label: 'Address Floor', type: 'text', isRequired: false, section: 'Address Information', order: 7 },
  { id: 'doorColor', name: 'doorColor', label: 'Door Color', type: 'text', isRequired: false, section: 'Address Information', order: 8 },
  { id: 'landmark1', name: 'landmark1', label: 'Landmark 1', type: 'text', isRequired: false, section: 'Address Information', order: 9 },
  { id: 'landmark2', name: 'landmark2', label: 'Landmark 2', type: 'text', isRequired: false, section: 'Address Information', order: 10 },
  { id: 'landmark3', name: 'landmark3', label: 'Landmark 3', type: 'text', isRequired: false, section: 'Address Information', order: 11 },
  { id: 'landmark4', name: 'landmark4', label: 'Landmark 4', type: 'text', isRequired: false, section: 'Address Information', order: 12 },

  // Builder Information
  { id: 'builderName', name: 'builderName', label: 'Builder Name', type: 'text', isRequired: false, section: 'Builder Information', order: 1 },
  { id: 'builderOwnerName', name: 'builderOwnerName', label: 'Builder Owner Name', type: 'text', isRequired: false, section: 'Builder Information', order: 2 },
  { id: 'builderType', name: 'builderType', label: 'Builder Type', type: 'text', isRequired: false, section: 'Builder Information', order: 3 },
  { id: 'companyNatureOfBusiness', name: 'companyNatureOfBusiness', label: 'Company Nature of Business', type: 'text', isRequired: false, section: 'Builder Information', order: 4 },
  { id: 'businessPeriod', name: 'businessPeriod', label: 'Business Period', type: 'text', isRequired: false, section: 'Builder Information', order: 5 },
  { id: 'establishmentPeriod', name: 'establishmentPeriod', label: 'Establishment Period', type: 'text', isRequired: false, section: 'Builder Information', order: 6 },
  { id: 'workingPeriod', name: 'workingPeriod', label: 'Working Period', type: 'text', isRequired: false, section: 'Builder Information', order: 7 },
  { id: 'workingStatus', name: 'workingStatus', label: 'Working Status', type: 'text', isRequired: false, section: 'Builder Information', order: 8 },
  { id: 'applicantWorkingStatus', name: 'applicantWorkingStatus', label: 'Applicant Working Status', type: 'text', isRequired: false, section: 'Builder Information', order: 9 },

  // Office Information
  { id: 'officeStatus', name: 'officeStatus', label: 'Office Status', type: 'text', isRequired: false, section: 'Office Information', order: 1 },
  { id: 'officeExistence', name: 'officeExistence', label: 'Office Existence', type: 'text', isRequired: false, section: 'Office Information', order: 2 },
  { id: 'officeApproxArea', name: 'officeApproxArea', label: 'Office Approximate Area', type: 'number', isRequired: false, section: 'Office Information', order: 3 },
  { id: 'companyNameplateStatus', name: 'companyNameplateStatus', label: 'Company Nameplate Status', type: 'text', isRequired: false, section: 'Office Information', order: 4 },
  { id: 'nameOnCompanyBoard', name: 'nameOnCompanyBoard', label: 'Name on Company Board', type: 'text', isRequired: false, section: 'Office Information', order: 5 },

  // Staff Information
  { id: 'staffStrength', name: 'staffStrength', label: 'Staff Strength', type: 'number', isRequired: false, section: 'Staff Information', order: 1 },
  { id: 'staffSeen', name: 'staffSeen', label: 'Staff Seen', type: 'number', isRequired: false, section: 'Staff Information', order: 2 },

  // Document Verification
  { id: 'documentShown', name: 'documentShown', label: 'Document Shown', type: 'text', isRequired: false, section: 'Document Verification', order: 1 },

  // Third Party Confirmation
  { id: 'tpcMetPerson1', name: 'tpcMetPerson1', label: 'TPC Met Person 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 1 },
  { id: 'tpcName1', name: 'tpcName1', label: 'TPC Name 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 2 },
  { id: 'tpcConfirmation1', name: 'tpcConfirmation1', label: 'TPC Confirmation 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 3 },
  { id: 'tpcMetPerson2', name: 'tpcMetPerson2', label: 'TPC Met Person 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 4 },
  { id: 'tpcName2', name: 'tpcName2', label: 'TPC Name 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 5 },
  { id: 'tpcConfirmation2', name: 'tpcConfirmation2', label: 'TPC Confirmation 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 6 },
  { id: 'nameOfMetPerson', name: 'nameOfMetPerson', label: 'Name of Met Person', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 7 },
  { id: 'metPersonType', name: 'metPersonType', label: 'Met Person Type', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 8 },
  { id: 'metPersonConfirmation', name: 'metPersonConfirmation', label: 'Met Person Confirmation', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 9 },

  // Shifting & Contact Details
  { id: 'shiftedPeriod', name: 'shiftedPeriod', label: 'Shifted Period', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 1 },
  { id: 'oldOfficeShiftedPeriod', name: 'oldOfficeShiftedPeriod', label: 'Old Office Shifted Period', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 2 },
  { id: 'currentCompanyName', name: 'currentCompanyName', label: 'Current Company Name', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 3 },
  { id: 'currentCompanyPeriod', name: 'currentCompanyPeriod', label: 'Current Company Period', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 4 },
  { id: 'premisesStatus', name: 'premisesStatus', label: 'Premises Status', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 5 },
  { id: 'contactPerson', name: 'contactPerson', label: 'Contact Person', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 6 },
  { id: 'callRemark', name: 'callRemark', label: 'Call Remark', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 7 },

  // Assessment & Feedback
  { id: 'politicalConnection', name: 'politicalConnection', label: 'Political Connection', type: 'text', isRequired: false, section: 'Assessment & Feedback', order: 1 },
  { id: 'dominatedArea', name: 'dominatedArea', label: 'Dominated Area', type: 'text', isRequired: false, section: 'Assessment & Feedback', order: 2 },
  { id: 'feedbackFromNeighbour', name: 'feedbackFromNeighbour', label: 'Feedback from Neighbour', type: 'text', isRequired: false, section: 'Assessment & Feedback', order: 3 },
  { id: 'otherObservation', name: 'otherObservation', label: 'Other Observation', type: 'textarea', isRequired: false, section: 'Assessment & Feedback', order: 4 },
  { id: 'otherExtraRemark', name: 'otherExtraRemark', label: 'Other Extra Remark', type: 'textarea', isRequired: false, section: 'Assessment & Feedback', order: 5 },

  // Final Status & Recommendations
  { id: 'finalStatus', name: 'finalStatus', label: 'Final Status', type: 'text', isRequired: false, section: 'Final Status & Recommendations', order: 1 },
  { id: 'holdReason', name: 'holdReason', label: 'Hold Reason', type: 'textarea', isRequired: false, section: 'Final Status & Recommendations', order: 2 },
  { id: 'recommendationStatus', name: 'recommendationStatus', label: 'Recommendation Status', type: 'text', isRequired: false, section: 'Final Status & Recommendations', order: 3 },
  { id: 'remarks', name: 'remarks', label: 'Remarks', type: 'textarea', isRequired: false, section: 'Final Status & Recommendations', order: 4 },
];

// DSA Connector form field definitions
const DSA_CONNECTOR_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  { id: 'outcome', name: 'outcome', label: 'Verification Outcome', type: 'select', isRequired: true, section: 'Basic Information', order: 1 },
  { id: 'customerName', name: 'customerName', label: 'Customer Name', type: 'text', isRequired: false, section: 'Basic Information', order: 2 },
  { id: 'metPersonName', name: 'metPersonName', label: 'Met Person Name', type: 'text', isRequired: false, section: 'Basic Information', order: 3 },
  { id: 'metPersonDesignation', name: 'metPersonDesignation', label: 'Met Person Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 4 },
  { id: 'metPersonRelation', name: 'metPersonRelation', label: 'Met Person Relation', type: 'text', isRequired: false, section: 'Basic Information', order: 5 },
  { id: 'metPersonContact', name: 'metPersonContact', label: 'Met Person Contact', type: 'text', isRequired: false, section: 'Basic Information', order: 6 },

  // Address Information
  { id: 'fullAddress', name: 'fullAddress', label: 'Full Address', type: 'textarea', isRequired: false, section: 'Address Information', order: 1 },
  { id: 'locality', name: 'locality', label: 'Locality', type: 'text', isRequired: false, section: 'Address Information', order: 2 },
  { id: 'addressLocatable', name: 'addressLocatable', label: 'Address Locatable', type: 'select', isRequired: false, section: 'Address Information', order: 3 },
  { id: 'addressRating', name: 'addressRating', label: 'Address Rating', type: 'select', isRequired: false, section: 'Address Information', order: 4 },
  { id: 'addressStructure', name: 'addressStructure', label: 'Address Structure', type: 'text', isRequired: false, section: 'Address Information', order: 5 },
  { id: 'addressStructureColor', name: 'addressStructureColor', label: 'Address Structure Color', type: 'text', isRequired: false, section: 'Address Information', order: 6 },
  { id: 'addressFloor', name: 'addressFloor', label: 'Address Floor', type: 'text', isRequired: false, section: 'Address Information', order: 7 },
  { id: 'doorColor', name: 'doorColor', label: 'Door Color', type: 'text', isRequired: false, section: 'Address Information', order: 8 },
  { id: 'landmark1', name: 'landmark1', label: 'Landmark 1', type: 'text', isRequired: false, section: 'Address Information', order: 9 },
  { id: 'landmark2', name: 'landmark2', label: 'Landmark 2', type: 'text', isRequired: false, section: 'Address Information', order: 10 },
  { id: 'landmark3', name: 'landmark3', label: 'Landmark 3', type: 'text', isRequired: false, section: 'Address Information', order: 11 },
  { id: 'landmark4', name: 'landmark4', label: 'Landmark 4', type: 'text', isRequired: false, section: 'Address Information', order: 12 },

  // Connector Information
  { id: 'connectorType', name: 'connectorType', label: 'Connector Type', type: 'text', isRequired: false, section: 'Connector Information', order: 1 },
  { id: 'connectorCode', name: 'connectorCode', label: 'Connector Code', type: 'text', isRequired: false, section: 'Connector Information', order: 2 },
  { id: 'connectorName', name: 'connectorName', label: 'Connector Name', type: 'text', isRequired: false, section: 'Connector Information', order: 3 },
  { id: 'connectorDesignation', name: 'connectorDesignation', label: 'Connector Designation', type: 'text', isRequired: false, section: 'Connector Information', order: 4 },
  { id: 'connectorExperience', name: 'connectorExperience', label: 'Connector Experience', type: 'number', isRequired: false, section: 'Connector Information', order: 5 },
  { id: 'connectorStatus', name: 'connectorStatus', label: 'Connector Status', type: 'text', isRequired: false, section: 'Connector Information', order: 6 },

  // Business Information
  { id: 'businessName', name: 'businessName', label: 'Business Name', type: 'text', isRequired: false, section: 'Business Information', order: 1 },
  { id: 'businessType', name: 'businessType', label: 'Business Type', type: 'text', isRequired: false, section: 'Business Information', order: 2 },
  { id: 'businessRegistrationNumber', name: 'businessRegistrationNumber', label: 'Business Registration Number', type: 'text', isRequired: false, section: 'Business Information', order: 3 },
  { id: 'businessEstablishmentYear', name: 'businessEstablishmentYear', label: 'Business Establishment Year', type: 'number', isRequired: false, section: 'Business Information', order: 4 },
  { id: 'businessOperational', name: 'businessOperational', label: 'Business Operational', type: 'text', isRequired: false, section: 'Business Information', order: 5 },
  { id: 'businessHours', name: 'businessHours', label: 'Business Hours', type: 'text', isRequired: false, section: 'Business Information', order: 6 },
  { id: 'weekendOperations', name: 'weekendOperations', label: 'Weekend Operations', type: 'text', isRequired: false, section: 'Business Information', order: 7 },
  { id: 'customerFootfall', name: 'customerFootfall', label: 'Customer Footfall', type: 'text', isRequired: false, section: 'Business Information', order: 8 },
  { id: 'previousBusinessName', name: 'previousBusinessName', label: 'Previous Business Name', type: 'text', isRequired: false, section: 'Business Information', order: 9 },

  // Office Information
  { id: 'officeType', name: 'officeType', label: 'Office Type', type: 'text', isRequired: false, section: 'Office Information', order: 1 },
  { id: 'officeArea', name: 'officeArea', label: 'Office Area', type: 'number', isRequired: false, section: 'Office Information', order: 2 },
  { id: 'officeRent', name: 'officeRent', label: 'Office Rent', type: 'number', isRequired: false, section: 'Office Information', order: 3 },

  // Staff Information
  { id: 'totalStaff', name: 'totalStaff', label: 'Total Staff', type: 'number', isRequired: false, section: 'Staff Information', order: 1 },
  { id: 'salesStaff', name: 'salesStaff', label: 'Sales Staff', type: 'number', isRequired: false, section: 'Staff Information', order: 2 },
  { id: 'supportStaff', name: 'supportStaff', label: 'Support Staff', type: 'number', isRequired: false, section: 'Staff Information', order: 3 },
  { id: 'teamSize', name: 'teamSize', label: 'Team Size', type: 'number', isRequired: false, section: 'Staff Information', order: 4 },

  // Financial Information
  { id: 'monthlyBusinessVolume', name: 'monthlyBusinessVolume', label: 'Monthly Business Volume', type: 'number', isRequired: false, section: 'Financial Information', order: 1 },
  { id: 'averageMonthlySales', name: 'averageMonthlySales', label: 'Average Monthly Sales', type: 'number', isRequired: false, section: 'Financial Information', order: 2 },
  { id: 'annualTurnover', name: 'annualTurnover', label: 'Annual Turnover', type: 'number', isRequired: false, section: 'Financial Information', order: 3 },
  { id: 'monthlyIncome', name: 'monthlyIncome', label: 'Monthly Income', type: 'number', isRequired: false, section: 'Financial Information', order: 4 },
  { id: 'commissionStructure', name: 'commissionStructure', label: 'Commission Structure', type: 'text', isRequired: false, section: 'Financial Information', order: 5 },
  { id: 'paymentTerms', name: 'paymentTerms', label: 'Payment Terms', type: 'text', isRequired: false, section: 'Financial Information', order: 6 },
  { id: 'bankAccountDetails', name: 'bankAccountDetails', label: 'Bank Account Details', type: 'text', isRequired: false, section: 'Financial Information', order: 7 },

  // Technology & Infrastructure
  { id: 'computerSystems', name: 'computerSystems', label: 'Computer Systems', type: 'number', isRequired: false, section: 'Technology & Infrastructure', order: 1 },
  { id: 'internetConnection', name: 'internetConnection', label: 'Internet Connection', type: 'text', isRequired: false, section: 'Technology & Infrastructure', order: 2 },
  { id: 'softwareSystems', name: 'softwareSystems', label: 'Software Systems', type: 'text', isRequired: false, section: 'Technology & Infrastructure', order: 3 },
  { id: 'posTerminals', name: 'posTerminals', label: 'POS Terminals', type: 'number', isRequired: false, section: 'Technology & Infrastructure', order: 4 },
  { id: 'printerScanner', name: 'printerScanner', label: 'Printer Scanner', type: 'text', isRequired: false, section: 'Technology & Infrastructure', order: 5 },
  { id: 'infrastructureStatus', name: 'infrastructureStatus', label: 'Infrastructure Status', type: 'text', isRequired: false, section: 'Technology & Infrastructure', order: 6 },

  // Compliance & Licensing
  { id: 'licenseStatus', name: 'licenseStatus', label: 'License Status', type: 'text', isRequired: false, section: 'Compliance & Licensing', order: 1 },
  { id: 'licenseNumber', name: 'licenseNumber', label: 'License Number', type: 'text', isRequired: false, section: 'Compliance & Licensing', order: 2 },
  { id: 'licenseExpiryDate', name: 'licenseExpiryDate', label: 'License Expiry Date', type: 'date', isRequired: false, section: 'Compliance & Licensing', order: 3 },
  { id: 'complianceStatus', name: 'complianceStatus', label: 'Compliance Status', type: 'text', isRequired: false, section: 'Compliance & Licensing', order: 4 },
  { id: 'auditStatus', name: 'auditStatus', label: 'Audit Status', type: 'text', isRequired: false, section: 'Compliance & Licensing', order: 5 },
  { id: 'trainingStatus', name: 'trainingStatus', label: 'Training Status', type: 'text', isRequired: false, section: 'Compliance & Licensing', order: 6 },

  // Third Party Confirmation
  { id: 'tpcMetPerson1', name: 'tpcMetPerson1', label: 'TPC Met Person 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 1 },
  { id: 'tpcName1', name: 'tpcName1', label: 'TPC Name 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 2 },
  { id: 'tpcConfirmation1', name: 'tpcConfirmation1', label: 'TPC Confirmation 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 3 },
  { id: 'tpcMetPerson2', name: 'tpcMetPerson2', label: 'TPC Met Person 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 4 },
  { id: 'tpcName2', name: 'tpcName2', label: 'TPC Name 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 5 },
  { id: 'tpcConfirmation2', name: 'tpcConfirmation2', label: 'TPC Confirmation 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 6 },

  // Shifting & Contact Details
  { id: 'shiftedPeriod', name: 'shiftedPeriod', label: 'Shifted Period', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 1 },
  { id: 'currentLocation', name: 'currentLocation', label: 'Current Location', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 2 },
  { id: 'premisesStatus', name: 'premisesStatus', label: 'Premises Status', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 3 },
  { id: 'entryRestrictionReason', name: 'entryRestrictionReason', label: 'Entry Restriction Reason', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 4 },
  { id: 'securityPersonName', name: 'securityPersonName', label: 'Security Person Name', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 5 },
  { id: 'securityConfirmation', name: 'securityConfirmation', label: 'Security Confirmation', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 6 },
  { id: 'contactPerson', name: 'contactPerson', label: 'Contact Person', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 7 },
  { id: 'callRemark', name: 'callRemark', label: 'Call Remark', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 8 },

  // Market Analysis & Assessment
  { id: 'marketPresence', name: 'marketPresence', label: 'Market Presence', type: 'text', isRequired: false, section: 'Market Analysis & Assessment', order: 1 },
  { id: 'competitorAnalysis', name: 'competitorAnalysis', label: 'Competitor Analysis', type: 'text', isRequired: false, section: 'Market Analysis & Assessment', order: 2 },
  { id: 'marketReputation', name: 'marketReputation', label: 'Market Reputation', type: 'text', isRequired: false, section: 'Market Analysis & Assessment', order: 3 },
  { id: 'customerFeedback', name: 'customerFeedback', label: 'Customer Feedback', type: 'text', isRequired: false, section: 'Market Analysis & Assessment', order: 4 },
  { id: 'commercialViability', name: 'commercialViability', label: 'Commercial Viability', type: 'text', isRequired: false, section: 'Market Analysis & Assessment', order: 5 },
  { id: 'growthPotential', name: 'growthPotential', label: 'Growth Potential', type: 'textarea', isRequired: false, section: 'Market Analysis & Assessment', order: 6 },

  // Risk Assessment & Final Status
  { id: 'politicalConnection', name: 'politicalConnection', label: 'Political Connection', type: 'text', isRequired: false, section: 'Risk Assessment & Final Status', order: 1 },
  { id: 'dominatedArea', name: 'dominatedArea', label: 'Dominated Area', type: 'text', isRequired: false, section: 'Risk Assessment & Final Status', order: 2 },
  { id: 'feedbackFromNeighbour', name: 'feedbackFromNeighbour', label: 'Feedback from Neighbour', type: 'text', isRequired: false, section: 'Risk Assessment & Final Status', order: 3 },
  { id: 'otherObservation', name: 'otherObservation', label: 'Other Observation', type: 'textarea', isRequired: false, section: 'Risk Assessment & Final Status', order: 4 },
  { id: 'businessConcerns', name: 'businessConcerns', label: 'Business Concerns', type: 'textarea', isRequired: false, section: 'Risk Assessment & Final Status', order: 5 },
  { id: 'operationalChallenges', name: 'operationalChallenges', label: 'Operational Challenges', type: 'textarea', isRequired: false, section: 'Risk Assessment & Final Status', order: 6 },
  { id: 'riskAssessment', name: 'riskAssessment', label: 'Risk Assessment', type: 'text', isRequired: false, section: 'Risk Assessment & Final Status', order: 7 },
  { id: 'finalStatus', name: 'finalStatus', label: 'Final Status', type: 'text', isRequired: false, section: 'Risk Assessment & Final Status', order: 8 },
  { id: 'holdReason', name: 'holdReason', label: 'Hold Reason', type: 'textarea', isRequired: false, section: 'Risk Assessment & Final Status', order: 9 },
  { id: 'recommendationStatus', name: 'recommendationStatus', label: 'Recommendation Status', type: 'text', isRequired: false, section: 'Risk Assessment & Final Status', order: 10 },
  { id: 'remarks', name: 'remarks', label: 'Remarks', type: 'textarea', isRequired: false, section: 'Risk Assessment & Final Status', order: 11 },
];

// Residence-cum-Office form field definitions (combines residence and office fields)
const RESIDENCE_CUM_OFFICE_FORM_FIELDS: FormFieldDefinition[] = [
  // Basic Information
  { id: 'outcome', name: 'outcome', label: 'Verification Outcome', type: 'select', isRequired: true, section: 'Basic Information', order: 1 },
  { id: 'customerName', name: 'customerName', label: 'Customer Name', type: 'text', isRequired: false, section: 'Basic Information', order: 2 },
  { id: 'metPersonName', name: 'metPersonName', label: 'Met Person Name', type: 'text', isRequired: false, section: 'Basic Information', order: 3 },
  { id: 'metPersonRelation', name: 'metPersonRelation', label: 'Met Person Relation', type: 'text', isRequired: false, section: 'Basic Information', order: 4 },
  { id: 'designation', name: 'designation', label: 'Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 5 },
  { id: 'applicantDesignation', name: 'applicantDesignation', label: 'Applicant Designation', type: 'text', isRequired: false, section: 'Basic Information', order: 6 },

  // Address Information
  { id: 'fullAddress', name: 'fullAddress', label: 'Full Address', type: 'textarea', isRequired: false, section: 'Address Information', order: 1 },
  { id: 'locality', name: 'locality', label: 'Locality', type: 'text', isRequired: false, section: 'Address Information', order: 2 },
  { id: 'addressLocatable', name: 'addressLocatable', label: 'Address Locatable', type: 'select', isRequired: false, section: 'Address Information', order: 3 },
  { id: 'addressRating', name: 'addressRating', label: 'Address Rating', type: 'select', isRequired: false, section: 'Address Information', order: 4 },
  { id: 'addressStructure', name: 'addressStructure', label: 'Address Structure', type: 'text', isRequired: false, section: 'Address Information', order: 5 },
  { id: 'addressStructureColor', name: 'addressStructureColor', label: 'Address Structure Color', type: 'text', isRequired: false, section: 'Address Information', order: 6 },
  { id: 'addressFloor', name: 'addressFloor', label: 'Address Floor', type: 'text', isRequired: false, section: 'Address Information', order: 7 },
  { id: 'doorColor', name: 'doorColor', label: 'Door Color', type: 'text', isRequired: false, section: 'Address Information', order: 8 },
  { id: 'landmark1', name: 'landmark1', label: 'Landmark 1', type: 'text', isRequired: false, section: 'Address Information', order: 9 },
  { id: 'landmark2', name: 'landmark2', label: 'Landmark 2', type: 'text', isRequired: false, section: 'Address Information', order: 10 },
  { id: 'landmark3', name: 'landmark3', label: 'Landmark 3', type: 'text', isRequired: false, section: 'Address Information', order: 11 },
  { id: 'landmark4', name: 'landmark4', label: 'Landmark 4', type: 'text', isRequired: false, section: 'Address Information', order: 12 },

  // Residence Information
  { id: 'houseStatus', name: 'houseStatus', label: 'House Status', type: 'text', isRequired: false, section: 'Residence Information', order: 1 },
  { id: 'totalFamilyMembers', name: 'totalFamilyMembers', label: 'Total Family Members', type: 'number', isRequired: false, section: 'Residence Information', order: 2 },
  { id: 'totalEarning', name: 'totalEarning', label: 'Total Earning', type: 'number', isRequired: false, section: 'Residence Information', order: 3 },
  { id: 'stayingPeriod', name: 'stayingPeriod', label: 'Staying Period', type: 'text', isRequired: false, section: 'Residence Information', order: 4 },
  { id: 'stayingStatus', name: 'stayingStatus', label: 'Staying Status', type: 'text', isRequired: false, section: 'Residence Information', order: 5 },
  { id: 'stayingPersonName', name: 'stayingPersonName', label: 'Staying Person Name', type: 'text', isRequired: false, section: 'Residence Information', order: 6 },
  { id: 'doorNameplateStatus', name: 'doorNameplateStatus', label: 'Door Nameplate Status', type: 'text', isRequired: false, section: 'Residence Information', order: 7 },
  { id: 'nameOnDoorPlate', name: 'nameOnDoorPlate', label: 'Name on Door Plate', type: 'text', isRequired: false, section: 'Residence Information', order: 8 },
  { id: 'societyNameplateStatus', name: 'societyNameplateStatus', label: 'Society Nameplate Status', type: 'text', isRequired: false, section: 'Residence Information', order: 9 },
  { id: 'nameOnSocietyBoard', name: 'nameOnSocietyBoard', label: 'Name on Society Board', type: 'text', isRequired: false, section: 'Residence Information', order: 10 },

  // Applicant Information
  { id: 'applicantAge', name: 'applicantAge', label: 'Applicant Age', type: 'number', isRequired: false, section: 'Applicant Information', order: 1 },
  { id: 'applicantDob', name: 'applicantDob', label: 'Applicant Date of Birth', type: 'date', isRequired: false, section: 'Applicant Information', order: 2 },
  { id: 'applicantStayingStatus', name: 'applicantStayingStatus', label: 'Applicant Staying Status', type: 'text', isRequired: false, section: 'Applicant Information', order: 3 },
  { id: 'applicantWorkingStatus', name: 'applicantWorkingStatus', label: 'Applicant Working Status', type: 'text', isRequired: false, section: 'Applicant Information', order: 4 },
  { id: 'applicantWorkingPremises', name: 'applicantWorkingPremises', label: 'Applicant Working Premises', type: 'text', isRequired: false, section: 'Applicant Information', order: 5 },

  // Office Information
  { id: 'officeStatus', name: 'officeStatus', label: 'Office Status', type: 'text', isRequired: false, section: 'Office Information', order: 1 },
  { id: 'officeExistence', name: 'officeExistence', label: 'Office Existence', type: 'text', isRequired: false, section: 'Office Information', order: 2 },
  { id: 'officeType', name: 'officeType', label: 'Office Type', type: 'text', isRequired: false, section: 'Office Information', order: 3 },
  { id: 'companyNatureOfBusiness', name: 'companyNatureOfBusiness', label: 'Company Nature of Business', type: 'text', isRequired: false, section: 'Office Information', order: 4 },
  { id: 'businessPeriod', name: 'businessPeriod', label: 'Business Period', type: 'text', isRequired: false, section: 'Office Information', order: 5 },
  { id: 'establishmentPeriod', name: 'establishmentPeriod', label: 'Establishment Period', type: 'text', isRequired: false, section: 'Office Information', order: 6 },
  { id: 'workingPeriod', name: 'workingPeriod', label: 'Working Period', type: 'text', isRequired: false, section: 'Office Information', order: 7 },
  { id: 'workingStatus', name: 'workingStatus', label: 'Working Status', type: 'text', isRequired: false, section: 'Office Information', order: 8 },
  { id: 'approxArea', name: 'approxArea', label: 'Approximate Area', type: 'number', isRequired: false, section: 'Office Information', order: 9 },
  { id: 'sittingLocation', name: 'sittingLocation', label: 'Sitting Location', type: 'text', isRequired: false, section: 'Office Information', order: 10 },
  { id: 'companyNameplateStatus', name: 'companyNameplateStatus', label: 'Company Nameplate Status', type: 'text', isRequired: false, section: 'Office Information', order: 11 },
  { id: 'nameOnCompanyBoard', name: 'nameOnCompanyBoard', label: 'Name on Company Board', type: 'text', isRequired: false, section: 'Office Information', order: 12 },

  // Staff Information
  { id: 'staffStrength', name: 'staffStrength', label: 'Staff Strength', type: 'number', isRequired: false, section: 'Staff Information', order: 1 },
  { id: 'staffSeen', name: 'staffSeen', label: 'Staff Seen', type: 'number', isRequired: false, section: 'Staff Information', order: 2 },

  // Document Verification
  { id: 'documentShownStatus', name: 'documentShownStatus', label: 'Document Shown Status', type: 'text', isRequired: false, section: 'Document Verification', order: 1 },
  { id: 'documentType', name: 'documentType', label: 'Document Type', type: 'text', isRequired: false, section: 'Document Verification', order: 2 },

  // Third Party Confirmation
  { id: 'tpcMetPerson1', name: 'tpcMetPerson1', label: 'TPC Met Person 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 1 },
  { id: 'tpcName1', name: 'tpcName1', label: 'TPC Name 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 2 },
  { id: 'tpcConfirmation1', name: 'tpcConfirmation1', label: 'TPC Confirmation 1', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 3 },
  { id: 'tpcMetPerson2', name: 'tpcMetPerson2', label: 'TPC Met Person 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 4 },
  { id: 'tpcName2', name: 'tpcName2', label: 'TPC Name 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 5 },
  { id: 'tpcConfirmation2', name: 'tpcConfirmation2', label: 'TPC Confirmation 2', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 6 },
  { id: 'nameOfMetPerson', name: 'nameOfMetPerson', label: 'Name of Met Person', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 7 },
  { id: 'metPersonType', name: 'metPersonType', label: 'Met Person Type', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 8 },
  { id: 'metPersonConfirmation', name: 'metPersonConfirmation', label: 'Met Person Confirmation', type: 'text', isRequired: false, section: 'Third Party Confirmation', order: 9 },

  // Shifting & Contact Details
  { id: 'shiftedPeriod', name: 'shiftedPeriod', label: 'Shifted Period', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 1 },
  { id: 'oldOfficeShiftedPeriod', name: 'oldOfficeShiftedPeriod', label: 'Old Office Shifted Period', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 2 },
  { id: 'currentCompanyName', name: 'currentCompanyName', label: 'Current Company Name', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 3 },
  { id: 'currentCompanyPeriod', name: 'currentCompanyPeriod', label: 'Current Company Period', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 4 },
  { id: 'premisesStatus', name: 'premisesStatus', label: 'Premises Status', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 5 },
  { id: 'contactPerson', name: 'contactPerson', label: 'Contact Person', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 6 },
  { id: 'callRemark', name: 'callRemark', label: 'Call Remark', type: 'text', isRequired: false, section: 'Shifting & Contact Details', order: 7 },

  // Area Assessment & Final Status
  { id: 'politicalConnection', name: 'politicalConnection', label: 'Political Connection', type: 'text', isRequired: false, section: 'Area Assessment & Final Status', order: 1 },
  { id: 'dominatedArea', name: 'dominatedArea', label: 'Dominated Area', type: 'text', isRequired: false, section: 'Area Assessment & Final Status', order: 2 },
  { id: 'feedbackFromNeighbour', name: 'feedbackFromNeighbour', label: 'Feedback from Neighbour', type: 'text', isRequired: false, section: 'Area Assessment & Final Status', order: 3 },
  { id: 'otherObservation', name: 'otherObservation', label: 'Other Observation', type: 'textarea', isRequired: false, section: 'Area Assessment & Final Status', order: 4 },
  { id: 'otherExtraRemark', name: 'otherExtraRemark', label: 'Other Extra Remark', type: 'textarea', isRequired: false, section: 'Area Assessment & Final Status', order: 5 },
  { id: 'finalStatus', name: 'finalStatus', label: 'Final Status', type: 'text', isRequired: false, section: 'Area Assessment & Final Status', order: 6 },
  { id: 'holdReason', name: 'holdReason', label: 'Hold Reason', type: 'textarea', isRequired: false, section: 'Area Assessment & Final Status', order: 7 },
  { id: 'recommendationStatus', name: 'recommendationStatus', label: 'Recommendation Status', type: 'text', isRequired: false, section: 'Area Assessment & Final Status', order: 8 },
  { id: 'remarks', name: 'remarks', label: 'Remarks', type: 'textarea', isRequired: false, section: 'Area Assessment & Final Status', order: 9 },
];

// Field definitions mapping by verification type
export const VERIFICATION_TYPE_FIELDS: Record<string, FormFieldDefinition[]> = {
  'RESIDENCE': RESIDENCE_FORM_FIELDS,
  'OFFICE': OFFICE_FORM_FIELDS,
  'BUSINESS': BUSINESS_FORM_FIELDS,
  'PROPERTY_APF': PROPERTY_APF_FORM_FIELDS,
  'PROPERTY_INDIVIDUAL': PROPERTY_INDIVIDUAL_FORM_FIELDS,
  'NOC': NOC_FORM_FIELDS,
  'BUILDER': BUILDER_FORM_FIELDS,
  'DSA_CONNECTOR': DSA_CONNECTOR_FORM_FIELDS,
  'CONNECTOR': DSA_CONNECTOR_FORM_FIELDS, // Alias for DSA_CONNECTOR
  'RESIDENCE_CUM_OFFICE': RESIDENCE_CUM_OFFICE_FORM_FIELDS,
  'Residence-cum-office': RESIDENCE_CUM_OFFICE_FORM_FIELDS, // Alias for RESIDENCE_CUM_OFFICE
};

/**
 * Get form field definitions for a specific verification type and form type
 */
export function getFormFieldDefinitions(verificationType: string, formType?: string): FormFieldDefinition[] {
  const fields = VERIFICATION_TYPE_FIELDS[verificationType.toUpperCase()] || [];
  
  if (!formType) {
    return fields;
  }
  
  // Filter fields based on form type
  return fields.filter(field => 
    !field.formTypes || field.formTypes.includes(formType.toUpperCase())
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
export function getFieldsForSection(verificationType: string, section: string, formType?: string): FormFieldDefinition[] {
  const fields = getFormFieldDefinitions(verificationType, formType);

  return fields
    .filter(field => field.section === section)
    .sort((a, b) => a.order - b.order);
}

/**
 * Create comprehensive form sections from form data
 */
export function createComprehensiveFormSections(
  formData: any,
  verificationType: string,
  formType: string
): FormSection[] {
  console.log(`Creating comprehensive sections for ${verificationType} - ${formType}`);
  console.log('Form data keys:', Object.keys(formData));
  console.log('Form data sample:', JSON.stringify(formData, null, 2).substring(0, 500));

  const sections: FormSection[] = [];
  const sectionNames = getFormSections(verificationType, formType);
  console.log(`Found ${sectionNames.length} sections:`, sectionNames);

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
          errors: []
        }
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
        defaultExpanded: index < 2 // Expand first 2 sections by default
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
    'POSITIVE': 'Positive & Door Locked',
    'SHIFTED': 'Shifted & Door Lock',
    'NSP': 'NSP & Door Lock',
    'ENTRY_RESTRICTED': 'Entry Restricted (ERT)',
    'UNTRACEABLE': 'Untraceable'
  };

  return labels[formType.toUpperCase()] || formType;
}

/**
 * Get verification type specific table names
 */
export function getVerificationTableName(verificationType: string): string {
  const tableNames: Record<string, string> = {
    'RESIDENCE': 'residenceVerificationReports',
    'OFFICE': 'officeVerificationReports',
    'BUSINESS': 'businessVerificationReports',
    'BUILDER': 'builderVerificationReports',
    'RESIDENCE_CUM_OFFICE': 'residenceCumOfficeVerificationReports',
    'PROPERTY_APF': 'propertyApfVerificationReports',
    'NOC': 'nocVerificationReports',
    'PROPERTY_INDIVIDUAL': 'propertyIndividualVerificationReports',
    'DSA_CONNECTOR': 'dsaConnectorVerificationReports'
  };

  return tableNames[verificationType.toUpperCase()] || 'residenceVerificationReports';
}
