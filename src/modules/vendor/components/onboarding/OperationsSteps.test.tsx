// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { accountSkuId, localSkuId } from '../../lib/onboarding-sku-id'
import { useOnboardingStore } from '../../store/onboarding-store'
import type { DraftCategory, DraftSku, SelectedProduct, ValidationIssue } from '../../types/onboarding'
import { SkuStep } from './OperationsSteps'

afterEach(() => {
  cleanup()
  useOnboardingStore.getState().abandonDraft()
  useOnboardingStore.getState().setStoreSubmission(null)
  vi.restoreAllMocks()
})

function category(id: number, name: string): DraftCategory {
  return { id, name, businessTypeId: 7, description: null, imageUrl: null, displayOrder: null }
}

// Measurement 3 is COUNT in the sample catalog, and `pcs` is its first unit, so the
// reconcile effect leaves these sizes untouched.
function product(id: number, name: string, categoryId: number): SelectedProduct {
  return { id, name, description: null, imageUrl: null, measurementId: 3, measurementName: null, categoryId }
}

function sizeFor(productId: number, prices: Pick<DraftSku, 'listPrice' | 'salePrice'>): DraftSku {
  return {
    id: localSkuId(productId, []),
    productId,
    name: `Product ${productId}`,
    description: '',
    skuType: 'ITEM',
    measurementType: 'COUNT',
    unit: 'pcs',
    quantity: 1,
    active: true,
    homeDelivery: true,
    storePickup: true,
    ...prices,
  }
}

const fruits = category(10, 'Fruits')
const dairy = category(20, 'Dairy')
// The two faulty products sit in different categories, so the auto-open behaviour has to
// choose between category panels rather than products inside one panel.
const productA = product(501, 'Apples', fruits.id)
const productB = product(502, 'Butter', dairy.id)
const skuA = sizeFor(productA.id, { listPrice: 100, salePrice: 150 })
const skuB = sizeFor(productB.id, { listPrice: 100, salePrice: 150 })

const issues: ValidationIssue[] = [
  { step: 6, field: `sku-${skuA.id}-sale-price`, message: 'Discounted price cannot exceed MRP.' },
  { step: 6, field: `sku-${skuB.id}-sale-price`, message: 'Discounted price cannot exceed MRP.' },
]

function seedDraft(
  products: SelectedProduct[] = [productA, productB],
  skus: DraftSku[] = [skuA, skuB],
  categories: DraftCategory[] = [fruits, dairy],
) {
  useOnboardingStore.getState().updateDraft((current) => ({ ...current, categories, products, skus }))
}

function panel(key: number | 'other') {
  const details = document.getElementById(`sku-category-${key}`)
  if (!(details instanceof HTMLDetailsElement)) throw new Error(`Expected a panel for category ${key}`)
  return details
}

function summaryElement(details: HTMLDetailsElement) {
  const summary = details.querySelector('summary')
  if (!summary) throw new Error(`Expected a summary in ${details.id}`)
  return summary
}

function summaryOf(details: HTMLDetailsElement) {
  return summaryElement(details).textContent ?? ''
}

// The category's product-count line under its name.
function metaOf(details: HTMLDetailsElement) {
  return summaryElement(details).querySelector('p')?.textContent ?? ''
}

const follows = (first: Node, second: Node) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

// The vendor toggling a panel: the browser flips `open`, then fires a non-bubbling toggle.
function setPanelOpen(key: number | 'other', open: boolean) {
  act(() => {
    const details = panel(key)
    details.open = open
    fireEvent(details, new Event('toggle'))
  })
}

function input(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) {
    throw new Error(`Expected a form control #${id}`)
  }
  return element
}

const salePriceInput = (sku: DraftSku) => input(`sku-${sku.id}-sale-price`) as HTMLInputElement

