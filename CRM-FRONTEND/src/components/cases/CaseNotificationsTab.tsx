import React, { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Check, Trash2, Eye, EyeOff, VolumeX, Volume2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { notificationService, type CaseNotificationTimelineRow } from '@/services/notifications';
import { toast } from 'sonner';
import { LoadingState } from '@/components/ui/loading';
import { frontendSocketService } from '@/services/socket';

/**
 * Phase 1.2b → 3.1 (2026-05-04) — case-scoped notification timeline.
 *
 * Phase 1.2b shipped per-recipient feed (your own slice). Phase 3.1
 * upgrades to cross-recipient timeline so case viewers see "Read by
 * [admin, manager], Pending [leader]" badges. Backend endpoint:
 * GET /api/cases/:id/notifications/timeline (auth: case.view).
 *
 * Real-time read-receipts: subscribes to the `case:<uuid>` socket
 * room on mount, listens for `notification:read` events, refetches
 * the timeline whenever someone reads a notification on this case.
 *
 * Rows are grouped by their underlying "event" (same type + taskId +
 * created_at minute-bucket) so a case-completion fanout to 3 users
 * shows once with a per-recipient read-status sub-list.
 */
interface CaseNotificationsTabProps {
  caseUuid: string;
}

const safeFormatDistanceToNow = (dateValue: string | null | undefined): string => {
  if (!dateValue) {
    return '';
  }
  try {
    return formatDistanceToNow(new Date(dateValue), { addSuffix: true });
  } catch {
    return '';
  }
};

interface GroupedEvent {
  // Synthetic key for React + grouping
  key: string;
  // Representative metadata
  type: string;
  title: string;
  message: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  taskId: string | null;
  taskNumber: string | null;
  createdAt: string;
  // All recipient rows for this event
  recipients: CaseNotificationTimelineRow[];
}

const groupTimeline = (rows: CaseNotificationTimelineRow[]): GroupedEvent[] => {
  // Bucket by (type, taskId, createdAt to-the-minute) — backend writes
  // simultaneous fan-out rows within ~ms of each other so minute
  // resolution is safe.
  const buckets = new Map<string, GroupedEvent>();
  for (const row of rows) {
    const minute = row.createdAt.slice(0, 16); // 'YYYY-MM-DDTHH:MM'
    const key = `${row.type}::${row.taskId || ''}::${minute}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        type: row.type,
        title: row.title,
        message: row.message,
        priority: row.priority,
        taskId: row.taskId,
        taskNumber: row.taskNumber,
        createdAt: row.createdAt,
        recipients: [],
      };
      buckets.set(key, bucket);
    }
    bucket.recipients.push(row);
  }
  // Newest first; preserve insertion order within a bucket.
  return Array.from(buckets.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const CaseNotificationsTab: React.FC<CaseNotificationsTabProps> = ({ caseUuid }) => {
  const queryClient = useQueryClient();
  const enabled = Boolean(caseUuid);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', 'case-timeline', caseUuid],
    queryFn: () => notificationService.getCaseTimeline(caseUuid),
    enabled,
    staleTime: 15000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const rows: CaseNotificationTimelineRow[] = useMemo(() => {
    const raw = (data as { data?: CaseNotificationTimelineRow[] })?.data;
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const grouped = useMemo(() => groupTimeline(rows), [rows]);

  // Phase 3.2 (2026-05-04): mute state for this case. Reads from
  // GET /notifications/mutes (cached 30s). Toggling triggers a
  // refetch so the badge + button text stay in sync.
  const { data: mutesData, refetch: refetchMutes } = useQuery({
    queryKey: ['notifications', 'mutes'],
    queryFn: () => notificationService.listMutes(),
    enabled,
    staleTime: 30000,
  });
  const isMuted = useMemo(() => {
    const list = (mutesData as { data?: Array<{ caseId: string | null }> })?.data ?? [];
    return list.some((m) => m.caseId === caseUuid);
  }, [mutesData, caseUuid]);

  const handleToggleMute = async () => {
    try {
      if (isMuted) {
        await notificationService.unmuteCase(caseUuid);
        toast.success('Notifications unmuted for this case');
      } else {
        await notificationService.muteCase(caseUuid);
        toast.success('Notifications muted for this case');
      }
      await refetchMutes();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      toast.error(isMuted ? 'Failed to unmute' : 'Failed to mute');
    }
  };

  // Phase 3.1 real-time: subscribe to case room + refetch on read events.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const socket = (
      frontendSocketService as unknown as {
        socket: unknown;
      }
    ).socket as {
      emit: (ev: string, payload?: unknown) => void;
      on: (ev: string, cb: (payload: unknown) => void) => void;
      off: (ev: string, cb?: (payload: unknown) => void) => void;
    } | null;
    if (!socket) {
      return;
    }
    const handler = (payload: unknown) => {
      const data = payload as { caseId?: string };
      if (data?.caseId === caseUuid) {
        queryClient.invalidateQueries({
          queryKey: ['notifications', 'case-timeline', caseUuid],
        });
      }
    };
    socket.emit('subscribe:case', caseUuid);
    socket.on('notification:read', handler);
    return () => {
      socket.off('notification:read', handler);
      socket.emit('unsubscribe:case', caseUuid);
    };
  }, [caseUuid, enabled, queryClient]);

  const invalidateCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  // Phase 3.1: marking read marks the CURRENT user's row only. The WS
  // event then broadcasts to the room; other viewers refetch.
  const handleMarkRead = async (rowId: string) => {
    try {
      await notificationService.markRead(rowId);
      invalidateCaches();
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleDelete = async (rowId: string) => {
    try {
      await notificationService.remove(rowId);
      invalidateCaches();
      toast('Notification deleted', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await notificationService.restore(rowId);
              invalidateCaches();
              toast.success('Notification restored');
            } catch {
              toast.error('Failed to restore notification');
            }
          },
        },
      });
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading notifications..." />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <BellOff className="mx-auto h-8 w-8 mb-2" />
          <p>Could not load notifications.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
          {grouped.length > 0 && <Badge variant="secondary">{grouped.length} events</Badge>}
          {isMuted && (
            <Badge variant="outline" className="text-amber-700 border-amber-300">
              Muted
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleMute}
          title={
            isMuted ? 'Unmute notifications for this case' : 'Mute notifications for this case'
          }
        >
          {isMuted ? (
            <>
              <Volume2 className="h-4 w-4 mr-1" /> Unmute
            </>
          ) : (
            <>
              <VolumeX className="h-4 w-4 mr-1" /> Mute
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {grouped.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <BellOff className="mx-auto h-8 w-8 mb-2" />
            <p>No notifications for this case yet.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {grouped.map((event) => {
              const readCount = event.recipients.filter((r) => r.isRead).length;
              const totalCount = event.recipients.length;
              return (
                <li key={event.key} className="py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{event.title}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {event.type}
                        </Badge>
                        {event.priority && event.priority !== 'MEDIUM' && (
                          <Badge
                            variant={event.priority === 'URGENT' ? 'destructive' : 'secondary'}
                            className="text-[10px]"
                          >
                            {event.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{event.message}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span>{safeFormatDistanceToNow(event.createdAt)}</span>
                        {event.taskNumber && <span>· {event.taskNumber}</span>}
                        <span className="flex items-center gap-1">
                          ·{' '}
                          {readCount === totalCount ? (
                            <>
                              <Eye className="h-3 w-3 text-green-600" />
                              <span className="text-green-700">Read by all {totalCount}</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" />
                              <span>
                                {readCount}/{totalCount} read
                              </span>
                            </>
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                  {/* Per-recipient sub-list */}
                  <ul className="mt-2 ml-2 pl-3 border-l space-y-1">
                    {event.recipients.map((r) => (
                      <li key={r.id} className="flex items-center gap-2 text-xs">
                        <div
                          className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                            r.isRead ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="font-medium truncate">{r.recipientName}</span>
                        {r.recipientRole && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                            {r.recipientRole}
                          </Badge>
                        )}
                        {r.isRead ? (
                          <span className="text-green-700 truncate">
                            Read {safeFormatDistanceToNow(r.readAt)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                        <span className="flex-1" />
                        {!r.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => handleMarkRead(r.id)}
                            title="Mark as read (this row)"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => handleDelete(r.id)}
                          title="Delete (this row)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
