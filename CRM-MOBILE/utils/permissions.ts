import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';

export interface PermissionStatus {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
  restricted?: boolean;
}

export interface PermissionResult {
  camera: PermissionStatus;
  location: PermissionStatus;
  notifications: PermissionStatus;
}

export interface PermissionRequestOptions {
  showRationale?: boolean;
  fallbackToSettings?: boolean;
  context?: string; // Context for why permission is needed
}

/**
 * Request camera permissions with enhanced error handling
 */
export const requestCameraPermissions = async (options: PermissionRequestOptions = {}): Promise<PermissionStatus> => {
  try {
    if (Capacitor.isNativePlatform()) {
      // First check current status
      const currentStatus = await Camera.checkPermissions();

      // If already granted, return immediately
      if (currentStatus.camera === 'granted' && currentStatus.photos === 'granted') {
        return { granted: true, denied: false, prompt: false };
      }

      // If denied and we should show rationale
      if (options.showRationale && (currentStatus.camera === 'denied' || currentStatus.photos === 'denied')) {
        const context = options.context || 'take verification photos';
        showPermissionRationale('Camera', `Camera access is required to ${context}. This helps ensure accurate verification.`);
      }

      // Request permissions
      const permissions = await Camera.requestPermissions({
        permissions: ['camera', 'photos']
      });

      console.log('📷 Camera permission request result:', permissions);

      const cameraStatus = permissions.camera;
      const photosStatus = permissions.photos;

      const result = {
        granted: cameraStatus === 'granted' && photosStatus === 'granted',
        denied: cameraStatus === 'denied' || photosStatus === 'denied',
        prompt: cameraStatus === 'prompt' || photosStatus === 'prompt'
      };

      if (result.denied && options.fallbackToSettings) {
        showPermissionDeniedAlert('Camera');
      }

      return result;
    } else {
      // Web platform - check MediaDevices API
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ Web camera access granted');
        return { granted: true, denied: false, prompt: false };
      } catch (error) {
        console.warn('❌ Web camera access denied:', error);
        return { granted: false, denied: true, prompt: false };
      }
    }
  } catch (error) {
    console.error('❌ Camera permission request failed:', error);
    return { granted: false, denied: true, prompt: false };
  }
};

/**
 * Request location permissions with enhanced error handling
 */
export const requestLocationPermissions = async (options: PermissionRequestOptions = {}): Promise<PermissionStatus> => {
  try {
    console.log('📍 Requesting location permissions...');

    if (Capacitor.isNativePlatform()) {
      // First check current status
      const currentStatus = await Geolocation.checkPermissions();
      console.log('📍 Current location permissions:', currentStatus);

      // If already granted, return immediately
      if (currentStatus.location === 'granted') {
        console.log('✅ Location permissions already granted');
        return { granted: true, denied: false, prompt: false };
      }

      // If denied and we should show rationale
      if (options.showRationale && currentStatus.location === 'denied') {
        const context = options.context || 'tag photos with accurate location data';
        showPermissionRationale('Location', `Location access is required to ${context}. This helps verify the authenticity of field inspections.`);
      }

      // Request permissions
      const permissions = await Geolocation.requestPermissions({
        permissions: ['location']
      });

      console.log('📍 Location permission request result:', permissions);

      const locationStatus = permissions.location;

      const result = {
        granted: locationStatus === 'granted',
        denied: locationStatus === 'denied',
        prompt: locationStatus === 'prompt'
      };

      if (result.denied && options.fallbackToSettings) {
        showPermissionDeniedAlert('Location');
      }

      return result;
    } else {
      // Web platform - check Geolocation API permission status
      // Use Permissions API if available for more accurate permission checking
      if ('permissions' in navigator) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          console.log('📍 Web location permission status:', permissionStatus.state);

          return {
            granted: permissionStatus.state === 'granted',
            denied: permissionStatus.state === 'denied',
            prompt: permissionStatus.state === 'prompt'
          };
        } catch (permError) {
          console.warn('Permissions API not fully supported, falling back to getCurrentPosition check:', permError);
        }
      }

      // Fallback: Try to get position to check permission
      try {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 8000,
            enableHighAccuracy: false,
            maximumAge: 300000 // Accept cached position up to 5 minutes old
          });
        });
        console.log('✅ Web location access granted');
        return { granted: true, denied: false, prompt: false };
      } catch (error: any) {
        // Differentiate between permission denial and position unavailable
        if (error && typeof error === 'object' && 'code' in error) {
          const geoError = error as GeolocationPositionError;

          if (geoError.code === 1) {
            // PERMISSION_DENIED - User explicitly denied permission
            console.warn('❌ Web location permission denied by user');
            return { granted: false, denied: true, prompt: false };
          } else if (geoError.code === 2) {
            // POSITION_UNAVAILABLE - Permission granted but location unavailable (GPS off, no signal, etc.)
            console.warn('⚠️ Web location unavailable (GPS off or no signal), but permission is granted');
            return { granted: true, denied: false, prompt: false };
          } else if (geoError.code === 3) {
            // TIMEOUT - Request timed out, assume permission granted
            console.warn('⏱️ Web location timeout, assuming permission granted');
            return { granted: true, denied: false, prompt: false };
          }
        }

        // Unknown error - treat as denied for safety
        console.warn('❌ Web location access error (unknown):', error);
        return { granted: false, denied: true, prompt: false };
      }
    }
  } catch (error) {
    console.error('❌ Location permission request failed:', error);
    return { granted: false, denied: true, prompt: false };
  }
};

