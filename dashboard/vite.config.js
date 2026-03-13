import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: false,
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/ws': {
        target: 'ws://127.0.0.1:3000',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'chart': ['chart.js']
        }
      }
    }
  }
});
