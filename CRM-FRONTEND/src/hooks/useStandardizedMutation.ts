import { useMutation, useQueryClient, UseMutationOptions, MutationFunction } from '@tanstack/react-query';
import { useErrorHandling, ErrorHandlingOptions } from './useErrorHandling';
import { toast } from 'sonner';

/**
 * Standardized mutation hook that wraps useMutation with automatic error handling
 * 
 * @example
 * ```typescript
 * const deleteUserMutation = useStandardizedMutation({
 *   mutationFn: (id: string) => usersService.deleteUser(id),
 *   successMessage: 'User deleted successfully',
 *   errorContext: 'User Deletion',
 *   onSuccess: () => {
 *     queryClient.invalidateQueries({ queryKey: ['users'] });
 *   },
 * });
 * ```
 */

interface StandardizedMutationOptions<TData, TError, TVariables, TContext> 
  extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'onError'> {
  /**
   * Success message to show in toast notification
   */
  successMessage?: string;
  
  /**
   * Context for error logging (e.g., 'User Deletion', 'Case Creation')
   */
  errorContext?: string;
  
  /**
   * Fallback error message if backend doesn't provide one
   */
  errorFallbackMessage?: string;
  
  /**
   * Additional error handling options
   */
  errorOptions?: Omit<ErrorHandlingOptions, 'context' | 'fallbackMessage'>;
  
  /**
   * Custom error handler (will be called after standardized error handling)
   */
  onErrorCallback?: (error: TError) => void;
}

export function useStandardizedMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(
  options: StandardizedMutationOptions<TData, TError, TVariables, TContext>
) {
  const { handleError } = useErrorHandling();
  const queryClient = useQueryClient();
  
  const {
    successMessage,
    errorContext,
    errorFallbackMessage,
    errorOptions,
    onErrorCallback,
    onSuccess,
    ...mutationOptions
  } = options;
  
  return useMutation({
    ...mutationOptions,
    onSuccess: (data, variables, context) => {
      // Show success message if provided
      if (successMessage) {
        toast.success(successMessage);
      }

      // Call custom onSuccess handler
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      // Use standardized error handling
      handleError(error, {
        context: errorContext,
        fallbackMessage: errorFallbackMessage,
        ...errorOptions,
      });
      
      // Call custom error callback if provided
      if (onErrorCallback) {
        onErrorCallback(error);
      }
    },
  });
}

/**
 * Hook for mutations that invalidate specific query keys on success
 * 
 * @example
 * ```typescript
 * const createUserMutation = useMutationWithInvalidation({
 *   mutationFn: (data) => usersService.createUser(data),
 *   invalidateKeys: [['users'], ['dashboard']],
 *   successMessage: 'User created successfully',
 *   errorContext: 'User Creation',
 * });
 * ```
 */

interface MutationWithInvalidationOptions<TData, TError, TVariables, TContext>
  extends StandardizedMutationOptions<TData, TError, TVariables, TContext> {
  /**
   * Query keys to invalidate on success
   */
  invalidateKeys: Array<readonly unknown[]>;
}

export function useMutationWithInvalidation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(
  options: MutationWithInvalidationOptions<TData, TError, TVariables, TContext>
) {
  const queryClient = useQueryClient();
  const { invalidateKeys, onSuccess, ...restOptions } = options;
  
  return useStandardizedMutation({
    ...restOptions,
    onSuccess: (data, variables, context) => {
      // Invalidate specified query keys
      invalidateKeys.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
      
      // Call custom onSuccess handler
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
  });
}

/**
 * Type-safe wrapper for common CRUD mutations
 */

export interface CRUDMutationOptions<TData, TVariables> {
  mutationFn: MutationFunction<TData, TVariables>;
  queryKey: readonly unknown[];
  resourceName: string; // e.g., 'user', 'client', 'case'
  operation: 'create' | 'update' | 'delete';
  additionalInvalidateKeys?: Array<readonly unknown[]>;
  onSuccess?: (data: TData, variables: TVariables) => void;
}

export function useCRUDMutation<TData = unknown, TVariables = void>(
  options: CRUDMutationOptions<TData, TVariables>
) {
  const {
    mutationFn,
    queryKey,
    resourceName,
    operation,
    additionalInvalidateKeys = [],
    onSuccess,
  } = options;
  
  const operationMessages = {
    create: {
      success: `${resourceName} created successfully`,
      error: `Failed to create ${resourceName}`,
      context: `${resourceName} Creation`,
    },
    update: {
      success: `${resourceName} updated successfully`,
      error: `Failed to update ${resourceName}`,
      context: `${resourceName} Update`,
    },
    delete: {
      success: `${resourceName} deleted successfully`,
      error: `Failed to delete ${resourceName}`,
      context: `${resourceName} Deletion`,
    },
  };
  
  const messages = operationMessages[operation];
  
  return useMutationWithInvalidation({
    mutationFn,
    invalidateKeys: [queryKey, ...additionalInvalidateKeys],
    successMessage: messages.success,
    errorContext: messages.context,
    errorFallbackMessage: messages.error,
    onSuccess,
  });
}

/**
 * Example usage patterns:
 * 
 * // Basic mutation with standardized error handling
 * const mutation = useStandardizedMutation({
 *   mutationFn: (data) => api.createUser(data),
 *   successMessage: 'User created',
 *   errorContext: 'User Creation',
 * });
 * 
 * // Mutation with query invalidation
 * const mutation = useMutationWithInvalidation({
 *   mutationFn: (data) => api.createUser(data),
 *   invalidateKeys: [['users'], ['dashboard']],
 *   successMessage: 'User created',
 *   errorContext: 'User Creation',
 * });
 * 
 * // CRUD mutation (most convenient)
 * const createUserMutation = useCRUDMutation({
 *   mutationFn: (data) => usersService.createUser(data),
 *   queryKey: ['users'],
 *   resourceName: 'User',
 *   operation: 'create',
 *   additionalInvalidateKeys: [['dashboard']],
 * });
 * 
 * const updateUserMutation = useCRUDMutation({
 *   mutationFn: ({ id, data }) => usersService.updateUser(id, data),
 *   queryKey: ['users'],
 *   resourceName: 'User',
 *   operation: 'update',
 * });
 * 
 * const deleteUserMutation = useCRUDMutation({
 *   mutationFn: (id) => usersService.deleteUser(id),
 *   queryKey: ['users'],
 *   resourceName: 'User',
 *   operation: 'delete',
 * });
 */

