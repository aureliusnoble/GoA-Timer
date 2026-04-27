// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/GoA-Timer/' : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['victory', 'recharts'],
          'vendor-graph': ['d3-force', 'react-force-graph-2d'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-utils': ['html2canvas', 'peerjs', 'openskill'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
