import { CapturedImage } from '../types';
import AuthStorageService from './authStorageService';
import NetworkService from './networkService';
import { getEnvironmentConfig } from '../config/environment';
import retryService from './retryService';
import progressTrackingService from './progressTrackingService';
import compressionService from './compressionService';
import { secureStorageService } from './secureStorageService';

export interface VerificationFormData {
  [key: string]: any;
}

export interface VerificationSubmissionRequest {
  formData: VerificationFormData;
  attachmentIds: string[]; // Keep for backward compatibility
  geoLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: string;
  };
  photos: Array<{
    attachmentId: string;
    geoLocation: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp?: string;
    };
  }>;
  // New field for direct image submission
  images?: Array<{
    dataUrl: string;
    type: 'verification' | 'selfie';
    geoLocation?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp?: string;
    };
  }>;
}

export interface VerificationSubmissionResult {
  success: boolean;
  error?: string;
  caseId?: string;
  status?: string;
  completedAt?: string;
  submissionId?: string;
  compressionStats?: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  };
  retryInfo?: {
    requestId: string;
    willRetry: boolean;
    nextRetryIn?: number;
  };
}

/**
 * Service for submitting verification forms to the backend
 */
class VerificationFormService {
  /**
   * Get smart API base URL with fallback logic
   */
  private static getApiBaseUrl(): string {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (isLocalhost) {
      const url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
      console.log('🏠 Verification Form Service - Using localhost API URL:', url);
      return url;
    } else {
      const staticUrl = import.meta.env.VITE_API_BASE_URL_STATIC_IP;
      const networkUrl = import.meta.env.VITE_API_BASE_URL_NETWORK;
      const deviceUrl = import.meta.env.VITE_API_BASE_URL_DEVICE;

      const url = staticUrl || networkUrl || deviceUrl || 'http://localhost:3000/api';
      console.log('🌐 Verification Form Service - Using network API URL:', url);
      return url;
    }
  }