/**
 * Request notification permissions with enhanced error handling
 */
export const requestNotificationPermissions = async (options: PermissionRequestOptions = {}): Promise<PermissionStatus> => {
  try {
    console.log('🔔 Requesting notification permissions...');

    if (Capacitor.isNativePlatform()) {
      // First check current status
      const currentStatus = await LocalNotifications.checkPermissions();
      console.log('🔔 Current notification permissions:', currentStatus);

      // If already granted, return immediately
      if (currentStatus.display === 'granted') {
        console.log('✅ Notification permissions already granted');
        return { granted: true, denied: false, prompt: false };
      }

      // If denied and we should show rationale
      if (options.showRationale && currentStatus.display === 'denied') {
        const context = options.context || 'receive important verification updates and reminders';
        showPermissionRationale('Notifications', `Notification access is required to ${context}. This helps keep you informed about case status changes.`);
      }

      // Request local notification permissions (more commonly used)
      const localPerms = await LocalNotifications.requestPermissions();
      console.log('🔔 Notification permission request result:', localPerms);

      const localStatus = localPerms.display;

      const result = {
        granted: localStatus === 'granted',
        denied: localStatus === 'denied',
        prompt: localStatus === 'prompt'
      };

      if (result.denied && options.fallbackToSettings) {
        showPermissionDeniedAlert('Notifications');
      }

      return result;
    } else {
      // Web platform - check Notification API
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        console.log('🔔 Web notification permission result:', permission);
        return {
          granted: permission === 'granted',
          denied: permission === 'denied',
          prompt: permission === 'default'
        };
      } else {
        console.warn('❌ Notifications not supported in this browser');
        return { granted: false, denied: true, prompt: false };
      }
    }
  } catch (error) {
    console.error('❌ Notification permission request failed:', error);
    return { granted: false, denied: true, prompt: false };
  }
};

/**
 * Check current permission status without requesting
 */
export const checkPermissions = async (): Promise<PermissionResult> => {
  try {
    const [cameraPerms, locationPerms, notificationPerms] = await Promise.all([
      Camera.checkPermissions(),
      Geolocation.checkPermissions(),
      LocalNotifications.checkPermissions()
    ]);

    return {
      camera: {
        granted: cameraPerms.camera === 'granted' && cameraPerms.photos === 'granted',
        denied: cameraPerms.camera === 'denied' || cameraPerms.photos === 'denied',
        prompt: cameraPerms.camera === 'prompt' || cameraPerms.photos === 'prompt'
      },
      location: {
        granted: locationPerms.location === 'granted',
        denied: locationPerms.location === 'denied',
        prompt: locationPerms.location === 'prompt'
      },
      notifications: {
        granted: notificationPerms.display === 'granted',
        denied: notificationPerms.display === 'denied',
        prompt: notificationPerms.display === 'prompt'
      }
    };
  } catch (error) {
    console.error('Permission check failed:', error);
    return {
      camera: { granted: false, denied: true, prompt: false },
      location: { granted: false, denied: true, prompt: false },
      notifications: { granted: false, denied: true, prompt: false }
    };
  }
};

