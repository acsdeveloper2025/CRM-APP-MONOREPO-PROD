import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { apiService } from '@/services/api';

interface AuditLogRow {
  id: string | number;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
}

interface AuditLogResponse {
  data: AuditLogRow[];
  pagination?: { page: number; limit: number; total: number };
}

interface Props {
  userId: string;
}

const PAGE_SIZE = 25;

const formatWhen = (iso: string): string => {
  try {
    return format(new Date(iso), 'dd MMM yyyy, HH:mm:ss');
  } catch {
    return iso;
  }
};

// Soft-categorise actions into a tone badge.
const actionTone = (action: string): 'default' | 'destructive' | 'secondary' => {
  if (action.includes('DELETE') || action.includes('REVOKE') || action.includes('ERASE')) {
    return 'destructive';
  }
  if (action.includes('LOGIN') || action.includes('LOGOUT') || action.includes('VIEW')) {
    return 'secondary';
  }
  return 'default';
};

export function MyActivityTab({ userId }: Props) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-audit-log', userId, page],
    queryFn: async () => {
      const res = await apiService.get<AuditLogResponse>(
        `/users/${userId}/audit-log?page=${page}&limit=${PAGE_SIZE}`
      );
      // BE shapes the body as { success, data, pagination, meta } directly on the response.
      // apiService.get unwraps `data` from { success, data }; here `data` IS the array body shape.
      // So we cast to the runtime shape we actually get.
      const body = res as unknown as {
        data?: AuditLogRow[];
        pagination?: AuditLogResponse['pagination'];
      };
      return {
        rows: Array.isArray(body.data) ? body.data : [],
        pagination: body.pagination ?? { page, limit: PAGE_SIZE, total: 0 },
      };
    },
    placeholderData: (previous) => previous,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Actions you&apos;ve taken and changes made to your account. Most recent first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <TableSkeleton headers={['Action', 'Target', 'When', 'IP']} count={6} />}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-destructive">Failed to load your activity.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <>
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={String(row.id)} className="py-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={actionTone(row.action)} className="case-sensitive">
                          {row.action}
                        </Badge>
                        {row.entity_type && (
                          <span className="text-xs text-muted-foreground case-sensitive">
                            {row.entity_type}
                            {row.entity_id ? ` #${row.entity_id}` : ''}
                          </span>
                        )}
                      </div>
                      {row.details && Object.keys(row.details).length > 0 && (
                        <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-xs text-muted-foreground case-sensitive">
                          {JSON.stringify(row.details, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground sm:min-w-[180px]">
                      <span>{formatWhen(row.created_at)}</span>
                      {row.ip_address && <span className="case-sensitive">{row.ip_address}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} total entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
