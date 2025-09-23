/**
 * DeviceInfo with platform detection
 * Uses React Native DeviceInfo for native apps, Capacitor Device for web
 */

import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

// Platform detection
const isNative = Capacitor.isNativePlatform();

// Lazy load React Native DeviceInfo only for native platforms
let RNDeviceInfo: any = null;
if (isNative) {
  try {
    RNDeviceInfo = require('react-native-device-info').default;
    console.log('📱 Native DeviceInfo loaded for native platform');
  } catch (error) {
    console.warn('React Native DeviceInfo not available, falling back to Capacitor Device');
  }
}

interface DeviceInfoResult {
  model: string;
  platform: string;
  operatingSystem: string;
  osVersion: string;
  manufacturer: string;
  isVirtual: boolean;
  webViewVersion?: string;
  name?: string;
  identifier?: string;
}

const DeviceInfo = {
  async getModel(): Promise<string> {
    try {
      if (isNative && RNDeviceInfo) {
        return await RNDeviceInfo.getModel();
      } else {
        const info = await Device.getInfo();
        return info.model || 'Unknown';
      }
    } catch (error) {
      console.warn('DeviceInfo getModel error:', error);
      return 'Unknown';
    }
  },

  async getSystemName(): Promise<string> {
    try {
      if (isNative && RNDeviceInfo) {
        return await RNDeviceInfo.getSystemName();
      } else {
        const info = await Device.getInfo();
        return info.operatingSystem || 'Unknown';
      }
    } catch (error) {
      console.warn('DeviceInfo getSystemName error:', error);
      return 'Unknown';
    }
  },

  async getSystemVersion(): Promise<string> {
    try {
      if (isNative && RNDeviceInfo) {
        return await RNDeviceInfo.getSystemVersion();
      } else {
        const info = await Device.getInfo();
        return info.osVersion || 'Unknown';
      }
    } catch (error) {
      console.warn('DeviceInfo getSystemVersion error:', error);
      return 'Unknown';
    }
  },

  async getManufacturer(): Promise<string> {
    try {
      if (isNative && RNDeviceInfo) {
        return await RNDeviceInfo.getManufacturer();
      } else {
        const info = await Device.getInfo();
        return info.manufacturer || 'Unknown';
      }
    } catch (error) {
      console.warn('DeviceInfo getManufacturer error:', error);
      return 'Unknown';
    }
  },

  async isEmulator(): Promise<boolean> {
    try {
      if (isNative && RNDeviceInfo) {
        return await RNDeviceInfo.isEmulator();
      } else {
        const info = await Device.getInfo();
        return info.isVirtual || false;
      }
    } catch (error) {
      console.warn('DeviceInfo isEmulator error:', error);
      return false;
    }
  },

  async getUniqueId(): Promise<string> {
    try {
      if (isNative && RNDeviceInfo) {
        return await RNDeviceInfo.getUniqueId();
      } else {
        const info = await Device.getId();
        return info.identifier || 'web-device-' + Date.now();
      }
    } catch (error) {
      console.warn('DeviceInfo getUniqueId error:', error);
      return 'unknown-device-' + Date.now();
    }
  },

  async getDeviceName(): Promise<string> {
    try {
      if (isNative && RNDeviceInfo) {
        return await RNDeviceInfo.getDeviceName();
      } else {
        const info = await Device.getInfo();
        return info.name || info.model || 'Web Device';
      }
    } catch (error) {
      console.warn('DeviceInfo getDeviceName error:', error);
      return 'Unknown Device';
    }
  },

  // Comprehensive device info method
  async getDeviceInfo(): Promise<DeviceInfoResult> {
    try {
      const [model, platform, osVersion, manufacturer, isVirtual, deviceName] = await Promise.all([
        this.getModel(),
        this.getSystemName(),
        this.getSystemVersion(),
        this.getManufacturer(),
        this.isEmulator(),
        this.getDeviceName()
      ]);

      return {
        model,
        platform,
        operatingSystem: platform,
        osVersion,
        manufacturer,
        isVirtual,
        name: deviceName
      };
    } catch (error) {
      console.warn('DeviceInfo getDeviceInfo error:', error);
      return {
        model: 'Unknown',
        platform: 'Unknown',
        operatingSystem: 'Unknown',
        osVersion: 'Unknown',
        manufacturer: 'Unknown',
        isVirtual: false,
        name: 'Unknown Device'
      };
    }
  }
};

export default DeviceInfo;
