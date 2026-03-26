import React, { useState, useEffect, ReactNode } from 'react';
import { LayoutContext } from './LayoutContextDefinition';
import { logger } from '@/utils/logger';

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state from localStorage to persist across refreshes
  const [expandedMenus, setExpandedMenusState] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sidebar_expanded');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      logger.error('Failed to parse sidebar_expanded from localStorage', error);
      return [];
    }
  });

  // Persist state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sidebar_expanded', JSON.stringify(expandedMenus));
    } catch (error) {
      logger.error('Failed to save sidebar_expanded to localStorage', error);
    }
  }, [expandedMenus]);

  const setExpandedMenus = (menus: string[]) => {
    setExpandedMenusState(menus);
  };

  const toggleMenu = (menuId: string) => {
    setExpandedMenusState(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId) 
        : [...prev, menuId]
    );
  };

  return (
    <LayoutContext.Provider value={{ expandedMenus, setExpandedMenus, toggleMenu }}>
      {children}
    </LayoutContext.Provider>
  );
};

