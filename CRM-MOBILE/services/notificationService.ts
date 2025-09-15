import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import { apiService } from './apiService';

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: string;
  caseId?: string;
  caseNumber?: string;
  actionUrl?: string;
  actionType?: string;
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  isRead: boolean;
  data?: Record<string, any>;
}

export interface NotificationPreferences {
  caseAssignmentEnabled: boolean;
  caseAssignmentPush: boolean;
  caseReassignmentEnabled: boolean;
  caseReassignmentPush: boolean;
  systemNotificationsEnabled: boolean;
  systemNotificationsPush: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

class NotificationService {
  private static instance: NotificationService;
  private fcmToken: string | null = null;
  private notifications: NotificationData[] = [];
  private listeners: ((notifications: NotificationData[]) => void)[] = [];
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize notification service
   */
  public async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      // Request permission for notifications
      await this.requestPermission();

      // Get FCM token
      await this.getFCMToken();

      // Configure push notifications
      this.configurePushNotifications();

      // Set up message handlers
      this.setupMessageHandlers();

      // Load stored notifications
      await this.loadStoredNotifications();

      this.isInitialized = true;
      console.log('✅ Notification service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
      throw error;
    }
  }

  /**
   * Request notification permission
   */
  private async requestPermission(): Promise<void> {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ Notification permission granted');
      } else {
        console.warn('⚠️ Notification permission denied');
        throw new Error('Notification permission denied');
      }
    } catch (error) {
      console.error('❌ Failed to request notification permission:', error);
      throw error;
    }
  }

  /**
   * Get FCM token and register with backend
   */
  private async getFCMToken(): Promise<void> {
    try {
      const token = await messaging().getToken();
      this.fcmToken = token;
      console.log('📱 FCM Token obtained:', token.substring(0, 20) + '...');

      // Register token with backend
      await this.registerTokenWithBackend(token);
    } catch (error) {
      console.error('❌ Failed to get FCM token:', error);
      throw error;
    }
  }

  /**
   * Register FCM token with backend
   */
  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';

      await apiService.post('/notifications/tokens', {
        deviceId,
        platform,
        pushToken: token,
      });

      console.log('✅ FCM token registered with backend');
    } catch (error) {
      console.error('❌ Failed to register FCM token with backend:', error);
      // Don't throw error, allow app to continue without backend registration
    }
  }

  /**
   * Configure push notifications
   */
  private configurePushNotifications(): void {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('📱 Push notification token:', token);
      },

      onNotification: (notification) => {
        console.log('📬 Push notification received:', notification);
        this.handleNotificationReceived(notification);
      },

      onAction: (notification) => {
        console.log('👆 Notification action:', notification.action);
        this.handleNotificationAction(notification);
      },

      onRegistrationError: (err) => {
        console.error('❌ Push notification registration error:', err);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: true,
    });
  }

  /**
   * Set up Firebase message handlers
   */
  private setupMessageHandlers(): void {
    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('📬 Background message received:', remoteMessage);
      await this.processRemoteMessage(remoteMessage);
    });

    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('📬 Foreground message received:', remoteMessage);
      await this.processRemoteMessage(remoteMessage);
      this.showLocalNotification(remoteMessage);
    });

    // Handle notification opened app
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('📱 Notification opened app:', remoteMessage);
      this.handleNotificationTap(remoteMessage);
    });

    // Check if app was opened from a notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('📱 App opened from notification:', remoteMessage);
          this.handleNotificationTap(remoteMessage);
        }
      });
  }

  /**
   * Process remote message and store notification
   */
  private async processRemoteMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
    try {
      const notificationData: NotificationData = {
        id: remoteMessage.messageId || Date.now().toString(),
        title: remoteMessage.notification?.title || 'Notification',
        message: remoteMessage.notification?.body || '',
        type: remoteMessage.data?.type || 'GENERAL',
        caseId: remoteMessage.data?.caseId,
        caseNumber: remoteMessage.data?.caseNumber,
        actionUrl: remoteMessage.data?.actionUrl,
        actionType: remoteMessage.data?.actionType,
        priority: (remoteMessage.data?.priority as any) || 'MEDIUM',
        timestamp: new Date().toISOString(),
        isRead: false,
        data: remoteMessage.data,
      };

      await this.addNotification(notificationData);
    } catch (error) {
      console.error('❌ Failed to process remote message:', error);
    }
  }

  /**
   * Show local notification for foreground messages
   */
  private showLocalNotification(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    PushNotification.localNotification({
      title: remoteMessage.notification?.title || 'Notification',
      message: remoteMessage.notification?.body || '',
      playSound: true,
      soundName: 'default',
      userInfo: remoteMessage.data,
      priority: remoteMessage.data?.priority === 'URGENT' ? 'high' : 'default',
    });
  }

  /**
   * Handle notification received
   */
  private handleNotificationReceived(notification: any): void {
    console.log('📬 Handling notification received:', notification);
    // Update badge count
    this.updateBadgeCount();
  }

  /**
   * Handle notification action
   */
  private handleNotificationAction(notification: any): void {
    console.log('👆 Handling notification action:', notification);
    this.handleNotificationTap(notification);
  }

  /**
   * Handle notification tap (deep linking)
   */
  private handleNotificationTap(notification: any): void {
    try {
      const data = notification.data || notification.userInfo || {};
      
      if (data.actionType === 'OPEN_CASE' && data.caseId) {
        // Navigate to case details
        this.navigateToCase(data.caseId);
      } else if (data.actionUrl) {
        // Navigate to specific URL
        this.navigateToUrl(data.actionUrl);
      }

      // Mark notification as read
      if (data.notificationId) {
        this.markAsRead(data.notificationId);
      }
    } catch (error) {
      console.error('❌ Failed to handle notification tap:', error);
    }
  }

  /**
   * Navigate to case details
   */
  private navigateToCase(caseId: string): void {
    // This would be implemented with your navigation system
    console.log('🔗 Navigate to case:', caseId);
    // Example: NavigationService.navigate('CaseDetails', { caseId });
  }

  /**
   * Navigate to URL
   */
  private navigateToUrl(url: string): void {
    // This would be implemented with your navigation system
    console.log('🔗 Navigate to URL:', url);
    // Example: NavigationService.navigate(url);
  }

  /**
   * Add notification to local storage
   */
  public async addNotification(notification: NotificationData): Promise<void> {
    try {
      this.notifications.unshift(notification);
      
      // Keep only last 100 notifications
      if (this.notifications.length > 100) {
        this.notifications = this.notifications.slice(0, 100);
      }

      await this.saveNotifications();
      this.notifyListeners();
      this.updateBadgeCount();
    } catch (error) {
      console.error('❌ Failed to add notification:', error);
    }
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(notificationId: string): Promise<void> {
    try {
      const notification = this.notifications.find(n => n.id === notificationId);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        await this.saveNotifications();
        this.notifyListeners();
        this.updateBadgeCount();
      }
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  public async markAllAsRead(): Promise<void> {
    try {
      let hasChanges = false;
      this.notifications.forEach(notification => {
        if (!notification.isRead) {
          notification.isRead = true;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        await this.saveNotifications();
        this.notifyListeners();
        this.updateBadgeCount();
      }
    } catch (error) {
      console.error('❌ Failed to mark all notifications as read:', error);
    }
  }

  /**
   * Clear all notifications
   */
  public async clearAllNotifications(): Promise<void> {
    try {
      this.notifications = [];
      await this.saveNotifications();
      this.notifyListeners();
      this.updateBadgeCount();
    } catch (error) {
      console.error('❌ Failed to clear notifications:', error);
    }
  }

  /**
   * Get all notifications
   */
  public getNotifications(): NotificationData[] {
    return [...this.notifications];
  }

  /**
   * Get unread notification count
   */
  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  /**
   * Subscribe to notification updates
   */
  public subscribe(listener: (notifications: NotificationData[]) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Update badge count
   */
  private updateBadgeCount(): void {
    const unreadCount = this.getUnreadCount();
    PushNotification.setApplicationIconBadgeNumber(unreadCount);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.notifications]);
      } catch (error) {
        console.error('❌ Error in notification listener:', error);
      }
    });
  }

  /**
   * Load stored notifications
   */
  private async loadStoredNotifications(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('notifications');
      if (stored) {
        this.notifications = JSON.parse(stored);
        this.notifyListeners();
        this.updateBadgeCount();
      }
    } catch (error) {
      console.error('❌ Failed to load stored notifications:', error);
    }
  }

  /**
   * Save notifications to storage
   */
  private async saveNotifications(): Promise<void> {
    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('❌ Failed to save notifications:', error);
    }
  }

  /**
   * Get device ID
   */
  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      return deviceId;
    } catch (error) {
      console.error('❌ Failed to get device ID:', error);
      return `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Get notification preferences
   */
  public async getPreferences(): Promise<NotificationPreferences | null> {
    try {
      const response = await apiService.get('/notifications/preferences');
      return response.success ? response.data : null;
    } catch (error) {
      console.error('❌ Failed to get notification preferences:', error);
      return null;
    }
  }

  /**
   * Update notification preferences
   */
  public async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<boolean> {
    try {
      const response = await apiService.put('/notifications/preferences', preferences);
      return response.success;
    } catch (error) {
      console.error('❌ Failed to update notification preferences:', error);
      return false;
    }
  }
}

export const notificationService = NotificationService.getInstance();
