import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          backgroundColor: '#111827',
          color: '#fff',
          minHeight: '100vh',
          fontFamily: 'monospace'
        }}>
          <h1 style={{ color: '#ef4444' }}>Something went wrong!</h1>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '20px' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
              Click to see error details
            </summary>
            <div style={{ backgroundColor: '#1f2937', padding: '10px', borderRadius: '4px' }}>
              <h3>Error:</h3>
              <p style={{ color: '#fbbf24' }}>{this.state.error && this.state.error.toString()}</p>
              
              <h3>Component Stack:</h3>
              <p style={{ color: '#60a5fa' }}>{this.state.errorInfo && this.state.errorInfo.componentStack}</p>
              
              <h3>Error Stack:</h3>
              <p style={{ color: '#f87171' }}>{this.state.error && this.state.error.stack}</p>
            </div>
          </details>
          
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
