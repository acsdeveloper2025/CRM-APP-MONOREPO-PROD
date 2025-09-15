import { useState, useEffect } from 'react';

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'offline';

interface NetworkStatus {
  isOnline: boolean;
  connectionQuality: ConnectionQuality;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NetworkConnection extends EventTarget {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

declare global {
  interface Navigator {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  }
}

export const useNetworkStatus = (): NetworkStatus => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    connectionQuality: 'excellent'
  });

  const getConnectionQuality = (): ConnectionQuality => {
    if (!navigator.onLine) return 'offline';

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (!connection) {
      // Fallback: assume good connection if no connection API
      return 'good';
    }

    const { effectiveType, downlink, rtt } = connection;

    // Determine quality based on effective connection type
    if (effectiveType === '4g' && (downlink || 0) > 1.5 && (rtt || 0) < 100) {
      return 'excellent';
    } else if (effectiveType === '4g' || (effectiveType === '3g' && (downlink || 0) > 0.5)) {
      return 'good';
    } else if (effectiveType === '3g' || effectiveType === '2g') {
      return 'poor';
    } else {
      return 'poor';
    }
  };

  const updateNetworkStatus = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    setNetworkStatus({
      isOnline: navigator.onLine,
      connectionQuality: getConnectionQuality(),
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData
    });
  };

  useEffect(() => {
    // Initial status
    updateNetworkStatus();

    // Event listeners
    const handleOnline = () => updateNetworkStatus();
    const handleOffline = () => updateNetworkStatus();
    const handleConnectionChange = () => updateNetworkStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  // Periodic quality check
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) {
        updateNetworkStatus();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return networkStatus;
};
