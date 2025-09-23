import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';

interface PerformanceMetric {
  id: string;
  type: 'render' | 'api' | 'database' | 'memory' | 'battery' | 'network';
  value: number;
  metadata: Record<string, any>;
  timestamp: number;
  sessionId: string;
}

interface SessionInfo {
  id: string;
  startTime: number;
  endTime?: number;
  deviceInfo: DeviceInfo.DeviceInfoResult;
  appVersion: string;
  buildNumber: string;
  platform: string;
  metrics: PerformanceMetric[];
}

interface PerformanceReport {
  sessionId: string;
  duration: number;
  totalMetrics: number;
  averageRenderTime: number;
  averageApiLatency: number;
  memoryUsage: {
    average: number;
    peak: number;
  };
  networkStats: {
    totalRequests: number;
    failedRequests: number;
    averageLatency: number;
  };
  criticalIssues: string[];
  recommendations: string[];
}

export class MobilePerformanceMonitor {
  private static instance: MobilePerformanceMonitor;
  private currentSession: SessionInfo | null = null;
  private metrics: PerformanceMetric[] = [];
  private isMonitoring = false;
  private performanceThresholds = {
    renderTime: 16, // 60fps
    apiLatency: 2000, // 2 seconds
    memoryUsage: 100 * 1024 * 1024, // 100MB
    batteryLevel: 20, // 20%
  };

  private constructor() {}

  static getInstance(): MobilePerformanceMonitor {
    if (!MobilePerformanceMonitor.instance) {
      MobilePerformanceMonitor.instance = new MobilePerformanceMonitor();
    }
    return MobilePerformanceMonitor.instance;
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    try {
      // Create new session
      this.currentSession = {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startTime: Date.now(),
        deviceInfo: await DeviceInfo.getDeviceInfo(),
        appVersion: DeviceInfo.getVersion(),
        buildNumber: DeviceInfo.getBuildNumber(),
        platform: Platform.OS,
        metrics: [],
      };

      this.isMonitoring = true;
      this.startPerformanceTracking();
      
      console.log('Performance monitoring started for session:', this.currentSession.id);
    } catch (error) {
      console.error('Failed to start performance monitoring:', error);
    }
  }

  async stopMonitoring(): Promise<PerformanceReport | null> {
    if (!this.isMonitoring || !this.currentSession) return null;

    this.isMonitoring = false;
    this.currentSession.endTime = Date.now();
    this.currentSession.metrics = [...this.metrics];

    // Generate performance report
    const report = this.generatePerformanceReport();

    // Save session data
    await this.saveSessionData();

    // Reset for next session
    this.metrics = [];
    this.currentSession = null;

    return report;
  }

  private startPerformanceTracking(): void {
    // Monitor memory usage
    this.startMemoryMonitoring();
    
    // Monitor network performance
    this.startNetworkMonitoring();
    
    // Monitor battery level
    this.startBatteryMonitoring();
    
    // Monitor app state changes
    this.startAppStateMonitoring();
  }

