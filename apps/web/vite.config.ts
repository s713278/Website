import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
  },
  /** Load monorepo root `.env` + local `apps/web/.env*` */
  envDir: path.resolve(__dirname, '../..'),
  envPrefix: ['VITE_', 'MITHRA_'],
});
