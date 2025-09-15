/**
 * Update Settings Component
 * Allows users to configure auto-update preferences
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Download, 
  Wifi, 
  Bell, 
  Clock, 
  Shield,
  ToggleLeft,
  ToggleRight,
  Save,
  RefreshCw
} from 'lucide-react';
import versionService, { UpdateConfig } from '../services/versionService';

interface UpdateSettingsProps {
  onClose?: () => void;
}

export const UpdateSettings: React.FC<UpdateSettingsProps> = ({ onClose }) => {
  const [config, setConfig] = useState<UpdateConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    setIsLoading(true);
    try {
      const currentConfig = versionService.getConfig();
      setConfig(currentConfig);
    } catch (error) {
      console.error('Failed to load update config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (key: keyof UpdateConfig, value: any) => {
    if (!config) return;
    
    setConfig(prev => prev ? { ...prev, [key]: value } : null);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!config || !hasChanges) return;
    
    setIsSaving(true);
    try {
      versionService.saveConfig(config);
      setHasChanges(false);
      console.log('✅ Update settings saved');
    } catch (error) {
      console.error('Failed to save update settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatInterval = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours < 24) return `${hours} hours`;
    const days = Math.floor(hours / 24);
    return `${days} days`;
  };

  const intervalOptions = [
    { value: 1 * 60 * 60 * 1000, label: '1 hour' },
    { value: 6 * 60 * 60 * 1000, label: '6 hours' },
    { value: 12 * 60 * 60 * 1000, label: '12 hours' },
    { value: 24 * 60 * 60 * 1000, label: '1 day' },
    { value: 7 * 24 * 60 * 60 * 1000, label: '1 week' },
  ];

  const notificationStyles = [
    { value: 'modal', label: 'Modal Dialog', description: 'Show a popup dialog' },
    { value: 'banner', label: 'Banner', description: 'Show a banner notification' },
    { value: 'silent', label: 'Silent', description: 'Check silently in background' },
  ];

  if (isLoading || !config) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Settings className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Update Settings</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="p-6 space-y-6">
        {/* Enable Auto-Updates */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Download className="h-5 w-5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900">Auto-Updates</p>
              <p className="text-sm text-gray-600">Automatically check for updates</p>
            </div>
          </div>
          <button
            onClick={() => handleConfigChange('enabled', !config.enabled)}
            className="flex items-center"
          >
            {config.enabled ? (
              <ToggleRight className="h-6 w-6 text-blue-500" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-gray-300" />
            )}
          </button>
        </div>

        {/* Auto-Check */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-5 w-5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900">Automatic Checking</p>
              <p className="text-sm text-gray-600">Check for updates automatically</p>
            </div>
          </div>
          <button
            onClick={() => handleConfigChange('autoCheck', !config.autoCheck)}
            disabled={!config.enabled}
            className="flex items-center"
          >
            {config.autoCheck ? (
              <ToggleRight className="h-6 w-6 text-blue-500" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-gray-300" />
            )}
          </button>
        </div>

        {/* Check Interval */}
        {config.enabled && config.autoCheck && (
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Check Interval</p>
                <p className="text-sm text-gray-600">How often to check for updates</p>
              </div>
            </div>
            <select
              value={config.checkInterval}
              onChange={(e) => handleConfigChange('checkInterval', parseInt(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
            >
              {intervalOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Cellular Download */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Wifi className="h-5 w-5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900">Cellular Downloads</p>
              <p className="text-sm text-gray-600">Allow downloads over cellular data</p>
            </div>
          </div>
          <button
            onClick={() => handleConfigChange('allowCellularDownload', !config.allowCellularDownload)}
            disabled={!config.enabled}
            className="flex items-center"
          >
            {config.allowCellularDownload ? (
              <ToggleRight className="h-6 w-6 text-blue-500" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-gray-300" />
            )}
          </button>
        </div>

        {/* Notification Style */}
        {config.enabled && (
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <Bell className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Notification Style</p>
                <p className="text-sm text-gray-600">How to notify about updates</p>
              </div>
            </div>
            <div className="space-y-2">
              {notificationStyles.map((style) => (
                <label key={style.value} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="notificationStyle"
                    value={style.value}
                    checked={config.notificationStyle === style.value}
                    onChange={(e) => handleConfigChange('notificationStyle', e.target.value)}
                    className="text-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{style.label}</p>
                    <p className="text-xs text-gray-600">{style.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center space-x-3 mb-3">
            <Shield className="h-5 w-5 text-gray-400" />
            <p className="font-medium text-gray-900">Advanced</p>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Retry Attempts:</span>
              <input
                type="number"
                min="1"
                max="10"
                value={config.retryAttempts}
                onChange={(e) => handleConfigChange('retryAttempts', parseInt(e.target.value))}
                className="w-16 p-1 border border-gray-300 rounded text-center"
              />
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Retry Delay (seconds):</span>
              <input
                type="number"
                min="1"
                max="60"
                value={config.retryDelay / 1000}
                onChange={(e) => handleConfigChange('retryDelay', parseInt(e.target.value) * 1000)}
                className="w-16 p-1 border border-gray-300 rounded text-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-gray-200">
        <div className="flex space-x-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
        
        {hasChanges && (
          <p className="text-xs text-orange-600 mt-2">
            You have unsaved changes
          </p>
        )}
      </div>
    </div>
  );
};
