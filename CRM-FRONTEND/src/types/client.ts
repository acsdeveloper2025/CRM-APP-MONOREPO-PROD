import { BaseEntity } from './index';
import { DocumentType } from './documentType';
import type { Product } from './product';

export type { DocumentType, Product };

export interface Client extends Omit<BaseEntity, 'id'> {
  id: number; // Numeric ID for clients (SERIAL)
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
  // Branding columns used by the PDF report template feature.
  logoUrl?: string | null;
  stampUrl?: string | null;
  primaryColor?: string | null;
  headerColor?: string | null;
  products?: Product[];
  verificationTypes?: VerificationType[];
  documentTypes?: DocumentType[];
}

export interface VerificationType extends Omit<BaseEntity, 'id'> {
  id: number; // Numeric ID for verification types (SERIAL)
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
  hasRates?: boolean;
}

export interface ProductMappingPayload {
  productId: number;
  verificationTypeIds: number[];
  documentTypeIds: number[];
}

export interface CreateClientData {
  name: string;
  code: string;
  productIds?: number[];
  verificationTypeIds?: number[];
  documentTypeIds?: number[];
  /** Per-(client,product) mapping. New canonical shape; flat lists kept for backward compat. */
  productMappings?: ProductMappingPayload[];
}

export interface UpdateClientData {
  name?: string;
  code?: string;
  productIds?: number[];
  verificationTypeIds?: number[];
  documentTypeIds?: number[];
  /** Per-(client,product) mapping. New canonical shape; flat lists kept for backward compat. */
  productMappings?: ProductMappingPayload[];
  primaryColor?: string | null;
  headerColor?: string | null;
}

export interface CreateProductData {
  name: string;
  code: string;
}

export interface UpdateProductData {
  name?: string;
  code?: string;
}

export interface CreateVerificationTypeData {
  name: string;
  code: string;
}

export interface UpdateVerificationTypeData {
  name?: string;
  code?: string;
}
