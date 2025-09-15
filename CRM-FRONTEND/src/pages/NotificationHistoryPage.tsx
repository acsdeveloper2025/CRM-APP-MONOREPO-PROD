import React, { useState, useEffect } from 'react';
import { Bell, Search, Filter, MoreHorizontal, Check, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { apiService } from '@/services/api';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  caseId?: string;
  caseNumber?: string;
  actionUrl?: string;
  actionType?: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  isRead: boolean;
  deliveryStatus: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  createdAt: string;
  readAt?: string;
  data?: Record<string, any>;
}

export function NotificationHistoryPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, [currentPage, filterType, filterStatus, searchTerm]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(filterType !== 'all' && { type: filterType }),
        ...(filterStatus !== 'all' && { status: filterStatus }),
      });

      const response = await apiService.get(`/notifications/history?${params}`);
      if (response.success) {
        setNotifications(response.data.notifications);
        setTotalPages(response.data.totalPages);
        setTotalCount(response.data.totalCount);
      } else {
        toast.error('Failed to load notifications');
      }
    } catch (error) {
      console.error('Load notifications error:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.isRead) {
      await markAsRead([notification.id]);
    }

    // Handle navigation
    if (notification.actionType === 'OPEN_CASE' && notification.caseId) {
      navigate(`/cases/${notification.caseId}`);
    } else if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const markAsRead = async (notificationIds: string[]) => {
    try {
      const response = await apiService.post('/notifications/mark-read', {
        notificationIds,
      });

      if (response.success) {
        setNotifications(prev =>
          prev.map(n =>
            notificationIds.includes(n.id)
              ? { ...n, isRead: true, readAt: new Date().toISOString() }
              : n
          )
        );
        toast.success(`Marked ${notificationIds.length} notification(s) as read`);
      } else {
        toast.error('Failed to mark notifications as read');
      }
    } catch (error) {
      console.error('Mark as read error:', error);
      toast.error('Failed to mark notifications as read');
    }
  };

  const markAsUnread = async (notificationIds: string[]) => {
    try {
      const response = await apiService.post('/notifications/mark-unread', {
        notificationIds,
      });

      if (response.success) {
        setNotifications(prev =>
          prev.map(n =>
            notificationIds.includes(n.id)
              ? { ...n, isRead: false, readAt: undefined }
              : n
          )
        );
        toast.success(`Marked ${notificationIds.length} notification(s) as unread`);
      } else {
        toast.error('Failed to mark notifications as unread');
      }
    } catch (error) {
      console.error('Mark as unread error:', error);
      toast.error('Failed to mark notifications as unread');
    }
  };

  const deleteNotifications = async (notificationIds: string[]) => {
    try {
      const response = await apiService.delete('/notifications/bulk', {
        data: { notificationIds },
      });

      if (response.success) {
        setNotifications(prev =>
          prev.filter(n => !notificationIds.includes(n.id))
        );
        setSelectedNotifications(new Set());
        toast.success(`Deleted ${notificationIds.length} notification(s)`);
      } else {
        toast.error('Failed to delete notifications');
      }
    } catch (error) {
      console.error('Delete notifications error:', error);
      toast.error('Failed to delete notifications');
    }
  };

  const handleSelectAll = () => {
    if (selectedNotifications.size === notifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(notifications.map(n => n.id)));
    }
  };

  const handleSelectNotification = (notificationId: string) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId);
    } else {
      newSelected.add(notificationId);
    }
    setSelectedNotifications(newSelected);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'CASE_ASSIGNED':
      case 'CASE_REASSIGNED':
        return '👤';
      case 'CASE_COMPLETED':
        return '✅';
      case 'CASE_REVOKED':
        return '❌';
      case 'CASE_APPROVED':
        return '👍';
      case 'CASE_REJECTED':
        return '👎';
      case 'SYSTEM_MAINTENANCE':
        return '🔧';
      case 'APP_UPDATE':
        return '📱';
      case 'EMERGENCY_ALERT':
        return '🚨';
      default:
        return '🔔';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'destructive';
      case 'HIGH':
        return 'secondary';
      case 'MEDIUM':
        return 'outline';
      case 'LOW':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'text-green-600 dark:text-green-400';
      case 'SENT':
        return 'text-blue-600 dark:text-blue-400';
      case 'FAILED':
        return 'text-red-600 dark:text-red-400';
      case 'PENDING':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const selectedCount = selectedNotifications.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notification History</h1>
          <p className="text-muted-foreground">
            View and manage your notification history ({totalCount} total, {unreadCount} unread)
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="CASE_ASSIGNED">Case Assignment</SelectItem>
                  <SelectItem value="CASE_COMPLETED">Case Completion</SelectItem>
                  <SelectItem value="CASE_REVOKED">Case Revocation</SelectItem>
                  <SelectItem value="SYSTEM_MAINTENANCE">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <Button onClick={loadNotifications} variant="outline" className="w-full">
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedCount} notification(s) selected
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markAsRead(Array.from(selectedNotifications))}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Mark as Read
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markAsUnread(Array.from(selectedNotifications))}
                >
                  <EyeOff className="h-4 w-4 mr-2" />
                  Mark as Unread
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteNotifications(Array.from(selectedNotifications))}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Notifications</CardTitle>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedCount === notifications.length && notifications.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No notifications found</h3>
              <p className="text-muted-foreground">
                {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'You have no notifications yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                    !notification.isRead ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      checked={selectedNotifications.has(notification.id)}
                      onCheckedChange={() => handleSelectNotification(notification.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium truncate">{notification.title}</h4>
                        <div className="flex items-center space-x-2">
                          <Badge variant={getPriorityColor(notification.priority)}>
                            {notification.priority}
                          </Badge>
                          {!notification.isRead && (
                            <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center space-x-4">
                          {notification.caseNumber && (
                            <span>Case: {notification.caseNumber}</span>
                          )}
                          <span className={getStatusColor(notification.deliveryStatus)}>
                            {notification.deliveryStatus}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                          {notification.readAt && (
                            <span>
                              • Read {formatDistanceToNow(new Date(notification.readAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            notification.isRead
                              ? markAsUnread([notification.id])
                              : markAsRead([notification.id]);
                          }}
                        >
                          {notification.isRead ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Mark as Unread
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Mark as Read
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotifications([notification.id]);
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
