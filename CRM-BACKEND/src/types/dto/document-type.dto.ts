/**
 * Document Type Data Transfer Objects
 * Shared types for document type management
 */

export interface DocumentTypeRules {
  isRequired: boolean;
  priority: number;
  validationRules?: ValidationRule[];
  allowedFormats?: string[];
  maxFileSize?: number;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'pattern' | 'range' | 'custom';
  value?: string | number;
  message: string;
}

export interface ClientSpecificRules extends DocumentTypeRules {
  clientId: number;
  overrideDefaults: boolean;
}

export interface ProductSpecificRules extends DocumentTypeRules {
  productId: number;
  applicableVerificationTypes: number[];
}

export interface DocumentTypeDetails {
  documentType: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  verificationStatus?: string;
  additionalFields?: Record<string, string | number | boolean>;
}
