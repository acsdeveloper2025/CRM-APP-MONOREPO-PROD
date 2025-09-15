import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import NetworkService from '../services/networkService';
import CaseStatusService from '../services/caseStatusService';
import RetryService from '../services/retryService';

interface SyncStatusIndicatorProps {
  className?: string;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ className = '' }) => {
  const [isOnline, setIsOnline] = useState(NetworkService.isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [isSync, setIsSync] = useState(false);

  useEffect(() => {
    // Listen for network status changes
    // const unsubscribe = NetworkService.addListener((networkState) => {
    //   setIsOnline(networkState.isOnline);
    // });

    // Update pending count periodically
    const updatePendingCount = () => {
      try {
        // const retryService = RetryService.getInstance();
        const queueStatus = retryService.getQueueStatus();
        setPendingCount(queueStatus.pending);
      } catch (error) {
        console.error('Failed to get pending count:', error);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000); // Update every 5 seconds

    return () => {
      // unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) return;
    
    setIsSync(true);
    try {
      // await CaseStatusService.processPendingStatusUpdates();
      setPendingCount(0);
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSync(false);
    }
  };

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }
    
    if (isSync) {
      return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    }
    
    if (pendingCount > 0) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
    
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!isOnline) {
      return 'Offline';
    }
    
    if (isSync) {
      return 'Syncing...';
    }
    
    if (pendingCount > 0) {
      return `${pendingCount} pending`;
    }
    
    return 'Synced';
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {getStatusIcon()}
      <span className="text-sm font-medium">{getStatusText()}</span>
      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleManualSync}
          disabled={isSync}
          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Sync Now
        </button>
      )}
    </div>
  );
};

export default SyncStatusIndicator;
