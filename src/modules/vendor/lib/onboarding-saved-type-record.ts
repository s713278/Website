import type { BusinessTypeReference } from '@/shared/api'

/**
 * This browser's record of each vendor's locked business type.
 *
 * `confirmed` is the type this vendor's first category assignment was saved under (written as
 * it lands), or that the Others list alone settled (TEMP(onboarding-saved-type): recorded so
 * that costly check runs once). It is consulted only once the type is locked (see
 * `onboarding-saved-type.ts`); a record a Step 3 save wrote before 16 November 2026 is ignored
 * until then.
 *
 * Session-owned like the draft: entries are keyed by vendor id and read only for the vendor
 * signed in, and an explicit sign-out clears them all. A leaf module, so sign-out wiring
 * does not pull the wizard into the initial bundle.
 */
export const SAVED_TYPE_STORAGE_KEY = 'md-vendor-onboarding-saved-type-v1'

type Entry = { confirmed?: BusinessTypeReference }

export type SavedTypeRecord = {
  confirmed: BusinessTypeReference | null
}

const NO_RECORD: SavedTypeRecord = { confirmed: null }

function isTypeReference(value: unknown): value is BusinessTypeReference {
  if (!value || typeof value !== 'object') return false
  const type = value as Record<string, unknown>
  return Number.isSafeInteger(type.id) && type.id !== 0
    && typeof type.name === 'string' && type.name.trim() !== ''
    && (type.icon === null || typeof type.icon === 'string')
    && (type.displayOrder === null || Number.isSafeInteger(type.displayOrder))
}

function copy(type: BusinessTypeReference): BusinessTypeReference {
  return { id: type.id, name: type.name, icon: type.icon, displayOrder: type.displayOrder }
}

function readAll(): Record<string, Entry> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SAVED_TYPE_STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, Entry> : {}
  } catch {
    return {}
  }
}

function update(vendorId: string, change: (entry: Entry) => Entry): void {
  if (typeof window === 'undefined') return
  try {
    const all = readAll()
    const next = change(all[vendorId] ?? {})
    if (next.confirmed) all[vendorId] = next
    else delete all[vendorId]
    if (Object.keys(all).length) window.localStorage.setItem(SAVED_TYPE_STORAGE_KEY, JSON.stringify(all))
    else window.localStorage.removeItem(SAVED_TYPE_STORAGE_KEY)
  } catch {
    /* without storage the lock lasts for this visit only */
  }
}

/** The signed-in vendor's record; anything malformed counts as absent. */
export function readSavedTypeRecord(vendorId: string): SavedTypeRecord {
  const entry = readAll()[vendorId]
  if (!entry || typeof entry !== 'object') return NO_RECORD
  // An old entry holding only a pending Step 3 save reads as absent.
  return { confirmed: isTypeReference(entry.confirmed) ? entry.confirmed : null }
}

/** The account now holds a category saved under `type`. */
export function recordConfirmedType(vendorId: string, type: BusinessTypeReference): void {
  update(vendorId, () => ({ confirmed: copy(type) }))
}

/** Explicit sign-out: forget every vendor's record. */
export function clearSavedTypeRecords(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SAVED_TYPE_STORAGE_KEY)
  } catch {
    /* a browser that refuses storage has nothing to clear */
  }
}
