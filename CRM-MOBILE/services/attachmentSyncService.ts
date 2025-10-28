import { apiService } from './apiService';
import { secureStorageService } from './secureStorageService';
import { Case } from '../types/case';

/**
 * Attachment Sync Service
 * Handles automatic download and encryption of attachments during case sync
 * for secure offline access
 */
class AttachmentSyncService {
  private syncInProgress = false;
  private syncedAttachments = new Set<string>();

  /**
   * Sync attachments for all cases
   * Downloads and encrypts attachments for offline access
   */
  async syncAttachmentsForCases(cases: Case[]): Promise<{
    success: boolean;
    totalAttachments: number;
    syncedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    if (this.syncInProgress) {
      console.log('⏳ Attachment sync already in progress, skipping...');
      return {
        success: false,
        totalAttachments: 0,
        syncedCount: 0,
        failedCount: 0,
        errors: ['Sync already in progress']
      };
    }

    this.syncInProgress = true;
    let totalAttachments = 0;
    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      console.log(`📦 Starting attachment sync for ${cases.length} cases...`);

      // Ensure encryption service is initialized before syncing
      await secureStorageService.ensureInitialized();

      for (const caseItem of cases) {
        try {
          const result = await this.syncAttachmentsForCase(caseItem);
          totalAttachments += result.totalAttachments;
          syncedCount += result.syncedCount;
          failedCount += result.failedCount;
          errors.push(...result.errors);
        } catch (error) {
          console.error(`❌ Failed to sync attachments for case ${caseItem.id}:`, error);
          errors.push(`Case ${caseItem.caseId}: ${error.message}`);
        }
      }

      console.log(`✅ Attachment sync complete: ${syncedCount}/${totalAttachments} synced, ${failedCount} failed`);

      return {
        success: failedCount === 0,
        totalAttachments,
        syncedCount,
        failedCount,
        errors
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync attachments for a single case
   */
  private async syncAttachmentsForCase(caseItem: Case): Promise<{
    totalAttachments: number;
    syncedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      // Fetch attachments with base64 data from backend
      const result = await apiService.request(
        `/mobile/cases/${caseItem.id}/attachments?includeAttachmentData=true`,
        {
          method: 'GET',
          requireAuth: true,
        }
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to fetch attachments from backend');
      }

      const attachments = result.data as Array<{
        id: string;
        originalName: string;
        mimeType: string;
        size: number;
        base64Data?: string;
        checksum?: string;
      }>;

      console.log(`📎 Found ${attachments.length} attachments for case ${caseItem.caseId}`);

      for (const attachment of attachments) {
        try {
          // Skip if already synced in this session
          if (this.syncedAttachments.has(attachment.id)) {
            console.log(`⏭️ Skipping already synced attachment: ${attachment.originalName}`);
            syncedCount++;
            continue;
          }

          // Check if attachment already exists in local storage
          const existingMetadata = await secureStorageService.getAttachmentMetadata(attachment.id);
          if (existingMetadata) {
            console.log(`✅ Attachment already in local storage: ${attachment.originalName}`);
            this.syncedAttachments.add(attachment.id);
            syncedCount++;
            continue;
          }

          // Verify base64 data is available
          if (!attachment.base64Data) {
            console.warn(`⚠️ No base64 data for attachment ${attachment.originalName}, skipping...`);
            failedCount++;
            errors.push(`${attachment.originalName}: No base64 data from backend`);
            continue;
          }

          // Convert base64 to data URL format for storage
          const dataUrl = `data:${attachment.mimeType};base64,${attachment.base64Data}`;

          // Store attachment securely with encryption
          await secureStorageService.storeAttachment(
            attachment.id,
            dataUrl,
            {
              originalName: attachment.originalName,
              mimeType: attachment.mimeType,
              size: attachment.size,
              caseId: caseItem.id,
              checksum: attachment.checksum // Backend checksum for verification
            }
          );

          this.syncedAttachments.add(attachment.id);
          syncedCount++;
          console.log(`✅ Synced attachment: ${attachment.originalName} (${attachment.size} bytes)`);
        } catch (error) {
          console.error(`❌ Failed to sync attachment ${attachment.originalName}:`, error);
          failedCount++;
          errors.push(`${attachment.originalName}: ${error.message}`);
        }
      }

      return {
        totalAttachments: attachments.length,
        syncedCount,
        failedCount,
        errors
      };
    } catch (error) {
      console.error(`❌ Failed to fetch attachments for case ${caseItem.caseId}:`, error);
      return {
        totalAttachments: 0,
        syncedCount: 0,
        failedCount: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Clear synced attachments for a specific case
   * Called when a case is submitted or deleted
   */
  async clearAttachmentsForCase(caseId: string): Promise<void> {
    try {
      console.log(`🗑️ Clearing attachments for case ${caseId}...`);
      
      // Get all attachments for this case
      const attachments = await secureStorageService.listAttachments(caseId);
      
      let deletedCount = 0;
      for (const attachment of attachments) {
        try {
          await secureStorageService.deleteAttachment(attachment.id);
          this.syncedAttachments.delete(attachment.id);
          deletedCount++;
        } catch (error) {
          console.error(`❌ Failed to delete attachment ${attachment.id}:`, error);
        }
      }

      console.log(`✅ Cleared ${deletedCount} attachments for case ${caseId}`);
    } catch (error) {
      console.error(`❌ Failed to clear attachments for case ${caseId}:`, error);
      throw error;
    }
  }

  /**
   * Clear all synced attachments
   * Called when user logs out or manually clears cache
   */
  async clearAllAttachments(): Promise<void> {
    try {
      console.log('🗑️ Clearing all synced attachments...');
      
      await secureStorageService.clearAllAttachments();
      this.syncedAttachments.clear();
      
      console.log('✅ All attachments cleared');
    } catch (error) {
      console.error('❌ Failed to clear all attachments:', error);
      throw error;
    }
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    syncInProgress: boolean;
    syncedAttachmentsCount: number;
  } {
    return {
      syncInProgress: this.syncInProgress,
      syncedAttachmentsCount: this.syncedAttachments.size
    };
  }

  /**
   * Reset sync state
   */
  resetSyncState(): void {
    this.syncedAttachments.clear();
    console.log('🔄 Attachment sync state reset');
  }
}

// Export singleton instance
export const attachmentSyncService = new AttachmentSyncService();

