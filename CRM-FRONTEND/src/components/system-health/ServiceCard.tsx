import { useState } from 'react';
import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusPill } from './StatusPill';
import type { ServiceHealth } from '@/types/health';

interface KeyMetric {
  label: string;
  value: string;
}

interface Props {
  title: string;
  icon: LucideIcon;
  service: ServiceHealth | undefined;
  /** Pre-extracted, headline metrics shown on the card face. */
  metrics?: KeyMetric[];
}

export function ServiceCard({ title, icon: Icon, service, metrics }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!service) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {title}
            </span>
            <span className="text-xs text-muted-foreground">No data</span>
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </span>
          <StatusPill status={service.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3 pt-0">
        {service.message ? <p className="text-xs text-destructive">{service.message}</p> : null}
        {metrics && metrics.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {metrics.map((m) => (
              <div key={m.label} className="contents">
                <dt className="text-muted-foreground">{m.label}</dt>
                <dd className="text-right font-mono tabular-nums">{m.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronUp className="mr-1 h-3 w-3" />
          ) : (
            <ChevronDown className="mr-1 h-3 w-3" />
          )}
          {expanded ? 'Hide details' : 'Show details'}
        </Button>

        {expanded ? (
          <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-[11px] leading-snug">
            {JSON.stringify(service, null, 2)}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}
