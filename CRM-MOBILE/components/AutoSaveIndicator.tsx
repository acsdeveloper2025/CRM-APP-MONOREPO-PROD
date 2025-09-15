import React from 'react';
import { AutoSaveStatus } from '../hooks/useAutoSave';
import { CheckCircle2Icon, ExclamationTriangleIcon, ArrowPathIcon } from './Icons';
import Spinner from './Spinner';

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  className?: string;
  showDetails?: boolean;
}

const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
  status,
  className = '',
  showDetails = false
}) => {
  const {
    isAutoSaving,
    lastSaved,
    hasUnsavedChanges,
    autoSaveError,
    hasSavedData
  } = status;

  const getStatusInfo = () => {
    if (autoSaveError) {
      return {
        icon: <ExclamationTriangleIcon width={16} height={16} className="text-red-400" />,
        text: 'Save failed',
        detail: autoSaveError,
        className: 'text-red-400 bg-red-900/20 border-red-500/30'
      };
    }

    if (isAutoSaving) {
      return {
        icon: <Spinner size="small" />,
        text: 'Saving...',
        detail: 'Auto-saving your changes',
        className: 'text-blue-400 bg-blue-900/20 border-blue-500/30'
      };
    }

    if (hasUnsavedChanges) {
      return {
        icon: <ArrowPathIcon width={16} height={16} className="text-yellow-400" />,
        text: 'Unsaved changes',
        detail: 'Changes will be saved automatically',
        className: 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30'
      };
    }

    if (lastSaved) {
      const timeAgo = getTimeAgo(lastSaved);
      return {
        icon: <CheckCircle2Icon width={16} height={16} className="text-green-400" />,
        text: 'Saved',
        detail: `Last saved ${timeAgo}`,
        className: 'text-green-400 bg-green-900/20 border-green-500/30'
      };
    }

    if (hasSavedData) {
      return {
        icon: <CheckCircle2Icon width={16} height={16} className="text-green-400" />,
        text: 'Draft saved',
        detail: 'Previous draft available',
        className: 'text-green-400 bg-green-900/20 border-green-500/30'
      };
    }

    return null;
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const statusInfo = getStatusInfo();

  if (!statusInfo) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 ${statusInfo.className} ${className}`}>
      {statusInfo.icon}
      <span>{statusInfo.text}</span>
      {showDetails && statusInfo.detail && (
        <span className="text-xs opacity-75">• {statusInfo.detail}</span>
      )}
    </div>
  );
};

export default AutoSaveIndicator;
