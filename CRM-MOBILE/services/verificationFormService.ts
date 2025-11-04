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
  verificationTaskId: string; // Required for multi-task architecture
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
   * Get API base URL - Environment-aware configuration
   */
  private static getApiBaseUrl(): string {
    console.log('🔍 Verification Form Service - API Configuration');

    // Check if we're in production mode
    const isProduction = import.meta.env.PROD;

    if (isProduction) {
      // Production: Use domain-based API URL
      const productionUrl = 'https://example.com/api';
      console.log('🌍 Verification Form Service - Using Production API URL:', productionUrl);
      return productionUrl;
    } else {
      // Development: Try static IP first, then fallback to localhost
      if (import.meta.env.VITE_API_BASE_URL_STATIC_IP) {
        const url = import.meta.env.VITE_API_BASE_URL_STATIC_IP;
        console.log('🌍 Verification Form Service - Using Static IP API URL:', url);
        return url;
      }

      // Fallback to localhost for development
      const devUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
      console.log('🌍 Verification Form Service - Using Development API URL:', devUrl);
      return devUrl;
    }
  }

  /**
   * Submit residence verification form with enhanced error recovery, progress tracking, and compression
   */
  static async submitResidenceVerification(
    caseId: string,
    verificationTaskId: string,
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
        verificationTaskId, // Required for multi-task architecture
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

        // Clean up offline attachments after successful submission
        try {
          const { attachmentSyncService } = await import('./attachmentSyncService');
          await attachmentSyncService.clearAttachmentsForCase(caseId);
          console.log(`🗑️ Cleared offline attachments for case ${caseId}`);
        } catch (error) {
          console.warn('⚠️ Failed to clear offline attachments:', error);
          // Don't fail the submission if cleanup fails
        }

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
    verificationTaskId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, verificationTaskId, 'office', formData, images, geoLocation);
  }

  /**
   * Submit business verification form
   */
  static async submitBusinessVerification(
    caseId: string,
    verificationTaskId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, verificationTaskId, 'business', formData, images, geoLocation);
  }

  /**
   * Submit builder verification form
   */
  static async submitBuilderVerification(
    caseId: string,
    verificationTaskId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, verificationTaskId, 'builder', formData, images, geoLocation);
  }

  /**
   * Submit residence-cum-office verification form
   */
  static async submitResidenceCumOfficeVerification(
    caseId: string,
    verificationTaskId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, verificationTaskId, 'residence-cum-office', formData, images, geoLocation);
  }

  /**
   * Submit DSA/DST connector verification form
   */
  static async submitDsaConnectorVerification(
    caseId: string,
    verificationTaskId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, verificationTaskId, 'dsa-connector', formData, images, geoLocation);
  }

  /**
   * Submit property individual verification form
   */
  static async submitPropertyIndividualVerification(
    caseId: string,
    verificationTaskId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, verificationTaskId, 'property-individual', formData, images, geoLocation);
  }

  /**
   * Submit property APF verification form
   */
  static async submitPropertyApfVerification(
    caseId: string,
    verificationTaskId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, verificationTaskId, 'property-apf', formData, images, geoLocation);
  }

  /**
   * Submit NOC verification form
   */
  static async submitNocVerification(
    caseId: string,
    verificationTaskId: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    return this.submitVerificationForm(caseId, verificationTaskId, 'noc', formData, images, geoLocation);
  }

  /**
   * Helper method for verification form submission
   */
  private static async submitVerificationForm(
    caseId: string,
    verificationTaskId: string,
    verificationType: string,
    formData: VerificationFormData,
    images: CapturedImage[],
    geoLocation?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<VerificationSubmissionResult> {
    try {
      // Debug logging to identify parameter values
      console.log('Debug - Function parameters:', { caseId, verificationType, typeof_caseId: typeof caseId });
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
        verificationTaskId, // Required for multi-task architecture
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

      // Enhanced response validation and error handling
      if (result.success) {
        // Validate that the response contains expected data structure
        const responseData = result.data;
        const hasValidCaseId = responseData?.caseId || responseData?.data?.caseId;

        if (hasValidCaseId) {
          console.log(`✅ ${verificationType.charAt(0).toUpperCase() + verificationType.slice(1)} verification submitted successfully for case ${caseId}`);
          console.log(`📋 Response data:`, {
            caseId: responseData?.caseId || responseData?.data?.caseId,
            status: responseData?.status || responseData?.data?.status,
            completedAt: responseData?.completedAt || responseData?.data?.completedAt
          });
        } else {
          // Success response but missing expected data - this might be the source of the error
          console.warn(`⚠️ ${verificationType.charAt(0).toUpperCase() + verificationType.slice(1)} verification submitted but response missing caseId. Full response:`, responseData);
          // Still treat as success since backend processed it successfully
        }

        // Clean up offline attachments after successful submission
        try {
          const { attachmentSyncService } = await import('./attachmentSyncService');
          await attachmentSyncService.clearAttachmentsForCase(caseId);
          console.log(`🗑️ Cleared offline attachments for case ${caseId}`);
        } catch (error) {
          console.warn('⚠️ Failed to clear offline attachments:', error);
          // Don't fail the submission if cleanup fails
        }
      } else {
        console.error(`❌ ${verificationType.charAt(0).toUpperCase() + verificationType.slice(1)} verification submission failed for case ${caseId}:`, result.error);

        // Enhanced error analysis
        if (result.error && typeof result.error === 'string') {
          if (result.error.includes('caseId is not defined')) {
            console.error('🔍 Detected "caseId is not defined" error - this may be a false positive if backend logs show success');
            console.error('🔍 Function parameters were valid:', { caseId, verificationType, typeof_caseId: typeof caseId });
          }
        }
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

        // Enhanced response data extraction to handle different response structures
        const responseData = result.data;
        let extractedCaseId: string | undefined;
        let extractedStatus: string | undefined;
        let extractedCompletedAt: string | undefined;

        // Try different response structure patterns
        if (responseData?.data) {
          // Backend returns { success: true, data: { caseId, status, completedAt } }
          extractedCaseId = responseData.data.caseId;
          extractedStatus = responseData.data.status;
          extractedCompletedAt = responseData.data.completedAt;
        } else if (responseData?.caseId) {
          // Direct response structure
          extractedCaseId = responseData.caseId;
          extractedStatus = responseData.status;
          extractedCompletedAt = responseData.completedAt;
        } else {
          // Fallback: use the original caseId parameter if response doesn't contain it
          extractedCaseId = caseId;
          console.warn(`⚠️ Response missing caseId, using original parameter: ${caseId}`);
        }

        // Clear secure attachments after successful case submission
        try {
          console.log(`🗑️ Clearing secure attachments for completed case: ${extractedCaseId}`);
          await secureStorageService.clearCaseAttachments(extractedCaseId || caseId);
          console.log(`✅ Secure attachments cleared for case: ${extractedCaseId || caseId}`);
        } catch (error) {
          console.warn(`⚠️ Failed to clear attachments for case ${extractedCaseId || caseId}:`, error);
          // Don't fail the submission if attachment cleanup fails
        }

        return {
          success: true,
          caseId: extractedCaseId,
          status: extractedStatus,
          completedAt: extractedCompletedAt
        };
      } else {
        // Enhanced error handling for resubmission
        const errorMessage = result.error || 'Submission failed';

        // Check if this is a network/retry-able error
        const isRetryableError = !errorMessage.includes('validation') &&
                                !errorMessage.includes('not found') &&
                                !errorMessage.includes('access denied') &&
                                !errorMessage.includes('forbidden');

        return {
          success: false,
          error: errorMessage,
          retryInfo: {
            requestId: result.requestId,
            willRetry: isRetryableError
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
   * Retry a failed verification submission
   */
  /**
   * Resubmit a verification form using auto-saved data
   * This retrieves the auto-saved form data and creates a new submission
   */
  static async retryVerificationSubmission(
    caseId: string,
    verificationType: 'residence' | 'office' | 'business' | 'builder' | 'residence-cum-office' | 'dsa-connector' | 'property-individual' | 'property-apf' | 'noc',
    verificationTaskId?: string
  ): Promise<VerificationSubmissionResult> {
    try {
      console.log(`🔄 Resubmitting ${verificationType} verification for case ${caseId}...`);

      // Import auto-save service
      const { autoSaveService } = await import('./autoSaveService');

      // Determine the form type from verification type
      const formTypeMap: Record<string, string> = {
        'residence': 'RESIDENCE',
        'office': 'OFFICE',
        'business': 'BUSINESS',
        'builder': 'BUILDER',
        'residence-cum-office': 'RESIDENCE_CUM_OFFICE',
        'dsa-connector': 'DSA_CONNECTOR',
        'property-individual': 'PROPERTY_INDIVIDUAL',
        'property-apf': 'PROPERTY_APF',
        'noc': 'NOC'
      };

      const formType = formTypeMap[verificationType];
      if (!formType) {
        return {
          success: false,
          error: `Invalid verification type: ${verificationType}`
        };
      }

      // Retrieve auto-saved data
      console.log(`📂 Retrieving auto-saved data for case ${caseId}, form type ${formType}...`);
      const autoSavedData = await autoSaveService.getFormData(caseId, formType);

      if (!autoSavedData) {
        return {
          success: false,
          error: 'No auto-saved data found for this case. Please fill out the form again.'
        };
      }

      console.log(`✅ Found auto-saved data from ${autoSavedData.lastSaved}`);
      console.log(`   - Form data keys: ${Object.keys(autoSavedData.formData || {}).join(', ')}`);
      console.log(`   - Images: ${autoSavedData.images?.length || 0}`);

      // Use provided verificationTaskId or try to get it from auto-saved data
      const taskId = verificationTaskId || autoSavedData.formData?.verificationTaskId;

      if (!taskId) {
        return {
          success: false,
          error: 'No verification task ID found. Cannot submit verification.'
        };
      }

      // Prepare the submission payload
      const submissionPayload = {
        verificationTaskId: taskId,
        formData: autoSavedData.formData,
        images: autoSavedData.images || [],
        geoLocation: autoSavedData.formData?.geoLocation || null,
        photos: autoSavedData.images || []
      };

      console.log(`📤 Submitting verification with ${submissionPayload.images.length} images...`);

      // Submit the verification using the appropriate method
      const result = await this.submitVerification(caseId, verificationType, submissionPayload);

      if (result.success) {
        console.log(`✅ Verification resubmitted successfully for case ${caseId}`);

        // Mark the auto-saved data as completed
        await autoSaveService.markFormCompleted(caseId, formType);

        return {
          success: true,
          caseId: result.caseId || caseId,
          status: result.status,
          completedAt: result.completedAt
        };
      } else {
        return {
          success: false,
          error: result.error || 'Submission failed'
        };
      }

    } catch (error) {
      console.error(`❌ Error resubmitting ${verificationType} verification for case ${caseId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Resubmission error occurred'
      };
    }
  }

  /**
   * Generic method to submit verification to the backend
   * This is used by retryVerificationSubmission to actually submit the form
   */
  private static async submitVerification(
    caseId: string,
    verificationType: string,
    payload: any
  ): Promise<VerificationSubmissionResult> {
    try {
      const token = await AuthStorageService.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const apiBaseUrl = this.getApiBaseUrl();
      const endpoint = `${apiBaseUrl}/api/mobile/cases/${caseId}/verification/${verificationType}`;

      console.log(`📤 Submitting to: ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-App-Version': '4.0.1'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (result.success) {
        return {
          success: true,
          caseId: result.data?.caseId || caseId,
          status: result.data?.status,
          completedAt: result.data?.completedAt,
          submissionId: result.data?.submissionId
        };
      } else {
        return {
          success: false,
          error: result.message || 'Submission failed'
        };
      }

    } catch (error) {
      console.error(`❌ Error submitting ${verificationType} verification:`, error);
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
