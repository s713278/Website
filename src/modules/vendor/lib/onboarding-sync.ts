import {
  getErrorMessage,
  isApiError,
  isLiveApi,
  vendorOnboardingService,
  vendorProductIdByPlatformId,
  type CheckoutDeliveryInput,
  type CheckoutPaymentInput,
  type StorefrontConfigInput,
  type VendorSkuRef,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import type {
  CatalogSource,
  DraftCategory,
  DraftSku,
  OnboardingRuntimeState,
  OnboardingStep,
  SelectedProduct,
  VendorOnboardingDraftV1,
} from '../types/onboarding'
import { serverSkuIdOf } from './onboarding-sku-id'

/**
 * Steps written to the vendor account on Continue.
 *
 * Step 10 is absent because go-live is not a "save" — the wizard runs it explicitly
 * and then reconciles the returned approval state.
 */
export const LIVE_PERSISTED_STEPS: readonly OnboardingStep[] = [3, 4, 5, 6, 7, 8, 9]

export function isLivePersistedStep(step: OnboardingStep): boolean {
  return LIVE_PERSISTED_STEPS.includes(step)
}

/**
 * Whether what the vendor does now can reach their account at all.
 *
 * Demo mode has no backend, and the sample catalog carries synthetic IDs that are never
 * written to a real account. Both the Continue write and the steps that warn a choice is
 * permanent ask this, so a notice cannot claim a permanence that demo mode doesn't have.
 */
export function writesReachAccount(catalogSource: CatalogSource): boolean {
  return isLiveApi() && catalogSource === 'account'
}

/** Field to focus when a save for this step fails. */
export function stepErrorField(step: OnboardingStep): string {
  if (step === 3) return 'business-type'
  if (step === 4) return 'categories'
  if (step === 5) return 'products'
  if (step === 6) return 'skus'
  if (step === 7) return 'fulfillment'
  if (step === 8) return 'payments'
  return 'store-name'
}

/** What one successful write added to the vendor's account catalog. */
export type AccountAssignment = { categoryIds?: number[]; productIds?: number[]; skuIds?: number[] }

/**
 * Told what reached the account, as each write lands.
 *
 * Reported per write rather than once per step because a step is not always one request:
 * products are assigned a category at a time, and a batch that fails must not discard
 * the evidence of the batches before it. Assignment is one-way, so anything reported
 * here can no longer be deselected.
 */
export type OnAssigned = (assignment: AccountAssignment) => void

/**
 * Removing a product is Admin/Customer_Care only — `PATCH /delete/products` returns
 * 403 for a vendor — so assignment is additive. Surfaced to the vendor rather than
 * silently doing nothing.
 */
export const PRODUCT_REMOVAL_UNSUPPORTED =
  'Products already added to your store cannot be removed here yet. Contact support to remove one.'

function toStorefrontInput(
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
): StorefrontConfigInput {
  return {
    storeName: draft.storefront.storeName,
    tagline: draft.storefront.tagline,
    businessLocation: draft.storefront.businessLocation,
    instagram: draft.storefront.instagram,
    orderWhatsapp: runtime.orderWhatsapp,
    supportWhatsapp: runtime.supportWhatsapp,
    welcomeMessage: draft.storefront.welcomeMessage,
    announcementBar: draft.storefront.announcementBar,
    heroBadges: draft.storefront.heroBadges,
    trustStrip: draft.storefront.trustStrip,
    theme: {
      primaryColor: draft.storefront.primaryColor,
      accentColor: draft.storefront.accentColor,
      backgroundColor: draft.storefront.backgroundColor,
      textColor: draft.storefront.textColor,
      fontFamily: draft.storefront.fontFamily,
      buttonShape: draft.storefront.buttonShape,
      cardStyle: draft.storefront.cardStyle,
      themePreset: draft.storefront.themePreset,
    },
    // Image upload stays out until the wizard uploads through the images endpoint;
    // a local object URL must never be sent.
    uploadedLogoUrl: null,
    uploadedBannerUrl: null,
  }
}

function toDeliveryInput(draft: VendorOnboardingDraftV1): CheckoutDeliveryInput {
  const d = draft.delivery
  return {
    fulfillmentType: d.fulfillmentType,
    orderAcceptancePolicy: d.orderAcceptancePolicy,
    schedulingStrategy: d.schedulingStrategy,
    fixedWindow: d.fixedWindow,
    customerSelectDate: d.customerSelectDate,
    predefinedDays: { days: d.predefinedDays.days, maxOrdersPerDay: d.predefinedDays.maxOrdersPerDay },
    instant: d.instant,
    shippingStrategy: d.shippingStrategy,
    shipping: {
      charge: d.shipping.charge,
      freeDeliveryThreshold: d.shipping.freeDeliveryThreshold,
    },
    slots: d.slots.map((slot) => ({ startTime: slot.startTime, endTime: slot.endTime })),
    consentTitle: d.consentTitle,
    consentText: d.consentText,
  }
}

function toPaymentInput(
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
): CheckoutPaymentInput {
  return {
    options: draft.payments.map((option) => ({
      type: option.type,
      enabled: option.enabled,
      isDefault: option.isDefault,
    })),
    details: runtime.paymentDetails,
  }
}

/**
 * The backend's uniqueness key for a SKU row, normalized for comparison.
 *
 * Used to re-attach a draft row to its replacement after an edit changed the server id.
 */
function skuIdentity(
  vendorProductId: number,
  name: string,
  quantity: number | null,
  unit: string,
): string {
  return [
    vendorProductId,
    name.trim().toLowerCase(),
    quantity ?? '',
    unit.trim().toLowerCase(),
  ].join('::')
}

/** The backend stores a SKU as `<name>-<value> <unit>`; match that to detect duplicates. */
function serverSkuName(name: string, quantity: number, unit: string): string {
  return `${name.trim()}-${quantity} ${unit}`
}

/** The DB unique constraint on (name, weight, vendor_product_id) surfaces as a 417. */
function isDuplicateSkuError(error: unknown): boolean {
  return /duplicate key|tb_sku_unique/i.test(getErrorMessage(error, ''))
}

export type SkuWritePlan = {
  creates: Array<{ sku: DraftSku; vendorProductId: number }>
  /** Server SKU IDs to delete. */
  deletes: number[]
}

/**
 * No SKU read returns `home_delivery` or `store_pickup`, so a resumed row cannot report
 * what was actually written. `draftSkus` seeds both to these values on resume, and the
 * account side below compares against the same constants.
 *
 * That is what makes including them safe: an untouched resumed SKU carries exactly these
 * values and still matches, so the catalog is not rewritten on every Continue — while a
 * vendor who actually toggles one produces a difference and gets a real write. Leaving
 * them out meant an explicit fulfillment edit compared equal and was silently dropped
 * while the UI reported success.
 *
 * The change still cannot be read back afterwards; see docs/API_GAPS.md.
 */
const RESUMED_FULFILLMENT = { homeDelivery: true, storePickup: true } as const

/** Everything a SKU row carries that the vendor can change. */
function draftFingerprint(sku: DraftSku): string {
  return [
    sku.name.trim().toLowerCase(),
    sku.quantity ?? '',
    sku.unit.trim().toLowerCase(),
    sku.listPrice ?? '',
    sku.salePrice ?? '',
    sku.active,
    sku.description.trim(),
    sku.homeDelivery,
    sku.storePickup,
  ].join('|')
}

function accountFingerprint(sku: VendorSkuRef): string {
  return [
    sku.displayName.trim().toLowerCase(),
    sku.quantity ?? '',
    sku.unit.trim().toLowerCase(),
    sku.listPrice ?? '',
    sku.salePrice ?? '',
    sku.isActive,
    sku.description.trim(),
    RESUMED_FULFILLMENT.homeDelivery,
    RESUMED_FULFILLMENT.storePickup,
  ].join('|')
}

/**
 * Reconcile the draft's SKUs against the account's.
 *
 * Creating is not enough. A vendor who removes a SKU, drops a price or renames one gets
 * their old row back on the next resume unless the account is told, because the resume
 * rebuilds the draft from the account.
 *
 * Edits are expressed as delete + create rather than an update: `PATCH /skus/{id}` covers
 * only name, description and is_active — never price or size — and currently fails with a
 * JDBC 417 regardless. See docs/API_GAPS.md.
 *
 * Fulfillment flags participate in the comparison against the defaults a resume applies,
 * so an explicit toggle is written rather than silently dropped.
 *
 * SKUs belonging to a product that is not in the draft are left alone. A vendor cannot
 * unassign a product (403, Admin only), so that state means the account holds a product
 * the wizard is not showing — deleting its rows would destroy data the vendor never
 * asked to lose.
 */
export function planSkuWrites(
  draft: Pick<VendorOnboardingDraftV1, 'products' | 'skus'>,
  serverSkus: VendorSkuRef[],
  vendorProductIdByPlatform: Map<number, number>,
): SkuWritePlan {
  const draftSkus = draft.skus
  const creates: SkuWritePlan['creates'] = []
  const deletes: number[] = []

  // Scoped to the products the wizard is showing, not to the SKUs it holds: removing a
  // product's last SKU still has to delete the account row.
  const draftProductIds = new Set(
    draft.products
      .map((product) => vendorProductIdByPlatform.get(product.id))
      .filter((id): id is number => id != null),
  )
  const serverById = new Map(serverSkus.map((sku) => [sku.skuId, sku]))
  // The server's own uniqueness key, `(name, weight, vendor_product_id)`. Two rows that
  // agree on it are the same SKU as far as the backend is concerned.
  const serverByIdentity = new Map(
    serverSkus.map((sku) => [
      skuIdentity(sku.vendorProductId, sku.displayName, sku.quantity, sku.unit),
      sku,
    ]),
  )
  const keptServerIds = new Set<number>()

  for (const sku of draftSkus) {
    if (sku.quantity == null || sku.listPrice == null || sku.salePrice == null) continue
    const vendorProductId = vendorProductIdByPlatform.get(sku.productId)
    if (!vendorProductId) {
      throw new Error(
        `“${sku.name}” could not be saved because its product is not in your store yet. Go back to Products and continue again.`,
      )
    }

    const serverId = serverSkuIdOf(sku.id)
    let existing = serverId == null ? undefined : serverById.get(serverId)

    // Only for a row that was already on the account. An edit is delete-then-create, so
    // the replacement carries a new server id while the draft still holds the old one —
    // the wrapper discards the create response, so the new id never reaches us. Matching
    // on the backend's own uniqueness key recognises the row anyway. Without this, every
    // later Continue on Step 6 deleted the replacement and created another, churning the
    // catalog and reopening the non-atomic replacement window each time.
    //
    // Deliberately not applied to a `draft-sku-*` row, which was never on the account: a
    // new row that merely collides on name and size would adopt the existing SKU and
    // delete it, destroying a row the vendor never asked to touch. Those keep the old
    // path, where the duplicate guard and the 417 catch handle the collision.
    if (!existing && serverId != null) {
      const candidate = serverByIdentity.get(
        skuIdentity(vendorProductId, sku.name, sku.quantity, sku.unit),
      )
      if (candidate && !keptServerIds.has(candidate.skuId) && !deletes.includes(candidate.skuId)) {
        existing = candidate
      }
    }

    if (!existing) {
      creates.push({ sku, vendorProductId })
      continue
    }
    if (draftFingerprint(sku) === accountFingerprint(existing)) {
      keptServerIds.add(existing.skuId)
      continue
    }
    // Changed: the row has to be replaced, because it cannot be updated in place.
    deletes.push(existing.skuId)
    creates.push({ sku, vendorProductId })
  }

  for (const sku of serverSkus) {
    if (keptServerIds.has(sku.skuId) || deletes.includes(sku.skuId)) continue
    // Only reconcile products the wizard is actually showing.
    if (!draftProductIds.has(sku.vendorProductId)) continue
    deletes.push(sku.skuId)
  }

  return { creates, deletes }
}

/** A pending entry that was created in the platform catalog and given a positive id. */
export type CreatedCatalogEntry = {
  kind: 'category' | 'product'
  /** The reserved-band id the entry carried while pending. */
  pendingId: number
  /** The positive platform id the create returned. */
  platformId: number
}

/**
 * The pending entries a Continue on `step` must create in the platform catalog.
 *
 * Pure, and the same for demo and live: it reports what is authored-but-not-created, and the
 * caller decides whether to act on it. Only `pending` entries qualify — a sample fixture also
 * has a negative id but was never authored here, so it is never minted. Step 4 mints
 * categories, Step 5 mints products; every other step has nothing to create.
 */
export function planCatalogCreates(
  draft: Pick<VendorOnboardingDraftV1, 'categories' | 'products'>,
  step: OnboardingStep,
): { categories: DraftCategory[]; products: SelectedProduct[] } {
  return {
    categories: step === 4 ? draft.categories.filter((category) => category.pending === true) : [],
    products: step === 5 ? draft.products.filter((product) => product.pending === true) : [],
  }
}

function stripPending<T extends { pending?: true }>(entry: T): Omit<T, 'pending'> {
  const { pending: _pending, ...rest } = entry
  return rest
}

/**
 * Replace a pending entry's reserved-band id with the platform id its create returned, drop
 * `pending`, and follow the change through every draft-internal reference to it — a product's
 * `categoryId`, a SKU's `productId`. Pure, so the store and the write pipeline apply the same
 * remap: the store so a reload cannot re-mint, the pipeline so the assign that follows sends
 * the platform id and not the negative one.
 */
export function applyCreatedEntry(
  draft: VendorOnboardingDraftV1,
  entry: CreatedCatalogEntry,
): VendorOnboardingDraftV1 {
  if (entry.kind === 'category') {
    return {
      ...draft,
      categories: draft.categories.map((category) =>
        category.id === entry.pendingId
          ? stripPending({ ...category, id: entry.platformId })
          : category,
      ),
      products: draft.products.map((product) =>
        product.categoryId === entry.pendingId
          ? { ...product, categoryId: entry.platformId }
          : product,
      ),
    }
  }
  return {
    ...draft,
    products: draft.products.map((product) =>
      product.id === entry.pendingId
        ? stripPending({ ...product, id: entry.platformId })
        : product,
    ),
    skus: draft.skus.map((sku) =>
      sku.productId === entry.pendingId ? { ...sku, productId: entry.platformId } : sku,
    ),
  }
}

/** Told the positive id of each pending entry as it is created, before anything is assigned. */
export type OnCreated = (entry: CreatedCatalogEntry) => void

/**
 * Create a pending category in the platform catalog, recovering from a duplicate.
 *
 * A 409 means the platform already holds this category. Rather than trapping the vendor on
 * the step, the existing category is looked up by business type and name and its id adopted —
 * the pending entry maps onto what is already there. Any other failure propagates.
 */
async function createPendingCategory(category: DraftCategory): Promise<number> {
  const businessTypeId = category.businessTypeId
  if (businessTypeId == null) {
    throw new Error(
      `“${category.name}” could not be created because it has no business type. Go back to Step 3 and continue again.`,
    )
  }
  try {
    return await vendorOnboardingService.createCategory({
      businessTypeId,
      name: category.name,
      description: category.description,
    })
  } catch (error) {
    if (!isApiError(error) || error.status !== 409) throw error
    const existingId = await findPlatformCategoryId(businessTypeId, category.name)
    if (existingId == null) throw error
    return existingId
  }
}

async function findPlatformCategoryId(
  businessTypeId: number,
  name: string,
): Promise<number | null> {
  const page = await vendorOnboardingService.getCategories({
    business_type_id: businessTypeId,
    pageSize: 200,
  })
  const wanted = name.trim().toLowerCase()
  return page.items.find((category) => category.name.trim().toLowerCase() === wanted)?.id ?? null
}

/** Create a pending product under its (already platform) category. */
async function createPendingProduct(product: SelectedProduct): Promise<number> {
  const measurementUnitId = product.measurementId
  if (measurementUnitId == null) {
    throw new Error(
      `“${product.name}” could not be created because it has no measurement unit. Set one and continue again.`,
    )
  }
  if (!Number.isSafeInteger(product.categoryId) || product.categoryId <= 0) {
    throw new Error(
      `“${product.name}” could not be created because its category is not on the platform yet. Go back to Categories and continue again.`,
    )
  }
  return vendorOnboardingService.createProduct(product.categoryId, {
    name: product.name,
    measurementUnitId,
    description: product.description,
  })
}

/**
 * Mint each pending entry for `step`, recording its returned id before returning.
 *
 * Every create reports through `onCreated` — which records the id into the store draft — and
 * the same remap is folded into the returned working draft. Recording BEFORE the caller's
 * assign is the single most important ordering in the feature: a create that lands then an
 * assign that fails must leave one entry that a retry adopts, never a second undeletable copy.
 */
async function mintPendingEntries(
  draft: VendorOnboardingDraftV1,
  step: OnboardingStep,
  onCreated: OnCreated,
): Promise<VendorOnboardingDraftV1> {
  const plan = planCatalogCreates(draft, step)
  let working = draft
  for (const category of plan.categories) {
    const platformId = await createPendingCategory(category)
    const entry: CreatedCatalogEntry = { kind: 'category', pendingId: category.id, platformId }
    onCreated(entry)
    working = applyCreatedEntry(working, entry)
  }
  for (const product of plan.products) {
    const platformId = await createPendingProduct(product)
    const entry: CreatedCatalogEntry = { kind: 'product', pendingId: product.id, platformId }
    onCreated(entry)
    working = applyCreatedEntry(working, entry)
  }
  return working
}

/**
 * The platform categories to send on a category write: the draft's, minus the ones the
 * account already holds.
 *
 * `PATCH /v1/vendors/{id}/categories` is additive and answers 417 if any id in the body
 * is already assigned, failing the whole request — so re-sending a held id traps the
 * vendor on the step. An empty result means there is nothing new and the caller skips the
 * request entirely. Mirrors the account filter `persistProducts` already applies. See
 * docs/API_GAPS.md.
 */
export function categoriesToAssign(
  draftCategoryIds: number[],
  assignedPlatformCategoryIds: Iterable<number>,
): number[] {
  const assigned = new Set(assignedPlatformCategoryIds)
  return draftCategoryIds.filter((id) => !assigned.has(id))
}

async function persistCategories(
  vendorId: string,
  draft: VendorOnboardingDraftV1,
  onAssigned: OnAssigned,
  onCreated: OnCreated,
): Promise<void> {
  // Author any pending categories first, recording their platform ids into the draft before
  // the assign below ever runs. The assign then works on positive ids only.
  const minted = await mintPendingEntries(draft, 4, onCreated)
  const existing = await vendorOnboardingService.getVendorCategories(vendorId)
  const categoryIds = categoriesToAssign(
    minted.categories.map((category) => category.id),
    existing.map((category) => category.platformCategoryId),
  )
  // Nothing new to assign: skip the additive PATCH that would 417, and let Continue advance.
  if (!categoryIds.length) return
  await vendorOnboardingService.saveCategories(vendorId, categoryIds)
  onAssigned({ categoryIds })
}

type ProductPersistenceService = Pick<
  typeof vendorOnboardingService,
  'getVendorProducts' | 'assignProducts'
>

export async function persistProducts(
  vendorId: string,
  draft: VendorOnboardingDraftV1,
  onAssigned: OnAssigned,
  onCreated: OnCreated,
  service: ProductPersistenceService = vendorOnboardingService,
): Promise<void> {
  // Author any pending products first, so their platform ids are recorded and assigned below.
  const minted = await mintPendingEntries(draft, 5, onCreated)
  const existing = await service.getVendorProducts(vendorId)
  const assigned = new Set(existing.map((product) => product.platformProductId))

  // `category_id` here is the PLATFORM category, despite the endpoint description.
  const byCategory = new Map<number, number[]>()
  for (const product of minted.products) {
    if (assigned.has(product.id)) continue
    const bucket = byCategory.get(product.categoryId) ?? []
    bucket.push(product.id)
    byCategory.set(product.categoryId, bucket)
  }

  for (const [platformCategoryId, productIds] of byCategory) {
    await service.assignProducts(vendorId, platformCategoryId, productIds)
    // An assignment request cannot currently be aborted. If sign-out or a vendor switch
    // cleared the shared catalog while it was in flight, do not seed the next vendor's state.
    if (useAuthStore.getState().user?.vendorId !== vendorId) return
    // Reported here, not after the loop: a later category that fails leaves these on the
    // account all the same, and the vendor must not be offered them back.
    onAssigned({ productIds })
  }
}

type SkuPersistenceService = Pick<
  typeof vendorOnboardingService,
  'getVendorProducts' | 'getVendorSkus' | 'createSku' | 'deleteSku'
>

export async function persistSkus(
  vendorId: string,
  draft: VendorOnboardingDraftV1,
  onAssigned: OnAssigned,
  service: SkuPersistenceService = vendorOnboardingService,
): Promise<void> {
  const [products, serverSkus] = await Promise.all([
    service.getVendorProducts(vendorId),
    service.getVendorSkus(vendorId),
  ])
  const vendorProductIds = vendorProductIdByPlatformId(products)
  const plan = planSkuWrites(draft, serverSkus, vendorProductIds)
  const nameOnAccount = new Set(serverSkus.map((sku) => `${sku.vendorProductId}::${sku.name}`))

  // Deletions first: an edit is delete-then-create, and creating first would collide with
  // the row being replaced on the (name, weight, vendor_product_id) unique constraint.
  for (const skuId of plan.deletes) {
    await service.deleteSku(vendorId, skuId)
    const removed = serverSkus.find((sku) => sku.skuId === skuId)
    if (removed) nameOnAccount.delete(`${removed.vendorProductId}::${removed.name}`)
  }

  for (const { sku, vendorProductId } of plan.creates) {
    if (sku.quantity == null || sku.listPrice == null || sku.salePrice == null) continue
    const key = `${vendorProductId}::${serverSkuName(sku.name, sku.quantity, sku.unit)}`
    if (nameOnAccount.has(key)) continue

    try {
      await service.createSku(
        vendorId,
        {
          name: sku.name,
          description: sku.description,
          measurementType: sku.measurementType,
          unit: sku.unit,
          quantity: sku.quantity,
          listPrice: sku.listPrice,
          salePrice: sku.salePrice,
          active: sku.active,
          homeDelivery: sku.homeDelivery,
          storePickup: sku.storePickup,
        },
        vendorProductId,
      )
      nameOnAccount.add(key)
    } catch (error) {
      // Already on the account under a slightly different local name — not a failure.
      if (!isDuplicateSkuError(error)) throw error
    }
  }

  // Report the account's current SKU identity so cumulative size capacity stays right for
  // the rest of the visit. A create returns no id (the wrapper discards it), so the set is
  // re-read once writes have landed; when nothing changed, the entry read already had it.
  // Sizes can be deleted, so this replaces rather than grows the retained set.
  const finalSkus = plan.creates.length || plan.deletes.length
    ? await service.getVendorSkus(vendorId)
    : serverSkus
  onAssigned({ skuIds: finalSkus.map((sku) => sku.skuId) })
}

/**
 * Persist one step to the vendor account. Throws on failure so the caller keeps the
 * vendor on the step — a failed write must never be reported as local success.
 *
 * `onAssigned` is called as each write lands, including on the way to a failure. Step 5 stops
 * reporting if its vendor is no longer active, so an unabortable response cannot cross account
 * state. The callback is required so a new call site cannot drop assignment evidence silently.
 *
 * `onCreated` records each authored entry's platform id into the draft before it is
 * assigned; it is required for the same reason — dropping it would risk a duplicate mint.
 */
export async function persistStep(
  step: OnboardingStep,
  vendorId: string,
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
  onAssigned: OnAssigned,
  onCreated: OnCreated,
): Promise<void> {
  if (step === 3) {
    const businessType = draft.business.businessType
    if (!businessType) return
    // `name` holds the exact backend `type` value, not a display label.
    await vendorOnboardingService.saveBusinessType(vendorId, { businessType: businessType.name })
    return
  }

  // Category and product writes only ever assign (PATCH is additive; a vendor cannot
  // unassign — 403, Admin only). Sizes reconcile the draft against the account. A submitted
  // store never persists Step 6 — it is read-only while under review — so the reconcile
  // here only ever runs for a store still in setup.
  if (step === 4) return persistCategories(vendorId, draft, onAssigned, onCreated)
  if (step === 5) return persistProducts(vendorId, draft, onAssigned, onCreated)
  if (step === 6) return persistSkus(vendorId, draft, onAssigned)

  // Steps 7 and 8 share one payload, and payment_options replaces the existing set,
  // so both always send the complete current configuration.
  if (step === 7 || step === 8) {
    await vendorOnboardingService.saveCheckoutOptions(
      vendorId,
      toDeliveryInput(draft),
      toPaymentInput(draft, runtime),
    )
    return
  }

  if (step === 9) {
    await vendorOnboardingService.saveStorefront(vendorId, toStorefrontInput(draft, runtime))
    // owner_name and contact_person have no home in the storefront config, so they
    // ride along on the business-type record where the contract defines them.
    const businessType = draft.business.businessType
    if (businessType) {
      await vendorOnboardingService.saveBusinessType(vendorId, {
        businessType: businessType.name,
        businessName: draft.storefront.storeName,
        ownerName: draft.business.ownerName,
        contactPerson: draft.business.contactPerson,
      })
    }
  }
}
