import type {
  DeliveryDraft,
  DraftFieldEdit,
  OnboardingStep,
  StorefrontDraft,
  VendorOnboardingDraftV1,
} from '../types/onboarding'
import type { AccountStep, SavedBaselines } from './onboarding-progress'

/**
 * Unsaved draft input against the account and against another tab, merged field by field.
 *
 * Each edited field of the draft records the saved value its edit started from (`saved`) and
 * when it was last edited (`at`). Only fields Steps 3-9 save are tracked, and never a private
 * value: Step 8's payment details and Step 9's WhatsApp numbers live in runtime state only.
 *
 * - **Account read lands.** For each field that read can tell: no unsaved edit, or a submitted
 *   store, takes the account's value. An edit whose saved value the account still holds is
 *   kept; one the account has moved past gives way to the account. An edit with no recorded
 *   saved value (an old-format draft) only fills a field the account holds nothing for.
 * - **Lists.** Categories, products and sizes merge entry by entry: fresh account entries are
 *   kept, local additions stay, and an entry the vendor changed stays only while the account's
 *   copy is the one it started from. The account only ever adds categories and products, so
 *   none it holds is dropped. Removing a parent removes its orphaned local children.
 * - **Another tab writes.** Its unsaved edits are adopted, except where this tab edited the
 *   field after its own last write, which the other tab cannot have seen, and later than the
 *   other tab did. An edit of this tab's that the other tab has since saved or undone goes.
 *   A field neither tab edited keeps this tab's copy: account data comes from this tab's own
 *   reads, never from another tab's possibly older ones.
 *
 * Nothing here is shown to the vendor; correct values simply apply.
 */

export const DELIVERY_FIELDS = [
  'fulfillmentType',
  'schedulingStrategy',
  'fixedWindow',
  'customerSelectDate',
  'predefinedDays',
  'instant',
  'shippingStrategy',
  'shipping',
  'slots',
  'consentTitle',
  'consentText',
] as const satisfies readonly (keyof DeliveryDraft)[]

export const STOREFRONT_FIELDS = [
  'storeName',
  'tagline',
  'businessLocation',
  'instagram',
  'primaryColor',
  'accentColor',
  'backgroundColor',
  'textColor',
  'fontFamily',
  'themePreset',
  'buttonShape',
  'cardStyle',
  'welcomeMessage',
  'announcementBar',
  'heroBadges',
  'trustStrip',
] as const satisfies readonly (keyof StorefrontDraft)[]

type DeliveryField = `delivery.${(typeof DELIVERY_FIELDS)[number]}`
type StorefrontField = `storefront.${(typeof STOREFRONT_FIELDS)[number]}`
type ListField = 'categories' | 'products' | 'skus'

/** A part of the draft one step saves, merged as a unit. */
export type DraftField =
  | 'businessType'
  | ListField
  | DeliveryField
  | 'payments'
  | 'businessName'
  | StorefrontField

export type FieldEdits = Partial<Record<DraftField, DraftFieldEdit>>

const STEP_FIELDS: { [S in AccountStep]: readonly DraftField[] } = {
  3: ['businessType'],
  4: ['categories'],
  5: ['products'],
  6: ['skus'],
  7: DELIVERY_FIELDS.map((key) => `delivery.${key}` as const),
  8: ['payments'],
  9: ['businessName', ...STOREFRONT_FIELDS.map((key) => `storefront.${key}` as const)],
}

export const DRAFT_FIELDS: readonly DraftField[] = Object.values(STEP_FIELDS).flat()
const FIELD_STEP = new Map<DraftField, AccountStep>(
  (Object.entries(STEP_FIELDS) as unknown as [string, readonly DraftField[]][])
    .flatMap(([step, fields]) => fields.map((field) => [field, Number(step) as AccountStep] as const)),
)

export function isDraftField(value: string): value is DraftField {
  return FIELD_STEP.has(value as DraftField)
}

export function fieldStep(field: DraftField): AccountStep {
  return FIELD_STEP.get(field)!
}

