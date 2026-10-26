import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://127.0.0.1:5000' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
  build: { rollupOptions: { output: { manualChunks: { charts: ['recharts'], vendor: ['react','react-dom','react-router-dom'] } } } },
});
