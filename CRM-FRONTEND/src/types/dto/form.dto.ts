/**
 * Form Data Transfer Objects
 * Union types for all verification form submissions
 */

// Base form fields common to all verification types
export interface BaseFormData {
  caseId: string;
  verificationTaskId?: string;
  customerName?: string;
  verificationOutcome: string;
  finalStatus: string;
  callRemark?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Residence Verification
export interface ResidenceVerificationData extends BaseFormData {
  metPersonName?: string;
  metPersonRelation?: string;
  addressLocatable?: string;
  addressRating?: string;
  houseStatus?: string;
  totalFamilyMembers?: number;
  totalEarningMember?: number;
  workingStatus?: string;
  companyName?: string;
  stayingPeriod?: string;
  stayingStatus?: string;
  documentShown?: string;
  documentType?: string;
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
}

// Office Verification
export interface OfficeVerificationData extends BaseFormData {
  companyName?: string;
  businessType?: string;
  numberOfEmployees?: number;
  officeArea?: string;
  addressLocatable?: string;
  addressRating?: string;
  officeExistsStatus?: string; // ERT outcome: 'Office Exist At' / 'Office Does Not Exist At' / 'Office Shifted From'
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
}

// Business Verification
export interface BusinessVerificationData extends BaseFormData {
  businessName?: string;
  businessType?: string;
  licenseNumber?: string;
  annualTurnover?: number;
  customerFootfall?: string;
  addressLocatable?: string;
  addressRating?: string;
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
}

// Builder Verification
export interface BuilderVerificationData extends BaseFormData {
  officeStatus?: string;
  officeExistence?: string;
  builderType?: string;
  companyNatureOfBusiness?: string;
  businessPeriod?: string;
  establishmentPeriod?: string;
  officeApproxArea?: number;
  staffStrength?: number;
  staffSeen?: number;
  metPersonName?: string;
  designation?: string;
  applicantDesignation?: string;
  builderName?: string;
  builderOwnerName?: string;
  workingPeriod?: string;
  workingStatus?: string;
  documentShown?: string;
  addressLocatable?: string;
  addressRating?: string;
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
}

// DSA/DST Connector Verification
export interface DsaConnectorVerificationData extends BaseFormData {
  connectorType?: string;
  connectorCode?: string;
  connectorName?: string;
  connectorDesignation?: string;
  connectorExperience?: number;
  connectorStatus?: string;
  businessName?: string;
  businessType?: string;
  businessRegistrationNumber?: string;
  businessEstablishmentYear?: number;
  officeType?: string;
  officeArea?: number;
  officeRent?: number;
  totalStaff?: number;
  salesStaff?: number;
  supportStaff?: number;
  teamSize?: number;
  monthlyBusinessVolume?: number;
  averageMonthlySales?: number;
  annualTurnover?: number;
  monthlyIncome?: number;
  commissionStructure?: string;
  paymentTerms?: string;
  bankAccountDetails?: string;
  computerSystems?: number;
  internetConnection?: string;
  softwareSystems?: string;
  posTerminals?: number;
  printerScanner?: string;
  licenseStatus?: string;
  licenseNumber?: string;
  licenseExpiryDate?: string;
  complianceStatus?: string;
  auditStatus?: string;
  trainingStatus?: string;
  metPersonName?: string;
  metPersonDesignation?: string;
  metPersonRelation?: string;
  metPersonContact?: string;
  businessExistence?: string;
  customerFootfall?: string;
  businessHours?: string;
  weekendOperations?: string;
  marketPresence?: string;
  competitorAnalysis?: string;
  marketReputation?: string;
  customerFeedback?: string;
  riskAssessment?: string;
  addressLocatable?: string;
  addressRating?: string;
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
}

// NOC Verification
export interface NocVerificationData extends BaseFormData {
  nocStatus?: string;
  nocType?: string;
  nocNumber?: string;
  nocIssueDate?: string;
  nocExpiryDate?: string;
  nocIssuingAuthority?: string;
  nocValidityStatus?: string;
  propertyType?: string;
  projectName?: string;
  projectStatus?: string;
  constructionStatus?: string;
  projectApprovalStatus?: string;
  totalUnits?: number;
  completedUnits?: number;
  soldUnits?: number;
  possessionStatus?: string;
  builderName?: string;
  builderContact?: string;
  developerName?: string;
  developerContact?: string;
  builderRegistrationNumber?: string;
  metPersonName?: string;
  metPersonDesignation?: string;
  metPersonRelation?: string;
  metPersonContact?: string;
  documentShownStatus?: string;
  documentType?: string;
  documentVerificationStatus?: string;
  environmentalClearance?: string;
  fireSafetyClearance?: string;
  pollutionClearance?: string;
  waterConnectionStatus?: string;
  electricityConnectionStatus?: string;
  addressLocatable?: string;
  addressRating?: string;
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
}

// Property APF Verification
export interface PropertyApfVerificationData extends BaseFormData {
  propertyType?: string;
  propertyStatus?: string;
  propertyOwnership?: string;
  propertyAge?: number;
  propertyCondition?: string;
  propertyArea?: number;
  propertyValue?: number;
  marketValue?: number;
  apfStatus?: string;
  apfNumber?: string;
  apfIssueDate?: string;
  apfExpiryDate?: string;
  apfIssuingAuthority?: string;
  apfValidityStatus?: string;
  apfAmount?: number;
  apfUtilizedAmount?: number;
  apfBalanceAmount?: number;
  projectName?: string;
  projectStatus?: string;
  projectApprovalStatus?: string;
  projectCompletionPercentage?: number;
  totalUnits?: number;
  completedUnits?: number;
  soldUnits?: number;
  availableUnits?: number;
  possessionStatus?: string;
  builderName?: string;
  builderContact?: string;
  developerName?: string;
  developerContact?: string;
  builderRegistrationNumber?: string;
  reraRegistrationNumber?: string;
  loanAmount?: number;
  loanPurpose?: string;
  loanStatus?: string;
  bankName?: string;
  emiAmount?: number;
  metPersonName?: string;
  metPersonDesignation?: string;
  metPersonRelation?: string;
  metPersonContact?: string;
  documentShownStatus?: string;
  documentType?: string;
  addressLocatable?: string;
  addressRating?: string;
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
}

// Property Individual Verification
export interface PropertyIndividualVerificationData extends BaseFormData {
  propertyType?: string;
  propertyStatus?: string;
  propertyOwnership?: string;
  propertyAge?: number;
  propertyCondition?: string;
  propertyArea?: number;
  propertyValue?: number;
  marketValue?: number;
  constructionType?: string;
  ownerName?: string;
  ownerRelation?: string;
  ownerAge?: number;
  ownerOccupation?: string;
  ownerIncome?: number;
  yearsOfResidence?: number;
  familyMembers?: number;
  earningMembers?: number;
  individualName?: string;
  individualAge?: number;
  individualOccupation?: string;
  individualIncome?: number;
  employmentType?: string;
  monthlyIncome?: number;
  annualIncome?: number;
  propertyDocuments?: string;
  documentVerificationStatus?: string;
  titleClearStatus?: string;
  mutationStatus?: string;
  taxPaymentStatus?: string;
  metPersonName?: string;
  metPersonDesignation?: string;
  metPersonRelation?: string;
  metPersonContact?: string;
  addressLocatable?: string;
  addressRating?: string;
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
}

// Residence Cum Office Verification
export interface ResidenceCumOfficeVerificationData extends BaseFormData {
  resiCumOfficeStatus?: string;
  houseStatus?: string;
  metPersonName?: string;
  metPersonRelation?: string;
  totalFamilyMembers?: number;
  totalEarningMember?: number;
  stayingPeriod?: string;
  stayingStatus?: string;
  approxArea?: number;
  documentShown?: string;
  documentType?: string;
  officeStatus?: string;
  officeExistence?: string;
  officeType?: string;
  designation?: string;
  applicantDesignation?: string;
  workingPeriod?: string;
  workingStatus?: string;
  currentCompanyName?: string;
  companyNatureOfBusiness?: string;
  businessPeriod?: string;
  establishmentPeriod?: string;
  staffStrength?: number;
  staffSeen?: number;
  addressLocatable?: string;
  addressTraceable?: string; // NSP outcome only: TRACEABLE / UNTRACEABLE (separate from addressLocatable Easy/Difficult)
  businessExistsStatus?: string; // ERT outcome only: 'Office Exist At' / 'Office Does Not Exist At' / 'Office Shifted From'
  addressRating?: string;
  locality?: string;
  addressStructure?: string;
  landmark1?: string;
  landmark2?: string;
  landmark3?: string;
  landmark4?: string;
  politicalConnection?: string;
  dominatedArea?: string;
  feedbackFromNeighbour?: string;
  otherObservation?: string;
}

// Union type for all verification form data
export type VerificationFormData =
  | ResidenceVerificationData
  | OfficeVerificationData
  | BusinessVerificationData
  | BuilderVerificationData
  | DsaConnectorVerificationData
  | NocVerificationData
  | PropertyApfVerificationData
  | PropertyIndividualVerificationData
  | ResidenceCumOfficeVerificationData;

// Form submission request
export interface FormSubmissionRequest {
  formType: string;
  formData: VerificationFormData;
  attachments?: File[];
}

// Form submission response
export interface FormSubmissionResponse {
  id: string;
  caseId: string;
  verificationTaskId?: string;
  formType: string;
  status: string;
  submittedAt: string;
  submittedBy: string;
}
