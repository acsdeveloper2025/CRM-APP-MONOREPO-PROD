import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiResponse } from '@/types/api';
import { triggerLogout, triggerActiveScopeInvalid } from '@/utils/events';
import { STORAGE_KEYS, SYNC_KEYS } from '@/types/constants';
import { logger } from '@/utils/logger';

// Queue to hold requests while token is refreshing
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const getErrorCode = (error: unknown): string | undefined => {
  const data = (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data;
  return data?.error?.code;
};

const shouldAttemptTokenRefresh = (status?: number, errorCode?: string): boolean => {
  if (status === 401) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  return ['INVALID_TOKEN', 'TOKEN_EXPIRED', 'UNAUTHORIZED'].includes(errorCode || '');
};

const shouldForceLogoutOnRefreshFailure = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;

  if (!status) {
    return false;
  }

  return status === 400 || status === 401 || status === 403;
};

interface RequestMetrics {
  url: string;
  method: string;
  duration: number;
  status: number;
  cached: boolean;
  timestamp: number;
}

interface RetryConfig {
  retries?: number;
  retryDelay?: number;
  retryCondition?: (error: unknown) => boolean;
}

interface AugmentedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: { startTime: number };
}

// Stamp at the wrapper level (not the request interceptor) so the SAME key
// is reused across executeWithRetry's 5xx-backoff loop. A new key per retry
// would defeat server-side dedupe.
const stampIdempotencyKey = (config?: AxiosRequestConfig): AxiosRequestConfig => {
  const cfg = config ?? {};
  cfg.headers = cfg.headers ?? {};
  if (!cfg.headers['Idempotency-Key']) {
    cfg.headers['Idempotency-Key'] =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return cfg;
};

/**
 * P18.H01: shared scope-header injector used by BOTH the axios request
 * interceptor and `safeFetch`. Previously the axios path stamped
 * `X-Active-Client-Id` / `X-Active-Product-Id` from sessionStorage but
 * `safeFetch` built Headers from scratch and silently bypassed the
 * scope lock — three blob-fetch consumers (CaseAttachmentsSection,
 * VerificationImages, services/verificationImages.ts) read attachment
 * blobs without the lock applying. Funnel both paths through one
 * helper so future additions can't regress this.
 *
 * The setter callback abstracts away the underlying API shape so we
 * can support `AxiosRequestConfig.headers[name] = value` AND
 * `Headers.set(name, value)` from the same source of truth.
 */
const applyActiveScopeHeaders = (setHeader: (name: string, value: string) => void): void => {
  try {
    const rawScope = sessionStorage.getItem('acs.activeScope');
    if (!rawScope) {
      return;
    }
    const parsed = JSON.parse(rawScope) as {
      selectedClientId?: number | null;
      selectedProductId?: number | null;
    };
    if (typeof parsed.selectedClientId === 'number' && parsed.selectedClientId > 0) {
      setHeader('X-Active-Client-Id', String(parsed.selectedClientId));
    }
    if (typeof parsed.selectedProductId === 'number' && parsed.selectedProductId > 0) {
      setHeader('X-Active-Product-Id', String(parsed.selectedProductId));
    }
  } catch {
    // Malformed sessionStorage entry — ignore and proceed without
    // narrowing. Backend baseline scope applies.
  }
};

class ApiService {
  private api: AxiosInstance;
  private activeRequestCount = 0;
  private accessToken: string | null = null;

  private requestMetrics: RequestMetrics[] = [];
  private maxMetricsSize = 1000;

  constructor() {
    // Smart URL selection based on environment
    const baseURL = this.getOptimalApiUrl();
    logger.info('🔗 API Service initialized with URL:', baseURL);

    this.api = axios.create({
      baseURL,
      timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,
      withCredentials: true, // Enable cookies for cross-site requests
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Tokens never live in localStorage (XSS exfiltration hazard).
    // Defensive wipe in case a stale build left either key behind.
    if (localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) !== null) {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
    if (localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) !== null) {
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }

    this.setupInterceptors();
  }

  public hasActiveRequests(): boolean {
    return this.activeRequestCount > 0;
  }

  private incrementActiveRequests() {
    this.activeRequestCount++;
  }

  private decrementActiveRequests() {
    if (this.activeRequestCount > 0) {
      this.activeRequestCount--;
    }
  }

  private getOptimalApiUrl(): string {
    const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

    if (configuredBaseUrl) {
      try {
        const parsed = new URL(configuredBaseUrl, window.location.origin);
        const isLocalhostTarget = ['localhost', '127.0.0.1'].includes(parsed.hostname);

        if (!import.meta.env.DEV && isLocalhostTarget) {
          const sameOriginFallback = `${window.location.origin}/api`;
          logger.warn(
            '⚠️ Ignoring localhost API base URL in production build. Falling back to same-origin API:',
            sameOriginFallback
          );
          return sameOriginFallback;
        }

        return parsed.toString().replace(/\/$/, '');
      } catch {
        if (!import.meta.env.DEV) {
          const sameOriginFallback = `${window.location.origin}/api`;
          logger.warn(
            '⚠️ Invalid VITE_API_BASE_URL in production build. Falling back to same-origin API:',
            sameOriginFallback
          );
          return sameOriginFallback;
        }
      }
    }

    if (!import.meta.env.DEV) {
      const sameOriginFallback = `${window.location.origin}/api`;
      logger.warn(
        '⚠️ VITE_API_BASE_URL is missing in production build. Falling back to same-origin API:',
        sameOriginFallback
      );
      return sameOriginFallback;
    }

    throw new Error(
      '❌ CRITICAL ERROR: VITE_API_BASE_URL is not defined in environment variables!'
    );
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        this.incrementActiveRequests();
        const token = this.getAccessToken();

        // Add request timestamp for metrics
        (config as AugmentedAxiosRequestConfig).metadata = { startTime: Date.now() };

        // Special handling for refresh endpoint: NO Authorization header needed
        // (the HttpOnly cookie carries the refresh token). We also stamp a
        // custom X-Requested-With header so the backend's refreshCsrfGuard
        // can distinguish a legitimate same-origin fetch from a cross-site
        // attacker riding the cookie — cross-origin simple requests cannot
        // add custom headers without a preflight.
        if (config.url?.includes('/auth/refresh-token')) {
          delete config.headers.Authorization;
          config.headers['X-Requested-With'] = 'fetch';
        } else if (token) {
          // Normal requests: Use Access Token
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Active scope headers (project_scope_control_audit_2026_05_14.md
        // P3). Backend treats these as HINTS and validates each value
        // against the user's assignedClientIds / assignedProductIds —
        // see middleware/activeScope.ts. Sourced from sessionStorage so
        // the interceptor stays decoupled from React state.
        applyActiveScopeHeaders((name, value) => {
          config.headers[name] = value;
        });

        return config;
      },
      (error) => {
        this.decrementActiveRequests();
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors and token refresh
    this.api.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        this.decrementActiveRequests();
        this.recordMetrics(response);
        return response;
      },
      async (error) => {
        this.decrementActiveRequests();
        this.recordMetrics(error.response, true);

        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        const status = error.response?.status;
        const errorCode = getErrorCode(error);

        // P8 — active-scope reactive recovery
        // (project_scope_control_audit_2026_05_14.md). If the backend
        // rejects the request because the active scope header points
        // at a client/product the user no longer has access to
        // (typically after an admin revocation that we discovered via
        // 403 rather than the WS permission_changed event), drop the
        // persisted scope and notify the React tree to clear local
        // state. The original error still propagates so the caller's
        // error UI runs unchanged.
        if (
          status === 403 &&
          (errorCode === 'INVALID_ACTIVE_SCOPE_CLIENT' ||
            errorCode === 'INVALID_ACTIVE_SCOPE_PRODUCT')
        ) {
          try {
            sessionStorage.removeItem('acs.activeScope');
          } catch {
            // ignore — best-effort
          }
          triggerActiveScopeInvalid({
            code: errorCode as 'INVALID_ACTIVE_SCOPE_CLIENT' | 'INVALID_ACTIVE_SCOPE_PRODUCT',
          });
          return Promise.reject(error);
        }

        // Refresh only for real auth expiry cases, not generic permission/business 403s.
        if (shouldAttemptTokenRefresh(status, errorCode) && !originalRequest._retry) {
          // Prevent infinite loops: sensitive endpoints shouldn't trigger refresh logic
          const url = originalRequest.url || '';
          if (
            url.includes('/auth/login') ||
            url.includes('/auth/refresh-token') ||
            url.includes('/auth/logout')
          ) {
            return Promise.reject(error);
          }

          if (isRefreshing) {
            // Queue the request if a refresh is already in progress
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                // We need to re-increment because this is a "new" attempt in a way,
                // but strictly speaking, the interceptor chain might handle it.
                // However, directly calling this.api(originalRequest) triggers interceptors again?
                // Yes, axios(config) triggers interceptors.
                // So we don't need to manually increment here if we call this.api()
                return this.api(originalRequest);
              })
              .catch((err) => {
                return Promise.reject(err);
              });
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            // Refresh token is an HttpOnly cookie scoped to
            // /api/auth/refresh-token and sent automatically because
            // withCredentials: true is set on the axios instance.
            this.incrementActiveRequests();
            let response;
            try {
              response = await axios.post(
                `${this.getOptimalApiUrl()}/auth/refresh-token`,
                {},
                {
                  withCredentials: true,
                  headers: {
                    'Content-Type': 'application/json',
                    // X-Requested-With: required by refreshCsrfGuard —
                    // this axios call bypasses our interceptor, so the
                    // header must be set here explicitly.
                    'X-Requested-With': 'fetch',
                  },
                }
              );
            } finally {
              this.decrementActiveRequests();
            }

            const data = response.data;
            const accessToken =
              data.data?.accessToken || data.data?.tokens?.accessToken || data.accessToken;

            if (!accessToken) {
              throw new Error('Invalid refresh response');
            }

            logger.warn('✅ Token refresh successful');

            this.setAccessToken(accessToken);
            this.api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

            processQueue(null, accessToken);
            isRefreshing = false;

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            logger.error('❌ Token refresh failed:', refreshError);
            isRefreshing = false;
            processQueue(refreshError as Error, null);

            if (shouldForceLogoutOnRefreshFailure(refreshError)) {
              localStorage.setItem(SYNC_KEYS.FORCE_LOGOUT, Date.now().toString());
              this.setAccessToken(null);
              localStorage.removeItem(STORAGE_KEYS.USER_DATA);
              triggerLogout('Your session has expired. Please login again.');
            }

            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // -- Enhanced Features Implementation --

  private recordMetrics(response: AxiosResponse | undefined, _isError = false): void {
    if (!response || !(response.config as AugmentedAxiosRequestConfig)?.metadata) {
      return;
    }

    const duration =
      Date.now() - ((response.config as AugmentedAxiosRequestConfig).metadata?.startTime || 0);
    const metric: RequestMetrics = {
      url: response.config.url || '',
      method: response.config.method?.toUpperCase() || '',
      duration,
      status: response.status || 0,
      cached: response.headers['x-cache'] === 'HIT',
      timestamp: Date.now(),
    };

    this.requestMetrics.push(metric);

    // Keep only recent metrics
    if (this.requestMetrics.length > this.maxMetricsSize) {
      this.requestMetrics = this.requestMetrics.slice(-this.maxMetricsSize);
    }
  }

  public getMetrics() {
    return this.requestMetrics;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async executeWithRetry<T>(
    operation: () => Promise<AxiosResponse<T>>,
    retryConfig?: RetryConfig
  ): Promise<AxiosResponse<T>> {
    const config = {
      retries: 3,
      retryDelay: 1000,
      retryCondition: (error: unknown) => {
        // Retry on network errors and 5xx server errors
        const err = error as { response?: { status: number } };
        return (
          !err.response ||
          (err.response.status !== undefined &&
            err.response.status >= 500 &&
            err.response.status < 600)
        );
      },
      ...retryConfig,
    };

    let lastError: unknown;

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === config.retries || !config.retryCondition(error)) {
          throw error;
        }

        // Exponential backoff
        const delay = config.retryDelay * Math.pow(2, attempt);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  // Raw methods that return full AxiosResponse (callers needing headers/status,
  // not just the body). 2026-04-27: enterpriseApiClient.ts deleted as dead code.
  async getRaw<T>(
    url: string,
    params?: unknown,
    config?: AxiosRequestConfig & {
      retryConfig?: RetryConfig;
    }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};

    const isBinary =
      axiosConfig.responseType === 'blob' || axiosConfig.responseType === 'arraybuffer';

    const finalConfig: AxiosRequestConfig = { params, ...axiosConfig };

    if (isBinary) {
      finalConfig.transformResponse = [(data) => data];
      finalConfig.headers = {
        ...finalConfig.headers,
        Accept: '*/*',
      };
      if (finalConfig.headers['Content-Type'] === 'application/json') {
        delete finalConfig.headers['Content-Type'];
      }
    }

    return this.executeWithRetry(() => this.api.get<T>(url, finalConfig), retryConfig);
  }

  async postRaw<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};

    // Binary handling
    const isBinary =
      axiosConfig.responseType === 'blob' || axiosConfig.responseType === 'arraybuffer';
    if (isBinary) {
      axiosConfig.transformResponse = [(data) => data];
      axiosConfig.headers = {
        Accept: '*/*',
        ...axiosConfig.headers,
      };
    }

    // 2026-05-05: FormData uploads must NOT inherit the instance default
    // `Content-Type: application/json` — multer on the backend rejects
    // (400 "File is required") because it never sees a multipart body.
    // Setting Content-Type to undefined tells axios to compute the right
    // multipart/form-data boundary from the FormData itself. Symptom that
    // hit KYC + every other FormData uploader before this fix.
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      axiosConfig.headers = {
        ...axiosConfig.headers,
        'Content-Type': undefined,
      } as AxiosRequestConfig['headers'];
    }

    const stampedConfig = stampIdempotencyKey(axiosConfig);
    // T1-6 (audit 2026-05-17): POST is non-idempotent — auto-retry on
    // 5xx duplicates writes. Default to retries=0; caller can opt-in
    // explicitly via retryConfig if the endpoint is known-idempotent
    // (e.g. POST that wraps an UPSERT). Combined with BE deadlock-retry
    // 6× the prior 3× retry default was a 24× write amplification.
    return this.executeWithRetry(
      () => this.api.post<T>(url, data, stampedConfig),
      retryConfig ?? { retries: 0 }
    );
  }

  async putRaw<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      axiosConfig.headers = {
        ...axiosConfig.headers,
        'Content-Type': undefined,
      } as AxiosRequestConfig['headers'];
    }
    const stampedConfig = stampIdempotencyKey(axiosConfig);
    return this.executeWithRetry(() => this.api.put<T>(url, data, stampedConfig), retryConfig);
  }

  async deleteRaw<T>(
    url: string,
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};
    const stampedConfig = stampIdempotencyKey(axiosConfig);
    return this.executeWithRetry(() => this.api.delete<T>(url, stampedConfig), retryConfig);
  }

  async patchRaw<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<AxiosResponse<T>> {
    const { retryConfig, ...axiosConfig } = config || {};
    const stampedConfig = stampIdempotencyKey(axiosConfig);
    // T1-6: PATCH is non-idempotent in the general case (counter
    // increments, append-to-array). Same retries=0 default as POST.
    return this.executeWithRetry(
      () => this.api.patch<T>(url, data, stampedConfig),
      retryConfig ?? { retries: 0 }
    );
  }

  // Standard convenience methods returning just data
  async get<T>(
    url: string,
    params?: unknown,
    config?: AxiosRequestConfig & {
      retryConfig?: RetryConfig;
    }
  ): Promise<ApiResponse<T>> {
    const response = await this.getRaw<ApiResponse<T>>(url, params, config);
    return response.data;
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<ApiResponse<T>> {
    const response = await this.postRaw<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<ApiResponse<T>> {
    const response = await this.putRaw<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async delete<T>(
    url: string,
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<ApiResponse<T>> {
    const response = await this.deleteRaw<ApiResponse<T>>(url, config);
    return response.data;
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig & { retryConfig?: RetryConfig }
  ): Promise<ApiResponse<T>> {
    const response = await this.patchRaw<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  getBaseUrl(): string {
    return this.api.defaults.baseURL || '';
  }

  /**
   * Returns the root URL of the server (without /api suffix)
   * Useful for serving static assets like images
   */
  getRootUrl(): string {
    return this.getBaseUrl().replace(/\/api\/?$/, '');
  }

  setAccessToken(token: string | null): void {
    // Phase E5 hardening: access token lives in memory only. Never
    // persist it to localStorage — see constructor comment for why.
    // We still clear any stray legacy value defensively in case an
    // older tab wrote to storage before this build loaded.
    this.accessToken = token;
    if (localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) !== null) {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
    if (token) {
      this.api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete this.api.defaults.headers.common.Authorization;
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  async getBlob(url: string, params?: unknown): Promise<Blob> {
    const response = await this.api.get(url, {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Safe fetch wrapper that handles authentication and token refresh.
   * Use this instead of raw fetch() calls.
   */
  async safeFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    this.incrementActiveRequests();
    try {
      const token = this.getAccessToken();
      const headers = new Headers(options.headers || {});

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      // P18.H01: scope-header parity with the axios interceptor.
      applyActiveScopeHeaders((name, value) => headers.set(name, value));

      // Determine type of content
      const isMultipart = options.body instanceof FormData;
      if (!isMultipart && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const method = (options.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers.has('Idempotency-Key')) {
        const idempotencyKey =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        headers.set('Idempotency-Key', idempotencyKey);
      }

      const url = `${this.getOptimalApiUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Enable cookies
      });

      const responseErrorCode = response.headers.get('x-error-code') || undefined;

      if (shouldAttemptTokenRefresh(response.status, responseErrorCode)) {
        // Prevent infinite loops: Don't refresh if the failed request was an auth endpoint
        if (
          url.includes('/auth/login') ||
          url.includes('/auth/refresh-token') ||
          url.includes('/auth/logout')
        ) {
          return response;
        }

        // We can reuse the axios logic by checking if we are already refreshing
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((newToken) => {
            headers.set('Authorization', `Bearer ${newToken}`);
            return fetch(url, { ...options, headers, credentials: 'include' });
          }) as Promise<Response>;
        }

        // Trigger refresh manually
        isRefreshing = true;
        try {
          const refreshResponse = await fetch(`${this.getOptimalApiUrl()}/auth/refresh-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // X-Requested-With: required by refreshCsrfGuard. Raw
              // fetch bypasses the axios interceptor so the header
              // must be set here explicitly.
              'X-Requested-With': 'fetch',
            },
            body: JSON.stringify({}),
            credentials: 'include',
          });

          if (!refreshResponse.ok) {
            throw new Error('Refresh failed');
          }

          const refreshData = await refreshResponse.json();
          const accessToken =
            refreshData.data?.accessToken ||
            refreshData.data?.tokens?.accessToken ||
            refreshData.accessToken;

          if (!accessToken) {
            throw new Error('Invalid refresh response');
          }

          logger.warn('✅ Token refresh successful (safeFetch)');

          this.setAccessToken(accessToken);

          processQueue(null, accessToken);
          isRefreshing = false;

          headers.set('Authorization', `Bearer ${accessToken}`);
          return fetch(url, { ...options, headers });
        } catch (error) {
          processQueue(error as Error, null);
          isRefreshing = false;

          if (shouldForceLogoutOnRefreshFailure(error)) {
            localStorage.setItem(SYNC_KEYS.FORCE_LOGOUT, Date.now().toString());
            this.setAccessToken(null);
            localStorage.removeItem(STORAGE_KEYS.USER_DATA);
            triggerLogout('Your session has expired. Please login again.');
          }
          throw error;
        }
      }

      return response;
    } finally {
      this.decrementActiveRequests();
    }
  }
}

export const apiService = new ApiService();

// Export authenticatedFetch for use in other services
export const authenticatedFetch = (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  return apiService.safeFetch(endpoint, options);
};
