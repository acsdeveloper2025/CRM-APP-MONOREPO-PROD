/**
 * Unified Color System for CRM Frontend
 * 
 * This file defines a consistent color palette and naming convention
 * to be used across all components and styling approaches.
 */

// Base color palette
export const colors = {
  // Primary colors
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // Main primary
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },

  // Secondary colors
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b', // Main secondary
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },

  // Success colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // Main success
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },

  // Warning colors
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b', // Main warning
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },

  // Error colors
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444', // Main error
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },

  // Info colors
  info: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9', // Main info
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },

  // Neutral colors (for backgrounds, borders, text)
  neutral: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    750: '#333333',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },

  // Semantic colors for specific use cases
  semantic: {
    // Case status colors
    pending: '#f59e0b', // warning-500
    inProgress: '#3b82f6', // primary-500
    completed: '#22c55e', // success-500
    approved: '#059669', // emerald-600
    rejected: '#ef4444', // error-500
    reworkRequired: '#f97316', // orange-500

    // Priority colors
    low: '#6b7280', // gray-500
    medium: '#f59e0b', // warning-500
    high: '#f97316', // orange-500
    urgent: '#ef4444', // error-500
    critical: '#dc2626', // red-600

    // Form validation colors
    valid: '#22c55e', // success-500
    invalid: '#ef4444', // error-500
    warning: '#f59e0b', // warning-500
    formPending: '#6b7280', // gray-500

    // User role colors
    superAdmin: '#7c3aed', // violet-600
    admin: '#2563eb', // blue-600
    manager: '#059669', // emerald-600
    backendUser: '#0891b2', // cyan-600
    fieldAgent: '#ea580c', // orange-600
    reportPerson: '#7c2d12', // amber-800
  },
} as const;

// Color scheme variants
export const colorSchemes = {
  blue: {
    primary: colors.primary,
    accent: colors.info,
  },
  green: {
    primary: {
      ...colors.primary,
      500: '#059669', // emerald-600
      600: '#047857', // emerald-700
      700: '#065f46', // emerald-800
    },
    accent: colors.success,
  },
  purple: {
    primary: {
      ...colors.primary,
      500: '#7c3aed', // violet-600
      600: '#6d28d9', // violet-700
      700: '#5b21b6', // violet-800
    },
    accent: {
      ...colors.info,
      500: '#8b5cf6', // violet-500
    },
  },
  orange: {
    primary: {
      ...colors.primary,
      500: '#ea580c', // orange-600
      600: '#dc2626', // red-600
      700: '#b91c1c', // red-700
    },
    accent: colors.warning,
  },
} as const;

// Theme-specific colors
export const themeColors = {
  light: {
    background: {
      primary: colors.neutral[0], // white
      secondary: colors.neutral[50], // gray-50
      tertiary: colors.neutral[100], // gray-100
    },
    surface: {
      primary: colors.neutral[0], // white
      secondary: colors.neutral[50], // gray-50
      elevated: colors.neutral[0], // white with shadow
    },
    border: {
      primary: colors.neutral[200], // gray-200
      secondary: colors.neutral[300], // gray-300
      focus: colors.primary[500], // blue-500
    },
    text: {
      primary: colors.neutral[900], // gray-900
      secondary: colors.neutral[600], // gray-600
      tertiary: colors.neutral[500], // gray-500
      inverse: colors.neutral[0], // white
      disabled: colors.neutral[400], // gray-400
    },
  },
  dark: {
    background: {
      primary: colors.neutral[900], // gray-900
      secondary: colors.neutral[800], // gray-800
      tertiary: colors.neutral[700], // gray-700
    },
    surface: {
      primary: colors.neutral[800], // gray-800
      secondary: colors.neutral[700], // gray-700
      elevated: colors.neutral[750], // custom elevated surface
    },
    border: {
      primary: colors.neutral[700], // gray-700
      secondary: colors.neutral[600], // gray-600
      focus: colors.primary[400], // blue-400
    },
    text: {
      primary: colors.neutral[100], // gray-100
      secondary: colors.neutral[300], // gray-300
      tertiary: colors.neutral[400], // gray-400
      inverse: colors.neutral[900], // gray-900
      disabled: colors.neutral[500], // gray-500
    },
  },
} as const;

// CSS custom properties for dynamic theming
export const cssVariables = {
  light: {
    '--color-primary': colors.primary[500],
    '--color-primary-hover': colors.primary[600],
    '--color-primary-active': colors.primary[700],
    '--color-secondary': colors.secondary[500],
    '--color-success': colors.success[500],
    '--color-warning': colors.warning[500],
    '--color-error': colors.error[500],
    '--color-info': colors.info[500],
    
    '--color-background-primary': themeColors.light.background.primary,
    '--color-background-secondary': themeColors.light.background.secondary,
    '--color-surface-primary': themeColors.light.surface.primary,
    '--color-border-primary': themeColors.light.border.primary,
    '--color-text-primary': themeColors.light.text.primary,
    '--color-text-secondary': themeColors.light.text.secondary,
    
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
  dark: {
    '--color-primary': colors.primary[400],
    '--color-primary-hover': colors.primary[500],
    '--color-primary-active': colors.primary[600],
    '--color-secondary': colors.secondary[400],
    '--color-success': colors.success[400],
    '--color-warning': colors.warning[400],
    '--color-error': colors.error[400],
    '--color-info': colors.info[400],
    
    '--color-background-primary': themeColors.dark.background.primary,
    '--color-background-secondary': themeColors.dark.background.secondary,
    '--color-surface-primary': themeColors.dark.surface.primary,
    '--color-border-primary': themeColors.dark.border.primary,
    '--color-text-primary': themeColors.dark.text.primary,
    '--color-text-secondary': themeColors.dark.text.secondary,
    
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
    '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
  },
} as const;

// Utility functions for color manipulation
export const colorUtils = {
  // Get color by status
  getStatusColor: (status: string): string => {
    const statusMap: Record<string, string> = {
      pending: colors.semantic.pending,
      'in-progress': colors.semantic.inProgress,
      completed: colors.semantic.completed,
      approved: colors.semantic.approved,
      rejected: colors.semantic.rejected,
      'rework-required': colors.semantic.reworkRequired,
    };
    return statusMap[status.toLowerCase()] || colors.neutral[500];
  },

  // Get color by priority
  getPriorityColor: (priority: number | string): string => {
    const priorityMap: Record<string, string> = {
      '1': colors.semantic.low,
      '2': colors.semantic.medium,
      '3': colors.semantic.high,
      '4': colors.semantic.urgent,
      '5': colors.semantic.critical,
      low: colors.semantic.low,
      medium: colors.semantic.medium,
      high: colors.semantic.high,
      urgent: colors.semantic.urgent,
      critical: colors.semantic.critical,
    };
    return priorityMap[String(priority).toLowerCase()] || colors.neutral[500];
  },

  // Get color by role
  getRoleColor: (role: string): string => {
    const roleMap: Record<string, string> = {
      'super-admin': colors.semantic.superAdmin,
      admin: colors.semantic.admin,
      manager: colors.semantic.manager,
      'backend-user': colors.semantic.backendUser,
      'field-agent': colors.semantic.fieldAgent,
      'report-person': colors.semantic.reportPerson,
    };
    return roleMap[role.toLowerCase().replace('_', '-')] || colors.neutral[500];
  },

  // Convert hex to RGB
  hexToRgb: (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  },

  // Add opacity to color
  withOpacity: (color: string, opacity: number): string => {
    const rgb = colorUtils.hexToRgb(color);
    return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : color;
  },
};

export default colors;