export function stepFields(step: AccountStep): readonly DraftField[] {
  return STEP_FIELDS[step]
}

/** What each account read can tell. Step 9's other details are unreadable before approval. */
export const RESOURCE_FIELDS = {
  businessType: STEP_FIELDS[3],
  categories: STEP_FIELDS[4],
  products: STEP_FIELDS[5],
  skus: STEP_FIELDS[6],
  checkout: [...STEP_FIELDS[7], ...STEP_FIELDS[8]],
  profile: ['businessName', 'storefront.storeName'],
  storefront: STEP_FIELDS[9],
} as const satisfies Record<string, readonly DraftField[]>

const LIST_FIELDS = new Set<DraftField>(['categories', 'products', 'skus'])
/** Lists the account only adds to: an entry it holds is never dropped. */
const ADDITIVE_FIELDS = new Set<DraftField>(['categories', 'products'])

function subKey(field: DraftField, prefix: string): string | null {
  return field.startsWith(prefix) ? field.slice(prefix.length) : null
}

export function readField(draft: VendorOnboardingDraftV1, field: DraftField): unknown {
  if (field === 'businessType' || field === 'businessName') return draft.business[field]
  const delivery = subKey(field, 'delivery.')
  if (delivery) return draft.delivery[delivery as keyof DeliveryDraft]
  const storefront = subKey(field, 'storefront.')
  if (storefront) return draft.storefront[storefront as keyof StorefrontDraft]
  return draft[field as ListField | 'payments']
}

export function writeField(draft: VendorOnboardingDraftV1, field: DraftField, value: unknown): VendorOnboardingDraftV1 {
  if (readField(draft, field) === value) return draft
  if (field === 'businessType' || field === 'businessName') {
    return { ...draft, business: { ...draft.business, [field]: value } }
  }
  const delivery = subKey(field, 'delivery.')
  if (delivery) return { ...draft, delivery: { ...draft.delivery, [delivery]: value } }
  const storefront = subKey(field, 'storefront.')
  if (storefront) return { ...draft, storefront: { ...draft.storefront, [storefront]: value } }
  return { ...draft, [field]: value }
}

/** A field's value in a step's saved baseline (`stepSnapshot` shape). */
function baselineField(baselines: SavedBaselines, field: DraftField): { known: boolean; value?: unknown } {
  const baseline = baselines[fieldStep(field)] as Record<string, unknown> | undefined
  if (!baseline) return { known: false }
  const delivery = subKey(field, 'delivery.')
  if (delivery) return { known: true, value: (baseline.delivery as Record<string, unknown>)[delivery] }
  const storefront = subKey(field, 'storefront.')
  if (storefront) return { known: true, value: (baseline.storefront as Record<string, unknown>)[storefront] }
  return { known: true, value: baseline[field] }
}

/** JSON with sorted keys, so two copies of a value compare equal whatever their key order. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, part: unknown) => {
    if (part === null || typeof part !== 'object' || Array.isArray(part)) return part
    return Object.fromEntries(Object.entries(part).sort(([a], [b]) => a.localeCompare(b)))
  }) ?? 'undefined'
}

export function sameValue(a: unknown, b: unknown): boolean {
  return a === b || stableJson(a) === stableJson(b)
}

function isEmptyValue(value: unknown): boolean {
  return value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)
}

/** The steps holding unsaved fields, sorted. */
export function editedStepsOf(edits: FieldEdits): OnboardingStep[] {
  return [...new Set((Object.keys(edits) as DraftField[]).map(fieldStep))].sort((a, b) => a - b)
}

/**
 * Every field of an edited step that records no field of its own, as edited with no known
 * saved value: an old-format draft only says which steps were edited. Returns `edits` when
 * nothing is added.
 */
