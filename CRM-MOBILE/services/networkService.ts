import TokenRefreshService from './tokenRefreshService';

/**
 * Network Connectivity Service
 * Handles network state changes and triggers token refresh when coming back online
 */

export interface NetworkState {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  lastOnlineAt?: number;
  lastOfflineAt?: number;
}

class NetworkService {
  private static instance: NetworkService;
  private networkState: NetworkState = {
    isOnline: navigator.onLine,
    connectionType: 'unknown',
  };
  private listeners: Array<(state: NetworkState) => void> = [];
  private reconnectionTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeNetworkMonitoring();
  }

  static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring(): void {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Check connection type if available
    this.updateConnectionType();

    // Initial state
    this.networkState.isOnline = navigator.onLine;
    if (this.networkState.isOnline) {
      this.networkState.lastOnlineAt = Date.now();
    } else {
      this.networkState.lastOfflineAt = Date.now();
    }

    console.log('🌐 Network monitoring initialized', this.networkState);
  }

  /**
   * Handle coming back online
   */
  private async handleOnline(): Promise<void> {
    console.log('🌐 Device came back online');
    
    const wasOffline = !this.networkState.isOnline;
    this.networkState.isOnline = true;
    this.networkState.lastOnlineAt = Date.now();
    this.updateConnectionType();

    // Notify listeners
    this.notifyListeners();

    // If we were offline, trigger token validation and refresh
    if (wasOffline) {
      console.log('🔄 Triggering token validation after reconnection...');
      
      // Wait a moment for connection to stabilize
      setTimeout(async () => {
        try {
          await TokenRefreshService.checkAndRefreshIfNeeded();
          console.log('✅ Post-reconnection token validation completed');
        } catch (error) {
          console.error('❌ Post-reconnection token validation failed:', error);
        }
      }, 2000);
    }
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    console.log('📱 Device went offline');
    
    this.networkState.isOnline = false;
    this.networkState.lastOfflineAt = Date.now();

    // Clear any pending reconnection timer
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Update connection type information
   */
  private updateConnectionType(): void {
    // Use Network Information API if available
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      switch (connection.type) {
        case 'wifi':
          this.networkState.connectionType = 'wifi';
          break;
        case 'cellular':
          this.networkState.connectionType = 'cellular';
          break;
        case 'ethernet':
          this.networkState.connectionType = 'ethernet';
          break;
        default:
          this.networkState.connectionType = 'unknown';
      }
    } else {
      this.networkState.connectionType = 'unknown';
    }
  }

  /**
   * Get current network state
   */
  getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  /**
   * Check if device is currently online
   */
  isOnline(): boolean {
    return this.networkState.isOnline;
  }

  /**
   * Get current connection type
   */
  getConnectionType(): 'wifi' | 'cellular' | 'ethernet' | 'unknown' {
    return this.networkState.connectionType;
  }

  /**
   * Add network state change listener
   */
  addNetworkListener(listener: (state: NetworkState) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove network state change listener
   */
  removeNetworkListener(listener: (state: NetworkState) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners of network state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getNetworkState());
      } catch (error) {
        console.error('❌ Error notifying network listener:', error);
      }
    });
  }

  /**
   * Test network connectivity with API endpoint
   */
  async testConnectivity(): Promise<{
    isReachable: boolean;
    responseTime?: number;
    error?: string;
  }> {
    if (!this.networkState.isOnline) {
      return {
        isReachable: false,
        error: 'Device is offline',
      };
    }

    try {
      const startTime = Date.now();

      // Smart API URL selection - same logic as apiService
      const getApiBaseUrl = () => {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

        // Priority order for API URL selection:
        // 1. Smart Static IP selection with fallback
        // For local machine accessing via network IP, use local network instead of static IP
        // This works around the hairpin NAT issue
        if (hostname === '10.100.100.30' && import.meta.env.VITE_API_BASE_URL_DEVICE) {
          return import.meta.env.VITE_API_BASE_URL_DEVICE;
        }

        // 2. Use Static IP URL if available (PRIMARY for internet access)
        if (import.meta.env.VITE_API_BASE_URL_STATIC_IP) {
          return import.meta.env.VITE_API_BASE_URL_STATIC_IP;
        }

        // 2. Use network URL if not on localhost (local network access)
        if (!isLocalhost && import.meta.env.VITE_API_BASE_URL_DEVICE) {
          return import.meta.env.VITE_API_BASE_URL_DEVICE;
        }

        // 3. Use localhost URL for local development
        return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
      };

      const API_BASE_URL = getApiBaseUrl();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      return {
        isReachable: response.ok,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        isReachable: false,
        error: error instanceof Error ? error.message : 'Network test failed',
      };
    }
  }

  /**
   * Get network status summary for UI display
   */
  getNetworkStatus(): {
    status: 'online' | 'offline' | 'limited';
    message: string;
    lastChange?: string;
    connectionType: string;
  } {
    const state = this.getNetworkState();
    
    if (state.isOnline) {
      return {
        status: 'online',
        message: 'Connected',
        lastChange: state.lastOnlineAt ? new Date(state.lastOnlineAt).toLocaleTimeString() : undefined,
        connectionType: state.connectionType,
      };
    } else {
      return {
        status: 'offline',
        message: 'No internet connection',
        lastChange: state.lastOfflineAt ? new Date(state.lastOfflineAt).toLocaleTimeString() : undefined,
        connectionType: 'none',
      };
    }
  }

  /**
   * Start periodic connectivity checks
   */
  startPeriodicConnectivityCheck(): void {
    // Check connectivity every 5 minutes when online
    setInterval(async () => {
      if (this.networkState.isOnline) {
        const result = await this.testConnectivity();
        if (!result.isReachable) {
          console.log('⚠️ Connectivity test failed despite being "online"');
          // Could trigger a more thorough check or notification
        }
      }
    }, 5 * 60 * 1000);

    console.log('🌐 Periodic connectivity checks started');
  }

  /**
   * Handle app coming to foreground (for mobile apps)
   */
  handleAppForeground(): void {
    console.log('📱 App came to foreground, checking connectivity...');
    
    // Update online status
    const wasOnline = this.networkState.isOnline;
    this.networkState.isOnline = navigator.onLine;
    
    if (!wasOnline && this.networkState.isOnline) {
      // We came back online while app was in background
      this.handleOnline();
    } else if (this.networkState.isOnline) {
      // We were online, but test actual connectivity
      setTimeout(async () => {
        const result = await this.testConnectivity();
        if (result.isReachable) {
          // Trigger token validation since we might have been away for a while
          try {
            await TokenRefreshService.checkAndRefreshIfNeeded();
          } catch (error) {
            console.error('❌ Foreground token validation failed:', error);
          }
        }
      }, 1000);
    }
  }
}

// Export singleton instance
export default NetworkService.getInstance();
