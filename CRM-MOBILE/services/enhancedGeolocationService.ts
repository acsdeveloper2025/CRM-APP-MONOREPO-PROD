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
}

class EnhancedGeolocationService {
  private lastKnownLocation: EnhancedLocationData | null = null;
  private locationCache = new Map<string, { location: EnhancedLocationData; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get current location with enhanced features
   */
  async getCurrentLocation(options: GeolocationOptions = {}): Promise<EnhancedLocationData> {
    const defaultOptions: GeolocationOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
      includeAddress: true,
      validateLocation: true,
      fallbackToNominatim: true,
      ...options
    };

    try {
      // Try Capacitor Geolocation first (works on mobile)
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: defaultOptions.enableHighAccuracy,
        timeout: defaultOptions.timeout,
        maximumAge: defaultOptions.maximumAge
      });

      const locationData: EnhancedLocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        source: 'capacitor'
      };

      return await this.enhanceLocationData(locationData, defaultOptions);

    } catch (capacitorError) {
      console.warn('Capacitor Geolocation failed, trying browser API:', capacitorError);

      try {
        // Fallback to browser geolocation API
        const position = await this.getBrowserLocation(defaultOptions);
        const locationData: EnhancedLocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          source: 'browser'
        };

        return await this.enhanceLocationData(locationData, defaultOptions);

      } catch (browserError) {
        console.error('Browser Geolocation also failed:', browserError);

        // Return last known location if available
        if (this.lastKnownLocation) {
          console.warn('Using last known location');
          return { ...this.lastKnownLocation, source: 'cached' };
        }

        throw new Error('Unable to get current location from any source');
      }
    }
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
}

// Export singleton instance
export const enhancedGeolocationService = new EnhancedGeolocationService();
export default enhancedGeolocationService;
