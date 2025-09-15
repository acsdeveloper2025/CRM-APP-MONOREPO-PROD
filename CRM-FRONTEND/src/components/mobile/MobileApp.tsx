import React, { useState, useEffect } from 'react';
import { AgentDashboard } from './AgentDashboard';
import { MySubmissions } from './MySubmissions';
import { PerformanceMetrics } from './PerformanceMetrics';
import { OfflineReports } from './OfflineReports';
import { MobileReportViewer } from './MobileReportViewer';
import { MobileNavigation } from './MobileNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';

interface MobileAppState {
  activeView: string;
  reportViewer?: {
    reportId?: string;
    reportType: 'performance' | 'submissions' | 'analytics';
  };
}

export const MobileApp: React.FC = () => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { offlineReports } = useOfflineStorage();
  const [appState, setAppState] = useState<MobileAppState>({
    activeView: 'dashboard'
  });

  // Calculate pending sync count
  const pendingSyncCount = offlineReports.filter(report => report.syncStatus === 'pending').length;

  useEffect(() => {
    // Register service worker for offline functionality
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          // Service worker registered successfully
        })
        .catch((registrationError) => {
          // Service worker registration failed
        });
    }
  }, []);

  const handleViewChange = (view: string) => {
    setAppState({
      activeView: view,
      reportViewer: undefined
    });
  };

  const handleOpenReport = (reportType: 'performance' | 'submissions' | 'analytics', reportId?: string) => {
    setAppState({
      activeView: 'report-viewer',
      reportViewer: {
        reportType,
        reportId
      }
    });
  };

  const handleBackFromReport = () => {
    setAppState({
      activeView: 'dashboard'
    });
  };

  const renderActiveView = () => {
    switch (appState.activeView) {
      case 'dashboard':
        return <AgentDashboard />;
      
      case 'submissions':
        return <MySubmissions />;
      
      case 'performance':
        return <PerformanceMetrics />;
      
      case 'offline':
        return <OfflineReports />;
      
      case 'report-viewer':
        if (appState.reportViewer) {
          return (
            <MobileReportViewer
              reportId={appState.reportViewer.reportId}
              reportType={appState.reportViewer.reportType}
              onBack={handleBackFromReport}
            />
          );
        }
        return <AgentDashboard />;
      
      case 'profile':
        return <ProfileView />;
      
      case 'settings':
        return <SettingsView />;
      
      case 'notifications':
        return <NotificationsView />;
      
      default:
        return <AgentDashboard />;
    }
  };

  // Don't show navigation for report viewer
  const showNavigation = appState.activeView !== 'report-viewer';

  return (
    <div className="min-h-screen bg-muted">
      {showNavigation && (
        <MobileNavigation
          activeView={appState.activeView}
          onViewChange={handleViewChange}
          pendingSyncCount={pendingSyncCount}
        />
      )}
      
      <div className={showNavigation ? 'pb-20' : ''}>
        {renderActiveView()}
      </div>
    </div>
  );
};

// Profile View Component
const ProfileView: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg p-6 text-center">
        <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-white">
            {user?.name?.charAt(0) || 'U'}
          </span>
        </div>
        <h2 className="text-xl font-semibold">{user?.name}</h2>
        <p className="text-muted-foreground">{user?.role}</p>
        <p className="text-sm text-muted-foreground mt-2">{user?.email}</p>
      </div>
      
      <div className="bg-white rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Account Information</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Employee ID:</span>
            <span>{user?.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Department:</span>
            <span>Field Operations</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Territory:</span>
            <span>Bangalore South</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Joined:</span>
            <span>Jan 2024</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings View Component
const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState({
    notifications: true,
    autoSync: true,
    offlineMode: false,
    dataUsage: 'wifi-only'
  });

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg p-4">
        <h3 className="font-semibold mb-4">App Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-muted-foreground">Receive alerts and updates</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => setSettings({...settings, notifications: e.target.checked})}
              className="toggle"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto Sync</p>
              <p className="text-sm text-muted-foreground">Automatically sync when online</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSync}
              onChange={(e) => setSettings({...settings, autoSync: e.target.checked})}
              className="toggle"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Offline Mode</p>
              <p className="text-sm text-muted-foreground">Work without internet connection</p>
            </div>
            <input
              type="checkbox"
              checked={settings.offlineMode}
              onChange={(e) => setSettings({...settings, offlineMode: e.target.checked})}
              className="toggle"
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg p-4">
        <h3 className="font-semibold mb-4">Data Usage</h3>
        
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="dataUsage"
              value="wifi-only"
              checked={settings.dataUsage === 'wifi-only'}
              onChange={(e) => setSettings({...settings, dataUsage: e.target.value})}
            />
            <span>WiFi Only</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="dataUsage"
              value="wifi-cellular"
              checked={settings.dataUsage === 'wifi-cellular'}
              onChange={(e) => setSettings({...settings, dataUsage: e.target.value})}
            />
            <span>WiFi + Cellular</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="dataUsage"
              value="cellular-only"
              checked={settings.dataUsage === 'cellular-only'}
              onChange={(e) => setSettings({...settings, dataUsage: e.target.value})}
            />
            <span>Cellular Only</span>
          </label>
        </div>
      </div>
    </div>
  );
};

// Notifications View Component
const NotificationsView: React.FC = () => {
  const notifications = [
    {
      id: '1',
      title: 'Form Validation Complete',
      message: 'Your submission for Case-001 has been validated',
      time: '2 hours ago',
      read: false
    },
    {
      id: '2',
      title: 'Weekly Report Available',
      message: 'Your performance report for this week is ready',
      time: '1 day ago',
      read: true
    },
    {
      id: '3',
      title: 'Sync Complete',
      message: 'All pending data has been synchronized',
      time: '2 days ago',
      read: true
    }
  ];

  return (
    <div className="p-4 space-y-3">
      {notifications.map((notification) => (
        <div 
          key={notification.id}
          className={`bg-white rounded-lg p-4 border-l-4 ${
            notification.read ? 'border-l-gray-300' : 'border-l-blue-500'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className={`font-medium ${!notification.read ? 'text-blue-900' : 'text-foreground'}`}>
                {notification.title}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
              <p className="text-xs text-muted-foreground mt-2">{notification.time}</p>
            </div>
            {!notification.read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
