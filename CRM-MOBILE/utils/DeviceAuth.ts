import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import AsyncStorage from '../polyfills/AsyncStorage';

export interface DeviceInfo {
  deviceId: string;
  platform: string;
  fingerprint: string;
  timestamp: number;
  uuid: string;
}

class DeviceAuthManager {
  private static instance: DeviceAuthManager;
  private deviceInfo: DeviceInfo | null = null;
  private readonly DEVICE_ID_KEY = 'caseflow_device_id';
  private readonly DEVICE_INFO_KEY = 'caseflow_device_info';

  private constructor() {}

  public static getInstance(): DeviceAuthManager {
    if (!DeviceAuthManager.instance) {
      DeviceAuthManager.instance = new DeviceAuthManager();
    }
    return DeviceAuthManager.instance;
  }

  /**
   * Generate a unique device fingerprint based on available browser/device information
   */
  private async generateFingerprint(): Promise<string> {
    const components: string[] = [];

    try {
      if (Capacitor.isNativePlatform()) {
        // Native platform - use Capacitor Device API
        const deviceInfo = await Device.getInfo();
        const deviceId = await Device.getId();
        
        components.push(deviceInfo.platform || 'unknown');
        components.push(deviceInfo.model || 'unknown');
        components.push(deviceInfo.operatingSystem || 'unknown');
        components.push(deviceInfo.osVersion || 'unknown');
        components.push(deviceId.identifier || 'unknown');
      } else {
        // Web platform - use browser fingerprinting
        if (typeof window !== 'undefined') {
          components.push(navigator.userAgent || 'unknown');
          components.push(navigator.language || 'unknown');
          components.push(screen.width + 'x' + screen.height);
          components.push(screen.colorDepth.toString());
          components.push(new Date().getTimezoneOffset().toString());
          components.push(navigator.platform || 'unknown');
          components.push(navigator.cookieEnabled.toString());
          
          // Add more browser-specific fingerprinting
          if (navigator.hardwareConcurrency) {
            components.push(navigator.hardwareConcurrency.toString());
          }
          
          if (navigator.deviceMemory) {
            components.push(navigator.deviceMemory.toString());
          }
        }
      }
    } catch (error) {
      console.warn('Error generating device fingerprint:', error);
      components.push('fallback-' + Math.random().toString(36).substr(2, 9));
    }

    // Create hash from components
    const fingerprint = components.join('|');
    return this.simpleHash(fingerprint);
  }

  /**
   * Simple hash function for creating consistent fingerprint
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate a random UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get platform information
   */
  private async getPlatform(): Promise<string> {
    try {
      if (Capacitor.isNativePlatform()) {
        const deviceInfo = await Device.getInfo();
        return deviceInfo.platform || 'native';
      } else {
        return 'web';
      }
    } catch (error) {
      console.warn('Error getting platform:', error);
      return 'unknown';
    }
  }

  /**
   * Generate or retrieve existing device ID
   */
  public async getDeviceId(): Promise<string> {
    try {
      // Check if device ID already exists
      const existingDeviceId = await AsyncStorage.getItem(this.DEVICE_ID_KEY);
      if (existingDeviceId) {
        return existingDeviceId;
      }

      // Generate new device ID
      const deviceId = await this.generateDeviceId();
      
      // Store device ID
      await AsyncStorage.setItem(this.DEVICE_ID_KEY, deviceId);
      
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      // Fallback to session-based ID
      return 'TEMP-' + this.generateUUID().substr(0, 8);
    }
  }

  /**
   * Generate a new device ID
   */
  private async generateDeviceId(): Promise<string> {
    try {
      const platform = await this.getPlatform();
      const fingerprint = await this.generateFingerprint();
      const timestamp = Date.now();
      const uuid = this.generateUUID().substr(0, 8);

      // Create device info object
      this.deviceInfo = {
        deviceId: '',
        platform,
        fingerprint,
        timestamp,
        uuid
      };

      // Generate device ID in format: CF-PLATFORM-FINGERPRINT-TIMESTAMP-UUID
      const deviceId = `CF-${platform.toUpperCase()}-${fingerprint}-${timestamp.toString(36)}-${uuid}`;
      
      this.deviceInfo.deviceId = deviceId;

      // Store device info for debugging/admin purposes
      await AsyncStorage.setItem(this.DEVICE_INFO_KEY, JSON.stringify(this.deviceInfo));

      return deviceId;
    } catch (error) {
      console.error('Error generating device ID:', error);
      // Fallback device ID
      return `CF-FALLBACK-${Date.now().toString(36)}-${this.generateUUID().substr(0, 8)}`;
    }
  }

  /**
   * Get detailed device information
   */
  public async getDeviceInfo(): Promise<DeviceInfo | null> {
    try {
      if (this.deviceInfo) {
        return this.deviceInfo;
      }

      const storedInfo = await AsyncStorage.getItem(this.DEVICE_INFO_KEY);
      if (storedInfo) {
        this.deviceInfo = JSON.parse(storedInfo);
        return this.deviceInfo;
      }

      // Generate new device info
      await this.getDeviceId();
      return this.deviceInfo;
    } catch (error) {
      console.error('Error getting device info:', error);
      return null;
    }
  }

  /**
   * Reset device authentication (for testing/admin purposes)
   */
  public async resetDeviceAuth(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.DEVICE_ID_KEY);
      await AsyncStorage.removeItem(this.DEVICE_INFO_KEY);
      this.deviceInfo = null;
    } catch (error) {
      console.error('Error resetting device auth:', error);
    }
  }

  /**
   * Copy text to clipboard with fallback methods
   */
  public async copyToClipboard(text: string): Promise<boolean> {
    try {
      // Use web clipboard API for both web and native platforms
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else if (typeof document !== 'undefined') {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const result = document.execCommand('copy');
        document.body.removeChild(textArea);
        return result;
      } else {
        // No clipboard support available
        console.warn('Clipboard not supported in this environment');
        return false;
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  }
}

export default DeviceAuthManager;
