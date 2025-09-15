import React from 'react';
import { Menu, Bell, Moon, Sun, LogOut, User, Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
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

  const handleLogout = async () => {
    await logout();
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
    <header className="bg-card shadow-sm border-b border-border backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-6 w-6" />
        </Button>

        {/* Page title - dynamic based on route */}
        <div className="flex-1 lg:flex-none">
          <h1 className="text-2xl font-semibold text-foreground">{getPageTitle()}</h1>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="hidden sm:flex">
            <ConnectionStatus showText />
          </div>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="hidden sm:flex"
            title={`Switch to ${theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'} theme`}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Settings className="h-5 w-5" />
            )}
          </Button>

          {/* Real-time Notifications */}
          <NotificationCenter />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profilePhotoUrl} alt={user?.name} />
                  <AvatarFallback>
                    {user?.name ? getUserInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
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
