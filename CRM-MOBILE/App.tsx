import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CaseProvider } from './context/CaseContext';
import BottomNavigation from './components/BottomNavigation';
import { SafeAreaProvider, MobileContainer } from './components/SafeAreaProvider';
import { ResponsiveLayoutProvider } from './components/ResponsiveLayout';
import ErrorBoundary from './components/ErrorBoundary';
import AuthStatusIndicator from './components/AuthStatusIndicator';
import ReauthModal from './components/ReauthModal';
import { UpdateManager } from './components/UpdateNotification';
import { View } from 'react-native';
import { googleMapsService } from './services/googleMapsService';
import { validateEnvironmentConfig, getEnvironmentConfig } from './config/environment';
import { dataCleanupService } from './services/dataCleanupService';
import { backgroundTaskManager } from './services/backgroundTaskManager';
import { initializeAppPermissions } from './utils/permissions';

// Lazy load screens for better code splitting
const NewLoginScreen = lazy(() => import('./screens/NewLoginScreen'));
const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));
const CaseListScreen = lazy(() => import('./screens/CaseListScreen'));
const AssignedCasesScreen = lazy(() => import('./screens/AssignedCasesScreen'));
const InProgressCasesScreen = lazy(() => import('./screens/InProgressCasesScreen'));
const CompletedCasesScreen = lazy(() => import('./screens/CompletedCasesScreen'));
const SavedCasesScreen = lazy(() => import('./screens/SavedCasesScreen'));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'));
const DigitalIdCardScreen = lazy(() => import('./screens/DigitalIdCardScreen'));

const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, authStatus } = useAuth();
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthReason, setReauthReason] = useState<string>('');

  // Initialize services on app start
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('🚀 Starting app initialization...');

        // Initialize app permissions first (critical for iOS)
        console.log('🔐 Initializing permissions...');
        const permissions = await initializeAppPermissions();
        console.log('🔐 Permission initialization complete:', permissions);

        // Validate environment configuration
        const config = getEnvironmentConfig();
        const isValid = validateEnvironmentConfig(config);

        if (isValid) {
          // Initialize Google Maps service with the new API key
          const initialized = await googleMapsService.initialize();
          if (initialized) {
            console.log('✅ Google Maps API initialized successfully');
          } else {
            console.warn('⚠️ Google Maps API initialization failed - using fallback services');
          }
        } else {
          console.warn('⚠️ Environment configuration invalid - some features may not work');
        }

        // Initialize background task manager (includes data cleanup)
        await backgroundTaskManager.initialize();

        // Initialize data cleanup service
        await dataCleanupService.initialize();

        console.log('✅ All services initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize services:', error);
      }
    };

    initializeServices();
  }, []);

  // Listen for re-authentication events
  useEffect(() => {
    const handleReauthRequired = (event: any) => {
      setReauthReason(event.detail?.reason || 'Authentication expired');
      setShowReauthModal(true);
    };

    window.addEventListener('authReauthRequired', handleReauthRequired);

    return () => {
      window.removeEventListener('authReauthRequired', handleReauthRequired);
    };
  }, []);

  // Check if re-auth is needed based on auth status
  useEffect(() => {
    if (authStatus && authStatus.needsAction && authStatus.actionRequired === 'Re-authentication required') {
      setReauthReason('Your 30-day authentication period has expired');
      setShowReauthModal(true);
    }
  }, [authStatus]);

  if (isLoading) {
    return (
      <MobileContainer>
        <View style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111827',
          height: '100vh'
        }}>
          <div style={{ color: '#00a950', fontSize: '18px' }}>Loading...</div>
        </View>
      </MobileContainer>
    );
  }

  // Loading component for lazy-loaded routes
  const RouteLoader = () => (
    <MobileContainer>
      <View style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111827',
        height: '100vh'
      }}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full"></div>
          <div style={{ color: '#00a950', fontSize: '16px' }}>Loading screen...</div>
        </div>
      </View>
    </MobileContainer>
  );

  return (
    <MobileContainer>
      {/* Authentication Status Indicator */}
      {isAuthenticated && <AuthStatusIndicator />}

      <Suspense fallback={<RouteLoader />}>
        <Routes>
          {isAuthenticated ? (
            <>
              <Route path="/" element={<DashboardScreen />} />
              <Route path="/cases" element={<CaseListScreen title="All Cases" filter={() => true} emptyMessage="No cases available." tabKey="all" searchPlaceholder="Search all cases..." />} />
              <Route path="/cases/assigned" element={<AssignedCasesScreen />} />
              <Route path="/cases/in-progress" element={<InProgressCasesScreen />} />
              <Route path="/cases/completed" element={<CompletedCasesScreen />} />
              <Route path="/cases/saved" element={<SavedCasesScreen />} />
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path="/digital-id-card" element={<DigitalIdCardScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/login" element={<NewLoginScreen />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          )}
        </Routes>
      </Suspense>

      {/* Bottom Navigation */}
      {isAuthenticated && <BottomNavigation />}

      {/* Re-authentication Modal */}
      <ReauthModal
        visible={showReauthModal}
        onClose={() => setShowReauthModal(false)}
        reason={reauthReason}
      />
    </MobileContainer>
  );
};



const App: React.FC = () => {

  try {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <SafeAreaProvider>
            <ResponsiveLayoutProvider>
              <AuthProvider>
                <CaseProvider>
                  <UpdateManager>
                    <AppNavigator />
                  </UpdateManager>
                </CaseProvider>
              </AuthProvider>
            </ResponsiveLayoutProvider>
          </SafeAreaProvider>
        </BrowserRouter>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('App render error:', error);
    return (
      <div style={{
        backgroundColor: '#111827',
        color: '#ffffff',
        padding: '20px',
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h1>App Error</h1>
        <p>Failed to render app: {String(error)}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
};

export default App;
