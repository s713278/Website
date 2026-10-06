import { useState, type FormEvent } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui'
import { cn } from '@/lib/utils'
import { measurementLabel } from '../../lib/onboarding-measurement'
import {
  selectCategoryLimitReached,
  selectProductLimitReached,
  useOnboardingStore,
} from '../../store/onboarding-store'
import { fieldShell } from './StepPrimitives'

/**
 * One name field and one button, always in view, as in the design reference. The step
 * already explains what is saved; repeating it here made a quick add read like a form.
 */
export function AuthorCategoryForm({ onAdded }: { onAdded: () => void }) {
  const businessTypeId = useOnboardingStore(
    (state) => state.draft.business.businessType?.id ?? null,
  )
  const addPendingCategory = useOnboardingStore((state) => state.addPendingCategory)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const atLimit = useOnboardingStore(selectCategoryLimitReached)
  // A disabled field cannot be corrected, so its error would only linger.
  const error = atLimit ? null : nameError

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('Enter a category name.')
      return
    }
    if (atLimit || businessTypeId === null) return

    addPendingCategory({ name: trimmedName, businessTypeId })
    setName('')
    onAdded()
  }

  return (
    <form aria-label="Add your own category" onSubmit={submit}>
      <label htmlFor="authored-category-name" className="mb-1.5 block text-sm text-[var(--ob-ink-soft)]">
        Can’t find yours? Create your own category.
      </label>
      <div className="flex flex-col gap-2 @min-[30rem]:flex-row">
        <input
          id="authored-category-name"
          value={name}
          autoComplete="off"
          disabled={atLimit}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? 'authored-category-name-error' : undefined}
          className={cn(fieldShell, 'min-w-0 @min-[30rem]:flex-1')}
          placeholder="Category name"
          onChange={(event) => {
            setName(event.target.value)
            if (nameError) setNameError(null)
          }}
        />
        <Button type="submit" variant="outline" className="h-11 shrink-0" disabled={atLimit || businessTypeId === null}>
          <PlusIcon /> Add Category
        </Button>
      </div>
      {error ? (
        <p id="authored-category-name-error" className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}

/**
 * The reference's "Can’t find it? Add your own" row: a name, how it is measured, and one
 * button. Sizes and prices come on the next step, so nothing else is asked here.
 */
export function AuthorProductForm({
  categoryId,
  categoryName,
  onAdded,
}: {
  categoryId: number
  categoryName: string
  onAdded: () => void
}) {
  const measurementCatalog = useOnboardingStore((state) => state.measurementCatalog)
  const addPendingProduct = useOnboardingStore((state) => state.addPendingProduct)
  // Authoring a product counts against the same cumulative cap as selecting one.
  const atLimit = useOnboardingStore(selectProductLimitReached)
  const [name, setName] = useState('')
  const [measurementId, setMeasurementId] = useState<number | null>(
    measurementCatalog[0]?.id ?? null,
  )
  const [nameError, setNameError] = useState<string | null>(null)
  const selectedMeasurement =
    measurementCatalog.find((entry) => entry.id === measurementId) ??
    measurementCatalog[0] ??
    null
  // A disabled field cannot be corrected, so its error would only linger.
  const error = atLimit ? null : nameError
  const nameId = `authored-product-name-${categoryId}`
  const errorId = `authored-product-name-error-${categoryId}`

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length < 3) {
      setNameError('Enter a product name with at least 3 characters.')
      return
    }
    if (!selectedMeasurement || atLimit) return

    addPendingProduct({
      name: trimmedName,
      categoryId,
      measurementId: selectedMeasurement.id,
      measurementName: selectedMeasurement.type,
      description: null,
    })
    setName('')
    onAdded()
  }

  return (
    <form aria-label={`Add your own product to ${categoryName}`} onSubmit={submit}>
      <label htmlFor={nameId} className="mb-1.5 block text-sm text-[var(--ob-ink-soft)]">
        Can’t find it? Add your own.
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={nameId}
          value={name}
          autoComplete="off"
          disabled={atLimit}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(fieldShell, 'min-w-0 basis-full @min-[30rem]:basis-0 @min-[30rem]:flex-1')}
          placeholder="Product name"
          onChange={(event) => {
            setName(event.target.value)
            if (nameError) setNameError(null)
          }}
        />
        <select
          aria-label="How it is measured"
          value={selectedMeasurement?.id ?? ''}
          disabled={atLimit || !measurementCatalog.length}
          className={cn(fieldShell, 'w-auto min-w-0 flex-1 @min-[30rem]:flex-none')}
          onChange={(event) => setMeasurementId(Number(event.target.value))}
        >
          {measurementCatalog.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {measurementLabel(entry.type)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" className="h-11 shrink-0" disabled={atLimit || !selectedMeasurement}>
          <PlusIcon /> Add Product
        </Button>
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
