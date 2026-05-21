import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useLayout } from '@/contexts/LayoutContextDefinition';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isSidebarCollapsed } = useLayout();

  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={handleSidebarClose} />
      <div
        className={cn(
          'transition-all duration-300 min-h-screen flex flex-col',
          isSidebarCollapsed ? 'lg:pl-0' : 'lg:pl-64'
        )}
      >
        <Header onMenuClick={handleMenuClick} />
        <main className="flex-1 py-3 sm:py-4 lg:py-6 animate-fade-in">
          <div className="px-4 sm:px-6 lg:px-8 h-full">{children}</div>
        </main>
      </div>
    </div>
  );
};
