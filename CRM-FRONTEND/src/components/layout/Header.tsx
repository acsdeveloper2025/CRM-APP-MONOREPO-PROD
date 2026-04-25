import React, { useState, useEffect } from 'react';
import { Menu, Moon, Sun, LogOut, User, Settings, Trash2, Bell, Clock } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCacheClearer } from '@/utils/clearCache';
import { resolveAssetUrl } from '@/utils/assetUrl';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { notificationService, type AppNotification } from '@/services/notifications';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clearCache } = useCacheClearer();
  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'header'],
    queryFn: () => notificationService.list({ limit: 8, offset: 0 }),
    enabled: Boolean(user),
    refetchInterval: 60000,
    staleTime: 15000,
  });

  const handleLogout = async () => {
    await logout();
  };

  const handleClearCache = async () => {
    // eslint-disable-next-line no-alert
    if (confirm('Are you sure you want to clear all cache? This will reload the page.')) {
      await clearCache(queryClient, 'all');
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') {
      return 'Dashboard';
    }
    if (path === '/case-management/all-cases') {
      return 'Cases';
    }
    if (path === '/task-management/pending-tasks') {
      return 'Pending Tasks';
    }
    if (path === '/client-management/clients') {
      return 'Clients';
    }
    if (path === '/user-management/users') {
      return 'Users';
    }
    if (path === '/reports-and-mis') {
      return 'Reports';
    }
    if (path === '/billing-and-commission') {
      return 'Billing';
    }
    if (path === '/location-management') {
      return 'Locations';
    }
    if (path === '/forms') {
      return 'Forms';
    }
    if (path === '/security-ux') {
      return 'Security & UX';
    }
    if (path === '/settings') {
      return 'Settings';
    }
    if (path === '/notifications') {
      return 'Notifications';
    }
    return 'Dashboard';
  };

  // Live clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatClock = (date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const day = days[date.getDay()];
    const dd = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const mins = date.getMinutes().toString().padStart(2, '0');
    const secs = date.getSeconds().toString().padStart(2, '0');
    return { day, date: `${dd} ${month} ${year}`, time: `${hours}:${mins}:${secs} ${ampm}` };
  };

  const clock = formatClock(now);

  const unreadCount = notificationsQuery.data?.unreadCount || 0;
  const recentNotifications = notificationsQuery.data?.items || [];

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
  };

  const handleNotificationOpen = async (notificationId: string, actionUrl?: string) => {
    const notification = recentNotifications.find((item) => item.id === notificationId);

    try {
      if (notification && !notification.isRead) {
        await notificationService.markRead(notificationId);
        markNotificationReadInCache(notificationId);
      }

      const target = notification
        ? await notificationService.validateNavigationTarget(notification)
        : actionUrl || '/notifications';

      if (!target) {
        toast.error('No longer available');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['notifications'] }),
          queryClient.invalidateQueries({ queryKey: ['notifications-history'] }),
        ]);
        return;
      }

      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications-history'] }),
      ]);
      navigate(target);
    } catch {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications-history'] }),
      ]);
      toast.error('No longer available');
    }
  };

  return (
    <header className="bg-green-600 dark:bg-green-700 text-white shadow-sm border-b border-green-700 dark:border-green-800 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-4 lg:px-6 xl:px-8">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9 sm:h-10 sm:w-10 text-white hover:bg-green-700 dark:hover:bg-green-800 hover:text-white transition-colors duration-200"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>

        {/* Page title - dynamic based on route */}
        <div className="flex-1 lg:flex-none min-w-0">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white truncate">
            {getPageTitle()}
          </h1>
        </div>

        {/* Live Clock */}
        <div className="hidden md:flex items-center gap-2 text-white/90">
          <Clock className="h-4 w-4" />
          <div className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
            <span>{clock.day},</span>
            <span>{clock.date}</span>
            <span className="text-white/60">|</span>
            <span className="min-w-[5.5rem]">{clock.time}</span>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 text-white hover:bg-green-700 dark:hover:bg-green-800 hover:text-white transition-colors duration-200"
              >
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-green-700">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                <span className="text-xs font-normal text-gray-600">{unreadCount} unread</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recentNotifications.length === 0 ? (
                <div className="px-2 py-4 text-sm text-gray-600">No notifications yet</div>
              ) : (
                recentNotifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex cursor-pointer flex-col items-start gap-1 whitespace-normal py-2"
                    onSelect={(event) => {
                      event.preventDefault();
                      void handleNotificationOpen(
                        notification.id,
                        notification.actionUrl ||
                          (typeof notification.data?.actionUrl === 'string'
                            ? notification.data.actionUrl
                            : undefined)
                      );
                    }}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="font-medium">{notification.title}</span>
                      {!notification.isRead && (
                        <span className="mt-1 h-2 w-2 rounded-full bg-green-600" />
                      )}
                    </div>
                    <span className="line-clamp-2 text-xs text-gray-600">
                      {notification.message}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  navigate('/notifications');
                }}
              >
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 text-white hover:bg-green-700 dark:hover:bg-green-800 hover:text-white transition-colors duration-200"
            title={`Switch to ${theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'} theme`}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : theme === 'light' ? (
              <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 rounded-full text-white hover:bg-green-700 dark:hover:bg-green-800 hover:text-white transition-colors duration-200"
              >
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9">
                  <AvatarImage src={resolveAssetUrl(user?.profilePhotoUrl)} alt={user?.name} />
                  <AvatarFallback className="text-xs sm:text-sm bg-green-500 text-white">
                    {user?.name ? getUserInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-gray-600 case-sensitive">{user?.email}</p>
                  <p className="text-xs leading-none text-gray-600">
                    {user?.role} • {user?.designation}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleClearCache}>
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Clear Cache</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
