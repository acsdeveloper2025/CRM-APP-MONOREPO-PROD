import { createContext, useContext } from 'react';

export interface LayoutContextType {
  expandedMenus: string[];
  setExpandedMenus: (menus: string[]) => void;
  toggleMenu: (menuId: string) => void;
}

export const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};