export function withUnknownEdits(edits: FieldEdits, editedSteps: readonly OnboardingStep[]): FieldEdits {
  const recorded = new Set(editedStepsOf(edits))
  const missing = editedSteps.filter((step): step is AccountStep => step >= 3 && step <= 9 && !recorded.has(step))
  if (!missing.length) return edits
  const next = { ...edits }
  for (const step of missing) for (const field of STEP_FIELDS[step]) next[field] = { at: 0 }
  return next
}

/**
 * The edit record after a draft update, for the given (already decided) edited steps. A
 * changed field records the saved value it started from when this visit knows it; changing
 * a field back to that value drops it. A step that is not edited holds no fields.
 */
export function trackEdits(
  edits: FieldEdits,
  before: VendorOnboardingDraftV1,
  after: VendorOnboardingDraftV1,
  editedSteps: readonly OnboardingStep[],
  baselines: SavedBaselines,
  at: number,
): FieldEdits {
  let next = edits
  const change = (field: DraftField, entry: DraftFieldEdit | null) => {
    if (next === edits) next = { ...edits }
    if (entry) next[field] = entry
    else delete next[field]
  }
  for (const field of DRAFT_FIELDS) {
    if (!editedSteps.includes(fieldStep(field))) {
      if (next[field]) change(field, null)
      continue
    }
    const value = readField(after, field)
    if (sameValue(readField(before, field), value)) continue
    const saved = baselineField(baselines, field)
    if (saved.known) {
      change(field, sameValue(value, saved.value) ? null : { at, saved: saved.value })
      continue
    }
    const previous = next[field]
    change(field, previous && 'saved' in previous ? { at, saved: previous.saved } : { at })
  }
  return next
}

/** Drop the given steps' fields: they were saved. */
export function withoutSteps(edits: FieldEdits, steps: readonly OnboardingStep[]): FieldEdits {
  const fields = (Object.keys(edits) as DraftField[]).filter((field) => steps.includes(fieldStep(field)))
  if (!fields.length) return edits
  const next = { ...edits }
  for (const field of fields) delete next[field]
  return next
}

type Entry = { id: number | string }

/**
 * One list, entry by entry, against the account's copy. `base` is the saved list the local
 * edit started from; without one (an old-format draft) the account's entries win and local
 * entries it does not hold are additions.
 */
function mergeEntries(field: DraftField, base: readonly Entry[] | undefined, local: readonly Entry[], account: readonly Entry[]): Entry[] {
  const baseById = base ? new Map(base.map((entry) => [entry.id, entry])) : null
  const accountById = new Map(account.map((entry) => [entry.id, entry]))
  const unchanged = (id: Entry['id']) => Boolean(baseById?.has(id)) && sameValue(baseById!.get(id), accountById.get(id))
  const merged: Entry[] = []
  const placed = new Set<Entry['id']>()
  for (const entry of local) {
    if (accountById.has(entry.id)) {
      merged.push(unchanged(entry.id) ? entry : accountById.get(entry.id)!)
      placed.add(entry.id)
    } else if (!baseById?.has(entry.id)) {
      // Added here and not on the account: an unsaved addition.
      merged.push(entry)
    }
    // Otherwise it was saved and the account no longer holds it: the account wins.
  }
  for (const entry of account) {
    if (placed.has(entry.id)) continue
    // A saved size removed here stays removed while the account still holds it unchanged.
    if (!ADDITIVE_FIELDS.has(field) && unchanged(entry.id)) continue
    merged.push(entry)
  }
  return merged
}

/**
 * The draft after one account read lands, for the fields that read can tell (`fields`).
 * `account` is the draft with that read's account copy applied; `accountEmpty` says the
 * account holds nothing for these fields yet (no checkout saved), which an old-format edit
 * may then fill. Returns the merged draft and the edits still unsaved, each now recording
 * the account's value as its saved value.
 */