/**
 * Show permission rationale dialog
 */
export const showPermissionRationale = (permissionType: string, message: string) => {
  if (confirm(`${permissionType} Permission Required\n\n${message}\n\nWould you like to grant this permission now?`)) {
    return true;
  }
  return false;
};

/**
 * Initialize app permissions on startup
 */
export const initializeAppPermissions = async (): Promise<PermissionResult> => {
  console.log('🚀 Initializing app permissions...');

  try {
    // Check current permissions first
    const currentPermissions = await checkPermissions();
    console.log('📋 Current permission status:', currentPermissions);

    // Request permissions that are not yet granted
    const results: PermissionResult = {
      camera: currentPermissions.camera,
      location: currentPermissions.location,
      notifications: currentPermissions.notifications
    };

    // Request camera permissions if not granted
    if (!currentPermissions.camera.granted && !currentPermissions.camera.denied) {
      console.log('📷 Requesting camera permissions on startup...');
      results.camera = await requestCameraPermissions({
        showRationale: true,
        context: 'capture verification photos and selfies'
      });
    }

    // Request location permissions if not granted
    if (!currentPermissions.location.granted && !currentPermissions.location.denied) {
      console.log('📍 Requesting location permissions on startup...');
      results.location = await requestLocationPermissions({
        showRationale: true,
        context: 'tag photos with GPS coordinates for verification'
      });
    }

    // Request notification permissions if not granted
    if (!currentPermissions.notifications.granted && !currentPermissions.notifications.denied) {
      console.log('🔔 Requesting notification permissions on startup...');
      results.notifications = await requestNotificationPermissions({
        showRationale: true,
        context: 'receive important case updates and reminders'
      });
    }

    console.log('✅ App permissions initialization complete:', results);
    return results;
  } catch (error) {
    console.error('❌ Failed to initialize app permissions:', error);
    return {
      camera: { granted: false, denied: true, prompt: false },
      location: { granted: false, denied: true, prompt: false },
      notifications: { granted: false, denied: true, prompt: false }
    };
  }
};

/**
 * Request all permissions at once with enhanced options
 */
export const requestAllPermissions = async (options: PermissionRequestOptions = {}): Promise<PermissionResult> => {
  console.log('🔐 Requesting all permissions...');

  const [camera, location, notifications] = await Promise.all([
    requestCameraPermissions(options),
    requestLocationPermissions(options),
    requestNotificationPermissions(options)
  ]);

  const result = { camera, location, notifications };
  console.log('🔐 All permissions request complete:', result);
  return result;
};

/**
 * Show permission denied alert with instructions
 */
export const showPermissionDeniedAlert = (permissionType: string) => {
  const platform = Capacitor.getPlatform();
  const instructions = platform === 'ios'
    ? 'Settings > CaseFlow Mobile > Permissions'
    : 'Settings > Apps > CaseFlow Mobile > Permissions';

  const messages = {
    Camera: 'Camera access is required to capture verification photos and selfies for identity verification.',
    Location: 'Location access is required to tag photos with GPS coordinates for verification purposes.',
    Notifications: 'Notification access is required to receive important verification updates and reminders.'
  };

  const message = messages[permissionType as keyof typeof messages] ||
    `${permissionType} access is required for this app to function properly.`;

  const alertMessage = `${permissionType} Permission Denied\n\n` +
    `${message}\n\n` +
    `To enable this permission:\n` +
    `1. Go to ${instructions}\n` +
    `2. Enable ${permissionType}\n` +
    `3. Return to the app and try again`;

  alert(alertMessage);
};

/**
 * Open device settings for the app (iOS only)
 */
export const openAppSettings = async (): Promise<void> => {
  try {
    if (Capacitor.getPlatform() === 'ios') {
      // Use window.open for iOS settings
      window.open('app-settings:', '_system');
    } else {
      // For Android, we can't directly open app settings
      console.log('Opening app settings not supported on this platform');
    }
  } catch (error) {
    console.error('Failed to open app settings:', error);
  }
};
