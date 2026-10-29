import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      '@mithra/api-client': path.resolve(rootDir, './packages/api-client/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/__local_vendor_billing_test': {
        target: 'http://127.0.0.1:4179',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__local_vendor_billing_test/, ''),
      },
    },
  },
})
