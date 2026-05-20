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
  api: {
    heap_pct_degraded: 80,
    heap_pct_unhealthy: 95,
    event_loop_max_ms_degraded: 50,
    event_loop_max_ms_unhealthy: 200,
    histogram_resolution_ms: 20,
  },
  queues: {
    waiting_degraded: 100,
    waiting_unhealthy: 1000,
    failed_degraded: 10,
    failed_unhealthy: 100,
    probe_timeout_ms: 500,
  },
  storage: {
    free_pct_degraded: 20,
    free_pct_unhealthy: 10,
    probe_timeout_ms: 800,
    probe_key: 'healthcheck/_probe',
  },
} as const;
