import React, { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { useSafeArea } from './SafeAreaProvider';

interface ScreenDimensions {
  width: number;
  height: number;
  isLandscape: boolean;
  isTablet: boolean;
  isSmallScreen: boolean;
}

interface ResponsiveLayoutContextType {
  screen: ScreenDimensions;
  safeAreaAdjustedHeight: number;
}

const ResponsiveLayoutContext = React.createContext<ResponsiveLayoutContextType>({
  screen: {
    width: 0,
    height: 0,
    isLandscape: false,
    isTablet: false,
    isSmallScreen: true,
  },
  safeAreaAdjustedHeight: 0,
});

export const useResponsiveLayout = () => React.useContext(ResponsiveLayoutContext);

interface ResponsiveLayoutProviderProps {
  children: React.ReactNode;
}

export const ResponsiveLayoutProvider: React.FC<ResponsiveLayoutProviderProps> = ({ children }) => {
  const { insets } = useSafeArea();
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  const screen: ScreenDimensions = {
    width: dimensions.width,
    height: dimensions.height,
    isLandscape: dimensions.width > dimensions.height,
    isTablet: dimensions.width >= 768,
    isSmallScreen: dimensions.width < 640,
  };

  const safeAreaAdjustedHeight = dimensions.height - insets.top - insets.bottom;

  const value = {
    screen,
    safeAreaAdjustedHeight,
  };

  return (
    <ResponsiveLayoutContext.Provider value={value}>
      {children}
    </ResponsiveLayoutContext.Provider>
  );
};

// Responsive Container Component
interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  maxWidth?: number;
  padding?: number | string;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  style = {},
  className = '',
  maxWidth = 1200,
  padding = 16,
}) => {
  const { screen } = useResponsiveLayout();

  const containerStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: screen.isTablet ? maxWidth : '100%',
    margin: '0 auto',
    paddingHorizontal: typeof padding === 'number' ? `${padding}px` : padding,
    ...style,
  };

  return (
    <div style={containerStyle} className={className}>
      {children}
    </div>
  );
};

// Responsive Grid Component
interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: number;
  style?: React.CSSProperties;
  className?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 16,
  style = {},
  className = '',
}) => {
  const { screen } = useResponsiveLayout();

  const getColumns = () => {
    if (screen.width >= 1024) return columns.desktop || 3;
    if (screen.width >= 768) return columns.tablet || 2;
    return columns.mobile || 1;
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${getColumns()}, 1fr)`,
    gap: `${gap}px`,
    width: '100%',
    ...style,
  };

  return (
    <div style={gridStyle} className={className}>
      {children}
    </div>
  );
};

// Responsive Text Component
interface ResponsiveTextProps {
  children: React.ReactNode;
  size?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  style?: React.CSSProperties;
  className?: string;
}

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  children,
  size = { mobile: '14px', tablet: '16px', desktop: '16px' },
  style = {},
  className = '',
}) => {
  const { screen } = useResponsiveLayout();

  const getFontSize = () => {
    if (screen.width >= 1024) return size.desktop || '16px';
    if (screen.width >= 768) return size.tablet || '16px';
    return size.mobile || '14px';
  };

  const textStyle: React.CSSProperties = {
    fontSize: getFontSize(),
    ...style,
  };

  return (
    <span style={textStyle} className={className}>
      {children}
    </span>
  );
};

// Responsive Spacing Component
interface ResponsiveSpacingProps {
  size?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  direction?: 'horizontal' | 'vertical';
}

export const ResponsiveSpacing: React.FC<ResponsiveSpacingProps> = ({
  size = { mobile: 8, tablet: 16, desktop: 24 },
  direction = 'vertical',
}) => {
  const { screen } = useResponsiveLayout();

  const getSpacing = () => {
    if (screen.width >= 1024) return size.desktop || 24;
    if (screen.width >= 768) return size.tablet || 16;
    return size.mobile || 8;
  };

  const spacing = getSpacing();
  const style: React.CSSProperties = {
    width: direction === 'horizontal' ? `${spacing}px` : '100%',
    height: direction === 'vertical' ? `${spacing}px` : 'auto',
    flexShrink: 0,
  };

  return <div style={style} />;
};

// Hook for responsive values
export const useResponsiveValue = <T,>(values: {
  mobile: T;
  tablet?: T;
  desktop?: T;
}): T => {
  const { screen } = useResponsiveLayout();

  if (screen.width >= 1024 && values.desktop !== undefined) {
    return values.desktop;
  }
  if (screen.width >= 768 && values.tablet !== undefined) {
    return values.tablet;
  }
  return values.mobile;
};
