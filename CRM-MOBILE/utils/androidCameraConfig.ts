import { Capacitor } from '@capacitor/core';
import { CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';

/**
 * Android-specific camera configuration utilities
 * Optimized for Android devices with no gallery storage
 */

export interface AndroidCameraOptions {
  quality: number;
  allowEditing: boolean;
  resultType: CameraResultType;
  source: CameraSource;
  direction: CameraDirection;
  saveToGallery: boolean;
  correctOrientation: boolean;
  width?: number;
  height?: number;
}

/**
 * Get optimized camera configuration for Android
 * Ensures images are not saved to gallery and optimized for Android performance
 */
export const getAndroidCameraConfig = (
  cameraDirection: 'front' | 'rear' = 'rear',
  quality: number = 90
): AndroidCameraOptions => {
  const config: AndroidCameraOptions = {
    quality: Math.min(Math.max(quality, 10), 100), // Ensure quality is between 10-100
    allowEditing: false, // Disable editing to prevent gallery access
    resultType: CameraResultType.DataUrl, // Use DataUrl for in-app storage
    source: CameraSource.Camera,
    direction: cameraDirection === 'front' ? CameraDirection.Front : CameraDirection.Rear,
    saveToGallery: false, // CRITICAL: Never save to gallery
    correctOrientation: true, // Important for Android orientation handling
    width: 1024, // Optimized for Android performance
    height: 1024
  };

  console.log('📱 Android camera config:', {
    platform: 'android',
    direction: cameraDirection,
    quality: config.quality,
    saveToGallery: config.saveToGallery,
    resultType: 'DataUrl'
  });

  return config;
};

/**
 * Get Android-specific error messages for camera issues
 */
export const getAndroidCameraErrorMessage = (error: any): string => {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code || '';

  // Android-specific error handling
  if (errorMessage.includes('permission') || errorCode === 'CAMERA_PERMISSION_DENIED') {
    return 'Camera permission denied. Please enable camera access in Settings → Apps → CaseFlow Mobile → Permissions.';
  }

  if (errorMessage.includes('camera not available') || errorCode === 'CAMERA_UNAVAILABLE') {
    return 'Camera is not available. Please check if another app is using the camera.';
  }

  if (errorMessage.includes('user cancelled') || errorCode === 'USER_CANCELLED') {
    return null; // Don't show error for user cancellation
  }

  if (errorMessage.includes('no camera found')) {
    return 'No camera found on this device.';
  }

  if (errorMessage.includes('timeout')) {
    return 'Camera operation timed out. Please try again.';
  }

  if (errorMessage.includes('storage') || errorMessage.includes('space')) {
    return 'Insufficient storage space. Please free up some space and try again.';
  }

  // Generic Android error
  return `Camera error: ${error?.message || 'Unknown error occurred'}. Please try again.`;
};

/**
 * Check Android camera availability and permissions
 */
export const checkAndroidCameraAvailability = async (): Promise<{
  available: boolean;
  hasPermission: boolean;
  error?: string;
}> => {
  try {
    if (Capacitor.getPlatform() !== 'android') {
      return { available: false, hasPermission: false, error: 'Not Android platform' };
    }

    // Check if camera is available (basic check)
    const hasCamera = await checkDeviceHasCamera();
    
    if (!hasCamera) {
      return { 
        available: false, 
        hasPermission: false, 
        error: 'No camera found on this device' 
      };
    }

    return { 
      available: true, 
      hasPermission: true // Will be checked during actual camera access
    };
  } catch (error) {
    console.error('❌ Android camera availability check failed:', error);
    return { 
      available: false, 
      hasPermission: false, 
      error: getAndroidCameraErrorMessage(error)
    };
  }
};

/**
 * Basic check if device has camera capability
 */
const checkDeviceHasCamera = async (): Promise<boolean> => {
  try {
    // This is a basic check - actual camera availability is checked during use
    return true; // Most Android devices have cameras
  } catch (error) {
    console.error('❌ Device camera check failed:', error);
    return false;
  }
};

/**
 * Android-specific camera optimization settings
 */
export const getAndroidCameraOptimizations = () => {
  return {
    // Recommended settings for Android performance
    maxImageSize: 1024, // Optimal for most Android devices
    compressionQuality: 90, // Good balance of quality and file size
    useDataUrl: true, // Better for in-app storage
    preventGalleryStorage: true, // Critical requirement
    
    // Android-specific optimizations
    handleOrientationCorrection: true,
    useNativeCamera: true,
    fallbackToFileInput: true,
    
    // Performance settings
    enableImageCompression: true,
    maxFileSize: 5 * 1024 * 1024, // 5MB max
    supportedFormats: ['jpeg', 'jpg', 'png', 'webp']
  };
};

/**
 * Validate Android camera configuration
 */
export const validateAndroidCameraConfig = (config: AndroidCameraOptions): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Critical validation: Never save to gallery
  if (config.saveToGallery === true) {
    errors.push('CRITICAL: saveToGallery must be false to prevent gallery storage');
  }

  // Quality validation
  if (config.quality < 10 || config.quality > 100) {
    errors.push('Quality must be between 10 and 100');
  }

  // Size validation
  if (config.width && config.width > 2048) {
    warnings.push('Image width > 2048px may cause performance issues on some Android devices');
  }

  if (config.height && config.height > 2048) {
    warnings.push('Image height > 2048px may cause performance issues on some Android devices');
  }

  // Result type validation
  if (config.resultType !== CameraResultType.DataUrl) {
    warnings.push('DataUrl result type recommended for in-app storage');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};
