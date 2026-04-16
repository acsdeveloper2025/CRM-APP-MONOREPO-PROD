import { BaseEntity, PaginationQuery } from './index';
import type { VerificationType } from './client';

export interface Product extends Omit<BaseEntity, 'id'> {
  id: number; // Numeric ID for products (SERIAL)
  name: string;
  code: string;
  description?: string;
  category: string;
  clientId: string; // Keep as string as per service definition, or should this be number? Service uses string in interface but Number() in calls. Let's stick to service definition of string for now but id is number. Wait, client.ts had id:number.
  client?: {
    id: string;
    name: string;
  };
  isActive: boolean;
  pricing?: {
    basePrice: number;
    currency: string;
    pricingModel: string;
  };
  verificationType?: string[]; // Service has string[], client.ts has VerificationType[]. Let's align with service but maybe make it optional/union if needed?
  // Actually, looking at ProductAssignmentSection.tsx, it uses Product from @/types/product.
  // client.ts uses VerificationType[].
  // services/products.ts uses verificationType?: string[];
  // I will use a union or just follow the more detailed service definition for now, but maybe enhance it.
  // Let's stick to the service definition for compatibility with API, but id should be number.
  verificationTypes?: VerificationType[]; // From client.ts
  hasRates?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductData {
  name: string;
  code: string;
  description?: string;
  category?: string;
  basePrice?: number;
  currency?: string;
  pricingModel?: string;
  clientIds?: string[]; // Optional array of client IDs to associate
  verificationTypeIds?: string[]; // Optional array of verification type IDs to associate
  isActive?: boolean;
}

export type UpdateProductData = Partial<CreateProductData>;

export interface ProductListQuery extends PaginationQuery {
  clientId?: string;
  category?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
