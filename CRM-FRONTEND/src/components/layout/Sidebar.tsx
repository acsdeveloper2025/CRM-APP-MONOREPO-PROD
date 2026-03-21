import React from 'react';
import { AppSidebar } from '@/ui/navigation/AppSidebar';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = () => {
  return <AppSidebar />;
};
