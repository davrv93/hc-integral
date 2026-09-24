import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Same-origin proxy: lets the app be reached through a single public
    // hostname (e.g. a tunnel) without baking localhost URLs into the
    // client bundle. See VITE_AUTH_URL/VITE_API_URL in src/lib/{auth,api}.ts
    // — they default to '' (relative), which routes through here.
    proxy: {
      '/oauth': { target: 'http://localhost:8080', changeOrigin: true },
      '/.well-known': { target: 'http://localhost:8080', changeOrigin: true },
      '/api': { target: 'http://localhost:8081', changeOrigin: true },
    },
    // Required so *.trycloudflare.com (or any tunnel host) is accepted;
    // Vite otherwise rejects unrecognized Host headers.
    allowedHosts: true,
  },
})