  private startMemoryMonitoring(): void {
    const interval = setInterval(async () => {
      if (!this.isMonitoring) {
        clearInterval(interval);
        return;
      }

      try {
        const memoryInfo = await DeviceInfo.getUsedMemory();
        this.recordMetric({
          type: 'memory',
          value: memoryInfo,
          metadata: {
            timestamp: Date.now(),
            platform: Platform.OS,
          },
        });

        // Check for memory warnings
        if (memoryInfo > this.performanceThresholds.memoryUsage) {
          this.recordCriticalIssue('High memory usage detected', {
            currentUsage: memoryInfo,
            threshold: this.performanceThresholds.memoryUsage,
          });
        }
      } catch (error) {
        console.error('Memory monitoring error:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  private startNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      if (!this.isMonitoring) return;

      this.recordMetric({
        type: 'network',
        value: state.isConnected ? 1 : 0,
        metadata: {
          type: state.type,
          isInternetReachable: state.isInternetReachable,
          details: state.details,
        },
      });
    });
  }

  private startBatteryMonitoring(): void {
    const interval = setInterval(async () => {
      if (!this.isMonitoring) {
        clearInterval(interval);
        return;
      }

      try {
        const batteryLevel = await DeviceInfo.getBatteryLevel();
        this.recordMetric({
          type: 'battery',
          value: batteryLevel * 100,
          metadata: {
            timestamp: Date.now(),
          },
        });

        // Check for low battery
        if (batteryLevel * 100 < this.performanceThresholds.batteryLevel) {
          this.recordCriticalIssue('Low battery level detected', {
            currentLevel: batteryLevel * 100,
            threshold: this.performanceThresholds.batteryLevel,
          });
        }
      } catch (error) {
        console.error('Battery monitoring error:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private startAppStateMonitoring(): void {
    // Monitor app lifecycle events
    // This would integrate with React Native's AppState
  }

  recordRenderTime(componentName: string, renderTime: number): void {
    if (!this.isMonitoring) return;

    this.recordMetric({
      type: 'render',
      value: renderTime,
      metadata: {
        componentName,
        timestamp: Date.now(),
      },
    });

    // Check for slow renders
    if (renderTime > this.performanceThresholds.renderTime) {
      this.recordCriticalIssue('Slow render detected', {
        componentName,
        renderTime,
        threshold: this.performanceThresholds.renderTime,
      });
    }
  }

  recordApiCall(endpoint: string, method: string, duration: number, success: boolean): void {
    if (!this.isMonitoring) return;

    this.recordMetric({
      type: 'api',
      value: duration,
      metadata: {
        endpoint,
        method,
        success,
        timestamp: Date.now(),
      },
    });

    // Check for slow API calls
    if (duration > this.performanceThresholds.apiLatency) {
      this.recordCriticalIssue('Slow API call detected', {
        endpoint,
        method,
        duration,
        threshold: this.performanceThresholds.apiLatency,
      });
    }
  }

  recordDatabaseOperation(operation: string, duration: number, recordCount?: number): void {
    if (!this.isMonitoring) return;

    this.recordMetric({
      type: 'database',
      value: duration,
      metadata: {
        operation,
        recordCount,
        timestamp: Date.now(),
      },
    });
  }

  private recordMetric(metric: Omit<PerformanceMetric, 'id' | 'sessionId' | 'timestamp'>): void {
    if (!this.currentSession) return;

    const fullMetric: PerformanceMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: this.currentSession.id,
      timestamp: Date.now(),
      ...metric,
    };

    this.metrics.push(fullMetric);

    // Limit metrics array size to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-800); // Keep last 800 metrics
    }
  }

  private recordCriticalIssue(issue: string, metadata: Record<string, any>): void {
    console.warn('Performance Critical Issue:', issue, metadata);
    
    // Store critical issues for reporting
    this.recordMetric({
      type: 'render', // Use render as default type for critical issues
      value: -1, // Special value to indicate critical issue
      metadata: {
        criticalIssue: issue,
        ...metadata,
      },
    });
  }

  private generatePerformanceReport(): PerformanceReport {
    if (!this.currentSession) {
      throw new Error('No active session to generate report');
    }

    const duration = (this.currentSession.endTime || Date.now()) - this.currentSession.startTime;
    const renderMetrics = this.metrics.filter(m => m.type === 'render' && m.value > 0);
    const apiMetrics = this.metrics.filter(m => m.type === 'api');
    const memoryMetrics = this.metrics.filter(m => m.type === 'memory');
    const criticalIssues = this.metrics
      .filter(m => m.metadata.criticalIssue)
      .map(m => m.metadata.criticalIssue);

    const averageRenderTime = renderMetrics.length > 0
      ? renderMetrics.reduce((sum, m) => sum + m.value, 0) / renderMetrics.length
      : 0;

    const averageApiLatency = apiMetrics.length > 0
      ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length
      : 0;

    const memoryUsage = memoryMetrics.length > 0 ? {
      average: memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length,
      peak: Math.max(...memoryMetrics.map(m => m.value)),
    } : { average: 0, peak: 0 };

    const failedApiCalls = apiMetrics.filter(m => !m.metadata.success).length;

    const recommendations = this.generateRecommendations({
      averageRenderTime,
      averageApiLatency,
      memoryUsage,
      criticalIssues,
    });

    return {
      sessionId: this.currentSession.id,
      duration,
      totalMetrics: this.metrics.length,
      averageRenderTime,
      averageApiLatency,
      memoryUsage,
      networkStats: {
        totalRequests: apiMetrics.length,
        failedRequests: failedApiCalls,
        averageLatency: averageApiLatency,
      },
      criticalIssues,
      recommendations,
    };
  }

  private generateRecommendations(data: {
    averageRenderTime: number;
    averageApiLatency: number;
    memoryUsage: { average: number; peak: number };
    criticalIssues: string[];
  }): string[] {
    const recommendations: string[] = [];

    if (data.averageRenderTime > this.performanceThresholds.renderTime) {
      recommendations.push('Consider optimizing component renders to improve UI responsiveness');
    }

    if (data.averageApiLatency > this.performanceThresholds.apiLatency) {
      recommendations.push('API calls are slow - consider implementing caching or optimizing network requests');
    }

    if (data.memoryUsage.peak > this.performanceThresholds.memoryUsage) {
      recommendations.push('High memory usage detected - consider optimizing data structures and clearing unused objects');
    }

    if (data.criticalIssues.length > 10) {
      recommendations.push('Multiple performance issues detected - consider comprehensive performance audit');
    }

    return recommendations;
  }

  private async saveSessionData(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const sessionKey = `performance_session_${this.currentSession.id}`;
      await AsyncStorage.setItem(sessionKey, JSON.stringify(this.currentSession));

      // Keep only last 10 sessions
      const allKeys = await AsyncStorage.getAllKeys();
      const sessionKeys = allKeys.filter(key => key.startsWith('performance_session_'));
      
      if (sessionKeys.length > 10) {
        const keysToRemove = sessionKeys
          .sort()
          .slice(0, sessionKeys.length - 10);
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
  }

  async getSessionHistory(limit = 10): Promise<SessionInfo[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const sessionKeys = allKeys
        .filter(key => key.startsWith('performance_session_'))
        .sort()
        .slice(-limit);

      const sessions: SessionInfo[] = [];
      for (const key of sessionKeys) {
        const sessionData = await AsyncStorage.getItem(key);
        if (sessionData) {
          sessions.push(JSON.parse(sessionData));
        }
      }

      return sessions.reverse(); // Most recent first
    } catch (error) {
      console.error('Failed to get session history:', error);
      return [];
    }
  }

  async clearSessionHistory(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const sessionKeys = allKeys.filter(key => key.startsWith('performance_session_'));
      await AsyncStorage.multiRemove(sessionKeys);
    } catch (error) {
      console.error('Failed to clear session history:', error);
    }
  }

  getCurrentSessionMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  updateThresholds(thresholds: Partial<typeof this.performanceThresholds>): void {
    this.performanceThresholds = { ...this.performanceThresholds, ...thresholds };
  }
}

export default MobilePerformanceMonitor.getInstance();
