export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type HealthLevel = 'basic' | 'ready' | 'full';

export interface ServiceHealth {
  status: HealthStatus;
  latency_ms?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthResponse {
  status: HealthStatus;
  level: HealthLevel;
  timestamp: string;
  uptime_seconds: number;
  version: string;
  environment: string;
  checked_in_ms: number;
  services?: Record<string, ServiceHealth>;
}
