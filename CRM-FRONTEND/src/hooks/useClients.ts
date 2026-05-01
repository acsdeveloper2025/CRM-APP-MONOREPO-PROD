import { useQuery } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { clientsService } from '@/services/clients';
import type {
  CreateClientData,
  UpdateClientData,
  CreateProductData,
  UpdateProductData,
  CreateVerificationTypeData,
  UpdateVerificationTypeData,
} from '@/types/client';
import type { PaginationQuery } from '@/types/api';

// Query keys
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters: PaginationQuery) => [...clientKeys.lists(), filters] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...clientKeys.details(), id] as const,
};

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: PaginationQuery) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...productKeys.details(), id] as const,
  byClient: (clientId: string | number) => [...productKeys.all, 'by-client', clientId] as const,
};

export const verificationTypeKeys = {
  all: ['verification-types'] as const,
  lists: () => [...verificationTypeKeys.all, 'list'] as const,
  list: (filters: PaginationQuery) => [...verificationTypeKeys.lists(), filters] as const,
  details: () => [...verificationTypeKeys.all, 'detail'] as const,
  detail: (id: string) => [...verificationTypeKeys.details(), id] as const,
  byClient: (clientId: string) => [...verificationTypeKeys.all, 'by-client', clientId] as const,
};

// Client queries
interface UseClientsOptions {
  enabled?: boolean;
}

export const useClients = (query: PaginationQuery = {}, options?: UseClientsOptions) => {
  return useQuery({
    queryKey: clientKeys.list(query),
    queryFn: () => clientsService.getClients(query),
    enabled: options?.enabled ?? true,
  });
};

export const useClient = (id: string) => {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => clientsService.getClientById(Number(id)),
    enabled: !!id,
  });
};

// Product queries
export const useProducts = (query: PaginationQuery = {}) => {
  return useQuery({
    queryKey: productKeys.list(query),
    queryFn: () => clientsService.getProducts(query),
  });
};

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => clientsService.getProductById(Number(id)),
    enabled: !!id,
  });
};

export const useProductsByClient = (clientId?: string) => {
  return useQuery({
    queryKey: productKeys.byClient(clientId || ''),
    queryFn: () => clientsService.getProductsByClient(Number(clientId)),
    enabled: !!clientId,
  });
};

// Verification type queries
export const useVerificationTypes = (query: PaginationQuery = {}) => {
  return useQuery({
    queryKey: verificationTypeKeys.list(query),
    queryFn: () => clientsService.getVerificationTypes(query),
  });
};

export const useVerificationType = (id: string) => {
  return useQuery({
    queryKey: verificationTypeKeys.detail(id),
    queryFn: () => clientsService.getVerificationTypeById(Number(id)),
    enabled: !!id,
  });
};

export const useVerificationTypesByClient = (clientId: string) => {
  return useQuery({
    queryKey: verificationTypeKeys.byClient(clientId),
    queryFn: () => clientsService.getVerificationTypesByClient(Number(clientId)),
    enabled: !!clientId,
  });
};

// Client mutations
export const useCreateClient = () => {
  return useMutationWithInvalidation({
    mutationFn: (data: CreateClientData) => clientsService.createClient(data),
    invalidateKeys: [clientKeys.all, ['dashboard']],
    successMessage: 'Client created successfully',
    errorContext: 'Client Creation',
    errorFallbackMessage: 'Failed to create client',
  });
};

export const useUpdateClient = () => {
  return useMutationWithInvalidation<unknown, unknown, { id: string; data: UpdateClientData }>({
    mutationFn: ({ id, data }) => clientsService.updateClient(Number(id), data),
    invalidateKeys: [clientKeys.all, ['dashboard']],
    successMessage: 'Client updated successfully',
    errorContext: 'Client Update',
    errorFallbackMessage: 'Failed to update client',
  });
};

export const useDeleteClient = () => {
  return useMutationWithInvalidation({
    mutationFn: (id: string) => clientsService.deleteClient(Number(id)),
    invalidateKeys: [clientKeys.all, ['dashboard']],
    successMessage: 'Client deleted successfully',
    errorContext: 'Client Deletion',
    errorFallbackMessage: 'Failed to delete client',
  });
};

// Product mutations
export const useCreateProduct = () => {
  return useMutationWithInvalidation({
    mutationFn: (data: CreateProductData) => clientsService.createProduct(data),
    invalidateKeys: [productKeys.all, clientKeys.all],
    successMessage: 'Product created successfully',
    errorContext: 'Product Creation',
    errorFallbackMessage: 'Failed to create product',
  });
};

export const useUpdateProduct = () => {
  return useMutationWithInvalidation<unknown, unknown, { id: string; data: UpdateProductData }>({
    mutationFn: ({ id, data }) => clientsService.updateProduct(Number(id), data),
    invalidateKeys: [productKeys.all],
    successMessage: 'Product updated successfully',
    errorContext: 'Product Update',
    errorFallbackMessage: 'Failed to update product',
  });
};

export const useDeleteProduct = () => {
  return useMutationWithInvalidation({
    mutationFn: (id: string) => clientsService.deleteProduct(Number(id)),
    invalidateKeys: [productKeys.all],
    successMessage: 'Product deleted successfully',
    errorContext: 'Product Deletion',
    errorFallbackMessage: 'Failed to delete product',
  });
};

// Verification type mutations
export const useCreateVerificationType = () => {
  return useMutationWithInvalidation({
    mutationFn: (data: CreateVerificationTypeData) => clientsService.createVerificationType(data),
    invalidateKeys: [verificationTypeKeys.all],
    successMessage: 'Verification type created successfully',
    errorContext: 'Verification Type Creation',
    errorFallbackMessage: 'Failed to create verification type',
  });
};

export const useUpdateVerificationType = () => {
  return useMutationWithInvalidation<
    unknown,
    unknown,
    { id: string; data: UpdateVerificationTypeData }
  >({
    mutationFn: ({ id, data }) => clientsService.updateVerificationType(Number(id), data),
    invalidateKeys: [verificationTypeKeys.all],
    successMessage: 'Verification type updated successfully',
    errorContext: 'Verification Type Update',
    errorFallbackMessage: 'Failed to update verification type',
  });
};

export const useDeleteVerificationType = () => {
  return useMutationWithInvalidation({
    mutationFn: (id: string) => clientsService.deleteVerificationType(Number(id)),
    invalidateKeys: [verificationTypeKeys.all],
    successMessage: 'Verification type deleted successfully',
    errorContext: 'Verification Type Deletion',
    errorFallbackMessage: 'Failed to delete verification type',
  });
};
