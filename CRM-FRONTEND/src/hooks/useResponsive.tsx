import React, { useState, useEffect } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface BreakpointValues {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
}

const defaultBreakpoints: BreakpointValues = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export function useResponsive(customBreakpoints?: Partial<BreakpointValues>) {
  const breakpoints = { ...defaultBreakpoints, ...customBreakpoints };
  
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>('lg');

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setWindowSize({ width, height });

      // Determine current breakpoint
      if (width >= breakpoints['2xl']) {
        setCurrentBreakpoint('2xl');
      } else if (width >= breakpoints.xl) {
        setCurrentBreakpoint('xl');
      } else if (width >= breakpoints.lg) {
        setCurrentBreakpoint('lg');
      } else if (width >= breakpoints.md) {
        setCurrentBreakpoint('md');
      } else if (width >= breakpoints.sm) {
        setCurrentBreakpoint('sm');
      } else {
        setCurrentBreakpoint('xs');
      }
    }

    handleResize(); // Set initial values
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoints]);

  // Helper functions
  const isBreakpoint = (breakpoint: Breakpoint) => currentBreakpoint === breakpoint;
  
  const isBreakpointUp = (breakpoint: Breakpoint) => {
    const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
    const targetIndex = breakpointOrder.indexOf(breakpoint);
    return currentIndex >= targetIndex;
  };

  const isBreakpointDown = (breakpoint: Breakpoint) => {
    const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
    const targetIndex = breakpointOrder.indexOf(breakpoint);
    return currentIndex <= targetIndex;
  };

  const isMobile = currentBreakpoint === 'xs' || currentBreakpoint === 'sm';
  const isTablet = currentBreakpoint === 'md';
  const isDesktop = currentBreakpoint === 'lg' || currentBreakpoint === 'xl' || currentBreakpoint === '2xl';

  // Device detection
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
  const isLandscape = windowSize.width > windowSize.height;
  const isPortrait = windowSize.height > windowSize.width;

  // Responsive value selector
  const getResponsiveValue = <T,>(values: Partial<Record<Breakpoint, T>>, fallback: T): T => {
    const breakpointOrder: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm', 'xs'];
    const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
    
    // Find the closest breakpoint value
    for (let i = currentIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i];
      if (values[bp] !== undefined) {
        return values[bp]!;
      }
    }
    
    return fallback;
  };

  return {
    // Window dimensions
    windowSize,
    width: windowSize.width,
    height: windowSize.height,
    
    // Current breakpoint
    currentBreakpoint,
    breakpoints,
    
    // Breakpoint checks
    isBreakpoint,
    isBreakpointUp,
    isBreakpointDown,
    
    // Device categories
    isMobile,
    isTablet,
    isDesktop,
    
    // Device capabilities
    isTouchDevice,
    isLandscape,
    isPortrait,
    
    // Utilities
    getResponsiveValue,
  };
}

// Hook for responsive classes
export function useResponsiveClasses() {
  const { currentBreakpoint, isMobile, isTablet, isDesktop } = useResponsive();

  const getResponsiveClasses = (classes: Partial<Record<Breakpoint | 'mobile' | 'tablet' | 'desktop', string>>) => {
    const classArray: string[] = [];

    // Add device category classes
    if (classes.mobile && isMobile) classArray.push(classes.mobile);
    if (classes.tablet && isTablet) classArray.push(classes.tablet);
    if (classes.desktop && isDesktop) classArray.push(classes.desktop);

    // Add specific breakpoint class
    if (classes[currentBreakpoint]) {
      classArray.push(classes[currentBreakpoint]!);
    }

    return classArray.join(' ');
  };

  return { getResponsiveClasses, currentBreakpoint, isMobile, isTablet, isDesktop };
}

// Hook for responsive grid columns
export function useResponsiveGrid(
  columns: Partial<Record<Breakpoint, number>> = { xs: 1, sm: 2, md: 3, lg: 4 }
) {
  const { getResponsiveValue } = useResponsive();
  
  const currentColumns = getResponsiveValue(columns, 1);
  const gridClasses = `grid-cols-${currentColumns}`;
  
  return {
    columns: currentColumns,
    gridClasses,
    style: { gridTemplateColumns: `repeat(${currentColumns}, 1fr)` },
  };
}

// Hook for responsive spacing
export function useResponsiveSpacing() {
  const { isMobile, isTablet } = useResponsive();

  const getSpacing = (mobile: string, tablet: string, desktop: string) => {
    if (isMobile) return mobile;
    if (isTablet) return tablet;
    return desktop;
  };

  const padding = {
    sm: getSpacing('p-2', 'p-4', 'p-6'),
    md: getSpacing('p-4', 'p-6', 'p-8'),
    lg: getSpacing('p-6', 'p-8', 'p-12'),
  };

  const margin = {
    sm: getSpacing('m-2', 'm-4', 'm-6'),
    md: getSpacing('m-4', 'm-6', 'm-8'),
    lg: getSpacing('m-6', 'm-8', 'm-12'),
  };

  const gap = {
    sm: getSpacing('gap-2', 'gap-4', 'gap-6'),
    md: getSpacing('gap-4', 'gap-6', 'gap-8'),
    lg: getSpacing('gap-6', 'gap-8', 'gap-12'),
  };

  return { padding, margin, gap, getSpacing };
}

// Component for responsive rendering
interface ResponsiveProps {
  children: React.ReactNode;
  breakpoint?: Breakpoint;
  up?: boolean;
  down?: boolean;
  only?: boolean;
}

export function Responsive({ children, breakpoint, up, down, only }: ResponsiveProps) {
  const { isBreakpoint, isBreakpointUp, isBreakpointDown } = useResponsive();

  if (!breakpoint) return <>{children}</>;

  let shouldRender = false;

  if (only) {
    shouldRender = isBreakpoint(breakpoint);
  } else if (up) {
    shouldRender = isBreakpointUp(breakpoint);
  } else if (down) {
    shouldRender = isBreakpointDown(breakpoint);
  } else {
    shouldRender = isBreakpointUp(breakpoint);
  }

  return shouldRender ? <>{children}</> : null;
}
