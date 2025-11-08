import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { useErrorHandling, ErrorHandlingOptions } from './useErrorHandling';

/**
 * Standardized query hook that wraps useQuery with automatic error handling
 * 
 * @example
 * ```typescript
 * const { data, isLoading, error } = useStandardizedQuery({
 *   queryKey: ['users', userId],
 *   queryFn: () => usersService.getUserById(userId),
 *   errorContext: 'Fetching User',
 *   errorFallbackMessage: 'Failed to load user data',
 *   enabled: !!userId,
 * });
 * ```
 */

interface StandardizedQueryOptions<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> extends Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'onError'> {
  /**
   * Context for error logging (e.g., 'Fetching Users', 'Loading Dashboard')
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
  
  /**
   * Whether to show toast notification on error (default: true)
   */
  showErrorToast?: boolean;
}

export function useStandardizedQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: StandardizedQueryOptions<TQueryFnData, TError, TData, TQueryKey>
) {
  const { handleError } = useErrorHandling();
  
  const {
    errorContext,
    errorFallbackMessage,
    errorOptions,
    onErrorCallback,
    showErrorToast = true,
    ...queryOptions
  } = options;
  
  const query = useQuery({
    ...queryOptions,
  });
  
  // Handle errors when they occur
  if (query.error && showErrorToast) {
    handleError(query.error, {
      context: errorContext,
      fallbackMessage: errorFallbackMessage,
      showToast: showErrorToast,
      ...errorOptions,
    });
    
    // Call custom error callback if provided
    if (onErrorCallback) {
      onErrorCallback(query.error);
    }
  }
  
  return query;
}

/**
 * Hook for queries with retry logic
 * 
 * @example
 * ```typescript
 * const { data, isLoading } = useQueryWithRetry({
 *   queryKey: ['critical-data'],
 *   queryFn: () => api.getCriticalData(),
 *   errorContext: 'Loading Critical Data',
 *   retryCount: 3,
 *   retryDelay: 1000,
 * });
 * ```
 */

interface QueryWithRetryOptions<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> extends StandardizedQueryOptions<TQueryFnData, TError, TData, TQueryKey> {
  /**
   * Number of retry attempts (default: 3)
   */
  retryCount?: number;
  
  /**
   * Delay between retries in milliseconds (default: 1000)
   */
  retryDelay?: number;
}

export function useQueryWithRetry<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: QueryWithRetryOptions<TQueryFnData, TError, TData, TQueryKey>
) {
  const {
    retryCount = 3,
    retryDelay = 1000,
    ...restOptions
  } = options;
  
  return useStandardizedQuery({
    ...restOptions,
    retry: retryCount,
    retryDelay: (attemptIndex) => Math.min(retryDelay * (attemptIndex + 1), 10000),
  });
}

/**
 * Hook for paginated queries with standardized error handling
 * 
 * @example
 * ```typescript
 * const { data, isLoading } = usePaginatedQuery({
 *   queryKey: ['users', page, limit],
 *   queryFn: () => usersService.getUsers({ page, limit }),
 *   errorContext: 'Loading Users',
 *   page,
 *   limit,
 * });
 * ```
 */

interface PaginatedQueryOptions<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> extends StandardizedQueryOptions<TQueryFnData, TError, TData, TQueryKey> {
  /**
   * Current page number
   */
  page?: number;
  
  /**
   * Items per page
   */
  limit?: number;
}

export function usePaginatedQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: PaginatedQueryOptions<TQueryFnData, TError, TData, TQueryKey>
) {
  const { page: _page, limit: _limit, ...restOptions } = options;

  return useStandardizedQuery({
    ...restOptions,
    // Keep previous data while fetching new page
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook for queries that depend on other data
 * 
 * @example
 * ```typescript
 * const { data: user } = useQuery({ queryKey: ['user'], queryFn: getUser });
 * 
 * const { data: userDetails } = useDependentQuery({
 *   queryKey: ['user-details', user?.id],
 *   queryFn: () => getUserDetails(user!.id),
 *   dependsOn: user,
 *   errorContext: 'Loading User Details',
 * });
 * ```
 */

interface DependentQueryOptions<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> extends StandardizedQueryOptions<TQueryFnData, TError, TData, TQueryKey> {
  /**
   * Data that this query depends on. Query will only run if this is truthy.
   */
  dependsOn: unknown;
}

export function useDependentQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: DependentQueryOptions<TQueryFnData, TError, TData, TQueryKey>
) {
  const { dependsOn, enabled, ...restOptions } = options;
  
  return useStandardizedQuery({
    ...restOptions,
    enabled: !!dependsOn && (enabled !== undefined ? enabled : true),
  });
}

/**
 * Example usage patterns:
 * 
 * // Basic query with error handling
 * const { data, isLoading } = useStandardizedQuery({
 *   queryKey: ['users'],
 *   queryFn: () => usersService.getUsers(),
 *   errorContext: 'Loading Users',
 *   errorFallbackMessage: 'Failed to load users',
 * });
 * 
 * // Query with retry logic
 * const { data } = useQueryWithRetry({
 *   queryKey: ['critical-data'],
 *   queryFn: () => api.getCriticalData(),
 *   errorContext: 'Loading Critical Data',
 *   retryCount: 5,
 * });
 * 
 * // Paginated query
 * const { data } = usePaginatedQuery({
 *   queryKey: ['users', page, limit],
 *   queryFn: () => usersService.getUsers({ page, limit }),
 *   errorContext: 'Loading Users',
 *   page,
 *   limit,
 * });
 * 
 * // Dependent query
 * const { data: user } = useQuery({ queryKey: ['user'], queryFn: getUser });
 * const { data: details } = useDependentQuery({
 *   queryKey: ['user-details', user?.id],
 *   queryFn: () => getUserDetails(user!.id),
 *   dependsOn: user,
 *   errorContext: 'Loading User Details',
 * });
 */

