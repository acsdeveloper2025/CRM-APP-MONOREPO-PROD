/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./screens/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./polyfills/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#111827',
        'dark-card': '#1F2937',
        'dark-border': '#374151',
        'medium-text': '#9CA3AF',
        'light-text': '#F9FAFB',
        'primary': '#00a950',
        'secondary': '#6B7280',
        'accent': '#3B82F6',
        'danger': '#EF4444',
        'warning': '#F59E0B',
        'success': '#10B981',
        'brand': {
          'primary': '#00a950',
          'secondary': '#008a44',
        },
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      padding: {
        'safe': 'max(4px, env(safe-area-inset-top)) env(safe-area-inset-right) max(4px, env(safe-area-inset-bottom)) env(safe-area-inset-left)',
        'safe-t': 'max(2px, env(safe-area-inset-top))',
        'safe-b': 'max(4px, env(safe-area-inset-bottom))',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)',
      },
      margin: {
        'safe-t': 'max(2px, env(safe-area-inset-top))',
        'safe-b': 'max(4px, env(safe-area-inset-bottom))',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)',
      },
      minHeight: {
        'screen-safe': 'calc(100vh - max(2px, env(safe-area-inset-top)) - max(4px, env(safe-area-inset-bottom)))',
        'dvh': '100dvh',
      },
      height: {
        'screen-safe': 'calc(100vh - max(2px, env(safe-area-inset-top)) - max(4px, env(safe-area-inset-bottom)))',
        'dvh': '100dvh',
      },
    },
  },
  plugins: [],
}
