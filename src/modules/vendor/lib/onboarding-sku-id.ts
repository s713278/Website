import type { DraftSku } from '../types/onboarding'

/**
 * SKU identity inside the wizard draft.
 *
 * A draft SKU has one of exactly two origins, and the difference decides what the
 * write path does with it:
 *
 * - **Local** (`draft-sku-<productId>-<n>`) — created in this browser, not yet on the
 *   account. Step 6 creates it on the server.
 * - **Account** (`sku-<serverSkuId>`) — read back from the vendor's own SKU list on
 *   resume. It already exists on the server and must never be created again.
 *
 * Both are legitimate. Anything else did not come from either producer and is not
 * safe to write, so validation rejects it.
 */
const LOCAL_PREFIX = 'draft-sku-'
const ACCOUNT_PREFIX = 'sku-'

export function localSkuId(productId: number, skus: DraftSku[]): string {
  const prefix = `${LOCAL_PREFIX}${Math.abs(productId)}-`
  const sequence = skus
    .filter((sku) => sku.id.startsWith(prefix))
    .map((sku) => Number.parseInt(sku.id.slice(prefix.length), 10))
    .filter(Number.isFinite)
  return `${prefix}${Math.max(0, ...sequence) + 1}`
}

export function accountSkuId(serverSkuId: number): string {
  return `${ACCOUNT_PREFIX}${serverSkuId}`
}

const LOCAL_PATTERN = /^draft-sku-\d+-\d+$/
const ACCOUNT_PATTERN = /^sku-\d+$/

export function isLocalSkuId(id: string): boolean {
  return LOCAL_PATTERN.test(id)
}

/** True only for an ID minted from a real server SKU, never for a local draft ID. */
export function isAccountSkuId(id: string): boolean {
  return ACCOUNT_PATTERN.test(id)
}

export function isKnownSkuId(id: string): boolean {
  return isLocalSkuId(id) || isAccountSkuId(id)
}

/** The server id behind an account SKU, or `null` for a local draft SKU. */
export function serverSkuIdOf(id: string): number | null {
  if (!isAccountSkuId(id)) return null
  const parsed = Number.parseInt(id.slice(ACCOUNT_PREFIX.length), 10)
  return Number.isFinite(parsed) ? parsed : null
}
