import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { JwtPayload } from '@/types/auth';
import { MobileWebSocketEvents } from './mobileEvents';

// Global WebSocket instance for use in controllers
let globalSocketIO: SocketIOServer | null = null;
let mobileEvents: MobileWebSocketEvents | null = null;

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    username: string;
    role: string;
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
      socket.user = {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        deviceId,
        platform,
      };
      next();
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

    logger.info(`User ${socket.user.username} connected to WebSocket`);

    // Join user to their personal room
    socket.join(`user:${socket.user.id}`);

    // Join user to role-based rooms
    socket.join(`role:${socket.user.role}`);

    // Join device-specific room for mobile apps
    if (socket.user.deviceId) {
      socket.join(`device:${socket.user.deviceId}`);
    }

    // Join platform-specific room
    if (socket.user.platform) {
      socket.join(`platform:${socket.user.platform}`);
    }

    // Handle case updates subscription
    socket.on('subscribe:case', (caseId: string) => {
      socket.join(`case:${caseId}`);
      logger.info(`User ${socket.user?.username} subscribed to case ${caseId}`);
    });

    // Handle case updates unsubscription
    socket.on('unsubscribe:case', (caseId: string) => {
      socket.leave(`case:${caseId}`);
      logger.info(`User ${socket.user?.username} unsubscribed from case ${caseId}`);
    });

    // Handle real-time location updates
    socket.on('location:update', (data: { caseId: string; latitude: number; longitude: number }) => {
      // Broadcast location update to case subscribers
      socket.to(`case:${data.caseId}`).emit('location:updated', {
        caseId: data.caseId,
        userId: socket.user?.id,
        username: socket.user?.username,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle case status updates
    socket.on('case:status', (data: { caseId: string; status: string }) => {
      // Broadcast status update to case subscribers
      socket.to(`case:${data.caseId}`).emit('case:status:updated', {
        caseId: data.caseId,
        status: data.status,
        updatedBy: socket.user?.username,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle typing indicators for case notes
    socket.on('case:typing', (data: { caseId: string; isTyping: boolean }) => {
      socket.to(`case:${data.caseId}`).emit('case:typing:update', {
        caseId: data.caseId,
        userId: socket.user?.id,
        username: socket.user?.username,
        isTyping: data.isTyping,
      });
    });

    // Mobile-specific events

    // Handle mobile app state changes
    socket.on('mobile:app:state', (data: { state: 'foreground' | 'background' | 'inactive' }) => {
      logger.info(`Mobile app state changed for user ${socket.user?.username}: ${data.state}`);
      // Update user's online status or handle background sync
    });

    // Handle mobile sync requests
    socket.on('mobile:sync:request', (data: { lastSyncTimestamp?: string }) => {
      socket.emit('mobile:sync:start', {
        message: 'Sync started',
        timestamp: new Date().toISOString(),
      });
      // Trigger sync process
    });

    // Handle mobile location sharing
    socket.on('mobile:location:share', (data: {
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
        username: socket.user?.username,
        location: {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy,
          timestamp: data.timestamp,
        },
      });
    });

    // Handle mobile form auto-save
    socket.on('mobile:form:autosave', (data: {
      caseId: string;
      formType: string;
      progress: number;
    }) => {
      // Notify other users about form progress
      socket.to(`case:${data.caseId}`).emit('mobile:form:progress', {
        caseId: data.caseId,
        userId: socket.user?.id,
        username: socket.user?.username,
        formType: data.formType,
        progress: data.progress,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle mobile photo capture events
    socket.on('mobile:photo:captured', (data: {
      caseId: string;
      photoCount: number;
      hasGeoLocation: boolean;
    }) => {
      // Notify case watchers about photo capture
      socket.to(`case:${data.caseId}`).emit('mobile:photo:update', {
        caseId: data.caseId,
        userId: socket.user?.id,
        username: socket.user?.username,
        photoCount: data.photoCount,
        hasGeoLocation: data.hasGeoLocation,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle mobile connectivity status
    socket.on('mobile:connectivity', (data: {
      isOnline: boolean;
      connectionType: string;
      pendingSync: number;
    }) => {
      logger.info(`Mobile connectivity update for user ${socket.user?.username}: ${data.isOnline ? 'online' : 'offline'}`);

      // If coming back online with pending sync, trigger sync
      if (data.isOnline && data.pendingSync > 0) {
        socket.emit('mobile:sync:trigger', {
          message: 'Sync recommended',
          pendingItems: data.pendingSync,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle mobile push notification acknowledgment
    socket.on('mobile:notification:ack', async (data: { notificationId: string }) => {
      logger.info(`Push notification acknowledged by user ${socket.user?.username}: ${data.notificationId}`);

      // Update notification status in audit log
      if (mobileEvents) {
        try {
          await mobileEvents.updateNotificationStatus(data.notificationId, 'ACKNOWLEDGED');
        } catch (error) {
          logger.error('Failed to update notification acknowledgment:', error);
        }
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info(`User ${socket.user?.username} disconnected from WebSocket: ${reason}`);
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
export const emitCaseUpdate = (io: SocketIOServer, caseId: string, data: any): void => {
  io.to(`case:${caseId}`).emit('case:updated', {
    caseId,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const emitNotification = (io: SocketIOServer, userId: string, notification: any): void => {
  io.to(`user:${userId}`).emit('notification', {
    ...notification,
    timestamp: new Date().toISOString(),
  });
};

export const emitBroadcast = (io: SocketIOServer, role: string, data: any): void => {
  io.to(`role:${role}`).emit('broadcast', {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

// Export functions to access global WebSocket instance from controllers
export const getSocketIO = (): SocketIOServer | null => globalSocketIO;

export const getMobileEvents = (): MobileWebSocketEvents | null => mobileEvents;

// Helper function to emit case assignment notification
export const emitCaseAssigned = (userId: string, caseData: any): void => {
  if (mobileEvents) {
    mobileEvents.notifyCaseAssigned(userId, caseData);
  } else {
    logger.warn('Mobile events not initialized, cannot send case assignment notification');
  }
};

// Helper function to emit case status change notification
export const emitCaseStatusChanged = (caseId: string, oldStatus: string, newStatus: string, updatedBy: string): void => {
  if (mobileEvents) {
    mobileEvents.notifyCaseStatusChanged(caseId, oldStatus, newStatus, updatedBy);
  } else {
    logger.warn('Mobile events not initialized, cannot send case status change notification');
  }
};

// Helper function to emit case priority change notification
export const emitCasePriorityChanged = (caseId: string, oldPriority: number, newPriority: number, updatedBy: string): void => {
  if (mobileEvents) {
    mobileEvents.notifyCasePriorityChanged(caseId, oldPriority, newPriority, updatedBy);
  } else {
    logger.warn('Mobile events not initialized, cannot send case priority change notification');
  }
};