describe('SkuStep failed-Continue panel', () => {
  it('opens the category of the first faulty product when issues first arrive', () => {
    seedDraft()
    const { rerender } = render(<SkuStep issues={[]} />)

    // Move the vendor off the first category so the issue effect has something to do.
    setPanelOpen(dairy.id, true)
    expect(panel(dairy.id).open).toBe(true)
    expect(panel(fruits.id).open).toBe(false)

    rerender(<SkuStep issues={issues} />)

    expect(panel(fruits.id).open).toBe(true)
    expect(panel(dairy.id).open).toBe(false)
  })

  it('keeps the vendor in a second faulty category while editing its price', () => {
    seedDraft()
    render(<SkuStep issues={issues} />)
    expect(panel(fruits.id).open).toBe(true)

    // The vendor opens the second faulty product's category to fix it.
    setPanelOpen(dairy.id, true)
    expect(panel(dairy.id).open).toBe(true)

    const price = salePriceInput(skuB)
    price.focus()
    fireEvent.change(price, { target: { value: '9' } })

    expect(useOnboardingStore.getState().draft.skus.find((sku) => sku.id === skuB.id)?.salePrice).toBe(9)
    // The stale issues must not drag the accordion back to the first faulty category.
    expect(panel(dairy.id).open).toBe(true)
    expect(panel(fruits.id).open).toBe(false)
  })

  it('keeps the vendor in a second faulty category when its issue is resolved', () => {
    seedDraft()
    const { rerender } = render(<SkuStep issues={[issues[0], issues[1]]} />)
    expect(panel(fruits.id).open).toBe(true)

    setPanelOpen(dairy.id, true)
    expect(panel(dairy.id).open).toBe(true)

    // B's issue is fixed: the wizard passes a new, shrunken list.
    rerender(<SkuStep issues={[issues[0]]} />)

    expect(panel(dairy.id).open).toBe(true)
    expect(panel(fruits.id).open).toBe(false)
  })

  it('still opens the category of the first faulty product when a new issue arrives', () => {
    seedDraft()
    const { rerender } = render(<SkuStep issues={issues} />)

    setPanelOpen(dairy.id, true)
    expect(panel(dairy.id).open).toBe(true)

    const newIssue: ValidationIssue = { step: 6, field: `sku-${skuA.id}-list-price`, message: 'Required field.' }
    rerender(<SkuStep issues={[...issues, newIssue]} />)

    expect(panel(fruits.id).open).toBe(true)
    expect(panel(dairy.id).open).toBe(false)
  })
})

describe('SkuStep category grouping', () => {
  const pricedA = sizeFor(productA.id, { listPrice: 100, salePrice: 90 })
  const unpricedB = sizeFor(productB.id, { listPrice: null, salePrice: null })

  it('renders each product inside its own category panel with a product count', () => {
    seedDraft([productA, productB], [pricedA, unpricedB])
    render(<SkuStep issues={[]} />)

    const fruitsPanel = panel(fruits.id)
    const dairyPanel = panel(dairy.id)
    // Single-open accordion: the first category starts open.
    expect(fruitsPanel.open).toBe(true)
    expect(dairyPanel.open).toBe(false)

    expect(fruitsPanel.querySelector(`#product-${productA.id}`)).not.toBeNull()
    expect(fruitsPanel.querySelector(`#product-${productB.id}`)).toBeNull()
    expect(dairyPanel.querySelector(`#product-${productB.id}`)).not.toBeNull()
    expect(dairyPanel.querySelector(`#product-${productA.id}`)).toBeNull()
    expect(within(fruitsPanel).getByRole('heading', { level: 4, name: 'Apples' }).id).toBe(`sku-product-${productA.id}`)
    expect(within(dairyPanel).getByRole('heading', { level: 4, name: 'Butter' }).id).toBe(`sku-product-${productB.id}`)

    // The meta line is the count alone, priced or not: no pricing status.
    expect(summaryOf(fruitsPanel)).toContain('Fruits')
    expect(metaOf(fruitsPanel)).toBe('1 product')
    expect(summaryOf(dairyPanel)).toContain('Dairy')
    expect(metaOf(dairyPanel)).toBe('1 product')
    for (const details of [fruitsPanel, dairyPanel]) {
      expect(summaryOf(details)).not.toMatch(/pricing|All priced/)
    }

    // Each product offers its own "+ Size" action, named for the product.
    expect(within(fruitsPanel).getByRole('button', { name: 'Add another size to Apples' })).toBeTruthy()
    expect(within(dairyPanel).getByRole('button', { name: 'Add another size to Butter' })).toBeTruthy()
  })

  it('counts every product in a category and prompts when no panel is open', () => {
    const cheese = product(503, 'Cheese', dairy.id)
    seedDraft(
      [productA, productB, cheese],
      [pricedA, unpricedB, sizeFor(cheese.id, { listPrice: null, salePrice: null })],
    )
    render(<SkuStep issues={[]} />)

    expect(metaOf(panel(dairy.id))).toBe('2 products')
    expect(summaryOf(panel(dairy.id))).not.toMatch(/pricing/)
    expect(screen.queryByText('Tap a category to set prices.')).toBeNull()

    setPanelOpen(fruits.id, false)

    expect(panel(fruits.id).open).toBe(false)
    expect(panel(dairy.id).open).toBe(false)
    expect(screen.getByText('Tap a category to set prices.')).toBeTruthy()
  })

  it('collects a product whose category is not in the draft under Other products', () => {
    const stray = product(509, 'Mystery Box', 99)
    seedDraft([productA, stray], [pricedA, sizeFor(stray.id, { listPrice: 50, salePrice: 40 })], [fruits])
    render(<SkuStep issues={[]} />)

    const other = panel('other')
    expect(summaryOf(other)).toContain('Other products')
    expect(other.querySelector(`#product-${stray.id}`)).not.toBeNull()
    expect(panel(fruits.id).querySelector(`#product-${stray.id}`)).toBeNull()
    expect(document.getElementById('sku-category-99')).toBeNull()
  })
})

