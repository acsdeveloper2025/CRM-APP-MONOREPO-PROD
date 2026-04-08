import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeContext, Theme, ThemeContextType } from './ThemeContextObject';
import { useTheme } from '@/hooks/useTheme';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'acs-theme',
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = window.document.documentElement;
    
    const updateTheme = () => {
      let resolvedTheme: 'light' | 'dark';
      
      if (theme === 'system') {
        resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        resolvedTheme = theme;
      }
      
      setActualTheme(resolvedTheme);
      
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
      
      // Update meta theme-color for mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', resolvedTheme === 'dark' ? '#0f172a' : '#ffffff');
      }
    };

    updateTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        updateTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const handleSetTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setTheme(newTheme);
  }, [storageKey]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light';
      localStorage.setItem(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const value = useMemo<ThemeContextType>(
    () => ({ theme, actualTheme, setTheme: handleSetTheme, toggleTheme }),
    [theme, actualTheme, handleSetTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Theme-aware component wrapper
interface ThemeAwareProps {
  children: React.ReactNode;
  lightContent?: React.ReactNode;
  darkContent?: React.ReactNode;
}

export function ThemeAware({ children, lightContent, darkContent }: ThemeAwareProps) {
  const { actualTheme } = useTheme();
  
  if (lightContent && actualTheme === 'light') {
    return <>{lightContent}</>;
  }
  
  if (darkContent && actualTheme === 'dark') {
    return <>{darkContent}</>;
  }
  
  return <>{children}</>;
}
