import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { DEFAULT_API_BASE, productCrawlerHtml } from './src/shared/lib/share-crawler.ts'
import { isShareCrawler } from './src/shared/lib/share-preview.ts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const apiBase =
  loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', rootDir, '')
    .VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE


function productSharePreview(apiBase: string): Plugin {
  return {
    name: 'product-share-preview',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const agent = String(req.headers['user-agent'] ?? '')
        if ((req.method !== 'GET' && req.method !== 'HEAD') || !req.url || !isShareCrawler(agent)) {
          return next()
        }
        const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
          method: req.method,
          headers: { 'user-agent': String(req.headers['user-agent'] ?? '') },
        })
        void productCrawlerHtml(request, apiBase)
          .then((html) => {
            if (!html) return next()
            res.statusCode = 200
            res.setHeader('content-type', 'text/html; charset=utf-8')
            res.end(req.method === 'HEAD' ? undefined : html)
          })
          .catch(() => next())
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), productSharePreview(apiBase)],
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
        rewrite: (requestPath) => requestPath.replace(/^\/__local_vendor_billing_test/, ''),
      },
    },
  },
})
