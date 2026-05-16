import { io, Socket } from 'socket.io-client';

type PermissionUpdatedPayload = {
  type?: string;
  userId?: string;
  timestamp?: string;
};

type NotificationPayload = {
  id: string;
  title: string;
  message: string;
  type?: string;
  caseId?: string;
  caseNumber?: string;
  taskId?: string;
  taskNumber?: string;
  actionUrl?: string;
  actionType?: string;
  priority?: string;
  timestamp?: string;
};

// 2026-05-13: field-monitoring live-map event. BE emits this on the
// `perm:field_monitoring` room every time a new `locations` row is
// INSERTed (both ADMIN_PING and TASK sources). FE listens to drop
// polling latency from 60s to sub-second.
export type FieldMonitoringLocationUpdatedPayload = {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
  source: 'TASK' | 'ADMIN_PING';
};

class FrontendSocketService {
  private socket: Socket | null = null;
  private currentToken: string | null = null;

  private getSocketUrl(): string {
    const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (!apiBase) {
      return window.location.origin;
    }
    try {
      const parsed = new URL(apiBase);
      return parsed.origin;
    } catch {
      return window.location.origin;
    }
  }

  connect(token: string): Socket {
    if (this.socket && this.currentToken === token && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentToken = token;
    this.socket = io(this.getSocketUrl(), {
      transports: ['websocket'],
      autoConnect: true,
      withCredentials: true,
      auth: { token },
      // Enterprise reconnection: aggressive retry for unstable networks
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentToken = null;
  }

  onPermissionsUpdated(handler: (payload: PermissionUpdatedPayload) => void): (() => void) | null {
    if (!this.socket) {
      return null;
    }
    this.socket.on('permissions_updated', handler);
    return () => {
      this.socket?.off('permissions_updated', handler);
    };
  }

  onNotification(handler: (payload: NotificationPayload) => void): (() => void) | null {
    if (!this.socket) {
      return null;
    }
    this.socket.on('notification', handler);
    return () => {
      this.socket?.off('notification', handler);
    };
  }

  /**
   * NM-4 (2026-05-16): subscribe to BE `case:updated` events emitted to
   * `case:{caseId}` room on assign / revisit / revoke. Used to invalidate
   * React Query caches so a second admin tab refreshes immediately
   * instead of waiting on polling tick.
   */
  onCaseUpdated(
    handler: (payload: { caseId: string; type?: string; [k: string]: unknown }) => void
  ): (() => void) | null {
    if (!this.socket) {
      return null;
    }
    this.socket.on('case:updated', handler);
    return () => {
      this.socket?.off('case:updated', handler);
    };
  }

  onFieldMonitoringLocationUpdated(
    handler: (payload: FieldMonitoringLocationUpdatedPayload) => void
  ): (() => void) | null {
    if (!this.socket) {
      return null;
    }
    this.socket.on('field-monitoring:location-updated', handler);
    return () => {
      this.socket?.off('field-monitoring:location-updated', handler);
    };
  }
}

export const frontendSocketService = new FrontendSocketService();
