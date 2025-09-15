import { secureStorageService, EncryptedAttachment } from './secureStorageService';
import { encryptionService } from './encryptionService';

/**
 * Attachment download status
 */
export interface AttachmentDownloadStatus {
  id: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

/**
 * Offline attachment interface
 */
export interface OfflineAttachment {
  id: string;
  name: string;
  type: 'pdf' | 'image';
  mimeType: string;
  size: number;
  caseId: string;
  isAvailableOffline: boolean;
  downloadedAt?: string;
  lastSyncedAt?: string;
}

/**
 * Offline Attachment Service for CaseFlow Mobile
 * Manages secure offline storage and synchronization of attachments
 */
export class OfflineAttachmentService {
  private static instance: OfflineAttachmentService;
  private downloadQueue = new Map<string, AttachmentDownloadStatus>();
  private syncInProgress = false;

  private constructor() {}

  static getInstance(): OfflineAttachmentService {
    if (!OfflineAttachmentService.instance) {
      OfflineAttachmentService.instance = new OfflineAttachmentService();
    }
    return OfflineAttachmentService.instance;
  }

  /**
   * Initialize offline attachment service
   */
  async initialize(): Promise<void> {
    try {
      console.log('📱 Initializing offline attachment service...');
      
      // Initialize secure storage
      await secureStorageService.initialize();
      
      console.log('✅ Offline attachment service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize offline attachment service:', error);
      throw error;
    }
  }

