import CryptoJS from 'crypto-js';
import { Preferences } from '@capacitor/preferences';

/**
 * Secure Encryption Service for CaseFlow Mobile
 * Provides AES-256 encryption for sensitive attachment data
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: string | null = null;
  private readonly MASTER_KEY_STORAGE = 'caseflow_master_key';
  private readonly KEY_DERIVATION_ITERATIONS = 10000;

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize encryption service with master key
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔐 Initializing encryption service...');
      
      // Try to load existing master key
      const { value: existingKey } = await Preferences.get({ key: this.MASTER_KEY_STORAGE });
      
      if (existingKey) {
        this.masterKey = existingKey;
        console.log('✅ Loaded existing master key');
      } else {
        // Generate new master key
        this.masterKey = this.generateMasterKey();
        await this.storeMasterKey(this.masterKey);
        console.log('✅ Generated new master key');
      }
    } catch (error) {
      console.error('❌ Failed to initialize encryption service:', error);
      throw new Error('Encryption service initialization failed');
    }
  }

  /**
   * Generate a secure master key
   */
  private generateMasterKey(): string {
    // Generate a 256-bit key using device-specific entropy
    const deviceInfo = this.getDeviceEntropy();
    const randomBytes = CryptoJS.lib.WordArray.random(32); // 256 bits
    const timestamp = Date.now().toString();
    
    // Combine entropy sources
    const combinedEntropy = deviceInfo + timestamp + randomBytes.toString();
    
    // Generate master key using PBKDF2
    const masterKey = CryptoJS.PBKDF2(combinedEntropy, 'CaseFlowMobile2024', {
      keySize: 256 / 32,
      iterations: this.KEY_DERIVATION_ITERATIONS
    });
    
    return masterKey.toString();
  }

  /**
   * Get device-specific entropy for key generation
   */
  private getDeviceEntropy(): string {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const screenInfo = typeof screen !== 'undefined' ? 
      `${screen.width}x${screen.height}x${screen.colorDepth}` : 'unknown';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return `${userAgent}-${screenInfo}-${timezone}`;
  }

  /**
   * Store master key securely
   */
  private async storeMasterKey(key: string): Promise<void> {
    await Preferences.set({
      key: this.MASTER_KEY_STORAGE,
      value: key
    });
  }

  /**
   * Encrypt data using AES-256
   */
  encryptData(data: string, attachmentId?: string): { encryptedData: string; salt: string } {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Generate unique salt for this encryption
      const salt = CryptoJS.lib.WordArray.random(16).toString();
      
      // Derive encryption key from master key and salt
      const derivedKey = CryptoJS.PBKDF2(this.masterKey, salt, {
        keySize: 256 / 32,
        iterations: 1000 // Fewer iterations for performance
      });

      // Add attachment ID to IV for uniqueness
      const ivSource = attachmentId ? `${salt}-${attachmentId}` : salt;
      const iv = CryptoJS.SHA256(ivSource).toString().substring(0, 32);
      const ivWordArray = CryptoJS.enc.Hex.parse(iv);

      // Encrypt the data
      const encrypted = CryptoJS.AES.encrypt(data, derivedKey, {
        iv: ivWordArray,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      console.log(`🔒 Data encrypted successfully (${data.length} bytes -> ${encrypted.toString().length} bytes)`);

      return {
        encryptedData: encrypted.toString(),
        salt: salt
      };
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256
   */
  decryptData(encryptedData: string, salt: string, attachmentId?: string): string {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Derive the same encryption key
      const derivedKey = CryptoJS.PBKDF2(this.masterKey, salt, {
        keySize: 256 / 32,
        iterations: 1000
      });

      // Recreate the same IV
      const ivSource = attachmentId ? `${salt}-${attachmentId}` : salt;
      const iv = CryptoJS.SHA256(ivSource).toString().substring(0, 32);
      const ivWordArray = CryptoJS.enc.Hex.parse(iv);

      // Decrypt the data
      const decrypted = CryptoJS.AES.decrypt(encryptedData, derivedKey, {
        iv: ivWordArray,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedString) {
        throw new Error('Decryption resulted in empty string');
      }

      console.log(`🔓 Data decrypted successfully (${encryptedData.length} bytes -> ${decryptedString.length} bytes)`);
      
      return decryptedString;
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate unique encryption key for specific attachment
   */
  generateAttachmentKey(attachmentId: string): string {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    const attachmentKey = CryptoJS.PBKDF2(
      this.masterKey + attachmentId,
      'AttachmentKey2024',
      {
        keySize: 256 / 32,
        iterations: 5000
      }
    );

    return attachmentKey.toString();
  }

  /**
   * Secure memory cleanup
   */
  clearSensitiveData(): void {
    // Clear master key from memory
    this.masterKey = null;
    console.log('🧹 Sensitive data cleared from memory');
  }

  /**
   * Reset encryption service (for testing or security reset)
   */
  async reset(): Promise<void> {
    try {
      await Preferences.remove({ key: this.MASTER_KEY_STORAGE });
      this.masterKey = null;
      console.log('🔄 Encryption service reset');
    } catch (error) {
      console.error('❌ Failed to reset encryption service:', error);
      throw error;
    }
  }

  /**
   * Validate encryption/decryption functionality
   */
  async validateEncryption(): Promise<boolean> {
    try {
      const testData = 'CaseFlow Mobile Encryption Test';
      const { encryptedData, salt } = this.encryptData(testData, 'test-attachment');
      const decryptedData = this.decryptData(encryptedData, salt, 'test-attachment');
      
      const isValid = decryptedData === testData;
      console.log(isValid ? '✅ Encryption validation passed' : '❌ Encryption validation failed');
      
      return isValid;
    } catch (error) {
      console.error('❌ Encryption validation error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance();
