/**
 * Environment Configuration for CaseFlow Mobile
 * Manages API keys and environment-specific settings
 */

export interface EnvironmentConfig {
  googleMaps: {
    apiKey: string;
    libraries: string[];
    region: string;
    language: string;
  };
  nominatim: {
    baseUrl: string;
    userAgent: string;
  };
  app: {
    environment: 'development' | 'production';
    version: string;
  };
}

// Default configuration
const defaultConfig: EnvironmentConfig = {
  googleMaps: {
    apiKey: '', // Will be set from environment or fallback
    libraries: ['places', 'geometry'],
    region: 'IN', // India
    language: 'en'
  },
  nominatim: {
    baseUrl: 'https://nominatim.openstreetmap.org',
    userAgent: 'CaseFlow-Mobile/4.0.0'
  },
  app: {
    environment: 'development',
    version: '4.0.0'
  }
};

/**
 * Get environment configuration
 * Supports multiple sources: environment variables, localStorage, fallback
 */
export const getEnvironmentConfig = (): EnvironmentConfig => {
  const config = { ...defaultConfig };

  // Try to get Google Maps API key from various sources
  const googleMapsApiKey =
    // 1. Environment variable (for web builds)
    (import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
    // 2. Local storage (for runtime configuration)
    (typeof window !== 'undefined' ? localStorage.getItem('GOOGLE_MAPS_API_KEY') : null) ||
    // 3. No fallback - API key must be provided via environment variable
    '';

  config.googleMaps.apiKey = googleMapsApiKey;

  // Set environment based on build mode
  config.app.environment = import.meta.env?.MODE === 'production' ? 'production' : 'development';

  return config;
};

/**
 * Update Google Maps API key at runtime
 * Useful for dynamic configuration in mobile apps
 */
export const setGoogleMapsApiKey = (apiKey: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('GOOGLE_MAPS_API_KEY', apiKey);
  }
};

/**
 * Validate environment configuration
 */
export const validateEnvironmentConfig = (config: EnvironmentConfig): boolean => {
  if (!config.googleMaps.apiKey) {
    console.warn('Google Maps API key is not configured. Please set VITE_GOOGLE_MAPS_API_KEY environment variable.');
    return false;
  }

  if (config.googleMaps.apiKey.startsWith('AIzaSy')) {
    console.log('Using configured Google Maps API key');
  } else {
    console.warn('Google Maps API key format appears invalid');
    return false;
  }

  return true;
};

export default getEnvironmentConfig;
