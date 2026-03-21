import React from 'react';
import { AppHeader } from '@/ui/navigation/AppHeader';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  return <AppHeader />;
};
