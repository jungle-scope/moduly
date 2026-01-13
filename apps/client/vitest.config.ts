import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    alias: {
      '@/lib': path.resolve(__dirname, './lib'),
      '@': path.resolve(__dirname, './app'),
    },
  },
});