describe('SkuStep category panel', () => {
  it('puts the chevron first in the summary and the count pill last', () => {
    seedDraft()
    render(<SkuStep issues={[]} />)

    const summary = summaryElement(panel(fruits.id))
    const first = summary.firstElementChild
    expect(first?.getAttribute('aria-hidden')).toBe('true')
    expect(first?.querySelector('svg')).not.toBeNull()
    expect(summary.lastElementChild?.textContent).toBe('1')
    expect(summary.querySelector('h3')?.textContent).toBe('Fruits')
  })

  it('shows "No products" for an empty category', () => {
    seedDraft([productA], [skuA], [fruits, dairy])
    render(<SkuStep issues={[]} />)

    expect(metaOf(panel(dairy.id))).toBe('No products')
    expect(summaryElement(panel(dairy.id)).lastElementChild?.textContent).toBe('0')
  })
})

describe('SkuStep size row', () => {
  it('exposes Quantity, Unit, MRP, Discounted price, status and remove in order within the size group', () => {
    seedDraft([productA], [skuA], [fruits])
    render(<SkuStep issues={[]} />)

    const quantity = input(`sku-${skuA.id}-quantity`)
    const row = quantity.closest('fieldset')
    if (!row) throw new Error('Expected the quantity input inside a size fieldset')
    expect(row.getAttribute('aria-label')).toMatch(/^Apples, .+ size$/)
    const group = within(panel(fruits.id)).getByRole('group', { name: row.getAttribute('aria-label')! })
    expect(group).toBe(row)
    // The product block is itself a group named by its heading, and holds the row.
    const productBlock = within(panel(fruits.id)).getByRole('group', { name: 'Apples' })
    expect(productBlock.id).toBe(`product-${productA.id}`)
    expect(productBlock.contains(row)).toBe(true)

    const controls = [
      within(group).getByLabelText('Quantity'),
      within(group).getByLabelText('Unit'),
      within(group).getByLabelText('MRP (₹)'),
      within(group).getByLabelText('Discounted price (₹)'),
      within(group).getByRole('switch'),
      within(group).getByRole('button', { name: /^Remove / }),
    ]
    expect(controls.slice(0, 4).map((control) => control.id)).toEqual([
      `sku-${skuA.id}-quantity`,
      `sku-${skuA.id}-unit`,
      `sku-${skuA.id}-list-price`,
      `sku-${skuA.id}-sale-price`,
    ])
    expect(controls[1].tagName).toBe('SELECT')
    for (let index = 1; index < controls.length; index += 1) {
      expect(follows(controls[index - 1], controls[index])).toBe(true)
    }
    expect(within(group).queryByLabelText('Price (₹)')).toBeNull()
  })

  it('renders each field error directly below its own input, tied to it', () => {
    seedDraft([productA], [skuA], [fruits])
    const listIssue: ValidationIssue = { step: 6, field: `sku-${skuA.id}-list-price`, message: 'MRP must be greater than zero.' }
    render(<SkuStep issues={[issues[0], listIssue]} />)

    const price = salePriceInput(skuA)
    const error = document.getElementById(`${price.id}-error`)
    expect(error?.tagName).toBe('P')
    expect(error?.textContent).toBe('Discounted price cannot exceed MRP.')
    expect(price.getAttribute('aria-invalid')).toBe('true')
    expect(price.getAttribute('aria-describedby')?.split(/\s+/)).toContain(`${price.id}-error`)
    // In the input's own cell, straight after it, so it sits before the row's remove button.
    expect(price.nextElementSibling).toBe(error)
    const remove = screen.getByRole('button', { name: /^Remove / })
    expect(follows(error!, remove)).toBe(true)

    const mrp = input(`sku-${skuA.id}-list-price`)
    const mrpError = document.getElementById(`${mrp.id}-error`)
    expect(mrpError?.textContent).toBe('MRP must be greater than zero.')
    expect(mrp.getAttribute('aria-invalid')).toBe('true')
    expect(mrp.getAttribute('aria-describedby')?.split(/\s+/)).toContain(`${mrp.id}-error`)
    expect(mrp.nextElementSibling).toBe(mrpError)
    // Inputs without an issue carry no error.
    expect(document.getElementById(`sku-${skuA.id}-quantity-error`)).toBeNull()
    expect(input(`sku-${skuA.id}-quantity`).getAttribute('aria-invalid')).toBeNull()
  })

  it('keeps Required field errors under quantity and discounted price, with status and remove in the row grid', () => {
    seedDraft([productA], [skuA], [fruits])
    render(
      <SkuStep
        issues={[
          { step: 6, field: `sku-${skuA.id}-quantity`, message: 'Required field.' },
          { step: 6, field: `sku-${skuA.id}-sale-price`, message: 'Required field.' },
        ]}
      />,
    )

    const quantity = input(`sku-${skuA.id}-quantity`)
    const price = salePriceInput(skuA)
    const quantityError = document.getElementById(`${quantity.id}-error`)
    const priceError = document.getElementById(`${price.id}-error`)
    for (const [control, error] of [[quantity, quantityError], [price, priceError]] as const) {
      expect(error?.textContent).toBe('Required field.')
      expect(control.nextElementSibling).toBe(error)
      expect(error?.parentElement).toBe(control.parentElement)
      expect(control.getAttribute('aria-invalid')).toBe('true')
      expect(control.getAttribute('aria-describedby')?.split(/\s+/)).toContain(`${control.id}-error`)
    }
    // Each cell is its own column; the grid holding them also holds the switch and remove button.
    expect(quantity.parentElement).not.toBe(price.parentElement)
    const grid = quantity.parentElement?.parentElement
    if (!grid) throw new Error('Expected the quantity cell inside the row grid')
    expect(price.parentElement?.parentElement).toBe(grid)
    const row = quantity.closest('fieldset')!
    expect(grid).not.toBe(row)
    expect(row.contains(grid)).toBe(true)
    expect(grid.contains(within(row).getByRole('switch'))).toBe(true)
    expect(grid.contains(within(row).getByRole('button', { name: /^Remove / }))).toBe(true)
    // No size-level error for field issues.
    expect(document.getElementById(`sku-${skuA.id}-error`)).toBeNull()
    expect(row.getAttribute('aria-describedby')).toBeNull()
  })
})

