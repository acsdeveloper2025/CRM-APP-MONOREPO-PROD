/**
 * Google Maps Service for CaseFlow Mobile
 * Provides enhanced geolocation, geocoding, and mapping functionality
 */

import { Loader } from '@googlemaps/js-api-loader';
import { getEnvironmentConfig } from '../config/environment';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface AddressComponents {
  streetNumber?: string;
  streetName?: string;
  locality?: string;
  subLocality?: string;
  administrativeArea?: string;
  postalCode?: string;
  country?: string;
  formattedAddress: string;
}

export interface LocationValidationResult {
  isValid: boolean;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  suggestedLocation?: LocationData;
}

class GoogleMapsService {
  private loader: Loader | null = null;
  private isLoaded = false;
  private isLoading = false;
  private config = getEnvironmentConfig();

  constructor() {
    // Don't initialize loader immediately - wait until needed
  }

  private initializeLoader() {
    if (!this.loader) {
      this.loader = new Loader({
        apiKey: this.config.googleMaps.apiKey,
        version: 'weekly',
        libraries: this.config.googleMaps.libraries as any,
        region: this.config.googleMaps.region,
        language: this.config.googleMaps.language
      });
    }
  }

  /**
   * Initialize Google Maps API
   */
  async initialize(): Promise<boolean> {
    if (this.isLoaded) {
      return true;
    }

    if (this.isLoading) {
      // Wait for existing initialization to complete
      return new Promise((resolve) => {
        const checkLoaded = () => {
          if (this.isLoaded || !this.isLoading) {
            resolve(this.isLoaded);
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
    }

    this.isLoading = true;

    try {
      this.initializeLoader();
      if (!this.loader) {
        throw new Error('Failed to initialize Google Maps loader');
      }

      await this.loader.load();
      this.isLoaded = true;
      this.isLoading = false;
      return true;
    } catch (error) {
      console.error('Failed to load Google Maps API:', error);
      this.isLoading = false;
      return false;
    }
  }

  /**
   * Check if Google Maps API is available
   */
  isAvailable(): boolean {
    return this.isLoaded && typeof google !== 'undefined' && google.maps;
  }

  /**
   * Reverse geocoding: Convert coordinates to address
   */
  async reverseGeocode(location: LocationData): Promise<AddressComponents | null> {
    if (!this.isAvailable()) {
      console.warn('Google Maps API not available for reverse geocoding');
      return null;
    }

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({
        location: { lat: location.latitude, lng: location.longitude }
      });

      if (response.results && response.results.length > 0) {
        const result = response.results[0];
        return this.parseAddressComponents(result);
      }

      return null;
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return null;
    }
  }

  /**
   * Forward geocoding: Convert address to coordinates
   */
  async geocode(address: string): Promise<LocationData | null> {
    if (!this.isAvailable()) {
      console.warn('Google Maps API not available for geocoding');
      return null;
    }

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ address });

      if (response.results && response.results.length > 0) {
        const location = response.results[0].geometry.location;
        return {
          latitude: location.lat(),
          longitude: location.lng(),
          timestamp: Date.now()
        };
      }

      return null;
    } catch (error) {
      console.error('Geocoding failed:', error);
      return null;
    }
  }

  /**
   * Validate location coordinates
   */
  async validateLocation(location: LocationData): Promise<LocationValidationResult> {
    const result: LocationValidationResult = {
      isValid: true,
      confidence: 'high',
      issues: []
    };

    // Basic coordinate validation
    if (location.latitude < -90 || location.latitude > 90) {
      result.isValid = false;
      result.issues.push('Invalid latitude value');
    }

    if (location.longitude < -180 || location.longitude > 180) {
      result.isValid = false;
      result.issues.push('Invalid longitude value');
    }

    // Check if coordinates are in a reasonable location (not in ocean, etc.)
    if (this.isAvailable()) {
      try {
        const addressResult = await this.reverseGeocode(location);
        if (!addressResult) {
          result.confidence = 'low';
          result.issues.push('Location could not be reverse geocoded');
        } else if (addressResult.country !== 'India') {
          result.confidence = 'medium';
          result.issues.push('Location appears to be outside India');
        }
      } catch (error) {
        result.confidence = 'low';
        result.issues.push('Could not validate location');
      }
    }

    // Check accuracy if provided
    if (location.accuracy && location.accuracy > 100) {
      result.confidence = 'medium';
      result.issues.push('Location accuracy is low (>100m)');
    }

    return result;
  }

  /**
   * Create an interactive map
   */
  createMap(container: HTMLElement, location: LocationData, options?: google.maps.MapOptions): google.maps.Map | null {
    if (!this.isAvailable()) {
      console.warn('Google Maps API not available for map creation');
      return null;
    }

    const defaultOptions: google.maps.MapOptions = {
      center: { lat: location.latitude, lng: location.longitude },
      zoom: 16,
      mapTypeId: google.maps.MapTypeId.HYBRID,
      streetViewControl: true,
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true,
      ...options
    };

    const map = new google.maps.Map(container, defaultOptions);

    // Add marker for the location
    new google.maps.Marker({
      position: { lat: location.latitude, lng: location.longitude },
      map: map,
      title: 'Captured Location',
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(24, 24)
      }
    });

    return map;
  }

  /**
   * Parse Google Maps address components
   */
  private parseAddressComponents(result: google.maps.GeocoderResult): AddressComponents {
    const components: AddressComponents = {
      formattedAddress: result.formatted_address
    };

    result.address_components.forEach(component => {
      const types = component.types;

      if (types.includes('street_number')) {
        components.streetNumber = component.long_name;
      } else if (types.includes('route')) {
        components.streetName = component.long_name;
      } else if (types.includes('locality')) {
        components.locality = component.long_name;
      } else if (types.includes('sublocality')) {
        components.subLocality = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        components.administrativeArea = component.long_name;
      } else if (types.includes('postal_code')) {
        components.postalCode = component.long_name;
      } else if (types.includes('country')) {
        components.country = component.long_name;
      }
    });

    return components;
  }
}

// Export singleton instance
export const googleMapsService = new GoogleMapsService();
export default googleMapsService;
