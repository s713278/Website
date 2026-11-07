import { vendorBillingService as apiBillingService, type components } from '@mithra/api-client'
import { unwrapData } from '../client'
import { assertApiSuccess, isApiError } from '../errors'
import { isLiveApi } from '../mode'
import { localBillingBackend } from './local-billing-backend.service'

export type LiveBillingRequestConfig = {
  signal?: AbortSignal
}

export type LiveBillingSubscribeInput = components['schemas']['VendorSubscriptionSubscribeRequest']
export type LiveBillingConfirmInput = components['schemas']['VendorSubscriptionConfirmRequest']

/**
 * The billing read: a 404 means the shop is not live yet, so it is a result rather than a
 * failure. `subscription` stays in wire shape; mapping belongs to the billing mappers.
 */
export type LiveSubscriptionRead =
  | { kind: 'subscription'; subscription: unknown }
  | { kind: 'not-live' }

/** The backend, or in local development demo mode the local Razorpay Test helper standing in for it. */
const transport = () => isLiveApi() || !import.meta.env.DEV ? apiBillingService : localBillingBackend

async function unwrapSuccess(request: Promise<unknown>): Promise<unknown> {
  return unwrapData(assertApiSuccess(await request))
}

async function readSubscription(
  vendorId: string | number,
  config: LiveBillingRequestConfig = {},
): Promise<LiveSubscriptionRead> {
  try {
    return {
      kind: 'subscription',
      subscription: await unwrapSuccess(transport().getSubscription(vendorId, config)),
    }
  } catch (error) {
    if (isApiError(error) && error.status === 404) return { kind: 'not-live' }
    throw error
  }
}

/**
 * Live API billing against the published backend. Every payload is returned unmapped, and every
 * failure except the read's 404 keeps the normalized `ApiError` so callers can tell statuses apart.
 */
export const liveBillingService = {
  readSubscription,
  subscribe: (vendorId: string | number, planCode: LiveBillingSubscribeInput['plan_code']) =>
    unwrapSuccess(transport().subscribe(vendorId, { plan_code: planCode })),
  confirm: (vendorId: string | number, payment: LiveBillingConfirmInput) =>
    unwrapSuccess(transport().confirm(vendorId, payment)),
  cancel: (vendorId: string | number) => unwrapSuccess(transport().cancel(vendorId)),
  readHistory: (vendorId: string | number, config: LiveBillingRequestConfig = {}) =>
    unwrapSuccess(transport().getHistory(vendorId, config)),
  listPaidPlans: (config: LiveBillingRequestConfig = {}) =>
    unwrapSuccess(transport().listPaidPlans(config)),
}
