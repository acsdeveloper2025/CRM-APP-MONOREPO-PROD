import { Preferences } from '@capacitor/preferences';
import { encryptionService } from './encryptionService';

/**
 * Encrypted attachment metadata interface
 */
export interface EncryptedAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  encryptedData: string;
  salt: string;
  encryptionKey: string;
  createdAt: string;
  lastAccessed: string;
  caseId: string;
  checksum: string;
}

/**
 * Storage statistics interface
 */
export interface StorageStats {
  totalAttachments: number;
  totalSize: number;
  encryptedSize: number;
  lastCleanup: string;
}

/**
 * Secure Local Storage Service for CaseFlow Mobile
 * Handles encrypted storage and retrieval of attachments
 */
export class SecureStorageService {
  private static instance: SecureStorageService;
  private readonly ATTACHMENT_PREFIX = 'caseflow_attachment_';
  private readonly METADATA_PREFIX = 'caseflow_metadata_';
  private readonly STORAGE_STATS_KEY = 'caseflow_storage_stats';
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB cache limit
  private cache = new Map<string, { data: string; timestamp: number }>();

  private constructor() {}

  static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  /**
   * Initialize secure storage service
   */
  async initialize(): Promise<void> {
    try {
      console.log('💾 Initializing secure storage service...');
      
      // Initialize encryption service
      await encryptionService.initialize();
      
      // Validate encryption functionality
      const isValid = await encryptionService.validateEncryption();
      if (!isValid) {
        throw new Error('Encryption validation failed');
      }

      // Load storage statistics
      await this.loadStorageStats();
      
      console.log('✅ Secure storage service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize secure storage service:', error);
      throw error;
    }
  }

  /**
   * Store attachment securely with encryption
   */
  async storeAttachment(
    attachmentId: string,
    data: string,
    metadata: {
      originalName: string;
      mimeType: string;
      size: number;
      caseId: string;
    }
  ): Promise<void> {
    try {
      console.log(`💾 Storing attachment: ${metadata.originalName} (${metadata.size} bytes)`);

      // Generate checksum for data integrity
      const checksum = await this.generateChecksum(data);

      // Encrypt the attachment data
      const { encryptedData, salt } = encryptionService.encryptData(data, attachmentId);

      // Generate unique encryption key for this attachment
      const encryptionKey = encryptionService.generateAttachmentKey(attachmentId);

      // Create encrypted attachment metadata
      const encryptedAttachment: EncryptedAttachment = {
        id: attachmentId,
        originalName: metadata.originalName,
        mimeType: metadata.mimeType,
        size: metadata.size,
        encryptedData: encryptedData,
        salt: salt,
        encryptionKey: encryptionKey,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        caseId: metadata.caseId,
        checksum: checksum
      };

      // Store encrypted data
      await Preferences.set({
        key: this.ATTACHMENT_PREFIX + attachmentId,
        value: encryptedData
      });

      // Store metadata separately
      await Preferences.set({
        key: this.METADATA_PREFIX + attachmentId,
        value: JSON.stringify(encryptedAttachment)
      });

      // Update cache
      this.cache.set(attachmentId, {
        data: data,
        timestamp: Date.now()
      });

      // Update storage statistics
      await this.updateStorageStats(metadata.size, encryptedData.length);

      console.log(`✅ Attachment stored securely: ${attachmentId}`);
    } catch (error) {
      console.error(`❌ Failed to store attachment ${attachmentId}:`, error);
      throw new Error(`Failed to store attachment: ${error.message}`);
    }
  }

  /**
   * Retrieve and decrypt attachment
   */
  async retrieveAttachment(attachmentId: string): Promise<string | null> {
    try {
      console.log(`🔍 Retrieving attachment: ${attachmentId}`);

      // Check cache first
      const cached = this.cache.get(attachmentId);
      if (cached && this.isCacheValid(cached.timestamp)) {
        console.log(`⚡ Retrieved from cache: ${attachmentId}`);
        await this.updateLastAccessed(attachmentId);
        return cached.data;
      }

      // Load metadata
      const metadata = await this.getAttachmentMetadata(attachmentId);
      if (!metadata) {
        console.log(`❌ Attachment metadata not found: ${attachmentId}`);
        return null;
      }

      // Load encrypted data
      const { value: encryptedData } = await Preferences.get({
        key: this.ATTACHMENT_PREFIX + attachmentId
      });

      if (!encryptedData) {
        console.log(`❌ Encrypted data not found: ${attachmentId}`);
        return null;
      }

      // Decrypt the data
      const decryptedData = encryptionService.decryptData(
        encryptedData,
        metadata.salt,
        attachmentId
      );

      // Verify data integrity
      const checksum = await this.generateChecksum(decryptedData);
      if (checksum !== metadata.checksum) {
        throw new Error('Data integrity check failed');
      }

      // Update cache
      this.cache.set(attachmentId, {
        data: decryptedData,
        timestamp: Date.now()
      });

      // Update last accessed time
      await this.updateLastAccessed(attachmentId);

      console.log(`✅ Attachment retrieved and decrypted: ${attachmentId}`);
      return decryptedData;
    } catch (error) {
      console.error(`❌ Failed to retrieve attachment ${attachmentId}:`, error);
      throw new Error(`Failed to retrieve attachment: ${error.message}`);
    }
  }

