import { Activity, Database, HardDrive, Layers, RefreshCw, Server, Boxes, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/system-health/StatusPill';
import { ServiceCard } from '@/components/system-health/ServiceCard';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import type { ServiceHealth } from '@/types/health';

function pickNumber(svc: ServiceHealth | undefined, path: string[]): string | undefined {
  if (!svc) {
    return undefined;
  }
  let cursor: unknown = svc.details;
  for (const seg of path) {
    if (cursor && typeof cursor === 'object' && seg in cursor) {
      cursor = (cursor as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  if (typeof cursor === 'number') {
    return String(cursor);
  }
  if (typeof cursor === 'string') {
    return cursor;
  }
  return undefined;
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) {
    return `${d}d ${h}h`;
  }
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

export function SystemHealthPage() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useSystemHealth();

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl space-y-4 p-4">
        <h1 className="text-2xl font-semibold">System Health</h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (isError || !data) {
    const message = error instanceof Error ? error.message : 'Failed to load system health';
    return (
      <div className="container mx-auto max-w-7xl space-y-4 p-4">
        <h1 className="text-2xl font-semibold">System Health</h1>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{message}</p>
            <Button className="mt-3" onClick={() => void refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const services = data.services ?? {};
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>System Health</span>
            <div className="flex items-center gap-3 text-sm font-normal">
              <StatusPill status={data.status} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 pb-3 pt-0 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Version</dt>
            <dd className="font-mono">{data.version}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Environment</dt>
            <dd className="font-mono">{data.environment}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Uptime</dt>
            <dd className="font-mono">{fmtUptime(data.uptime_seconds)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last checked</dt>
            <dd className="font-mono">{lastUpdated}</dd>
          </div>
        </CardContent>
      </Card>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ServiceCard
          title="API"
          icon={Activity}
          service={services.api}
          metrics={[
            { label: 'Heap', value: `${pickNumber(services.api, ['heap_pct']) ?? '—'}%` },
            { label: 'Heap MB', value: pickNumber(services.api, ['heap_used_mb']) ?? '—' },
            {
              label: 'Event loop max',
              value: `${pickNumber(services.api, ['event_loop_max_ms']) ?? '—'} ms`,
            },
            { label: 'RSS MB', value: pickNumber(services.api, ['rss_mb']) ?? '—' },
          ]}
        />

        <ServiceCard
          title="Database"
          icon={Database}
          service={services.database}
          metrics={[
            { label: 'Latency', value: `${services.database?.latency_ms ?? '—'} ms` },
            { label: 'Pool total', value: pickNumber(services.database, ['pool', 'total']) ?? '—' },
            { label: 'Pool idle', value: pickNumber(services.database, ['pool', 'idle']) ?? '—' },
            {
              label: 'Waiting',
              value: pickNumber(services.database, ['pool', 'waiting']) ?? '—',
            },
          ]}
        />

        <ServiceCard
          title="Redis"
          icon={Server}
          service={services.redis}
          metrics={[
            { label: 'Latency', value: `${services.redis?.latency_ms ?? '—'} ms` },
            { label: 'Memory', value: pickNumber(services.redis, ['used_memory_human']) ?? '—' },
            {
              label: 'Clients',
              value: pickNumber(services.redis, ['connected_clients']) ?? '—',
            },
          ]}
        />

        <ServiceCard
          title="Worker"
          icon={Cpu}
          service={services.worker}
          metrics={[
            {
              label: 'Heartbeat age',
              value: `${pickNumber(services.worker, ['heartbeat_age_s']) ?? '—'} s`,
            },
          ]}
        />

        <ServiceCard
          title="Queues"
          icon={Layers}
          service={services.queues}
          metrics={[
            {
              label: 'Audit waiting',
              value: pickNumber(services.queues, ['auditLog', 'waiting']) ?? '—',
            },
            {
              label: 'Notif waiting',
              value: pickNumber(services.queues, ['notification', 'waiting']) ?? '—',
            },
            {
              label: 'Geo waiting',
              value: pickNumber(services.queues, ['reverseGeocode', 'waiting']) ?? '—',
            },
            {
              label: 'Audit failed',
              value: pickNumber(services.queues, ['auditLog', 'failed']) ?? '—',
            },
          ]}
        />

        <ServiceCard
          title="Storage"
          icon={HardDrive}
          service={services.storage}
          metrics={[
            { label: 'Backend', value: pickNumber(services.storage, ['backend']) ?? '—' },
            { label: 'Free %', value: `${pickNumber(services.storage, ['free_pct']) ?? '—'}%` },
          ]}
        />

        <ServiceCard
          title="Containers"
          icon={Boxes}
          service={services.containers}
          metrics={(() => {
            const list = services.containers?.details?.containers as
              | Array<{ name: string; state: string; cpu_pct: number; mem_mb: number }>
              | undefined;
            if (!list) {
              return [];
            }
            return list.map((c) => ({
              label: c.name,
              value: `${c.cpu_pct}% / ${c.mem_mb}MB`,
            }));
          })()}
        />
      </div>
    </div>
  );
}

export default SystemHealthPage;
