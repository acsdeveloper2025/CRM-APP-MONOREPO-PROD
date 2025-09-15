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
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
            "lucide-react",
          ],
          "data-vendor": ["@tanstack/react-query"],
        },
      },
    },
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})
