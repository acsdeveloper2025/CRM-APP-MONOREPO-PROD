/**
 * Version Management Service
 * Handles version checking, update notifications, and auto-update infrastructure
 */

import { getEnvironmentConfig } from '../config/environment';
import { apiService } from './apiService';

export interface VersionInfo {
  current: string;
  latest: string;
  buildNumber: string;
  buildDate: string;
  environment: 'development' | 'production';
}

export interface UpdateInfo {
  available: boolean;
  required: boolean; // Force update
  urgent: boolean;
  version: string;
  downloadUrl?: string;
  releaseNotes: string[];
  features: string[];
  bugFixes: string[];
  size?: string; // e.g., "25.4 MB"
  releaseDate: string;
}

export interface UpdateConfig {
  enabled: boolean;
  autoCheck: boolean;
  checkInterval: number; // in milliseconds
  allowCellularDownload: boolean;
  notificationStyle: 'modal' | 'banner' | 'silent';
  retryAttempts: number;
  retryDelay: number;
}

class VersionService {
  private config: UpdateConfig;
  private lastCheckTime: number = 0;
  private updateInfo: UpdateInfo | null = null;
  private checkInProgress: boolean = false;

  constructor() {
    this.config = this.getDefaultConfig();
    this.loadConfig();
  }

  /**
   * Get current app version information
   */
  getCurrentVersion(): VersionInfo {
    const envConfig = getEnvironmentConfig();
    
    return {
      current: envConfig.app.version,
      latest: envConfig.app.version, // Will be updated after version check
      buildNumber: this.getBuildNumber(),
      buildDate: this.getBuildDate(),
      environment: envConfig.app.environment,
    };
  }

  /**
   * Get build number from package.json or environment
   */
  private getBuildNumber(): string {
    // In a real app, this would come from build process
    // For now, generate based on version and date
    const envConfig = getEnvironmentConfig();
    const version = envConfig.app.version.replace(/\./g, '');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${version}${date}`;
  }

  /**
   * Get build date
   */
  private getBuildDate(): string {
    // In a real app, this would be injected during build
    return new Date().toISOString();
  }

  /**
   * Check for app updates from server
   */
  async checkForUpdates(force: boolean = false): Promise<UpdateInfo | null> {
    if (this.checkInProgress && !force) {
      return this.updateInfo;
    }

    const now = Date.now();
    if (!force && (now - this.lastCheckTime) < this.config.checkInterval) {
      return this.updateInfo;
    }

    this.checkInProgress = true;
    this.lastCheckTime = now;

    try {
      console.log('🔍 Checking for app updates...');

      const currentVersion = this.getCurrentVersion();

      const response = await apiService.post('/mobile/version/check', {
        currentVersion: currentVersion.current,
        platform: this.getPlatform(),
        buildNumber: currentVersion.buildNumber,
      });

      const data = response;
      
      if (data.success) {
        // Only create update info if there's actually an update available
        const hasUpdate = this.compareVersions(data.currentVersion, data.latestVersion) < 0;

        if (hasUpdate || data.forceUpdate) {
          this.updateInfo = {
            available: hasUpdate,
            required: data.forceUpdate || data.updateRequired,
            urgent: data.urgent || false,
            version: data.latestVersion,
            downloadUrl: data.downloadUrl,
            releaseNotes: data.releaseNotes ? data.releaseNotes.split('\n') : [],
            features: data.features || [],
            bugFixes: data.bugFixes || [],
            size: data.size,
            releaseDate: data.releaseDate || new Date().toISOString(),
          };

          console.log('✅ Update available:', this.updateInfo);
          return this.updateInfo;
        } else {
          console.log('ℹ️ App is up to date');
          this.updateInfo = null;
          return null;
        }
      } else {
        console.log('ℹ️ Version check failed or no updates available');
        this.updateInfo = null;
        return null;
      }
    } catch (error) {
      console.error('❌ Version check failed:', error);
      this.updateInfo = null;
      return null;
    } finally {
      this.checkInProgress = false;
    }
  }

  /**
   * Get platform identifier
   */
  private getPlatform(): string {
    // Detect platform - in a real mobile app, this would be more sophisticated
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'IOS';
    } else if (userAgent.includes('android')) {
      return 'ANDROID';
    } else {
      return 'WEB';
    }
  }

  /**
   * Start automatic update checking
   */
  startAutoCheck(): void {
    if (!this.config.enabled || !this.config.autoCheck) {
      console.log('🔄 Auto-update checking is disabled');
      return;
    }

    console.log('🔄 Starting automatic update checks...');
    
    // Initial check
    this.checkForUpdates();

    // Periodic checks
    setInterval(() => {
      this.checkForUpdates();
    }, this.config.checkInterval);
  }

  /**
   * Stop automatic update checking
   */
  stopAutoCheck(): void {
    console.log('⏹️ Stopping automatic update checks');
    // In a real implementation, you'd clear the interval
  }

  /**
   * Download and install update (placeholder for future implementation)
   */
  async downloadAndInstallUpdate(updateInfo: UpdateInfo): Promise<boolean> {
    console.log('📥 Download and install update (not implemented yet):', updateInfo);
    
    // TODO: Implement actual download and installation logic
    // This would involve:
    // 1. Download the update file
    // 2. Verify integrity
    // 3. Install the update
    // 4. Restart the app
    
    return false; // Not implemented yet
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): UpdateConfig {
    return {
      enabled: true, // Enable for development/testing
      autoCheck: true,
      checkInterval: 24 * 60 * 60 * 1000, // 24 hours
      allowCellularDownload: false,
      notificationStyle: 'modal',
      retryAttempts: 3,
      retryDelay: 5000, // 5 seconds
    };
  }

  /**
   * Load configuration from storage
   */
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem('updateConfig');
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load update config:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  saveConfig(config: Partial<UpdateConfig>): void {
    this.config = { ...this.config, ...config };
    try {
      localStorage.setItem('updateConfig', JSON.stringify(this.config));
      console.log('💾 Update config saved:', this.config);
    } catch (error) {
      console.error('Failed to save update config:', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): UpdateConfig {
    return { ...this.config };
  }

  /**
   * Get last update check info
   */
  getLastUpdateInfo(): UpdateInfo | null {
    return this.updateInfo;
  }

  /**
   * Format version for display
   */
  formatVersion(version: string, buildNumber?: string): string {
    if (buildNumber) {
      return `Version ${version} (${buildNumber})`;
    }
    return `Version ${version}`;
  }

  /**
   * Compare version strings
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }
}

export default new VersionService();
