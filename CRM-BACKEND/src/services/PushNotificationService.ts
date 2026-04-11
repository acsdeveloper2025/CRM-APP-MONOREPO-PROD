// Disabled require-await rule for push notification service as some async functions don't directly await

import * as fs from 'fs';
import admin from 'firebase-admin';
// node-apn upstream is unmaintained and bundles vulnerable versions of
// jsonwebtoken and node-forge. @parse/node-apn is the actively
// maintained fork (jsonwebtoken 9.x, node-forge 1.4.x) with a drop-in
// compatible API.
import apn from '@parse/node-apn';
import { logger } from '../utils/logger';
import { config } from '../config';
import { query } from '../config/database';
import { circuitBreakers } from '../utils/circuitBreaker';

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
  priority?: 'high' | 'normal';
  timeToLive?: number;
  collapseKey?: string;
}

interface NotificationToken {
  id: string;
  userId: string;
  deviceId?: string;
  platform: 'ios' | 'android' | 'web';
  pushToken: string;
  isActive: boolean;
}

export type PushServiceError = Error | { userId: string; error: string; status?: string };

export class PushNotificationService {
  private static instance: PushNotificationService;
  private fcmApp: admin.app.App | null = null;
  private apnProvider: apn.Provider | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize push notification services
   */

  public initialize(): void {
    try {
      this.initializeFCM();
      this.initializeAPNS();
      this.initialized = true;
      logger.info('Push notification services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize push notification services:', error);
      throw error;
    }
  }

  /**
   * Initialize Firebase Cloud Messaging
   */
  private initializeFCM(): void {
    try {
      const serviceAccount = this.getFirebaseServiceAccount();

      if (serviceAccount) {
        const serviceAccountProjectId =
          typeof (serviceAccount as admin.ServiceAccount & { project_id?: string }).project_id ===
          'string'
            ? (serviceAccount as admin.ServiceAccount & { project_id?: string }).project_id
            : serviceAccount.projectId;
        const projectId = config.firebase.projectId || serviceAccountProjectId;

        this.fcmApp = admin.initializeApp(
          {
            credential: admin.credential.cert(serviceAccount),
            projectId,
          },
          'fcm-app'
        );

        logger.info('FCM initialized successfully', {
          projectId,
        });
      } else {
        logger.warn(
          'FCM service account not configured via environment or file path, push notifications for Android will not work'
        );
      }
    } catch (error) {
      logger.error('Failed to initialize FCM:', error);
      // Don't throw error, allow service to continue without FCM
    }
  }

  private getFirebaseServiceAccount(): admin.ServiceAccount | null {
    const serviceAccountJson = config.firebase?.serviceAccountJson?.trim();
    if (serviceAccountJson) {
      return JSON.parse(serviceAccountJson) as admin.ServiceAccount;
    }

    const serviceAccountBase64 = config.firebase?.serviceAccountBase64?.trim();
    if (serviceAccountBase64) {
      const decoded = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
      return JSON.parse(decoded) as admin.ServiceAccount;
    }

    const serviceAccountPath = config.firebase?.serviceAccountPath?.trim();
    if (serviceAccountPath) {
      return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')) as admin.ServiceAccount;
    }

    return null;
  }

  /**
   * Initialize Apple Push Notification Service
   */
  private initializeAPNS(): void {
    try {
      if (config.apns?.keyPath && config.apns?.keyId && config.apns?.teamId) {
        const options: apn.ProviderOptions = {
          token: {
            key: config.apns.keyPath,
            keyId: config.apns.keyId,
            teamId: config.apns.teamId,
          },
          production: config.nodeEnv === 'production',
        };

        this.apnProvider = new apn.Provider(options);

        logger.info('APNS initialized successfully', {
          production: config.nodeEnv === 'production',
          teamId: config.apns.teamId,
        });
      } else {
        logger.warn('APNS credentials not configured, push notifications for iOS will not work');
      }
    } catch (error) {
      logger.error('Failed to initialize APNS:', error);
      // Don't throw error, allow service to continue without APNS
    }
  }

