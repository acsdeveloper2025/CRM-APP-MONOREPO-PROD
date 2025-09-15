import React, { useState } from 'react';
import { Bell, X, Check, AlertCircle, Info, CheckCircle, AlertTriangle, FileText, UserCheck, UserX, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useWebSocket } from '@/hooks/useWebSocket';
import { NotificationEvent } from '@/types/websocket';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    clearNotifications,
  } = useWebSocket();

  const getNotificationIcon = (type: NotificationEvent['type'] | string) => {
    switch (type) {
      case 'CASE_ASSIGNED':
        return <UserCheck className="h-4 w-4 text-blue-600" />;
      case 'CASE_REASSIGNED':
        return <UserCheck className="h-4 w-4 text-orange-600" />;
      case 'CASE_REMOVED':
        return <UserX className="h-4 w-4 text-red-600" />;
      case 'CASE_COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'CASE_REVOKED':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'CASE_APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'CASE_REJECTED':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'SYSTEM_MAINTENANCE':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'APP_UPDATE':
        return <Info className="h-4 w-4 text-blue-600" />;
      case 'EMERGENCY_ALERT':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getNotificationPriority = (notification: any) => {
    const priority = notification.priority || 'MEDIUM';
    switch (priority) {
      case 'URGENT':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'HIGH':
        return 'border-l-4 border-orange-500 bg-orange-50';
      case 'MEDIUM':
        return 'border-l-4 border-blue-500 bg-blue-50';
      case 'LOW':
        return 'border-l-4 border-border bg-muted';
      default:
        return 'border-l-4 border-blue-500 bg-blue-50';
    }
  };

  const handleNotificationClick = (notification: NotificationEvent | any) => {
    // Mark as read
    if (!notification.read) {
      markNotificationAsRead(notification.id);
    }

    // Handle navigation based on notification type and action
    if (notification.actionUrl) {
      if (notification.actionType === 'OPEN_CASE' && notification.caseId) {
        // Navigate to case details page
        navigate(`/cases/${notification.caseId}`);
      } else if (notification.actionType === 'NAVIGATE') {
        // Navigate to specified URL
        navigate(notification.actionUrl);
      }
    } else if (notification.caseId) {
      // Fallback: navigate to case details if caseId is available
      navigate(`/cases/${notification.caseId}`);
    }

    // Close dropdown after navigation
    setIsOpen(false);
  };

  const handleMarkAllAsRead = () => {
    notifications
      .filter(n => !n.read)
      .forEach(n => markNotificationAsRead(n.id));
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-4">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>
        
        <Separator />
        
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !notification.read ? 'bg-muted/30' : ''
                  } ${getNotificationPriority(notification)}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">
                          {notification.title}
                        </p>
                        <div className="flex items-center space-x-2">
                          {notification.priority === 'URGENT' && (
                            <Badge variant="destructive" className="text-xs">Urgent</Badge>
                          )}
                          {notification.priority === 'HIGH' && (
                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">High</Badge>
                          )}
                          {!notification.read && (
                            <div className="h-2 w-2 bg-blue-600 rounded-full flex-shrink-0" />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      {(notification.caseNumber || notification.customerName) && (
                        <div className="flex items-center space-x-2 mt-1">
                          {notification.caseNumber && (
                            <Badge variant="outline" className="text-xs">
                              Case: {notification.caseNumber}
                            </Badge>
                          )}
                          {notification.customerName && (
                            <span className="text-xs text-muted-foreground truncate">
                              {notification.customerName}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
