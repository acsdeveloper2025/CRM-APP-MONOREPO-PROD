/**
 * Firebase Configuration Validation and Setup
 */

import { Capacitor } from '@capacitor/core';

// Platform detection
const isNative = Capacitor.isNativePlatform();

// Firebase configuration validation
export const validateFirebaseConfig = () => {
  if (isNative) {
    // Native apps use google-services.json / GoogleService-Info.plist
    console.log('🔥 Native Firebase: Configuration loaded from platform files');
    return true;
  } else {
    // Web apps use environment variables
    const requiredEnvVars = [
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);

    if (missingVars.length > 0) {
      console.error('🚨 Missing Firebase environment variables:', missingVars);
      console.error('📝 Please check your .env.production file and ensure all Firebase variables are set');
      return false;
    }

    console.log('🔥 Web Firebase: Configuration loaded from environment variables');
    return true;
  }
};

// Get Firebase configuration for web
export const getWebFirebaseConfig = () => {
  if (isNative) {
    return null; // Native apps don't use web config
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  };
};

// Firebase initialization status
export const getFirebaseStatus = () => {
  const isConfigValid = validateFirebaseConfig();
  
  return {
    platform: isNative ? 'native' : 'web',
    configValid: isConfigValid,
    configSource: isNative ? 'platform-files' : 'environment-variables',
    projectId: isNative ? 'from-platform-config' : import.meta.env.VITE_FIREBASE_PROJECT_ID || 'not-set'
  };
};

// Debug Firebase configuration (safe for logging)
export const debugFirebaseConfig = () => {
  const status = getFirebaseStatus();
  
  console.log('🔥 Firebase Configuration Debug:');
  console.log('  Platform:', status.platform);
  console.log('  Config Valid:', status.configValid);
  console.log('  Config Source:', status.configSource);
  console.log('  Project ID:', status.projectId);
  
  if (!isNative) {
    const config = getWebFirebaseConfig();
    console.log('  Web Config Keys:', config ? Object.keys(config) : 'none');
  }
  
  return status;
};
