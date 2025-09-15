// Rate Management Types with Integer IDs
// Updated for UUID to SERIAL migration

export interface RateType {
  id: number; // Changed from string (UUID) to number (SERIAL)
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRateTypeData {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateRateTypeData extends Partial<CreateRateTypeData> {}

export interface RateTypeAssignment {
  id: number; // Changed from string (UUID) to number (BIGSERIAL)
  clientId: number; // Changed from string (UUID) to number (SERIAL)
  productId: number; // Changed from string (UUID) to number (SERIAL)
  verificationTypeId: number; // Changed from string (UUID) to number (SERIAL)
  rateTypeId: number; // Changed from string (UUID) to number (SERIAL)
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Populated fields for display
  clientName?: string;
  productName?: string;
  verificationTypeName?: string;
  rateTypeName?: string;
}

export interface CreateRateTypeAssignmentData {
  clientId: number;
  productId: number;
  verificationTypeId: number;
  rateTypeIds: number[]; // Array of rate type IDs to assign
}

export interface Rate {
  id: number; // Changed from string (UUID) to number (BIGSERIAL)
  clientId: number; // Changed from string (UUID) to number (SERIAL)
  productId: number; // Changed from string (UUID) to number (SERIAL)
  verificationTypeId: number; // Changed from string (UUID) to number (SERIAL)
  rateTypeId: number; // Changed from string (UUID) to number (SERIAL)
  amount: number;
  currency: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
  // Populated fields for display
  clientName?: string;
  productName?: string;
  verificationTypeName?: string;
  rateTypeName?: string;
}

export interface CreateRateData {
  clientId: number;
  productId: number;
  verificationTypeId: number;
  rateTypeId: number;
  amount: number;
  currency: string;
  effectiveFrom?: string;
}

export interface UpdateRateData extends Partial<Omit<CreateRateData, 'clientId' | 'productId' | 'verificationTypeId' | 'rateTypeId'>> {}

export interface RateHistory {
  id: number; // Changed from string (UUID) to number (BIGSERIAL)
  rateId: number; // Changed from string (UUID) to number (BIGSERIAL)
  oldAmount: number;
  newAmount: number;
  changeReason?: string;
  changedAt: string;
  changedBy?: string; // User ID (still UUID)
}

// Supporting entity types with updated IDs
export interface Client {
  id: number; // Changed from string (UUID) to number (SERIAL)
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number; // Changed from string (UUID) to number (SERIAL)
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationType {
  id: number; // Changed from string (UUID) to number (SERIAL)
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Query interfaces
export interface RateTypeListQuery {
  search?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'description' | 'isActive' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface RateTypeAssignmentQuery {
  clientId?: number;
  productId?: number;
  verificationTypeId?: number;
  rateTypeId?: number;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface RateQuery {
  clientId?: number;
  productId?: number;
  verificationTypeId?: number;
  rateTypeId?: number;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'amount' | 'currency' | 'effectiveFrom' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// Statistics interfaces
export interface RateTypeStats {
  total: number;
  active: number;
  inactive: number;
  byName: Record<string, number>;
}

export interface RateStats {
  total: number;
  active: number;
  inactive: number;
  averageAmount: number;
  totalAmount: number;
  byCurrency: Record<string, number>;
  byRateType: Record<string, number>;
}

// Assignment with rate type details
export interface RateTypeAssignmentWithDetails extends RateTypeAssignment {
  rateTypes: RateType[];
  hasRates: boolean;
}

// Rate with assignment details
export interface RateWithDetails extends Rate {
  assignment: RateTypeAssignment;
  history: RateHistory[];
}

// Combined view for rate management
export interface RateManagementView {
  id: number;
  clientId: number;
  clientName: string;
  clientCode: string;
  productId: number;
  productName: string;
  productCode: string;
  verificationTypeId: number;
  verificationTypeName: string;
  verificationTypeCode: string;
  rateTypeId: number;
  rateTypeName: string;
  amount?: number;
  currency?: string;
  isActive: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

// Available rate types for assignment
export interface AvailableRateType extends RateType {
  isAssigned: boolean;
  hasRate: boolean;
  currentAmount?: number;
  currentCurrency?: string;
}

// Available rate types for case assignment
export interface AvailableRateTypeForCase extends RateType {
  amount?: number;
  currency?: string;
  hasRate: boolean;
}
