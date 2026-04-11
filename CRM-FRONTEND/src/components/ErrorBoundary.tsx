import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { logger } from '@/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log error to monitoring service (e.g., Sentry, LogRocket)
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // M20: the previous implementation read authUser from
    // localStorage, parsed it, and shipped `userId` in the error
    // telemetry payload. That turns every ErrorBoundary catch into
    // a PII shipment — user identities flowing to whatever log
    // aggregation this.logger is wired to, with no opt-in from the
    // user and no guarantee the aggregator strips fields on
    // ingestion. The userId was never used for correlation here
    // (errorId is the correlation key) so it's pure leakage.
    //
    // Strip to stack + shape only. If correlation-to-user becomes
    // a real requirement later, do it server-side by joining on
    // the request's authenticated session instead of piping the
    // id out of the browser.
    const errorData = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      // Strip query/hash fragments — URLs can contain tokens or
      // PII that ended up in the router state when the error fired.
      url: window.location.pathname,
    };

    logger.error('Error logged:', errorData);

    // Example: Send to monitoring service
    // errorMonitoringService.captureException(error, { extra: errorData });
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: '',
      showDetails: false,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
              <CardDescription>
                We&apos;re sorry, but something unexpected happened. Our team has been notified.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Error ID */}
              <div className="text-center">
                <Badge variant="outline" className="font-mono">
                  Error ID: {this.state.errorId}
                </Badge>
              </div>

              {/* Error Message */}
              <div className="bg-slate-100/70 dark:bg-slate-800/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Error Details</h4>
                <p className="text-sm text-gray-600">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={this.handleRetry} className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Try Again</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleReload}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reload Page</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="flex items-center space-x-2"
                >
                  <Home className="h-4 w-4" />
                  <span>Go Home</span>
                </Button>
              </div>

              {/* Technical Details (Collapsible) */}
              <Collapsible open={this.state.showDetails} onOpenChange={this.toggleDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full">
                    <Bug className="h-4 w-4 mr-2" />
                    {this.state.showDetails ? 'Hide' : 'Show'} Technical Details
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 space-y-4">
                    {/* Error Stack */}
                    <div>
                      <h5 className="font-medium text-sm mb-2">Error Stack</h5>
                      <pre className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded text-xs overflow-auto max-h-32">
                        {this.state.error?.stack}
                      </pre>
                    </div>

                    {/* Component Stack */}
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <h5 className="font-medium text-sm mb-2">Component Stack</h5>
                        <pre className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded text-xs overflow-auto max-h-32">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}

                    {/* Environment Info */}
                    <div>
                      <h5 className="font-medium text-sm mb-2">Environment</h5>
                      <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded text-xs space-y-1">
                        <div>URL: {window.location.href}</div>
                        <div>User Agent: {navigator.userAgent}</div>
                        <div>Timestamp: {new Date().toISOString()}</div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Help Text */}
              <div className="text-center text-sm text-gray-600">
                <p>If this problem persists, please contact support with the Error ID above.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const useErrorHandler = () => {
  const handleError = React.useCallback((error: Error, errorInfo?: unknown) => {
    logger.error('Error caught by useErrorHandler:', error, errorInfo);

    // Log to monitoring service.
    // M20: same treatment as the class ErrorBoundary above — keep
    // pathname only, drop query / hash / hostname. Query strings
    // can contain tokens that ended up in the router state when
    // the error fired.
    const errorData = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.pathname,
      userAgent: navigator.userAgent,
      ...(typeof errorInfo === 'object' && errorInfo !== null
        ? (errorInfo as Record<string, unknown>)
        : errorInfo !== undefined
          ? { info: errorInfo }
          : {}),
    };

    logger.error('Error data:', errorData);
  }, []);

  return { handleError };
};
