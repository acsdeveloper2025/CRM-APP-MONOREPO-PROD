/**
 * Enhanced Geolocation Service for CaseFlow Mobile
 * Combines Capacitor Geolocation with Google Maps API for enhanced functionality
 */

import { Geolocation } from '@capacitor/geolocation';
import { googleMapsService, LocationData, AddressComponents } from './googleMapsService';

export interface EnhancedLocationData extends LocationData {
  address?: AddressComponents;
  source: 'capacitor' | 'browser' | 'cached';
  validationResult?: any;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  includeAddress?: boolean;
  validateLocation?: boolean;
  fallbackToNominatim?: boolean;
  retryAttempts?: number;
  fallbackToIPGeolocation?: boolean;
}

export interface GeolocationError {
  code: number;
  message: string;
  userMessage: string;
  actionable: string;
}

class EnhancedGeolocationService {
  private lastKnownLocation: EnhancedLocationData | null = null;
  private locationCache = new Map<string, { location: EnhancedLocationData; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

  /**
   * Get current location with enhanced features and retry logic
   */
  async getCurrentLocation(options: GeolocationOptions = {}): Promise<EnhancedLocationData> {
    const defaultOptions: GeolocationOptions = {
      enableHighAccuracy: true,
      timeout: 15000, // Increased to 15 seconds
      maximumAge: 60000,
      includeAddress: true,
      validateLocation: true,
      fallbackToNominatim: true,
      retryAttempts: this.MAX_RETRY_ATTEMPTS,
      fallbackToIPGeolocation: true,
      ...options
    };

    console.log('🌍 Starting location acquisition with options:', defaultOptions);

    // Strategy 1: Try high-accuracy GPS with retries
    try {
      return await this.getLocationWithRetry(defaultOptions);
    } catch (highAccuracyError) {
      console.warn('❌ High-accuracy location failed after retries:', highAccuracyError);

      // Strategy 2: Try low-accuracy GPS (faster, less battery)
      try {
        console.log('🔄 Trying low-accuracy mode...');
        const lowAccuracyOptions = { ...defaultOptions, enableHighAccuracy: false, timeout: 10000 };
        return await this.getLocationWithRetry(lowAccuracyOptions);
      } catch (lowAccuracyError) {
        console.warn('❌ Low-accuracy location also failed:', lowAccuracyError);

        // Strategy 3: Use cached location if available and recent
        if (this.lastKnownLocation) {
          const cacheAge = Date.now() - (this.lastKnownLocation.timestamp || 0);
          if (cacheAge < this.CACHE_DURATION) {
            console.warn('⚠️ Using cached location (age: ' + Math.round(cacheAge / 1000) + 's)');
            return { ...this.lastKnownLocation, source: 'cached' };
          }
        }

        // Strategy 4: IP-based geolocation as last resort
        if (defaultOptions.fallbackToIPGeolocation) {
          try {
            console.log('🌐 Trying IP-based geolocation as last resort...');
            return await this.getIPBasedLocation();
          } catch (ipError) {
            console.error('❌ IP-based geolocation failed:', ipError);
          }
        }

        throw this.createGeolocationError(highAccuracyError);
      }
    }
  }

  /**
   * Get location with retry logic and exponential backoff
   */
  private async getLocationWithRetry(options: GeolocationOptions): Promise<EnhancedLocationData> {
    const maxAttempts = options.retryAttempts || this.MAX_RETRY_ATTEMPTS;
    let lastError: any;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`📍 Location attempt ${attempt + 1}/${maxAttempts} (${options.enableHighAccuracy ? 'high' : 'low'} accuracy)`);

        // Try Capacitor Geolocation first (works on mobile)
        try {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: options.enableHighAccuracy,
            timeout: options.timeout,
            maximumAge: options.maximumAge
          });

