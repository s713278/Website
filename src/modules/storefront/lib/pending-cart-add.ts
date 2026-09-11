const STORAGE_KEY = 'md-pending-cart-add'

/** Intent to add one line — never written to md-cart until OTP succeeds. */
export type PendingCartAdd = {
  vendorId: string
  storeName: string
  productId: string
  skuId: string
  qty: number
  name: string
  /** Variant unit / size label (e.g. "500 g"). */
  label: string
  /** Unit price snapshot at tap time. */
  price: number
  /**
   * Where login should resume (cart / store / checkout).
   * Also used as router `state.from`.
   */
  returnTo: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asPositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 1) return null
  return Math.floor(n)
}

function asNonNegativeNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Validate unknown JSON into PendingCartAdd; reject corrupt payloads. */
export function parsePendingCartAdd(value: unknown): PendingCartAdd | null {
  const raw = asRecord(value)
  if (!raw) return null

  const vendorId = asNonEmptyString(raw.vendorId)
  const storeName = asNonEmptyString(raw.storeName)
  const productId = asNonEmptyString(raw.productId)
  const skuId = asNonEmptyString(raw.skuId)
  const name = asNonEmptyString(raw.name)
  const returnTo = asNonEmptyString(raw.returnTo)
  const qty = asPositiveInt(raw.qty)
  const price = asNonNegativeNumber(raw.price)
  const label = typeof raw.label === 'string' ? raw.label.trim() : ''

  if (!vendorId || !storeName || !productId || !skuId || !name || !returnTo || qty == null || price == null) {
    return null
  }

  if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('://')) {
    return null
  }

  return {
    vendorId,
    storeName,
    productId,
    skuId,
    qty,
    name,
    label,
    price,
    returnTo,
  }
}

export function savePendingCartAdd(pending: PendingCartAdd): void {
  const parsed = parsePendingCartAdd(pending)
  if (!parsed) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // Private mode / quota — fail soft; user can Add again after login.
  }
}

export function readPendingCartAdd(): PendingCartAdd | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return parsePendingCartAdd(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function clearPendingCartAdd(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
