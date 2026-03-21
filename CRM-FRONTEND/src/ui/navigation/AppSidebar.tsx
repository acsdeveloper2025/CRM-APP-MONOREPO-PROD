import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { navigationItems, type NavigationItem } from '@/constants/navigation';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { Button } from '@/ui/components/Button';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

function isVisible(item: NavigationItem, hasPermissionCode: (code: string) => boolean): boolean {
  if (item.children?.some((child) => isVisible(child, hasPermissionCode))) {
    return true;
  }
  return item.permissionCode ? hasPermissionCode(item.permissionCode) : true;
}

function isActivePath(currentPath: string, href: string): boolean {
  if (currentPath === href) {
    return true;
  }

  if (href === '/locations' && currentPath.startsWith('/locations/')) {
    return true;
  }

  if (href === '/users' && currentPath.startsWith('/users/')) {
    return true;
  }

  return currentPath.startsWith(`${href}/`);
}

interface AppSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ mobileOpen = false, onClose }: AppSidebarProps) {
  const { hasPermissionCode } = usePermissionContext();
  const location = useLocation();

  const visibleItems = React.useMemo(
    () => navigationItems.filter((item) => isVisible(item, hasPermissionCode)),
    [hasPermissionCode]
  );

  const workspaceItems = visibleItems.filter((item) => item.section === 'workspace');
  const collapsibleGroups = visibleItems.filter((item) => item.section === 'primary' && item.children?.length);
  const toolItems = visibleItems.filter((item) => item.section === 'tools' && (!item.children || item.children.length === 0));

  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setCollapsedGroups((current) => {
      let changed = false;
      const next = { ...current };

      for (const item of collapsibleGroups) {
        if (!(item.id in next)) {
          const isActive =
            isActivePath(location.pathname, item.href) ||
            item.children?.some((child) => isActivePath(location.pathname, child.href));
          next[item.id] = !isActive;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [collapsibleGroups, location.pathname]);

  const toggleGroup = (id: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  return (
    <aside className="ui-app-sidebar" data-mobile-open={mobileOpen}>
      <button
        type="button"
        className="ui-app-sidebar__backdrop"
        aria-label="Close navigation"
        onClick={onClose}
      />
      <div className="ui-app-sidebar__panel">
        <Stack gap={5}>
          <Stack gap={2}>
            <Stack direction="horizontal" align="center" justify="space-between" gap={2}>
              <Stack gap={1}>
                <Text variant="label" tone="accent">ACS CRM</Text>
                <Text as="h1" variant="headline">Operations cockpit</Text>
              </Stack>
              <Button
                variant="ghost"
                className="ui-mobile-nav-close"
                icon={<X size={16} />}
                onClick={onClose}
              >
                Close
              </Button>
            </Stack>
            <Text variant="body-sm" tone="muted">
              A unified workspace for case flow, field execution, and decision velocity.
            </Text>
          </Stack>

          <Stack gap={4}>
            {workspaceItems.length > 0 ? (
              <Stack gap={2}>
                <Text variant="label" tone="soft">Workspace</Text>
                <Stack gap={1}>
                  {workspaceItems.map((item) => {
                    const active = isActivePath(location.pathname, item.href);
                    const Icon = item.icon;

                    return (
                      <NavLink key={item.id} to={item.href} className="ui-nav-link" data-active={active} onClick={onClose}>
                        <Icon size={18} />
                        <Text as="span" variant="body-sm">{item.label}</Text>
                      </NavLink>
                    );
                  })}
                </Stack>
              </Stack>
            ) : null}

            <Stack gap={2}>
              {collapsibleGroups.map((item) => {
                const active =
                  isActivePath(location.pathname, item.href) ||
                  item.children?.some((child) => isActivePath(location.pathname, child.href));
                const collapsed = collapsedGroups[item.id] ?? !active;
                const GroupIcon = item.icon;
                const ToggleIcon = collapsed ? ChevronRight : ChevronDown;

                return (
                  <Stack key={item.id} gap={1}>
                    <button
                      type="button"
                      className="ui-nav-group-trigger"
                      data-active={active}
                      data-collapsed={collapsed}
                      onClick={() => toggleGroup(item.id)}
                    >
                      <span className="ui-nav-group-trigger__content">
                        <GroupIcon size={18} />
                        <Text as="span" variant="body-sm">{item.label}</Text>
                      </span>
                      <ToggleIcon size={16} />
                    </button>

                    {!collapsed ? (
                      <Stack gap={1}>
                        {item.children?.filter((child) => isVisible(child, hasPermissionCode)).map((child) => {
                          const childActive = isActivePath(location.pathname, child.href);
                          const Icon = child.icon;

                          return (
                            <NavLink
                              key={child.id}
                              to={child.href}
                              className="ui-nav-link ui-nav-link--child"
                              data-active={childActive}
                              onClick={onClose}
                            >
                              <Icon size={18} />
                              <Text as="span" variant="body-sm">{child.label}</Text>
                            </NavLink>
                          );
                        })}
                      </Stack>
                    ) : null}
                  </Stack>
                );
              })}
            </Stack>

            {toolItems.length > 0 ? (
              <Stack gap={2}>
                <Text variant="label" tone="soft">Tools & Workspace</Text>
                <Stack gap={1}>
                  {toolItems.map((item) => {
                    const active = isActivePath(location.pathname, item.href);
                    const Icon = item.icon;

                    return (
                      <NavLink key={item.id} to={item.href} className="ui-nav-link" data-active={active} onClick={onClose}>
                        <Icon size={18} />
                        <Text as="span" variant="body-sm">{item.label}</Text>
                      </NavLink>
                    );
                  })}
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        </Stack>
      </div>
    </aside>
  );
}