export function mergeAccountFields(input: {
  local: VendorOnboardingDraftV1
  account: VendorOnboardingDraftV1
  fields: readonly DraftField[]
  edits: FieldEdits
  submitted: boolean
  accountEmpty?: boolean
}): { draft: VendorOnboardingDraftV1; edits: FieldEdits } {
  let draft = input.local
  let edits = input.edits
  for (const field of input.fields) {
    const entry = edits[field]
    const theirs = readField(input.account, field)
    const mine = readField(draft, field)
    let value = theirs
    if (entry && !input.submitted) {
      const known = 'saved' in entry
      if (LIST_FIELDS.has(field)) {
        value = mergeEntries(field, known ? entry.saved as Entry[] : undefined, mine as Entry[], theirs as Entry[])
      } else if (known ? sameValue(entry.saved, theirs) : input.accountEmpty || isEmptyValue(theirs)) {
        value = mine
      }
    }
    draft = writeField(draft, field, value)
    const kept = entry && !input.submitted && !sameValue(value, theirs)
    if (kept || entry) {
      edits = { ...edits }
      if (kept) edits[field] = { at: entry.at, saved: theirs }
      else delete edits[field]
    }
  }
  return { draft, edits }
}

/**
 * The draft with every edited field that records its saved value set back to it: the saved
 * values of a step no read can fully tell (Step 9 before approval). `null` while an edited
 * field's saved value is unknown (an old-format draft): the step then stays pending until saved.
 */
export function withSavedValues(draft: VendorOnboardingDraftV1, edits: FieldEdits, fields: readonly DraftField[]): VendorOnboardingDraftV1 | null {
  if (fields.some((field) => edits[field] && !('saved' in edits[field]!))) return null
  return fields.reduce((current, field) => {
    const entry = edits[field]
    return entry && 'saved' in entry ? writeField(current, field, entry.saved) : current
  }, draft)
}

/**
 * Drop products whose category left the draft, and sizes whose product did. `products` and
 * `skus` say which may be judged: a parent list not merged yet proves nothing.
 */
export function pruneOrphans(
  draft: VendorOnboardingDraftV1,
  judge: { products: boolean; skus: boolean } = { products: true, skus: true },
): VendorOnboardingDraftV1 {
  const categoryIds = new Set(draft.categories.map((category) => category.id))
  const products = judge.products ? draft.products.filter((product) => categoryIds.has(product.categoryId)) : draft.products
  const productIds = new Set(products.map((product) => product.id))
  const skus = judge.skus ? draft.skus.filter((sku) => productIds.has(sku.productId)) : draft.skus
  if (products.length === draft.products.length && skus.length === draft.skus.length) return draft
  return { ...draft, products, skus }
}

/**
 * This tab's draft after another tab wrote a newer one, field by field:
 *
 * - this tab edited it after its own last write (`writtenAt`), which the other tab could not
 *   have seen, and the other tab did not edit it later still: this tab's edit stays;
 * - the other tab holds an unsaved edit: it is adopted;
 * - this tab's edit was already written, and the other tab no longer holds it, so it saved or
 *   undid it there: the other tab's value is adopted;
 * - neither tab edited it: this tab's own copy stays.
 *
 * Everything outside the fields (where this tab is, its progress) stays this tab's. `kept`
 * says whether an edit of this tab's survived, so it must be written for the other tab.
 */
export function mergeTabDraft(input: {
  local: VendorOnboardingDraftV1
  localEdits: FieldEdits
  incoming: VendorOnboardingDraftV1
  incomingEdits: FieldEdits
  writtenAt: number
}): { draft: VendorOnboardingDraftV1; edits: FieldEdits; kept: boolean } {
  let draft = input.local
  const edits: FieldEdits = {}
  let kept = false
  for (const field of DRAFT_FIELDS) {
    const mine = input.localEdits[field]
    const theirs = input.incomingEdits[field]
    if (mine && mine.at > input.writtenAt && !(theirs && theirs.at > mine.at)) {
      kept = true
      edits[field] = mine
      continue
    }
    if (!mine && !theirs) continue
    draft = writeField(draft, field, readField(input.incoming, field))
    if (theirs) edits[field] = theirs
  }
  return { draft: pruneOrphans(draft), edits, kept }
}
