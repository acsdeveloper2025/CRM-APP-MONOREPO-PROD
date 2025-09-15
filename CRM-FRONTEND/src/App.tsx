
// Complete ACS CRM Application with Full Routing
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppRoutes } from '@/components/AppRoutes';
import { useWebSocket } from '@/hooks/useWebSocket';

// Note: Page imports are now handled in AppRoutes component

// Global WebSocket connection component
function GlobalWebSocket() {
  useWebSocket({
    autoConnect: true,
    onNotification: (notification) => {
      // Handle global notifications
    },
  });
  return null;
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="acs-theme">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GlobalWebSocket />
            <Router>
              <div className="min-h-screen bg-background">
                <AppRoutes />
              </div>
            </Router>
            <Toaster position="top-right" />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
