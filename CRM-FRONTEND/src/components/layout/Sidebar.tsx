import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { navigationItems } from '@/constants/navigation';
import type { NavigationItem } from '@/constants/navigation';
import { cn } from '@/utils/cn';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { hasAnyRole } = useAuth();
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isItemVisible = (item: NavigationItem) => {
    // Check permission-based access first
    if (item.permission) {
      const hasAccess = hasPermission(item.permission.resource, item.permission.action);
      if (!hasAccess) return false;
    }
    // Fallback to role-based access for backward compatibility
    else if (item.roles && !hasAnyRole(item.roles)) {
      return false;
    }

    // For parent items with children, check if at least one child is visible
    if (item.children && item.children.length > 0) {
      return item.children.some(child => isItemVisible(child));
    }

    return true;
  };

  const isItemActive = (item: NavigationItem): boolean => {
    // Direct match
    if (location.pathname === item.href || location.pathname.startsWith(item.href + '/')) {
      return true;
    }

    // Check if any child is active (for parent items)
    if (item.children && item.children.length > 0) {
      return item.children.some(child =>
        location.pathname === child.href || location.pathname.startsWith(child.href + '/')
      );
    }

    return false;
  };

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    if (!isItemVisible(item)) return null;

    const hasChildren = item.children && item.children.length > 0;
    const isActive = isItemActive(item);

    // Auto-expand if any child is active
    const shouldAutoExpand = hasChildren && item.children?.some(child => isItemActive(child));
    const isExpanded = expandedItems.includes(item.id) || shouldAutoExpand;

    return (
      <div key={item.id}>
        <div
          className={cn(
            'flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
            level > 0 && 'ml-6 mr-2 border-l-2 border-border pl-4',
            isActive
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm'
          )}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(item.id)}
              className="flex items-center w-full text-left"
            >
              <item.icon className="mr-3 h-5 w-5" />
              <span className="flex-1">{item.label}</span>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <Link
              to={item.href}
              className="flex items-center w-full"
              onClick={onClose}
            >
              <item.icon className="mr-3 h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children?.map(child => renderNavigationItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-card shadow-lg border-r border-border transform transition-all duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-border bg-primary/5">
            <Link
              to="/dashboard"
              className="text-xl font-bold text-foreground hover:text-primary transition-colors duration-200"
              onClick={onClose}
            >
              CRM Admin
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigationItems.map(item => renderNavigationItem(item))}
          </nav>
        </div>
      </div>
    </>
  );
};
