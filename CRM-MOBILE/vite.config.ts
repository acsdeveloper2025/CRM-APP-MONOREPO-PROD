import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';

    return {
      plugins: [
        react({
          jsxRuntime: 'automatic'
        })
      ],
      server: {
        port: 5180,
        strictPort: true,
        host: '0.0.0.0', // Bind to all network interfaces for both localhost and network access
        cors: true // Enable CORS for cross-origin requests
      },
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        global: 'globalThis',
        __DEV__: JSON.stringify(mode === 'development'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'react-native': 'react-native-web',
          'react-native-svg': 'react-native-svg-web',
          '@react-native-async-storage/async-storage': path.resolve(__dirname, 'polyfills/AsyncStorage.ts'),
          'expo-clipboard': path.resolve(__dirname, 'polyfills/Clipboard.ts'),
        },
        extensions: ['.web.js', '.web.ts', '.web.tsx', '.js', '.ts', '.tsx', '.json']
      },
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-native-web',
        ],
        exclude: []
      },
      build: {
        // Increase chunk size warning limit to 1000kb
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            // Manual chunk splitting for better caching and loading
            manualChunks: {
              // React ecosystem
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],

              // React Native Web
              'react-native-vendor': ['react-native-web'],

              // Capacitor plugins
              'capacitor-vendor': [
                '@capacitor/core',
                '@capacitor/camera',
                '@capacitor/geolocation',
                '@capacitor/device',
                '@capacitor/filesystem',
                '@capacitor/clipboard',
                '@capacitor/app',
                '@capacitor/local-notifications',
                '@capacitor/push-notifications',
                '@capacitor/splash-screen',
                '@capacitor/status-bar'
              ],

              // Google Maps
              'google-maps': ['@googlemaps/js-api-loader'],

              // Crypto utilities
              'crypto-vendor': ['crypto-js'],

              // Forms - split by category
              'forms-residence': [
                './components/forms/residence/PositiveResidenceForm',
                './components/forms/residence/NspResidenceForm',
                './components/forms/residence/ShiftedResidenceForm',
                './components/forms/residence/EntryRestrictedResidenceForm',
                './components/forms/residence/UntraceableResidenceForm'
              ],

              'forms-office': [
                './components/forms/office/PositiveOfficeForm',
                './components/forms/office/NspOfficeForm',
                './components/forms/office/ShiftedOfficeForm',
                './components/forms/office/EntryRestrictedOfficeForm',
                './components/forms/office/UntraceableOfficeForm'
              ],

              'forms-business': [
                './components/forms/business/PositiveBusinessForm',
                './components/forms/business/NspBusinessForm',
                './components/forms/business/ShiftedBusinessForm',
                './components/forms/business/EntryRestrictedBusinessForm',
                './components/forms/business/UntraceableBusinessForm'
              ],

              'forms-other': [
                './components/forms/builder',
                './components/forms/noc',
                './components/forms/property-individual',
                './components/forms/property-apf',
                './components/forms/residence-cum-office',
                './components/forms/dsa-dst-connector'
              ]
            },

            // Optimize chunk file names
            chunkFileNames: (chunkInfo) => {
              const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
              return `assets/[name]-[hash].js`;
            },

            // Optimize asset file names
            assetFileNames: (assetInfo) => {
              const info = assetInfo.name.split('.');
              const ext = info[info.length - 1];
              if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
                return `assets/images/[name]-[hash][extname]`;
              }
              if (/css/i.test(ext)) {
                return `assets/css/[name]-[hash][extname]`;
              }
              return `assets/[name]-[hash][extname]`;
            }
          }
        },

        // Enable minification in production
        minify: isProduction ? 'terser' : false,

        // Terser options for better compression
        terserOptions: isProduction ? {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
          },
          mangle: {
            safari10: true
          },
          format: {
            safari10: true
          }
        } : undefined,

        // Source maps for debugging
        sourcemap: !isProduction,

        // Target modern browsers for smaller bundles
        target: ['es2020', 'chrome80', 'safari13'],

        // CSS code splitting
        cssCodeSplit: true
      }
    };
});
