import { BaseEntity } from './index';

export interface Client extends Omit<BaseEntity, 'id'> {
  id: number; // Numeric ID for clients (SERIAL)
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
  products?: Product[];
  verificationTypes?: VerificationType[];
}

export interface Product extends Omit<BaseEntity, 'id'> {
  id: number; // Numeric ID for products (SERIAL)
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
  verificationTypes?: VerificationType[];
}

export interface VerificationType extends Omit<BaseEntity, 'id'> {
  id: number; // Numeric ID for verification types (SERIAL)
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateClientData {
  name: string;
  code: string;
  productIds?: number[]; // Changed from string[] to number[]
  verificationTypeIds?: number[]; // Changed from string[] to number[]
}

export interface UpdateClientData {
  name?: string;
  code?: string;
  productIds?: number[]; // Changed from string[] to number[]
  verificationTypeIds?: number[]; // Changed from string[] to number[]
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
