import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home,
  FileText,
  BarChart3,
  Download,
  Settings,
  User,
  Bell,
  Menu,
  X,
  Wifi,
  WifiOff,
  Battery,
  Signal
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface MobileNavigationProps {
  activeView: string;
  onViewChange: (view: string) => void;
  pendingSyncCount?: number;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activeView,
  onViewChange,
  pendingSyncCount = 0
}) => {
  const { user, logout } = useAuth();
  const { isOnline, connectionQuality } = useNetworkStatus();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      badge: null
    },
    {
      id: 'submissions',
      label: 'Forms',
      icon: FileText,
      badge: null
    },
    {
      id: 'performance',
      label: 'Metrics',
      icon: BarChart3,
      badge: null
    },
    {
      id: 'offline',
      label: 'Offline',
      icon: Download,
      badge: pendingSyncCount > 0 ? pendingSyncCount : null
    }
  ];

  const getConnectionIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4 text-red-500" />;
    
    switch (connectionQuality) {
      case 'excellent':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'good':
        return <Wifi className="h-4 w-4 text-blue-500" />;
      case 'poor':
        return <Wifi className="h-4 w-4 text-yellow-500" />;
      default:
        return <Wifi className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBatteryLevel = () => {
    // Mock battery level - in real app, use Battery API
    return Math.floor(Math.random() * 100);
  };

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Top Status Bar */}
      <div className="bg-background text-white px-4 py-1 text-xs flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {getConnectionIcon()}
        </div>
        <div className="flex items-center space-x-2">
          <Signal className="h-3 w-3" />
          <Battery className="h-3 w-3" />
          <span>{getBatteryLevel()}%</span>
        </div>
      </div>

      {/* Main Navigation Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">CRM Mobile</h1>
              <p className="text-xs text-muted-foreground">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Bell className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Connection Status Banner */}
        {!isOnline && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2">
            <div className="flex items-center space-x-2">
              <WifiOff className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">
                You're offline. Some features may be limited.
              </span>
            </div>
          </div>
        )}

        {pendingSyncCount > 0 && isOnline && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
            <div className="flex items-center space-x-2">
              <Download className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                {pendingSyncCount} items pending sync
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Slide-out Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setIsMenuOpen(false)}>
          <div 
            className="fixed right-0 top-0 h-full w-64 bg-white shadow-lg transform transition-transform"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">{user?.name}</h3>
                  <p className="text-sm text-muted-foreground">{user?.role}</p>
                  <div className="flex items-center space-x-1 mt-1">
                    {getConnectionIcon()}
                    <span className="text-xs text-muted-foreground">
                      {isOnline ? connectionQuality?.toUpperCase() : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <Button 
                variant="ghost" 
                className="w-full justify-start"
                onClick={() => {
                  onViewChange('profile');
                  setIsMenuOpen(false);
                }}
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start"
                onClick={() => {
                  onViewChange('settings');
                  setIsMenuOpen(false);
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start"
                onClick={() => {
                  onViewChange('notifications');
                  setIsMenuOpen(false);
                }}
              >
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </Button>
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="grid grid-cols-4 gap-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <Button
                key={item.id}
                variant="ghost"
                className={`h-16 flex-col space-y-1 rounded-none relative ${
                  isActive ? 'text-blue-600 bg-blue-50' : 'text-muted-foreground'
                }`}
                onClick={() => onViewChange(item.id)}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge && (
                    <Badge 
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs bg-red-500 text-white"
                      variant="secondary"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </div>
                <span className="text-xs">{item.label}</span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-b"></div>
                )}
              </Button>
            );
          })}
        </div>
      </div>
    </>
  );
};
