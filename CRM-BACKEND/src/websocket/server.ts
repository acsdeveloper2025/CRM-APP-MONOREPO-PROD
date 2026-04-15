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

/**
 * Per-user, per-bucket rate limiter for WebSocket events.
 *
 * Finding #4: the prior implementation keyed on socket.id, which meant a
 * client hitting the rate limit only needed to disconnect and reconnect
 * to reset its counter — no meaningful protection against event flooding
 * from a compromised token. It also ran a single global bucket, so an
 * attacker could exhaust the quota with cheap no-op events like
 * subscribe:case and starve the expensive ones (location, sync) or
 * vice versa. Worse, six of the mobile:* handlers were not wrapped at
 * all.
 *
 * This implementation keys on `userId` so reconnection does NOT reset
 * the counter, and accepts named buckets so each event family can have
 * its own limit tuned to its cost. Global bucket still exists as a
 * per-request safety net so a new unrated event can never go fully
 * unthrottled.
 *
 * Tuning (events per userId per windowMs):
 *   - global:       200 / 60s  — overall ceiling across all events.
 *   - connect:      10  / 60s  — checked at io.use; bounds reconnect
 *                                storms from a token that has been
 *                                exfiltrated or a buggy client.
 *   - location:     60  / 60s  — 1/s is plenty for live-tracking UX.
 *   - sync:         6   / 60s  — mobile:sync:request is server-
 *                                expensive; once per 10s is generous.
 *   - form:         30  / 60s  — auto-save pings during data entry.
 *   - notif_ack:    30  / 60s  — acknowledgements are per-user and do
 *                                a DB write each, so tighten.
 *   - subscribe:    60  / 60s  — subscribe/unsubscribe churn.
 *
 * Memory is bounded by a sweeper that drops expired entries every
 * `windowMs`; without it a long-lived server slowly accumulates one
 * entry per user per bucket across an entire day.
 */
type RateLimitConfig = { max: number; windowMs: number };

const RATE_LIMIT_BUCKETS: Record<string, RateLimitConfig> = {
  global: { max: 200, windowMs: 60_000 },
  connect: { max: 10, windowMs: 60_000 },
  location: { max: 60, windowMs: 60_000 },
  sync: { max: 6, windowMs: 60_000 },
  form: { max: 30, windowMs: 60_000 },
  notif_ack: { max: 30, windowMs: 60_000 },
  subscribe: { max: 60, windowMs: 60_000 },
};

class SocketRateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Drop expired entries hourly — the biggest windowMs among the
    // buckets is 60s, so anything older than the current window is
    // reclaimable. Bound at 3600s so even a pathological workload
    // caps total memory.
    this.sweepTimer = setInterval(() => this.sweep(), 3600_000);
    if (typeof this.sweepTimer.unref === 'function') {
      this.sweepTimer.unref();
    }
  }

  /**
   * Check whether `userId` may issue another event on `bucket`. The
   * same userId is counted against both `bucket` and `global` so a
   * client cannot fan out across six cheap buckets to bypass the
   * global ceiling.
   */
  isAllowed(userId: string, bucket: keyof typeof RATE_LIMIT_BUCKETS): boolean {
    if (!this.increment(userId, 'global')) {
      return false;
    }
    return this.increment(userId, bucket);
  }

  private increment(userId: string, bucket: string): boolean {
    const cfg = RATE_LIMIT_BUCKETS[bucket];
    if (!cfg) {
      return true;
    }
    const key = `${userId}:${bucket}`;
    const now = Date.now();
    const entry = this.buckets.get(key);
    if (!entry || now > entry.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + cfg.windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= cfg.max;
  }

  cleanup(userId: string): void {
    for (const key of this.buckets.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.buckets.delete(key);
      }
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.buckets.entries()) {
      if (entry.resetAt < now) {
        this.buckets.delete(key);
      }
    }
  }
}

/** Validate latitude/longitude values are within valid ranges */
const isValidCoordinate = (lat: unknown, lng: unknown): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    isFinite(lat) &&
    isFinite(lng)
  );
};

/** Validate a string is non-empty and within length bounds */
const isValidString = (val: unknown, maxLen = 200): boolean => {
  return typeof val === 'string' && val.length > 0 && val.length <= maxLen;
};

