import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true, // Fail if port 5173 is not available instead of trying other ports
    host: '0.0.0.0', // Bind to all network interfaces for both localhost and network access
    cors: true, // Enable CORS for cross-origin requests
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      process.env.VITE_STATIC_IP || '103.14.234.36',
      'crm.allcheckservices.com',
      'www.crm.allcheckservices.com'
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks for better caching
          if (id.includes('node_modules')) {
            // Keep React in main vendor chunk to ensure it's loaded first
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor';
            }

            // UI library chunks
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('class-variance-authority')) {
              return 'ui-vendor';
            }

            // Data management
            if (id.includes('@tanstack/react-query') || id.includes('axios')) {
              return 'data-vendor';
            }

            // Form libraries
            if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
              return 'form-vendor';
            }

            // Utility libraries
            if (id.includes('date-fns') || id.includes('lodash') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'utils-vendor';
            }

            // Chart/visualization libraries
            if (id.includes('recharts') || id.includes('chart.js') || id.includes('d3')) {
              return 'charts-vendor';
            }

            // Other vendor libraries - this will include React dependencies
            return 'vendor';
          }

          // Application chunks based on features
          if (id.includes('/pages/cases/')) {
            return 'cases-pages';
          }

          if (id.includes('/pages/users/')) {
            return 'users-pages';
          }

          if (id.includes('/pages/reports/')) {
            return 'reports-pages';
          }

          if (id.includes('/pages/commission/')) {
            return 'commission-pages';
          }

          if (id.includes('/pages/settings/')) {
            return 'settings-pages';
          }

          if (id.includes('/components/forms/')) {
            return 'forms-components';
          }

          if (id.includes('/components/charts/')) {
            return 'charts-components';
          }

          if (id.includes('/components/tables/')) {
            return 'tables-components';
          }

          if (id.includes('/services/')) {
            return 'services';
          }

          // Default chunk
          return undefined;
        },

        // Optimize chunk naming for better caching
        chunkFileNames: () => {
          return `assets/[name]-[hash].js`;
        },

        // Optimize asset naming
        assetFileNames: (assetInfo) => {
          const fileName = assetInfo.names?.[0] || 'asset';
          const info = fileName.split('.');
          const ext = info[info.length - 1];

          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(fileName)) {
            return 'assets/images/[name]-[hash].[ext]';
          }

          if (/\.(woff2?|eot|ttf|otf)$/i.test(fileName)) {
            return 'assets/fonts/[name]-[hash].[ext]';
          }

          if (ext === 'css') {
            return 'assets/styles/[name]-[hash].[ext]';
          }

          return 'assets/[name]-[hash].[ext]';
        },
      },
    },

    // Optimize build settings
    sourcemap: process.env.NODE_ENV === 'development',
    chunkSizeWarningLimit: 1000, // Reduced for better performance
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: process.env.NODE_ENV === 'production'
          ? ['console.log', 'console.info', 'console.debug', 'console.warn']
          : [],
        passes: 2, // Multiple passes for better compression
      },
      mangle: {
        safari10: true, // Fix Safari 10 issues
      },
      format: {
        comments: false,
      },
    },

    // Modern browser targets for smaller bundles
    target: ['es2020', 'chrome80', 'safari13', 'firefox78', 'edge88'],

    // Enable CSS code splitting for better caching
    cssCodeSplit: true,

    // Optimize CSS
    cssMinify: true,

    // Tree shaking is already configured in rollupOptions above
  },
})
