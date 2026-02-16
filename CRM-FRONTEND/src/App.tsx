
// Complete ACS CRM Application with Full Routing
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppRoutes } from '@/components/AppRoutes';

// Note: Page imports are now handled in AppRoutes component

import { SessionTimeoutModal } from '@/components/auth/SessionTimeoutModal';
import { sessionManager } from '@/services/sessionManager';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Handle session timeout logic
function SessionHandler() {
  const { isAuthenticated } = useAuth();
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(60);

  useEffect(() => {
    if (isAuthenticated) {
      sessionManager.init((seconds) => {
        setRemainingSeconds(seconds);
        setShowTimeoutModal(true);
      });
    } else {
      sessionManager.destroy();
      setShowTimeoutModal(false);
      // Reset timer when logged out
      sessionManager.resetTimer(); 
    }

    return () => {
      sessionManager.destroy();
    };
  }, [isAuthenticated]);

  // Handle modal close (users should use buttons, but just in case)
  const handleClose = () => {
    setShowTimeoutModal(false);
  };

  // If we receive a warning update while modal is open, update seconds
  // The init callback is called every second during warning phase
  
  return (
    <SessionTimeoutModal 
      isOpen={showTimeoutModal} 
      onClose={handleClose} 
      remainingSeconds={remainingSeconds} 
    />
  );
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
            <SessionHandler />
            <Router>
              <div className="min-h-screen bg-[#FAFAFA]">
                <AppRoutes />
              </div>
            </Router>
            <Toaster position="top-right" richColors closeButton />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
