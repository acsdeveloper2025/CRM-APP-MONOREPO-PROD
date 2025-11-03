/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    // Enhanced responsive breakpoints
    screens: {
      'xs': '320px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      // Custom breakpoints for specific use cases
      'mobile': '375px',
      'tablet': '768px',
      'desktop': '1024px',
      'wide': '1440px',
    },
    extend: {
      colors: {
        // NEW COLOR SCHEME: Green accent with off-white backgrounds
        // Primary color scheme - Green (Emerald)
        primary: {
          50: '#f0fdf4',   // emerald-50 - very light green
          100: '#d1fae5',  // emerald-100 - light green backgrounds
          200: '#a7f3d0',  // emerald-200
          300: '#6ee7b7',  // emerald-300
          400: '#34d399',  // emerald-400
          500: '#10b981',  // emerald-500 - PRIMARY GREEN ACCENT
          600: '#059669',  // emerald-600 - hover state
          700: '#047857',  // emerald-700 - active state
          800: '#065f46',  // emerald-800 - dark emphasis
          900: '#064e3b',  // emerald-900
          950: '#022c22',  // emerald-950
        },

        // Secondary color scheme - Gray (for text and borders)
        secondary: {
          50: '#fafafa',   // off-white - page background
          100: '#f5f5f5',  // very light gray
          200: '#e5e5e5',  // light gray - borders
          300: '#d4d4d4',  // medium-light gray
          400: '#a3a3a3',  // medium gray
          500: '#737373',  // neutral gray
          600: '#525252',  // dark gray
          700: '#404040',  // darker gray
          800: '#262626',  // very dark gray
          900: '#171717',  // almost black
          950: '#0a0a0a',  // near black
        },

        // Background colors - NEW SCHEME (Light & Dark Mode)
        background: {
          DEFAULT: '#fafafa',      // Off-white page background (light)
          page: '#fafafa',         // Page background (light)
          card: '#ffffff',         // Card/container background (light)
          surface: '#f9fafb',      // Surface elements (light)
          elevated: '#ffffff',     // Elevated elements (light)
          navbar: '#000000',       // Black navbar (light)
          'navbar-hover': '#1f1f1f', // Navbar hover (light)
          'navbar-active': '#2a2a2a', // Navbar active (light)
          // Dark mode backgrounds
          'dark-page': '#0f172a',      // Dark page background (slate-900)
          'dark-card': '#1e293b',      // Dark card background (slate-800)
          'dark-surface': '#1e293b',   // Dark surface (slate-800)
          'dark-elevated': '#334155',  // Dark elevated (slate-700)
          'dark-navbar': '#020617',    // Dark navbar (slate-950)
          'dark-navbar-hover': '#1e293b', // Dark navbar hover
          'dark-navbar-active': '#334155', // Dark navbar active
        },

        // Foreground/Text colors - NEW SCHEME (Light & Dark Mode)
        foreground: {
          DEFAULT: '#000000',      // Primary black text (light)
          primary: '#000000',      // Headings, important text (light)
          secondary: '#1f2937',    // Body text (light)
          tertiary: '#6b7280',     // Labels, secondary info (light)
          muted: '#9ca3af',        // Hints, placeholders (light)
          disabled: '#d1d5db',     // Disabled text (light)
          inverse: '#ffffff',      // Text on dark backgrounds
          // Dark mode text colors
          'dark-primary': '#f1f5f9',    // Primary text (dark) - slate-100
          'dark-secondary': '#cbd5e1',  // Secondary text (dark) - slate-300
          'dark-tertiary': '#94a3b8',   // Tertiary text (dark) - slate-400
          'dark-muted': '#64748b',      // Muted text (dark) - slate-500
          'dark-disabled': '#475569',   // Disabled text (dark) - slate-600
        },

        // Accent colors - Green theme
        accent: {
          DEFAULT: '#10b981',      // Primary green
          primary: '#10b981',      // emerald-500
          hover: '#059669',        // emerald-600
          active: '#047857',       // emerald-700
          light: '#d1fae5',        // emerald-100
          lighter: '#f0fdf4',      // emerald-50
          dark: '#065f46',         // emerald-800
        },

        // Semantic colors for CRM-specific use cases
        status: {
          pending: '#f59e0b',      // amber - pending
          'in-progress': '#3b82f6', // blue - in progress
          completed: '#10b981',    // green - completed
          approved: '#059669',     // dark green - approved
          rejected: '#ef4444',     // red - rejected
          'rework-required': '#f97316', // orange - rework
        },

        priority: {
          low: '#6b7280',          // gray - low priority
          medium: '#f59e0b',       // amber - medium
          high: '#f97316',         // orange - high
          urgent: '#ef4444',       // red - urgent
          critical: '#dc2626',     // dark red - critical
        },

        role: {
          'super-admin': '#7c3aed', // purple
          admin: '#10b981',        // green (updated to match theme)
          manager: '#059669',      // dark green
          'backend-user': '#0891b2', // cyan
          'field-agent': '#ea580c', // orange
          'report-person': '#7c2d12', // brown
        },

        // Surface colors for consistent backgrounds
        surface: {
          primary: 'var(--color-surface-primary)',
          secondary: 'var(--color-surface-secondary)',
          elevated: 'var(--color-surface-elevated)',
        },

        // Border colors - NEW SCHEME (Light & Dark Mode)
        border: {
          DEFAULT: '#e5e7eb',      // Default border (light)
          primary: '#e5e7eb',      // gray-200 (light)
          secondary: '#d1d5db',    // gray-300 (light)
          light: '#f3f4f6',        // gray-100 (light)
          medium: '#9ca3af',       // gray-400 (light)
          dark: '#6b7280',         // gray-500 (light)
          focus: '#10b981',        // green focus
          // Dark mode borders
          'dark-primary': '#334155',    // slate-700 (dark)
          'dark-secondary': '#475569',  // slate-600 (dark)
          'dark-light': '#1e293b',      // slate-800 (dark)
          'dark-medium': '#64748b',     // slate-500 (dark)
          'dark-focus': '#10b981',      // green focus (dark)
        },

        // Text colors
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          inverse: 'var(--color-text-inverse)',
          disabled: 'var(--color-text-disabled)',
        },
      },

      // Custom spacing for consistent layouts
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        // Mobile-friendly spacing
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },

      // Enhanced responsive container sizes
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '1.5rem',
          lg: '2rem',
          xl: '2.5rem',
          '2xl': '3rem',
        },
        screens: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1400px',
        },
      },

      // Custom shadows
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'elevated': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },

      // Custom border radius
      borderRadius: {
        'card': '0.75rem',
        'button': '0.5rem',
      },

      // Custom font sizes
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },

      // Animation and transitions
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'bounce-subtle': 'bounceSubtle 0.6s ease-in-out',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
}
