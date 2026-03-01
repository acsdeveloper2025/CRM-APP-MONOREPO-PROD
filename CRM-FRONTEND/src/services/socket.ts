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

class FrontendSocketService {
  private socket: Socket | null = null;
  private currentToken: string | null = null;

  private getSocketUrl(): string {
    const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (!apiBase) {return window.location.origin;}
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
    if (!this.socket) {return null;}
    this.socket.on('permissions_updated', handler);
    return () => {
      this.socket?.off('permissions_updated', handler);
    };
  }

  onNotification(handler: (payload: NotificationPayload) => void): (() => void) | null {
    if (!this.socket) {return null;}
    this.socket.on('notification', handler);
    return () => {
      this.socket?.off('notification', handler);
    };
  }
}

export const frontendSocketService = new FrontendSocketService();
