/** Browser transport only. Entitlements, prices and signature verification belong to the service/backend. */
export interface SubscriptionCheckoutConfig {
  keyId: string
  subscriptionId: string
  name: string
  description?: string
}

export interface SubscriptionCheckoutCallback {
  razorpay_payment_id: string
  razorpay_subscription_id: string
  razorpay_signature: string
}

export type SubscriptionCheckoutResult =
  | { status: 'submitted'; callback: SubscriptionCheckoutCallback }
  | { status: 'dismissed' }

interface RazorpayOptions {
  key: string
  subscription_id: string
  name: string
  description?: string
  handler: (response: SubscriptionCheckoutCallback) => void
  modal: { ondismiss: () => void }
  retry: { enabled: boolean }
  theme: { color: string }
}

interface RazorpayInstance {
  open: () => void
  close: () => void
  on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'
let scriptPromise: Promise<void> | null = null

export function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    const finish = (error?: Error) => {
      window.clearTimeout(timeout)
      script.onload = null
      script.onerror = null
      if (error) {
        script.remove()
        reject(error)
      } else {
        resolve()
      }
    }
    const timeout = window.setTimeout(() => finish(new Error('Razorpay took too long to load. Please try again.')), 15000)
    script.onload = () => finish(window.Razorpay ? undefined : new Error('Razorpay could not start. Please try again.'))
    script.onerror = () => finish(new Error('Could not load Razorpay. Check your connection and try again.'))
    document.head.append(script)
  }).catch((error: unknown) => {
    scriptPromise = null
    throw error
  })
  return scriptPromise
}

export async function openSubscriptionCheckout(
  config: SubscriptionCheckoutConfig,
  options: { signal?: AbortSignal; onPaymentFailure?: (message: string) => void } = {},
): Promise<SubscriptionCheckoutResult> {
  const { signal, onPaymentFailure } = options
  if (signal?.aborted) throw new DOMException('Checkout cancelled', 'AbortError')
  await loadRazorpayCheckout()
  if (signal?.aborted) throw new DOMException('Checkout cancelled', 'AbortError')
  const Razorpay = window.Razorpay
  if (!Razorpay) throw new Error('Razorpay is unavailable. Please try again.')

  return new Promise((resolve, reject) => {
    let settled = false
    let checkout: RazorpayInstance | undefined
    const finish = (result: SubscriptionCheckoutResult | Error) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abort)
      if ('status' in result) resolve(result)
      else reject(result)
    }
    const abort = () => {
      finish(new DOMException('Checkout cancelled', 'AbortError'))
      checkout?.close()
    }

    try {
      checkout = new Razorpay({
        key: config.keyId,
        subscription_id: config.subscriptionId,
        name: config.name,
        description: config.description,
        handler: (callback) => finish({ status: 'submitted', callback }),
        modal: { ondismiss: () => finish({ status: 'dismissed' }) },
        retry: { enabled: true },
        theme: { color: '#059669' },
      })
      // Failure is not terminal: Checkout can offer another payment attempt in the same modal.
      checkout.on('payment.failed', ({ error }) => {
        if (!settled) onPaymentFailure?.(error?.description || 'The payment attempt failed. You can retry in Checkout.')
      })
      signal?.addEventListener('abort', abort, { once: true })
      checkout.open()
    } catch (error) {
      finish(error instanceof Error ? error : new Error('Could not open Razorpay Checkout.'))
    }
  })
}