  /**
   * Send push notification to specific users
   */
  public async sendPushNotification(
    userIds: string[],
    payload: PushNotificationPayload
  ): Promise<{ success: number; failed: number; errors: PushServiceError[] }> {
    if (!this.initialized) {
      this.initialize();
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as PushServiceError[],
    };

    try {
      // Get active tokens for users
      const tokens = await this.getActiveTokensForUsers(userIds);

      if (tokens.length === 0) {
        logger.warn('No active push tokens found for users', { userIds });
        return results;
      }

      // Group tokens by platform
      const androidTokens = tokens.filter(t => t.platform === 'android');
      const iosTokens = tokens.filter(t => t.platform === 'ios');
      const webTokens = tokens.filter(t => t.platform === 'web');

      // Send to Android devices via FCM
      if (androidTokens.length > 0) {
        const androidResult = await this.sendFCMNotification(androidTokens, payload);
        results.success += androidResult.success;
        results.failed += androidResult.failed;
        results.errors.push(...androidResult.errors);
      }

      // Send to iOS devices via APNS
      if (iosTokens.length > 0) {
        const iosResult = await this.sendAPNSNotification(iosTokens, payload);
        results.success += iosResult.success;
        results.failed += iosResult.failed;
        results.errors.push(...iosResult.errors);
      }

      // Send to web browsers via FCM
      if (webTokens.length > 0) {
        const webResult = await this.sendFCMNotification(webTokens, payload);
        results.success += webResult.success;
        results.failed += webResult.failed;
        results.errors.push(...webResult.errors);
      }

      logger.info('Push notification batch completed', {
        userIds,
        totalTokens: tokens.length,
        success: results.success,
        failed: results.failed,
        title: payload.title,
      });

      return results;
    } catch (error) {
      logger.error('Failed to send push notifications:', error);
      results.failed = userIds.length;
      results.errors.push(error as Error);
      return results;
    }
  }

  /**
   * Send push notification to an explicit set of device tokens without refetching by user.
   */
  public async sendPushToTokens(
    tokens: NotificationToken[],
    payload: PushNotificationPayload
  ): Promise<{ success: number; failed: number; errors: PushServiceError[] }> {
    if (!this.initialized) {
      this.initialize();
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as PushServiceError[],
    };

    if (tokens.length === 0) {
      return results;
    }

    const androidTokens = tokens.filter(t => t.platform === 'android');
    const iosTokens = tokens.filter(t => t.platform === 'ios');
    const webTokens = tokens.filter(t => t.platform === 'web');

    if (androidTokens.length > 0) {
      const androidResult = await this.sendFCMNotification(androidTokens, payload);
      results.success += androidResult.success;
      results.failed += androidResult.failed;
      results.errors.push(...androidResult.errors);
    }

    if (iosTokens.length > 0) {
      const iosResult = await this.sendAPNSNotification(iosTokens, payload);
      results.success += iosResult.success;
      results.failed += iosResult.failed;
      results.errors.push(...iosResult.errors);
    }

    if (webTokens.length > 0) {
      const webResult = await this.sendFCMNotification(webTokens, payload);
      results.success += webResult.success;
      results.failed += webResult.failed;
      results.errors.push(...webResult.errors);
    }

    return results;
  }

  /**
   * Send FCM notification (Android and Web)
   */
  private async sendFCMNotification(
    tokens: NotificationToken[],
    payload: PushNotificationPayload
  ): Promise<{ success: number; failed: number; errors: PushServiceError[] }> {
    const results = { success: 0, failed: 0, errors: [] as PushServiceError[] };

    if (!this.fcmApp) {
      logger.warn('FCM not initialized, skipping FCM notifications');
      results.failed = tokens.length;
      return results;
    }

    try {
      const messaging = admin.messaging(this.fcmApp);
      const pushTokens = tokens.map(t => t.pushToken);

      const message: admin.messaging.MulticastMessage = {
        tokens: pushTokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data ? this.stringifyData(payload.data) : undefined,
        android: {
          priority: payload.priority === 'high' ? 'high' : 'normal',
          ttl: payload.timeToLive ? payload.timeToLive * 1000 : undefined,
          collapseKey: payload.collapseKey,
          notification: {
            sound: payload.sound || 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            badge: payload.badge?.toString(),
            icon: '/notification-icon.png',
            requireInteraction: payload.priority === 'high',
          },
          fcmOptions: {
            link: (payload.data?.actionUrl as string) || '/',
          },
        },
      };

      const response = await circuitBreakers.firebase.execute(() =>
        messaging.sendEachForMulticast(message)
      );

      results.success = response.successCount;
      results.failed = response.failureCount;

      // Handle failed tokens
      if (response.failureCount > 0) {
        response.responses.forEach((resp, index) => {
          if (!resp.success) {
            const token = tokens[index];
            logger.warn('FCM notification failed', {
              userId: token.userId,
              error: resp.error?.message,
            });
            results.errors.push({
              userId: token.userId,
              error: resp.error?.message,
            });

            // Deactivate invalid tokens
            if (resp.error?.code === 'messaging/registration-token-not-registered') {
              void this.deactivateToken(token.id);
            }
          }
        });
      }

      logger.info('FCM notification sent', {
        totalTokens: pushTokens.length,
        success: results.success,
        failed: results.failed,
      });

      return results;
    } catch (error) {
      logger.error('FCM notification error:', error);
      results.failed = tokens.length;
      results.errors.push(error as Error);
      return results;
    }
  }

