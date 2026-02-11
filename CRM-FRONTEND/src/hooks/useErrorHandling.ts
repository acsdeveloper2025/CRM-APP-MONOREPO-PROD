import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  statusCode?: number;
  timestamp: string;
  context?: string;
}

export interface ErrorHandlingOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  logToService?: boolean;
  fallbackMessage?: string;
  context?: string;
}

interface ApiError {
  code?: string;
  message?: string;
  details?: unknown;
  statusCode?: number;
  response?: {
    data?: {
      message?: string;
      error?: {
        code?: string;
        details?: unknown;
      };
    };
    status?: number;
  };
}

export function useErrorHandling() {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleError = useCallback((
    error: unknown,
    options: ErrorHandlingOptions = {}
  ) => {
    const {
      showToast = true,
      logToConsole = true,
      logToService = true,
      fallbackMessage = 'An unexpected error occurred',
      context,
    } = options;

    const err = error as ApiError;

    // Parse error into standardized format
    const appError: AppError = {
      code: err.code || err.response?.data?.error?.code || 'UNKNOWN_ERROR',
      message: err.message || err.response?.data?.message || fallbackMessage,
      details: err.response?.data?.error?.details || err.details,
      statusCode: err.response?.status || err.statusCode,
      timestamp: new Date().toISOString(),
      context,
    };

    // Add to error list
    setErrors(prev => [appError, ...prev.slice(0, 9)]); // Keep last 10 errors

    // Log to console
    if (logToConsole) {
      console.error('Error handled:', appError, error);
    }

    // Show toast notification
    if (showToast) {
      const toastMessage = getUserFriendlyMessage(appError);

      // Check if there are detailed error descriptions from backend
      const hasDetailedError = appError.details && typeof appError.details === 'string' && appError.details.length > 0;

      // Determine toast duration based on error complexity
      const toastDuration = hasDetailedError ? 10000 : undefined; // 10 seconds for detailed errors

      if (appError.statusCode && appError.statusCode >= 500) {
        toast.error(toastMessage, {
          description: hasDetailedError ? (appError.details as string) : 'Please try again later or contact support if the problem persists.',
          duration: toastDuration,
        });
      } else if (appError.statusCode === 401) {
        toast.error('Authentication required', {
          description: 'Please log in to continue.',
        });
      } else if (appError.statusCode === 403) {
        toast.error('Access denied', {
          description: 'You do not have permission to perform this action.',
        });
      } else if (appError.statusCode === 404) {
        toast.error('Not found', {
          description: 'The requested resource could not be found.',
        });
      } else if (hasDetailedError) {
        // Show detailed error with description for 400-level errors
        toast.error(toastMessage, {
          description: appError.details as string,
          duration: toastDuration,
        });
      } else {
        toast.error(toastMessage);
      }
    }

    // Log to monitoring service
    if (logToService) {
      logErrorToService(appError, error);
    }

    return appError;
  }, []);

  const handleAsyncOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    options: ErrorHandlingOptions = {}
  ): Promise<T | null> => {
    setIsLoading(true);
    
    try {
      const result = await operation();
      setIsLoading(false);
      return result;
    } catch (error) {
      setIsLoading(false);
      handleError(error, options);
      return null;
    }
  }, [handleError]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const clearError = useCallback((timestamp: string) => {
    setErrors(prev => prev.filter(error => error.timestamp !== timestamp));
  }, []);

  const retryOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    options: ErrorHandlingOptions = {}
  ): Promise<T | null> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        
        if (attempt === maxRetries) {
          handleError(error, {
            ...options,
            context: `${options.context || 'Operation'} failed after ${maxRetries} attempts`,
          });
          break;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    return null;
  }, [handleError]);

  return {
    errors,
    isLoading,
    handleError,
    handleAsyncOperation,
    retryOperation,
    clearErrors,
    clearError,
  };
}

// Helper function to get user-friendly error messages
function getUserFriendlyMessage(error: AppError): string {
  const errorMessages: Record<string, string> = {
    NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
    TIMEOUT_ERROR: 'Request timed out. Please try again.',
    VALIDATION_ERROR: 'Please check your input and try again.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    FORBIDDEN: 'Access denied. You do not have permission to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    CONFLICT: 'This action conflicts with existing data.',
    RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
    SERVER_ERROR: 'Server error occurred. Please try again later.',
    DATABASE_ERROR: 'Database error occurred. Please try again later.',
    DUPLICATE_RECORD: 'A record with this information already exists.',
    FOREIGN_KEY_ERROR: 'Cannot perform this action due to related data.',
  };

  return errorMessages[error.code] || error.message;
}

// Error logging service
function logErrorToService(appError: AppError, originalError: unknown) {
  // In a real application, you would send this to your error monitoring service
  // Examples: Sentry, LogRocket, Bugsnag, etc.

  const errorDetails = originalError instanceof Error
    ? { name: originalError.name, message: originalError.message, stack: originalError.stack }
    : { name: 'Unknown', message: String(originalError), stack: undefined };

  const _errorData = {
    ...appError,
    userAgent: navigator.userAgent,
    url: window.location.href,
    userId: getUserId(),
    sessionId: getSessionId(),
    buildVersion: import.meta.env.VITE_APP_VERSION || 'unknown',
    environment: import.meta.env.MODE,
    originalError: errorDetails,
  };

  // Example: Send to monitoring service
  // Example: Send to monitoring service
  console.warn('Error logged to service:', _errorData);

  // Uncomment and configure for your monitoring service:
  // Sentry.captureException(originalError, { extra: _errorData });
  // LogRocket.captureException(originalError);
  // Bugsnag.notify(originalError, event => { event.addMetadata('custom', _errorData); });
}

function getUserId(): string | null {
  try {
    const user = localStorage.getItem('authUser');
    return user ? JSON.parse(user).id : null;
  } catch {
    return null;
  }
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

// Error boundary hook for functional components
export function useErrorBoundary() {
  const [error, setError] = useState<Error | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const captureError = useCallback((error: Error) => {
    setError(error);
  }, []);

  if (error) {
    throw error;
  }

  return { captureError, resetError };
}
