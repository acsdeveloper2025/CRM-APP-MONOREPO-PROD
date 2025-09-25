/**
 * Responsive Design Utilities and Guidelines
 * 
 * This file contains utilities and constants for consistent responsive design
 * implementation across the CRM application.
 */

// Breakpoint constants
export const BREAKPOINTS = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
  // Custom breakpoints
  mobile: 375,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

// Touch target sizes (following WCAG guidelines)
export const TOUCH_TARGETS = {
  minimum: 44, // Minimum touch target size in pixels
  comfortable: 48, // Comfortable touch target size
  large: 56, // Large touch target size
} as const;

// Responsive spacing scale
export const RESPONSIVE_SPACING = {
  xs: {
    padding: 'p-3',
    margin: 'm-3',
    gap: 'gap-3',
  },
  sm: {
    padding: 'p-4',
    margin: 'm-4',
    gap: 'gap-4',
  },
  md: {
    padding: 'p-6',
    margin: 'm-6',
    gap: 'gap-6',
  },
  lg: {
    padding: 'p-8',
    margin: 'm-8',
    gap: 'gap-8',
  },
} as const;

// Responsive typography scale
export const RESPONSIVE_TEXT = {
  heading: {
    h1: 'text-2xl sm:text-3xl lg:text-4xl',
    h2: 'text-xl sm:text-2xl lg:text-3xl',
    h3: 'text-lg sm:text-xl lg:text-2xl',
    h4: 'text-base sm:text-lg lg:text-xl',
  },
  body: {
    large: 'text-base sm:text-lg',
    normal: 'text-sm sm:text-base',
    small: 'text-xs sm:text-sm',
  },
} as const;

// Common responsive patterns
export const RESPONSIVE_PATTERNS = {
  // Grid layouts
  grid: {
    cards: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    stats: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    twoColumn: 'grid grid-cols-1 lg:grid-cols-2',
    threeColumn: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  },
  
  // Flex layouts
  flex: {
    stackToRow: 'flex flex-col sm:flex-row',
    centerStack: 'flex flex-col items-center',
    spaceBetween: 'flex flex-col sm:flex-row sm:items-center sm:justify-between',
  },
  
  // Container patterns
  container: {
    page: 'container mx-auto px-4 sm:px-6 lg:px-8',
    section: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
    content: 'max-w-4xl mx-auto px-4 sm:px-6',
  },
  
  // Button patterns
  button: {
    responsive: 'w-full sm:w-auto',
    touchFriendly: 'min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px]',
  },
  
  // Table patterns
  table: {
    responsive: 'overflow-x-auto',
    hideOnMobile: 'hidden sm:table-cell',
    hideOnTablet: 'hidden lg:table-cell',
    hideOnDesktop: 'hidden xl:table-cell',
  },
  
  // Navigation patterns
  navigation: {
    mobileHidden: 'hidden lg:flex',
    mobileOnly: 'lg:hidden',
    sidebar: 'fixed inset-y-0 left-0 z-50 w-64 sm:w-72 lg:w-64',
  },
} as const;

// Utility functions
export const getResponsiveClasses = {
  /**
   * Get responsive padding classes based on size
   */
  padding: (size: keyof typeof RESPONSIVE_SPACING) => RESPONSIVE_SPACING[size].padding,
  
  /**
   * Get responsive margin classes based on size
   */
  margin: (size: keyof typeof RESPONSIVE_SPACING) => RESPONSIVE_SPACING[size].margin,
  
  /**
   * Get responsive gap classes based on size
   */
  gap: (size: keyof typeof RESPONSIVE_SPACING) => RESPONSIVE_SPACING[size].gap,
  
  /**
   * Get responsive text classes for headings
   */
  heading: (level: keyof typeof RESPONSIVE_TEXT.heading) => RESPONSIVE_TEXT.heading[level],
  
  /**
   * Get responsive text classes for body text
   */
  body: (size: keyof typeof RESPONSIVE_TEXT.body) => RESPONSIVE_TEXT.body[size],
  
  /**
   * Get responsive grid classes
   */
  grid: (pattern: keyof typeof RESPONSIVE_PATTERNS.grid) => RESPONSIVE_PATTERNS.grid[pattern],
  
  /**
   * Get responsive flex classes
   */
  flex: (pattern: keyof typeof RESPONSIVE_PATTERNS.flex) => RESPONSIVE_PATTERNS.flex[pattern],
  
  /**
   * Get responsive container classes
   */
  container: (type: keyof typeof RESPONSIVE_PATTERNS.container) => RESPONSIVE_PATTERNS.container[type],
};

// Media query helpers for JavaScript
export const mediaQueries = {
  isMobile: () => window.matchMedia(`(max-width: ${BREAKPOINTS.md - 1}px)`).matches,
  isTablet: () => window.matchMedia(`(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`).matches,
  isDesktop: () => window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`).matches,
  isLargeScreen: () => window.matchMedia(`(min-width: ${BREAKPOINTS.xl}px)`).matches,
};

// Responsive design guidelines
export const RESPONSIVE_GUIDELINES = {
  // Touch targets should be at least 44px for accessibility
  touchTargets: {
    minimum: '44px',
    recommended: '48px',
    description: 'All interactive elements should meet minimum touch target sizes',
  },
  
  // Content width guidelines
  contentWidth: {
    reading: '65ch', // Optimal reading width
    form: '480px', // Maximum form width
    description: 'Limit content width for better readability',
  },
  
  // Spacing guidelines
  spacing: {
    mobile: '16px', // Base spacing for mobile
    desktop: '24px', // Base spacing for desktop
    description: 'Use consistent spacing that scales with screen size',
  },
  
  // Typography guidelines
  typography: {
    scaleRatio: 1.25, // Modular scale ratio
    lineHeight: 1.5, // Base line height
    description: 'Use responsive typography that scales appropriately',
  },
} as const;

export default {
  BREAKPOINTS,
  TOUCH_TARGETS,
  RESPONSIVE_SPACING,
  RESPONSIVE_TEXT,
  RESPONSIVE_PATTERNS,
  getResponsiveClasses,
  mediaQueries,
  RESPONSIVE_GUIDELINES,
};
