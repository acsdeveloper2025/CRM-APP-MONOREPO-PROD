/**
 * Unified Styling Guidelines
 *
 * This file provides consistent styling patterns, utility classes,
 * and component styling guidelines for the CRM application.
 */

// ==================== Utility Functions ====================

/**
 * Re-export cn utility from lib/utils for consistency
 */
import { cn } from '@/lib/utils';
export { cn };

/**
 * Creates responsive class names
 */
export function responsive<T extends string>(
  base: T,
  breakpoints?: Partial<Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', T>>
): string {
  const classes: string[] = [base];
  
  if (breakpoints) {
    Object.entries(breakpoints).forEach(([breakpoint, value]) => {
      classes.push(`${breakpoint}:${value}`);
    });
  }
  
  return classes.join(' ');
}

// ==================== Component Style Patterns ====================

/**
 * Button style variants using consistent patterns
 */
export const buttonStyles = {
  base: 'inline-flex items-center justify-center rounded-button font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:pointer-events-none disabled:opacity-50',
  
  variants: {
    variant: {
      default: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-active',
      secondary: 'bg-secondary text-white hover:bg-secondary/90',
      success: 'bg-success text-white hover:bg-success/90',
      warning: 'bg-warning text-white hover:bg-warning/90',
      error: 'bg-error text-white hover:bg-error/90',
      outline: 'border border-border-primary bg-transparent hover:bg-surface-secondary',
      ghost: 'hover:bg-surface-secondary',
      link: 'text-primary underline-offset-4 hover:underline',
    },
    size: {
      xs: 'h-7 px-2 text-xs',
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-base',
      lg: 'h-11 px-6 text-lg',
      xl: 'h-12 px-8 text-xl',
    },
  },
  
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
} as const;

/**
 * Input style variants
 */
export const inputStyles = {
  base: 'flex w-full rounded-md border border-border-primary bg-surface-primary px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50',
  
  variants: {
    size: {
      sm: 'h-8 px-2 text-xs',
      md: 'h-10 px-3 text-sm',
      lg: 'h-12 px-4 text-base',
    },
    state: {
      default: '',
      error: 'border-error focus-visible:ring-error',
      success: 'border-success focus-visible:ring-success',
      warning: 'border-warning focus-visible:ring-warning',
    },
  },
  
  defaultVariants: {
    size: 'md',
    state: 'default',
  },
} as const;

/**
 * Card style variants
 */
export const cardStyles = {
  base: 'rounded-card border border-border-primary bg-surface-primary text-text-primary shadow-card',
  
  variants: {
    variant: {
      default: '',
      elevated: 'shadow-elevated',
      outlined: 'border-2',
      filled: 'bg-surface-secondary',
    },
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
      xl: 'p-8',
    },
  },
  
  defaultVariants: {
    variant: 'default',
    padding: 'md',
  },
} as const;

/**
 * Badge style variants
 */
export const badgeStyles = {
  base: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  
  variants: {
    variant: {
      default: 'border-transparent bg-secondary text-white',
      primary: 'border-transparent bg-primary text-white',
      secondary: 'border-transparent bg-surface-secondary text-text-primary',
      success: 'border-transparent bg-success text-white',
      warning: 'border-transparent bg-warning text-white',
      error: 'border-transparent bg-error text-white',
      outline: 'text-text-primary border-border-primary',
    },
    size: {
      sm: 'px-1.5 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-xs',
      lg: 'px-3 py-1 text-sm',
    },
  },
  
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
} as const;

// ==================== Status-Specific Styles ====================

/**
 * Case status styling
 */
export const caseStatusStyles = {
  PENDING: 'bg-status-pending text-white',
  IN_PROGRESS: 'bg-status-in-progress text-white',
  COMPLETED: 'bg-status-completed text-white',
  APPROVED: 'bg-status-approved text-white',
  REJECTED: 'bg-status-rejected text-white',
  REWORK_REQUIRED: 'bg-status-rework-required text-white',
} as const;

/**
 * Priority styling
 */
export const priorityStyles = {
  '1': 'bg-priority-low text-white', // Low
  '2': 'bg-priority-medium text-white', // Medium
  '3': 'bg-priority-high text-white', // High
  '4': 'bg-priority-urgent text-white', // Urgent
  '5': 'bg-priority-critical text-white', // Critical
} as const;

/**
 * Role styling
 */
export const roleStyles = {
  SUPER_ADMIN: 'bg-role-super-admin text-white',
  BACKEND_USER: 'bg-role-backend-user text-white',
  FIELD_AGENT: 'bg-role-field-agent text-white',
} as const;

// ==================== Layout Patterns ====================

/**
 * Common layout patterns
 */