  /**
   * Get attachment metadata
   */
  async getAttachmentMetadata(attachmentId: string): Promise<EncryptedAttachment | null> {
    try {
      const { value: metadataJson } = await Preferences.get({
        key: this.METADATA_PREFIX + attachmentId
      });

      if (!metadataJson) {
        return null;
      }

      return JSON.parse(metadataJson) as EncryptedAttachment;
    } catch (error) {
      console.error(`❌ Failed to get metadata for ${attachmentId}:`, error);
      return null;
    }
  }

  /**
   * Delete attachment securely
   */
  async deleteAttachment(attachmentId: string): Promise<boolean> {
    try {
      console.log(`🗑️ Deleting attachment: ${attachmentId}`);

      // Get metadata for size calculation
      const metadata = await this.getAttachmentMetadata(attachmentId);

      // Remove encrypted data
      await Preferences.remove({ key: this.ATTACHMENT_PREFIX + attachmentId });

      // Remove metadata
      await Preferences.remove({ key: this.METADATA_PREFIX + attachmentId });

      // Remove from cache
      this.cache.delete(attachmentId);

      // Update storage statistics
      if (metadata) {
        await this.updateStorageStats(-metadata.size, -metadata.encryptedData.length);
      }

      console.log(`✅ Attachment deleted: ${attachmentId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete attachment ${attachmentId}:`, error);
      return false;
    }
  }

  /**
   * List all stored attachments for a case
   */
  async listAttachments(caseId?: string): Promise<EncryptedAttachment[]> {
    try {
      const attachments: EncryptedAttachment[] = [];
      const { keys } = await Preferences.keys();

      for (const key of keys) {
        if (key.startsWith(this.METADATA_PREFIX)) {
          const { value } = await Preferences.get({ key });
          if (value) {
            const metadata = JSON.parse(value) as EncryptedAttachment;
            if (!caseId || metadata.caseId === caseId) {
              attachments.push(metadata);
            }
          }
        }
      }

      return attachments.sort((a, b) => 
        new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
      );
    } catch (error) {
      console.error('❌ Failed to list attachments:', error);
      return [];
    }
  }

  /**
   * Generate checksum for data integrity
   */
  private async generateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(timestamp: number): boolean {
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    return Date.now() - timestamp < CACHE_DURATION;
  }

  /**
   * Update last accessed time for attachment
   */
  private async updateLastAccessed(attachmentId: string): Promise<void> {
    const metadata = await this.getAttachmentMetadata(attachmentId);
    if (metadata) {
      metadata.lastAccessed = new Date().toISOString();
      await Preferences.set({
        key: this.METADATA_PREFIX + attachmentId,
        value: JSON.stringify(metadata)
      });
    }
  }

  /**
   * Load storage statistics
   */
  private async loadStorageStats(): Promise<StorageStats> {
    const { value } = await Preferences.get({ key: this.STORAGE_STATS_KEY });
    
    if (value) {
      return JSON.parse(value) as StorageStats;
    }

    // Initialize default stats
    const defaultStats: StorageStats = {
      totalAttachments: 0,
      totalSize: 0,
      encryptedSize: 0,
      lastCleanup: new Date().toISOString()
    };

    await Preferences.set({
      key: this.STORAGE_STATS_KEY,
      value: JSON.stringify(defaultStats)
    });

    return defaultStats;
  }

  /**
   * Update storage statistics
   */
  private async updateStorageStats(sizeDelta: number, encryptedSizeDelta: number): Promise<void> {
    const stats = await this.loadStorageStats();
    
    stats.totalAttachments += sizeDelta > 0 ? 1 : -1;
    stats.totalSize += sizeDelta;
    stats.encryptedSize += encryptedSizeDelta;

    await Preferences.set({
      key: this.STORAGE_STATS_KEY,
      value: JSON.stringify(stats)
    });
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    return await this.loadStorageStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Cache cleared');
  }

  /**
   * Cleanup old attachments
   */
  async cleanup(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      console.log('🧹 Starting attachment cleanup...');
      
      const attachments = await this.listAttachments();
      const cutoffDate = new Date(Date.now() - maxAge);
      let deletedCount = 0;

      for (const attachment of attachments) {
        const lastAccessed = new Date(attachment.lastAccessed);
        if (lastAccessed < cutoffDate) {
          await this.deleteAttachment(attachment.id);
          deletedCount++;
        }
      }

      // Update cleanup timestamp
      const stats = await this.loadStorageStats();
      stats.lastCleanup = new Date().toISOString();
      await Preferences.set({
        key: this.STORAGE_STATS_KEY,
        value: JSON.stringify(stats)
      });

      console.log(`✅ Cleanup completed: ${deletedCount} attachments removed`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const secureStorageService = SecureStorageService.getInstance();
