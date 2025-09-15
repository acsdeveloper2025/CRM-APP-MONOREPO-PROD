import { CapturedImage } from '../types';

export interface CompressionOptions {
  imageQuality: number; // 0.1 to 1.0
  maxWidth: number;
  maxHeight: number;
  format: 'jpeg' | 'webp';
  enableProgressiveJPEG: boolean;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: string;
  dimensions: { width: number; height: number };
  quality: number;
}

export interface CompressedData {
  images: Array<{
    id: string;
    compressedData: string; // base64
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    geoLocation: any;
    metadata: any;
  }>;
  formData: {
    compressed: string; // compressed JSON string
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  };
  totalOriginalSize: number;
  totalCompressedSize: number;
  overallCompressionRatio: number;
}

class CompressionService {
  private static readonly DEFAULT_OPTIONS: CompressionOptions = {
    imageQuality: 0.8,
    maxWidth: 1920,
    maxHeight: 1080,
    format: 'jpeg',
    enableProgressiveJPEG: true
  };

  /**
   * Compress images and form data for mobile submission
   */
  async compressSubmissionData(
    images: CapturedImage[],
    formData: any,
    options: Partial<CompressionOptions> = {},
    onProgress?: (progress: number) => void
  ): Promise<CompressedData> {
    const compressionOptions = { ...CompressionService.DEFAULT_OPTIONS, ...options };
    
    console.log(`🗜️ Starting compression of ${images.length} images and form data...`);
    
    const startTime = Date.now();
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    // Compress images
    const compressedImages: CompressedData['images'] = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      onProgress?.(Math.round((i / (images.length + 1)) * 100));
      
      try {
        const compressed = await this.compressImage(image, compressionOptions);
        compressedImages.push({
          id: image.id,
          compressedData: compressed.compressedData,
          originalSize: compressed.originalSize,
          compressedSize: compressed.compressedSize,
          compressionRatio: compressed.compressionRatio,
          geoLocation: image.geoLocation,
          metadata: {
            ...image.metadata,
            compression: {
              quality: compressed.quality,
              format: compressed.format,
              dimensions: compressed.dimensions,
              compressionTime: compressed.compressionTime
            }
          }
        });

        totalOriginalSize += compressed.originalSize;
        totalCompressedSize += compressed.compressedSize;

      } catch (error) {
        console.error(`Failed to compress image ${image.id}:`, error);
        // Fallback to original image data
        const originalSize = this.estimateBase64Size(image.dataUrl);
        const fallbackSize = originalSize || 1024; // Default size if estimation fails

        compressedImages.push({
          id: image.id,
          compressedData: image.dataUrl || '', // Fallback to empty string if dataUrl is undefined
          originalSize: fallbackSize,
          compressedSize: fallbackSize,
          compressionRatio: 1,
          geoLocation: image.geoLocation,
          metadata: {
            ...image.metadata,
            compressionError: error instanceof Error ? error.message : 'Compression failed',
            fallbackUsed: true
          }
        });

        totalOriginalSize += fallbackSize;
        totalCompressedSize += fallbackSize;
      }
    }

    // Compress form data
    onProgress?.(95);
    const compressedFormData = await this.compressFormData(formData);
    totalOriginalSize += compressedFormData.originalSize;
    totalCompressedSize += compressedFormData.compressedSize;

    onProgress?.(100);

    const overallCompressionRatio = totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1;
    const compressionTime = Date.now() - startTime;

    console.log(`✅ Compression completed in ${compressionTime}ms`);
    console.log(`📊 Overall compression: ${this.formatBytes(totalOriginalSize)} → ${this.formatBytes(totalCompressedSize)} (${Math.round((1 - overallCompressionRatio) * 100)}% reduction)`);