          const locationData: EnhancedLocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            source: 'capacitor'
          };

          console.log(`✅ Location acquired (accuracy: ${position.coords.accuracy?.toFixed(0)}m)`);
          return await this.enhanceLocationData(locationData, options);

        } catch (capacitorError) {
          console.warn('Capacitor Geolocation failed, trying browser API:', capacitorError);

          // Fallback to browser geolocation API
          const position = await this.getBrowserLocation(options);
          const locationData: EnhancedLocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            source: 'browser'
          };

          console.log(`✅ Location acquired via browser (accuracy: ${position.coords.accuracy?.toFixed(0)}m)`);
          return await this.enhanceLocationData(locationData, options);
        }

      } catch (error) {
        lastError = error;
        console.warn(`❌ Attempt ${attempt + 1} failed:`, error);

        // Don't retry if it's a permission denial
        if (this.isPermissionDenied(error)) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxAttempts - 1) {
          const delay = this.RETRY_DELAYS[attempt] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Location acquisition failed after all retries');
  }

  /**
   * Enhance location data with address and validation
   */
  private async enhanceLocationData(
    locationData: EnhancedLocationData, 
    options: GeolocationOptions
  ): Promise<EnhancedLocationData> {
    const enhanced = { ...locationData };

    // Add address information if requested
    if (options.includeAddress) {
      enhanced.address = await this.getAddressForLocation(locationData, options.fallbackToNominatim);
    }

    // Validate location if requested
    if (options.validateLocation && googleMapsService.isAvailable()) {
      enhanced.validationResult = await googleMapsService.validateLocation(locationData);
    }

    // Cache the enhanced location
    this.lastKnownLocation = enhanced;
    this.cacheLocation(enhanced);

    return enhanced;
  }

  /**
   * Get address for location using Google Maps or Nominatim fallback
   */
  private async getAddressForLocation(
    location: LocationData, 
    fallbackToNominatim = true
  ): Promise<AddressComponents | undefined> {
    // Check cache first
    const cacheKey = `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`;
    const cached = this.locationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.location.address;
    }

    // Try Google Maps first
    if (googleMapsService.isAvailable()) {
      try {
        const address = await googleMapsService.reverseGeocode(location);
        if (address) {
          return address;
        }
      } catch (error) {
        console.warn('Google Maps reverse geocoding failed:', error);
      }
    }

    // Fallback to Nominatim if enabled
    if (fallbackToNominatim) {
      try {
        const address = await this.reverseGeocodeWithNominatim(location);
        return address;
      } catch (error) {
        console.warn('Nominatim reverse geocoding failed:', error);
      }
    }

    return undefined;
  }

  /**
   * Fallback reverse geocoding using Nominatim (OpenStreetMap)
   */
  private async reverseGeocodeWithNominatim(location: LocationData): Promise<AddressComponents | undefined> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CaseFlow-Mobile/2.1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.address) {
        return {
          streetNumber: data.address.house_number,
          streetName: data.address.road,
          locality: data.address.city || data.address.town || data.address.village,
          subLocality: data.address.suburb || data.address.neighbourhood,
          administrativeArea: data.address.state,
          postalCode: data.address.postcode,
          country: data.address.country,
          formattedAddress: data.display_name
        };
      }

      return undefined;
    } catch (error) {
      console.error('Nominatim reverse geocoding error:', error);
      return undefined;
    }
  }

  /**
   * Browser geolocation API wrapper
   */
  private getBrowserLocation(options: GeolocationOptions): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Browser geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: options.enableHighAccuracy,
          timeout: options.timeout,
          maximumAge: options.maximumAge
        }
      );
    });
  }

  /**
   * Get location using IP-based geolocation (last resort fallback)
   * Uses ipapi.co free API (no API key required, 1000 requests/day limit)
   */
  private async getIPBasedLocation(): Promise<EnhancedLocationData> {
    try {
      const response = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        headers: {
          'User-Agent': 'CaseFlow-Mobile/2.1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`IP geolocation API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.latitude || !data.longitude) {
        throw new Error('Invalid IP geolocation response');
      }

      const locationData: EnhancedLocationData = {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: 5000, // IP-based location is very inaccurate (typically 5-50km)
        timestamp: Date.now(),
        source: 'browser', // Mark as browser to indicate it's a fallback
        address: {
          locality: data.city,
          administrativeArea: data.region,
          postalCode: data.postal,
          country: data.country_name,
          formattedAddress: `${data.city}, ${data.region}, ${data.country_name}`
        }
      };

      console.warn('⚠️ Using IP-based location (low accuracy: ~5-50km)');
      this.lastKnownLocation = locationData;
      return locationData;

    } catch (error) {
      console.error('IP-based geolocation failed:', error);
      throw new Error('IP-based geolocation unavailable');
    }
  }

  /**
   * Check if error is a permission denial
   */
  private isPermissionDenied(error: any): boolean {
    if (error && typeof error === 'object' && 'code' in error) {
      return error.code === 1; // GeolocationPositionError.PERMISSION_DENIED
    }
    return false;
  }

  /**
   * Create user-friendly geolocation error
   */
  private createGeolocationError(error: any): GeolocationError {
    if (error && typeof error === 'object' && 'code' in error) {
      const geoError = error as GeolocationPositionError;

      switch (geoError.code) {
        case 1: // PERMISSION_DENIED
          return {
            code: 1,
            message: 'Location permission denied',
            userMessage: 'Location access is required to tag photos with GPS coordinates',
            actionable: 'Please enable location permissions in your device settings'
          };
        case 2: // POSITION_UNAVAILABLE
          return {
            code: 2,
            message: 'Position unavailable',
            userMessage: 'Unable to determine your location',
            actionable: 'Please ensure GPS is enabled and you are in an area with good signal. Try moving to an open area or near a window.'
          };
        case 3: // TIMEOUT
          return {
            code: 3,
            message: 'Location request timeout',
            userMessage: 'Location request took too long',
            actionable: 'Please try again. If the problem persists, try moving to an area with better GPS signal.'
          };
        default:
          return {
            code: 0,
            message: 'Unknown geolocation error',
            userMessage: 'Unable to get your location',
            actionable: 'Please check your device settings and try again'
          };
      }
    }

    return {
      code: 0,
      message: error?.message || 'Unknown error',
      userMessage: 'Unable to get your location',
      actionable: 'Please check your device settings and try again'
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cache location data
   */
  private cacheLocation(location: EnhancedLocationData): void {
    const cacheKey = `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`;
    this.locationCache.set(cacheKey, {
      location,
      timestamp: Date.now()
    });

    // Clean old cache entries
    this.cleanCache();
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.locationCache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.locationCache.delete(key);
      }
    }
  }

  /**
   * Get last known location
   */
  getLastKnownLocation(): EnhancedLocationData | null {
    return this.lastKnownLocation;
  }

  /**
   * Clear location cache
   */
  clearCache(): void {
    this.locationCache.clear();
    this.lastKnownLocation = null;
  }

  /**
   * Get detailed error information for user feedback
   */
  getErrorInfo(error: any): GeolocationError {
    return this.createGeolocationError(error);
  }
}

// Export singleton instance
export const enhancedGeolocationService = new EnhancedGeolocationService();
export default enhancedGeolocationService;
