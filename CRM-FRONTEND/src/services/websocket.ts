import { io, Socket } from 'socket.io-client';
import { authService } from './auth';
import type {
  WebSocketConfig,
  WebSocketState,
  WebSocketEventHandlers,
  WebSocketEventType,
  SubscriptionOptions,
  ConnectionStatus,
} from '@/types/websocket';

class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private state: WebSocketState;
  private eventHandlers: WebSocketEventHandlers = {};
  private subscriptions: Set<string> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private latency: number = 0;

  constructor() {
    // Explicitly force the correct WebSocket URL to avoid any caching issues
    const wsUrl = 'ws://localhost:3000';

    this.config = {
      url: wsUrl,
      autoConnect: true,
      reconnectAttempts: 5,
      reconnectDelay: 3000,
    };

    this.state = {
      isConnected: false,
      isConnecting: false,
      error: null,
      lastConnected: null,
      reconnectAttempts: 0,
    };
  }

  // Connection management
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      const token = authService.getToken();
      if (!token) {
        reject(new Error('No authentication token available'));
        return;
      }

      this.state.isConnecting = true;
      this.state.error = null;

      this.socket = io(this.config.url, {
        auth: {
          token,
          platform: 'web',
        },
        transports: ['websocket'],
        timeout: 10000,
      });

      this.setupEventListeners();

      this.socket.on('connect', () => {
        this.state.isConnected = true;
        this.state.isConnecting = false;
        this.state.lastConnected = new Date();
        this.state.reconnectAttempts = 0;
        this.startPingInterval();
        this.eventHandlers.onConnected?.({
          message: 'Connected to WebSocket server',
          userId: authService.getCurrentUser()?.id || '',
          timestamp: new Date().toISOString(),
        });
        resolve();
      });

      this.socket.on('connect_error' as any, (error: any) => {
        this.state.isConnecting = false;
        this.state.error = error.message;
        this.eventHandlers.onError?.(error.message);
        
        if (this.state.reconnectAttempts < this.config.reconnectAttempts) {
          this.scheduleReconnect();
        } else {
          reject(error);
        }
      });
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.subscriptions.clear();
  }

  // Event handling
  on<T = any>(event: WebSocketEventType, handler: (data: T) => void): void {
    if (!this.socket) return;
    this.socket.on(event, handler);
  }

  off(event: WebSocketEventType, handler?: (...args: any[]) => void): void {
    if (!this.socket) return;
    if (handler) {
      this.socket.off(event, handler);
    } else {
      this.socket.off(event);
    }
  }

  emit(event: string, data?: any): void {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, cannot emit event:', event);
      return;
    }
    this.socket.emit(event, data);
  }

  // Subscription management
  subscribeToCase(caseId: string): void {
    if (!this.socket?.connected) return;
    
    const subscription = `case:${caseId}`;
    if (!this.subscriptions.has(subscription)) {
      this.socket.emit('subscribe:case', caseId);
      this.subscriptions.add(subscription);
    }
  }

  unsubscribeFromCase(caseId: string): void {
    if (!this.socket?.connected) return;
    
    const subscription = `case:${caseId}`;
    if (this.subscriptions.has(subscription)) {
      this.socket.emit('unsubscribe:case', caseId);
      this.subscriptions.delete(subscription);
    }
  }

  // Case-specific events
  updateCaseStatus(caseId: string, status: string): void {
    this.emit('case:status', { caseId, status });
  }

  sendTypingIndicator(caseId: string, isTyping: boolean): void {
    this.emit('case:typing', { caseId, isTyping });
  }

  updateLocation(caseId: string, latitude: number, longitude: number): void {
    this.emit('location:update', { caseId, latitude, longitude });
  }

  // Event handlers registration
  setEventHandlers(handlers: WebSocketEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  // Connection status
  getConnectionStatus(): ConnectionStatus {
    return {
      status: this.state.isConnected ? 'connected' : 
              this.state.isConnecting ? 'connecting' : 
              this.state.error ? 'error' : 'disconnected',
      latency: this.latency,
      lastPing: this.state.lastConnected || undefined,
      reconnectAttempts: this.state.reconnectAttempts,
      error: this.state.error || undefined,
    };
  }

  // State getters
  get isConnected(): boolean {
    return this.state.isConnected;
  }

  get isConnecting(): boolean {
    return this.state.isConnecting;
  }

  get error(): string | null {
    return this.state.error;
  }

  // Private methods
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      this.state.isConnected = false;
      this.stopPingInterval();
      this.eventHandlers.onDisconnected?.(reason);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.scheduleReconnect();
      }
    });

    // Case events
    if (this.eventHandlers.onCaseUpdated) {
      this.socket.on('case:updated', this.eventHandlers.onCaseUpdated);
    }
    if (this.eventHandlers.onCaseStatusUpdated) {
      this.socket.on('case:status:updated', this.eventHandlers.onCaseStatusUpdated);
    }
    if (this.eventHandlers.onCaseTypingUpdate) {
      this.socket.on('case:typing:update', this.eventHandlers.onCaseTypingUpdate);
    }
    if (this.eventHandlers.onLocationUpdated) {
      this.socket.on('location:updated', this.eventHandlers.onLocationUpdated);
    }

    // Notification events
    if (this.eventHandlers.onNotification) {
      this.socket.on('notification', this.eventHandlers.onNotification);
    }
    if (this.eventHandlers.onBroadcast) {
      this.socket.on('broadcast', this.eventHandlers.onBroadcast);
    }

    // User activity events
    if (this.eventHandlers.onUserActivity) {
      this.socket.on('user:activity', this.eventHandlers.onUserActivity);
    }

    // Mobile events
    if (this.eventHandlers.onMobileLocationUpdate) {
      this.socket.on('mobile:location:update', this.eventHandlers.onMobileLocationUpdate);
    }
    if (this.eventHandlers.onMobileFormProgress) {
      this.socket.on('mobile:form:progress', this.eventHandlers.onMobileFormProgress);
    }
    if (this.eventHandlers.onMobilePhotoUpdate) {
      this.socket.on('mobile:photo:update', this.eventHandlers.onMobilePhotoUpdate);
    }

    // Ping/pong for latency measurement
    this.socket.on('pong', (startTime: number) => {
      this.latency = Date.now() - startTime;
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.state.reconnectAttempts++;
    const delay = this.config.reconnectDelay * Math.pow(2, this.state.reconnectAttempts - 1);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        // Reconnection failed, will try again if attempts remaining
      });
    }, delay);
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping', Date.now());
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const webSocketService = new WebSocketService();
