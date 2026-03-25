import { triggerLogout } from '@/utils/events';
import { STORAGE_KEYS, SYNC_KEYS } from '@/types/constants';
import { apiService } from './api';

// Timeouts in seconds
const WARNING_TIMEOUT = 540; // 9 minutes
const LOGOUT_TIMEOUT = 600; // 10 minutes
const CHECK_INTERVAL = 1000; // 1 second

type TimeoutCallback = (remainingSeconds: number) => void;

class SessionManager {
  private lastActivityTime: number = Date.now();
  private warningCallback: TimeoutCallback | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private eventListenersAttached = false;
  private storageListenerAttached = false;

  private events = [
    'mousemove',
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'visibilitychange',
    'click'
  ];

  constructor() {
    // Initialize last activity from storage if available to sync with other tabs immediately
    const storedActivity = localStorage.getItem(SYNC_KEYS.LAST_ACTIVITY);
    if (storedActivity) {
      this.lastActivityTime = parseInt(storedActivity, 10);
    }
  }

  public init(onWarning: TimeoutCallback) {
    if (this.intervalId) {return;} // Already running

    this.warningCallback = onWarning;
    this.startStorageListener();
    this.startActivityListeners();
    this.startPolling();
    this.updateLastActivity(); // Reset on init
  }

  public destroy() {
    this.stopPolling();
    this.stopActivityListeners();
    this.stopStorageListener();
    this.warningCallback = null;
  }

  public resetTimer() {
    this.updateLastActivity();
  }

  // Called when user clicks "Stay Logged In"
  public async extendSession() {
    this.updateLastActivity();
    try {
      // Ping backend to keep server session alive if needed
      await apiService.get('/auth/me'); 
    } catch (error) {
      console.error('Failed to extend backend session', error);
      // Even if backend fails, we reset local timer to avoid immediate loop
    }
  }

  // Force logout (e.g. from "Logout Now" button)
  public logout() {
    this.triggerLogoutAction();
  }

  private updateLastActivity() {
    this.lastActivityTime = Date.now();
    localStorage.setItem(SYNC_KEYS.LAST_ACTIVITY, this.lastActivityTime.toString());
  }

  private startActivityListeners() {
    if (this.eventListenersAttached) {return;}
    
    this.events.forEach(event => {
      window.addEventListener(event, this.handleUserActivity);
    });
    this.eventListenersAttached = true;
  }

  private stopActivityListeners() {
    if (!this.eventListenersAttached) {return;}
    
    this.events.forEach(event => {
      window.removeEventListener(event, this.handleUserActivity);
    });
    this.eventListenersAttached = false;
  }

  private startStorageListener() {
    if (this.storageListenerAttached) {return;}

    window.addEventListener('storage', this.handleStorageEvent);
    this.storageListenerAttached = true;
  }

  private stopStorageListener() {
    if (!this.storageListenerAttached) {return;}

    window.removeEventListener('storage', this.handleStorageEvent);
    this.storageListenerAttached = false;
  }

  // Throttle activity updates to once per second to avoid storage trashing
  private handleUserActivity = () => {
    const now = Date.now();
    // Only update if it's been more than 1 second to improve performance
    if (now - this.lastActivityTime > 1000) {
      this.updateLastActivity();
    }
  };

  private startPolling() {
    this.intervalId = setInterval(this.checkSession, CHECK_INTERVAL);
  }

  private stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private checkSession = () => {
    // 1. Check if persistent session exists (refresh token)
    const hasRefreshToken = !!localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!hasRefreshToken) {
      // No refresh token means we are likely logged out already
      return;
    }

    // 2. Check for active API requests (Pause timer)
    if (apiService.hasActiveRequests()) {
      this.updateLastActivity();
      return;
    }

    // 3. Sync with other tabs (read latest activity)
    const storedActivity = localStorage.getItem(SYNC_KEYS.LAST_ACTIVITY);
    if (storedActivity) {
      const storedTime = parseInt(storedActivity, 10);
      if (storedTime > this.lastActivityTime) {
        this.lastActivityTime = storedTime;
      }
    }

    // 4. Calculate idle time
    const now = Date.now();
    const idleSeconds = Math.floor((now - this.lastActivityTime) / 1000);

    // 5. Check constants
    if (idleSeconds >= LOGOUT_TIMEOUT) {
      this.triggerLogoutAction();
    } else if (idleSeconds >= WARNING_TIMEOUT) {
      if (this.warningCallback) {
        this.warningCallback(LOGOUT_TIMEOUT - idleSeconds);
      }
    }
  };

  private triggerLogoutAction(reason: string = 'Your session has expired. Please login again.') {
    // Avoid double logout
    if (!localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)) {return;}

    // Notify other tabs
    localStorage.setItem(SYNC_KEYS.FORCE_LOGOUT, Date.now().toString());
    
    // Clear local data and memory
    apiService.setAccessToken(null);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    
    // Clean up our listeners
    this.destroy();

    // Trigger app logout with message
    triggerLogout(reason);
    
    // Redirect with reason param for deep link or reload handling
    const encodedReason = encodeURIComponent(reason);
    window.location.href = `/login?reason=${encodedReason}`;
  }

  private handleStorageEvent = (event: StorageEvent) => {
    if (event.key === SYNC_KEYS.FORCE_LOGOUT && event.newValue) {
      // Another tab forced logout
      this.triggerLogoutAction();
    } else if (event.key === SYNC_KEYS.LAST_ACTIVITY && event.newValue) {
      // Activity in another tab
      const remoteTime = parseInt(event.newValue, 10);
      if (remoteTime > this.lastActivityTime) {
        this.lastActivityTime = remoteTime;
      }
    }
  };
}

export const sessionManager = new SessionManager();
