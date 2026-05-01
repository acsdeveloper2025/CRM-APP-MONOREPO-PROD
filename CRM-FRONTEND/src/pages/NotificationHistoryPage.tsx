import React, { useMemo, useState } from 'react';
import { Bell, RefreshCw, Search, Trash2, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { notificationService, type AppNotification } from '@/services/notifications';

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

  const markReadMutation = useStandardizedMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => notificationService.markRead(id)));
    },
    successMessage: 'Notifications marked as read',
    errorContext: 'Notification Mark Read',
    errorFallbackMessage: 'Failed to update notifications',
    onSuccess: () => {
      void refreshLists();
    },
  });

  const markUnreadMutation = useStandardizedMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => notificationService.markUnread(id)));
    },
    successMessage: 'Notifications marked as unread',
    errorContext: 'Notification Mark Unread',
    errorFallbackMessage: 'Failed to update notifications',
    onSuccess: () => {
      void refreshLists();
    },
  });

  const deleteMutation = useStandardizedMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => notificationService.remove(id)));
    },
    successMessage: 'Notifications deleted',
    errorContext: 'Notification Deletion',
    errorFallbackMessage: 'Failed to delete notifications',
    onSuccess: () => {
      void refreshLists();
    },
  });

  const markAllReadMutation = useStandardizedMutation({
    mutationFn: () => notificationService.markAllRead(),
    successMessage: 'All notifications marked as read',
    errorContext: 'Notification Mark All Read',
    errorFallbackMessage: 'Failed to mark all as read',
    onSuccess: () => {
      void refreshLists();
    },
  });

  const clearAllMutation = useStandardizedMutation({
    mutationFn: () => notificationService.clearAll(),
    successMessage: 'All notifications cleared',
    errorContext: 'Notification Clear All',
    errorFallbackMessage: 'Failed to clear notifications',
    onSuccess: () => {
      void refreshLists();
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

    setSelectedIds(new Set(pagedNotifications.map((notification) => notification.id)));
  };

  const isBusy =
    notificationsQuery.isFetching ||
    markReadMutation.isPending ||
    markUnreadMutation.isPending ||
    deleteMutation.isPending ||
    markAllReadMutation.isPending ||
    clearAllMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-gray-600">Unified inbox backed by the CRM notification service.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void notificationsQuery.refetch()}
            disabled={isBusy}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => void markAllReadMutation.mutateAsync()}
            disabled={isBusy}
          >
            <Eye className="mr-2 h-4 w-4" />
            Mark All Read
          </Button>
          <Button
            variant="destructive"
            onClick={() => void clearAllMutation.mutateAsync()}
            disabled={isBusy}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

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

      {selectedIds.size > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
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
          </CardContent>
        </Card>
      )}

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
                  checked={
                    pagedNotifications.length > 0 && selectedIds.size === pagedNotifications.length
                  }
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
                            <span className="font-semibold text-gray-900">
                              {notification.title}
                            </span>
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
                      <span>
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                      {notification.deliveryStatus && <span>{notification.deliveryStatus}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
