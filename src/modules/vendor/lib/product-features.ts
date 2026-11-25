import type { ProductFeature } from '@/modules/vendor/types/dashboard'

/** The backend refuses features over 16 KB. */
export const FEATURES_MAX_BYTES = 16 * 1024

/** A problem on one feature row, shown next to the input it names. */
export type FeatureRowError = { field: 'label' | 'detail'; message: string }

export type FeatureCheck = {
  /** What a save sends: rows left completely empty dropped, labels and details trimmed. */
  features: ProductFeature[]
  /** One entry per row given, in the same order: its problem, or undefined. */
  rowErrors: (FeatureRowError | undefined)[]
  /** The features, as sent, would be over the backend's size limit. */
  tooLong: boolean
  ok: boolean
}

function rowError(label: string, detail: string): FeatureRowError | undefined {
  if (label && !detail) return { field: 'detail', message: `Add a detail for ${label}.` }
  if (!label && detail) return { field: 'label', message: 'Add a label for this detail.' }
  return undefined
}

/** How two labels are compared: ignoring case and surrounding spaces. */
export function featureLabelKey(label: string): string {
  return label.trim().toLowerCase()
}

/** A row left completely empty: ignored on save and never an error. */
export function isBlankFeature({ label, detail }: ProductFeature): boolean {
  return !label.trim() && !detail.trim()
}

/** Checks product feature rows before a save, so only a set the server accepts is sent. */
export function checkFeatures(rows: ProductFeature[]): FeatureCheck {
  const trimmed = rows.map(({ label, detail }) => ({ label: label.trim(), detail: detail.trim() }))
  // A repeated label would overwrite the earlier row on the wire, so every later one is flagged.
  const seen = new Set<string>()
  const rowErrors = trimmed.map(({ label, detail }) => {
    const key = featureLabelKey(label)
    const repeated = label !== '' && seen.has(key)
    seen.add(key)
    if (repeated) return { field: 'label' as const, message: `${label} is already used. Give each feature its own label.` }
    return rowError(label, detail)
  })
  const features = trimmed.filter((row) => !isBlankFeature(row))
  // Measured as the UTF-8 bytes of the object the save sends, so ₹ or Kannada text counts in full.
  const wire = JSON.stringify(Object.fromEntries(features.map(({ label, detail }) => [label, detail])))
  const tooLong = new TextEncoder().encode(wire).length > FEATURES_MAX_BYTES
  return { features, rowErrors, tooLong, ok: !tooLong && rowErrors.every((error) => !error) }
}
