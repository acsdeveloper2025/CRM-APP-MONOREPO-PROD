import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/components/collapsible';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
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
    // In a real app, you would send this to your error monitoring service
    const errorData = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: (() => {
        try {
          const authUser = localStorage.getItem('authUser');
          return authUser ? JSON.parse(authUser).id : null;
        } catch {
          return null;
        }
      })(),
    };

    console.error('Error logged:', errorData);
    
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
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Page>
          <Section>
            <Card tone="strong" staticCard style={{ maxWidth: '48rem', margin: '8vh auto 0' }}>
              <Stack gap={6} style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div className="ui-stat-card" style={{ width: '4rem', height: '4rem', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={32} style={{ color: 'var(--ui-danger)' }} />
                </div>
              </div>
              <Text as="h1" variant="headline">Something went wrong</Text>
              <Text tone="muted">
                We&apos;re sorry, but something unexpected happened. Our team has been notified.
              </Text>

              <div>
                <Badge variant="danger" className="font-mono">
                  Error ID: {this.state.errorId}
                </Badge>
              </div>

              <div className="bg-slate-100/70 dark:bg-slate-800/50 rounded-lg p-4">
                <Text as="h4" variant="title" className="mb-2">Error Details</Text>
                <Text variant="body-sm" tone="muted">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </Text>
              </div>

              <Stack direction="horizontal" gap={3} justify="center" wrap="wrap">
                <Button onClick={this.handleRetry} icon={<RefreshCw size={16} />}>
                  Try Again
                </Button>
                <Button variant="secondary" onClick={this.handleReload} icon={<RefreshCw size={16} />}>
                  Reload Page
                </Button>
                <Button variant="secondary" onClick={this.handleGoHome} icon={<Home size={16} />}>
                  Go Home
                </Button>
              </Stack>

              <Collapsible open={this.state.showDetails} onOpenChange={this.toggleDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full" icon={<Bug size={16} />}>
                    {this.state.showDetails ? 'Hide' : 'Show'} Technical Details
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 space-y-4">
                    <div>
                      <Text as="h5" variant="label" className="mb-2">Error Stack</Text>
                      <pre className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded text-xs overflow-auto max-h-32">
                        {this.state.error?.stack}
                      </pre>
                    </div>

                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <Text as="h5" variant="label" className="mb-2">Component Stack</Text>
                        <pre className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded text-xs overflow-auto max-h-32">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}

                    <div>
                      <Text as="h5" variant="label" className="mb-2">Environment</Text>
                      <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded text-xs space-y-1">
                        <div>URL: {window.location.href}</div>
                        <div>User Agent: {navigator.userAgent}</div>
                        <div>Timestamp: {new Date().toISOString()}</div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div>
                <Text variant="body-sm" tone="muted">
                  If this problem persists, please contact support with the Error ID above.
                </Text>
              </div>
              </Stack>
            </Card>
          </Section>
        </Page>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const useErrorHandler = () => {
  const handleError = React.useCallback((error: Error, errorInfo?: unknown) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo);
    
    // Log to monitoring service
    const errorData = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...(typeof errorInfo === 'object' && errorInfo !== null 
        ? (errorInfo as Record<string, unknown>) 
        : errorInfo !== undefined ? { info: errorInfo } : {}),
    };

    console.error('Error data:', errorData);
  }, []);

  return { handleError };
};
