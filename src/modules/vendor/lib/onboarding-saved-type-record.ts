import type { BusinessTypeReference } from '@/shared/api'

/**
 * This browser's record of each vendor's Step 3 saves.
 *
 * `confirmed` is the business type a save was confirmed for, or that the assigned categories
 * alone settled (TEMP(onboarding-saved-type): recorded so that costly check runs once): the
 * strongest evidence of the saved type (see `onboarding-saved-type.ts`), because the account
 * read can be stale or ambiguous. `inFlight` is written before a first save is sent and cleared once its outcome
 * is known, so a reload or a lost response while it is pending is verified against the
 * account before the vendor may choose again.
 *
 * Session-owned like the draft: entries are keyed by vendor id and read only for the vendor
 * signed in, and an explicit sign-out clears them all. A leaf module, so sign-out wiring
 * does not pull the wizard into the initial bundle.
 */
export const SAVED_TYPE_STORAGE_KEY = 'md-vendor-onboarding-saved-type-v1'

type Entry = { confirmed?: BusinessTypeReference; inFlight?: BusinessTypeReference }

export type SavedTypeRecord = {
  confirmed: BusinessTypeReference | null
  inFlight: BusinessTypeReference | null
}

const NO_RECORD: SavedTypeRecord = { confirmed: null, inFlight: null }

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
    if (next.confirmed || next.inFlight) all[vendorId] = next
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
  return {
    confirmed: isTypeReference(entry.confirmed) ? entry.confirmed : null,
    inFlight: isTypeReference(entry.inFlight) ? entry.inFlight : null,
  }
}

/** A first Step 3 save is about to be sent. */
export function markTypeSaveInFlight(vendorId: string, type: BusinessTypeReference): void {
  update(vendorId, (entry) => ({ ...entry, inFlight: copy(type) }))
}

/** The pending save's outcome is known without it having saved `type`. */
export function clearTypeSaveInFlight(vendorId: string): void {
  update(vendorId, ({ confirmed }) => (confirmed ? { confirmed } : {}))
}

/** A Step 3 save of `type` is confirmed. */
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
