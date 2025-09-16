/**
 * Background Task Manager for CaseFlow Mobile
 * Handles background services including data cleanup
 */

import { App, AppState } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { dataCleanupService } from './dataCleanupService';

export interface BackgroundTask {
  id: string;
  name: string;
  interval: number; // in milliseconds
  lastRun: number;
  enabled: boolean;
  handler: () => Promise<void>;
}

class BackgroundTaskManager {
  private static instance: BackgroundTaskManager;
  private tasks: Map<string, BackgroundTask> = new Map();
  private intervalIds: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  /**
   * Initialize the background task manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔄 Initializing Background Task Manager...');

      // Request notification permissions
      await this.requestNotificationPermissions();

      // Register default tasks
      await this.registerDefaultTasks();

      // Set up app state listeners
      this.setupAppStateListeners();

      // Set up notification listeners
      this.setupNotificationListeners();

      // Start all enabled tasks
      this.startAllTasks();

      this.isInitialized = true;
      console.log('✅ Background Task Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Background Task Manager:', error);
    }
  }

  /**
   * Request notification permissions (only if enabled in environment)
   */
  private async requestNotificationPermissions(): Promise<void> {
    // Check if push notifications are enabled in environment
    const notificationsEnabled = import.meta.env.VITE_ENABLE_PUSH_NOTIFICATIONS === 'true';

    if (!notificationsEnabled) {
      console.log('📱 Push notifications disabled in environment configuration');
      return;
    }

    try {
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted') {
        console.warn('⚠️ Notification permissions not granted. Some features may be limited.');
      } else {
        console.log('✅ Notification permissions granted');
      }
    } catch (error) {
      console.warn('Failed to request notification permissions:', error);
    }
  }

  /**
   * Register default background tasks
   */
  private async registerDefaultTasks(): Promise<void> {
    // Data cleanup task
    this.registerTask({
      id: 'data_cleanup',
      name: 'Data Cleanup',
      interval: 24 * 60 * 60 * 1000, // 24 hours
      lastRun: 0,
      enabled: true,
      handler: async () => {
        console.log('🧹 Running background data cleanup...');
        const result = await dataCleanupService.checkAndCleanup();
        console.log('🧹 Background cleanup result:', result);
      }
    });

    // Health check task
    this.registerTask({
      id: 'health_check',
      name: 'App Health Check',
      interval: 60 * 60 * 1000, // 1 hour
      lastRun: 0,
      enabled: true,
      handler: async () => {
        console.log('💓 Running app health check...');
        await this.performHealthCheck();
      }
    });

    // Cache optimization task
    this.registerTask({
      id: 'cache_optimization',
      name: 'Cache Optimization',
      interval: 6 * 60 * 60 * 1000, // 6 hours
      lastRun: 0,
      enabled: true,
      handler: async () => {
        console.log('⚡ Running cache optimization...');
        await this.optimizeCache();
      }
    });
  }

  /**
   * Register a new background task
   */
  registerTask(task: BackgroundTask): void {
    this.tasks.set(task.id, task);
    console.log(`📝 Registered background task: ${task.name}`);
  }

  /**
   * Start a specific task
   */
  startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || !task.enabled) return;

    // Clear existing interval if any
    this.stopTask(taskId);

    // Set up new interval
    const intervalId = setInterval(async () => {
      try {
        await task.handler();
        task.lastRun = Date.now();
      } catch (error) {
        console.error(`❌ Background task ${task.name} failed:`, error);
      }
    }, task.interval);

    this.intervalIds.set(taskId, intervalId);
    console.log(`▶️ Started background task: ${task.name}`);
  }

  /**
   * Stop a specific task
   */
  stopTask(taskId: string): void {
    const intervalId = this.intervalIds.get(taskId);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(taskId);
      
      const task = this.tasks.get(taskId);
      console.log(`⏹️ Stopped background task: ${task?.name || taskId}`);
    }
  }

  /**
   * Start all enabled tasks
   */
  startAllTasks(): void {
    for (const [taskId, task] of this.tasks) {
      if (task.enabled) {
        this.startTask(taskId);
      }
    }
  }

  /**
   * Stop all tasks
   */
  stopAllTasks(): void {
    for (const taskId of this.intervalIds.keys()) {
      this.stopTask(taskId);
    }
  }

  /**
   * Enable/disable a task
   */
  setTaskEnabled(taskId: string, enabled: boolean): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = enabled;
      if (enabled) {
        this.startTask(taskId);
      } else {
        this.stopTask(taskId);
      }
    }
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Set up app state listeners
   */
  private setupAppStateListeners(): void {
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('📱 App became active - starting background tasks');
        this.startAllTasks();
        
        // Run immediate health check when app becomes active
        this.runTaskImmediately('health_check');
      } else {
        console.log('📱 App became inactive - stopping background tasks');
        this.stopAllTasks();
      }
    });

    App.addListener('resume', () => {
      console.log('📱 App resumed - checking for pending tasks');
      this.checkPendingTasks();
    });
  }

  /**
   * Set up notification listeners for background task triggers
   */
  private setupNotificationListeners(): void {
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      const action = notification.extra?.action;
      
      if (action === 'cleanup_check') {
        console.log('🔔 Cleanup notification received - running cleanup');
        this.runTaskImmediately('data_cleanup');
      }
    });

    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      const action = notificationAction.notification.extra?.action;
      
      if (action === 'cleanup_check') {
        console.log('🔔 Cleanup action performed - running cleanup');
        this.runTaskImmediately('data_cleanup');
      }
    });
  }

  /**
   * Run a task immediately
   */
  async runTaskImmediately(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      try {
        console.log(`🚀 Running task immediately: ${task.name}`);
        await task.handler();
        task.lastRun = Date.now();
      } catch (error) {
        console.error(`❌ Immediate task ${task.name} failed:`, error);
      }
    }
  }

  /**
   * Check for tasks that should have run while app was inactive
   */
  private async checkPendingTasks(): Promise<void> {
    const now = Date.now();
    
    for (const [taskId, task] of this.tasks) {
      if (!task.enabled) continue;
      
      const timeSinceLastRun = now - task.lastRun;
      const shouldHaveRun = timeSinceLastRun >= task.interval;
      
      if (shouldHaveRun) {
        console.log(`⏰ Task ${task.name} is overdue - running now`);
        await this.runTaskImmediately(taskId);
      }
    }
  }

  /**
   * Perform app health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Check memory usage (if available)
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        const memUsage = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;

        // Use environment variable for memory threshold, default to 0.85
        const memoryThreshold = parseFloat(import.meta.env.VITE_MEMORY_WARNING_THRESHOLD || '0.85');

        if (memUsage > memoryThreshold) {
          console.warn(`⚠️ High memory usage detected: ${(memUsage * 100).toFixed(1)}% (threshold: ${(memoryThreshold * 100).toFixed(1)}%)`);

          // Trigger immediate cache cleanup for high memory usage
          await this.runTaskImmediately('cache_optimization');

          // Force garbage collection if available (Chrome DevTools)
          if (typeof window !== 'undefined' && 'gc' in window) {
            try {
              (window as any).gc();
              console.log('🧹 Forced garbage collection completed');
            } catch (e) {
              // Ignore if gc is not available
            }
          }
        }
      }

      // Check local storage usage
      const storageUsage = await this.checkStorageUsage();
      if (storageUsage > 50 * 1024 * 1024) { // 50MB
        console.warn('⚠️ High storage usage detected:', storageUsage);
        // Suggest cleanup
        await this.suggestCleanup();
      }

      console.log('💓 Health check completed');
    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  /**
   * Optimize cache
   */
  private async optimizeCache(): Promise<void> {
    try {
      // This would implement cache optimization logic
      // For now, just log the action
      console.log('⚡ Cache optimization completed');
    } catch (error) {
      console.error('❌ Cache optimization failed:', error);
    }
  }

  /**
   * Check storage usage
   */
  private async checkStorageUsage(): Promise<number> {
    try {
      // Estimate storage usage by checking AsyncStorage
      // This is a simplified implementation
      return 0; // Would implement actual storage size calculation
    } catch (error) {
      console.error('Failed to check storage usage:', error);
      return 0;
    }
  }

  /**
   * Suggest cleanup to user
   */
  private async suggestCleanup(): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          title: 'CaseFlow Storage Notice',
          body: 'Your app is using significant storage. Consider running data cleanup to free up space.',
          id: 996,
          schedule: {
            at: new Date(Date.now() + 2000)
          },
          sound: undefined,
          attachments: undefined,
          actionTypeId: '',
          extra: {
            action: 'suggest_cleanup'
          }
        }]
      });
    } catch (error) {
      console.warn('Failed to send cleanup suggestion:', error);
    }
  }

  /**
   * Get background task statistics
   */
  getTaskStatistics(): {
    totalTasks: number;
    enabledTasks: number;
    runningTasks: number;
    lastHealthCheck: number;
  } {
    const totalTasks = this.tasks.size;
    const enabledTasks = Array.from(this.tasks.values()).filter(task => task.enabled).length;
    const runningTasks = this.intervalIds.size;
    const healthCheckTask = this.tasks.get('health_check');
    
    return {
      totalTasks,
      enabledTasks,
      runningTasks,
      lastHealthCheck: healthCheckTask?.lastRun || 0
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    console.log('🔄 Shutting down Background Task Manager...');
    this.stopAllTasks();
    this.tasks.clear();
    this.isInitialized = false;
    console.log('✅ Background Task Manager shutdown complete');
  }
}

// Export singleton instance
export const backgroundTaskManager = BackgroundTaskManager.getInstance();