    return {
      images: compressedImages,
      formData: compressedFormData,
      totalOriginalSize,
      totalCompressedSize,
      overallCompressionRatio
    };
  }

  /**
   * Compress a single image
   */
  private async compressImage(
    image: CapturedImage,
    options: CompressionOptions
  ): Promise<CompressionResult & { compressedData: string; compressionTime: number }> {
    const startTime = Date.now();

    // Check if we have a valid image data URL
    if (!image.dataUrl || typeof image.dataUrl !== 'string') {
      throw new Error('Invalid image data URL');
    }

    // For browser environment, we need to handle different image sources
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      const img = new Image();

      img.onload = () => {
        try {
          // Calculate new dimensions
          const { width: newWidth, height: newHeight } = this.calculateDimensions(
            img.width,
            img.height,
            options.maxWidth,
            options.maxHeight
          );

          canvas.width = newWidth;
          canvas.height = newHeight;

          // Draw and compress
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          const compressedData = canvas.toDataURL(
            `image/${options.format}`,
            options.quality
          );

          const originalSize = this.estimateBase64Size(image.dataUrl);
          const compressedSize = this.estimateBase64Size(compressedData);
          const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
          const compressionTime = Date.now() - startTime;

          resolve({
            compressedData,
            originalSize,
            compressedSize,
            compressionRatio,
            format: options.format,
            dimensions: { width: newWidth, height: newHeight },
            quality: options.quality,
            compressionTime
          });

        } catch (error) {
          reject(error);
        }
      };

      img.onerror = (error) => {
        console.error('Image load error:', error);
        reject(new Error(`Failed to load image: ${image.dataUrl.substring(0, 100)}...`));
      };

      // Set CORS if needed for external images
      img.crossOrigin = 'anonymous';

      // Handle different image sources
      if (image.dataUrl.startsWith('data:')) {
        // Base64 data URI
        img.src = image.dataUrl;
      } else if (image.dataUrl.startsWith('blob:')) {
        // Blob URL
        img.src = image.dataUrl;
      } else if (image.dataUrl.startsWith('http')) {
        // External URL
        img.src = image.dataUrl;
      } else {
        // Assume it's a file path or other format
        img.src = image.dataUrl;
      }

      // Add timeout to prevent hanging
      setTimeout(() => {
        reject(new Error('Image load timeout'));
      }, 10000); // 10 second timeout
    });
  }

  /**
   * Compress form data using JSON compression
   */
  private async compressFormData(formData: any): Promise<CompressedData['formData']> {
    try {
      const originalJson = JSON.stringify(formData);
      const originalSize = new Blob([originalJson]).size;

      // Simple compression: remove unnecessary whitespace and optimize structure
      const optimizedData = this.optimizeFormData(formData);
      const compressedJson = JSON.stringify(optimizedData);
      const compressedSize = new Blob([compressedJson]).size;

      // For better compression, we could use libraries like pako for gzip compression
      // But for now, we'll use JSON optimization
      const compressionRatio = compressedSize / originalSize;

      return {
        compressed: compressedJson,
        originalSize,
        compressedSize,
        compressionRatio
      };

    } catch (error) {
      console.error('Form data compression failed:', error);
      const fallbackJson = JSON.stringify(formData);
      const size = new Blob([fallbackJson]).size;
      
      return {
        compressed: fallbackJson,
        originalSize: size,
        compressedSize: size,
        compressionRatio: 1
      };
    }
  }

  /**
   * Optimize form data structure for better compression
   */
  private optimizeFormData(formData: any): any {
    const optimized = { ...formData };

    // Remove empty or null values
    Object.keys(optimized).forEach(key => {
      if (optimized[key] === null || optimized[key] === undefined || optimized[key] === '') {
        delete optimized[key];
      }
    });

    // Convert boolean strings to actual booleans
    Object.keys(optimized).forEach(key => {
      if (optimized[key] === 'true') optimized[key] = true;
      if (optimized[key] === 'false') optimized[key] = false;
    });

    // Optimize common field names (create abbreviations)
    const fieldMappings: Record<string, string> = {
      'addressLocatable': 'addrLoc',
      'addressRating': 'addrRat',
      'houseStatus': 'houseS',
      'metPersonName': 'metPers',
      'totalFamilyMembers': 'famMem',
      'workingStatus': 'workS',
      'companyName': 'company',
      'finalStatus': 'finalS',
      'applicantName': 'applName',
      'addressConfirmed': 'addrConf',
      'residenceType': 'resType',
      'neighborVerification': 'neighVer',
      'recommendationStatus': 'recStatus'
    };

    const abbreviated: any = {};
    Object.keys(optimized).forEach(key => {
      const newKey = fieldMappings[key] || key;
      abbreviated[newKey] = optimized[key];
    });

    return abbreviated;
  }

  /**
   * Calculate optimal dimensions for image compression
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight };

    // Calculate scaling factor
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio, 1); // Don't upscale

    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    return { width, height };
  }

  /**
   * Estimate size of base64 encoded data
   */
  private estimateBase64Size(base64String: string | undefined): number {
    if (!base64String || typeof base64String !== 'string') {
      return 0;
    }

    // Remove data URL prefix if present
    const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');

    // Base64 encoding increases size by ~33%, but we need to account for padding
    const padding = (base64Data.match(/=/g) || []).length;
    const dataLength = base64Data.length;

    return Math.round((dataLength * 3) / 4 - padding);
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get compression recommendations based on network conditions
   */
  getCompressionRecommendations(networkType: 'wifi' | 'cellular' | 'slow'): CompressionOptions {
    switch (networkType) {
      case 'wifi':
        return {
          imageQuality: 0.9,
          maxWidth: 1920,
          maxHeight: 1080,
          format: 'jpeg',
          enableProgressiveJPEG: true
        };
      
      case 'cellular':
        return {
          imageQuality: 0.8,
          maxWidth: 1280,
          maxHeight: 720,
          format: 'jpeg',
          enableProgressiveJPEG: true
        };
      
      case 'slow':
        return {
          imageQuality: 0.6,
          maxWidth: 800,
          maxHeight: 600,
          format: 'jpeg',
          enableProgressiveJPEG: false
        };
      
      default:
        return CompressionService.DEFAULT_OPTIONS;
    }
  }

  /**
   * Decompress form data (reverse the optimization)
   */
  decompressFormData(compressedData: string): any {
    try {
      const compressed = JSON.parse(compressedData);
      
      // Reverse field name abbreviations
      const fieldMappings: Record<string, string> = {
        'addrLoc': 'addressLocatable',
        'addrRat': 'addressRating',
        'houseS': 'houseStatus',
        'metPers': 'metPersonName',
        'famMem': 'totalFamilyMembers',
        'workS': 'workingStatus',
        'company': 'companyName',
        'finalS': 'finalStatus',
        'applName': 'applicantName',
        'addrConf': 'addressConfirmed',
        'resType': 'residenceType',
        'neighVer': 'neighborVerification',
        'recStatus': 'recommendationStatus'
      };

      const decompressed: any = {};
      Object.keys(compressed).forEach(key => {
        const originalKey = fieldMappings[key] || key;
        decompressed[originalKey] = compressed[key];
      });

      return decompressed;

    } catch (error) {
      console.error('Failed to decompress form data:', error);
      return JSON.parse(compressedData); // Fallback to direct parsing
    }
  }
}

export default new CompressionService();
