// Document Type Rates Types
// Simpler than verification type rates - no rate type dependency, no pincode dependency

export interface KYCRate {
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

export interface CreateKYCRateData {
  clientId: number;
  productId: number;
  documentTypeId: number;
  amount: number;
  currency?: string;
}

export type UpdateKYCRateData = Partial<
  Omit<CreateKYCRateData, 'clientId' | 'productId' | 'documentTypeId'>
>;

// Query interfaces
export interface KYCRateQuery {
  clientId?: number;
  productId?: number;
  documentTypeId?: number;
  // 'all' sent verbatim so URL/cache key stays stable; BE treats it as no-filter.
  isActive?: boolean | 'true' | 'false' | 'all';
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'clientName' | 'productName' | 'documentTypeName' | 'amount' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// Statistics interface — Page 3 sweep (2026-05-22) added canonical
// total/active/inactive + recentlyAddedCount; legacy keys kept for downstream.
export interface KYCRateStats {
  total: number;
  active: number;
  inactive: number;
  recentlyAddedCount: number;
  averageRate: number | string;
  // Legacy fields kept for backward compat with the rate-management page facade.
  totalRates?: number;
  totalClients?: number;
  totalProducts?: number;
  totalDocumentTypes?: number;
  minRate?: number | string;
  maxRate?: number | string;
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
