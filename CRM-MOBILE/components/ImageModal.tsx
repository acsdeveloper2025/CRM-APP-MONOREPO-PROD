import React, { useState, useEffect, Suspense, lazy } from 'react';
import { CapturedImage } from '../types';
import { MapPinIcon, ClockIcon } from './Icons';
import { enhancedGeolocationService } from '../services/enhancedGeolocationService';
import { AddressComponents } from '../services/googleMapsService';

// Lazy load InteractiveMap to reduce initial bundle size
const InteractiveMap = lazy(() => import('./InteractiveMap'));

interface ImageModalProps {
  image: CapturedImage;
  isVisible: boolean;
  onClose: () => void;
  onDelete?: () => void;
  enhancedAddress?: AddressComponents;
  validationResult?: any;
}

const ImageModal: React.FC<ImageModalProps> = ({
  image,
  isVisible,
  onClose,
  onDelete,
  enhancedAddress,
  validationResult
}) => {
  const [currentAddress, setCurrentAddress] = useState<AddressComponents | undefined>(enhancedAddress);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  if (!isVisible) return null;

  // Load address if not provided and location is available
  useEffect(() => {
    const loadAddress = async () => {
      if (!currentAddress && hasLocation && !isLoadingAddress) {
        setIsLoadingAddress(true);
        try {
          const enhancedLocation = await enhancedGeolocationService.getCurrentLocation({
            includeAddress: true,
            validateLocation: false,
            fallbackToNominatim: true
          });

          if (enhancedLocation.address) {
            setCurrentAddress(enhancedLocation.address);
          }
        } catch (error) {
          console.warn('Failed to load address for image:', error);
        } finally {
          setIsLoadingAddress(false);
        }
      }
    };

    loadAddress();
  }, [image.id]);

  const formatDateTime = (timestamp: string | number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const hasLocation = image.latitude !== 0 && image.longitude !== 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
      style={{
        touchAction: 'none' // Prevent background scrolling
      }}
    >
      <div
        className="bg-gray-900 rounded-lg max-w-4xl w-full flex flex-col"
        style={{
          maxHeight: '90vh',
          height: 'auto',
          touchAction: 'auto' // Allow scrolling within modal
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-light-text">Image Details</h3>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-md transition-colors text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            maxHeight: 'calc(90vh - 80px)',
            minHeight: '300px',
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch', // Enable smooth scrolling on iOS
            scrollbarWidth: 'thin',
            scrollbarColor: '#4B5563 #1F2937',
            // Ensure scrolling works on mobile
            touchAction: 'pan-y',
            // Add momentum scrolling for iOS
            WebkitOverflowScrolling: 'touch' as any
          }}
        >
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 p-6">
            {/* Image */}
            <div className="space-y-4">
              <img
                src={image.dataUrl}
                alt="Full size"
                className="w-full rounded-lg border border-gray-700"
              />
            </div>

            {/* Metadata */}
            <div className="space-y-4">
              {/* Date and Time */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClockIcon width={16} height={16} className="text-brand-primary" />
                  <span className="font-medium text-light-text">Capture Time</span>
                </div>
                <div className="text-medium-text">
                  {formatDateTime(image.timestamp)}
                </div>
              </div>

              {/* Location Information */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPinIcon width={16} height={16} className="text-brand-primary" />
                  <span className="font-medium text-light-text">Location</span>
                </div>
                
                {hasLocation ? (
                  <div className="space-y-3">
                    {/* Coordinates and Accuracy */}
                    <div className="text-medium-text">
                      <div className="font-mono text-sm">
                        {formatCoordinates(image.latitude, image.longitude)}
                      </div>
                      {(image as any).accuracy && (
                        <div className="text-xs text-gray-400 mt-1">
                          Accuracy: ±{Math.round((image as any).accuracy)}m
                        </div>
                      )}
                    </div>

                    {/* Enhanced Address Information */}
                    {currentAddress && (
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="text-sm font-medium text-light-text mb-2">📍 Address</div>
                        <div className="text-sm text-medium-text">
                          {currentAddress.formattedAddress}
                        </div>
                        {currentAddress.locality && currentAddress.administrativeArea && (
                          <div className="text-xs text-gray-400 mt-1">
                            {currentAddress.locality}, {currentAddress.administrativeArea}
                            {currentAddress.postalCode && ` - ${currentAddress.postalCode}`}
                          </div>
                        )}
                      </div>
                    )}

                    {isLoadingAddress && (
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <div className="animate-spin w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full"></div>
                          Loading address...
                        </div>
                      </div>
                    )}

                    {/* Validation Result */}
                    {validationResult && (
                      <div className={`rounded-lg p-3 ${
                        validationResult.isValid
                          ? 'bg-green-900/20 border border-green-700/50'
                          : 'bg-yellow-900/20 border border-yellow-700/50'
                      }`}>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={validationResult.isValid ? 'text-green-400' : 'text-yellow-400'}>
                            {validationResult.isValid ? '✅' : '⚠️'}
                          </span>
                          <span className={validationResult.isValid ? 'text-green-300' : 'text-yellow-300'}>
                            Location {validationResult.confidence} confidence
                          </span>
                        </div>
                        {validationResult.issues && validationResult.issues.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            {validationResult.issues.join(', ')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interactive Map */}
                    <Suspense fallback={
                      <div className="bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center" style={{ height: '250px' }}>
                        <div className="text-center">
                          <div className="animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                          <div className="text-light-text text-sm">Loading Interactive Map...</div>
                        </div>
                      </div>
                    }>
                      <InteractiveMap
                        location={{
                          latitude: image.latitude,
                          longitude: image.longitude,
                          accuracy: (image as any).accuracy,
                          timestamp: image.timestamp
                        }}
                        address={currentAddress}
                        height="250px"
                        zoom={17}
                        mapType="hybrid"
                        showControls={true}
                        showStreetView={true}
                        readonly={true}
                        className="rounded-lg overflow-hidden"
                      />
                    </Suspense>
                  </div>
                ) : (
                  <div className="text-gray-500">Location not available</div>
                )}
              </div>

              {/* Technical Details */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="font-medium text-light-text mb-2">Technical Details</div>
                <div className="space-y-1 text-sm text-medium-text">
                  <div>Image ID: <span className="text-gray-400 font-mono text-xs">{image.id}</span></div>
                  <div>Format: <span className="text-gray-400">JPEG (Base64)</span></div>
                  <div>Quality: <span className="text-gray-400">90%</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