describe('SkuStep step and size-level issues', () => {
  it('renders a size-level issue after the row grid, tied to the row', () => {
    const second: DraftSku = { ...skuA, id: localSkuId(productA.id, [skuA]), quantity: 6 }
    seedDraft([productA], [skuA, second], [fruits])
    const sizeIssue: ValidationIssue = { step: 6, field: `sku-${second.id}`, message: 'This size no longer matches its product.' }
    const priceIssue: ValidationIssue = { step: 6, field: `sku-${second.id}-sale-price`, message: 'Discounted price cannot exceed MRP.' }
    render(<SkuStep issues={[priceIssue, sizeIssue]} />)

    const row = document.getElementById(`sku-${second.id}`)
    expect(row?.tagName).toBe('FIELDSET')
    const error = document.getElementById(`sku-${second.id}-error`)
    expect(error?.textContent).toBe('This size no longer matches its product.')
    expect(row?.getAttribute('aria-describedby')?.split(/\s+/)).toContain(`sku-${second.id}-error`)
    // The field error stays in its cell; the size-level error follows the whole grid.
    const saleInput = salePriceInput(second)
    const saleError = document.getElementById(`sku-${second.id}-sale-price-error`)
    expect(saleInput.nextElementSibling).toBe(saleError)
    const remove = within(row!).getByRole('button', { name: /^Remove / })
    expect(follows(remove, error!)).toBe(true)
    expect(saleInput.parentElement?.parentElement?.contains(error)).toBe(false)
    expect(row?.contains(error)).toBe(true)
    // The other size carries no error.
    expect(document.getElementById(`sku-${skuA.id}-error`)).toBeNull()
  })

  it('renders a step-level size issue inline, described by the sizes area', () => {
    seedDraft([productA], [skuA], [fruits])
    render(<SkuStep issues={[{ step: 6, field: 'skus', message: 'Could not create size' }]} />)

    const error = document.getElementById('skus-error')
    expect(error?.textContent).toBe('Could not create size')
    const area = document.getElementById('skus')
    expect(area?.contains(error)).toBe(true)
    expect(area?.getAttribute('aria-describedby')).toBe('skus-error')
  })
})

