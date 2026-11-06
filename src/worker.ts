import { DEFAULT_API_BASE, productCrawlerHtml } from './shared/lib/share-crawler'

type AssetBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

type Env = {
  ASSETS: AssetBinding
  API_BASE_URL?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'GET' || request.method === 'HEAD') {
      try {
        const html = await productCrawlerHtml(request, env.API_BASE_URL || DEFAULT_API_BASE)
        if (html) {
          return new Response(request.method === 'HEAD' ? null : html, {
            headers: {
              'content-type': 'text/html; charset=utf-8',
              'cache-control': 'public, max-age=300',
            },
          })
        }
      } catch {
        // A preview miss still serves the shop.
      }
    }
    return env.ASSETS.fetch(request)
  },
}
