import CryptoJS from 'crypto-js';
import AsyncStorage from '../polyfills/AsyncStorage';

/**
 * Encrypted Storage Service
 * Provides secure local storage with AES encryption for sensitive form data
 */
class EncryptedStorage {
  private readonly ENCRYPTION_KEY: string;
  private readonly STORAGE_PREFIX = 'caseflow_encrypted_';

  constructor() {
    // Generate or retrieve a device-specific encryption key
    this.ENCRYPTION_KEY = this.getOrCreateEncryptionKey();
  }

  /**
   * Generate or retrieve a device-specific encryption key
   */
  private getOrCreateEncryptionKey(): string {
    const keyStorageKey = 'caseflow_encryption_key';
    
    // Try to get existing key from localStorage (synchronous for initialization)
    let key = localStorage.getItem(keyStorageKey);
    
    if (!key) {
      // Generate a new 256-bit key
      key = CryptoJS.lib.WordArray.random(256/8).toString();
      localStorage.setItem(keyStorageKey, key);
    }
    
    return key;
  }

  /**
   * Encrypt data using AES encryption
   */
  private encrypt(data: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(data, this.ENCRYPTION_KEY).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES decryption
   */
  private decrypt(encryptedData: string): string {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, this.ENCRYPTION_KEY);
      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedString) {
        throw new Error('Decryption resulted in empty string');
      }
      
      return decryptedString;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Store encrypted data
   */
  async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonString = JSON.stringify(value);
      const encryptedData = this.encrypt(jsonString);
      const storageKey = this.STORAGE_PREFIX + key;
      
      await AsyncStorage.setItem(storageKey, encryptedData);
    } catch (error) {
      console.error('Error storing encrypted data:', error);
      throw new Error('Failed to store encrypted data');
    }
  }

  /**
   * Retrieve and decrypt data
   */
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const storageKey = this.STORAGE_PREFIX + key;
      const encryptedData = await AsyncStorage.getItem(storageKey);
      
      if (!encryptedData) {
        return null;
      }
      
      const decryptedString = this.decrypt(encryptedData);
      return JSON.parse(decryptedString) as T;
    } catch (error) {
      console.error('Error retrieving encrypted data:', error);
      // Return null instead of throwing to handle corrupted data gracefully
      return null;
    }
  }

  /**
   * Remove encrypted data
   */
  async removeItem(key: string): Promise<void> {
    try {
      const storageKey = this.STORAGE_PREFIX + key;
      await AsyncStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Error removing encrypted data:', error);
      throw new Error('Failed to remove encrypted data');
    }
  }

  /**
   * Get all encrypted storage keys
   */
  async getAllKeys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys
        .filter(key => key.startsWith(this.STORAGE_PREFIX))
        .map(key => key.replace(this.STORAGE_PREFIX, ''));
    } catch (error) {
      console.error('Error getting encrypted storage keys:', error);
      return [];
    }
  }

  /**
   * Clear all encrypted data
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.getAllKeys();
      const removePromises = keys.map(key => this.removeItem(key));
      await Promise.all(removePromises);
    } catch (error) {
      console.error('Error clearing encrypted storage:', error);
      throw new Error('Failed to clear encrypted storage');
    }
  }

  /**
   * Check if a key exists in encrypted storage
   */
  async hasItem(key: string): Promise<boolean> {
    try {
      const item = await this.getItem(key);
      return item !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage size information
   */
  async getStorageInfo(): Promise<{ totalKeys: number; estimatedSize: string }> {
    try {
      const keys = await this.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        const storageKey = this.STORAGE_PREFIX + key;
        const data = await AsyncStorage.getItem(storageKey);
        if (data) {
          totalSize += data.length;
        }
      }
      
      const sizeInKB = (totalSize / 1024).toFixed(2);
      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
      
      return {
        totalKeys: keys.length,
        estimatedSize: totalSize > 1024 * 1024 ? `${sizeInMB} MB` : `${sizeInKB} KB`
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return { totalKeys: 0, estimatedSize: '0 KB' };
    }
  }
}

// Export singleton instance
export const encryptedStorage = new EncryptedStorage();
