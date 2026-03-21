import React, { useMemo, useState } from 'react';
import { Bell, RefreshCw, Search, Trash2, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Badge } from '@/ui/components/badge';
import { Checkbox } from '@/ui/components/checkbox';
import { notificationService, type AppNotification } from '@/services/notifications';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { PaginationStatusCard } from '@/components/shared/PaginationStatusCard';
import { Badge as UiBadge } from '@/ui/components/Badge';
import { Card as UiCard } from '@/ui/components/Card';
import { Button as UiButton } from '@/ui/components/Button';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

const PAGE_SIZE = 20;

export function NotificationHistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'read' | 'unread'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const notificationsQuery = useQuery({
    queryKey: ['notifications-history'],
    queryFn: () => notificationService.list({ limit: 100, offset: 0 }),
    refetchInterval: 60000,
    staleTime: 15000,
  });

  const markNotificationReadInCache = (notificationId: string) => {
    queryClient.setQueriesData<
      | {
          items: AppNotification[];
          unreadCount: number;
          pagination: {
            total: number;
            limit: number;
            offset: number;
            hasMore: boolean;
          };
        }
      | undefined
    >({ queryKey: ['notifications'] }, (current) => {
      if (!current) {
        return current;
      }

      let changed = false;
      const items = current.items.map((notification) => {
        if (notification.id !== notificationId || notification.isRead) {
          return notification;
        }

        changed = true;
        return {
          ...notification,
          isRead: true,
          readAt: new Date().toISOString(),
        };
      });

      if (!changed) {
        return current;
      }

      return {
        ...current,
        items,
        unreadCount: Math.max(0, current.unreadCount - 1),
      };
    });

    queryClient.setQueryData<
      | {
          items: AppNotification[];
          unreadCount: number;
          pagination: {
            total: number;
            limit: number;
            offset: number;
            hasMore: boolean;
          };
        }
      | undefined
    >(['notifications-history'], (current) => {
      if (!current) {
        return current;
      }

      let changed = false;
      const items = current.items.map((notification) => {
        if (notification.id !== notificationId || notification.isRead) {
          return notification;
        }

        changed = true;
        return {
          ...notification,
          isRead: true,
          readAt: new Date().toISOString(),
        };
      });

      if (!changed) {
        return current;
      }

      return {
        ...current,
        items,
        unreadCount: Math.max(0, current.unreadCount - 1),
      };
    });
  };

  const refreshLists = async () => {
    setSelectedIds(new Set());
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications-history'] }),
    ]);
  };

  const markReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => notificationService.markRead(id)));
    },
    onSuccess: async () => {
      await refreshLists();
      toast.success('Notifications marked as read');
    },
    onError: () => {
      toast.error('Failed to update notifications');
    },
  });

  const markUnreadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => notificationService.markUnread(id)));
    },
    onSuccess: async () => {
      await refreshLists();
      toast.success('Notifications marked as unread');
    },
    onError: () => {
      toast.error('Failed to update notifications');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => notificationService.remove(id)));
    },
    onSuccess: async () => {
      await refreshLists();
      toast.success('Notifications deleted');
    },
    onError: () => {
      toast.error('Failed to delete notifications');
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: async () => {
      await refreshLists();
      toast.success('All notifications marked as read');
    },
    onError: () => {
      toast.error('Failed to mark all as read');
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: () => notificationService.clearAll(),
    onSuccess: async () => {
      await refreshLists();
      toast.success('All notifications cleared');
    },
    onError: () => {
      toast.error('Failed to clear notifications');
    },
  });

  const filteredNotifications = useMemo(() => {
    const items = notificationsQuery.data?.items || [];
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = items.filter((notification) => {
      const matchesSearch =
        !normalizedSearch ||
        notification.title.toLowerCase().includes(normalizedSearch) ||
        notification.message.toLowerCase().includes(normalizedSearch) ||
        notification.caseNumber?.toLowerCase().includes(normalizedSearch) ||
        notification.taskNumber?.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'read' && notification.isRead) ||
        (filterStatus === 'unread' && !notification.isRead);

      return matchesSearch && matchesStatus;
    });

    return filtered;
  }, [filterStatus, notificationsQuery.data?.items, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedNotifications = filteredNotifications.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleOpenNotification = async (notification: AppNotification) => {
    try {
      if (!notification.isRead) {
        await notificationService.markRead(notification.id);
        markNotificationReadInCache(notification.id);
      }

      const target = await notificationService.validateNavigationTarget(notification);

      if (!target) {
        toast.error('No longer available');
        await refreshLists();
        return;
      }

      await refreshLists();
      navigate(target);
    } catch {
      toast.error('No longer available');
      await refreshLists();
    }
  };

  const toggleSelected = (notificationId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(notificationId)) {
        next.delete(notificationId);
      } else {
        next.add(notificationId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pagedNotifications.length) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(pagedNotifications.map(notification => notification.id)));
  };

  const isBusy =
    notificationsQuery.isFetching ||
    markReadMutation.isPending ||
    markUnreadMutation.isPending ||
    deleteMutation.isPending ||
    markAllReadMutation.isPending ||
    clearAllMutation.isPending;

  const notificationItems = notificationsQuery.data?.items || [];
  const unreadCount = notificationsQuery.data?.unreadCount || 0;

  return (
    <Page
      title="Notifications"
      subtitle="Unified inbox backed by the CRM notification service."
      shell
      actions={
        <Stack direction="horizontal" gap={2} wrap="wrap">
          <UiButton variant="secondary" icon={<RefreshCw size={16} />} onClick={() => void notificationsQuery.refetch()} disabled={isBusy}>
            Refresh
          </UiButton>
          <UiButton variant="secondary" icon={<Eye size={16} />} onClick={() => void markAllReadMutation.mutateAsync()} disabled={isBusy}>
            Mark all read
          </UiButton>
          <UiButton variant="danger" icon={<Trash2 size={16} />} onClick={() => void clearAllMutation.mutateAsync()} disabled={isBusy}>
            Clear all
          </UiButton>
        </Stack>
      }
    >
      <Section>
        <MetricCardGrid
          items={[
            { title: 'Total Notifications', value: notificationItems.length, detail: 'Messages in inbox', icon: Bell, tone: 'accent' },
            { title: 'Unread', value: unreadCount, detail: 'Need attention', icon: Eye, tone: 'warning' },
            { title: 'Selected', value: selectedIds.size, detail: 'Current page selection', icon: EyeOff, tone: 'neutral' },
            { title: 'Filtered Results', value: filteredNotifications.length, detail: 'Matching current filters', icon: Search, tone: 'positive' },
          ]}
          min={220}
        />
      </Section>

      <Section>
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
            <Input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              placeholder="Search title, message, case, task..."
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              onClick={() => {
                setFilterStatus('all');
                setPage(1);
              }}
            >
              All
            </Button>
            <Button
              variant={filterStatus === 'unread' ? 'default' : 'outline'}
              onClick={() => {
                setFilterStatus('unread');
                setPage(1);
              }}
            >
              Unread
            </Button>
            <Button
              variant={filterStatus === 'read' ? 'default' : 'outline'}
              onClick={() => {
                setFilterStatus('read');
                setPage(1);
              }}
            >
              Read
            </Button>
          </div>
          <div className="flex items-center justify-end gap-2 text-sm text-gray-600">
            <Bell className="h-4 w-4" />
            <span>{notificationsQuery.data?.unreadCount || 0} unread</span>
          </div>
        </CardContent>
      </Card>
      </Section>

      {selectedIds.size > 0 && (
        <Section>
        <UiCard tone="strong">
          <Stack direction="horizontal" justify="space-between" align="center" gap={3} wrap="wrap">
            <Text variant="body-sm" tone="muted">{selectedIds.size} selected</Text>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void markReadMutation.mutateAsync(Array.from(selectedIds))}
              >
                <Eye className="mr-2 h-4 w-4" />
                Mark Read
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void markUnreadMutation.mutateAsync(Array.from(selectedIds))}
              >
                <EyeOff className="mr-2 h-4 w-4" />
                Mark Unread
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void deleteMutation.mutateAsync(Array.from(selectedIds))}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </Stack>
        </UiCard>
        </Section>
      )}

      <Section>
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationsQuery.isLoading ? (
            <div className="py-10 text-center text-gray-600">Loading notifications...</div>
          ) : pagedNotifications.length === 0 ? (
            <div className="py-10 text-center text-gray-600">No notifications found.</div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-2">
                <Checkbox
                  checked={pagedNotifications.length > 0 && selectedIds.size === pagedNotifications.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-gray-600">Select page</span>
              </div>
              <div className="space-y-3">
                {pagedNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void handleOpenNotification(notification)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      notification.isRead
                        ? 'border-gray-200 bg-white'
                        : 'border-green-200 bg-green-50'
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedIds.has(notification.id)}
                          onCheckedChange={() => toggleSelected(notification.id)}
                          onClick={(event) => event.stopPropagation()}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{notification.title}</span>
                            <Badge variant={notification.isRead ? 'outline' : 'default'}>
                              {notification.isRead ? 'Read' : 'Unread'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{notification.priority}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      {notification.caseNumber && <span>Case: {notification.caseNumber}</span>}
                      {notification.taskNumber && <span>Task: {notification.taskNumber}</span>}
                      <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                      {notification.deliveryStatus && <span>{notification.deliveryStatus}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

        </CardContent>
      </Card>
      </Section>

      <Section>
        <PaginationStatusCard
          page={currentPage}
          limit={PAGE_SIZE}
          total={filteredNotifications.length}
          totalPages={totalPages}
          onPrevious={() => setPage(previous => Math.max(1, previous - 1))}
          onNext={() => setPage(previous => Math.min(totalPages, previous + 1))}
        />
      </Section>
    </Page>
  );
}
