export const THRESHOLDS = {
  db: {
    latency_degraded_ms: 200,
    latency_unhealthy_ms: 1000,
    probe_timeout_ms: 500,
  },
  redis: {
    latency_degraded_ms: 100,
    latency_unhealthy_ms: 500,
    probe_timeout_ms: 300,
  },
  worker: {
    heartbeat_degraded_age_s: 30,
    heartbeat_unhealthy_age_s: 90,
    probe_timeout_ms: 200,
    heartbeat_redis_key: 'crm:worker:heartbeat',
    heartbeat_ttl_s: 30,
    heartbeat_write_interval_ms: 10_000,
  },
} as const;
