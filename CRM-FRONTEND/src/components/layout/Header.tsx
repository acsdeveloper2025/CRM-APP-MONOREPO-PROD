import React from 'react';
import { Menu, Bell, Moon, Sun, LogOut, User, Settings, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useQueryClient } from '@tanstack/react-query';
import { useCacheClearer } from '@/utils/clearCache';
import { NotificationCenter } from '@/components/realtime/NotificationCenter';
import { ConnectionStatus } from '@/components/realtime/ConnectionStatus';
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

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { clearCache } = useCacheClearer();

  const handleLogout = async () => {
    await logout();
  };

  const handleClearCache = async () => {
    if (confirm('Are you sure you want to clear all cache? This will reload the page.')) {
      await clearCache(queryClient, 'all');
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/cases') return 'Cases';
    if (path === '/cases/pending') return 'Pending Review';
    if (path === '/clients') return 'Clients';
    if (path === '/users') return 'Users';
    if (path === '/reports') return 'Reports';
    if (path === '/billing') return 'Billing';
    if (path === '/locations') return 'Locations';
    if (path === '/realtime') return 'Real-time';
    if (path === '/forms') return 'Forms';
    if (path === '/security-ux') return 'Security & UX';
    if (path === '/settings') return 'Settings';
    return 'Dashboard';
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

        {/* Right side actions */}
        <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
          {/* Connection Status */}
          <div className="hidden md:flex">
            <ConnectionStatus showText />
          </div>

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

          {/* Real-time Notifications */}
          <NotificationCenter />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 rounded-full text-white hover:bg-green-700 dark:hover:bg-green-800 hover:text-white transition-colors duration-200">
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9">
                  <AvatarImage src={user?.profilePhotoUrl} alt={user?.name} />
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
                  <p className="text-xs leading-none text-gray-600">
                    {user?.email}
                  </p>
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
