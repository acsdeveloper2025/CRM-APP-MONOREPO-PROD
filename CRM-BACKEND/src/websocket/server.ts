import type { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/config/logger';
import type { JwtPayload } from '@/types/auth';
import { loadUserAuthContext } from '@/middleware/auth';
import {
  hasSystemScopeBypass,
  isFieldExecutionActor,
  isScopedOperationsUser,
} from '@/security/rbacAccess';
import { MobileWebSocketEvents } from './mobileEvents';
import type { NotificationCaseData } from './eventTypes';

// Global WebSocket instance for use in controllers
let globalSocketIO: SocketIOServer | null = null;
let mobileEvents: MobileWebSocketEvents | null = null;

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    permissionCodes: string[];
    capabilities: {
      systemScopeBypass: boolean;
      operationalScope: boolean;
      executionActor: boolean;
    };
    assignedClientIds: number[];
    assignedProductIds: number[];
    deviceId?: string;
    platform?: string;
  };
}

export const initializeWebSocket = (io: SocketIOServer): void => {
  // Store global reference for use in controllers
  globalSocketIO = io;
  mobileEvents = new MobileWebSocketEvents(io);

  // Authentication middleware for WebSocket
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    const deviceId = socket.handshake.auth.deviceId;
    const platform = socket.handshake.auth.platform;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      void (async () => {
        const userContext = await loadUserAuthContext(decoded.userId);
        if (!userContext) {
          next(new Error('Authentication error: User not found'));
          return;
        }

        const userLike = {
          id: userContext.id,
          permissionCodes: userContext.permissionCodes,
          assignedClientIds: userContext.assignedClientIds,
          assignedProductIds: userContext.assignedProductIds,
        };

        socket.user = {
          id: userContext.id,
          permissionCodes: userContext.permissionCodes,
          capabilities: {
            systemScopeBypass: hasSystemScopeBypass(userLike),
            operationalScope: isScopedOperationsUser(userLike),
            executionActor: isFieldExecutionActor(userLike),
          },
          assignedClientIds: userContext.assignedClientIds,
          assignedProductIds: userContext.assignedProductIds,
          deviceId,
          platform,
        };
        next();
      })().catch(error => {
        logger.error('WebSocket auth context load failed:', error);
        next(new Error('Authentication error: Context load failed'));
      });
    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    if (!socket.user) {
      socket.disconnect();
      return;
    }

    logger.info(`User ${socket.user.id} connected to WebSocket`);

    // Join user to their personal room
    void socket.join(`user:${socket.user.id}`);

    // Join permission-group rooms (supervisory/operations routing)
    if (
      socket.user.permissionCodes.includes('*') ||
      socket.user.permissionCodes.includes('case.assign')
    ) {
      void socket.join('perm:operations');
    }
    if (
      socket.user.permissionCodes.includes('*') ||
      socket.user.permissionCodes.includes('review.approve')
    ) {
      void socket.join('perm:review');
    }
    if (
      socket.user.permissionCodes.includes('*') ||
      socket.user.permissionCodes.includes('billing.generate')
    ) {
      void socket.join('perm:billing');
    }

    // Join scope rooms for operational users
    if (socket.user.capabilities.operationalScope || socket.user.capabilities.systemScopeBypass) {
      socket.user.assignedClientIds.forEach(clientId => {
        void socket.join(`client:${clientId}`);
      });
      socket.user.assignedProductIds.forEach(productId => {
        void socket.join(`product:${productId}`);
      });
    }

    // Join device-specific room for mobile apps
    if (socket.user.deviceId) {
      void socket.join(`device:${socket.user.deviceId}`);
    }

    // Join platform-specific room
    if (socket.user.platform) {
      void socket.join(`platform:${socket.user.platform}`);
    }

    // Handle case updates subscription
    socket.on('subscribe:case', (caseId: string) => {
      void socket.join(`case:${caseId}`);
      logger.info(`User ${socket.user?.id} subscribed to case ${caseId}`);
    });

    // Handle case updates unsubscription
    socket.on('unsubscribe:case', (caseId: string) => {
      void socket.leave(`case:${caseId}`);
      logger.info(`User ${socket.user?.id} unsubscribed from case ${caseId}`);
    });

    // Handle real-time location updates
    socket.on(
      'location:update',
      (data: { caseId: string; latitude: number; longitude: number }) => {
        // Broadcast location update to case subscribers
        socket.to(`case:${data.caseId}`).emit('location:updated', {
          caseId: data.caseId,
          userId: socket.user?.id,
          username: socket.user?.id,
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // Handle case status updates
    socket.on('case:status', (data: { caseId: string; status: string }) => {
      // Broadcast status update to case subscribers
      socket.to(`case:${data.caseId}`).emit('case:status:updated', {
        caseId: data.caseId,
        status: data.status,
        updatedBy: socket.user?.id,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle typing indicators for case notes
    socket.on('case:typing', (data: { caseId: string; isTyping: boolean }) => {
      socket.to(`case:${data.caseId}`).emit('case:typing:update', {
        caseId: data.caseId,
        userId: socket.user?.id,
        username: socket.user?.id,
        isTyping: data.isTyping,
      });
    });

    // Mobile-specific events

    // Handle mobile app state changes
    socket.on('mobile:app:state', (data: { state: 'foreground' | 'background' | 'inactive' }) => {
      logger.info(`Mobile app state changed for user ${socket.user?.id}: ${data.state}`);
      // Update user's online status or handle background sync
    });

    // Handle mobile sync requests
    socket.on('mobile:sync:request', (_data: { lastSyncTimestamp?: string }) => {
      socket.emit('mobile:sync:start', {
        message: 'Sync started',
        timestamp: new Date().toISOString(),
      });
      // Trigger sync process
    });

    // Handle mobile location sharing
    socket.on(
      'mobile:location:share',
      (data: {
        caseId: string;
        latitude: number;
        longitude: number;
        accuracy: number;
        timestamp: string;
      }) => {
        // Broadcast real-time location to case watchers
        socket.to(`case:${data.caseId}`).emit('mobile:location:update', {
          caseId: data.caseId,
          userId: socket.user?.id,
          username: socket.user?.id,
          location: {
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            timestamp: data.timestamp,
          },
        });
      }
    );

    // Handle mobile form auto-save
    socket.on(
      'mobile:form:autosave',
      (data: { caseId: string; formType: string; progress: number }) => {
        // Notify other users about form progress
        socket.to(`case:${data.caseId}`).emit('mobile:form:progress', {
          caseId: data.caseId,
          userId: socket.user?.id,
          username: socket.user?.id,
          formType: data.formType,
          progress: data.progress,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // Handle mobile photo capture events
    socket.on(
      'mobile:photo:captured',
      (data: { caseId: string; photoCount: number; hasGeoLocation: boolean }) => {
        // Notify case watchers about photo capture
        socket.to(`case:${data.caseId}`).emit('mobile:photo:update', {
          caseId: data.caseId,
          userId: socket.user?.id,
          username: socket.user?.id,
          photoCount: data.photoCount,
          hasGeoLocation: data.hasGeoLocation,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // Handle mobile connectivity status
    socket.on(
      'mobile:connectivity',
      (data: { isOnline: boolean; connectionType: string; pendingSync: number }) => {
        logger.info(
          `Mobile connectivity update for user ${socket.user?.id}: ${data.isOnline ? 'online' : 'offline'}`
        );

        // If coming back online with pending sync, trigger sync
        if (data.isOnline && data.pendingSync > 0) {
          socket.emit('mobile:sync:trigger', {
            message: 'Sync recommended',
            pendingItems: data.pendingSync,
            timestamp: new Date().toISOString(),
          });
        }
      }
    );

    // Handle mobile push notification acknowledgment
    socket.on('mobile:notification:ack', (data: { notificationId: string }) => {
      void (async () => {
        logger.info(
          `Push notification acknowledged by user ${socket.user?.id}: ${data.notificationId}`
        );

        // Update notification status in audit log
        if (mobileEvents) {
          try {
            await mobileEvents.updateNotificationStatus(data.notificationId, 'ACKNOWLEDGED');
          } catch (error) {
            logger.error('Failed to update notification acknowledgment:', error);
          }
        }
      })();
    });

    // Handle disconnect
    socket.on('disconnect', reason => {
      logger.info(`User ${socket.user?.id} disconnected from WebSocket: ${reason}`);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to CaseFlow WebSocket server',
      userId: socket.user.id,
      timestamp: new Date().toISOString(),
    });
  });

  logger.info('WebSocket server initialized');
};

// Helper functions to emit events from other parts of the application
export const emitCaseUpdate = (
  io: SocketIOServer,
  caseId: string,
  data: Record<string, unknown>
): void => {
  io.to(`case:${caseId}`).emit('case:updated', {
    caseId,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const emitNotification = (
  io: SocketIOServer,
  userId: string,
  notification: Record<string, unknown>
): void => {
  io.to(`user:${userId}`).emit('notification', {
    ...notification,
    timestamp: new Date().toISOString(),
  });
};

export const emitPermissionGroupBroadcast = (
  io: SocketIOServer,
  permissionGroup: 'operations' | 'review' | 'billing',
  data: Record<string, unknown>
): void => {
  io.to(`perm:${permissionGroup}`).emit('broadcast', {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const emitPermissionsUpdated = (io: SocketIOServer, userIds: string[] | string): void => {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  ids.forEach(userId => {
    io.to(`user:${userId}`).emit('permissions_updated', {
      type: 'PERMISSIONS_UPDATED',
      userId,
      timestamp: new Date().toISOString(),
    });
  });
};

// Export functions to access global WebSocket instance from controllers
export const getSocketIO = (): SocketIOServer | null => globalSocketIO;

export const getMobileEvents = (): MobileWebSocketEvents | null => mobileEvents;

// Helper function to emit case assignment notification
export const emitCaseAssigned = (userId: string, caseData: NotificationCaseData): void => {
  if (mobileEvents) {
    void mobileEvents.notifyCaseAssigned(userId, caseData);
  } else {
    logger.warn('Mobile events not initialized, cannot send case assignment notification');
  }
};

// Helper function to emit case status change notification
export const emitCaseStatusChanged = (
  caseId: string,
  oldStatus: string,
  newStatus: string,
  updatedBy: string
): void => {
  if (mobileEvents) {
    void mobileEvents.notifyCaseStatusChanged(caseId, oldStatus, newStatus, updatedBy);
  } else {
    logger.warn('Mobile events not initialized, cannot send case status change notification');
  }
};

// Helper function to emit case priority change notification
export const emitCasePriorityChanged = (
  caseId: string,
  oldPriority: number,
  newPriority: number,
  updatedBy: string
): void => {
  if (mobileEvents) {
    mobileEvents.notifyCasePriorityChanged(caseId, oldPriority, newPriority, updatedBy);
  } else {
    logger.warn('Mobile events not initialized, cannot send case priority change notification');
  }
};
