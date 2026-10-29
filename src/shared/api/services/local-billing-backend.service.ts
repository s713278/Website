import { ApiError, type ApiEnvelope } from '@mithra/api-client'

/**
 * Local development demo mode only: the backend's billing routes served by the local Razorpay Test
 * helper (`npm run dev:billing-helper`), which Vite proxies. It has the same operations and envelope
 * as the package's `vendorBillingService`, so the Live Plan reads it unchanged.
 */
const endpoint = '/__local_vendor_billing_test'
const helperDown = 'The local Razorpay Test helper is not running. Start npm run dev:billing-helper, then try again.'

async function request(path: string, init: { body?: object; signal?: AbortSignal } = {}): Promise<ApiEnvelope> {
  let response: Response
  try {
    response = await fetch(`${endpoint}${path}`, {
      method: init.body ? 'POST' : 'GET',
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
      cache: 'no-store',
    })
  } catch (error) {
    if (init.signal?.aborted) throw error
    throw new ApiError(helperDown, 0, null, path, 'network')
  }
  const envelope = await response.json().catch(() => null) as (ApiEnvelope & { message?: string }) | null
  // Vite answers 502 or 504 with no envelope while the helper is down.
  if (!envelope) throw new ApiError(helperDown, response.status, null, path, 'server')
  if (!response.ok) throw new ApiError(envelope.message ?? 'The local billing helper refused the request.', response.status, envelope, path, response.status === 404 ? 'not_found' : response.status >= 500 ? 'server' : 'client')
  return envelope
}

const vendorPath = (vendorId: number | string) => `/api/v1/vendors/${encodeURIComponent(String(vendorId))}/subscription`

export const localBillingBackend = {
  getSubscription: (vendorId: number | string, config?: { signal?: AbortSignal }) => request(vendorPath(vendorId), config),
  subscribe: (vendorId: number | string, body: { plan_code: string }) => request(vendorPath(vendorId), { body }),
  confirm: (vendorId: number | string, body: object) => request(`${vendorPath(vendorId)}/confirm`, { body }),
  cancel: (vendorId: number | string) => request(`${vendorPath(vendorId)}/cancel`, { body: {} }),
  getHistory: (vendorId: number | string, config?: { signal?: AbortSignal }) => request(`${vendorPath(vendorId)}/history`, config),
  listPaidPlans: (config?: { signal?: AbortSignal }) => request('/api/v1/subscription-plans', config),
}

/** The helper's seeded billing scenarios, for the development panel under Plan. */
export const localBillingScenarios = ['free_days', 'three_days_left', 'trial_ending_soon', 'trial_ended', 'paid', 'stopped', 'autopay_off', 'paid_days_ended', 'renewal_retrying', 'payment_failed'] as const
export type LocalBillingScenario = typeof localBillingScenarios[number]

/** Replaces the vendor's billing with a seeded scenario; the helper first closes every Razorpay subscription it made for them. */
export async function selectLocalBillingScenario(vendorId: string, scenario: LocalBillingScenario): Promise<void> {
  await request(`/dev/vendors/${encodeURIComponent(vendorId)}/scenario`, { body: { scenario } })
}

/**
 * Payment outcomes the helper can simulate for outcomes Razorpay Test Checkout cannot produce:
 * `real` is Razorpay Test Checkout; the others pay a simulated subscription through a stand-in.
 */
export type LocalBillingOutcome = 'real' | 'pending' | 'succeed' | 'fail'
export interface LocalBillingSimulation { outcome: LocalBillingOutcome; delayMs: number }

const simulationPath = (vendorId: string) => `/dev/vendors/${encodeURIComponent(vendorId)}/simulation`

function simulationOf(envelope: ApiEnvelope): LocalBillingSimulation {
  const data = envelope.data as { outcome?: LocalBillingOutcome; delay_ms?: number } | undefined
  return { outcome: data?.outcome ?? 'real', delayMs: data?.delay_ms ?? 0 }
}

/** The vendor's chosen payment outcome and the helper's simulated delay. */
export async function getLocalBillingSimulation(vendorId: string, config?: { signal?: AbortSignal }): Promise<LocalBillingSimulation> {
  return simulationOf(await request(simulationPath(vendorId), config))
}

/** Chooses the outcome of the vendor's next payment; a scenario seed keeps it. */
export async function selectLocalBillingSimulation(vendorId: string, outcome: LocalBillingOutcome): Promise<LocalBillingSimulation> {
  return simulationOf(await request(simulationPath(vendorId), { body: { outcome } }))
}

/** Settles the vendor's pending simulated payment now. */
export async function deliverLocalSimulatedPayment(vendorId: string, result: 'succeed' | 'fail'): Promise<void> {
  await request(`${simulationPath(vendorId)}/deliver`, { body: { result } })
}

type CheckoutOptions = ConstructorParameters<NonNullable<Window['Razorpay']>>[0]

/**
 * Replaces Razorpay Checkout with a stand-in that skips the modal: opening it pays the subscription
 * through the helper and hands the signed callback to Checkout's success handler, so the Plan
 * confirms it as usual. A refused payment dismisses it. The returned function puts Checkout back.
 */
export function installLocalSimulatedCheckout(vendorId: string): () => void {
  const previous = window.Razorpay
  class SimulatedCheckout {
    private readonly options: CheckoutOptions
    private closed = false
    constructor(options: CheckoutOptions) { this.options = options }
    on() {}
    open() {
      request(`${simulationPath(vendorId)}/pay`, { body: { subscription_id: this.options.subscription_id } })
        .then(({ data }) => { if (!this.closed) this.options.handler(data as Parameters<CheckoutOptions['handler']>[0]) })
        .catch(() => { if (!this.closed) this.options.modal.ondismiss() })
    }
    close() { this.closed = true }
  }
  window.Razorpay = SimulatedCheckout
  return () => {
    if (window.Razorpay === SimulatedCheckout) window.Razorpay = previous
  }
}