  /**
   * Download and store attachment for offline access
   */
  async downloadAttachment(
    attachmentId: string,
    attachmentUrl: string,
    metadata: {
      name: string;
      type: 'pdf' | 'image';
      mimeType: string;
      size: number;
      caseId: string;
    }
  ): Promise<boolean> {
    try {
      console.log(`⬇️ Downloading attachment for offline access: ${metadata.name}`);

      // Update download status
      this.updateDownloadStatus(attachmentId, 'downloading', 0);

      // Check if already downloaded
      const existingAttachment = await secureStorageService.getAttachmentMetadata(attachmentId);
      if (existingAttachment) {
        console.log(`✅ Attachment already available offline: ${attachmentId}`);
        this.updateDownloadStatus(attachmentId, 'completed', 100);
        return true;
      }

      // Simulate download progress (in real app, this would be actual HTTP download)
      const attachmentData = await this.simulateAttachmentDownload(
        attachmentUrl,
        metadata,
        (progress) => this.updateDownloadStatus(attachmentId, 'downloading', progress)
      );

      // Store attachment securely
      await secureStorageService.storeAttachment(attachmentId, attachmentData, {
        originalName: metadata.name,
        mimeType: metadata.mimeType,
        size: metadata.size,
        caseId: metadata.caseId
      });

      this.updateDownloadStatus(attachmentId, 'completed', 100);
      console.log(`✅ Attachment downloaded and stored offline: ${attachmentId}`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to download attachment ${attachmentId}:`, error);
      this.updateDownloadStatus(attachmentId, 'failed', 0, error.message);
      return false;
    }
  }

  /**
   * Get attachment content for offline viewing
   */
  async getOfflineAttachment(attachmentId: string): Promise<string | null> {
    try {
      console.log(`📱 Getting offline attachment: ${attachmentId}`);
      
      const content = await secureStorageService.retrieveAttachment(attachmentId);
      
      if (content) {
        console.log(`✅ Offline attachment retrieved: ${attachmentId}`);
      } else {
        console.log(`❌ Offline attachment not found: ${attachmentId}`);
      }
      
      return content;
    } catch (error) {
      console.error(`❌ Failed to get offline attachment ${attachmentId}:`, error);
      return null;
    }
  }

  /**
   * Check if attachment is available offline
   */
  async isAttachmentAvailableOffline(attachmentId: string): Promise<boolean> {
    try {
      const metadata = await secureStorageService.getAttachmentMetadata(attachmentId);
      return metadata !== null;
    } catch (error) {
      console.error(`❌ Failed to check offline availability for ${attachmentId}:`, error);
      return false;
    }
  }

  /**
   * Get list of offline attachments for a case
   */
  async getOfflineAttachments(caseId?: string): Promise<OfflineAttachment[]> {
    try {
      const encryptedAttachments = await secureStorageService.listAttachments(caseId);
      
      return encryptedAttachments.map(attachment => ({
        id: attachment.id,
        name: attachment.originalName,
        type: this.getAttachmentType(attachment.mimeType),
        mimeType: attachment.mimeType,
        size: attachment.size,
        caseId: attachment.caseId,
        isAvailableOffline: true,
        downloadedAt: attachment.createdAt,
        lastSyncedAt: attachment.lastAccessed
      }));
    } catch (error) {
      console.error('❌ Failed to get offline attachments:', error);
      return [];
    }
  }

  /**
   * Remove attachment from offline storage
   */
  async removeOfflineAttachment(attachmentId: string): Promise<boolean> {
    try {
      console.log(`🗑️ Removing offline attachment: ${attachmentId}`);
      
      const success = await secureStorageService.deleteAttachment(attachmentId);
      
      if (success) {
        console.log(`✅ Offline attachment removed: ${attachmentId}`);
      } else {
        console.log(`❌ Failed to remove offline attachment: ${attachmentId}`);
      }
      
      return success;
    } catch (error) {
      console.error(`❌ Failed to remove offline attachment ${attachmentId}:`, error);
      return false;
    }
  }

  /**
   * Sync offline attachments with server
   */
  async syncAttachments(caseIds: string[]): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress');
      return { success: 0, failed: 0 };
    }

    try {
      this.syncInProgress = true;
      console.log('🔄 Starting attachment sync...');

      let successCount = 0;
      let failedCount = 0;

      for (const caseId of caseIds) {
        try {
          // In a real app, this would fetch attachment list from server
          const serverAttachments = await this.getServerAttachments(caseId);
          
          for (const serverAttachment of serverAttachments) {
            const isOffline = await this.isAttachmentAvailableOffline(serverAttachment.id);
            
            if (!isOffline) {
              const success = await this.downloadAttachment(
                serverAttachment.id,
                serverAttachment.url,
                {
                  name: serverAttachment.name,
                  type: this.getAttachmentType(serverAttachment.mimeType),
                  mimeType: serverAttachment.mimeType,
                  size: serverAttachment.size,
                  caseId: caseId
                }
              );
              
              if (success) {
                successCount++;
              } else {
                failedCount++;
              }
            }
          }
        } catch (error) {
          console.error(`❌ Failed to sync attachments for case ${caseId}:`, error);
          failedCount++;
        }
      }

      console.log(`✅ Sync completed: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error('❌ Attachment sync failed:', error);
      return { success: 0, failed: 1 };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get download status for attachment
   */
  getDownloadStatus(attachmentId: string): AttachmentDownloadStatus | null {
    return this.downloadQueue.get(attachmentId) || null;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    return await secureStorageService.getStorageStats();
  }

  /**
   * Cleanup old offline attachments
   */
  async cleanupOldAttachments(maxAgeInDays: number = 30): Promise<number> {
    const maxAge = maxAgeInDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
    return await secureStorageService.cleanup(maxAge);
  }

  /**
   * Clear all offline attachments
   */
  async clearAllOfflineAttachments(): Promise<boolean> {
    try {
      console.log('🧹 Clearing all offline attachments...');
      
      const attachments = await secureStorageService.listAttachments();
      let successCount = 0;
      
      for (const attachment of attachments) {
        const success = await secureStorageService.deleteAttachment(attachment.id);
        if (success) successCount++;
      }
      
      // Clear cache
      secureStorageService.clearCache();
      
      console.log(`✅ Cleared ${successCount} offline attachments`);
      return successCount === attachments.length;
    } catch (error) {
      console.error('❌ Failed to clear offline attachments:', error);
      return false;
    }
  }

  /**
   * Update download status
   */
  private updateDownloadStatus(
    attachmentId: string,
    status: AttachmentDownloadStatus['status'],
    progress: number,
    error?: string
  ): void {
    this.downloadQueue.set(attachmentId, {
      id: attachmentId,
      status,
      progress,
      error
    });
  }

  /**
   * Simulate attachment download (replace with actual HTTP download in production)
   */
  private async simulateAttachmentDownload(
    url: string,
    metadata: any,
    onProgress: (progress: number) => void
  ): Promise<string> {
    // Simulate download progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      onProgress(i);
    }

    // Return simulated attachment data based on type
    if (metadata.type === 'pdf') {
      return this.generateSamplePdfData(metadata.name);
    } else {
      return this.generateSampleImageData(metadata.name);
    }
  }

  /**
   * Generate sample PDF data for demo
   */
  private generateSamplePdfData(fileName: string): string {
    // Return base64 PDF data (simplified for demo)
    const pdfContent = `Sample PDF content for ${fileName} - Downloaded for offline access`;
    return `data:application/pdf;base64,${btoa(pdfContent)}`;
  }

  /**
   * Generate sample image data for demo
   */
  private generateSampleImageData(fileName: string): string {
    // Return base64 image data (simplified for demo)
    const imageContent = `Sample image content for ${fileName} - Downloaded for offline access`;
    return `data:image/jpeg;base64,${btoa(imageContent)}`;
  }

  /**
   * Get attachment type from MIME type
   */
  private getAttachmentType(mimeType: string): 'pdf' | 'image' {
    if (mimeType.includes('pdf')) return 'pdf';
    return 'image';
  }

  /**
   * Get server attachments (mock implementation)
   */
  private async getServerAttachments(caseId: string): Promise<any[]> {
    // Mock server response - in real app, this would be an API call
    return [
      {
        id: `${caseId}-attachment-1`,
        name: 'Property_Documents.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
        url: '/api/attachments/property-docs.pdf'
      },
      {
        id: `${caseId}-attachment-2`,
        name: 'Bank_Statement.pdf',
        mimeType: 'application/pdf',
        size: 512000,
        url: '/api/attachments/bank-statement.pdf'
      }
    ];
  }
}

// Export singleton instance
export const offlineAttachmentService = OfflineAttachmentService.getInstance();
