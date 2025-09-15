import { apiService } from './api';
import type { ApiResponse } from '@/types/api';

// Cache for blob URLs to avoid re-fetching
const blobUrlCache = new Map<string, string>();

export interface VerificationImage {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  photoType: 'verification' | 'selfie';
  verificationType: string;
  submissionId: string;
  geoLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: string;
    address?: string;
  };
}

export interface VerificationImagesQuery {
  verificationType?: string;
  submissionId?: string;
  photoType?: 'verification' | 'selfie';
}

class VerificationImagesService {
  /**
   * Get verification images for a case
   */
  async getVerificationImages(
    caseId: string, 
    query: VerificationImagesQuery = {}
  ): Promise<ApiResponse<VerificationImage[]>> {
    const params = new URLSearchParams();
    
    if (query.verificationType) {
      params.append('verificationType', query.verificationType);
    }
    
    if (query.submissionId) {
      params.append('submissionId', query.submissionId);
    }
    
    if (query.photoType) {
      params.append('photoType', query.photoType);
    }

    const queryString = params.toString();
    const url = `/cases/${caseId}/verification-images${queryString ? `?${queryString}` : ''}`;

    return apiService.get<VerificationImage[]>(url);
  }

  /**
   * Get verification images by submission ID
   */
  async getVerificationImagesBySubmission(
    caseId: string, 
    submissionId: string
  ): Promise<ApiResponse<VerificationImage[]>> {
    return this.getVerificationImages(caseId, { submissionId });
  }

  /**
   * Get verification images by type
   */
  async getVerificationImagesByType(
    caseId: string, 
    verificationType: string
  ): Promise<ApiResponse<VerificationImage[]>> {
    return this.getVerificationImages(caseId, { verificationType });
  }

  /**
   * Get only verification photos (excluding selfies)
   */
  async getVerificationPhotos(caseId: string): Promise<ApiResponse<VerificationImage[]>> {
    return this.getVerificationImages(caseId, { photoType: 'verification' });
  }

  /**
   * Get only selfie photos
   */
  async getSelfiePhotos(caseId: string): Promise<ApiResponse<VerificationImage[]>> {
    return this.getVerificationImages(caseId, { photoType: 'selfie' });
  }

  /**
   * Download verification image
   */
  async downloadVerificationImage(imageId: number): Promise<Blob> {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/cases/verification-images/${imageId}/serve`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Get verification image URL for display (returns blob URL for authenticated access)
   */
  async getImageDisplayUrl(imageUrl: string, imageId?: number): Promise<string> {
    // If we have an imageId, use the secure API endpoint with blob URL
    if (imageId) {
      const cacheKey = `image-${imageId}`;

      // Check if we already have a blob URL for this image
      if (blobUrlCache.has(cacheKey)) {
        return blobUrlCache.get(cacheKey)!;
      }

      try {
        // Fetch the image as blob with authentication
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/cases/verification-images/${imageId}/serve`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        // Create blob URL
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        // Cache the blob URL
        blobUrlCache.set(cacheKey, blobUrl);

        return blobUrl;
      } catch (error) {
        console.error('Error fetching image:', error);
        // Fallback to direct URL (might not work with auth)
        const baseUrl = import.meta.env.VITE_API_BASE_URL.replace('/api', '');
        return `${baseUrl}${imageUrl}`;
      }
    }

    // Fallback to direct URL (for backward compatibility)
    const baseUrl = import.meta.env.VITE_API_BASE_URL.replace('/api', '');
    return `${baseUrl}${imageUrl}`;
  }

  /**
   * Get thumbnail URL for display (returns blob URL for authenticated access)
   */
  async getThumbnailDisplayUrl(thumbnailUrl: string, imageId?: number): Promise<string> {
    // If we have an imageId, use the secure API endpoint with blob URL
    if (imageId) {
      const cacheKey = `thumbnail-${imageId}`;

      // Check if we already have a blob URL for this thumbnail
      if (blobUrlCache.has(cacheKey)) {
        return blobUrlCache.get(cacheKey)!;
      }

      try {
        // Fetch the thumbnail as blob with authentication
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/cases/verification-images/${imageId}/thumbnail`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch thumbnail: ${response.statusText}`);
        }

        // Create blob URL
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        // Cache the blob URL
        blobUrlCache.set(cacheKey, blobUrl);

        return blobUrl;
      } catch (error) {
        console.error('Error fetching thumbnail:', error);
        // Fallback to direct URL (might not work with auth)
        const baseUrl = import.meta.env.VITE_API_BASE_URL.replace('/api', '');
        return `${baseUrl}${thumbnailUrl}`;
      }
    }

    // Fallback to direct URL (for backward compatibility)
    const baseUrl = import.meta.env.VITE_API_BASE_URL.replace('/api', '');
    return `${baseUrl}${thumbnailUrl}`;
  }

  /**
   * Group verification images by submission
   */
  groupImagesBySubmission(images: VerificationImage[]): Record<string, VerificationImage[]> {
    return images.reduce((groups, image) => {
      const submissionId = image.submissionId;
      if (!groups[submissionId]) {
        groups[submissionId] = [];
      }
      groups[submissionId].push(image);
      return groups;
    }, {} as Record<string, VerificationImage[]>);
  }

  /**
   * Group verification images by type
   */
  groupImagesByType(images: VerificationImage[]): Record<string, VerificationImage[]> {
    return images.reduce((groups, image) => {
      const photoType = image.photoType;
      if (!groups[photoType]) {
        groups[photoType] = [];
      }
      groups[photoType].push(image);
      return groups;
    }, {} as Record<string, VerificationImage[]>);
  }

  /**
   * Get verification statistics
   */
  getVerificationStats(images: VerificationImage[]) {
    const stats = {
      total: images.length,
      verificationPhotos: 0,
      selfiePhotos: 0,
      geoTaggedPhotos: 0,
      submissions: new Set<string>(),
      verificationTypes: new Set<string>(),
    };

    images.forEach(image => {
      if (image.photoType === 'verification') {
        stats.verificationPhotos++;
      } else if (image.photoType === 'selfie') {
        stats.selfiePhotos++;
      }

      if (image.geoLocation) {
        stats.geoTaggedPhotos++;
      }

      stats.submissions.add(image.submissionId);
      stats.verificationTypes.add(image.verificationType);
    });

    return {
      ...stats,
      submissionCount: stats.submissions.size,
      verificationTypeCount: stats.verificationTypes.size,
    };
  }

  /**
   * Clean up blob URLs to prevent memory leaks
   */
  static cleanupBlobUrls(): void {
    blobUrlCache.forEach((blobUrl) => {
      window.URL.revokeObjectURL(blobUrl);
    });
    blobUrlCache.clear();
  }
}

export const verificationImagesService = new VerificationImagesService();
