/**
 * WebSocket Service for Mobile App
 * Handles real-time communication with the backend
 */

import { io, Socket } from 'socket.io-client';

export interface WebSocketConfig {
  url: string;
  autoConnect: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

export interface CaseUpdate {
  caseId: string;
  status: string;
  updatedBy: string;
  timestamp: string;
  metadata?: any;
}

class WebSocketService {
  private static instance: WebSocketService;
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private state: WebSocketState;
  private listeners: Map<string, Array<(data: any) => void>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = this.getWebSocketConfig();
    this.state = {
      isConnected: false,
      isConnecting: false,
      error: null,
      lastConnected: null,
      reconnectAttempts: 0,
    };
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Get WebSocket URL based on environment configuration
   */
  private getWebSocketConfig(): WebSocketConfig {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    let wsUrl: string;

    // Priority order for WebSocket URL selection:
    // 1. Use Static IP WebSocket URL if available (PRIMARY for internet access)
    if (import.meta.env.VITE_WS_URL) {
      wsUrl = import.meta.env.VITE_WS_URL;
      console.log('🔌 Using Static IP WebSocket URL:', wsUrl);
    }
    // 2. Use network WebSocket URL if not on localhost (local network access)
    else if (!isLocalhost && import.meta.env.VITE_WS_URL_NETWORK) {
      wsUrl = import.meta.env.VITE_WS_URL_NETWORK;
      console.log('🔌 Using Network WebSocket URL:', wsUrl);
    }
    // 3. Use localhost WebSocket URL for local development
    else {
      wsUrl = 'ws://localhost:3000';
      console.log('🔌 Using Localhost WebSocket URL:', wsUrl);
    }

    return {
      url: wsUrl,
      autoConnect: true,
      reconnectAttempts: 5,
      reconnectDelay: 3000,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.socket?.connected || this.state.isConnecting) {
      console.log('🔌 WebSocket already connected or connecting');
      return;
    }

    this.state.isConnecting = true;
    this.state.error = null;

    console.log('🔌 Connecting to WebSocket:', this.config.url);

    this.socket = io(this.config.url, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: this.config.reconnectAttempts,
      reconnectionDelay: this.config.reconnectDelay,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.error = null;
      this.state.lastConnected = new Date();
      this.state.reconnectAttempts = 0;
      
      this.notifyListeners('connected', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.state.isConnected = false;
      this.state.isConnecting = false;
      this.state.error = reason;
      
      this.notifyListeners('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.state.isConnecting = false;
      this.state.error = error.message;
      this.state.reconnectAttempts++;
      
      this.notifyListeners('error', { error: error.message });
    });

    // Case-specific events
    this.socket.on('case:updated', (data: CaseUpdate) => {
      console.log('📱 Case updated via WebSocket:', data);
      this.notifyListeners('case:updated', data);
    });

    this.socket.on('case:assigned', (data: any) => {
      console.log('📱 Case assigned via WebSocket:', data);
      this.notifyListeners('case:assigned', data);
    });

    this.socket.on('case:status_changed', (data: any) => {
      console.log('📱 Case status changed via WebSocket:', data);
      this.notifyListeners('case:status_changed', data);
    });

    // System events
    this.socket.on('system:notification', (data: any) => {
      console.log('🔔 System notification via WebSocket:', data);
      this.notifyListeners('system:notification', data);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket');
      this.socket.disconnect();
      this.socket = null;
    }

    this.state.isConnected = false;
    this.state.isConnecting = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe from WebSocket events
   */
  off(event: string, callback: (data: any) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to server
   */
  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('🔌 Cannot emit event - WebSocket not connected');
    }
  }

  /**
   * Notify all listeners for an event
   */
  private notifyListeners(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket event listener:', error);
        }
      });
    }
  }

  /**
   * Get current WebSocket state
   */
  getState(): WebSocketState {
    return { ...this.state };
  }

  /**
   * Get WebSocket configuration
   */
  getConfig(): WebSocketConfig {
    return { ...this.config };
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.state.isConnected;
  }

  /**
   * Join a room (for case-specific updates)
   */
  joinRoom(roomId: string): void {
    this.emit('join', { room: roomId });
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string): void {
    this.emit('leave', { room: roomId });
  }
}

// Export singleton instance
export const websocketService = WebSocketService.getInstance();
export default websocketService;
