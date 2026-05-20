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
  containers: {
    // Docker stats?stream=false samples for ~1s per container; 6 containers
    // in parallel still totals ~1.2s + http overhead. Cache below makes
    // this slow path hit only once per 10s window.
    probe_timeout_ms: 3000,
    cache_ttl_ms: 10_000,
    socket_proxy_host: process.env.DOCKER_SOCKET_PROXY_HOST || 'docker-socket-proxy',
    socket_proxy_port: Number(process.env.DOCKER_SOCKET_PROXY_PORT) || 2375,
    // One-shot containers that are EXPECTED to exit (e.g. migrations) —
    // excluded from the response AND from the degraded-rollup.
    ignore_name_patterns: ['migrate'] as ReadonlyArray<string>,
  },
} as const;