describe('SkuStep remove and new sizes', () => {
  it("shows a product's only size with a disabled, non-interactive cross", () => {
    seedDraft([productA], [skuA], [fruits])
    render(<SkuStep issues={[]} />)

    const remove = within(panel(fruits.id)).getByRole('button', { name: 'Remove 1 pcs' })
    expect(remove.matches(':disabled')).toBe(true)
    expect(remove.className).toContain('pointer-events-none')
    expect(remove.querySelector('svg.lucide-x')).not.toBeNull()
    expect(remove.querySelector('svg[class*="trash"]')).toBeNull()
    fireEvent.click(remove)
    expect(useOnboardingStore.getState().draft.skus.map((sku) => sku.id)).toEqual([skuA.id])
  })

  it('enables the cross once the product has a second size', () => {
    const second: DraftSku = { ...skuA, id: localSkuId(productA.id, [skuA]), quantity: 6 }
    seedDraft([productA], [skuA, second], [fruits])
    render(<SkuStep issues={[]} />)

    const remove = within(panel(fruits.id)).getByRole('button', { name: 'Remove 6 pcs' })
    expect(remove.matches(':disabled')).toBe(false)
    expect(remove.className).not.toContain('pointer-events-none')
  })

  it('removes one of two sizes immediately, without asking first', () => {
    const second: DraftSku = { ...skuA, id: localSkuId(productA.id, [skuA]), quantity: 6 }
    seedDraft([productA], [skuA, second], [fruits])
    render(<SkuStep issues={[]} />)

    fireEvent.click(within(panel(fruits.id)).getByRole('button', { name: 'Remove 6 pcs' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByText('Remove this size?')).toBeNull()
    expect(useOnboardingStore.getState().draft.skus.map((sku) => sku.id)).toEqual([skuA.id])
    expect(within(panel(fruits.id)).queryByRole('button', { name: 'Remove 6 pcs' })).toBeNull()
    // The size left behind is now the product's only one, so its cross locks.
    expect(within(panel(fruits.id)).getByRole('button', { name: 'Remove 1 pcs' }).matches(':disabled')).toBe(true)
  })

  it('moves focus to the product\'s "+ Size" after removing a size', async () => {
    const second: DraftSku = { ...skuA, id: localSkuId(productA.id, [skuA]), quantity: 6 }
    seedDraft([productA], [skuA, second], [fruits])
    render(<SkuStep issues={[]} />)

    const remove = within(panel(fruits.id)).getByRole('button', { name: 'Remove 6 pcs' })
    remove.focus()
    fireEvent.click(remove)

    const add = within(panel(fruits.id)).getByRole('button', { name: 'Add another size to Apples' })
    await waitFor(() => expect(document.activeElement).toBe(add))
  })

  it('adds a blank size with "+ Size" and leaves the previous size untouched', () => {
    seedDraft([productA], [skuA], [fruits])
    render(<SkuStep issues={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add another size to Apples' }))

    const skus = useOnboardingStore.getState().draft.skus
    expect(skus).toHaveLength(2)
    const added = skus[1]
    expect(added).toMatchObject({ quantity: null, listPrice: null, salePrice: null, unit: 'pcs' })
    expect((input(`sku-${added.id}-quantity`) as HTMLInputElement).value).toBe('')
    expect((input(`sku-${added.id}-list-price`) as HTMLInputElement).value).toBe('')
    expect((input(`sku-${added.id}-sale-price`) as HTMLInputElement).value).toBe('')
    expect(input(`sku-${added.id}-unit`).value).toBe('pcs')
    expect((input(`sku-${skuA.id}-quantity`) as HTMLInputElement).value).toBe('1')
  })

  it('scaffolds a blank first size for a product without one', () => {
    seedDraft([productA], [], [fruits])
    render(<SkuStep issues={[]} />)

    const skus = useOnboardingStore.getState().draft.skus
    expect(skus).toHaveLength(1)
    expect(skus[0]).toMatchObject({ productId: productA.id, quantity: null, listPrice: null, salePrice: null, unit: 'pcs' })
    expect((input(`sku-${skus[0].id}-quantity`) as HTMLInputElement).value).toBe('')
  })
})

describe('SkuStep read-only size row', () => {
  it('gives the saved price cells accessible MRP and Discounted price context, MRP first', () => {
    const saved: DraftSku = { ...sizeFor(productA.id, { listPrice: 100, salePrice: 90 }), id: accountSkuId(4001) }
    seedDraft([productA], [saved], [fruits])
    useOnboardingStore.getState().setStoreSubmission({ storeIdentifier: 'test-store', approvalStatus: 'APPROVED', vendorStatus: 'ACTIVE' })
    render(<SkuStep issues={[]} />)

    const row = within(panel(fruits.id)).getByRole('group', { name: /^Apples, .+ size$/ })
    expect(within(row).queryByLabelText('Quantity')).toBeNull()
    // The visible amounts stay bare; the smallest element around each one that also carries
    // its label is the cell, and that cell reads as "<label> <amount>" and nothing else.
    const cell = (amount: string, label: string) => {
      let element: HTMLElement | null = within(row).getByText(amount)
      while (element && element !== row && !element.textContent?.includes(label)) element = element.parentElement
      return (element?.textContent ?? '').replace(/\s+/g, ' ').trim()
    }
    expect(cell('₹90', 'Discounted price')).toMatch(/^Discounted price:? ?₹90$/)
    expect(cell('₹100', 'MRP')).toMatch(/^MRP:? ?₹100$/)
    expect(follows(within(row).getByText('₹100'), within(row).getByText('₹90'))).toBe(true)
    // Saved sizes cannot be removed here, but their cross is disabled rather than inert.
    const remove = within(row).getByRole('button', { name: /^Remove / })
    expect(remove.matches(':disabled')).toBe(true)
    expect(remove.className).not.toContain('pointer-events-none')
  })
})