  /**
   * Submit residence verification form with enhanced error recovery, progress tracking, and compression
   */
  static async submitResidenceVerification(
    caseId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number },
    onProgress?: (progress: any) => void
  ): Promise<VerificationSubmissionResult> {
    // Start progress tracking
    const submissionId = progressTrackingService.startSubmission(caseId, 'residence');

    // Subscribe to progress updates
    const unsubscribe = onProgress ?
      progressTrackingService.subscribeToProgress(submissionId, onProgress) :
      () => {};

    try {
      console.log(`🏠 Submitting residence verification for case ${caseId}...`);

      // Step 1: Validation
      progressTrackingService.updateStepProgress(submissionId, 'validation', 0, 'IN_PROGRESS');

      // Validate minimum requirements
      if (images.length < 5) {
        progressTrackingService.markSubmissionFailed(submissionId, 'Minimum 5 geo-tagged photos required', 'validation');
        return {
          success: false,
          error: 'Minimum 5 geo-tagged photos required for residence verification',
          submissionId
        };
      }

      // Check if all images have geo-location
      const photosWithoutGeo = images.filter(img =>
        !img.geoLocation ||
        !img.geoLocation.latitude ||
        !img.geoLocation.longitude
      );

      if (photosWithoutGeo.length > 0) {
        progressTrackingService.markSubmissionFailed(submissionId, 'All photos must have geo-location data', 'validation');
        return {
          success: false,
          error: 'All photos must have geo-location data',
          submissionId
        };
      }

      progressTrackingService.updateStepProgress(submissionId, 'validation', 100, 'COMPLETED');

      // Step 2: Compression
      progressTrackingService.updateStepProgress(submissionId, 'compression', 0, 'IN_PROGRESS');

      // Get network-appropriate compression settings
      const networkType = NetworkService.isOnline() ?
        (NetworkService.getConnectionType() === 'wifi' ? 'wifi' : 'cellular') : 'slow';
      const compressionOptions = compressionService.getCompressionRecommendations(networkType);

      // Compress data
      const compressedData = await compressionService.compressSubmissionData(
        images,
        formData,
        compressionOptions,
        (progress) => progressTrackingService.updateStepProgress(submissionId, 'compression', progress, 'IN_PROGRESS')
      );

      progressTrackingService.updateStepProgress(submissionId, 'compression', 100, 'COMPLETED');

      // Step 3: Prepare images for direct submission (no separate upload needed)
      progressTrackingService.updateStepProgress(submissionId, 'prepare_images', 0, 'IN_PROGRESS');

      const submissionImages = compressedData.images.map((img) => ({
        dataUrl: img.compressedData,
        type: (img.metadata?.type || 'verification') as 'verification' | 'selfie',
        geoLocation: img.geoLocation
      }));

      progressTrackingService.updateStepProgress(submissionId, 'prepare_images', 100, 'COMPLETED');

      // Step 4: Prepare submission data with embedded images (new approach)
      const submissionData: VerificationSubmissionRequest = {
        formData: compressionService.decompressFormData(compressedData.formData.compressed),
        attachmentIds: [], // Empty for new approach
        geoLocation,
        photos: [], // Empty for new approach
        images: submissionImages // New field with embedded images
      };

      // Step 5: Submit to backend with retry mechanism
      progressTrackingService.updateStepProgress(submissionId, 'submit_form', 0, 'IN_PROGRESS');

      const result = await this.submitToBackendWithRetry(
        `${this.getApiBaseUrl()}/mobile/cases/${caseId}/verification/residence`,
        submissionData,
        'VERIFICATION_SUBMISSION',
        'HIGH',
        submissionId
      );

      if (result.success) {
        progressTrackingService.markSubmissionCompleted(submissionId);
        console.log(`✅ Residence verification submitted successfully for case ${caseId}`);

        unsubscribe();
        return {
          ...result,
          submissionId,
          compressionStats: {
            originalSize: compressedData.totalOriginalSize,
            compressedSize: compressedData.totalCompressedSize,
            compressionRatio: compressedData.overallCompressionRatio
          }
        };
      } else {
        progressTrackingService.markSubmissionFailed(submissionId, result.error || 'Submission failed', 'submit_form');
        console.error(`❌ Residence verification submission failed for case ${caseId}:`, result.error);

        unsubscribe();
        return {
          ...result,
          submissionId
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      progressTrackingService.markSubmissionFailed(submissionId, errorMessage);
      unsubscribe();

      console.error(`❌ Residence verification submission error for case ${caseId}:`, error);
      return {
        success: false,
        error: errorMessage,
        submissionId
      };
    }
  }

  /**
   * Submit office verification form
   */
  static async submitOfficeVerification(
    caseId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, 'office', formData, images, geoLocation);
  }

  /**
   * Submit business verification form
   */
  static async submitBusinessVerification(
    caseId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, 'business', formData, images, geoLocation);
  }

  /**
   * Submit builder verification form
   */
  static async submitBuilderVerification(
    caseId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, 'builder', formData, images, geoLocation);
  }

  /**
   * Submit residence-cum-office verification form
   */
  static async submitResidenceCumOfficeVerification(
    caseId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, 'residence-cum-office', formData, images, geoLocation);
  }

  /**
   * Submit DSA/DST connector verification form
   */
  static async submitDsaConnectorVerification(
    caseId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, 'dsa-connector', formData, images, geoLocation);
  }

  /**
   * Submit property individual verification form
   */
  static async submitPropertyIndividualVerification(
    caseId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, 'property-individual', formData, images, geoLocation);
  }

  /**
   * Submit property APF verification form
   */
  static async submitPropertyApfVerification(
    caseId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, 'property-apf', formData, images, geoLocation);
  }

  /**
   * Submit NOC verification form
   */
  static async submitNocVerification(
    caseId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, 'noc', formData, images, geoLocation);
  }

  /**
   * Helper method for verification form submission
   */
  private static async submitVerificationForm(
    caseId: string,
    verificationType: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    try {
      console.log(`📋 Submitting ${verificationType} verification for case ${caseId}...`);

      // Validate minimum requirements
      if (images.length < 5) {
        return {
          success: false,
          error: `Minimum 5 geo-tagged photos required for ${verificationType} verification`
        };
      }

      // Check if all images have geo-location
      const photosWithoutGeo = images.filter(img =>
        !img.geoLocation ||
        !img.geoLocation.latitude ||
        !img.geoLocation.longitude
      );

      if (photosWithoutGeo.length > 0) {
        return {
          success: false,
          error: 'All photos must have geo-location data'
        };
      }

      // Prepare images for direct submission (no separate upload needed)
      const submissionImages = images.map(img => ({
        dataUrl: img.dataUrl,
        type: (img.type || 'verification') as 'verification' | 'selfie',
        geoLocation: img.geoLocation
      }));

      // Prepare submission data with embedded images
      const submissionData: VerificationSubmissionRequest = {
        formData,
        attachmentIds: [], // Empty for new approach
        geoLocation,
        photos: [], // Empty for new approach
        images: images.map(img => ({
          dataUrl: img.dataUrl,
          type: 'verification' as 'verification' | 'selfie',
          geoLocation: img.geoLocation
        }))
      };

      // Debug logging for submission data
      console.log(`🔍 ${verificationType} submission debug info:`, {
        caseId,
        verificationType,
        formDataKeys: Object.keys(formData),
        imageCount: images.length,
        hasGeoLocation: !!geoLocation,
        submissionDataSize: JSON.stringify(submissionData).length,
        endpoint: `${this.getApiBaseUrl()}/mobile/cases/${caseId}/verification/${verificationType}`
      });

      // Submit to backend with enhanced retry mechanism
      const result = await this.submitToBackendWithRetry(
        `${this.getApiBaseUrl()}/mobile/cases/${caseId}/verification/${verificationType}`,
        submissionData,
        'VERIFICATION_SUBMISSION',
        'HIGH',
        `${caseId}-${verificationType}-${Date.now()}`
      );

      if (result.success) {
        console.log(`✅ ${verificationType.charAt(0).toUpperCase() + verificationType.slice(1)} verification submitted successfully for case ${caseId}`);
      } else {
        console.error(`❌ ${verificationType.charAt(0).toUpperCase() + verificationType.slice(1)} verification submission failed for case ${caseId}:`, result.error);
      }

      return result;
    } catch (error) {
      console.error(`❌ ${verificationType.charAt(0).toUpperCase() + verificationType.slice(1)} verification submission error for case ${caseId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Enhanced method to submit verification data to backend with retry mechanism
   */
  private static async submitToBackendWithRetry(
    url: string,
    data: VerificationSubmissionRequest,
    type: 'VERIFICATION_SUBMISSION' | 'ATTACHMENT_UPLOAD' | 'CASE_UPDATE',
    priority: 'HIGH' | 'MEDIUM' | 'LOW',
    submissionId: string
  ): Promise<VerificationSubmissionResult> {
    try {
      // Check network connectivity
      if (!NetworkService.isOnline()) {
        // Add to retry queue for later
        const requestId = await retryService.addToRetryQueue(
          url,
          'POST',
          await this.getHeaders(),
          data,
          type,
          priority
        );

        return {
          success: false,
          error: 'No internet connection. Request queued for retry when connection is restored.',
          retryInfo: {
            requestId,
            willRetry: true
          }
        };
      }

      // Execute with retry mechanism
      const result = await retryService.executeWithRetry<{
        caseId?: string;
        status?: string;
        completedAt?: string;
      }>(
        url,
        'POST',
        await this.getHeaders(),
        data,
        type,
        priority,
        (progress) => {
          // Update submission progress based on retry progress
          if (progress.status === 'RETRYING') {
            progressTrackingService.updateStepProgress(
              submissionId,
              'submit_form',
              Math.round((progress.currentAttempt / progress.maxAttempts) * 100),
              'IN_PROGRESS',
              { retryAttempt: progress.currentAttempt, maxAttempts: progress.maxAttempts }
            );
          }
        }
      );

      if (result.success) {
        progressTrackingService.updateStepProgress(submissionId, 'submit_form', 100, 'COMPLETED');
        progressTrackingService.updateStepProgress(submissionId, 'confirmation', 100, 'COMPLETED');

        // Clear secure attachments after successful case submission
        try {
          console.log(`🗑️ Clearing secure attachments for completed case: ${caseId}`);
          await secureStorageService.clearCaseAttachments(caseId);
          console.log(`✅ Secure attachments cleared for case: ${caseId}`);
        } catch (error) {
          console.warn(`⚠️ Failed to clear attachments for case ${caseId}:`, error);
          // Don't fail the submission if attachment cleanup fails
        }

        return {
          success: true,
          caseId: result.data?.caseId,
          status: result.data?.status,
          completedAt: result.data?.completedAt
        };
      } else {
        return {
          success: false,
          error: result.error || 'Submission failed',
          retryInfo: {
            requestId: result.requestId,
            willRetry: true
          }
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred'
      };
    }
  }

  /**
   * Upload image to backend and return database attachment ID
   * @deprecated - No longer used with new direct submission approach
   */
  private static async uploadImageToBackend(caseId: string, image: CapturedImage): Promise<string> {
    try {
      const authToken = await AuthStorageService.getCurrentAccessToken();
      const envConfig = getEnvironmentConfig();

      // Handle both compressed and uncompressed image data
      const imageDataUrl = image.compressedData || image.dataUrl;

      if (!imageDataUrl) {
        throw new Error('No image data found (missing both compressedData and dataUrl)');
      }

      // Convert base64 data URL to blob using proper method
      const blob = this.dataURLToBlob(imageDataUrl);

      if (!blob) {
        throw new Error('Failed to convert image data to blob');
      }

      // Create form data
      const formData = new FormData();
      formData.append('files', blob, `image_${Date.now()}.jpg`);

      // Add geo location if available
      if (image.geoLocation) {
        formData.append('geoLocation', JSON.stringify(image.geoLocation));
      }

      // Upload to backend
      const uploadResponse = await fetch(`${this.getApiBaseUrl()}/mobile/cases/${caseId}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-App-Version': envConfig.app.version,
          'X-Platform': 'WEB',
          'X-Client-Type': 'mobile',
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed with status ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();

      console.log('📤 Upload response:', {
        success: uploadResult.success,
        hasData: !!uploadResult.data,
        dataLength: uploadResult.data?.length,
        firstItem: uploadResult.data?.[0]
      });

      if (!uploadResult.success) {
        throw new Error(`Upload failed: ${uploadResult.message || 'Unknown error'}`);
      }

      if (!uploadResult.data || !Array.isArray(uploadResult.data) || uploadResult.data.length === 0) {
        throw new Error('Upload response missing attachment data');
      }

      // Return the database attachment ID
      return uploadResult.data[0].id.toString();

    } catch (error) {
      console.error('Image upload failed:', error);
      throw error;
    }
  }

  /**
   * Convert data URL to Blob for proper file upload
   */
  private static dataURLToBlob(dataURL: string): Blob | null {
    try {
      // Check if it's a valid data URL
      if (!dataURL || !dataURL.startsWith('data:')) {
        console.error('Invalid data URL provided');
        return null;
      }

      // Split the data URL
      const parts = dataURL.split(',');
      if (parts.length !== 2) {
        console.error('Malformed data URL');
        return null;
      }

      const header = parts[0];
      const data = parts[1];

      // Extract MIME type
      const mimeMatch = header.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      // Check if it's base64 encoded
      const isBase64 = header.includes('base64');

      if (isBase64) {
        // Decode base64 data
        const byteCharacters = atob(data);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
      } else {
        // Handle non-base64 data (URL encoded)
        const decodedData = decodeURIComponent(data);
        return new Blob([decodedData], { type: mimeType });
      }
    } catch (error) {
      console.error('Error converting data URL to blob:', error);
      return null;
    }
  }

  /**
   * Get headers for API requests
   */
  private static async getHeaders(): Promise<Record<string, string>> {
    const authToken = await AuthStorageService.getCurrentAccessToken();
    const envConfig = getEnvironmentConfig();

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'X-App-Version': envConfig.app.version,
      'X-Platform': 'WEB',
      'X-Client-Type': 'mobile',
    };
  }

  /**
   * Legacy method to submit verification data to backend (kept for compatibility)
   */
  private static async submitToBackend(
    url: string,
    data: VerificationSubmissionRequest
  ): Promise<VerificationSubmissionResult> {
    try {
      // Check network connectivity
      if (!NetworkService.isOnline()) {
        return {
          success: false,
          error: 'No internet connection. Please check your network and try again.'
        };
      }

      // Get authentication token
      const authToken = await AuthStorageService.getCurrentAccessToken();
      if (!authToken) {
        return {
          success: false,
          error: 'Authentication required. Please log in again.'
        };
      }

      // Make API request
      const envConfig = getEnvironmentConfig();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-App-Version': envConfig.app.version,
          'X-Platform': 'WEB',
          'X-Client-Type': 'mobile',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`🚨 Backend API Error Details:`, {
          url,
          status: response.status,
          statusText: response.statusText,
          errorData,
          requestData: {
            formDataKeys: Object.keys(data.formData || {}),
            imageCount: data.images?.length || 0,
            hasGeoLocation: !!data.geoLocation
          }
        });
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          error: result.message || 'Verification submission failed'
        };
      }

      // Clear secure attachments after successful case submission
      try {
        // Extract caseId from URL (format: /mobile/cases/{caseId}/verification/{type})
        const caseIdMatch = url.match(/\/mobile\/cases\/([^\/]+)\/verification/);
        if (caseIdMatch && caseIdMatch[1]) {
          const caseId = caseIdMatch[1];
          console.log(`🗑️ Clearing secure attachments for completed case: ${caseId}`);
          await secureStorageService.clearCaseAttachments(caseId);
          console.log(`✅ Secure attachments cleared for case: ${caseId}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to clear attachments:`, error);
        // Don't fail the submission if attachment cleanup fails
      }

      return {
        success: true,
        caseId: result.data?.caseId,
        status: result.data?.status,
        completedAt: result.data?.completedAt
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred'
      };
    }
  }

  /**
   * Check if verification form can be submitted (validation)
   */
  static validateVerificationSubmission(
    formData: VerificationFormData,
    images: CapturedImage[],
    verificationType: 'residence' | 'office' | 'business' | 'builder' | 'residence-cum-office' | 'dsa-connector' | 'property-individual' | 'property-apf' | 'noc'
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check minimum photo requirement
    if (images.length < 5) {
      errors.push(`Minimum 5 photos required for ${verificationType} verification`);
    }

    // Check geo-location on photos
    const photosWithoutGeo = images.filter(img =>
      !img.geoLocation ||
      !img.geoLocation.latitude ||
      !img.geoLocation.longitude
    );

    if (photosWithoutGeo.length > 0) {
      errors.push('All photos must have geo-location data');
    }

    // Check required form fields based on verification type
    const requiredFieldsMap: Record<string, string[]> = {
      'residence': ['applicantName', 'addressConfirmed', 'residenceType', 'outcome'],
      'office': ['companyName', 'designation', 'workingHours', 'outcome'],
      'business': ['businessName', 'businessType', 'ownerName', 'outcome'],
      'builder': ['builderName', 'projectName', 'projectAddress', 'outcome'],
      'residence-cum-office': ['applicantName', 'residenceConfirmed', 'officeConfirmed', 'outcome'],
      'dsa-connector': ['connectorName', 'connectorType', 'officeAddress', 'outcome'],
      'property-individual': ['propertyOwner', 'propertyType', 'propertyAddress', 'outcome'],
      'property-apf': ['projectName', 'developerName', 'projectAddress', 'outcome'],
      'noc': ['applicantName', 'nocType', 'propertyAddress', 'outcome']
    };

    const requiredFields = requiredFieldsMap[verificationType] || ['outcome'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    if (missingFields.length > 0) {
      errors.push(`Missing required fields: ${missingFields.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default VerificationFormService;
