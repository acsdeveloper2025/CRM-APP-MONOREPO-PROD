import React from 'react';
import { Bell, LayoutDashboard, LogOut, Menu, Moon, Settings, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/ui/components/Button';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onMenuToggle?: () => void;
}

export function AppHeader({ title, subtitle, actions, onMenuToggle }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="ui-app-header">
      <div className="ui-page__inner" style={{ paddingBottom: 0 }}>
        <div className="ui-app-header__panel">
          <Stack direction="horizontal" align="center" justify="space-between" gap={3} wrap="wrap">
            <Stack direction="horizontal" align="center" gap={3}>
              {onMenuToggle ? (
                <Button variant="secondary" className="ui-mobile-nav-toggle" icon={<Menu size={16} />} onClick={onMenuToggle}>
                  Menu
                </Button>
              ) : null}
              <Stack gap={1}>
                <Text variant="label" tone="accent">Command surface</Text>
                <Text as="h1" variant="title">{title || 'CRM'}</Text>
                {subtitle ? <Text variant="body-sm" tone="muted">{subtitle}</Text> : null}
              </Stack>
            </Stack>

            <Stack direction="horizontal" align="center" gap={2} wrap="wrap">
              {actions}
              <Button variant="secondary" icon={<LayoutDashboard size={16} />} onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button variant="secondary" icon={<Bell size={16} />} onClick={() => navigate('/notifications')}>
                Alerts
              </Button>
              <Button
                variant="secondary"
                icon={theme === 'dark' ? <Sun size={16} /> : theme === 'light' ? <Moon size={16} /> : <Settings size={16} />}
                onClick={toggleTheme}
              >
                Theme
              </Button>
              <Button variant="ghost" onClick={() => navigate('/settings')}>
                {user?.username || 'Settings'}
              </Button>
              <Button variant="danger" icon={<LogOut size={16} />} onClick={() => void logout()}>
                Sign out
              </Button>
            </Stack>
          </Stack>
        </div>
      </div>
    </header>
  );
}
