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
  totalEarning?: number;
  workingStatus?: string;
  companyName?: string;
  stayingPeriod?: string;
  stayingStatus?: string;
  documentShownStatus?: string;
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

// Site Visit
export interface SiteVisitData extends BaseFormData {
  siteLocation?: string;
  siteCondition?: string;
  constructionStatus?: string;
  accessibilityRating?: string;
  nearbyLandmarks?: string;
  observations?: string;
}

// Telecom Verification
export interface TelecomVerificationData extends BaseFormData {
  phoneNumber?: string;
  connectionType?: string;
  connectionStatus?: string;
  registeredName?: string;
  addressOnRecord?: string;
  verificationMethod?: string;
}

// Reference Check
export interface ReferenceCheckData extends BaseFormData {
  referenceName?: string;
  referenceRelation?: string;
  referencePhone?: string;
  referenceAddress?: string;
  feedbackReceived?: string;
  referenceRating?: string;
}

// Document Verification
export interface DocumentVerificationData extends BaseFormData {
  documentType?: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  documentStatus?: string;
  verificationMethod?: string;
  discrepanciesFound?: string;
}

// Employment Verification
export interface EmploymentVerificationData extends BaseFormData {
  employerName?: string;
  designation?: string;
  employmentType?: string;
  joiningDate?: string;
  salary?: number;
  hrContactName?: string;
  hrContactPhone?: string;
  verificationMethod?: string;
}

// Bank Account Verification
export interface BankAccountVerificationData extends BaseFormData {
  bankName?: string;
  branchName?: string;
  accountNumber?: string;
  accountType?: string;
  accountHolderName?: string;
  accountStatus?: string;
  verificationMethod?: string;
}

// Union type for all form data
export type VerificationFormData =
  | ResidenceVerificationData
  | OfficeVerificationData
  | BusinessVerificationData
  | SiteVisitData
  | TelecomVerificationData
  | ReferenceCheckData
  | DocumentVerificationData
  | EmploymentVerificationData
  | BankAccountVerificationData;

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
