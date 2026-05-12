import React, { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { LayoutContext } from './LayoutContextDefinition';
import { logger } from '@/utils/logger';

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state from localStorage to persist across refreshes
  const [expandedMenus, setExpandedMenusState] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sidebarExpanded');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      logger.error('Failed to parse sidebarExpanded from localStorage', error);
      return [];
    }
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved ? JSON.parse(saved) === true : false;
    } catch (error) {
      logger.error('Failed to parse sidebarCollapsed from localStorage', error);
      return false;
    }
  });

  // Persist state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sidebarExpanded', JSON.stringify(expandedMenus));
    } catch (error) {
      logger.error('Failed to save sidebarExpanded to localStorage', error);
    }
  }, [expandedMenus]);

  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
    } catch (error) {
      logger.error('Failed to save sidebarCollapsed to localStorage', error);
    }
  }, [isSidebarCollapsed]);

  const setExpandedMenus = useCallback((menus: string[]) => {
    setExpandedMenusState(menus);
  }, []);

  const toggleMenu = useCallback((menuId: string) => {
    setExpandedMenusState((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      expandedMenus,
      setExpandedMenus,
      toggleMenu,
      isSidebarCollapsed,
      toggleSidebarCollapsed,
    }),
    [expandedMenus, setExpandedMenus, toggleMenu, isSidebarCollapsed, toggleSidebarCollapsed]
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
};
