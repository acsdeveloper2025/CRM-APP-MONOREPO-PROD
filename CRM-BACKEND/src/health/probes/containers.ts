import { THRESHOLDS } from '@/health/thresholds';
import { withTimeout } from '@/health/withTimeout';
import type { HealthStatus, ServiceHealth } from '@/health/types';

interface DockerContainerSummary {
  Id: string;
  Names: string[];
  State: string;
}

interface DockerStats {
  cpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
  };
  memory_stats?: { usage?: number };
}

export interface ContainerStat {
  name: string;
  state: string;
  cpu_pct: number;
  mem_mb: number;
}

interface Cache {
  at: number;
  data: ContainerStat[];
}

let cache: Cache | null = null;

const baseUrl = (): string =>
  `http://${THRESHOLDS.containers.socket_proxy_host}:${THRESHOLDS.containers.socket_proxy_port}`;

async function dockerGet<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`);
  if (!res.ok) {
    throw new Error(`docker proxy ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

function calcCpuPct(s: DockerStats): number {
  const cpuDelta =
    (s.cpu_stats?.cpu_usage?.total_usage ?? 0) - (s.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const sysDelta = (s.cpu_stats?.system_cpu_usage ?? 0) - (s.precpu_stats?.system_cpu_usage ?? 0);
  const onlineCpus = s.cpu_stats?.online_cpus ?? 1;
  if (sysDelta > 0 && cpuDelta > 0) {
    return Math.round((cpuDelta / sysDelta) * onlineCpus * 1000) / 10;
  }
  return 0;
}

function shouldIgnore(name: string): boolean {
  return THRESHOLDS.containers.ignore_name_patterns.some(pattern => name.includes(pattern));
}

async function fetchAll(): Promise<ContainerStat[]> {
  const list = await dockerGet<DockerContainerSummary[]>('/containers/json?all=true');
  const filtered = list.filter(c => {
    const name = (c.Names?.[0] ?? c.Id).replace(/^\//, '');
    return !shouldIgnore(name);
  });
  return Promise.all(
    filtered.map(async (c): Promise<ContainerStat> => {
      const name = (c.Names?.[0] ?? c.Id).replace(/^\//, '');
      if (c.State !== 'running') {
        return { name, state: c.State, cpu_pct: 0, mem_mb: 0 };
      }
      try {
        const s = await dockerGet<DockerStats>(`/containers/${c.Id}/stats?stream=false`);
        return {
          name,
          state: c.State,
          cpu_pct: calcCpuPct(s),
          mem_mb: Math.round(((s.memory_stats?.usage ?? 0) / 1024 / 1024) * 10) / 10,
        };
      } catch {
        return { name, state: c.State, cpu_pct: 0, mem_mb: 0 };
      }
    })
  );
}

function rollupContainers(data: ContainerStat[]): HealthStatus {
  if (data.length === 0) {
    return 'unhealthy';
  }
  const anyDown = data.some(c => c.state !== 'running');
  return anyDown ? 'degraded' : 'healthy';
}

export async function probeContainers(): Promise<ServiceHealth> {
  if (cache && Date.now() - cache.at < THRESHOLDS.containers.cache_ttl_ms) {
    return {
      status: rollupContainers(cache.data),
      details: { source: 'cache', containers: cache.data },
    };
  }
  try {
    const data = await withTimeout('containers', THRESHOLDS.containers.probe_timeout_ms, fetchAll);
    cache = { at: Date.now(), data };
    return {
      status: rollupContainers(data),
      details: { source: 'fresh', containers: data },
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      message: err instanceof Error ? err.message : 'docker-socket-proxy unreachable',
    };
  }
}
