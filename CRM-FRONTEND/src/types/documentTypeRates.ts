// Document Type Rates Types
// Simpler than verification type rates - no rate type dependency, no pincode dependency

export interface DocumentTypeRate {
  id: number;
  clientId: number;
  productId: number;
  documentTypeId: number;
  amount: number;
  currency: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
  // Populated fields for display
  clientName?: string;
  clientCode?: string;
  productName?: string;
  productCode?: string;
  documentTypeName?: string;
  documentTypeCode?: string;
  documentTypeCategory?: string;
}

export interface CreateDocumentTypeRateData {
  clientId: number;
  productId: number;
  documentTypeId: number;
  amount: number;
  currency?: string;
}

export type UpdateDocumentTypeRateData = Partial<
  Omit<CreateDocumentTypeRateData, 'clientId' | 'productId' | 'documentTypeId'>
>;

// Query interfaces
export interface DocumentTypeRateQuery {
  clientId?: number;
  productId?: number;
  documentTypeId?: number;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'clientName' | 'productName' | 'documentTypeName' | 'amount' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// Statistics interface
export interface DocumentTypeRateStats {
  totalRates: number;
  totalClients: number;
  totalProducts: number;
  totalDocumentTypes: number;
  averageRate: number;
  minRate: number;
  maxRate: number;
}

// Document Type interface (for reference)
export interface DocumentType {
  id: number;
  name: string;
  code: string;
  description?: string;
  category?: string;
  isGovernmentIssued?: boolean;
  requiresVerification?: boolean;
  validityPeriodMonths?: number;
  formatPattern?: string;
  minLength?: number;
  maxLength?: number;
  isActive: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}
