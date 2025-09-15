import { useState, useEffect } from 'react';

interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
  isTouchDevice: boolean;
}

export const useResponsive = (): ResponsiveState => {
  const [responsiveState, setResponsiveState] = useState<ResponsiveState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : 768,
    orientation: 'landscape',
    isTouchDevice: false
  });

  useEffect(() => {
    const updateResponsiveState = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Breakpoints
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;
      
      // Orientation
      const orientation = height > width ? 'portrait' : 'landscape';
      
      // Touch device detection
      const isTouchDevice = 'ontouchstart' in window || 
                           navigator.maxTouchPoints > 0 ||
                           (navigator as any).msMaxTouchPoints > 0;

      setResponsiveState({
        isMobile,
        isTablet,
        isDesktop,
        screenWidth: width,
        screenHeight: height,
        orientation,
        isTouchDevice
      });
    };

    // Initial check
    updateResponsiveState();

    // Listen for resize events
    window.addEventListener('resize', updateResponsiveState);
    window.addEventListener('orientationchange', updateResponsiveState);

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateResponsiveState);
      window.removeEventListener('orientationchange', updateResponsiveState);
    };
  }, []);

  return responsiveState;
};
