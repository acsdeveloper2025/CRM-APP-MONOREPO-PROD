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

  // Persist state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sidebarExpanded', JSON.stringify(expandedMenus));
    } catch (error) {
      logger.error('Failed to save sidebarExpanded to localStorage', error);
    }
  }, [expandedMenus]);

  const setExpandedMenus = useCallback((menus: string[]) => {
    setExpandedMenusState(menus);
  }, []);

  const toggleMenu = useCallback((menuId: string) => {
    setExpandedMenusState((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  }, []);

  const value = useMemo(
    () => ({ expandedMenus, setExpandedMenus, toggleMenu }),
    [expandedMenus, setExpandedMenus, toggleMenu]
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
};
