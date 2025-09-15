/**
 * Interactive Google Maps Component for CaseFlow Mobile
 * Provides enhanced mapping functionality with user interaction
 */

import React, { useEffect, useRef, useState } from 'react';
import { googleMapsService, LocationData, AddressComponents } from '../services/googleMapsService';

export interface InteractiveMapProps {
  location: LocationData;
  address?: AddressComponents;
  height?: string;
  width?: string;
  zoom?: number;
  mapType?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  showControls?: boolean;
  showStreetView?: boolean;
  onLocationChange?: (location: LocationData) => void;
  onAddressChange?: (address: AddressComponents) => void;
  readonly?: boolean;
  className?: string;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  location,
  address,
  height = '300px',
  width = '100%',
  zoom = 16,
  mapType = 'hybrid',
  showControls = true,
  showStreetView = true,
  onLocationChange,
  onAddressChange,
  readonly = false,
  className = ''
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentAddress, setCurrentAddress] = useState<AddressComponents | undefined>(address);

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      updateMapLocation(location);
    }
  }, [location]);

  const initializeMap = async () => {
    if (!mapRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      // Initialize Google Maps service if not already done
      const isInitialized = await googleMapsService.initialize();
      
      if (!isInitialized) {
        throw new Error('Failed to initialize Google Maps API');
      }

      // Create map options
      const mapOptions: google.maps.MapOptions = {
        center: { lat: location.latitude, lng: location.longitude },
        zoom: zoom,
        mapTypeId: getMapTypeId(mapType),
        streetViewControl: showStreetView,
        mapTypeControl: showControls,
        fullscreenControl: showControls,
        zoomControl: showControls,
        gestureHandling: readonly ? 'none' : 'auto',
        disableDoubleClickZoom: readonly,
        draggable: !readonly,
        scrollwheel: !readonly,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
          }
        ]
      };

      // Create the map
      const map = new google.maps.Map(mapRef.current, mapOptions);
      mapInstanceRef.current = map;

      // Create marker
      const marker = new google.maps.Marker({
        position: { lat: location.latitude, lng: location.longitude },
        map: map,
        title: 'Captured Location',
        draggable: !readonly,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444"/>
              <circle cx="12" cy="9" r="2" fill="white"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 32)
        }
      });
      markerRef.current = marker;

      // Add click listener for location updates (if not readonly)
      if (!readonly && onLocationChange) {
        map.addListener('click', async (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            const newLocation: LocationData = {
              latitude: event.latLng.lat(),
              longitude: event.latLng.lng(),
              timestamp: Date.now()
            };

            // Update marker position
            marker.setPosition(event.latLng);

            // Get address for new location
            try {
              const newAddress = await googleMapsService.reverseGeocode(newLocation);
              if (newAddress) {
                setCurrentAddress(newAddress);
                onAddressChange?.(newAddress);
              }
            } catch (error) {
              console.warn('Failed to get address for new location:', error);
            }

            onLocationChange(newLocation);
          }
        });
      }

      // Add marker drag listener (if not readonly)
      if (!readonly && onLocationChange) {
        marker.addListener('dragend', async () => {
          const position = marker.getPosition();
          if (position) {
            const newLocation: LocationData = {
              latitude: position.lat(),
              longitude: position.lng(),
              timestamp: Date.now()
            };

            // Get address for new location
            try {
              const newAddress = await googleMapsService.reverseGeocode(newLocation);
              if (newAddress) {
                setCurrentAddress(newAddress);
                onAddressChange?.(newAddress);
              }
            } catch (error) {
              console.warn('Failed to get address for dragged location:', error);
            }

            onLocationChange(newLocation);
          }
        });
      }

      // Add info window with address information
      if (currentAddress) {
        const infoWindow = new google.maps.InfoWindow({
          content: createInfoWindowContent(currentAddress)
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      }

      setIsLoading(false);

    } catch (error) {
      console.error('Failed to initialize map:', error);
      setError(error instanceof Error ? error.message : 'Failed to load map');
      setIsLoading(false);
    }
  };

  const updateMapLocation = (newLocation: LocationData) => {
    if (!mapInstanceRef.current || !markerRef.current) return;

    const position = { lat: newLocation.latitude, lng: newLocation.longitude };
    
    // Update map center
    mapInstanceRef.current.setCenter(position);
    
    // Update marker position
    markerRef.current.setPosition(position);
  };

  const getMapTypeId = (type: string): google.maps.MapTypeId => {
    switch (type) {
      case 'satellite': return google.maps.MapTypeId.SATELLITE;
      case 'hybrid': return google.maps.MapTypeId.HYBRID;
      case 'terrain': return google.maps.MapTypeId.TERRAIN;
      default: return google.maps.MapTypeId.ROADMAP;
    }
  };

  const createInfoWindowContent = (address: AddressComponents): string => {
    return `
      <div style="max-width: 250px; font-family: Arial, sans-serif;">
        <h4 style="margin: 0 0 8px 0; color: #1f2937;">📍 Location Details</h4>
        <p style="margin: 4px 0; font-size: 14px; color: #374151;">
          <strong>Address:</strong><br>
          ${address.formattedAddress}
        </p>
        ${address.locality ? `<p style="margin: 4px 0; font-size: 12px; color: #6b7280;"><strong>City:</strong> ${address.locality}</p>` : ''}
        ${address.administrativeArea ? `<p style="margin: 4px 0; font-size: 12px; color: #6b7280;"><strong>State:</strong> ${address.administrativeArea}</p>` : ''}
        ${address.postalCode ? `<p style="margin: 4px 0; font-size: 12px; color: #6b7280;"><strong>PIN:</strong> ${address.postalCode}</p>` : ''}
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #9ca3af;">
          Lat: ${location.latitude.toFixed(6)}, Lng: ${location.longitude.toFixed(6)}
        </p>
      </div>
    `;
  };

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-900/50 border border-gray-700 rounded-lg ${className}`}
        style={{ height, width }}
      >
        <div className="text-center p-4">
          <div className="text-red-400 text-2xl mb-2">⚠️</div>
          <div className="text-red-400 text-sm font-medium mb-1">Map Loading Failed</div>
          <div className="text-gray-400 text-xs">{error}</div>
          <div className="text-gray-500 text-xs mt-2">
            Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ height, width }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 border border-gray-700 rounded-lg z-10">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full mx-auto mb-2"></div>
            <div className="text-light-text text-sm">Loading Interactive Map...</div>
          </div>
        </div>
      )}
      
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg overflow-hidden border border-gray-700"
        style={{ height, width }}
      />
      
      {!readonly && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {readonly ? '📍 View Only' : '📍 Tap to update location'}
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;