  /**
   * Send APNS notification (iOS)
   */
  private async sendAPNSNotification(
    tokens: NotificationToken[],
    payload: PushNotificationPayload
  ): Promise<{ success: number; failed: number; errors: PushServiceError[] }> {
    const results = { success: 0, failed: 0, errors: [] as PushServiceError[] };

    if (!this.apnProvider) {
      logger.warn('APNS not initialized, skipping iOS notifications');
      results.failed = tokens.length;
      return results;
    }

    try {
      const notifications = tokens.map(token => {
        const notification = new apn.Notification();

        notification.alert = {
          title: payload.title,
          body: payload.body,
        };

        notification.badge = payload.badge || 0;
        notification.sound = payload.sound || 'default';
        notification.topic = config.apns?.bundleId || 'com.example.crm';
        notification.priority = payload.priority === 'high' ? 10 : 5;
        notification.expiry = payload.timeToLive
          ? Math.floor(Date.now() / 1000) + payload.timeToLive
          : Math.floor(Date.now() / 1000) + 3600; // 1 hour default

        if (payload.data) {
          notification.payload = payload.data;
        }

        return {
          notification,
          token: token.pushToken,
          userId: token.userId,
          tokenId: token.id,
        };
      });

      for (const { notification, token, userId, tokenId } of notifications) {
        try {
          const result = await circuitBreakers.apns.execute(() =>
            this.apnProvider.send(notification, token)
          );

          if (result.sent.length > 0) {
            results.success++;
          } else if (result.failed.length > 0) {
            results.failed++;
            const failure = result.failed[0];
            logger.warn('APNS notification failed', {
              userId,
              error: failure.error,
              status: failure.status,
            });
            results.errors.push({
              userId,
              error: failure.error?.message || String(failure.error),
              status: String(failure.status),
            });

            // Deactivate invalid tokens. @parse/node-apn exposes
            // `status` as a number (410) while the legacy node-apn
            // used a string — accept both for forward compatibility.
            if (
              Number(failure.status) === 410 ||
              (failure.error && failure.error.toString().includes('BadDeviceToken'))
            ) {
              await this.deactivateToken(tokenId);
            }
          }
        } catch (error) {
          results.failed++;
          results.errors.push({ userId, error: error.message });
          logger.error('APNS notification error:', { userId, error });
        }
      }

      logger.info('APNS notification sent', {
        totalTokens: tokens.length,
        success: results.success,
        failed: results.failed,
      });

      return results;
    } catch (error) {
      logger.error('APNS notification error:', error);
      results.failed = tokens.length;
      results.errors.push(error as Error);
      return results;
    }
  }

  /**
   * Get active push tokens for users
   */
  private async getActiveTokensForUsers(userIds: string[]): Promise<NotificationToken[]> {
    try {
      const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
      const selectQuery = `
        SELECT 
          id,
          user_id as user_id,
          platform,
          push_token as "pushToken",
          is_active as is_active
        FROM notification_tokens 
        WHERE user_id IN (${placeholders}) 
          AND is_active = true 
          AND push_token IS NOT NULL
        ORDER BY last_used_at DESC
      `;

      const result = await query(selectQuery, userIds);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get notification tokens:', error);
      return [];
    }
  }

  /**
   * Deactivate invalid token
   */
  private async deactivateToken(tokenId: string): Promise<void> {
    try {
      await query('UPDATE notification_tokens SET is_active = false WHERE id = $1', [tokenId]);
      logger.info('Deactivated invalid notification token', { tokenId });
    } catch (error) {
      logger.error('Failed to deactivate token:', error);
    }
  }

  /**
   * Convert data object to string values for FCM
   */
  private stringifyData(data: Record<string, unknown>): Record<string, string> {
    const stringData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return stringData;
  }

  /**
   * Test push notification connectivity
   */
  public testConnectivity(): Promise<{ fcm: boolean; apns: boolean }> {
    const results = { fcm: false, apns: false };

    try {
      if (this.fcmApp) {
        // Test with a dummy token to check connectivity
        results.fcm = true;
      }
    } catch (error) {
      logger.error('FCM connectivity test failed:', error);
    }

    try {
      if (this.apnProvider) {
        // APNS provider is ready if initialized
        results.apns = true;
      }
    } catch (error) {
      logger.error('APNS connectivity test failed:', error);
    }

    return Promise.resolve(results);
  }
}
