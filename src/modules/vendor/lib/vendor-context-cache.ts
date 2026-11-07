import type { VendorContext } from '@/shared/api'
import { rememberVendorHeaderHint } from '@/modules/vendor/store/vendor-header-hint-store'

/**
 * One in-flight context read per vendor.
 *
 * The dashboard shell reads the vendor context once and shares it, but a single-flight
 * cache is still needed underneath: `<StrictMode>` double-invokes effects in development,
 * so a provider that guards only on its own state still issues two requests per mount.
 * Collapsing them here means the guard holds regardless of how many times the effect runs.
 *
 * Held as a module-level map rather than component state so it also survives the shell
 * remounting — navigating out to the wizard and back costs nothing.
 *
 * Only successful reads are retained. A failure is dropped so the next caller retries
 * rather than inheriting an error nobody can clear.
 */
type Entry = { promise: Promise<VendorContext>; resolved: VendorContext | null }

const entries = new Map<string, Entry>()
const accepted = new Map<string, VendorContext>()

export function billingRevision(context: VendorContext): number | null {
  const billing = context.billing
  if (!billing || typeof billing !== 'object' || Array.isArray(billing)) return null
  const revision = (billing as Record<string, unknown>).revision
  return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0 ? revision : null
}

/** A billing revision covers the entire context, including its plan and effective features. */
export function contextSnapshotMayReplace(previous: VendorContext, next: VendorContext): boolean {
  if (previous.vendorId !== next.vendorId) return false
  const priorRevision = billingRevision(previous)
  const nextRevision = billingRevision(next)
  return priorRevision === null || (nextRevision !== null && nextRevision >= priorRevision)
}

/** The already-resolved context, or `null`. Never fetches. */
export function peekVendorContext(vendorId: string): VendorContext | null {
  return entries.get(vendorId)?.resolved ?? null
}

export function loadVendorContext(
  vendorId: string,
  read: (vendorId: string) => Promise<VendorContext>,
): Promise<VendorContext> {
  const existing = entries.get(vendorId)
  if (existing) return existing.promise

  const entry: Entry = { resolved: null, promise: read(vendorId) }
  entries.set(vendorId, entry)

  // Chained after the entry is stored so these callbacks can compare by identity: a
  // sign-out or an invalidate-then-reload replaces the entry, and a late resolution must
  // never write back over whatever replaced it.
  entry.promise = entry.promise
    .then((context) => {
      if (context.vendorId !== vendorId) throw new Error('Vendor context was returned for another store.')
      if (entries.get(vendorId) === entry) {
        const previous = accepted.get(vendorId)
        if (previous && !contextSnapshotMayReplace(previous, context)) {
          throw new Error('Vendor context is older than the last confirmed billing status. Please refresh.')
        }
        entry.resolved = context
        accepted.set(vendorId, context)
        // TEMP(vendor-header-hint): see docs/SESSION.md for removal.
        rememberVendorHeaderHint(context)
      }
      return context
    })
    .catch((error: unknown) => {
      if (entries.get(vendorId) === entry) entries.delete(vendorId)
      throw error
    })

  return entry.promise
}

/** Drop cached context so the next read hits the account. Also used on sign-out. */
export function invalidateVendorContext(vendorId?: string): void {
  if (vendorId) entries.delete(vendorId)
  else { entries.clear(); accepted.clear() }
}
