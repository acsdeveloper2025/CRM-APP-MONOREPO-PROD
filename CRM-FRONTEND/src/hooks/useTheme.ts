import { useContext } from 'react';
import { ThemeContext } from '@/contexts/ThemeContextObject';

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Hook for theme-dependent values
export function useThemeValue<T>(lightValue: T, darkValue: T): T {
  const { actualTheme } = useTheme();
  return actualTheme === 'dark' ? darkValue : lightValue;
}

// Hook for theme-dependent classes
export function useThemeClasses(lightClasses: string, darkClasses: string): string {
  const { actualTheme } = useTheme();
  return actualTheme === 'dark' ? darkClasses : lightClasses;
}
