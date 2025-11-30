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
  /**
   * Get current location with progressive degradation strategy
   * Goal: Get the best possible location within ~20-25 seconds
   */
  async getCurrentLocation(options: GeolocationOptions = {}): Promise<EnhancedLocationData> {
    const defaultOptions: GeolocationOptions = {
      includeAddress: true,
      validateLocation: true,
      fallbackToNominatim: true,
      fallbackToIPGeolocation: true,
      ...options
    };

    console.log('🌍 Starting progressive location acquisition...');
    const startTime = Date.now();

    // Helper to check if we are still within overall time budget
    const checkTimeBudget = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > 22000) throw new Error('Overall location timeout exceeded');
    };

    try {
      // STEP 1: High Accuracy - Fast Attempt (5s)
      // Good for when GPS is already hot or user is outdoors
      try {
        console.log('📍 Step 1: High Accuracy (Fast - 5s)');
        return await this.getSingleLocationAttempt({
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 30000
        }, 1000); // Max 1000m accuracy
      } catch (err) {
        console.warn('Step 1 failed:', err);
        checkTimeBudget();
      }

      // STEP 2: High Accuracy - Retry with longer timeout (7s)
      // Gives GPS a bit more time to lock if it was cold
      try {
        console.log('📍 Step 2: High Accuracy (Retry - 7s)');
        return await this.getSingleLocationAttempt({
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 0 // Force fresh
        }, 2000); // Relax accuracy to 2000m
      } catch (err) {
        console.warn('Step 2 failed:', err);
        checkTimeBudget();
      }

      // STEP 3: Low Accuracy / Cell Tower / Wifi (5s)
      // Very fast, works indoors, but less accurate
      try {
        console.log('📍 Step 3: Low Accuracy / Network (5s)');
        return await this.getSingleLocationAttempt({
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 0
        }, 5000); // Relax accuracy to 5000m
      } catch (err) {
        console.warn('Step 3 failed:', err);
        checkTimeBudget();
      }

      // STEP 4: Cached Location (Immediate)
      // If we have a recent cache (even if slightly older than ideal), use it
      if (this.lastKnownLocation) {
        const cacheAge = Date.now() - (this.lastKnownLocation.timestamp || 0);
        if (cacheAge < 5 * 60 * 1000) { // 5 minutes
          console.warn(`⚠️ Step 4: Using cached location (age: ${Math.round(cacheAge / 1000)}s)`);
          return { ...this.lastKnownLocation, source: 'cached' };
        }
      }

      // STEP 5: IP Fallback (Last Resort)
      if (defaultOptions.fallbackToIPGeolocation) {
        try {
          console.log('🌐 Step 5: IP-based geolocation fallback');
          return await this.getIPBasedLocation();
        } catch (ipError) {
          console.error('❌ Step 5 failed:', ipError);
        }
      }

      throw new Error('All location strategies failed');

    } catch (finalError) {
      console.error('❌ Location acquisition failed completely:', finalError);
      
      // If we have ANY last known location, return it as a desperate fallback
      if (this.lastKnownLocation) {
         console.warn('⚠️ Returning last known location as desperate fallback');
         return { ...this.lastKnownLocation, source: 'cached' };
      }

      throw this.createGeolocationError({ code: 2, message: 'Location unavailable' });
    }
  }

  /**
   * Helper for a single location attempt with specific constraints
   */
  private async getSingleLocationAttempt(
    options: PositionOptions, 
    maxAccuracyMeters: number
  ): Promise<EnhancedLocationData> {
    try {
      // Try Capacitor first
      const position = await Geolocation.getCurrentPosition(options);
      return await this.processPosition(position, maxAccuracyMeters, 'capacitor');
    } catch (err) {
      // If Capacitor fails (e.g. on Web), try Browser API
      if (this.isPermissionDenied(err)) throw err; // Don't retry if denied
      
      try {
        const position = await this.getBrowserLocation(options);
        return await this.processPosition(position, maxAccuracyMeters, 'browser');
      } catch (browserErr) {
        throw browserErr;
      }
    }
  }

  /**
   * Process and validate a raw position
   */
  private async processPosition(
    position: GeolocationPosition, 
    maxAccuracyMeters: number,
    source: 'capacitor' | 'browser'
  ): Promise<EnhancedLocationData> {
    const accuracy = position.coords.accuracy || 9999;
    
    if (accuracy > maxAccuracyMeters) {
      throw new Error(`Accuracy ${accuracy.toFixed(0)}m exceeds limit of ${maxAccuracyMeters}m`);
    }

    const locationData: EnhancedLocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      source: source
    };

    // Enhance with address (this is fast if cached, or async)
    // We await it here but we could optimize to return early if needed
    // For now, we want the address attached
    const enhanced = await this.enhanceLocationData(locationData, { includeAddress: true });
    return enhanced;
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
            message: 'Position unavailable or accuracy insufficient',
            userMessage: 'Unable to get accurate GPS location (required: ≤1km accuracy)',
            actionable: 'Please ensure GPS is enabled and move to an open area with clear sky view. GPS needs 30-60 seconds to acquire satellites. Avoid indoor locations.'
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
