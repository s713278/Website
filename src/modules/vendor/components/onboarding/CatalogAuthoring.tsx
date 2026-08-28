import { useState, type FormEvent } from 'react'
import { InfoIcon, PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui'
import { measurementLabel } from '../../lib/onboarding-measurement'
import { writesReachAccount } from '../../lib/onboarding-sync'
import {
  selectCategoryLimit,
  useOnboardingStore,
} from '../../store/onboarding-store'
import { FieldLabel, Hint, fieldShell } from './StepPrimitives'

type PermanenceNoticeKind =
  | 'categories'
  | 'products'
  | 'authored-category'
  | 'authored-product'

/**
 * Explain an account write while the vendor can still choose not to make it.
 *
 * The authored-category copy is deliberately stronger than the assignment copy: creating
 * an entry changes the shared platform catalog, not only this vendor's store.
 */
export function PermanenceNotice({ kind }: { kind: PermanenceNoticeKind }) {
  const message = {
    categories: 'Once you continue, the categories you pick are saved to your store for good. You can add more later, but removing one needs support.',
    products: 'Once you continue, the products you pick are saved to your store for good. Removing one needs support — but you can set a product inactive on the next step.',
    'authored-category': 'Anything you add becomes a platform category in the shared catalog for every vendor with this business type. You can remove it before Continue; after Continue, it cannot be removed.',
    'authored-product': 'Anything you add becomes a platform product in the shared catalog under this category. You can remove it before Continue; after Continue, it cannot be removed.',
  } satisfies Record<PermanenceNoticeKind, string>

  return (
    <Hint icon={<InfoIcon className="size-4" />}>
      {message[kind]}
    </Hint>
  )
}

export function AuthorCategoryForm({ onAdded }: { onAdded: () => void }) {
  const catalogSource = useOnboardingStore((state) => state.draft.catalogSource)
  const businessTypeId = useOnboardingStore(
    (state) => state.draft.business.businessType?.id ?? null,
  )
  const categoryChoiceCount = useOnboardingStore((state) => state.draft.categories.length)
  const categoryLimit = useOnboardingStore(selectCategoryLimit)
  const addPendingCategory = useOnboardingStore((state) => state.addPendingCategory)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const atLimit = categoryChoiceCount >= categoryLimit

  const close = () => {
    setOpen(false)
    setName('')
    setDescription('')
    setNameError(null)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('Add a platform category name.')
      return
    }
    if (atLimit || businessTypeId === null) return

    addPendingCategory({
      name: trimmedName,
      businessTypeId,
      description: description.trim() || null,
    })
    close()
    onAdded()
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          variant="outline"
          size="sm"
          disabled={atLimit}
          onClick={() => setOpen(true)}
        >
          <PlusIcon /> Add a platform category
        </Button>
        {atLimit ? (
          <span className="text-xs text-[var(--ob-ink-soft)]">
            Your plan's platform category limit is reached.
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <form
      aria-label="Add a platform category"
      className="space-y-4 rounded-xl border border-[var(--ob-line)] bg-[var(--ob-sheet)] p-4"
      onSubmit={submit}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-sm font-semibold text-[var(--ob-ink)]">
            Add a platform category
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--ob-ink-soft)]">
            Use the name customers would expect to browse.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" aria-label="Cancel adding a platform category" onClick={close}>
          <XIcon /> Cancel
        </Button>
      </div>

      {writesReachAccount(catalogSource) ? (
        <PermanenceNotice kind="authored-category" />
      ) : (
        <Hint icon={<InfoIcon className="size-4" />}>
          This demo keeps the vendor-authored category in this browser. When setup writes to a vendor account, it joins the shared platform catalog for every vendor with this business type and cannot be removed after Continue.
        </Hint>
      )}

      <div className="grid gap-4 @min-[32rem]:grid-cols-2">
        <div>
          <FieldLabel htmlFor="authored-category-name">Platform category name</FieldLabel>
          <input
            id="authored-category-name"
            value={name}
            autoComplete="off"
            aria-invalid={Boolean(nameError) || undefined}
            aria-describedby={nameError ? 'authored-category-name-error' : undefined}
            className={fieldShell}
            placeholder="For example, Celebration cakes"
            onChange={(event) => {
              setName(event.target.value)
              if (nameError) setNameError(null)
            }}
          />
          {nameError ? (
            <p id="authored-category-name-error" className="mt-1.5 text-xs font-medium text-destructive">
              {nameError}
            </p>
          ) : null}
        </div>
        <div>
          <FieldLabel htmlFor="authored-category-description" optional>Description</FieldLabel>
          <textarea
            id="authored-category-description"
            value={description}
            rows={3}
            className={`${fieldShell} h-auto min-h-20 resize-y py-2.5`}
            placeholder="What shoppers will find here"
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--ob-ink-soft)]">
          {categoryChoiceCount} of {categoryLimit} platform category choices used
        </p>
        <Button type="submit" size="sm" disabled={atLimit || businessTypeId === null}>
          <PlusIcon /> Add platform category
        </Button>
      </div>
    </form>
  )
}

