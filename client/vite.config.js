import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, './src') },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['seraph-dash.gryff.app', 'seraph-dash-api.gryff.app'],
    headers: { 'Cache-Control': 'no-store', 'Permissions-Policy': 'autoplay=*' },
    proxy: {
      '/api':   'http://127.0.0.1:3001',
      '/music': 'http://127.0.0.1:3001',
      '/ws':    { target: 'ws://127.0.0.1:3001', ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
