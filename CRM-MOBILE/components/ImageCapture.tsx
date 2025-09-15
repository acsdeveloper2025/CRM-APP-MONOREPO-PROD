import React, { useState, useRef, useEffect } from 'react';
import { CapturedImage } from '../types';
import { CameraIcon, MapPinIcon, ClockIcon } from './Icons';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { requestCameraPermissions, requestLocationPermissions } from '../utils/permissions';
import { getAndroidCameraConfig, getAndroidCameraErrorMessage } from '../utils/androidCameraConfig';
import CompactImageDisplay from './CompactImageDisplay';
import { enhancedGeolocationService, EnhancedLocationData } from '../services/enhancedGeolocationService';
import { googleMapsService } from '../services/googleMapsService';

interface ImageCaptureProps {
  images: CapturedImage[];
  onImagesChange: (images: CapturedImage[]) => void;
  isReadOnly?: boolean;
  minImages?: number;
  cameraDirection?: 'front' | 'rear';
  componentType?: 'photo' | 'selfie';
  title?: string;
  required?: boolean;
  compact?: boolean;
}

interface ImageMetadata {
  address?: string;
  isLoadingAddress?: boolean;
  addressError?: string;
  enhancedLocation?: EnhancedLocationData;
  validationResult?: any;
}

const ImageCapture: React.FC<ImageCaptureProps> = ({
  images,
  onImagesChange,
  isReadOnly,
  minImages,
  cameraDirection = 'rear',
  componentType = 'photo',
  title,
  required = false,
  compact = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageMetadata, setImageMetadata] = useState<Record<string, ImageMetadata>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if camera is available on the device
  const checkCameraAvailability = async (): Promise<boolean> => {
    try {
      if (Capacitor.isNativePlatform()) {
        // On native platforms, assume camera is available if permissions can be checked
        await Camera.checkPermissions();
        return true; // Camera exists if we can check permissions
      } else {
        // On web, check if MediaDevices API is available
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          return true;
        } else {
          console.warn('📷 Web camera API not available');
          return false;
        }
      }
    } catch (error) {
      console.error('❌ Camera availability check failed:', error);
      return false;
    }
  };

  const handleTakePhoto = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Check camera availability first
      const cameraAvailable = await checkCameraAvailability();
      if (!cameraAvailable) {
        console.warn('📷 Camera not available, using file input fallback');
        if (fileInputRef.current) {
          fileInputRef.current.click();
          return;
        } else {
          setError('Camera is not available on this device.');
          return;
        }
      }
      // Request camera permissions first with enhanced options
      const cameraPermission = await requestCameraPermissions({
        showRationale: true,
        fallbackToSettings: true,
        context: componentType === 'selfie' ? 'take verification selfies' : 'capture verification photos'
      });

      if (!cameraPermission.granted) {
        if (cameraPermission.denied) {
          console.error('❌ Camera permission denied by user');
          setError('Camera permission denied. Please enable camera access in device settings to continue.');
        } else {
          console.error('❌ Camera permission not granted');
          setError('Camera permission is required to take photos');
        }
        return;
      }

      // Use platform-specific camera configuration
      const platform = Capacitor.getPlatform();
      let cameraOptions: any;

      if (platform === 'android') {
        // Use Android-optimized configuration
        cameraOptions = getAndroidCameraConfig(cameraDirection, 90);
        console.log('📱 Using Android camera configuration');
      } else {
        // iOS and other platforms configuration
        cameraOptions = {
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          direction: cameraDirection === 'front' ? CameraDirection.Front : CameraDirection.Rear,
          presentationStyle: 'fullscreen' as any, // iOS specific
          saveToGallery: false, // CRITICAL: Never save to gallery
          correctOrientation: true,
          width: 1024,
          height: 1024
        };
        console.log('📱 Using iOS camera configuration');
      }

      console.log('📷 Camera options:', cameraOptions);

      const image = await Camera.getPhoto(cameraOptions);
      console.log('📷 Camera.getPhoto result:', {
        hasDataUrl: !!image.dataUrl,
        format: image.format,
        webPath: image.webPath,
        dataUrlLength: image.dataUrl?.length
      });

      if (image.dataUrl) {
        console.log('🔄 Processing captured image...');
        // Add timeout to prevent hanging
        await Promise.race([
          processImage(image.dataUrl),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Image processing timeout after 15 seconds')), 15000)
          )
        ]);
        console.log('✅ Image processing completed successfully');
      } else {
        console.error('❌ No image data received from camera');
        throw new Error('No image data received from camera');
      }
    } catch (error: any) {
      console.error('❌ Camera capture error:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        name: error.name
      });

      // Handle specific error types
      if (error.message?.includes('User cancelled')) {
        console.log('ℹ️ User cancelled camera capture');
        return; // Don't show error for user cancellation
      } else if (error.message?.includes('timeout')) {
        console.error('⏰ Image processing timeout');
        setError('Image processing timed out. Please try again.');
      } else if (error.message?.includes('permission')) {
        console.error('🔐 Permission error during capture');
        const platform = Capacitor.getPlatform();
        if (platform === 'android') {
          const androidError = getAndroidCameraErrorMessage(error);
          setError(androidError || 'Camera permission required. Please enable camera access in Settings > Apps > CaseFlow Mobile > Permissions.');
        } else {
          setError('Camera permission error. Please check your device settings.');
        }
      } else if (error.message?.includes('NSPhotoLibraryAddUsageDescription')) {
        console.error('📷 Photo library permission missing (iOS)');
        setError('Photo library permission required. Please update app permissions in Settings.');
      } else if (error.message?.includes('NSPhotoLibraryUsageDescription')) {
        console.error('📷 Photo library access permission missing (iOS)');
        setError('Photo library access permission required. Please enable in Settings.');
      } else if (error.message?.includes('CAMERA_PERMISSION_DENIED')) {
        console.error('📷 Camera permission denied (Android)');
        const androidError = getAndroidCameraErrorMessage(error);
        setError(androidError || 'Camera permission denied. Please enable camera access in Settings > Apps > CaseFlow Mobile > Permissions.');
      } else if (error.code === 'CAMERA_UNAVAILABLE') {
        console.error('📷 Camera unavailable');
        const platform = Capacitor.getPlatform();
        if (platform === 'android') {
          const androidError = getAndroidCameraErrorMessage(error);
          setError(androidError || 'Camera is not available on this device.');
        } else {
          setError('Camera is not available on this device.');
        }
      } else {
        console.warn('🔄 Native camera failed, attempting web camera fallback...');

        // Try web camera fallback
        if (fileInputRef.current) {
          console.log('📁 Triggering file input fallback...');
          fileInputRef.current.click();
          return; // Don't show error yet, let file input handle it
        } else {
          console.error('❌ No fallback available');
          setError(`Camera capture failed: ${error.message || 'Unknown error'}. Please try again.`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const processImage = async (dataUrl: string) => {
    console.log('🔄 Starting image processing...');
    try {
      // Get enhanced location data
      let enhancedLocation: EnhancedLocationData | null = null;
      let latitude = 0;
      let longitude = 0;
      let accuracy: number | undefined;

      try {
        // Request location permissions first with enhanced options
        const locationPermission = await requestLocationPermissions({
          showRationale: false, // Don't show rationale for location as it's optional
          fallbackToSettings: false,
          context: 'tag photos with GPS coordinates for verification'
        });

        if (locationPermission.granted) {
          console.log('📍 Location permission granted, getting location...');

          // Initialize Google Maps service (non-blocking)
          try {
            await googleMapsService.initialize();
            console.log('🗺️ Google Maps initialized successfully');
          } catch (mapsError) {
            console.warn('Google Maps initialization failed, proceeding with basic geolocation:', mapsError);
          }

          // Use enhanced geolocation service with timeout
          try {
            enhancedLocation = await Promise.race([
              enhancedGeolocationService.getCurrentLocation({
                enableHighAccuracy: true,
                timeout: 6000, // Reduced timeout to prevent hanging
                includeAddress: true,
                validateLocation: true,
                fallbackToNominatim: true
              }),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Enhanced geolocation timeout')), 7000)
              )
            ]);

            latitude = enhancedLocation.latitude;
            longitude = enhancedLocation.longitude;
            accuracy = enhancedLocation.accuracy;
            console.log('✅ Enhanced geolocation successful');
          } catch (enhancedError) {
            console.warn('Enhanced geolocation failed, trying basic fallback:', enhancedError);

            // Fallback to basic Capacitor geolocation
            try {
              const position = await Promise.race([
                Geolocation.getCurrentPosition({
                  enableHighAccuracy: true,
                  timeout: 4000, // Reduced timeout
                }),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('Basic geolocation timeout')), 5000)
                )
              ]);
              latitude = position.coords.latitude;
              longitude = position.coords.longitude;
              accuracy = position.coords.accuracy;
              console.log('✅ Basic geolocation successful');
            } catch (fallbackError) {
              console.warn('All geolocation methods failed, proceeding without location:', fallbackError);
            }
          }
        } else {
          console.warn('Location permission not granted, proceeding without location');
        }
      } catch (permissionError) {
        console.warn('Location permission request failed, proceeding without location:', permissionError);
      }

      const timestamp = new Date().toISOString();
      const newImage: CapturedImage & { accuracy?: number } = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        dataUrl,
        latitude,
        longitude,
        timestamp,
        componentType: componentType || 'photo', // Add componentType metadata for auto-save
        accuracy: accuracy || undefined,
        geoLocation: {
          latitude,
          longitude,
          accuracy: accuracy || undefined,
          timestamp
        }
      };

      // Store enhanced location data in metadata and update image geoLocation
      if (enhancedLocation) {
        // Update the image's geoLocation to include address
        newImage.geoLocation = {
          ...newImage.geoLocation,
          address: enhancedLocation.address?.formattedAddress
        };

        setImageMetadata(prev => ({
          ...prev,
          [newImage.id]: {
            enhancedLocation,
            address: enhancedLocation.address?.formattedAddress,
            validationResult: enhancedLocation.validationResult,
            isLoadingAddress: false
          }
        }));
      }

      // Directly add to images array - this should always succeed
      console.log('✅ Adding image to array:', newImage.id);
      onImagesChange([...images, newImage]);
      console.log('✅ Image processing completed successfully');

      // Fetch address for the new image if location is available but no enhanced data
      // Do this asynchronously to not block the image saving
      if (latitude !== 0 && longitude !== 0 && !enhancedLocation?.address) {
        // Don't await this - let it run in background
        fetchAddressForImage(newImage.id, latitude, longitude).catch(err => {
          console.warn('Background address fetch failed:', err);
        });
      }
    } catch (err) {
      console.error('❌ Image processing error:', err);
      setError('Failed to process captured image. Please try again.');
      throw err; // Re-throw to ensure calling function knows about the error
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
      // Using OpenStreetMap Nominatim API (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CaseFlow-Mobile-App'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const data = await response.json();

      if (data && data.display_name) {
        return data.display_name;
      } else {
        throw new Error('Address not found');
      }
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      throw error;
    }
  };

  const fetchAddressForImage = async (imageId: string, latitude: number, longitude: number) => {
    if (latitude === 0 && longitude === 0) return;

    setImageMetadata(prev => ({
      ...prev,
      [imageId]: { ...prev[imageId], isLoadingAddress: true }
    }));

    try {
      const address = await reverseGeocode(latitude, longitude);

      // Update metadata
      setImageMetadata(prev => ({
        ...prev,
        [imageId]: { ...prev[imageId], address, isLoadingAddress: false }
      }));

      // Update the actual image object with address
      const updatedImages = images.map(img => {
        if (img.id === imageId) {
          return {
            ...img,
            geoLocation: {
              ...img.geoLocation,
              address
            }
          };
        }
        return img;
      });
      onImagesChange(updatedImages);

    } catch (error) {
      setImageMetadata(prev => ({
        ...prev,
        [imageId]: {
          ...prev[imageId],
          addressError: 'Address unavailable',
          isLoadingAddress: false
        }
      }));
    }
  };

  // Fetch addresses for images when component loads or images change
  useEffect(() => {
    images.forEach(image => {
      if (image.latitude !== 0 && image.longitude !== 0 && !imageMetadata[image.id]) {
        fetchAddressForImage(image.id, image.latitude, image.longitude);
      }
    });
  }, [images]);



  const handleFileCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📁 File input triggered for fallback capture...');
    const file = event.target.files?.[0];

    if (!file) {
      console.log('ℹ️ No file selected from file input');
      setIsLoading(false);
      return;
    }

    console.log('📁 File selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('❌ Invalid file type:', file.type);
      setError('Please select a valid image file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.error('❌ File too large:', file.size);
      setError('Image file is too large (max 10MB). Please choose a smaller image.');
      return;
    }

    setIsLoading(true);
    setError(null);

    console.log(`📁 Processing ${componentType} image from file input...`);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const dataUrl = e.target?.result as string;
          if (!dataUrl) {
            setError('Failed to process captured image.');
            return;
          }

          await processImage(dataUrl);
          console.log('✅ File input image processed successfully');
        } catch (processError) {
          console.error('❌ File input image processing error:', processError);
          setError('Failed to process the selected image. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setError('Failed to read captured image.');
        setIsLoading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to capture photo. Please try again.');
      console.error('Photo capture error:', err);
      setIsLoading(false);
    }

    // Reset the input value so the same file can be selected again
    event.target.value = '';
  };

  const handleDeleteImage = (id: string) => {
    onImagesChange(images.filter(img => img.id !== id));
    // Clean up metadata for deleted image
    setImageMetadata(prev => {
      const newMetadata = { ...prev };
      delete newMetadata[id];
      return newMetadata;
    });
  };

  const formatCoordinates = (lat: number, lng: number): string => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const formatDateTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const generateMapUrl = (lat: number, lng: number): string => {
    // Using OpenStreetMap-based map embed
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.001},${lat-0.001},${lng+0.001},${lat+0.001}&layer=mapnik&marker=${lat},${lng}`;
  };



  if (isReadOnly) {
    return (
      <div className="space-y-4">
        <h6 className="font-semibold text-light-text">📷 Captured Images</h6>
        {images.length === 0 ? (
          <p className="text-medium-text text-sm">No images captured</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {images.map((image) => (
              <div key={image.id} className="relative">
                <img src={image.dataUrl} alt="Captured" className="w-full h-32 object-cover rounded-lg" />
                <div className="absolute bottom-2 left-2 text-xs text-white bg-black/70 px-2 py-1 rounded">
                  {new Date(image.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Use compact display if requested
  if (compact) {
    return (
      <CompactImageDisplay
        images={images}
        onImagesChange={onImagesChange}
        onTakePhoto={handleTakePhoto}
        isLoading={isLoading}
        error={error}
        title={title || (componentType === 'selfie' ? '🤳 Selfie Photo Capture' : '📷 Photo Capture')}
        componentType={componentType}
        required={required}
        isReadOnly={isReadOnly}
        minImages={minImages}
        imageMetadata={Object.fromEntries(
          Object.entries(imageMetadata).map(([id, metadata]) => [
            id,
            {
              ...metadata,
              enhancedAddress: metadata.enhancedLocation?.address
            }
          ])
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h6 className="font-semibold text-light-text">
          {title || (componentType === 'selfie' ? '🤳 Selfie Photo Capture' : '📷 Photo Capture')}
          {required && <span className="text-red-400 ml-1">*</span>}
        </h6>
        <button
          onClick={handleTakePhoto}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-semibold rounded-md bg-brand-primary hover:bg-brand-secondary text-white transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {componentType === 'selfie' ? (
            <span className="w-4 h-4">🤳</span>
          ) : (
            <CameraIcon width={16} height={16} />
          )}
          {isLoading ? 'Processing...' : (componentType === 'selfie' ? 'Take Selfie' : 'Take Photo')}
        </button>
      </div>

      {/* Hidden file input for native camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileCapture}
        className="hidden"
      />

      {/* Visual instruction note - only show when minimum requirement not met */}
      {minImages && images.length < minImages && (
        <div className="mt-3 mb-2 px-3 py-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <p className="text-gray-400 text-sm flex items-center gap-2 leading-relaxed">
            {componentType === 'selfie' ? (
              <>
                <span className="text-base">🤳</span>
                <span>Please take a minimum of {minImages} verification selfie{minImages > 1 ? 's' : ''}</span>
              </>
            ) : (
              <>
                <span className="text-base">📷</span>
                <span>Please capture a minimum of {minImages} verification photo{minImages > 1 ? 's' : ''}</span>
              </>
            )}
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {images.map((image) => {
            const metadata = imageMetadata[image.id] || {};
            const hasLocation = image.latitude !== 0 && image.longitude !== 0;

            return (
              <div key={image.id} className="bg-gray-900/50 rounded-lg border border-dark-border overflow-hidden">
                {/* Image Container */}
                <div className="relative group">
                  <img src={image.dataUrl} alt="Captured" className="w-full h-48 object-cover" />
                  <button
                    onClick={() => handleDeleteImage(image.id)}
                    className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>

                {/* Metadata Panel */}
                <div className="p-4 space-y-3">
                  {/* Date and Time */}
                  <div className="flex items-center gap-2 text-sm">
                    <ClockIcon width={16} height={16} className="text-brand-primary" />
                    <span className="text-light-text font-medium">
                      {formatDateTime(image.timestamp)}
                    </span>
                  </div>

                  {/* GPS Coordinates */}
                  {hasLocation ? (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPinIcon width={16} height={16} className="text-brand-primary" />
                      <span className="text-medium-text">
                        {formatCoordinates(image.latitude, image.longitude)}
                      </span>
                      {(image as any).accuracy && (
                        <span className="text-xs text-gray-400">
                          (±{Math.round((image as any).accuracy)}m)
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPinIcon width={16} height={16} className="text-gray-500" />
                      <span className="text-gray-500">Location not available</span>
                    </div>
                  )}

                  {/* Address */}
                  {hasLocation && (
                    <div className="text-sm">
                      <div className="text-medium-text font-medium mb-1">Address:</div>
                      {metadata.isLoadingAddress ? (
                        <div className="text-gray-400 italic">Loading address...</div>
                      ) : metadata.address ? (
                        <div className="text-light-text text-xs leading-relaxed">
                          {metadata.address}
                        </div>
                      ) : metadata.addressError ? (
                        <div className="text-gray-500 text-xs">{metadata.addressError}</div>
                      ) : (
                        <div className="text-gray-500 text-xs">Address not available</div>
                      )}
                    </div>
                  )}

                  {/* Interactive Map */}
                  {hasLocation && (
                    <div className="space-y-2">
                      <div className="text-medium-text font-medium text-sm">Location Map:</div>
                      <div className="relative bg-gray-800 rounded-lg overflow-hidden" style={{ height: '120px' }}>
                        <iframe
                          src={generateMapUrl(image.latitude, image.longitude)}
                          width="100%"
                          height="120"
                          style={{ border: 0 }}
                          loading="lazy"
                          title={`Map for image ${image.id}`}
                          className="rounded-lg"
                        />
                        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          📍 Photo Location
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {minImages && images.length < minImages && (
        <p className="text-yellow-400 text-sm">
          Please capture at least {minImages} image{minImages > 1 ? 's' : ''}.
        </p>
      )}




    </div>
  );
};

export default ImageCapture;