const socketRateLimiter = new SocketRateLimiter();

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

      // Connection-attempt rate limit — bounds reconnect storms from
      // an exfiltrated token or a client bug. 10/min per userId is
      // generous for a legitimate network-flap scenario but kills a
      // reconnect loop before it can dominate the event loop.
      if (!socketRateLimiter.isAllowed(decoded.userId, 'connect')) {
        logger.warn('WebSocket connect rate limit exceeded', { userId: decoded.userId });
        return next(new Error('Authentication error: Connection rate limit exceeded'));
      }

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

    // Rate limit wrapper — keyed on userId so reconnecting does not
    // reset the bucket. Each handler picks the bucket that matches
    // its cost profile; the global bucket is always charged in
    // parallel so no single family can exhaust the total budget.
    const rateLimited = (
      bucket: keyof typeof RATE_LIMIT_BUCKETS,
      handler: (...args: unknown[]) => void
    ) => {
      return (...args: unknown[]) => {
        const userId = socket.user?.id;
        if (!userId) {
          return;
        }
        if (!socketRateLimiter.isAllowed(userId, bucket)) {
          logger.warn(`WebSocket rate limit exceeded for user ${userId} on bucket ${bucket}`);
          socket.emit('error', {
            code: 'RATE_LIMIT',
            bucket,
            message: 'Too many events, slow down',
          });
          return;
        }
        handler(...args);
      };
    };

    // Handle case updates subscription
    socket.on(
      'subscribe:case',
      rateLimited('subscribe', (caseId: unknown) => {
        if (!isValidString(caseId)) {
          return;
        }
        const id = caseId as string;
        void socket.join(`case:${id}`);
        logger.info(`User ${socket.user?.id} subscribed to case ${id}`);
      })
    );

    // Handle case updates unsubscription
    socket.on(
      'unsubscribe:case',
      rateLimited('subscribe', (caseId: unknown) => {
        if (!isValidString(caseId)) {
          return;
        }
        const id = caseId as string;
        void socket.leave(`case:${id}`);
        logger.info(`User ${socket.user?.id} unsubscribed from case ${id}`);
      })
    );

    // Handle real-time location updates
    socket.on(
      'location:update',
      rateLimited('location', (data: unknown) => {
        const d = data as { caseId?: string; latitude?: number; longitude?: number };
        if (!isValidString(d?.caseId) || !isValidCoordinate(d?.latitude, d?.longitude)) {
          return;
        }
        socket.to(`case:${d.caseId}`).emit('location:updated', {
          caseId: d.caseId,
          userId: socket.user?.id,
          username: socket.user?.id,
          latitude: d.latitude,
          longitude: d.longitude,
          timestamp: new Date().toISOString(),
        });
      })
    );

    // Handle case status updates
    socket.on(
      'case:status',
      rateLimited('subscribe', (data: unknown) => {
        const d = data as { caseId?: string; status?: string };
        if (!isValidString(d?.caseId) || !isValidString(d?.status, 50)) {
          return;
        }
        socket.to(`case:${d.caseId}`).emit('case:status:updated', {
          caseId: d.caseId,
          status: d.status,
          updatedBy: socket.user?.id,
          timestamp: new Date().toISOString(),
        });
      })
    );

    // Handle typing indicators for case notes
    socket.on(
      'case:typing',
      rateLimited('subscribe', (data: unknown) => {
        const d = data as { caseId?: string; isTyping?: boolean };
        if (!isValidString(d?.caseId) || typeof d?.isTyping !== 'boolean') {
          return;
        }
        socket.to(`case:${d.caseId}`).emit('case:typing:update', {
          caseId: d.caseId,
          userId: socket.user?.id,
          username: socket.user?.id,
          isTyping: d.isTyping,
        });
      })
    );

    // Mobile-specific events

    // Handle mobile app state changes
    socket.on(
      'mobile:app:state',
      rateLimited('subscribe', (data: unknown) => {
        const d = data as { state?: 'foreground' | 'background' | 'inactive' };
        logger.info(`Mobile app state changed for user ${socket.user?.id}: ${d?.state}`);
        // Update user's online status or handle background sync
      })
    );

    // Handle mobile sync requests
    socket.on(
      'mobile:sync:request',
      rateLimited('sync', (_data: unknown) => {
        socket.emit('mobile:sync:start', {
          message: 'Sync started',
          timestamp: new Date().toISOString(),
        });
        // Trigger sync process
      })
    );

    // Handle mobile location sharing
    socket.on(
      'mobile:location:share',
      rateLimited('location', (data: unknown) => {
        const d = data as {
          caseId?: string;
          latitude?: number;
          longitude?: number;
          accuracy?: number;
          timestamp?: string;
        };
        if (!isValidString(d?.caseId) || !isValidCoordinate(d?.latitude, d?.longitude)) {
          return;
        }
        if (typeof d?.accuracy !== 'number' || d.accuracy < 0 || d.accuracy > 10000) {
          return;
        }
        socket.to(`case:${d.caseId}`).emit('mobile:location:update', {
          caseId: d.caseId,
          userId: socket.user?.id,
          username: socket.user?.id,
          location: {
            latitude: d.latitude,
            longitude: d.longitude,
            accuracy: d.accuracy,
            timestamp: d.timestamp || new Date().toISOString(),
          },
        });
      })
    );

    // Handle mobile form auto-save
    socket.on(
      'mobile:form:autosave',
      rateLimited('form', (data: unknown) => {
        const d = data as { caseId?: string; formType?: string; progress?: number };
        if (!isValidString(d?.caseId) || !isValidString(d?.formType, 50)) {
          return;
        }
        // Notify other users about form progress
        socket.to(`case:${d.caseId}`).emit('mobile:form:progress', {
          caseId: d.caseId,
          userId: socket.user?.id,
          username: socket.user?.id,
          formType: d.formType,
          progress: d.progress,
          timestamp: new Date().toISOString(),
        });
      })
    );

    // Handle mobile photo capture events
    socket.on(
      'mobile:photo:captured',
      rateLimited('form', (data: unknown) => {
        const d = data as { caseId?: string; photoCount?: number; hasGeoLocation?: boolean };
        if (!isValidString(d?.caseId)) {
          return;
        }
        // Notify case watchers about photo capture
        socket.to(`case:${d.caseId}`).emit('mobile:photo:update', {
          caseId: d.caseId,
          userId: socket.user?.id,
          username: socket.user?.id,
          photoCount: d.photoCount,
          hasGeoLocation: d.hasGeoLocation,
          timestamp: new Date().toISOString(),
        });
      })
    );

    // Handle mobile connectivity status
    socket.on(
      'mobile:connectivity',
      rateLimited('subscribe', (data: unknown) => {
        const d = data as { isOnline?: boolean; connectionType?: string; pendingSync?: number };
        logger.info(
          `Mobile connectivity update for user ${socket.user?.id}: ${d?.isOnline ? 'online' : 'offline'}`
        );

        // If coming back online with pending sync, trigger sync
        if (d?.isOnline && typeof d.pendingSync === 'number' && d.pendingSync > 0) {
          socket.emit('mobile:sync:trigger', {
            message: 'Sync recommended',
            pendingItems: d.pendingSync,
            timestamp: new Date().toISOString(),
          });
        }
      })
    );

    // Handle mobile push notification acknowledgment
    socket.on(
      'mobile:notification:ack',
      rateLimited('notif_ack', (data: unknown) => {
        const d = data as { notificationId?: string };
        if (!isValidString(d?.notificationId, 128)) {
          return;
        }
        void (async () => {
          logger.info(
            `Push notification acknowledged by user ${socket.user?.id}: ${d.notificationId}`
          );

          // Update notification status in audit log
          if (mobileEvents) {
            try {
              await mobileEvents.updateNotificationStatus(d.notificationId!, 'ACKNOWLEDGED');
            } catch (error) {
              logger.error('Failed to update notification acknowledgment:', error);
            }
          }
        })();
      })
    );

    // Handle disconnect — intentionally do NOT cleanup the rate
    // limiter here. The whole point of the per-user keying is that
    // disconnect+reconnect cannot reset the counters; the periodic
    // sweeper drops expired entries after their window elapses.
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