export function AuthorProductForm({
  categoryId,
  categoryName,
  onAdded,
}: {
  categoryId: number
  categoryName: string
  onAdded: () => void
}) {
  const catalogSource = useOnboardingStore((state) => state.draft.catalogSource)
  const measurementCatalog = useOnboardingStore((state) => state.measurementCatalog)
  const addPendingProduct = useOnboardingStore((state) => state.addPendingProduct)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [measurementId, setMeasurementId] = useState<number | null>(
    measurementCatalog[0]?.id ?? null,
  )
  const [nameError, setNameError] = useState<string | null>(null)
  const selectedMeasurement =
    measurementCatalog.find((entry) => entry.id === measurementId) ??
    measurementCatalog[0] ??
    null

  const close = () => {
    setOpen(false)
    setName('')
    setDescription('')
    setMeasurementId(measurementCatalog[0]?.id ?? null)
    setNameError(null)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length < 3) {
      setNameError('Add a platform product name with at least 3 characters.')
      return
    }
    if (!selectedMeasurement) return

    addPendingProduct({
      name: trimmedName,
      categoryId,
      measurementId: selectedMeasurement.id,
      measurementName: selectedMeasurement.type,
      description: description.trim() || null,
    })
    close()
    onAdded()
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={!measurementCatalog.length}
        onClick={() => {
          setMeasurementId(measurementCatalog[0]?.id ?? null)
          setOpen(true)
        }}
      >
        <PlusIcon /> Add a platform product
      </Button>
    )
  }

  return (
    <form
      aria-label={`Add a platform product under ${categoryName}`}
      className="mb-4 space-y-4 rounded-xl border border-[var(--ob-line)] bg-[var(--ob-sheet)] p-4"
      onSubmit={submit}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-display text-sm font-semibold text-[var(--ob-ink)]">
            Add a platform product
          </h4>
          <p className="mt-1 text-xs leading-5 text-[var(--ob-ink-soft)]">
            Add it under {categoryName}, then choose how customers buy it.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Cancel adding a platform product under ${categoryName}`}
          onClick={close}
        >
          <XIcon /> Cancel
        </Button>
      </div>

      {writesReachAccount(catalogSource) ? (
        <PermanenceNotice kind="authored-product" />
      ) : (
        <Hint icon={<InfoIcon className="size-4" />}>
          This demo keeps the vendor-authored product in this browser. When setup writes to a vendor account, it joins the shared platform catalog under this category and cannot be removed after Continue.
        </Hint>
      )}

      <div className="grid gap-4 @min-[32rem]:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`authored-product-name-${categoryId}`}>
            Platform product name
          </FieldLabel>
          <input
            id={`authored-product-name-${categoryId}`}
            value={name}
            autoComplete="off"
            aria-invalid={Boolean(nameError) || undefined}
            aria-describedby={nameError ? `authored-product-name-error-${categoryId}` : undefined}
            className={fieldShell}
            placeholder="For example, Sourdough loaf"
            onChange={(event) => {
              setName(event.target.value)
              if (nameError) setNameError(null)
            }}
          />
          {nameError ? (
            <p
              id={`authored-product-name-error-${categoryId}`}
              className="mt-1.5 text-xs font-medium text-destructive"
            >
              {nameError}
            </p>
          ) : null}
        </div>
        <div>
          <FieldLabel htmlFor={`authored-product-measurement-${categoryId}`}>
            How it is measured
          </FieldLabel>
          <select
            id={`authored-product-measurement-${categoryId}`}
            value={selectedMeasurement?.id ?? ''}
            className={fieldShell}
            onChange={(event) => setMeasurementId(Number(event.target.value))}
          >
            {measurementCatalog.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {measurementLabel(entry.type)}
                {entry.units.length ? ` — ${entry.units.join(', ')}` : ''}
              </option>
            ))}
          </select>
          {selectedMeasurement ? (
            <p className="mt-1.5 text-xs text-[var(--ob-ink-soft)]">
              Sizes will start with {selectedMeasurement.units.join(' or ')}
              {selectedMeasurement.unitOptions.length
                ? `, with ${selectedMeasurement.unitOptions.join(', ')} as quantity suggestions.`
                : '.'}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <FieldLabel htmlFor={`authored-product-description-${categoryId}`} optional>
          Description
        </FieldLabel>
        <textarea
          id={`authored-product-description-${categoryId}`}
          value={description}
          rows={3}
          className={`${fieldShell} h-auto min-h-20 resize-y py-2.5`}
          placeholder="What shoppers should know about this product"
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!selectedMeasurement}>
          <PlusIcon /> Add platform product
        </Button>
      </div>
    </form>
  )
}