export const layoutStyles = {
  // Page layouts
  page: 'min-h-screen bg-background-primary',
  pageHeader: 'border-b border-border-primary bg-surface-primary px-6 py-4',
  pageContent: 'flex-1 p-6',
  
  // Container patterns
  container: 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8',
  section: 'py-8',
  
  // Grid patterns
  grid: 'grid gap-6',
  gridCols: {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    auto: 'grid-cols-[repeat(auto-fit,minmax(250px,1fr))]',
  },
  
  // Flex patterns
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexCol: 'flex flex-col',
  flexRow: 'flex flex-row',
  
  // Spacing patterns
  stack: 'space-y-4',
  stackSm: 'space-y-2',
  stackLg: 'space-y-6',
  inline: 'space-x-4',
  inlineSm: 'space-x-2',
  inlineLg: 'space-x-6',
} as const;

// ==================== Animation Patterns ====================

/**
 * Common animation classes
 */
export const animationStyles = {
  // Transitions
  transition: 'transition-all duration-200 ease-in-out',
  transitionFast: 'transition-all duration-100 ease-in-out',
  transitionSlow: 'transition-all duration-300 ease-in-out',
  
  // Hover effects
  hoverScale: 'hover:scale-105 transition-transform duration-200',
  hoverLift: 'hover:-translate-y-1 hover:shadow-lg transition-all duration-200',
  
  // Loading states
  pulse: 'animate-pulse',
  spin: 'animate-spin',
  bounce: 'animate-bounce-subtle',
  
  // Enter/exit animations
  fadeIn: 'animate-fade-in',
  slideIn: 'animate-slide-in',
} as const;

// ==================== Focus and Accessibility ====================

/**
 * Focus and accessibility patterns
 */
export const a11yStyles = {
  // Focus styles
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2',
  focusVisible: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
  
  // Screen reader only
  srOnly: 'sr-only',
  
  // Skip links
  skipLink: 'absolute left-[-10000px] top-auto w-1 h-1 overflow-hidden focus:left-6 focus:top-6 focus:w-auto focus:h-auto focus:overflow-visible',
} as const;

// ==================== Responsive Breakpoints ====================

/**
 * Responsive design patterns
 */
export const responsiveStyles = {
  // Mobile first approach
  mobile: '', // Default (no prefix)
  tablet: 'md:', // 768px and up
  desktop: 'lg:', // 1024px and up
  wide: 'xl:', // 1280px and up
  ultrawide: '2xl:', // 1536px and up
  
  // Common responsive patterns
  hideMobile: 'hidden md:block',
  hideDesktop: 'block md:hidden',
  stackMobile: 'flex-col md:flex-row',
  centerMobile: 'text-center md:text-left',
} as const;

// ==================== Theme Utilities ====================

/**
 * Theme-aware styling utilities
 */
export const themeStyles = {
  // Theme toggle classes
  light: '[data-theme="light"] &',
  dark: '[data-theme="dark"] &',
  
  // Color scheme classes
  primary: 'text-primary',
  secondary: 'text-secondary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-info',
  
  // Background variants
  bgPrimary: 'bg-background-primary',
  bgSecondary: 'bg-background-secondary',
  bgSurface: 'bg-surface-primary',
  
  // Border variants
  borderPrimary: 'border-border-primary',
  borderSecondary: 'border-border-secondary',
} as const;

// ==================== Component Composition Helpers ====================

/**
 * Helper functions for component styling
 */
export const styleHelpers = {
  /**
   * Get status-based styling
   */
  getStatusStyle: (status: string): string => {
    const statusKey = status.toUpperCase().replace('-', '_') as keyof typeof caseStatusStyles;
    return caseStatusStyles[statusKey] || caseStatusStyles.PENDING;
  },
  
  /**
   * Get priority-based styling
   */
  getPriorityStyle: (priority: number | string): string => {
    const priorityKey = String(priority) as keyof typeof priorityStyles;
    return priorityStyles[priorityKey] || priorityStyles['1'];
  },
  
  /**
   * Get role-based styling
   */
  getRoleStyle: (role: string): string => {
    const roleKey = role.toUpperCase().replace('-', '_') as keyof typeof roleStyles;
    return roleStyles[roleKey] || roleStyles.BACKEND_USER;
  },
  
  /**
   * Create responsive grid classes
   */
  createGridCols: (cols: number): string => {
    if (cols <= 1) {return layoutStyles.gridCols[1];}
    if (cols <= 2) {return layoutStyles.gridCols[2];}
    if (cols <= 3) {return layoutStyles.gridCols[3];}
    if (cols <= 4) {return layoutStyles.gridCols[4];}
    return layoutStyles.gridCols.auto;
  },
  
  /**
   * Combine multiple style objects
   */
  combineStyles: (...styles: (string | undefined | null | false)[]): string => {
    return cn(...styles.filter(Boolean));
  },
};

// ==================== Export Everything ====================


export default cn;
