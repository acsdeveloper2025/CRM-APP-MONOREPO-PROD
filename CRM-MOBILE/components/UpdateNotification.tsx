/**
 * Update Notification Components
 * Handles different types of update notifications (modal, banner, etc.)
 */

import React, { useState, useEffect } from 'react';
import {
  DownloadIcon,
  AlertTriangleIcon,
  InfoIcon,
  XIcon,
  RefreshIcon,
  SmartphoneIcon,
  ClockIcon,
  FileTextIcon,
  ZapIcon,
  BugIcon
} from './Icons';
import versionService, { UpdateInfo } from '../services/versionService';

interface UpdateModalProps {
  updateInfo: UpdateInfo;
  onUpdate: () => void;
  onDismiss: () => void;
  onLater: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  updateInfo,
  onUpdate,
  onDismiss,
  onLater,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleUpdate = async () => {
    setIsDownloading(true);
    try {
      // TODO: Implement actual update logic
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate download
      onUpdate();
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {updateInfo.required ? (
                <AlertTriangleIcon width={24} height={24} color="#ef4444" />
              ) : updateInfo.urgent ? (
                <ZapIcon width={24} height={24} color="#f97316" />
              ) : (
                <DownloadIcon width={24} height={24} color="#3b82f6" />
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {updateInfo.required ? 'Required Update' : 'Update Available'}
                </h3>
                <p className="text-sm text-gray-600">
                  Version {updateInfo.version}
                </p>
              </div>
            </div>
            {!updateInfo.required && (
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon width={20} height={20} color="#9ca3af" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Update Info */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <ClockIcon width={16} height={16} color="#6b7280" />
              <span>Released {formatDate(updateInfo.releaseDate)}</span>
            </div>
            {updateInfo.size && (
              <div className="flex items-center space-x-2">
                <SmartphoneIcon width={16} height={16} color="#6b7280" />
                <span>{updateInfo.size}</span>
              </div>
            )}
          </div>

          {/* Release Notes */}
          {updateInfo.releaseNotes.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                <FileTextIcon width={16} height={16} color="#111827" />
                <span className="ml-2">What's New</span>
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {updateInfo.releaseNotes.map((note, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Features */}
          {updateInfo.features.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                <ZapIcon width={16} height={16} color="#111827" />
                <span className="ml-2">New Features</span>
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {updateInfo.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bug Fixes */}
          {updateInfo.bugFixes.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                <BugIcon width={16} height={16} color="#111827" />
                <span className="ml-2">Bug Fixes</span>
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {updateInfo.bugFixes.map((fix, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-orange-500 mr-2">🔧</span>
                    {fix}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warning for required updates */}
          {updateInfo.required && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-start">
                <AlertTriangleIcon width={20} height={20} color="#ef4444" />
                <div className="text-sm ml-2">
                  <p className="font-medium text-red-800">Update Required</p>
                  <p className="text-red-700 mt-1">
                    This update is required to continue using the app. 
                    Please update now to access all features.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex space-x-3">
            <button
              onClick={handleUpdate}
              disabled={isDownloading}
              className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium ${
                updateInfo.required
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isDownloading ? (
                <>
                  <RefreshIcon width={16} height={16} color="currentColor" />
                  <span className="ml-2">Downloading...</span>
                </>
              ) : (
                <>
                  <DownloadIcon width={16} height={16} color="currentColor" />
                  <span className="ml-2">{updateInfo.required ? 'Update Now' : 'Download Update'}</span>
                </>
              )}
            </button>
            
            {!updateInfo.required && (
              <button
                onClick={onLater}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Later
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface UpdateBannerProps {
  updateInfo: UpdateInfo;
  onUpdate: () => void;
  onDismiss: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  updateInfo,
  onUpdate,
  onDismiss,
}) => {
  return (
    <div className={`${
      updateInfo.required ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
    } border-l-4 p-4 mb-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {updateInfo.required ? (
            <AlertTriangleIcon width={20} height={20} color="#ef4444" />
          ) : (
            <InfoIcon width={20} height={20} color="#3b82f6" />
          )}
          <div className="ml-3">
            <p className={`text-sm font-medium ${
              updateInfo.required ? 'text-red-800' : 'text-blue-800'
            }`}>
              {updateInfo.required ? 'Update Required' : 'Update Available'}
            </p>
            <p className={`text-sm ${
              updateInfo.required ? 'text-red-700' : 'text-blue-700'
            }`}>
              Version {updateInfo.version} is now available
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={onUpdate}
            className={`text-sm font-medium ${
              updateInfo.required 
                ? 'text-red-800 hover:text-red-900' 
                : 'text-blue-800 hover:text-blue-900'
            }`}
          >
            Update
          </button>
          {!updateInfo.required && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600"
            >
              <XIcon width={16} height={16} color="#9ca3af" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface UpdateManagerProps {
  children: React.ReactNode;
}

export const UpdateManager: React.FC<UpdateManagerProps> = ({ children }) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Start auto-checking for updates
    versionService.startAutoCheck();

    // Check for updates immediately
    checkForUpdates();

    // Set up periodic checks
    const interval = setInterval(checkForUpdates, 60000); // Check every minute

    return () => {
      clearInterval(interval);
      versionService.stopAutoCheck();
    };
  }, []);

  const checkForUpdates = async () => {
    const update = await versionService.checkForUpdates();
    if (update && !dismissed) {
      setUpdateInfo(update);
      
      const config = versionService.getConfig();
      if (update.required || config.notificationStyle === 'modal') {
        setShowModal(true);
      } else if (config.notificationStyle === 'banner') {
        setShowBanner(true);
      }
    }
  };

  const handleUpdate = () => {
    if (updateInfo?.downloadUrl) {
      window.open(updateInfo.downloadUrl, '_blank');
    }
    setShowModal(false);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowModal(false);
    setShowBanner(false);
  };

  const handleLater = () => {
    setShowModal(false);
    setShowBanner(false);
    // Will show again on next check
  };

  return (
    <>
      {children}
      
      {/* Update Banner */}
      {showBanner && updateInfo && (
        <UpdateBanner
          updateInfo={updateInfo}
          onUpdate={handleUpdate}
          onDismiss={handleDismiss}
        />
      )}
      
      {/* Update Modal */}
      {showModal && updateInfo && (
        <UpdateModal
          updateInfo={updateInfo}
          onUpdate={handleUpdate}
          onDismiss={handleDismiss}
          onLater={handleLater}
        />
      )}
    </>
  );
};
