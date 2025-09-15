/**
 * Version Information Component
 * Displays app version, build info, and update status in profile/settings
 */

import React, { useState, useEffect } from 'react';
// Simple icon components
const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const Download = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const SmartphoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v16a1 1 0 001 1z" />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckCircle2Icon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const HashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
  </svg>
);
// Additional icon components
const GlobeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

import versionService from '../services/versionService';

export interface VersionInfo {
  current: string;
  latest: string;
  buildNumber: string;
  buildDate: string;
  environment: 'development' | 'production';
}

export interface UpdateInfo {
  available: boolean;
  required: boolean;
  urgent: boolean;
  version: string;
  downloadUrl: string;
  releaseNotes: string[];
  features: string[];
  bugFixes: string[];
  size: string;
  releaseDate: string;
}

interface VersionInfoProps {
  showDetailed?: boolean;
  showUpdateButton?: boolean;
  className?: string;
}

export const VersionInfoComponent: React.FC<VersionInfoProps> = ({
  showDetailed = true,
  showUpdateButton = true,
  className = '',
}) => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    loadVersionInfo();
    loadUpdateInfo();
  }, []);

  const loadVersionInfo = () => {
    const info = versionService.getCurrentVersion();
    setVersionInfo(info);
  };

  const loadUpdateInfo = () => {
    const info = versionService.getLastUpdateInfo();
    setUpdateInfo(info);
  };

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    try {
      const update = await versionService.checkForUpdates(true);
      setUpdateInfo(update);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const formatBuildDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatLastChecked = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  const getUpdateStatus = () => {
    if (!updateInfo) {
      return {
        icon: <CheckCircle2Icon width={20} height={20} color="#10b981" />,
        text: 'Up to date',
        color: 'text-green-600',
      };
    }

    if (updateInfo.required) {
      return {
        icon: <AlertTriangleIcon width={20} height={20} color="#ef4444" />,
        text: 'Update required',
        color: 'text-red-600',
      };
    }

    return {
      icon: <DownloadIcon width={20} height={20} color="#3b82f6" />,
      text: 'Update available',
      color: 'text-blue-600',
    };
  };

  if (!versionInfo) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  const updateStatus = getUpdateStatus();

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SmartphoneIcon width={24} height={24} color="#4b5563" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">App Version</h3>
              <p className="text-sm text-gray-600">
                {versionService.formatVersion(versionInfo.current, versionInfo.buildNumber)}
              </p>
            </div>
          </div>
          
          {/* Update Status Badge */}
          <div className={`flex items-center space-x-2 ${updateStatus.color}`}>
            {updateStatus.icon}
            <span className="text-sm font-medium">{updateStatus.text}</span>
          </div>
        </div>
      </div>

      {/* Detailed Information */}
      {showDetailed && (
        <div className="p-4 space-y-4">
          {/* Version Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <HashIcon width={16} height={16} color="#9ca3af" />
              <div>
                <p className="text-gray-600">Build Number</p>
                <p className="font-medium text-gray-900">{versionInfo.buildNumber}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <GlobeIcon width={16} height={16} color="#9ca3af" />
              <div>
                <p className="text-gray-600">Environment</p>
                <p className="font-medium text-gray-900 capitalize">{versionInfo.environment}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 col-span-2">
              <CalendarIcon width={16} height={16} color="#9ca3af" />
              <div>
                <p className="text-gray-600">Build Date</p>
                <p className="font-medium text-gray-900">{formatBuildDate(versionInfo.buildDate)}</p>
              </div>
            </div>
          </div>

          {/* Update Information */}
          {updateInfo && (
            <div className="bg-gray-50 rounded-md p-3">
              <h4 className="font-medium text-gray-900 mb-2">Available Update</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Latest Version:</span>
                  <span className="font-medium text-gray-900">{updateInfo.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Release Date:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(updateInfo.releaseDate).toLocaleDateString()}
                  </span>
                </div>
                {updateInfo.size && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Download Size:</span>
                    <span className="font-medium text-gray-900">{updateInfo.size}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Last Update Check */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <ClockIcon width={16} height={16} color="#6b7280" />
              <span>
                Last checked: {lastChecked ? formatLastChecked(lastChecked) : 'Never'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {showUpdateButton && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-3">
            <button
              onClick={handleCheckForUpdates}
              disabled={isChecking}
              className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Check for Updates
                </>
              )}
            </button>
            
            {updateInfo && (
              <button
                onClick={() => {
                  if (updateInfo.downloadUrl) {
                    window.open(updateInfo.downloadUrl, '_blank');
                  }
                }}
                className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium text-white ${
                  updateInfo.required 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Download className="h-4 w-4 mr-2" />
                {updateInfo.required ? 'Update Now' : 'Download Update'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface CompactVersionInfoProps {
  className?: string;
  onClick?: () => void;
}

export const CompactVersionInfo: React.FC<CompactVersionInfoProps> = ({
  className = '',
  onClick,
}) => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    const info = versionService.getCurrentVersion();
    setVersionInfo(info);
    
    const update = versionService.getLastUpdateInfo();
    setUpdateInfo(update);
  }, []);

  if (!versionInfo) return null;

  const hasUpdate = updateInfo?.available;

  return (
    <div 
      className={`flex items-center justify-between p-3 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center space-x-3">
        <InfoIcon width={20} height={20} color="#9ca3af" />
        <div>
          <p className="text-sm font-medium text-gray-900">App Version</p>
          <p className="text-xs text-gray-600">
            {versionService.formatVersion(versionInfo.current)}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {hasUpdate && (
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
        )}
        <EyeIcon width={16} height={16} color="#9ca3af" />
      </div>
    </div>
  );
};
