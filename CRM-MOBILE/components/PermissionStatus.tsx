import React, { useState, useEffect } from 'react';
import { checkPermissions, requestAllPermissions, openAppSettings, PermissionResult } from '../utils/permissions';
import { Capacitor } from '@capacitor/core';

interface PermissionStatusProps {
  onPermissionsUpdated?: (permissions: PermissionResult) => void;
  showOnlyDenied?: boolean;
}

const PermissionStatus: React.FC<PermissionStatusProps> = ({ 
  onPermissionsUpdated, 
  showOnlyDenied = false 
}) => {
  const [permissions, setPermissions] = useState<PermissionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkCurrentPermissions();
  }, []);

  const checkCurrentPermissions = async () => {
    try {
      const currentPermissions = await checkPermissions();
      setPermissions(currentPermissions);
      onPermissionsUpdated?.(currentPermissions);
    } catch (error) {
      console.error('Failed to check permissions:', error);
    }
  };

  const requestPermissions = async () => {
    setIsLoading(true);
    try {
      const newPermissions = await requestAllPermissions({
        showRationale: true,
        fallbackToSettings: true
      });
      setPermissions(newPermissions);
      onPermissionsUpdated?.(newPermissions);
    } catch (error) {
      console.error('Failed to request permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSettings = async () => {
    await openAppSettings();
  };

  if (!permissions) {
    return (
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
        <div className="text-center text-gray-400">
          Checking permissions...
        </div>
      </div>
    );
  }

  const permissionItems = [
    {
      name: 'Camera',
      status: permissions.camera,
      description: 'Required for capturing verification photos and selfies',
      icon: '📷'
    },
    {
      name: 'Location',
      status: permissions.location,
      description: 'Required for tagging photos with GPS coordinates',
      icon: '📍'
    },
    {
      name: 'Notifications',
      status: permissions.notifications,
      description: 'Required for receiving case updates and reminders',
      icon: '🔔'
    }
  ];

  const deniedPermissions = permissionItems.filter(item => item.status.denied);
  const hasAllPermissions = permissionItems.every(item => item.status.granted);

  // If showOnlyDenied is true and all permissions are granted, don't show anything
  if (showOnlyDenied && hasAllPermissions) {
    return null;
  }

  // If showOnlyDenied is true, only show denied permissions
  const itemsToShow = showOnlyDenied ? deniedPermissions : permissionItems;

  if (showOnlyDenied && itemsToShow.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h6 className="font-semibold text-light-text">
          {showOnlyDenied ? '⚠️ Permission Required' : '🔐 App Permissions'}
        </h6>
        {!hasAllPermissions && (
          <button
            onClick={requestPermissions}
            disabled={isLoading}
            className="px-3 py-1 text-xs font-semibold rounded bg-brand-primary hover:bg-brand-secondary text-white transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Requesting...' : 'Grant Permissions'}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {itemsToShow.map((item) => (
          <div key={item.name} className="flex items-start gap-3">
            <span className="text-lg">{item.icon}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-light-text">{item.name}</span>
                <div className="flex items-center gap-2">
                  {item.status.granted ? (
                    <span className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-400 border border-green-700">
                      ✅ Granted
                    </span>
                  ) : item.status.denied ? (
                    <span className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-400 border border-red-700">
                      ❌ Denied
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-700">
                      ⏳ Pending
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      {deniedPermissions.length > 0 && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded">
          <p className="text-sm text-red-400 mb-2">
            Some permissions are denied. To enable them:
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {Capacitor.getPlatform() === 'ios' && (
              <button
                onClick={handleOpenSettings}
                className="px-3 py-2 text-xs font-semibold rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Open Settings
              </button>
            )}
            {Capacitor.getPlatform() === 'android' && (
              <div className="text-xs text-gray-400">
                Go to: Settings → Apps → CaseFlow Mobile → Permissions
              </div>
            )}
            <button
              onClick={checkCurrentPermissions}
              className="px-3 py-2 text-xs font-semibold rounded border border-red-600 text-red-400 hover:bg-red-900/30 transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </div>
      )}

      {hasAllPermissions && !showOnlyDenied && (
        <div className="mt-4 p-3 bg-green-900/20 border border-green-700 rounded">
          <p className="text-sm text-green-400">
            ✅ All permissions granted! The app is ready to use.
          </p>
        </div>
      )}
    </div>
  );
};

export default PermissionStatus;
