export interface WebSocketConfig {
  url: string;
  autoConnect: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

// Case-related events
export interface CaseStatusUpdate {
  caseId: string;
  status: string;
  updatedBy: string;
  timestamp: string;
}

export interface CaseUpdate {
  caseId: string;
  data: any;
  timestamp: string;
}

export interface CaseTypingUpdate {
  caseId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface LocationUpdate {
  caseId: string;
  userId: string;
  username: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

// Notification events
export interface NotificationEvent {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  read?: boolean;
}

// User activity events
export interface UserActivityEvent {
  userId: string;
  username: string;
  action: string;
  description: string;
  timestamp: string;
}

// System events
export interface SystemBroadcast {
  type: 'maintenance' | 'announcement' | 'alert';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
}

// Mobile-specific events
export interface MobileLocationUpdate {
  caseId: string;
  userId: string;
  username: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
  };
}

export interface MobileFormProgress {
  caseId: string;
  userId: string;
  username: string;
  formType: string;
  progress: number;
  timestamp: string;
}

export interface MobilePhotoUpdate {
  caseId: string;
  userId: string;
  username: string;
  photoCount: number;
  hasGeoLocation: boolean;
  timestamp: string;
}

// WebSocket event types
export type WebSocketEventType =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'case:updated'
  | 'case:status:updated'
  | 'case:typing:update'
  | 'location:updated'
  | 'notification'
  | 'broadcast'
  | 'user:activity'
  | 'mobile:location:update'
  | 'mobile:form:progress'
  | 'mobile:photo:update'
  | 'mobile:sync:start'
  | 'mobile:sync:trigger'
  | 'stats:update';

// WebSocket event handlers
export interface WebSocketEventHandlers {
  onConnected?: (data: { message: string; userId: string; timestamp: string }) => void;
  onDisconnected?: (reason: string) => void;
  onError?: (error: string) => void;
  onCaseUpdated?: (data: CaseUpdate) => void;
  onCaseStatusUpdated?: (data: CaseStatusUpdate) => void;
  onCaseTypingUpdate?: (data: CaseTypingUpdate) => void;
  onLocationUpdated?: (data: LocationUpdate) => void;
  onNotification?: (data: NotificationEvent) => void;
  onBroadcast?: (data: SystemBroadcast) => void;
  onUserActivity?: (data: UserActivityEvent) => void;
  onMobileLocationUpdate?: (data: MobileLocationUpdate) => void;
  onMobileFormProgress?: (data: MobileFormProgress) => void;
  onMobilePhotoUpdate?: (data: MobilePhotoUpdate) => void;
}

// WebSocket subscription options
export interface SubscriptionOptions {
  caseId?: string;
  userId?: string;
  autoUnsubscribe?: boolean;
}

// Real-time statistics
export interface RealTimeStats {
  connectedUsers: number;
  activeCases: number;
  pendingReviews: number;
  systemLoad: number;
  lastUpdated: string;
}

// Connection status
export interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  latency?: number;
  lastPing?: Date;
  reconnectAttempts?: number;
  error?: string;
}
